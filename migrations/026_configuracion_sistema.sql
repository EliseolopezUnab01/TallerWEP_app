-- Configuraciones generales del sistema (respuesta del cliente del 05/11) y existencias con decimales.
-- El taller trabaja en unidades enteras; el interruptor cantidades_decimales queda apagado.

ALTER TABLE productos
  MODIFY stock_contable DECIMAL(18,4) DEFAULT 0,
  MODIFY stock_fisico DECIMAL(18,4) DEFAULT 0;

CREATE TABLE IF NOT EXISTS configuracion_sistema (
  clave VARCHAR(60) NOT NULL PRIMARY KEY,
  valor VARCHAR(255) NOT NULL,
  descripcion VARCHAR(255) NULL,
  actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  actualizado_por INT NULL,
  CONSTRAINT fk_config_usuario FOREIGN KEY (actualizado_por) REFERENCES usuarios (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Opciones que personalizan el sistema según quien lo use';

INSERT IGNORE INTO configuracion_sistema (clave, valor, descripcion) VALUES
  ('cantidades_decimales', '0', 'Permite cantidades con decimales en las líneas que entran a inventario y en los ajustes');
