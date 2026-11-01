-- 021: recepción de DTE de compra (fase 3 del plan de mejora).
-- - Estado INVALIDADO: el emisor invalidó el DTE ante Hacienda (CAT-024). No mueve stock.
-- - Un código de generación vigente solo puede estar en una compra (las anuladas o invalidadas no cuentan).
-- - Datos de identificación y del emisor que trae el JSON, tributos distintos del IVA.
-- - Cantidad con 8 decimales, unidad de medida y tipo de ítem por línea.
-- - cat_formas_pago corregida al CAT-017 oficial (06 no existe; 09 y 11 faltaban; 12, 13 y 14 tenían otro nombre).

ALTER TABLE compras
  MODIFY estado ENUM('BORRADOR','REGISTRADA','ANULADA','INVALIDADO') NOT NULL DEFAULT 'BORRADOR',
  ADD COLUMN dte_ambiente CHAR(2) NULL COMMENT 'identificacion.ambiente: 00 pruebas, 01 producción' AFTER sello_recepcion,
  ADD COLUMN dte_version SMALLINT NULL COMMENT 'identificacion.version del esquema' AFTER dte_ambiente,
  ADD COLUMN dte_tipo_modelo TINYINT NULL COMMENT 'CAT-003: 1 previo, 2 diferido' AFTER dte_version,
  ADD COLUMN dte_tipo_operacion TINYINT NULL COMMENT 'CAT-004: 1 normal, 2 contingencia' AFTER dte_tipo_modelo,
  ADD COLUMN dte_tipo_contingencia TINYINT NULL COMMENT 'CAT-005' AFTER dte_tipo_operacion,
  ADD COLUMN dte_motivo_contingencia VARCHAR(500) NULL AFTER dte_tipo_contingencia,
  ADD COLUMN emisor_cod_actividad VARCHAR(6) NULL COMMENT 'CAT-019 del emisor según el DTE' AFTER dte_motivo_contingencia,
  ADD COLUMN emisor_desc_actividad VARCHAR(150) NULL AFTER emisor_cod_actividad,
  ADD COLUMN emisor_departamento CHAR(2) NULL COMMENT 'CAT-012' AFTER emisor_desc_actividad,
  ADD COLUMN emisor_municipio CHAR(2) NULL COMMENT 'CAT-013' AFTER emisor_departamento,
  ADD COLUMN total_otros_tributos DECIMAL(20,8) NOT NULL DEFAULT 0
    COMMENT 'Suma de resumen.tributos distintos del IVA (detalle en compras_tributos)' AFTER iva,
  ADD COLUMN motivo_invalidacion VARCHAR(250) NULL AFTER fecha_vencimiento_pago,
  ADD COLUMN fecha_invalidacion DATE NULL AFTER motivo_invalidacion,
  ADD COLUMN codigo_generacion_vigente VARCHAR(36)
    AS (IF(estado IN ('ANULADA','INVALIDADO'), NULL, codigo_generacion)) PERSISTENT
    COMMENT 'Solo para el índice único: el DTE no se repite entre compras vigentes',
  ADD UNIQUE KEY uq_compras_codigo_generacion (codigo_generacion_vigente);

CREATE TABLE IF NOT EXISTS compras_tributos (
  idtributo INT AUTO_INCREMENT PRIMARY KEY,
  idcompra INT NOT NULL,
  codigo VARCHAR(4) NOT NULL COMMENT 'CAT-015',
  descripcion VARCHAR(150) NULL,
  valor DECIMAL(20,8) NOT NULL DEFAULT 0,
  KEY idx_compras_tributos_compra (idcompra),
  CONSTRAINT fk_compras_tributos_compra FOREIGN KEY (idcompra) REFERENCES compras (idcompra) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Tributos del resumen del DTE distintos del IVA (FOVIAL, COTRANS, turismo, etc.), tal como vienen';

ALTER TABLE compras_detalle
  MODIFY cantidad DECIMAL(20,8) NOT NULL DEFAULT 1,
  ADD COLUMN uni_medida SMALLINT NULL COMMENT 'CAT-014 (59 = unidad)' AFTER cantidad,
  ADD COLUMN tipo_item TINYINT NULL COMMENT 'CAT-011: 1 bienes, 2 servicios, 3 ambos, 4 otros tributos' AFTER uni_medida;

INSERT INTO cat_formas_pago (codigo, nombre) VALUES
  ('01', 'Billetes y monedas'),
  ('02', 'Tarjeta débito'),
  ('03', 'Tarjeta crédito'),
  ('04', 'Cheque'),
  ('05', 'Transferencia / depósito bancario'),
  ('08', 'Dinero electrónico'),
  ('09', 'Monedero electrónico'),
  ('11', 'Bitcoin'),
  ('12', 'Otras criptomonedas'),
  ('13', 'Cuentas por pagar del receptor'),
  ('14', 'Giro bancario'),
  ('99', 'Otros (indicar el medio de pago)')
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

UPDATE compras_pagos SET codigo_forma_pago = '99' WHERE codigo_forma_pago = '06';
DELETE FROM cat_formas_pago WHERE codigo = '06';
