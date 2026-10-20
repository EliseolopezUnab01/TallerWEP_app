-- Migración para crear tablas de Grupos y Subgrupos
-- Esto permite un sistema de clasificación jerárquico: Categoría > Grupo > Subgrupo

-- Tabla de Grupos (nivel intermedio)
CREATE TABLE IF NOT EXISTS grupos (
  idgrupo VARCHAR(10) PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  descripcion TEXT,
  idcategoria VARCHAR(6),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (idcategoria) REFERENCES categorias(idcategoria) ON DELETE SET NULL,
  INDEX idx_grupos_categoria (idcategoria)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de Subgrupos (nivel más específico)
CREATE TABLE IF NOT EXISTS subgrupos (
  idsubgrupo VARCHAR(10) PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  descripcion TEXT,
  idgrupo VARCHAR(10),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (idgrupo) REFERENCES grupos(idgrupo) ON DELETE SET NULL,
  INDEX idx_subgrupos_grupo (idgrupo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Agregar campos de grupo y subgrupo a la tabla productos
ALTER TABLE productos 
ADD COLUMN IF NOT EXISTS idgrupo VARCHAR(10) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS idsubgrupo VARCHAR(10) DEFAULT NULL;

-- Agregar índices para mejor rendimiento en filtros
ALTER TABLE productos
ADD INDEX IF NOT EXISTS idx_productos_grupo (idgrupo),
ADD INDEX IF NOT EXISTS idx_productos_subgrupo (idsubgrupo);

-- Agregar foreign keys (opcional, comentar si causa problemas)
-- ALTER TABLE productos
-- ADD FOREIGN KEY (idgrupo) REFERENCES grupos(idgrupo) ON DELETE SET NULL,
-- ADD FOREIGN KEY (idsubgrupo) REFERENCES subgrupos(idsubgrupo) ON DELETE SET NULL;
