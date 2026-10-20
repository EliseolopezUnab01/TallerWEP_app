-- =====================================================
-- MIGRACIÓN 012: COMPRAS NACIONALES — ENCABEZADO DTE
-- Fecha: 2026-09-22
-- Fuente: Manual Funcional del Sistema de Transmisión DTE V 2.0 (MH El Salvador)
--         + indicación del cliente (compras nacionales mientras él trabaja importaciones)
-- Ver: docs/modulo-compras.md (controles 1, 5–9, 12) y docs/ESTADO.md
-- =====================================================
--
-- Amplía el stub de `compras` (migración 011) con identificación DTE,
-- fechas, totales del resumen, condición de pago, y catálogos de Hacienda.
-- No recrea tablas: ALTER sobre `compras` y `compras_detalle` para
-- preservar borradores existentes.
-- =====================================================

SET NAMES utf8mb4;


-- =====================================================
-- 1. CATÁLOGO DE TIPOS DTE (CAT-002)
-- =====================================================

CREATE TABLE IF NOT EXISTS cat_tipos_dte (
  codigo VARCHAR(2) PRIMARY KEY
    COMMENT 'Código Hacienda CAT-002 (01, 03, 05, 06, 10, etc.)',
  nombre VARCHAR(120) NOT NULL
    COMMENT 'Nombre oficial completo',
  abreviatura VARCHAR(10) NOT NULL
    COMMENT 'FE, CCFE, NCE, NDE, FSEE, etc.',
  activo_compras TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1 si se usa en el módulo de compras nacionales',
  descripcion VARCHAR(255) NULL
    COMMENT 'Nota breve sobre cuándo se usa'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Catálogo CAT-002 Tipo de Documento Tributario Electrónico';

INSERT INTO cat_tipos_dte (codigo, nombre, abreviatura, activo_compras, descripcion) VALUES
  ('01', 'Factura Electrónica', 'FE', 1, 'Compra a consumidor final'),
  ('03', 'Comprobante de Crédito Fiscal Electrónico', 'CCFE', 1, 'Compra entre contribuyentes (el más común)'),
  ('04', 'Nota de Remisión Electrónica', 'NRE', 0, 'Traslado de bienes; no es documento de compra'),
  ('05', 'Nota de Crédito Electrónica', 'NCE', 1, 'Ajuste/devolución sobre un CCFE o FE recibido'),
  ('06', 'Nota de Débito Electrónica', 'NDE', 1, 'Cargo adicional sobre un CCFE'),
  ('07', 'Comprobante de Retención Electrónico', 'CRE', 0, 'Retención; no es documento de compra'),
  ('08', 'Comprobante de Liquidación Electrónico', 'CLE', 0, 'Liquidación por cuenta de terceros'),
  ('09', 'Documento Contable de Liquidación Electrónico', 'DCLE', 0, 'Liquidación de afiliados'),
  ('11', 'Factura de Exportación Electrónica', 'FEXE', 0, 'Exportación; compras internacionales se tratan aparte'),
  ('14', 'Factura de Sujeto Excluido Electrónica', 'FSEE', 1, 'Compra a sujetos excluidos'),
  ('15', 'Comprobante de Donación Electrónico', 'CDE', 0, 'Donaciones')
ON DUPLICATE KEY UPDATE
  nombre = VALUES(nombre),
  abreviatura = VALUES(abreviatura),
  activo_compras = VALUES(activo_compras),
  descripcion = VALUES(descripcion);


-- =====================================================
-- 2. CATÁLOGO DE FORMAS DE PAGO (CAT-017)
-- =====================================================

CREATE TABLE IF NOT EXISTS cat_formas_pago (
  codigo VARCHAR(2) PRIMARY KEY
    COMMENT 'Código CAT-017 Hacienda',
  nombre VARCHAR(80) NOT NULL
    COMMENT 'Descripción de la forma de pago'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Catálogo CAT-017 Formas de Pago';

INSERT INTO cat_formas_pago (codigo, nombre) VALUES
  ('01', 'Billetes y monedas'),
  ('02', 'Tarjeta débito'),
  ('03', 'Tarjeta crédito'),
  ('04', 'Cheque'),
  ('05', 'Transferencia / Depósito bancario'),
  ('06', 'Vales o cupones'),
  ('08', 'Dinero electrónico'),
  ('12', 'Cuentas por pagar / Intercambio / Compensación'),
  ('13', 'Dinero electrónico no bancario'),
  ('14', 'Bitcoin'),
  ('99', 'Otro')
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);


-- =====================================================
-- 3. CATÁLOGO DE TRIBUTOS (CAT-015, sección 1)
-- =====================================================

CREATE TABLE IF NOT EXISTS cat_tributos (
  codigo VARCHAR(3) PRIMARY KEY
    COMMENT 'Código CAT-015 Hacienda',
  nombre VARCHAR(120) NOT NULL,
  seccion TINYINT NOT NULL DEFAULT 1
    COMMENT '1=resumen, 2=cuerpo, 3=informativo',
  tasa DECIMAL(6,4) NULL
    COMMENT 'Ej: 0.1300 para IVA 13%. NULL si fija o variable'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Catálogo CAT-015 Tributos (sección 1 relevantes a compras nacionales)';

INSERT INTO cat_tributos (codigo, nombre, seccion, tasa) VALUES
  ('20', 'Impuesto al Valor Agregado 13%', 1, 0.1300),
  ('C3', 'Impuesto al Valor Agregado (exportaciones) 0%', 1, 0.0000),
  ('59', 'Turismo: por alojamiento (5%)', 1, 0.0500),
  ('71', 'Turismo: salida del país por vía aérea $7.00', 1, NULL),
  ('D1', 'FOVIAL ($0.20 ctvs. por galón)', 1, NULL),
  ('C8', 'COTRANS ($0.10 ctvs. por galón)', 1, NULL)
ON DUPLICATE KEY UPDATE
  nombre = VALUES(nombre),
  seccion = VALUES(seccion),
  tasa = VALUES(tasa);


-- =====================================================
-- 4. AMPLIAR ENCABEZADO compras
-- =====================================================
-- MySQL no tiene "ADD COLUMN IF NOT EXISTS". Se asume que esta migración
-- se ejecuta una sola vez sobre el stub de la 011.

ALTER TABLE compras
  MODIFY estado ENUM('BORRADOR','REGISTRADA','ANULADA') NOT NULL DEFAULT 'BORRADOR'
    COMMENT 'BORRADOR editable, REGISTRADA confirma, ANULADA cierra';

ALTER TABLE compras
  ADD COLUMN tipo_dte VARCHAR(2) NULL AFTER estado
    COMMENT 'FK cat_tipos_dte: 01=FE, 03=CCFE, 05=NCE, 06=NDE, 14=FSEE',
  ADD COLUMN numero_control VARCHAR(31) NULL AFTER tipo_dte
    COMMENT 'Número de control del DTE (DTE-XX-XXXXXXXX-XXXXXXXXXXXXXXX)',
  ADD COLUMN codigo_generacion VARCHAR(36) NULL AFTER numero_control
    COMMENT 'UUID del DTE (código de generación de Hacienda)',
  ADD COLUMN sello_recepcion VARCHAR(100) NULL AFTER codigo_generacion
    COMMENT 'Sello de recepción otorgado por MH',
  ADD COLUMN numero_factura VARCHAR(100) NULL AFTER sello_recepcion
    COMMENT 'Número de factura alfanumérico (control 8, hasta 100 chars)',
  ADD COLUMN referencia_contable VARCHAR(30) NULL AFTER numero_factura
    COMMENT 'Referencia del libro contable (control 9)',

  ADD COLUMN fecha_emision DATE NULL AFTER referencia_contable
    COMMENT 'Fecha de emisión del DTE del proveedor',
  ADD COLUMN fecha_recepcion DATE NULL AFTER fecha_emision
    COMMENT 'Fecha en que se recibió en bodega',
  ADD COLUMN fecha_registro DATE NULL AFTER fecha_recepcion
    COMMENT 'Fecha en que se ingresó al sistema (CURDATE al registrar)',

  ADD COLUMN total_gravado DECIMAL(14,2) NOT NULL DEFAULT 0.00
    COMMENT 'Suma ventas gravadas de todas las líneas',
  ADD COLUMN total_exento DECIMAL(14,2) NOT NULL DEFAULT 0.00
    COMMENT 'Suma ventas exentas',
  ADD COLUMN total_no_sujeto DECIMAL(14,2) NOT NULL DEFAULT 0.00
    COMMENT 'Suma ventas no sujetas',
  ADD COLUMN total_xcomprobar DECIMAL(14,2) NOT NULL DEFAULT 0.00
    COMMENT 'Suma líneas XCOMPROBAR (no fiscal, solo contable)',
  ADD COLUMN suma_operaciones DECIMAL(14,2) NOT NULL DEFAULT 0.00
    COMMENT 'gravado + exento + no_sujeto',

  ADD COLUMN descuento_global_gravado DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN descuento_global_exento DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN descuento_global_no_sujeto DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN porcentaje_descuento DECIMAL(5,2) NOT NULL DEFAULT 0.00
    COMMENT 'Porcentaje global informativo (sin símbolo %)',
  ADD COLUMN total_descuento DECIMAL(14,2) NOT NULL DEFAULT 0.00
    COMMENT 'Suma desc. por ítem + desc. globales',

  ADD COLUMN sub_total DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN iva DECIMAL(14,2) NOT NULL DEFAULT 0.00
    COMMENT 'IVA 13% calculado sobre gravado neto',
  ADD COLUMN iva_retenido DECIMAL(14,2) NOT NULL DEFAULT 0.00
    COMMENT 'IVA retenido (1% gran contribuyente)',
  ADD COLUMN iva_percibido DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN retencion_renta DECIMAL(14,2) NOT NULL DEFAULT 0.00
    COMMENT 'Retención ISR si aplica',

  ADD COLUMN monto_total_operacion DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN total_cargos_no_afectos DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN total_pagar DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN valor_en_letras VARCHAR(300) NULL,

  ADD COLUMN condicion_operacion TINYINT NULL DEFAULT 1
    COMMENT 'CAT-016: 1=Contado, 2=Crédito, 3=Otro (mixto)',
  ADD COLUMN plazo_tipo VARCHAR(2) NULL
    COMMENT 'CAT-018: 01=Días, 02=Meses, 03=Años',
  ADD COLUMN plazo_periodo INT NULL
    COMMENT 'Cantidad de días/meses/años del crédito',
  ADD COLUMN fecha_vencimiento_pago DATE NULL
    COMMENT 'Fecha límite de pago (calculada si es crédito)';

ALTER TABLE compras
  ADD CONSTRAINT fk_compras_tipo_dte
    FOREIGN KEY (tipo_dte) REFERENCES cat_tipos_dte(codigo);

ALTER TABLE compras
  ADD INDEX idx_compras_tipo_dte (tipo_dte),
  ADD INDEX idx_compras_fecha_emision (fecha_emision),
  ADD INDEX idx_compras_codigo_gen (codigo_generacion);


-- =====================================================
-- 5. FORMAS DE PAGO POR COMPRA
-- =====================================================

CREATE TABLE IF NOT EXISTS compras_pagos (
  idpago INT AUTO_INCREMENT PRIMARY KEY,
  idcompra INT NOT NULL,
  codigo_forma_pago VARCHAR(2) NOT NULL
    COMMENT 'FK cat_formas_pago',
  monto DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  referencia VARCHAR(100) NULL
    COMMENT 'No. cheque, transferencia, etc. null para efectivo',
  plazo_tipo VARCHAR(2) NULL
    COMMENT 'CAT-018: 01=Días, 02=Meses, 03=Años',
  plazo_periodo INT NULL
    COMMENT 'Número de días/meses/años',

  CONSTRAINT fk_pagos_compra
    FOREIGN KEY (idcompra) REFERENCES compras(idcompra)
    ON DELETE CASCADE,
  CONSTRAINT fk_pagos_forma
    FOREIGN KEY (codigo_forma_pago) REFERENCES cat_formas_pago(codigo),

  INDEX idx_pagos_compra (idcompra)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Formas de pago de una compra (CAT-017). Varias por documento';


-- =====================================================
-- 6. DOCUMENTOS RELACIONADOS (NC / ND)
-- =====================================================

CREATE TABLE IF NOT EXISTS compras_documentos_rel (
  idrelacion INT AUTO_INCREMENT PRIMARY KEY,
  idcompra INT NOT NULL
    COMMENT 'La NC o ND que hace el ajuste',
  tipo_dte_relacionado VARCHAR(2) NOT NULL
    COMMENT 'Tipo del doc original (01, 03, etc.)',
  tipo_generacion TINYINT NOT NULL DEFAULT 2
    COMMENT '1=Físico, 2=Electrónico',
  numero_documento VARCHAR(100) NOT NULL
    COMMENT 'Código generación (UUID) si electrónico, correlativo si físico',
  fecha_generacion DATE NOT NULL
    COMMENT 'Fecha del documento original',

  CONSTRAINT fk_docrel_compra
    FOREIGN KEY (idcompra) REFERENCES compras(idcompra)
    ON DELETE CASCADE,
  CONSTRAINT fk_docrel_tipo
    FOREIGN KEY (tipo_dte_relacionado) REFERENCES cat_tipos_dte(codigo),

  INDEX idx_docrel_compra (idcompra)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Documentos relacionados (hasta 50). Obligatorio para NCE y NDE';


-- =====================================================
-- 7. AMPLIAR LÍNEAS compras_detalle
-- =====================================================

ALTER TABLE compras_detalle
  ADD COLUMN numero_documento_rel VARCHAR(100) NULL AFTER condicion_iva
    COMMENT 'Referencia al doc relacionado en la línea (NC/ND, cuerpo DTE)',
  ADD COLUMN codigo_tributo VARCHAR(10) NULL AFTER numero_documento_rel
    COMMENT 'Código CAT-015 aplicado (ej: 20 = IVA 13%)',
  ADD COLUMN cargos_no_afectos DECIMAL(14,4) NOT NULL DEFAULT 0.0000 AFTER codigo_tributo
    COMMENT 'Cargos/Abonos que no afectan la base imponible';


-- =====================================================
-- 8. ACTUALIZAR VISTA DE LECTURA
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
  d.numero_documento_rel,
  d.codigo_tributo,
  d.cargos_no_afectos,
  d.imagen_url,
  d.created_at,
  d.updated_at
FROM compras_detalle d
LEFT JOIN catalogo_contable c ON c.idcatalogo = d.idcatalogo
LEFT JOIN productos p ON p.idprod = d.idprod;


-- =====================================================
-- FIN DE MIGRACIÓN 012
-- =====================================================

SELECT 'Migración 012 completada - Compras nacionales DTE' AS status;
