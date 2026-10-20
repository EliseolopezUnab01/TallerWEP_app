-- =====================================================
-- MIGRACIÓN 010: CATÁLOGO CONTABLE (Fase 2 de Compras)
-- Fecha: 2026-09-02
-- Fuente: "Modulo Compras.docx" - Control 29.1
-- Ver: docs/modulo-compras.md sección 5
-- =====================================================
--
-- Control 29.1 del cliente:
--   "Este listado solo debe activarse o aparecer, y ser obligatorio, si en el
--   Control 29 el usuario eligió la opción Gastos o Activos. Es una lista
--   desplegable conectada a un catálogo de gastos contables."
--
-- DECISIÓN DE DISEÑO (a confirmar con el cliente):
--   El cliente dice "para cada caso habrá que crear una Tabla que contenga
--   respectivamente los catálogos contables". Se implementa UNA sola tabla con
--   la columna `tipo` (GASTO / ACTIVO) en lugar de dos tablas gemelas:
--     - Evita duplicar estructura, índices y APIs idénticas.
--     - El desplegable del control 29.1 filtra por `tipo`, que es exactamente
--       el comportamiento que pide el cliente.
--   Si más adelante exige tablas separadas, se resuelve con las dos vistas.
-- =====================================================

SET NAMES utf8mb4;


-- =====================================================
-- 1. TABLA CATALOGO_CONTABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS catalogo_contable (
  idcatalogo INT AUTO_INCREMENT PRIMARY KEY,

  tipo ENUM('GASTO','ACTIVO') NOT NULL
    COMMENT 'Control 29.1. GASTO se muestra cuando el destino es GASTOS; ACTIVO cuando es ACTIVOS',

  codigo VARCHAR(20) NOT NULL UNIQUE
    COMMENT 'Código del rubro. Autogenerado G### / A### pero editable para admitir la codificación del contador',
  nombre VARCHAR(150) NOT NULL
    COMMENT 'Nombre del rubro tal como debe aparecer en el desplegable',
  descripcion TEXT NULL
    COMMENT 'Detalle de qué entra en este rubro. Ayuda al usuario que captura la compra',

  cuenta_contable VARCHAR(30) NULL
    COMMENT 'Número de cuenta del catálogo del contador. Opcional: el cliente aún no lo entregó',

  -- El cliente anotó sobre "Impuestos y Tasas Municipales":
  -- "ideal cuando el Selector 2 sea No Sujeto". Este campo permite precargar
  -- el control 19 al elegir el rubro. Es sugerencia, no obligación.
  condicion_iva_sugerida ENUM('GRAVADA','EXENTO','NO_SUJETO','XCOMPROBAR') NULL
    COMMENT 'Condición de IVA que se sugiere al elegir este rubro. NULL = no sugerir nada',

  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- No puede repetirse el mismo rubro dentro del mismo tipo
  CONSTRAINT uq_catalogo_tipo_nombre UNIQUE (tipo, nombre),

  INDEX idx_catalogo_tipo (tipo),
  INDEX idx_catalogo_codigo (codigo),
  INDEX idx_catalogo_nombre (nombre),
  INDEX idx_catalogo_activo (activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Catálogo contable de compras (control 29.1). Rubros de gastos y activos';


-- =====================================================
-- 2. DATOS DE EJEMPLO DEL CLIENTE
-- =====================================================
-- Textual del documento: "Los datos de catálogo se verán más adelante, pero
-- pueden usar los ejemplos, por ahora por ser los más comunes."
--
-- INSERT IGNORE para que la migración se pueda repetir sin duplicar.

INSERT IGNORE INTO catalogo_contable (tipo, codigo, nombre, descripcion, condicion_iva_sugerida) VALUES
  ('GASTO', 'G001', 'Beneficios a empleados / Uniformes',
   'Uniformes, prestaciones y beneficios al personal', NULL),
  ('GASTO', 'G002', 'Servicios (Agua, Luz, Internet)',
   'Servicios básicos del local y de las oficinas', 'GRAVADA'),
  ('GASTO', 'G003', 'Alquileres / Arrendamientos',
   'Arrendamiento de locales, bodegas y equipo', 'GRAVADA'),
  ('GASTO', 'G004', 'Papelería y Útiles de Oficina',
   'Consumibles de oficina y material de impresión', 'GRAVADA'),
  ('GASTO', 'G005', 'Mantenimiento y Reparaciones',
   'Mantenimiento de instalaciones, equipo y vehículos de la empresa', 'GRAVADA'),
  ('GASTO', 'G006', 'Impuestos y Tasas Municipales',
   'Tasas municipales y aranceles estatales. El cliente indica que aplica cuando la condición de IVA es No Sujeto', 'NO_SUJETO');

INSERT IGNORE INTO catalogo_contable (tipo, codigo, nombre, descripcion, condicion_iva_sugerida) VALUES
  ('ACTIVO', 'A001', 'Equipo de Cómputo',
   'Computadoras, impresoras y equipo informático de uso operativo', 'GRAVADA'),
  ('ACTIVO', 'A002', 'Mobiliario y Equipo de Oficina',
   'Escritorios, sillas, estantería y mobiliario en general', 'GRAVADA'),
  ('ACTIVO', 'A003', 'Vehículos',
   'Vehículos de la empresa, no destinados a la venta', 'GRAVADA');


-- =====================================================
-- 3. VISTAS POR TIPO
-- =====================================================
-- El cliente pidió "una tabla por cada caso". Estas vistas dan esa lectura
-- separada sin duplicar la estructura física.

CREATE OR REPLACE VIEW v_catalogo_gastos AS
SELECT idcatalogo, codigo, nombre, descripcion, cuenta_contable,
       condicion_iva_sugerida, activo
FROM catalogo_contable
WHERE tipo = 'GASTO';

CREATE OR REPLACE VIEW v_catalogo_activos AS
SELECT idcatalogo, codigo, nombre, descripcion, cuenta_contable,
       condicion_iva_sugerida, activo
FROM catalogo_contable
WHERE tipo = 'ACTIVO';


-- =====================================================
-- FIN DE MIGRACIÓN 010
-- =====================================================
--
-- PENDIENTE / A CONFIRMAR CON EL CLIENTE:
--   1. Una tabla con `tipo` o dos tablas separadas? (ver decisión arriba)
--   2. Falta el catálogo contable real. Los 9 rubros cargados son los ejemplos
--      del documento, no la lista definitiva del contador.
--   3. `cuenta_contable` queda vacío hasta que el cliente entregue su catálogo
--      de cuentas.
--   4. `condicion_iva_sugerida` es una inferencia de la nota del cliente sobre
--      Impuestos y Tasas Municipales. Confirmar si quiere ese precargado.
-- =====================================================

SELECT 'Migración 010 completada - Catálogo contable (control 29.1)' AS status;
