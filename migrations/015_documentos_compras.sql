-- =====================================================
-- MIGRACIÓN 015: DOCUMENTOS DE COMPRA (SOLICITUD → PROFORMA) Y PRODUCTOS TEMPORALES
-- Fecha: 2026-10-16
-- Fuente: tablas del cliente (docs/fuentes/tablas-cliente-new-sys.dbml),
--         con IDs INT y FK, DECIMAL(14,4) y created_at / updated_at.
-- =====================================================
--
-- Flujo: SOLICITUD (SC) → COTIZACION (CT) → ORDEN (OC) → PROFORMA (PF).
-- Cada documento nuevo guarda en `nodocto_origen` el documento del que salió.
-- La factura de importación NO va aquí: se registra en `compras` (clase IMPORTACION).
-- Una línea apunta a un producto del inventario (idprod) o a un producto
-- temporal (idtemporal). Al crear la ficha del temporal, `idprod_final`
-- se llena y las líneas pasan a usar idprod.
-- =====================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS productos_temporales (
  idtemporal INT AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(20) NOT NULL
    COMMENT 'Código propio PT26-00001; no se mezcla con idprod del inventario',
  referencia_proveedor VARCHAR(50) NULL,
  descripcion VARCHAR(200) NOT NULL,
  oems TEXT NULL
    COMMENT 'Otras referencias OE/OEM, una por línea',
  marca VARCHAR(50) NULL,
  origen_producto VARCHAR(60) NULL
    COMMENT 'País de origen indicado por el proveedor',
  idproveedor INT NULL,
  comentario TEXT NULL,
  estado ENUM('ACTIVO','CONVERTIDO','DESCARTADO') NOT NULL DEFAULT 'ACTIVO',
  idprod_final INT NULL
    COMMENT 'Ficha de inventario creada a partir de este temporal',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_temporal_codigo (codigo),
  KEY idx_temporal_referencia (referencia_proveedor),
  KEY idx_temporal_estado (estado),
  CONSTRAINT fk_temporal_proveedor FOREIGN KEY (idproveedor) REFERENCES proveedores (idproveedor) ON DELETE SET NULL,
  CONSTRAINT fk_temporal_producto FOREIGN KEY (idprod_final) REFERENCES productos (idprod) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Productos cotizados que aún no tienen ficha de inventario. Imágenes en ruta_archivos (entidad PRODUCTO_TEMPORAL)';

CREATE TABLE IF NOT EXISTS documentos_compras (
  iddocumento INT AUTO_INCREMENT PRIMARY KEY,
  nodocto BIGINT NOT NULL
    COMMENT 'ID global del documento (AA + 6 dígitos)',
  id_documento VARCHAR(20) NOT NULL
    COMMENT 'Número visible: SC26-000001, CT26-..., OC26-..., PF26-...',
  tipo_documento ENUM('SOLICITUD','COTIZACION','ORDEN','PROFORMA') NOT NULL,
  nodocto_origen BIGINT NULL
    COMMENT 'Documento del que se generó (encadena solicitud → cotización → orden → proforma)',
  categoria_operacion ENUM('FISCAL','GASTO','MIXTO') NOT NULL DEFAULT 'FISCAL',
  ambito_operacion ENUM('NACIONAL','INTERNACIONAL') NOT NULL DEFAULT 'INTERNACIONAL',
  estado_documento ENUM('BORRADOR','FINALIZADO','ANULADO') NOT NULL DEFAULT 'BORRADOR'
    COMMENT 'FINALIZADO = enviado o recibido; ya no se edita',
  idproceso INT NULL
    COMMENT 'Proceso de ingreso (IMP-AAAA-00001) que agrupa los documentos',
  idproveedor INT NULL,
  idcontacto INT NULL
    COMMENT 'Contacto del proveedor con quien se negocia',
  idusuario INT NULL
    COMMENT 'Usuario que creó o editó por última vez',
  fecha_documento DATE NOT NULL,
  comentarios TEXT NULL,
  moneda_documento CHAR(3) NOT NULL DEFAULT 'USD',
  tipo_cambio DECIMAL(14,6) NOT NULL DEFAULT 1.000000
    COMMENT 'Dólares por unidad de la moneda del documento. Aproximado hasta completar el pago',
  incoterm VARCHAR(10) NULL
    COMMENT 'FOB, CIF, CFR, CPT, FCA, EXW, DAP...',
  fecha_est_entrega DATE NULL,
  condicion_pago ENUM('CONTADO','CREDITO') NOT NULL DEFAULT 'CONTADO',
  acuerdo_pago VARCHAR(500) NULL
    COMMENT 'Ej.: 30% anticipo / 70% contra entrega',
  subtotal_moneda DECIMAL(14,4) NOT NULL DEFAULT 0,
  subtotal_usd DECIMAL(14,4) NOT NULL DEFAULT 0,
  total_moneda DECIMAL(14,4) NOT NULL DEFAULT 0,
  total_usd DECIMAL(14,4) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_doccompra_nodocto (nodocto),
  UNIQUE KEY uq_doccompra_numero (id_documento),
  KEY idx_doccompra_origen (nodocto_origen),
  KEY idx_doccompra_tipo_estado (tipo_documento, estado_documento),
  KEY idx_doccompra_proceso (idproceso),
  CONSTRAINT fk_doccompra_origen FOREIGN KEY (nodocto_origen) REFERENCES documentos_compras (nodocto) ON DELETE SET NULL,
  CONSTRAINT fk_doccompra_proveedor FOREIGN KEY (idproveedor) REFERENCES proveedores (idproveedor) ON DELETE SET NULL,
  CONSTRAINT fk_doccompra_contacto FOREIGN KEY (idcontacto) REFERENCES proveedor_contactos (idcontacto) ON DELETE SET NULL,
  CONSTRAINT fk_doccompra_usuario FOREIGN KEY (idusuario) REFERENCES usuarios (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Solicitudes, cotizaciones, órdenes de compra y proformas';

CREATE TABLE IF NOT EXISTS documentos_compras_detalle (
  iddetalle INT AUTO_INCREMENT PRIMARY KEY,
  iddocumento INT NOT NULL,
  linea_visual INT NOT NULL,
  idprod INT NULL,
  idtemporal INT NULL,
  iddetalle_origen INT NULL
    COMMENT 'Línea del documento anterior de la que se copió',
  referencia_proveedor VARCHAR(50) NULL,
  oems TEXT NULL,
  descripcion_articulo VARCHAR(200) NOT NULL,
  cantidad DECIMAL(14,4) NOT NULL DEFAULT 1,
  estatus_articulo ENUM('DISPONIBLE','BAJO STOCK','SIN STOCK','EN DESARROLLO','DESCONTINUADO','DESCONOCIDO')
    NOT NULL DEFAULT 'DESCONOCIDO',
  precio_moneda DECIMAL(14,4) NOT NULL DEFAULT 0,
  precio_usd DECIMAL(14,4) NOT NULL DEFAULT 0,
  fecha_est_produccion DATE NULL,
  fecha_est_entrega DATE NULL,
  comentario_usuario TEXT NULL,
  comentario_proveedor TEXT NULL,
  origen_producto VARCHAR(60) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_docdet_linea (iddocumento, linea_visual),
  KEY idx_docdet_prod (idprod),
  KEY idx_docdet_temporal (idtemporal),
  CONSTRAINT chk_docdet_producto CHECK (idprod IS NOT NULL OR idtemporal IS NOT NULL),
  CONSTRAINT fk_docdet_documento FOREIGN KEY (iddocumento) REFERENCES documentos_compras (iddocumento) ON DELETE CASCADE,
  CONSTRAINT fk_docdet_producto FOREIGN KEY (idprod) REFERENCES productos (idprod),
  CONSTRAINT fk_docdet_temporal FOREIGN KEY (idtemporal) REFERENCES productos_temporales (idtemporal),
  CONSTRAINT fk_docdet_origen FOREIGN KEY (iddetalle_origen) REFERENCES documentos_compras_detalle (iddetalle) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Líneas de los documentos de compra: producto del inventario o temporal';
