-- =====================================================
-- MIGRACIÓN 008: CAMPOS PARA AJUSTE DE PRECIOS
-- Sistema basado en lógica FoxPro del cliente
-- =====================================================

-- =====================================================
-- 1. AGREGAR CAMPOS DE COSTOS A PRODUCTOS
-- =====================================================

-- Costo local (incluye flete, impuestos de importación, etc.)
ALTER TABLE productos 
ADD COLUMN IF NOT EXISTS costo_local DECIMAL(10,2) DEFAULT 0 
COMMENT 'Costo local del producto (costo + gastos de importación)';

-- IVA pagado por unidad (para cálculos de ganancia)
ALTER TABLE productos 
ADD COLUMN IF NOT EXISTS iva_pagado DECIMAL(10,2) DEFAULT 0 
COMMENT 'IVA unitario pagado en la compra del producto';

-- =====================================================
-- 2. AGREGAR CAMPOS DE PORCENTAJE Y GANANCIA A PRECIOS
-- =====================================================

-- Porcentajes para cada tipo de precio
ALTER TABLE precios 
ADD COLUMN IF NOT EXISTS porcentaje_general DECIMAL(10,2) DEFAULT 0 
COMMENT 'Porcentaje de ganancia para precio general';

ALTER TABLE precios 
ADD COLUMN IF NOT EXISTS porcentaje_cliente DECIMAL(10,2) DEFAULT 0 
COMMENT 'Porcentaje de ganancia para precio cliente';

ALTER TABLE precios 
ADD COLUMN IF NOT EXISTS porcentaje_mecanico DECIMAL(10,2) DEFAULT 0 
COMMENT 'Porcentaje de ganancia para precio mecánico';

ALTER TABLE precios 
ADD COLUMN IF NOT EXISTS porcentaje_minorista DECIMAL(10,2) DEFAULT 0 
COMMENT 'Porcentaje de ganancia para precio minorista';

ALTER TABLE precios 
ADD COLUMN IF NOT EXISTS porcentaje_mayorista DECIMAL(10,2) DEFAULT 0 
COMMENT 'Porcentaje de ganancia para precio mayorista';

ALTER TABLE precios 
ADD COLUMN IF NOT EXISTS porcentaje_especial DECIMAL(10,2) DEFAULT 0 
COMMENT 'Porcentaje de ganancia para precio especial';

-- Ganancias calculadas para cada tipo de precio
ALTER TABLE precios 
ADD COLUMN IF NOT EXISTS ganancia_general DECIMAL(10,2) DEFAULT 0 
COMMENT 'Ganancia estimada para precio general';

ALTER TABLE precios 
ADD COLUMN IF NOT EXISTS ganancia_cliente DECIMAL(10,2) DEFAULT 0 
COMMENT 'Ganancia estimada para precio cliente';

ALTER TABLE precios 
ADD COLUMN IF NOT EXISTS ganancia_mecanico DECIMAL(10,2) DEFAULT 0 
COMMENT 'Ganancia estimada para precio mecánico';

ALTER TABLE precios 
ADD COLUMN IF NOT EXISTS ganancia_minorista DECIMAL(10,2) DEFAULT 0 
COMMENT 'Ganancia estimada para precio minorista';

ALTER TABLE precios 
ADD COLUMN IF NOT EXISTS ganancia_mayorista DECIMAL(10,2) DEFAULT 0 
COMMENT 'Ganancia estimada para precio mayorista';

ALTER TABLE precios 
ADD COLUMN IF NOT EXISTS ganancia_especial DECIMAL(10,2) DEFAULT 0 
COMMENT 'Ganancia estimada para precio especial';

-- =====================================================
-- 3. CREAR TABLA DE CONFIGURACIÓN DE IMPUESTOS
-- =====================================================

CREATE TABLE IF NOT EXISTS configuracion_impuestos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL COMMENT 'Nombre del impuesto/factor',
  codigo VARCHAR(50) UNIQUE NOT NULL COMMENT 'Código único (IVA, RENTA, etc.)',
  porcentaje DECIMAL(5,4) NOT NULL COMMENT 'Porcentaje como decimal (0.13 = 13%)',
  descripcion TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Configuración de impuestos y factores para cálculo de precios';

-- Insertar valores por defecto (El Salvador)
INSERT INTO configuracion_impuestos (nombre, codigo, porcentaje, descripcion) VALUES
('IVA', 'IVA', 0.13, 'Impuesto al Valor Agregado - El Salvador 13%'),
('Factor Renta', 'RENTA', 0.20, 'Estimación de pago de renta de fin de año - 20%')
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

-- =====================================================
-- 4. ACTUALIZAR TABLA AJUSTE_PRECIOS PARA HISTORIAL
-- =====================================================

ALTER TABLE ajuste_precios 
ADD COLUMN IF NOT EXISTS tipo_ajuste ENUM('PORCENTAJE', 'PRECIO', 'GANANCIA') DEFAULT 'PORCENTAJE'
COMMENT 'Tipo de ajuste realizado';

ALTER TABLE ajuste_precios 
ADD COLUMN IF NOT EXISTS tipo_precio VARCHAR(50) 
COMMENT 'Tipo de precio ajustado (general, cliente, mecanico, etc.)';

ALTER TABLE ajuste_precios 
ADD COLUMN IF NOT EXISTS valor_anterior DECIMAL(10,2) 
COMMENT 'Valor anterior del precio';

ALTER TABLE ajuste_precios 
ADD COLUMN IF NOT EXISTS valor_nuevo DECIMAL(10,2) 
COMMENT 'Valor nuevo del precio';

ALTER TABLE ajuste_precios 
ADD COLUMN IF NOT EXISTS porcentaje_anterior DECIMAL(10,2) 
COMMENT 'Porcentaje anterior';

ALTER TABLE ajuste_precios 
ADD COLUMN IF NOT EXISTS porcentaje_nuevo DECIMAL(10,2) 
COMMENT 'Porcentaje nuevo';

ALTER TABLE ajuste_precios 
ADD COLUMN IF NOT EXISTS ganancia_anterior DECIMAL(10,2) 
COMMENT 'Ganancia anterior';

ALTER TABLE ajuste_precios 
ADD COLUMN IF NOT EXISTS ganancia_nueva DECIMAL(10,2) 
COMMENT 'Ganancia nueva';

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================

SELECT 'Migración 008 completada - Campos para ajuste de precios agregados' AS status;
