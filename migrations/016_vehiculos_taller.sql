-- =====================================================
-- MIGRACIÓN 016: VEHÍCULOS (TARJETA, PARTES, ESTADOS, RECORDATORIOS) Y DATOS SV
-- Fecha: 2026-10-16
-- Fuente: respuestas del cliente (docs/fuentes/preguntas-importantes_extraido.txt),
--         fotos de la tarjeta de circulación y decisiones del 16/10 (docs/ESTADO.md).
-- Las tablas del taller no tienen datos; los cambios de columnas no pierden información.
-- =====================================================
--
-- - clientes / empleados: RFC, CURP, NSS y código postal (México) → DUI, NIT, NRC, ISSS, AFP.
-- - vehiculos: datos de la tarjeta vigente. Placa (C79371) y año de placa (2011) separados.
--   La foto de la tarjeta va en ruta_archivos (entidad VEHICULO, carpeta vehiculos).
-- - Una parte es una pieza concreta dentro de un sistema (frenos = sistema; resorte de
--   fricción = parte). Un reemplazo crea una parte nueva y la vieja queda RETIRADA.
-- - estado_partes guarda una fila solo cuando se revisa o cambia algo, de entrada y de salida.
-- - Las 5 hojas orden_* de inspección se eliminan (vacías); las reemplazan partes y estados.
-- =====================================================

SET NAMES utf8mb4;

-- ---------- Clientes ----------
ALTER TABLE clientes
  DROP COLUMN rfc,
  DROP COLUMN codigo_postal,
  CHANGE COLUMN ciudad municipio VARCHAR(100) NULL,
  CHANGE COLUMN estado departamento VARCHAR(100) NULL,
  ADD COLUMN dui VARCHAR(10) NULL COMMENT 'Documento Único de Identidad (00000000-0)' AFTER tipo,
  ADD COLUMN nit VARCHAR(17) NULL COMMENT 'NIT (0000-000000-000-0)' AFTER dui,
  ADD COLUMN nrc VARCHAR(10) NULL COMMENT 'Registro de contribuyente' AFTER nit,
  ADD COLUMN giro VARCHAR(200) NULL COMMENT 'Actividad económica, si es contribuyente' AFTER nrc,
  ADD KEY idx_clientes_dui (dui),
  ADD KEY idx_clientes_nit (nit);

-- ---------- Empleados ----------
ALTER TABLE empleados
  DROP COLUMN rfc,
  DROP COLUMN curp,
  DROP COLUMN nss,
  DROP COLUMN codigo_postal,
  CHANGE COLUMN ciudad municipio VARCHAR(100) NULL,
  CHANGE COLUMN estado departamento_residencia VARCHAR(100) NULL,
  ADD COLUMN dui VARCHAR(10) NULL AFTER fecha_nacimiento,
  ADD COLUMN nit VARCHAR(17) NULL AFTER dui,
  ADD COLUMN isss VARCHAR(20) NULL COMMENT 'Número de afiliación ISSS' AFTER nit,
  ADD COLUMN afp VARCHAR(30) NULL COMMENT 'Institución: CRECER, CONFÍA…' AFTER isss,
  ADD COLUMN nup VARCHAR(20) NULL COMMENT 'Número Único Previsional (AFP)' AFTER afp,
  ADD KEY idx_empleados_dui (dui);

-- ---------- Vehículos (tarjeta de circulación vigente) ----------
ALTER TABLE vehiculos
  DROP INDEX matricula,
  DROP INDEX idx_matricula,
  CHANGE COLUMN matricula placa VARCHAR(20) NULL COMMENT 'Placa sin año: C79371',
  CHANGE COLUMN `año` anio_modelo SMALLINT NULL COMMENT 'Año del modelo',
  DROP COLUMN capacidad,
  ADD COLUMN codigo VARCHAR(20) NULL COMMENT 'Código interno VH26-00001' AFTER id,
  ADD COLUMN anio_placa SMALLINT NULL COMMENT 'Año que acompaña la placa en la tarjeta: 2011' AFTER placa,
  ADD COLUMN clase VARCHAR(50) NULL COMMENT 'AUTOMÓVIL, PICK UP, CAMIÓN…' AFTER tipo,
  ADD COLUMN ejes TINYINT NULL AFTER clase,
  ADD COLUMN tara DECIMAL(10,2) NULL COMMENT 'Peso del vehículo vacío' AFTER ejes,
  ADD COLUMN unidad_capacidad VARCHAR(20) NULL COMMENT 'KG, TON, LB, PASAJEROS' AFTER tara,
  ADD COLUMN capacidad_carga DECIMAL(10,2) NULL AFTER unidad_capacidad,
  ADD COLUMN capacidad_maxima DECIMAL(10,2) NULL AFTER capacidad_carga,
  ADD COLUMN traccion VARCHAR(20) NULL COMMENT '4X2, 4X4, 6X4…' AFTER capacidad_maxima,
  ADD COLUMN dominio VARCHAR(50) NULL COMMENT 'Dominio según la tarjeta' AFTER traccion,
  ADD COLUMN en_calidad VARCHAR(50) NULL COMMENT 'En calidad de: PROPIETARIO…' AFTER dominio,
  ADD COLUMN propietario_nombre VARCHAR(200) NULL COMMENT 'Propietario en la tarjeta (puede no ser el cliente)' AFTER en_calidad,
  ADD COLUMN propietario_dui VARCHAR(20) NULL AFTER propietario_nombre,
  ADD COLUMN propietario_domicilio TEXT NULL AFTER propietario_dui,
  ADD COLUMN tarjeta_emision DATE NULL AFTER propietario_domicilio,
  ADD COLUMN tarjeta_vencimiento DATE NULL AFTER tarjeta_emision,
  ADD UNIQUE KEY uq_vehiculos_codigo (codigo),
  ADD UNIQUE KEY uq_vehiculos_placa (placa),
  ADD KEY idx_vehiculos_vencimiento (tarjeta_vencimiento);

-- ---------- Catálogo de sistemas ----------
CREATE TABLE IF NOT EXISTS cat_sistemas_vehiculo (
  idsistema INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL,
  descripcion VARCHAR(255) NULL,
  orden SMALLINT NOT NULL DEFAULT 0,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sistema_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Sistemas del vehículo (frenos, motor…). Catálogo editable';

INSERT IGNORE INTO cat_sistemas_vehiculo (nombre, orden) VALUES
  ('MOTOR', 10), ('ENFRIAMIENTO', 20), ('COMBUSTIBLE', 30), ('ESCAPE', 40),
  ('FILTROS Y LUBRICANTES', 50), ('TRANSMISIÓN', 60), ('CLUTCH', 70),
  ('TRACCIÓN Y DIFERENCIAL', 80), ('FRENOS', 90), ('SUSPENSIÓN', 100),
  ('DIRECCIÓN', 110), ('SISTEMA ELÉCTRICO', 120), ('CHASIS Y CARROCERÍA', 130),
  ('LLANTAS Y RINES', 140), ('AIRE ACONDICIONADO', 150);

-- ---------- Partes del vehículo ----------
CREATE TABLE IF NOT EXISTS vehiculo_partes (
  idparte INT AUTO_INCREMENT PRIMARY KEY,
  idvehiculo INT NOT NULL,
  idsistema INT NOT NULL,
  nombre_parte VARCHAR(150) NOT NULL,
  posicion VARCHAR(50) NULL COMMENT 'DELANTERA IZQ., TRASERA, EJE 2…',
  idprod INT NULL COMMENT 'Producto del inventario, si se vendió/instaló desde aquí',
  marca VARCHAR(50) NULL,
  referencia VARCHAR(100) NULL,
  numero_serie VARCHAR(100) NULL,
  estado_instalacion ENUM('INSTALADA','RETIRADA') NOT NULL DEFAULT 'INSTALADA',
  fecha_instalacion DATE NULL,
  km_instalacion INT NULL,
  fecha_retiro DATE NULL,
  km_retiro INT NULL,
  reemplaza_a INT NULL COMMENT 'Parte retirada que esta pieza reemplazó',
  comentario TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_partes_vehiculo (idvehiculo, estado_instalacion),
  KEY idx_partes_sistema (idsistema),
  CONSTRAINT fk_partes_vehiculo FOREIGN KEY (idvehiculo) REFERENCES vehiculos (id) ON DELETE CASCADE,
  CONSTRAINT fk_partes_sistema FOREIGN KEY (idsistema) REFERENCES cat_sistemas_vehiculo (idsistema),
  CONSTRAINT fk_partes_producto FOREIGN KEY (idprod) REFERENCES productos (idprod) ON DELETE SET NULL,
  CONSTRAINT fk_partes_reemplazo FOREIGN KEY (reemplaza_a) REFERENCES vehiculo_partes (idparte) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Piezas documentadas de cada vehículo; la vieja queda RETIRADA al reemplazarla';

-- ---------- Estado de las partes (entrada y salida) ----------
CREATE TABLE IF NOT EXISTS estado_partes (
  idestado INT AUTO_INCREMENT PRIMARY KEY,
  idparte INT NOT NULL,
  idorden INT NULL,
  idempleado INT NULL,
  momento ENUM('ENTRADA','SALIDA') NOT NULL,
  estado_visual TINYINT NULL COMMENT 'Apreciación visual o técnica, 1 a 10',
  estado_texto ENUM('EXCELENTE','BUEN ESTADO','REGULAR','DAÑADO','PELIGRO','INSERVIBLE','DESACTIVADO','SIN VERIFICAR','OTRO')
    NOT NULL DEFAULT 'SIN VERIFICAR' COMMENT 'Opinión o recomendación',
  kilometraje INT NULL,
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  comentario TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_estado_parte (idparte, fecha),
  KEY idx_estado_orden (idorden),
  CONSTRAINT chk_estado_visual CHECK (estado_visual IS NULL OR estado_visual BETWEEN 1 AND 10),
  CONSTRAINT fk_estado_parte FOREIGN KEY (idparte) REFERENCES vehiculo_partes (idparte) ON DELETE CASCADE,
  CONSTRAINT fk_estado_orden FOREIGN KEY (idorden) REFERENCES ordenes_trabajo (id) ON DELETE SET NULL,
  CONSTRAINT fk_estado_empleado FOREIGN KEY (idempleado) REFERENCES empleados (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Revisión de una parte: una fila solo cuando se revisa o cambia algo';

-- ---------- Recordatorios de mantenimiento ----------
CREATE TABLE IF NOT EXISTS recordatorios_mantenimiento (
  idrecordatorio INT AUTO_INCREMENT PRIMARY KEY,
  idvehiculo INT NOT NULL,
  idparte INT NULL,
  idsistema INT NULL,
  descripcion VARCHAR(200) NOT NULL COMMENT 'Ej.: Cambio de aceite de motor',
  intervalo_dias INT NULL,
  intervalo_km INT NULL,
  ultimo_fecha DATE NULL,
  ultimo_km INT NULL,
  proximo_fecha DATE AS (IF(ultimo_fecha IS NULL OR intervalo_dias IS NULL, NULL, ultimo_fecha + INTERVAL intervalo_dias DAY)) STORED,
  proximo_km INT AS (IF(ultimo_km IS NULL OR intervalo_km IS NULL, NULL, ultimo_km + intervalo_km)) STORED,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  comentario TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_record_vehiculo (idvehiculo, activo),
  KEY idx_record_proximo (proximo_fecha),
  CONSTRAINT chk_record_intervalo CHECK (intervalo_dias IS NOT NULL OR intervalo_km IS NOT NULL),
  CONSTRAINT fk_record_vehiculo FOREIGN KEY (idvehiculo) REFERENCES vehiculos (id) ON DELETE CASCADE,
  CONSTRAINT fk_record_parte FOREIGN KEY (idparte) REFERENCES vehiculo_partes (idparte) ON DELETE SET NULL,
  CONSTRAINT fk_record_sistema FOREIGN KEY (idsistema) REFERENCES cat_sistemas_vehiculo (idsistema) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Próximo cambio por fecha y por kilometraje';

-- ---------- Órdenes de trabajo ----------
DROP TABLE IF EXISTS orden_chasis_electrico;
DROP TABLE IF EXISTS orden_filtros_lubes;
DROP TABLE IF EXISTS orden_frenos_clutch;
DROP TABLE IF EXISTS orden_motor;
DROP TABLE IF EXISTS orden_traccion;

ALTER TABLE orden_reparaciones
  DROP COLUMN empleado1,
  DROP COLUMN empleado2,
  DROP COLUMN empleado3,
  ADD COLUMN idempleado1 INT NULL COMMENT 'Mecánico principal' AFTER tarea_actividad,
  ADD COLUMN idempleado2 INT NULL AFTER idempleado1,
  ADD COLUMN idempleado3 INT NULL AFTER idempleado2,
  ADD CONSTRAINT fk_reparacion_empleado1 FOREIGN KEY (idempleado1) REFERENCES empleados (id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_reparacion_empleado2 FOREIGN KEY (idempleado2) REFERENCES empleados (id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_reparacion_empleado3 FOREIGN KEY (idempleado3) REFERENCES empleados (id) ON DELETE SET NULL;
