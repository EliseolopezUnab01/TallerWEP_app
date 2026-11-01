-- Tarjeta y serie del vehiculo, repuestos de la orden y enlace desde la linea express.

ALTER TABLE vehiculos
  ADD COLUMN IF NOT EXISTS numero_tarjeta VARCHAR(30) NULL
    COMMENT 'Numero de la tarjeta de circulacion' AFTER tarjeta_vencimiento,
  ADD COLUMN IF NOT EXISTS codigo_serie VARCHAR(50) NULL
    COMMENT 'Codigo de serie del vehiculo' AFTER numero_chasis;

ALTER TABLE compras_detalle
  ADD COLUMN IF NOT EXISTS idorden INT NULL
    COMMENT 'Orden de trabajo cuando la linea express indica su numero' AFTER numero_orden,
  ADD INDEX IF NOT EXISTS idx_detalle_idorden (idorden);

SET @fk_detalle_orden = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'compras_detalle'
    AND CONSTRAINT_NAME = 'fk_detalle_orden'
);
SET @sql_fk_detalle_orden = IF(
  @fk_detalle_orden = 0,
  'ALTER TABLE compras_detalle ADD CONSTRAINT fk_detalle_orden FOREIGN KEY (idorden) REFERENCES ordenes_trabajo (id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt_fk_detalle_orden FROM @sql_fk_detalle_orden;
EXECUTE stmt_fk_detalle_orden;
DEALLOCATE PREPARE stmt_fk_detalle_orden;

CREATE TABLE IF NOT EXISTS orden_repuestos (
  idrepuesto INT AUTO_INCREMENT PRIMARY KEY,
  idorden INT NOT NULL,
  idprod INT NULL,
  descripcion VARCHAR(200) NOT NULL,
  cantidad DECIMAL(14,4) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_orep_orden (idorden),
  CONSTRAINT fk_orep_orden FOREIGN KEY (idorden) REFERENCES ordenes_trabajo (id) ON DELETE CASCADE,
  CONSTRAINT fk_orep_producto FOREIGN KEY (idprod) REFERENCES productos (idprod) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Repuestos previstos en la orden. Lo que se compra queda en la linea express.';
