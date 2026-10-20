-- =====================================================
-- MIGRACIÓN 011: COMPRAS DETALLE (Fase 3 de Compras)
-- Fecha: 2026-09-02
-- Fuente: "Modulo Compras.docx" - Controles 25, 19, 29, 29.1, 30
-- Ver: docs/modulo-compras.md secciones 2, 3, 4, 5, 6
-- =====================================================
--
-- Control 25: el mismo producto puede repetirse en la misma compra con
-- precios distintos. Por eso la PK es iddetalle, NO (idcompra, idprod).
--
-- Control 30: grid de 15 columnas con costos DECIMAL(14,4).
--
-- DECISIÓN DE DISEÑO (Fase 4 bloqueada por B1):
--   Se crea un encabezado mínimo `compras` (Compras1 stub) con estado
--   BORRADOR para que las líneas tengan FK. Fase 4 ampliará fechas,
--   totales, tipos de documento y estados adicionales.
-- =====================================================

SET NAMES utf8mb4;


-- =====================================================
-- 1. ENCABEZADO MÍNIMO (Compras1 stub)
-- =====================================================

CREATE TABLE IF NOT EXISTS compras (
  idcompra INT AUTO_INCREMENT PRIMARY KEY,

  estado ENUM('BORRADOR') NOT NULL DEFAULT 'BORRADOR'
    COMMENT 'Fase 4 ampliará estados (confirmado, anulado, etc.). Por ahora solo borradores',

  idproveedor INT NULL
    COMMENT 'Proveedor asociado. Opcional en borrador hasta capturar la factura',

  notas TEXT NULL
    COMMENT 'Observaciones internas del borrador',

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_compras_proveedor
    FOREIGN KEY (idproveedor) REFERENCES proveedores(idproveedor)
    ON DELETE SET NULL,

  INDEX idx_compras_estado (estado),
  INDEX idx_compras_proveedor (idproveedor),
  INDEX idx_compras_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Encabezado mínimo de compras (Compras1). Fase 4 expandirá campos fiscales';


-- =====================================================
-- 2. DETALLE DE LÍNEAS (Compras2)
-- =====================================================

CREATE TABLE IF NOT EXISTS compras_detalle (
  iddetalle INT AUTO_INCREMENT PRIMARY KEY,

  idcompra INT NOT NULL,
  numero_linea INT NOT NULL
    COMMENT 'Control 30 - No. Orden visual en el documento. Reordenable',

  -- Control 30 - Orden de trabajo (control 21). Texto editable, sin FK estricta
  numero_orden VARCHAR(50) NULL
    COMMENT 'Referencia a orden de trabajo. Editable por el usuario',

  -- Control 29 - Destino / naturaleza del registro
  destino ENUM('INVENTARIO','EXPRESS','ACTIVOS','GASTOS') NOT NULL DEFAULT 'INVENTARIO',

  -- Control 29.1 - Rubro contable (obligatorio cuando destino es GASTOS o ACTIVOS)
  idcatalogo INT NULL,

  -- Producto de inventario (nullable para líneas sin producto, ej. impuesto municipal)
  idprod INT NULL,

  referencia_proveedor VARCHAR(100) NULL
    COMMENT 'Control 30 - Referencia tal como la usa el proveedor',

  descripcion VARCHAR(255) NOT NULL
    COMMENT 'Control 30 - Snapshot del nombre. No editable en UI; viene de inventario o rubro',

  cantidad DECIMAL(14,4) NOT NULL DEFAULT 1.0000,
  costo_unitario DECIMAL(14,4) NOT NULL DEFAULT 0.0000
    COMMENT 'Control 30 - Hasta 4 decimales',

  descuento_porcentaje DECIMAL(5,2) NOT NULL DEFAULT 0.00
    COMMENT 'Control 28/30 - Porcentaje informativo. Ver PREGUNTA 1 en modulo-compras.md',

  subtotal_sin_iva DECIMAL(14,4) NOT NULL DEFAULT 0.0000,
  iva_unitario DECIMAL(14,4) NOT NULL DEFAULT 0.0000,
  subtotal_con_iva DECIMAL(14,4) NOT NULL DEFAULT 0.0000,
  exento_unitario DECIMAL(14,4) NOT NULL DEFAULT 0.0000,
  no_sujeto_unitario DECIMAL(14,4) NOT NULL DEFAULT 0.0000,

  -- Control 19 - Condición de IVA
  condicion_iva ENUM('GRAVADA','EXENTO','NO_SUJETO','XCOMPROBAR') NOT NULL DEFAULT 'GRAVADA',

  imagen_url VARCHAR(500) NULL
    COMMENT 'Control 30 - URL de imagen del producto al momento de la línea',

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_detalle_compra
    FOREIGN KEY (idcompra) REFERENCES compras(idcompra)
    ON DELETE CASCADE,

  CONSTRAINT fk_detalle_catalogo
    FOREIGN KEY (idcatalogo) REFERENCES catalogo_contable(idcatalogo)
    ON DELETE SET NULL,

  CONSTRAINT fk_detalle_producto
    FOREIGN KEY (idprod) REFERENCES productos(idprod)
    ON DELETE SET NULL,

  -- Una sola línea por número dentro de la misma compra
  CONSTRAINT uq_detalle_compra_linea UNIQUE (idcompra, numero_linea),

  -- Control 25: NO hay UNIQUE(idcompra, idprod) — el mismo producto puede repetirse

  INDEX idx_detalle_compra (idcompra),
  INDEX idx_detalle_producto (idprod),
  INDEX idx_detalle_catalogo (idcatalogo),
  INDEX idx_detalle_destino (destino),
  INDEX idx_detalle_orden (numero_orden)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Líneas de compra (Compras2 / control 30). PK por línea, DECIMAL(14,4)';


-- =====================================================
-- 3. VISTA DE LECTURA CON JOINS
-- =====================================================

CREATE OR REPLACE VIEW v_compras_detalle AS
SELECT
  d.iddetalle,
  d.idcompra,
  d.numero_linea,
  d.numero_orden,
  d.destino,
  d.idcatalogo,
  c.codigo AS catalogo_codigo,
  c.nombre AS catalogo_nombre,
  c.tipo AS catalogo_tipo,
  d.idprod,
  p.OE AS producto_oe,
  d.referencia_proveedor,
  d.descripcion,
  d.cantidad,
  d.costo_unitario,
  d.descuento_porcentaje,
  d.subtotal_sin_iva,
  d.iva_unitario,
  d.subtotal_con_iva,
  d.exento_unitario,
  d.no_sujeto_unitario,
  d.condicion_iva,
  d.imagen_url,
  d.created_at,
  d.updated_at
FROM compras_detalle d
LEFT JOIN catalogo_contable c ON c.idcatalogo = d.idcatalogo
LEFT JOIN productos p ON p.idprod = d.idprod;


-- =====================================================
-- FIN DE MIGRACIÓN 011
-- =====================================================

SELECT 'Migración 011 completada - Compras detalle (control 30)' AS status;
