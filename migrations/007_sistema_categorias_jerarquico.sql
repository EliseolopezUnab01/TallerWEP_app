-- =====================================================
-- SISTEMA DE CATEGORÍAS JERÁRQUICO (3 NIVELES)
-- =====================================================
-- Estructura: Categoría (10-99) > Grupo (000-999) > Subgrupo (000-999)
-- 
-- El ID del producto se forma así:
-- [Categoría 2 dígitos][Grupo 3 dígitos][Subgrupo 3 dígitos][consecutivo 3 dígitos]
-- Ejemplo: 11001001001 = Transm. Manual > Tren Fijo > Engranajes > Producto #001
-- =====================================================

-- =====================================================
-- PASO 1: MODIFICAR TABLA CATEGORÍAS
-- =====================================================

-- Crear nueva tabla de categorías con código numérico
CREATE TABLE IF NOT EXISTS categorias_nuevo (
  idcategoria INT PRIMARY KEY,
  codigo_antiguo VARCHAR(10) DEFAULT NULL COMMENT 'Referencia al código anterior',
  nombre VARCHAR(100) NOT NULL,
  descripcion TEXT,
  activo TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_cat_nombre (nombre),
  INDEX idx_cat_activo (activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insertar categorías con códigos numéricos según el Excel
INSERT INTO categorias_nuevo (idcategoria, nombre, descripcion) VALUES
(10, 'Motor', 'Motor y componentes'),
(11, 'Transm. Man.', 'Transmisión Manual'),
(12, 'Transm. Auto.', 'Transmisión Automática'),
(13, 'Frenos', 'Sistema de frenos'),
(14, 'Embrague', 'Sistema de embrague'),
(15, 'Diferencial', 'Diferencial'),
(16, 'Caja Transfer', 'Caja de transferencia'),
(17, 'Eje Delantero', 'Eje delantero'),
(18, 'Eje Trasero', 'Eje trasero'),
(19, 'Dirección', 'Sistema de dirección'),
(20, 'Suspensión', 'Sistema de suspensión'),
(21, 'Carrocería', 'Carrocería'),
(22, 'Chasis', 'Chasis'),
(23, 'Sist. Hidráulico', 'Sistema hidráulico'),
(24, 'Sist. Eléctrico', 'Sistema eléctrico'),
(25, 'Sist. Carga', 'Sistema de carga'),
(26, 'Lubricantes', 'Lubricantes y aceites'),
(27, 'Filtros', 'Filtros'),
(99, 'Otro', 'Otros productos')
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

-- =====================================================
-- PASO 2: CREAR TABLA DE GRUPOS
-- =====================================================
CREATE TABLE IF NOT EXISTS grupos (
  id_grupo INT AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(3) NOT NULL COMMENT 'Código 000-999',
  nombre VARCHAR(100) NOT NULL,
  descripcion TEXT,
  idcategoria INT NOT NULL,
  activo TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (idcategoria) REFERENCES categorias_nuevo(idcategoria) ON DELETE CASCADE,
  UNIQUE KEY uk_grupo_codigo_cat (codigo, idcategoria),
  INDEX idx_grupo_categoria (idcategoria),
  INDEX idx_grupo_activo (activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- PASO 3: CREAR TABLA DE SUBGRUPOS
-- =====================================================
CREATE TABLE IF NOT EXISTS subgrupos (
  id_subgrupo INT AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(3) NOT NULL COMMENT 'Código 000-999',
  nombre VARCHAR(100) NOT NULL,
  descripcion TEXT,
  id_grupo INT NOT NULL,
  activo TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (id_grupo) REFERENCES grupos(id_grupo) ON DELETE CASCADE,
  UNIQUE KEY uk_subgrupo_codigo_grupo (codigo, id_grupo),
  INDEX idx_subgrupo_grupo (id_grupo),
  INDEX idx_subgrupo_activo (activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- PASO 4: MODIFICAR TABLA PRODUCTOS
-- =====================================================
-- Eliminar columnas antiguas de grupo/subgrupo si existen
-- ALTER TABLE productos DROP COLUMN IF EXISTS idgrupo;
-- ALTER TABLE productos DROP COLUMN IF EXISTS idsubgrupo;

-- Agregar nuevas columnas
ALTER TABLE productos 
ADD COLUMN IF NOT EXISTS idcategoria_nuevo INT DEFAULT NULL COMMENT 'Nueva categoría numérica',
ADD COLUMN IF NOT EXISTS id_grupo INT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS id_subgrupo INT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS codigo_jerarquico VARCHAR(15) DEFAULT NULL COMMENT 'Código: CC+GGG+SSS+consecutivo';

-- Índices para productos
ALTER TABLE productos
ADD INDEX IF NOT EXISTS idx_prod_cat_nuevo (idcategoria_nuevo),
ADD INDEX IF NOT EXISTS idx_prod_grupo (id_grupo),
ADD INDEX IF NOT EXISTS idx_prod_subgrupo (id_subgrupo),
ADD INDEX IF NOT EXISTS idx_prod_codigo_jerarquico (codigo_jerarquico);

-- =====================================================
-- PASO 5: DATOS INICIALES - GRUPOS
-- =====================================================
-- Motor (10)
INSERT INTO grupos (codigo, nombre, idcategoria) VALUES
('000', 'Ensamblado', 10),
('001', 'Bomba de Inyección', 10),
('002', 'Inyectores', 10),
('003', 'Bomba Agua', 10),
('004', 'Bomba Aceite', 10),
('005', 'TurboCargador', 10),
('006', 'Culata de Motor', 10),
('007', 'Bloque Inferior', 10),
('008', 'Lubricación', 10),
('009', 'Filtros', 10),
('010', 'Radiador', 10),
('011', 'Enfriamiento', 10),
('012', 'Ventilador', 10),
('013', 'Correas', 10),
('014', 'Tuberías', 10),
('015', 'Compresor', 10),
('016', 'Arrancador', 10),
('017', 'Motor de Arranque', 10)
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

-- Transmisión Manual (11)
INSERT INTO grupos (codigo, nombre, idcategoria) VALUES
('000', 'Ensamblado', 11),
('001', 'Tren Fijo', 11),
('002', 'Tren Desplazable', 11),
('003', 'Mandos', 11)
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

-- =====================================================
-- PASO 6: DATOS INICIALES - SUBGRUPOS
-- =====================================================
-- Subgrupos para Motor > Ensamblado (código 000)
INSERT INTO subgrupos (codigo, nombre, id_grupo)
SELECT '000', 'Ensamblado', id_grupo FROM grupos WHERE codigo = '000' AND idcategoria = 10
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

-- Subgrupos para Motor > Bomba de Inyección (código 001)
INSERT INTO subgrupos (codigo, nombre, id_grupo)
SELECT '001', 'Sellos', id_grupo FROM grupos WHERE codigo = '001' AND idcategoria = 10
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

INSERT INTO subgrupos (codigo, nombre, id_grupo)
SELECT '002', 'Juntas', id_grupo FROM grupos WHERE codigo = '001' AND idcategoria = 10
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

-- Subgrupos para Transm. Manual > Ensamblado (código 000)
INSERT INTO subgrupos (codigo, nombre, id_grupo)
SELECT '000', 'Ensamblado', id_grupo FROM grupos WHERE codigo = '000' AND idcategoria = 11
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

-- Subgrupos para Transm. Manual > Tren Fijo (código 001)
INSERT INTO subgrupos (codigo, nombre, id_grupo)
SELECT '000', 'Ensamblado', id_grupo FROM grupos WHERE codigo = '001' AND idcategoria = 11
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

INSERT INTO subgrupos (codigo, nombre, id_grupo)
SELECT '001', 'Engranajes', id_grupo FROM grupos WHERE codigo = '001' AND idcategoria = 11
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

-- Subgrupos para Transm. Manual > Tren Desplazable (código 002)
INSERT INTO subgrupos (codigo, nombre, id_grupo)
SELECT '002', 'Sincronizadores', id_grupo FROM grupos WHERE codigo = '002' AND idcategoria = 11
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

-- Subgrupos para Transm. Manual > Mandos (código 003)
INSERT INTO subgrupos (codigo, nombre, id_grupo)
SELECT '003', 'Sellos y Juntas', id_grupo FROM grupos WHERE codigo = '003' AND idcategoria = 11
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

-- =====================================================
-- PASO 7: VISTA PARA CONSULTAR JERARQUÍA COMPLETA
-- =====================================================
CREATE OR REPLACE VIEW v_categorias_jerarquia AS
SELECT 
  c.idcategoria,
  c.nombre as categoria_nombre,
  g.id_grupo,
  g.codigo as grupo_codigo,
  g.nombre as grupo_nombre,
  s.id_subgrupo,
  s.codigo as subgrupo_codigo,
  s.nombre as subgrupo_nombre,
  CONCAT(
    LPAD(c.idcategoria, 2, '0'),
    COALESCE(LPAD(g.codigo, 3, '0'), '000'),
    COALESCE(LPAD(s.codigo, 3, '0'), '000')
  ) as codigo_base
FROM categorias_nuevo c
LEFT JOIN grupos g ON c.idcategoria = g.idcategoria
LEFT JOIN subgrupos s ON g.id_grupo = s.id_grupo
WHERE c.activo = 1
ORDER BY c.idcategoria, g.codigo, s.codigo;
