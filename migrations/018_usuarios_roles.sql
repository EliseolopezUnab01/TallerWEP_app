-- 018: roles y permisos por módulo y acción.
-- Los usuarios existentes quedan como Administrador.

CREATE TABLE IF NOT EXISTS roles (
  idrol INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(60) NOT NULL,
  descripcion VARCHAR(255) NULL,
  es_admin TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Tiene todos los permisos; no se puede editar ni borrar',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_roles_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rol_permisos (
  idrol INT NOT NULL,
  permiso VARCHAR(60) NOT NULL COMMENT 'modulo.accion, p. ej. compras.editar',
  PRIMARY KEY (idrol, permiso),
  CONSTRAINT fk_rolperm_rol FOREIGN KEY (idrol) REFERENCES roles (idrol) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE usuarios
  ADD COLUMN idrol INT NULL AFTER nombre,
  ADD COLUMN activo TINYINT(1) NOT NULL DEFAULT 1 AFTER idrol,
  ADD COLUMN ultimo_acceso DATETIME NULL AFTER activo,
  ADD CONSTRAINT fk_usuarios_rol FOREIGN KEY (idrol) REFERENCES roles (idrol) ON DELETE SET NULL;

INSERT INTO roles (nombre, descripcion, es_admin) VALUES
  ('Administrador', 'Acceso completo, incluida la gestión de usuarios y la configuración', 1),
  ('Compras', 'Ingreso de compras, procesos, documentos y catálogos', 0),
  ('Bodega', 'Inventario y consulta de compras', 0),
  ('Taller', 'Vehículos, clientes y empleados', 0),
  ('Consulta', 'Solo lectura en todos los módulos', 0);

INSERT INTO rol_permisos (idrol, permiso)
SELECT r.idrol, p.permiso FROM roles r
JOIN (
  SELECT 'Compras' rol, 'compras.ver' permiso UNION ALL
  SELECT 'Compras', 'compras.editar' UNION ALL
  SELECT 'Compras', 'compras.registrar' UNION ALL
  SELECT 'Compras', 'hacienda.emitir' UNION ALL
  SELECT 'Compras', 'catalogos.ver' UNION ALL
  SELECT 'Compras', 'catalogos.editar' UNION ALL
  SELECT 'Compras', 'inventario.ver' UNION ALL
  SELECT 'Compras', 'costos.ver' UNION ALL
  SELECT 'Compras', 'precios.ver' UNION ALL
  SELECT 'Bodega', 'inventario.ver' UNION ALL
  SELECT 'Bodega', 'inventario.editar' UNION ALL
  SELECT 'Bodega', 'compras.ver' UNION ALL
  SELECT 'Bodega', 'catalogos.ver' UNION ALL
  SELECT 'Taller', 'taller.ver' UNION ALL
  SELECT 'Taller', 'taller.editar' UNION ALL
  SELECT 'Taller', 'catalogos.ver' UNION ALL
  SELECT 'Taller', 'catalogos.editar' UNION ALL
  SELECT 'Taller', 'inventario.ver' UNION ALL
  SELECT 'Consulta', 'compras.ver' UNION ALL
  SELECT 'Consulta', 'inventario.ver' UNION ALL
  SELECT 'Consulta', 'precios.ver' UNION ALL
  SELECT 'Consulta', 'costos.ver' UNION ALL
  SELECT 'Consulta', 'taller.ver' UNION ALL
  SELECT 'Consulta', 'catalogos.ver'
) p ON p.rol = r.nombre;

UPDATE usuarios SET idrol = (SELECT idrol FROM roles WHERE nombre = 'Administrador') WHERE idrol IS NULL;
