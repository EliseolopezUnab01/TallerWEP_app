-- =====================================================
-- MIGRACIÓN 015b: PROCESO DE INGRESO, DUCA, COSTOS Y BACKORDER
-- Fecha: 2026-10-16
-- Fuente: tablas del cliente (docs/fuentes/tablas-cliente-new-sys.dbml) y
--         respuestas del 16/10 (un DUCA por proceso; retaceo proporcional al CIF).
-- Correcciones: IDs INT con FK, DECIMAL(14,4), created_at / updated_at,
-- `costos_prodcutos` → `costos_productos`. DUCA y costos se enlazan por línea
-- (compras_detalle.iddetalle), no solo por producto.
-- =====================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS proceso_ingreso (
  idproceso INT AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(20) NOT NULL
    COMMENT 'IMP-AAAA-00001. Agrupa todos los documentos del proceso',
  nodocto BIGINT NOT NULL
    COMMENT 'ID global, para vincular archivos al proceso',
  descripcion VARCHAR(200) NULL,
  estado_documento ENUM('BORRADOR','FINALIZADO') NOT NULL DEFAULT 'BORRADOR'
    COMMENT 'FINALIZADO = retaceo aplicado; ya no se modifica',
  estado_proceso ENUM('COTIZANDO','PRODUCCION','PAGADO','EN TRANSITO','BODEGA') NOT NULL DEFAULT 'COTIZANDO',
  origen_negociacion ENUM('NACIONAL','INTERNACIONAL') NOT NULL DEFAULT 'INTERNACIONAL',
  factura_compra VARCHAR(100) NULL
    COMMENT 'Número(s) de factura del proveedor que se ingresan con este proceso',
  moneda_factura CHAR(3) NOT NULL DEFAULT 'USD'
    COMMENT 'Moneda de las facturas del proveedor (compras no guarda moneda)',
  tipo_cambio_pagado DECIMAL(14,6) NOT NULL DEFAULT 1.000000
    COMMENT 'Dólares por unidad pagados al banco (CAMBIOBAN)',
  total_factura DECIMAL(14,4) NOT NULL DEFAULT 0
    COMMENT 'Suma de las facturas de importación del proceso',
  sumas_documentos DECIMAL(14,4) NOT NULL DEFAULT 0
    COMMENT 'Suma fiscal de los documentos relacionados (sin cuenta ajena)',
  total_retaceo DECIMAL(14,4) NOT NULL DEFAULT 0
    COMMENT 'Gastos que el usuario decide repartir entre los productos',
  fecha_retaceo DATETIME NULL,
  idusuario INT NULL,
  comentarios TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_proceso_codigo (codigo),
  UNIQUE KEY uq_proceso_nodocto (nodocto),
  CONSTRAINT fk_proceso_usuario FOREIGN KEY (idusuario) REFERENCES usuarios (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Proceso de compra o importación: de la cotización al ingreso a bodega';

CREATE TABLE IF NOT EXISTS relacion_documentos (
  idrelacion INT AUTO_INCREMENT PRIMARY KEY,
  idproceso INT NOT NULL,
  nodocto BIGINT NULL
    COMMENT 'Documento del sistema (compra, documento de compra)',
  ref_documento VARCHAR(100) NULL
    COMMENT 'Documento externo no ingresado: voucher, recibo, BL...',
  razon_vinculo ENUM('FACTURA','PROFORMA','PAGO','SEGURO','IMPUESTOS','TRANSPORTE','BL','ALMACEN',
                     'GASTO ORIGEN','GASTO LOCAL','OTRO') NOT NULL,
  total_usd DECIMAL(14,4) NOT NULL DEFAULT 0
    COMMENT 'Monto que participa en el proceso (para compras nacionales, solo lo fiscal)',
  incluir_retaceo TINYINT(1) NOT NULL DEFAULT 1,
  comentarios TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_reldoc_proceso (idproceso),
  KEY idx_reldoc_nodocto (nodocto),
  CONSTRAINT chk_reldoc_referencia CHECK (nodocto IS NOT NULL OR ref_documento IS NOT NULL),
  CONSTRAINT fk_reldoc_proceso FOREIGN KEY (idproceso) REFERENCES proceso_ingreso (idproceso) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Documentos vinculados a un proceso y su razón (PAGO, SEGURO, BL...)';

CREATE TABLE IF NOT EXISTS datos_duca (
  idduca INT AUTO_INCREMENT PRIMARY KEY,
  idproceso INT NOT NULL
    COMMENT 'Un solo DUCA por proceso; si se corrige, se reemplaza',
  nodocto BIGINT NOT NULL
    COMMENT 'ID global, para vincular el PDF del DUCA',
  numero_duca VARCHAR(50) NULL,
  fecha_duca DATE NULL,
  mandamiento_pago VARCHAR(50) NULL
    COMMENT 'Mandamiento de Hacienda con el NPE',
  incoterm_duca VARCHAR(10) NULL,
  tipo_cambio_duca DECIMAL(14,6) NOT NULL DEFAULT 1.000000
    COMMENT 'Tipo de cambio usado por Aduana (CAMBIOADU)',
  seguro_declarado DECIMAL(14,4) NOT NULL DEFAULT 0,
  flete_declarado DECIMAL(14,4) NOT NULL DEFAULT 0,
  total_productos_duca DECIMAL(14,4) NOT NULL DEFAULT 0,
  gastos_declarados DECIMAL(14,4) NOT NULL DEFAULT 0
    COMMENT 'Otros gastos declarados (normalmente de origen)',
  valor_cif_duca DECIMAL(14,4) NOT NULL DEFAULT 0,
  gastos_no_declarados DECIMAL(14,4) NOT NULL DEFAULT 0,
  total_costos_operativos DECIMAL(14,4) NOT NULL DEFAULT 0
    COMMENT 'Gastos declarados + no declarados que se reparten; sin impuestos',
  peso_carga VARCHAR(50) NULL,
  volumen_carga VARCHAR(50) NULL,
  iva_pagado DECIMAL(14,4) NOT NULL DEFAULT 0,
  dai_pagado DECIMAL(14,4) NOT NULL DEFAULT 0,
  otros_cargos_pagados DECIMAL(14,4) NOT NULL DEFAULT 0,
  total_pagado_duca DECIMAL(14,4) NOT NULL DEFAULT 0,
  gasto_total_inversion DECIMAL(14,4) NOT NULL DEFAULT 0,
  comentarios TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_duca_proceso (idproceso),
  UNIQUE KEY uq_duca_nodocto (nodocto),
  KEY idx_duca_numero (numero_duca),
  CONSTRAINT fk_duca_proceso FOREIGN KEY (idproceso) REFERENCES proceso_ingreso (idproceso) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Encabezado del DUCA de un proceso de importación';

CREATE TABLE IF NOT EXISTS duca_detalles (
  idduca_detalle INT AUTO_INCREMENT PRIMARY KEY,
  idproceso INT NOT NULL,
  iddetalle INT NOT NULL
    COMMENT 'Línea exacta de la factura (compras_detalle)',
  idprod INT NULL,
  numero_duca VARCHAR(50) NULL,
  cantidad DECIMAL(14,4) NOT NULL DEFAULT 0,
  costo_divisa DECIMAL(14,4) NOT NULL DEFAULT 0
    COMMENT 'Costo unitario en la moneda de la factura (CSTDIVISA)',
  costo_contable_usd DECIMAL(14,4) NOT NULL DEFAULT 0
    COMMENT 'Costo unitario en dólares según Aduana (COSTO)',
  costo_cif DECIMAL(14,4) NOT NULL DEFAULT 0
    COMMENT 'CIF unitario (CIFUNIT)',
  codigo_arancelario VARCHAR(20) NULL,
  dai_preferente TINYINT(1) NOT NULL DEFAULT 0,
  valor_dai DECIMAL(7,4) NOT NULL DEFAULT 0
    COMMENT 'Porcentaje DAI (DAIVALOR)',
  dai_pagado DECIMAL(14,4) NOT NULL DEFAULT 0
    COMMENT 'DAI unitario (DAIUNIT)',
  iva_pagado DECIMAL(14,4) NOT NULL DEFAULT 0
    COMMENT 'IVA unitario (IVAUNIT)',
  gastos_aduana DECIMAL(14,4) NOT NULL DEFAULT 0
    COMMENT 'Gastos repartidos por unidad (GASTOSUNIT)',
  subtotal_contable DECIMAL(14,4) NOT NULL DEFAULT 0,
  subtotal_cif DECIMAL(14,4) NOT NULL DEFAULT 0
    COMMENT 'STOTALCIF',
  total_grupo_cif DECIMAL(14,4) NOT NULL DEFAULT 0
    COMMENT 'CIF total del grupo usado como base del reparto (CIFGRUPO)',
  tipo_cambio_duca DECIMAL(14,6) NOT NULL DEFAULT 1.000000,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ducadet_linea (iddetalle),
  KEY idx_ducadet_proceso (idproceso),
  KEY idx_ducadet_prod (idprod),
  CONSTRAINT fk_ducadet_proceso FOREIGN KEY (idproceso) REFERENCES proceso_ingreso (idproceso) ON DELETE CASCADE,
  CONSTRAINT fk_ducadet_linea FOREIGN KEY (iddetalle) REFERENCES compras_detalle (iddetalle) ON DELETE CASCADE,
  CONSTRAINT fk_ducadet_producto FOREIGN KEY (idprod) REFERENCES productos (idprod) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Cálculo DUCA por línea de factura';

CREATE TABLE IF NOT EXISTS costos_productos (
  idcosto_producto INT AUTO_INCREMENT PRIMARY KEY,
  idproceso INT NOT NULL,
  iddetalle INT NOT NULL,
  idprod INT NULL,
  factura_compra VARCHAR(100) NULL,
  cantidad DECIMAL(14,4) NOT NULL DEFAULT 0,
  costo_divisa DECIMAL(14,4) NOT NULL DEFAULT 0,
  costo_contable_usd DECIMAL(14,4) NOT NULL DEFAULT 0,
  costo_pagado_usd DECIMAL(14,4) NOT NULL DEFAULT 0
    COMMENT 'Lo pagado al proveedor con el tipo de cambio del banco',
  iva_pagado DECIMAL(14,4) NOT NULL DEFAULT 0,
  gastos_totales DECIMAL(14,4) NOT NULL DEFAULT 0
    COMMENT 'Gastos repartidos por unidad, incluido DAI',
  costo_corregido DECIMAL(14,4) NULL
    COMMENT 'Solo en casos raros; si tiene valor es el referente del costo pagado',
  costo_cif DECIMAL(14,4) NOT NULL DEFAULT 0,
  costo_destino DECIMAL(14,4) NOT NULL DEFAULT 0
    COMMENT 'Costo puesto en bodega (COSTOLOCAL)',
  costo_destino_prom DECIMAL(14,4) NOT NULL DEFAULT 0
    COMMENT 'Costo local promedio tras esta compra (CSTLOCALP)',
  tipo_cambio_pagado DECIMAL(14,6) NOT NULL DEFAULT 1.000000,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_costoprod_linea (iddetalle),
  KEY idx_costoprod_proceso (idproceso),
  KEY idx_costoprod_prod (idprod),
  CONSTRAINT fk_costoprod_proceso FOREIGN KEY (idproceso) REFERENCES proceso_ingreso (idproceso) ON DELETE CASCADE,
  CONSTRAINT fk_costoprod_linea FOREIGN KEY (iddetalle) REFERENCES compras_detalle (iddetalle) ON DELETE CASCADE,
  CONSTRAINT fk_costoprod_producto FOREIGN KEY (idprod) REFERENCES productos (idprod) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Costo final por línea de factura tras el retaceo';

CREATE TABLE IF NOT EXISTS pedido_pendiente (
  idpendiente INT AUTO_INCREMENT PRIMARY KEY,
  idproceso INT NOT NULL,
  idprod INT NULL,
  idtemporal INT NULL,
  cant_cotizado DECIMAL(14,4) NOT NULL DEFAULT 0,
  cant_ordenado DECIMAL(14,4) NOT NULL DEFAULT 0,
  cant_proforma DECIMAL(14,4) NOT NULL DEFAULT 0,
  cant_factura DECIMAL(14,4) NOT NULL DEFAULT 0,
  cant_recibido DECIMAL(14,4) NOT NULL DEFAULT 0,
  backorder_reservado DECIMAL(14,4) NOT NULL DEFAULT 0
    COMMENT 'Pendiente, ya disponible y reservado por el proveedor',
  backorder_enproceso DECIMAL(14,4) NOT NULL DEFAULT 0
    COMMENT 'Pendiente, aún en producción o en espera',
  backorder_total DECIMAL(14,4) AS (backorder_reservado + backorder_enproceso) STORED
    COMMENT 'Reservado + en proceso = pagado + por pagar',
  backorder_pagado DECIMAL(14,4) NOT NULL DEFAULT 0,
  backorder_por_pagar DECIMAL(14,4) NOT NULL DEFAULT 0,
  fecha_estimada_backorder DATE NULL,
  id_orden_compra VARCHAR(20) NULL,
  fecha_orden_compra DATE NULL,
  id_proforma VARCHAR(20) NULL,
  fecha_proforma DATE NULL,
  id_factura VARCHAR(100) NULL,
  fecha_factura DATE NULL,
  estatus_backorder ENUM('ACTIVO','CANCELADO','FINALIZADO') NOT NULL DEFAULT 'ACTIVO',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_pendiente_prod (idproceso, idprod),
  UNIQUE KEY uq_pendiente_temporal (idproceso, idtemporal),
  CONSTRAINT chk_pendiente_producto CHECK (idprod IS NOT NULL OR idtemporal IS NOT NULL),
  CONSTRAINT fk_pendiente_proceso FOREIGN KEY (idproceso) REFERENCES proceso_ingreso (idproceso) ON DELETE CASCADE,
  CONSTRAINT fk_pendiente_producto FOREIGN KEY (idprod) REFERENCES productos (idprod),
  CONSTRAINT fk_pendiente_temporal FOREIGN KEY (idtemporal) REFERENCES productos_temporales (idtemporal)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Cantidades por producto y proceso, y backorder';

CREATE TABLE IF NOT EXISTS gastos_sindocumento (
  idgasto INT AUTO_INCREMENT PRIMARY KEY,
  idproceso INT NULL,
  ref_nodocto BIGINT NULL
    COMMENT 'Documento del sistema sin proceso al que se asocia el gasto',
  ref_orden_servicio VARCHAR(50) NULL,
  ref_otros VARCHAR(100) NULL,
  descripcion VARCHAR(255) NOT NULL,
  recibe VARCHAR(100) NULL,
  entrega VARCHAR(100) NULL,
  monto_salida DECIMAL(14,4) NOT NULL DEFAULT 0,
  fecha_salida DATE NULL,
  incluir_retaceo TINYINT(1) NOT NULL DEFAULT 1,
  comentario TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_gasto_proceso (idproceso),
  CONSTRAINT fk_gasto_proceso FOREIGN KEY (idproceso) REFERENCES proceso_ingreso (idproceso) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Gastos con ticket, voucher o sin comprobante';

ALTER TABLE compras
  ADD CONSTRAINT fk_compras_proceso FOREIGN KEY (idproceso) REFERENCES proceso_ingreso (idproceso) ON DELETE SET NULL;

ALTER TABLE documentos_compras
  ADD CONSTRAINT fk_doccompra_proceso FOREIGN KEY (idproceso) REFERENCES proceso_ingreso (idproceso) ON DELETE SET NULL;

-- Tabla COSTOS del cliente (actualización 01-03-2026): referencia al documento
-- y costo local promedio con sus respaldos. Las columnas existentes no cambian.
ALTER TABLE costos
  ADD COLUMN nodocto BIGINT NULL COMMENT 'Documento del que salió el último costo' AFTER nofactura,
  ADD COLUMN costo_local_promedio DECIMAL(12,2) NULL DEFAULT 0 COMMENT 'Promedio del costo local (CSTLOCALP)' AFTER costo_local,
  ADD COLUMN costolcl_previo1 DECIMAL(12,2) NULL DEFAULT 0 COMMENT 'Costo local anterior' AFTER costop_previo2,
  ADD COLUMN costolcl_previo2 DECIMAL(12,2) NULL DEFAULT 0 COMMENT 'Costo local previo a costolcl_previo1' AFTER costolcl_previo1;
