-- =====================================================
-- TABLA COSTOS - Sistema de gestión de costos separado
-- Fecha: 2026-03-12
-- Descripción: Tabla para almacenar costos de productos
--              separada de la tabla productos por seguridad
-- =====================================================

-- Crear la tabla costos
CREATE TABLE IF NOT EXISTS costos (
    idcosto INT PRIMARY KEY AUTO_INCREMENT COMMENT 'Identificador único del registro de costo',
    idprod INT NOT NULL UNIQUE COMMENT 'FK a productos - relación 1:1',
    
    -- Datos de la factura/compra
    nofactura VARCHAR(50) NULL COMMENT 'Número de factura o documento de la compra',
    dt_compra DATE NULL COMMENT 'Fecha de la última compra',
    
    -- Costos principales
    costo DECIMAL(12,2) DEFAULT 0.00 COMMENT 'Costo según factura de la compra más reciente (en moneda local/Dólar)',
    costo_proveedor DECIMAL(12,2) DEFAULT 0.00 COMMENT 'Costo real pagado al proveedor (puede incluir tipo de cambio)',
    costo_promedio DECIMAL(12,2) DEFAULT 0.00 COMMENT 'Costo promedio de todas las compras',
    costo_local DECIMAL(12,2) DEFAULT 0.00 COMMENT 'Costo promedio calculado en moneda local',
    iva_pagado DECIMAL(12,2) DEFAULT 0.00 COMMENT 'IVA pagado en la compra',
    
    -- Campos de respaldo (historial de últimos valores)
    costo_previo1 DECIMAL(12,2) DEFAULT 0.00 COMMENT 'Respaldo 1: valor anterior de costo_local antes de la última compra',
    costo_previo2 DECIMAL(12,2) DEFAULT 0.00 COMMENT 'Respaldo 2: valor que tenía costo_previo1 antes de la última compra',
    costop_previo1 DECIMAL(12,2) DEFAULT 0.00 COMMENT 'Respaldo 1 del costo promedio',
    costop_previo2 DECIMAL(12,2) DEFAULT 0.00 COMMENT 'Respaldo 2 del costo promedio',
    
    -- Metadatos
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha de creación del registro',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha de última actualización',
    
    -- Foreign Key
    CONSTRAINT fk_costos_producto FOREIGN KEY (idprod) REFERENCES productos(idprod) ON DELETE CASCADE ON UPDATE CASCADE,
    
    -- Índices
    INDEX idx_costos_idprod (idprod),
    INDEX idx_costos_dt_compra (dt_compra)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Tabla de costos separada de productos para mayor seguridad';

-- =====================================================
-- MIGRACIÓN DE DATOS EXISTENTES
-- Ejecutar después de crear la tabla
-- =====================================================

-- Insertar registros de costos para todos los productos existentes
INSERT INTO costos (idprod, costo, costo_local, iva_pagado, costo_promedio)
SELECT 
    idprod,
    COALESCE(costo, 0) as costo,
    COALESCE(costo_local, costo, 0) as costo_local,
    COALESCE(iva_pagado, 0) as iva_pagado,
    COALESCE(costo_local, costo, 0) as costo_promedio
FROM productos
WHERE idprod NOT IN (SELECT idprod FROM costos);

-- =====================================================
-- TRIGGER: Crear registro de costos al insertar producto
-- =====================================================

DELIMITER //

CREATE TRIGGER tr_productos_after_insert_costos
AFTER INSERT ON productos
FOR EACH ROW
BEGIN
    INSERT INTO costos (idprod, costo, costo_local, costo_promedio)
    VALUES (NEW.idprod, COALESCE(NEW.costo, 0), COALESCE(NEW.costo_local, NEW.costo, 0), COALESCE(NEW.costo_local, NEW.costo, 0));
END//

DELIMITER ;

-- =====================================================
-- PROCEDIMIENTO: Actualizar costo con respaldos
-- Usar este procedimiento cuando se registre una nueva compra
-- =====================================================

DELIMITER //

CREATE PROCEDURE sp_actualizar_costo(
    IN p_idprod INT,
    IN p_nuevo_costo DECIMAL(12,2),
    IN p_costo_proveedor DECIMAL(12,2),
    IN p_iva_pagado DECIMAL(12,2),
    IN p_nofactura VARCHAR(50),
    IN p_dt_compra DATE
)
BEGIN
    DECLARE v_costo_local_actual DECIMAL(12,2);
    DECLARE v_costo_previo1_actual DECIMAL(12,2);
    DECLARE v_costo_promedio_actual DECIMAL(12,2);
    DECLARE v_costop_previo1_actual DECIMAL(12,2);
    
    -- Obtener valores actuales
    SELECT costo_local, costo_previo1, costo_promedio, costop_previo1
    INTO v_costo_local_actual, v_costo_previo1_actual, v_costo_promedio_actual, v_costop_previo1_actual
    FROM costos WHERE idprod = p_idprod;
    
    -- Actualizar con rotación de respaldos
    UPDATE costos SET
        -- Rotar respaldos de costo_local
        costo_previo2 = v_costo_previo1_actual,
        costo_previo1 = v_costo_local_actual,
        
        -- Rotar respaldos de costo_promedio
        costop_previo2 = v_costop_previo1_actual,
        costop_previo1 = v_costo_promedio_actual,
        
        -- Actualizar valores actuales
        costo = p_nuevo_costo,
        costo_local = p_nuevo_costo,
        costo_proveedor = p_costo_proveedor,
        iva_pagado = p_iva_pagado,
        costo_promedio = (v_costo_promedio_actual + p_nuevo_costo) / 2, -- Promedio simple
        
        -- Datos de factura
        nofactura = p_nofactura,
        dt_compra = p_dt_compra
    WHERE idprod = p_idprod;
END//

DELIMITER ;

-- =====================================================
-- VISTA: Costos con información del producto
-- =====================================================

CREATE OR REPLACE VIEW v_costos_productos AS
SELECT 
    c.*,
    p.nombre as producto_nombre,
    p.OE,
    p.marca
FROM costos c
INNER JOIN productos p ON c.idprod = p.idprod;

-- =====================================================
-- NOTAS DE IMPLEMENTACIÓN
-- =====================================================
-- 
-- 1. Después de crear la tabla, ejecutar la migración de datos
-- 2. El trigger creará automáticamente registros de costos para nuevos productos
-- 3. Usar sp_actualizar_costo() cuando se registre una nueva compra
-- 4. Los campos costo_previo1/2 guardan los últimos 2 valores de costo_local
-- 5. Los campos costop_previo1/2 guardan los últimos 2 valores de costo_promedio
--
-- IMPORTANTE: Después de verificar que todo funciona, se pueden eliminar
-- los campos costo, costo_local e iva_pagado de la tabla productos
-- =====================================================
