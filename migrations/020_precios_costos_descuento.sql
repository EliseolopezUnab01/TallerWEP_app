-- 020: 7 niveles de precio del cliente, costos con 8 decimales y descuento configurable por compra.
-- Orden confirmado (01/11): 1 General alto, 2 General normal, 3 Cliente, 4 Mecánico/minorista,
-- 5 Mayorista, 6 Inversor, 7 Especial. La tabla precios estaba vacía al crear esta migración.

-- Precios: se agregan general_alto e inversor; minorista se une a mecánico (un solo nivel).
ALTER TABLE precios
  ADD COLUMN precio_general_alto DECIMAL(20,8) NOT NULL DEFAULT 0 AFTER precio_lcl,
  ADD COLUMN porcentaje_general_alto DECIMAL(20,8) NOT NULL DEFAULT 0 AFTER precio_general_alto,
  ADD COLUMN ganancia_general_alto DECIMAL(20,8) NOT NULL DEFAULT 0 AFTER porcentaje_general_alto,
  ADD COLUMN precio_inversor DECIMAL(20,8) NOT NULL DEFAULT 0 AFTER precio_mayorista,
  ADD COLUMN porcentaje_inversor DECIMAL(20,8) NOT NULL DEFAULT 0,
  ADD COLUMN ganancia_inversor DECIMAL(20,8) NOT NULL DEFAULT 0,
  MODIFY precio_general DECIMAL(20,8) NOT NULL DEFAULT 0,
  MODIFY precio_cliente DECIMAL(20,8) NOT NULL DEFAULT 0,
  MODIFY precio_mecanico DECIMAL(20,8) NOT NULL DEFAULT 0,
  MODIFY precio_mayorista DECIMAL(20,8) NOT NULL DEFAULT 0,
  MODIFY precio_especial DECIMAL(20,8) NOT NULL DEFAULT 0,
  MODIFY porcentaje_general DECIMAL(20,8) NOT NULL DEFAULT 0,
  MODIFY porcentaje_cliente DECIMAL(20,8) NOT NULL DEFAULT 0,
  MODIFY porcentaje_mecanico DECIMAL(20,8) NOT NULL DEFAULT 0,
  MODIFY porcentaje_mayorista DECIMAL(20,8) NOT NULL DEFAULT 0,
  MODIFY porcentaje_especial DECIMAL(20,8) NOT NULL DEFAULT 0,
  MODIFY ganancia_general DECIMAL(20,8) NOT NULL DEFAULT 0,
  MODIFY ganancia_cliente DECIMAL(20,8) NOT NULL DEFAULT 0,
  MODIFY ganancia_mecanico DECIMAL(20,8) NOT NULL DEFAULT 0,
  MODIFY ganancia_mayorista DECIMAL(20,8) NOT NULL DEFAULT 0,
  MODIFY ganancia_especial DECIMAL(20,8) NOT NULL DEFAULT 0,
  DROP COLUMN precio_minorista,
  DROP COLUMN porcentaje_minorista,
  DROP COLUMN ganancia_minorista;

-- Historial de ajustes de precio: 8 decimales.
ALTER TABLE ajuste_precios
  MODIFY precio1_anterior DECIMAL(20,8) NULL, MODIFY precio2_anterior DECIMAL(20,8) NULL,
  MODIFY precio3_anterior DECIMAL(20,8) NULL, MODIFY precio4_anterior DECIMAL(20,8) NULL,
  MODIFY precio5_anterior DECIMAL(20,8) NULL, MODIFY precio6_anterior DECIMAL(20,8) NULL,
  MODIFY precio7_anterior DECIMAL(20,8) NULL,
  MODIFY precio1_nuevo DECIMAL(20,8) NULL, MODIFY precio2_nuevo DECIMAL(20,8) NULL,
  MODIFY precio3_nuevo DECIMAL(20,8) NULL, MODIFY precio4_nuevo DECIMAL(20,8) NULL,
  MODIFY precio5_nuevo DECIMAL(20,8) NULL, MODIFY precio6_nuevo DECIMAL(20,8) NULL,
  MODIFY precio7_nuevo DECIMAL(20,8) NULL,
  ADD COLUMN costo_referencia DECIMAL(20,8) NULL COMMENT 'Costo local al momento del ajuste' AFTER razon_justificacion;

-- Costo en productos con 8 decimales (la fuente sigue siendo la tabla costos).
ALTER TABLE productos
  MODIFY costo DECIMAL(20,8) NULL DEFAULT 0,
  MODIFY costo_local DECIMAL(20,8) NULL DEFAULT 0,
  MODIFY iva_pagado DECIMAL(20,8) NULL DEFAULT 0;

-- Descuento: 0 = informativo (el costo es el precio antes del descuento), 1 = baja el costo.
ALTER TABLE compras
  ADD COLUMN descuento_afecta_costo TINYINT(1) NOT NULL DEFAULT 0 AFTER porcentaje_descuento;

-- Las compras ya registradas se calcularon con el costo neto; los borradores siguen la configuración de la empresa.
UPDATE compras SET descuento_afecta_costo = 1 WHERE estado <> 'BORRADOR';
UPDATE compras SET descuento_afecta_costo = IF((SELECT descuento_modo FROM empresa WHERE activo = 1 LIMIT 1) = 'COSTO', 1, 0)
WHERE estado = 'BORRADOR';
