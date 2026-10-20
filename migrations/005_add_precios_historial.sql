-- Migración: Agregar columnas de precios anteriores y nuevos a ajuste_precios
-- Esto permite ver el historial completo de cambios de precios

ALTER TABLE ajuste_precios
  ADD COLUMN precio1_anterior DECIMAL(10,2) DEFAULT NULL COMMENT 'Precio General anterior',
  ADD COLUMN precio2_anterior DECIMAL(10,2) DEFAULT NULL COMMENT 'Precio Mayorista anterior',
  ADD COLUMN precio3_anterior DECIMAL(10,2) DEFAULT NULL COMMENT 'Precio Cliente anterior',
  ADD COLUMN precio4_anterior DECIMAL(10,2) DEFAULT NULL COMMENT 'Precio Mecánico anterior',
  ADD COLUMN precio5_anterior DECIMAL(10,2) DEFAULT NULL COMMENT 'Precio Minorista anterior',
  ADD COLUMN precio6_anterior DECIMAL(10,2) DEFAULT NULL COMMENT 'Precio Inversor anterior',
  ADD COLUMN precio7_anterior DECIMAL(10,2) DEFAULT NULL COMMENT 'Precio Especial anterior',
  ADD COLUMN precio1_nuevo DECIMAL(10,2) DEFAULT NULL COMMENT 'Precio General nuevo',
  ADD COLUMN precio2_nuevo DECIMAL(10,2) DEFAULT NULL COMMENT 'Precio Mayorista nuevo',
  ADD COLUMN precio3_nuevo DECIMAL(10,2) DEFAULT NULL COMMENT 'Precio Cliente nuevo',
  ADD COLUMN precio4_nuevo DECIMAL(10,2) DEFAULT NULL COMMENT 'Precio Mecánico nuevo',
  ADD COLUMN precio5_nuevo DECIMAL(10,2) DEFAULT NULL COMMENT 'Precio Minorista nuevo',
  ADD COLUMN precio6_nuevo DECIMAL(10,2) DEFAULT NULL COMMENT 'Precio Inversor nuevo',
  ADD COLUMN precio7_nuevo DECIMAL(10,2) DEFAULT NULL COMMENT 'Precio Especial nuevo';
