-- 022: factura de sujeto excluido emitida por el sistema (DTE tipo 14, esquema fe-fse-v1).
-- El borrador vive aquí. Solo cuando Hacienda lo acepta se crea la compra tipo 14,
-- y esa compra sigue las reglas de stock de la factura nacional.
-- El correlativo del número de control (DTE-14-XXXXXXXX-000000000000001) usa el tipo DTE14.

CREATE TABLE IF NOT EXISTS facturas_sujeto_excluido (
  idfse INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  estado ENUM('BORRADOR','ACEPTADO','RECHAZADO','INVALIDADO') NOT NULL DEFAULT 'BORRADOR',
  ambiente CHAR(2) NOT NULL COMMENT '00 pruebas, 01 producción, copiado de empresa al emitir',
  numero_control VARCHAR(31) NOT NULL,
  codigo_generacion VARCHAR(36) NOT NULL,
  sello_recepcion VARCHAR(40) NULL,
  fecha_emision DATE NOT NULL,
  hora_emision CHAR(8) NOT NULL,
  tipo_documento CHAR(2) NOT NULL COMMENT 'CAT-022 del sujeto excluido: 13 DUI, 36 NIT, 02 carnet, 03 pasaporte, 37 otro',
  num_documento VARCHAR(25) NOT NULL,
  nombre VARCHAR(250) NOT NULL,
  cod_actividad VARCHAR(6) NULL,
  desc_actividad VARCHAR(150) NULL,
  departamento CHAR(2) NOT NULL,
  municipio CHAR(2) NOT NULL,
  direccion VARCHAR(200) NOT NULL,
  telefono VARCHAR(30) NULL,
  correo VARCHAR(100) NULL,
  condicion_operacion TINYINT NOT NULL DEFAULT 1 COMMENT '1 contado, 2 crédito, 3 otro',
  codigo_forma_pago CHAR(2) NOT NULL DEFAULT '01',
  retencion_renta DECIMAL(20,8) NOT NULL DEFAULT 0 COMMENT 'Editable; se sugiere el 10 % si hay un servicio',
  observaciones VARCHAR(250) NULL,
  total_compra DECIMAL(20,8) NOT NULL DEFAULT 0,
  total_descuento DECIMAL(20,8) NOT NULL DEFAULT 0,
  subtotal DECIMAL(20,8) NOT NULL DEFAULT 0,
  total_pagar DECIMAL(20,8) NOT NULL DEFAULT 0,
  dte_json LONGTEXT NULL COMMENT 'JSON fe-fse-v1 sin firmar',
  documento_firmado MEDIUMTEXT NULL,
  respuesta_mh TEXT NULL,
  idcompra INT NULL COMMENT 'Compra creada al quedar aceptada',
  idusuario INT NULL,
  motivo_invalidacion VARCHAR(250) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_fse_codigo (codigo_generacion),
  UNIQUE KEY uq_fse_control (numero_control),
  KEY idx_fse_compra (idcompra),
  CONSTRAINT fk_fse_compra FOREIGN KEY (idcompra) REFERENCES compras (idcompra)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Facturas de sujeto excluido emitidas a Hacienda';

CREATE TABLE IF NOT EXISTS facturas_sujeto_excluido_detalle (
  idlinea INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  idfse INT NOT NULL,
  num_item INT NOT NULL,
  tipo_item TINYINT NOT NULL DEFAULT 1 COMMENT 'CAT-011: 1 bienes, 2 servicios, 3 ambos',
  idprod INT NULL COMMENT 'Si tiene ficha, la compra mueve stock al aceptarse',
  codigo VARCHAR(25) NULL,
  descripcion VARCHAR(250) NOT NULL,
  cantidad DECIMAL(20,8) NOT NULL,
  uni_medida SMALLINT NOT NULL DEFAULT 59 COMMENT 'CAT-014, 59 = unidad',
  precio_uni DECIMAL(20,8) NOT NULL,
  monto_descu DECIMAL(20,8) NOT NULL DEFAULT 0,
  compra DECIMAL(20,8) NOT NULL COMMENT 'cantidad x precio - descuento, sin IVA',
  KEY idx_fse_det_fse (idfse),
  CONSTRAINT fk_fse_det_fse FOREIGN KEY (idfse) REFERENCES facturas_sujeto_excluido (idfse) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
