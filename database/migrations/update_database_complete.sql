-- =====================================================
-- MIGRACIÓN COMPLETA - SISTEMA TALLER WEB
-- Actualización de base de datos según especificaciones del cliente
-- =====================================================

-- =====================================================
-- 1. ACTUALIZAR TABLA PRODUCTOS (Agregar campos faltantes)
-- =====================================================

-- Precios múltiples
ALTER TABLE productos ADD COLUMN IF NOT EXISTS precio_manual DECIMAL(10,2) DEFAULT 0 COMMENT 'Precio manual';
ALTER TABLE productos ADD COLUMN IF NOT EXISTS precio_pvr DECIMAL(10,2) DEFAULT 0 COMMENT 'Precio PVR';
ALTER TABLE productos ADD COLUMN IF NOT EXISTS precio_lcl DECIMAL(10,2) DEFAULT 0 COMMENT 'Precio LCL';
ALTER TABLE productos ADD COLUMN IF NOT EXISTS precio_general DECIMAL(10,2) DEFAULT 0 COMMENT 'Precio general';
ALTER TABLE productos ADD COLUMN IF NOT EXISTS precio_cliente DECIMAL(10,2) DEFAULT 0 COMMENT 'Precio cliente';
ALTER TABLE productos ADD COLUMN IF NOT EXISTS precio_mecanico DECIMAL(10,2) DEFAULT 0 COMMENT 'Precio mecánico';
ALTER TABLE productos ADD COLUMN IF NOT EXISTS precio_minorista DECIMAL(10,2) DEFAULT 0 COMMENT 'Precio minorista';
ALTER TABLE productos ADD COLUMN IF NOT EXISTS precio_mayorista DECIMAL(10,2) DEFAULT 0 COMMENT 'Precio mayorista';
ALTER TABLE productos ADD COLUMN IF NOT EXISTS precio_especial DECIMAL(10,2) DEFAULT 0 COMMENT 'Precio especial';

-- Información adicional del producto
ALTER TABLE productos ADD COLUMN IF NOT EXISTS serie VARCHAR(100) COMMENT 'Serie del producto';
ALTER TABLE productos ADD COLUMN IF NOT EXISTS tipo VARCHAR(100) COMMENT 'Tipo de producto';
ALTER TABLE productos ADD COLUMN IF NOT EXISTS grupo VARCHAR(100) COMMENT 'Grupo del producto';
ALTER TABLE productos ADD COLUMN IF NOT EXISTS subgrupo VARCHAR(100) COMMENT 'Subgrupo del producto';
ALTER TABLE productos ADD COLUMN IF NOT EXISTS aplicacion_marcas TEXT COMMENT 'Marcas compatibles (RENAULT|MERCEDES|VOLVO)';
ALTER TABLE productos ADD COLUMN IF NOT EXISTS aplicacion_modelos TEXT COMMENT 'Modelos compatibles';
ALTER TABLE productos ADD COLUMN IF NOT EXISTS criterios TEXT COMMENT 'Criterios adicionales (Peso, etc)';

-- Costos y márgenes
ALTER TABLE productos ADD COLUMN IF NOT EXISTS costo DECIMAL(10,2) DEFAULT 0 COMMENT 'Costo del producto';
ALTER TABLE productos ADD COLUMN IF NOT EXISTS aplica_imp BOOLEAN DEFAULT false COMMENT 'Aplica impuesto (IVA)';
ALTER TABLE productos ADD COLUMN IF NOT EXISTS utilidad DECIMAL(10,2) DEFAULT 0 COMMENT 'Porcentaje de utilidad';
ALTER TABLE productos ADD COLUMN IF NOT EXISTS descuento DECIMAL(10,2) DEFAULT 0 COMMENT 'Descuento aplicable';
ALTER TABLE productos ADD COLUMN IF NOT EXISTS descuento_maximo DECIMAL(10,2) DEFAULT 0 COMMENT 'Descuento máximo permitido';

-- Días de entrega
ALTER TABLE productos ADD COLUMN IF NOT EXISTS dias_entrega INT DEFAULT 0 COMMENT 'Días de entrega estimados';

-- =====================================================
-- 2. CREAR TABLA REFERENCIAS OEM (Referencias cruzadas)
-- =====================================================

CREATE TABLE IF NOT EXISTS referencias_oem (
  id INT AUTO_INCREMENT PRIMARY KEY,
  idprod INT NOT NULL,
  fabricante VARCHAR(100) NOT NULL COMMENT 'Fabricante (DAF, IVECO, MAN, MERCEDES, VOLVO, etc)',
  codigo VARCHAR(100) NOT NULL COMMENT 'Código de referencia',
  tipo ENUM('OEM', 'EQUIVALENTE', 'SUSTITUYE') DEFAULT 'OEM' COMMENT 'Tipo de referencia',
  notas TEXT COMMENT 'Notas adicionales',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (idprod) REFERENCES productos(idprod) ON DELETE CASCADE,
  INDEX idx_producto (idprod),
  INDEX idx_fabricante (fabricante),
  INDEX idx_codigo (codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Referencias OEM y equivalencias de productos';

-- =====================================================
-- 3. CREAR TABLA UBICACIONES PRODUCTO (Ubicaciones en almacén)
-- =====================================================

CREATE TABLE IF NOT EXISTS ubicaciones_producto (
  id INT AUTO_INCREMENT PRIMARY KEY,
  idprod INT NOT NULL,
  codigo_ubicacion VARCHAR(50) NOT NULL COMMENT 'Código de ubicación (E9-A6, etc)',
  stock INT DEFAULT 0 COMMENT 'Stock en esta ubicación',
  descripcion VARCHAR(200) COMMENT 'Descripción de la ubicación',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (idprod) REFERENCES productos(idprod) ON DELETE CASCADE,
  INDEX idx_producto (idprod),
  INDEX idx_ubicacion (codigo_ubicacion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Ubicaciones físicas de productos en almacén';

-- =====================================================
-- 4. CREAR TABLA CLIENTES
-- =====================================================

CREATE TABLE IF NOT EXISTS clientes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(50) UNIQUE NOT NULL COMMENT 'Código único del cliente',
  nombre VARCHAR(200) NOT NULL COMMENT 'Nombre o razón social',
  tipo ENUM('PERSONA', 'EMPRESA') DEFAULT 'PERSONA',
  rfc VARCHAR(20) COMMENT 'RFC o identificación fiscal',
  
  -- Contacto
  telefono VARCHAR(50),
  telefono2 VARCHAR(50),
  email VARCHAR(100),
  direccion TEXT,
  ciudad VARCHAR(100),
  estado VARCHAR(100),
  codigo_postal VARCHAR(10),
  
  -- Información comercial
  limite_credito DECIMAL(10,2) DEFAULT 0,
  dias_credito INT DEFAULT 0,
  descuento_general DECIMAL(5,2) DEFAULT 0,
  
  -- Estado
  activo BOOLEAN DEFAULT true,
  notas TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_codigo (codigo),
  INDEX idx_nombre (nombre),
  INDEX idx_activo (activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Clientes del taller';

-- =====================================================
-- 5. CREAR TABLA VEHÍCULOS
-- =====================================================

CREATE TABLE IF NOT EXISTS vehiculos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id INT NOT NULL,
  
  -- Identificación del vehículo
  matricula VARCHAR(50) UNIQUE COMMENT 'Placa o matrícula',
  vin VARCHAR(50) COMMENT 'Número de serie/VIN',
  
  -- Información básica
  marca VARCHAR(100) NOT NULL,
  modelo VARCHAR(100) NOT NULL,
  año INT,
  tipo VARCHAR(100) COMMENT 'Tipo de vehículo (Camión, Auto, etc)',
  color VARCHAR(50),
  
  -- Especificaciones
  capacidad VARCHAR(50) COMMENT 'Capacidad de carga',
  numero_motor VARCHAR(100),
  numero_chasis VARCHAR(100),
  
  -- Odómetro
  odometro_actual INT DEFAULT 0,
  unidad_odometro ENUM('KM', 'MILLAS') DEFAULT 'KM',
  
  -- Estado
  activo BOOLEAN DEFAULT true,
  notas TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
  INDEX idx_cliente (cliente_id),
  INDEX idx_matricula (matricula),
  INDEX idx_marca_modelo (marca, modelo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Vehículos de los clientes';

-- =====================================================
-- 6. CREAR TABLA ÓRDENES DE TRABAJO
-- =====================================================

CREATE TABLE IF NOT EXISTS ordenes_trabajo (
  id INT AUTO_INCREMENT PRIMARY KEY,
  numero_orden VARCHAR(50) UNIQUE NOT NULL COMMENT 'Número de orden único',
  comando VARCHAR(50) COMMENT 'Comando o referencia interna',
  
  -- Relaciones
  cliente_id INT NOT NULL,
  vehiculo_id INT NOT NULL,
  
  -- Información del conductor/asegurado
  conductor_nombre VARCHAR(200),
  conductor_telefono VARCHAR(50),
  conductor_telefono2 VARCHAR(50),
  
  -- Odómetro
  odometro_inicial INT,
  odometro_final INT,
  fecha_inicial DATE,
  fecha_final DATE,
  parcial VARCHAR(50),
  
  -- Estado y tipo
  estado ENUM('PROCESO', 'FINALIZADA', 'ESPERA', 'CANCELADA') DEFAULT 'PROCESO',
  tipo_servicio ENUM('MANTENIMIENTO', 'REPARACION', 'DIAGNOSTICO', 'OTRO') DEFAULT 'REPARACION',
  prioridad ENUM('BAJA', 'MEDIA', 'ALTA', 'URGENTE') DEFAULT 'MEDIA',
  
  -- Descripción
  reparaciones_solicitadas TEXT COMMENT 'Fallas reportadas por el cliente',
  reparaciones_realizadas TEXT COMMENT 'Trabajos realizados',
  comentarios TEXT COMMENT 'Comentarios generales',
  notas_internas TEXT COMMENT 'Notas internas del taller',
  
  -- Costos
  costo_mano_obra DECIMAL(10,2) DEFAULT 0,
  costo_repuestos DECIMAL(10,2) DEFAULT 0,
  costo_total DECIMAL(10,2) DEFAULT 0,
  
  -- Fechas
  fecha_recepcion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_compromiso TIMESTAMP NULL,
  fecha_entrega TIMESTAMP NULL,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (cliente_id) REFERENCES clientes(id),
  FOREIGN KEY (vehiculo_id) REFERENCES vehiculos(id),
  INDEX idx_numero_orden (numero_orden),
  INDEX idx_cliente (cliente_id),
  INDEX idx_vehiculo (vehiculo_id),
  INDEX idx_estado (estado),
  INDEX idx_fecha_recepcion (fecha_recepcion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Órdenes de trabajo del taller';

-- =====================================================
-- 7. CREAR TABLA ORDEN MOTOR (Detalles del motor)
-- =====================================================

CREATE TABLE IF NOT EXISTS orden_motor (
  id INT AUTO_INCREMENT PRIMARY KEY,
  orden_id INT NOT NULL,
  
  -- Información del motor
  marca VARCHAR(100),
  numero_motor VARCHAR(100),
  tipo VARCHAR(100),
  lineal_4_line VARCHAR(50),
  combustible ENUM('Diesel', 'Gasolina', 'Eléctrico', 'Híbrido', 'GLP', 'GNC'),
  admision VARCHAR(50),
  escape VARCHAR(50),
  
  -- Ajustes y tolerancias
  ajustes_tolerancias TEXT,
  
  -- Estado del motor
  estado_motor TEXT COMMENT 'Descripción del estado actual',
  
  -- Especificaciones técnicas
  grad_iny VARCHAR(50) COMMENT 'Grado de inyección',
  preinyeccion VARCHAR(50),
  inyeccion VARCHAR(50),
  tor_culata VARCHAR(50) COMMENT 'Torque de culata',
  tq_biela VARCHAR(50) COMMENT 'Torque de biela',
  tq_banco VARCHAR(50) COMMENT 'Torque de banco',
  
  -- Correas/Fajas/Bandas (JSON)
  correas_fajas JSON COMMENT 'Array de correas: [{referencia, posicion, estado, revision, responsable, fecha}]',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (orden_id) REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
  INDEX idx_orden (orden_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Detalles técnicos del motor en órdenes de trabajo';

-- =====================================================
-- 8. CREAR TABLA ORDEN FILTROS Y LUBRICANTES
-- =====================================================

CREATE TABLE IF NOT EXISTS orden_filtros_lubes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  orden_id INT NOT NULL,
  
  -- Filtros
  aceite_motor VARCHAR(100),
  aceite_motor2 VARCHAR(100),
  combustible VARCHAR(100),
  combustible2 VARCHAR(100),
  combustible3 VARCHAR(100),
  aire VARCHAR(100),
  aire2 VARCHAR(100),
  aire_ac_polen VARCHAR(100),
  refrigerante VARCHAR(100),
  transmision VARCHAR(100),
  diferencial VARCHAR(100),
  direccion_hid VARCHAR(100),
  clutch_frenos VARCHAR(100),
  
  -- Capacidades y fechas
  capacidad_gal DECIMAL(10,2) COMMENT 'Capacidad en galones',
  ultimo_cambio DATE,
  sig_cambio DATE,
  
  -- Otros sistemas (JSON)
  otros_sistemas JSON COMMENT 'Array de otros sistemas: [{nombre, cadenas, sist_hidra, sist_hidra2, sist_volteo}]',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (orden_id) REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
  INDEX idx_orden (orden_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Filtros y lubricantes en órdenes de trabajo';

-- =====================================================
-- 9. CREAR TABLA ORDEN TRACCIÓN
-- =====================================================

CREATE TABLE IF NOT EXISTS orden_traccion (
  id INT AUTO_INCREMENT PRIMARY KEY,
  orden_id INT NOT NULL,
  
  -- Diferencial
  diferencial_marca VARCHAR(100),
  diferencial_ratio VARCHAR(50),
  diferencial_modelo VARCHAR(100),
  diferencial_serie VARCHAR(100),
  diferencial_config VARCHAR(50),
  
  -- Transmisión
  transmision_marca VARCHAR(100),
  transmision_modelo VARCHAR(100),
  transmision_tipo ENUM('Automatica', 'Manual'),
  transmision_config VARCHAR(50),
  transmision_serie VARCHAR(100),
  transmision_veloc VARCHAR(50),
  
  -- Shaft Cardan (JSON)
  shaft_cardan JSON COMMENT 'Array de shaft cardan: [{nombre, medidas, cruzeta1, cruzeta2, estado, revision, responsable, fecha}]',
  
  -- Eje Frontal
  eje_frontal_marca VARCHAR(100),
  eje_frontal_ratio VARCHAR(50),
  eje_frontal_modelo VARCHAR(100),
  eje_frontal_serie VARCHAR(100),
  eje_frontal_config VARCHAR(50),
  
  comentarios TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (orden_id) REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
  INDEX idx_orden (orden_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Sistema de tracción en órdenes de trabajo';

-- =====================================================
-- 10. CREAR TABLA ORDEN CHASIS Y ELÉCTRICO
-- =====================================================

CREATE TABLE IF NOT EXISTS orden_chasis_electrico (
  id INT AUTO_INCREMENT PRIMARY KEY,
  orden_id INT NOT NULL,
  
  -- Chasis (JSON para arrays)
  suspension_delantera JSON COMMENT 'Array de componentes de suspensión delantera',
  suspension_trasera JSON COMMENT 'Array de componentes de suspensión trasera',
  amortiguadores_traseros JSON COMMENT 'Array de amortiguadores traseros',
  amortiguadores_delanteros JSON COMMENT 'Array de amortiguadores delanteros',
  chasis VARCHAR(100),
  cama_carga VARCHAR(100),
  
  -- Eléctrico
  codigos_fallas TEXT COMMENT 'Códigos de fallas detectados',
  motor_arranque VARCHAR(100),
  baterias VARCHAR(100),
  alternador VARCHAR(100),
  luces_carretera VARCHAR(100),
  luces_direccionales VARCHAR(100),
  luces_freno VARCHAR(100),
  luces_retroceso VARCHAR(100),
  luces_emergencia VARCHAR(100),
  luces_posicion_cortecia VARCHAR(100),
  
  comentarios TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (orden_id) REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
  INDEX idx_orden (orden_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Chasis y sistema eléctrico en órdenes de trabajo';

-- =====================================================
-- 11. CREAR TABLA ORDEN FRENOS, CLUTCH Y DIRECCIÓN
-- =====================================================

CREATE TABLE IF NOT EXISTS orden_frenos_clutch (
  id INT AUTO_INCREMENT PRIMARY KEY,
  orden_id INT NOT NULL,
  
  -- Clutch/Embrague
  clutch_cilindro_maestro VARCHAR(100),
  clutch_cilindro_esclavo VARCHAR(100),
  clutch_equipo_embrague VARCHAR(100),
  
  -- Frenos
  frenos_delantero VARCHAR(100),
  frenos_trasero VARCHAR(100),
  frenos_mano VARCHAR(100),
  frenos_valvula_central VARCHAR(100),
  frenos_otras_valvulas VARCHAR(100),
  
  -- Dirección
  direccion_cruzeta VARCHAR(100),
  direccion_caja_direccional VARCHAR(100),
  direccion_power_steering VARCHAR(100),
  direccion_barras_terminales VARCHAR(100),
  
  comentarios TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (orden_id) REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
  INDEX idx_orden (orden_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Frenos, clutch y dirección en órdenes de trabajo';

-- =====================================================
-- 12. CREAR TABLA ORDEN REPARACIONES (Detalle de trabajos)
-- =====================================================

CREATE TABLE IF NOT EXISTS orden_reparaciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  orden_id INT NOT NULL,
  tipo ENUM('SOLICITADA', 'REALIZADA') NOT NULL COMMENT 'Tipo de reparación',
  
  -- Estado
  estado ENUM('PROCESO', 'FINALIZADA', 'ESPERA', 'CANCELADA') DEFAULT 'PROCESO',
  
  -- Detalle del trabajo
  cantidad INT DEFAULT 1,
  codigo_servicio VARCHAR(50),
  accion VARCHAR(200) COMMENT 'Acción a realizar (REPARAR, INSTALAR, etc)',
  tarea_actividad TEXT COMMENT 'Descripción detallada de la tarea',
  
  -- Empleados asignados
  empleado1 VARCHAR(100),
  empleado2 VARCHAR(100),
  empleado3 VARCHAR(100),
  
  -- Tiempo estimado/real
  dias INT DEFAULT 0,
  horas DECIMAL(5,2) DEFAULT 0,
  
  -- Costo
  precio_unitario DECIMAL(10,2) DEFAULT 0,
  precio_total DECIMAL(10,2) DEFAULT 0,
  
  -- Fechas
  fecha_inicio TIMESTAMP NULL,
  fecha_fin TIMESTAMP NULL,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (orden_id) REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
  INDEX idx_orden (orden_id),
  INDEX idx_tipo (tipo),
  INDEX idx_estado (estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Detalle de reparaciones en órdenes de trabajo';

-- =====================================================
-- 13. CREAR TABLA EMPLEADOS
-- =====================================================

CREATE TABLE IF NOT EXISTS empleados (
  id INT AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(50) UNIQUE NOT NULL COMMENT 'Código único del empleado',
  
  -- Información personal
  nombre VARCHAR(100) NOT NULL,
  apellido VARCHAR(100) NOT NULL,
  fecha_nacimiento DATE,
  rfc VARCHAR(20),
  curp VARCHAR(20),
  nss VARCHAR(20),
  
  -- Contacto
  telefono VARCHAR(50),
  telefono2 VARCHAR(50),
  email VARCHAR(100),
  direccion TEXT,
  ciudad VARCHAR(100),
  estado VARCHAR(100),
  codigo_postal VARCHAR(10),
  
  -- Información laboral
  puesto VARCHAR(100),
  departamento VARCHAR(100),
  fecha_ingreso DATE,
  fecha_baja DATE NULL,
  salario DECIMAL(10,2),
  tipo_contrato ENUM('PLANTA', 'TEMPORAL', 'HONORARIOS') DEFAULT 'PLANTA',
  
  -- Estado
  activo BOOLEAN DEFAULT true,
  notas TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_codigo (codigo),
  INDEX idx_nombre (nombre, apellido),
  INDEX idx_activo (activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Empleados del taller';

-- =====================================================
-- 14. CREAR TABLA PROVEEDORES
-- =====================================================

CREATE TABLE IF NOT EXISTS proveedores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(50) UNIQUE NOT NULL COMMENT 'Código único del proveedor',
  nombre VARCHAR(200) NOT NULL COMMENT 'Nombre o razón social',
  
  -- Contacto
  contacto_nombre VARCHAR(100),
  telefono VARCHAR(50),
  telefono2 VARCHAR(50),
  email VARCHAR(100),
  sitio_web VARCHAR(200),
  
  -- Dirección
  direccion TEXT,
  ciudad VARCHAR(100),
  estado VARCHAR(100),
  pais VARCHAR(100) DEFAULT 'México',
  codigo_postal VARCHAR(10),
  
  -- Información fiscal
  rfc VARCHAR(20),
  
  -- Condiciones comerciales
  dias_credito INT DEFAULT 0,
  descuento_general DECIMAL(5,2) DEFAULT 0,
  
  -- Estado
  activo BOOLEAN DEFAULT true,
  notas TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_codigo (codigo),
  INDEX idx_nombre (nombre),
  INDEX idx_activo (activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Proveedores de repuestos y servicios';

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================

-- Mensaje de confirmación
SELECT 'Migración completada exitosamente' AS status;
