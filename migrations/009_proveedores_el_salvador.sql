-- =====================================================
-- MIGRACIÓN 009: MÓDULO PROVEEDORES (El Salvador)
-- Fecha: 2026-09-01
-- Fuente: "nuevas tablas para sistemas (3).xlsx" (sección 21-07-2026)
--         + 4 capturas del sistema actual del cliente
-- Ver: docs/modulo-compras.md sección 11
-- =====================================================
--
-- IMPORTANTE: la tabla `proveedores` que existía era genérica y mexicana
-- (campo `rfc`, `pais DEFAULT 'México'`) y NO se usa en ningún archivo de
-- código. Esta migración la preserva renombrándola a
-- `proveedores_legacy_backup` en lugar de eliminarla.
-- =====================================================


-- =====================================================
-- 1. RESPALDAR LA TABLA ANTERIOR (si existe)
-- =====================================================
-- MySQL no soporta RENAME TABLE IF EXISTS, se resuelve con SQL dinámico.

SET @respaldo_necesario = (
  SELECT COUNT(*)
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'proveedores'
);

SET @ya_respaldada = (
  SELECT COUNT(*)
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'proveedores_legacy_backup'
);

SET @sql_respaldo = IF(
  @respaldo_necesario > 0 AND @ya_respaldada = 0,
  'RENAME TABLE proveedores TO proveedores_legacy_backup',
  'SELECT ''Sin respaldo pendiente'' AS aviso'
);

PREPARE stmt FROM @sql_respaldo;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- =====================================================
-- 2. TABLA PROVEEDORES
-- =====================================================

CREATE TABLE IF NOT EXISTS proveedores (
  idproveedor INT AUTO_INCREMENT PRIMARY KEY,

  -- Identificación
  codigo VARCHAR(20) NOT NULL UNIQUE
    COMMENT 'Código del proveedor. Autogenerado PL#### / PE#### pero editable para admitir los códigos numéricos actuales del cliente',
  tipo_proveedor ENUM('LOCAL','EXTRANJERO') NOT NULL DEFAULT 'LOCAL'
    COMMENT 'Origen del proveedor. Define el prefijo del código: PL local, PE extranjero',
  nombre_legal VARCHAR(200) NOT NULL
    COMMENT 'Nombre legal inscrito en su país',
  nombre_comercial VARCHAR(200) NULL
    COMMENT 'Nombre comercial, a veces distinto del legal',
  alias VARCHAR(60) NULL
    COMMENT 'Alias corto para búsquedas rápidas. Ej: LCR = La Casa del Repuesto',

  -- Dirección principal
  direccion TEXT NULL,
  ciudad VARCHAR(100) NULL,
  -- Dirección secundaria (el sistema actual del cliente maneja 2)
  direccion2 TEXT NULL,
  ciudad2 VARCHAR(100) NULL,
  pais VARCHAR(100) NULL DEFAULT 'EL SALVADOR',

  -- Contacto general de la empresa
  telefono VARCHAR(30) NULL
    COMMENT 'Teléfono principal de oficinas',
  telefono2 VARCHAR(30) NULL
    COMMENT 'Teléfono secundario',
  fax VARCHAR(30) NULL,
  email VARCHAR(150) NULL
    COMMENT 'Correo electrónico principal',
  sitio_web VARCHAR(200) NULL,

  -- Datos fiscales (El Salvador, sin limitar formatos extranjeros)
  nit VARCHAR(30) NULL
    COMMENT 'Número de registro tributario. Admite formatos extranjeros, no solo el NIT salvadoreño',
  nrc VARCHAR(30) NULL
    COMMENT 'Registro fiscal / NRC. Dato típico solo de proveedores nacionales',
  giro VARCHAR(200) NULL
    COMMENT 'Giro o actividad económica',
  categoria_contribuyente ENUM('CONTRIBUYENTE','GRAN_CONTRIBUYENTE','PEQUENO','OTRO')
    NULL DEFAULT 'CONTRIBUYENTE'
    COMMENT 'Categoría de contribuyente. Incide en el cálculo de retenciones en compras',

  -- Clasificación comercial
  que_provee ENUM('PRODUCTO','GASTO','PRODUCTO_Y_GASTO') NOT NULL DEFAULT 'PRODUCTO'
    COMMENT 'Qué provee este proveedor',
  incluir_en_catalogo BOOLEAN NOT NULL DEFAULT FALSE
    COMMENT 'Si sus productos se consideran en el catálogo de productos a ofrecer',

  -- Crédito. saldo_actual y saldo_vencido los alimentará Cuentas por Pagar
  limite_credito_usd DECIMAL(12,2) NOT NULL DEFAULT 0.00
    COMMENT 'Límite de crédito disponible, siempre en dólares',
  dias_credito INT NOT NULL DEFAULT 30
    COMMENT 'Días de crédito por defecto para este proveedor',
  saldo_actual DECIMAL(12,2) NOT NULL DEFAULT 0.00
    COMMENT 'SOLO LECTURA. Lo actualizará el módulo Cuentas por Pagar (aún no existe)',
  saldo_vencido DECIMAL(12,2) NOT NULL DEFAULT 0.00
    COMMENT 'SOLO LECTURA. Lo actualizará el módulo Cuentas por Pagar (aún no existe)',
  moneda VARCHAR(10) NOT NULL DEFAULT 'USD'
    COMMENT 'Moneda habitual de negociación',

  -- Notas
  terminos_comentarios TEXT NULL
    COMMENT 'Términos y comentarios. Campo abierto multilínea',

  -- Estado y auditoría
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_prov_codigo (codigo),
  INDEX idx_prov_nombre_legal (nombre_legal),
  INDEX idx_prov_nombre_comercial (nombre_comercial),
  INDEX idx_prov_alias (alias),
  INDEX idx_prov_nit (nit),
  INDEX idx_prov_tipo (tipo_proveedor),
  INDEX idx_prov_activo (activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Proveedores. Especificación del cliente 21-07-2026 + capturas del sistema actual';


-- =====================================================
-- 3. TABLA PROVEEDOR_CONTACTOS
-- =====================================================
-- El sistema actual muestra 2 contactos fijos, pero el Excel indica
-- "a veces tienen hasta 2 o tres números". Se usa tabla para cubrir ambos
-- casos sin necesidad de migrar otra vez.

CREATE TABLE IF NOT EXISTS proveedor_contactos (
  idcontacto INT AUTO_INCREMENT PRIMARY KEY,
  idproveedor INT NOT NULL,

  orden TINYINT NOT NULL DEFAULT 1
    COMMENT 'Posición del contacto en la ficha (1 y 2 son los que muestra el formulario)',
  nombre VARCHAR(150) NULL,
  puesto_cargo VARCHAR(100) NULL,
  telefono VARCHAR(30) NULL,
  movil VARCHAR(30) NULL,
  email VARCHAR(150) NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_contactos_proveedor
    FOREIGN KEY (idproveedor) REFERENCES proveedores(idproveedor)
    ON DELETE CASCADE ON UPDATE CASCADE,

  INDEX idx_contacto_proveedor (idproveedor),
  INDEX idx_contacto_orden (idproveedor, orden)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Contactos de cada proveedor';


-- =====================================================
-- 4. TABLA CUENTAS_BANCARIAS
-- =====================================================
-- Regla del cliente: "Un mismo proveedor o cliente puede tener muchas
-- cuentas diferentes, por eso debe ser una tabla que las registre y vincule".
-- Se usan dos FK nullables en vez de un vínculo polimórfico, para conservar
-- integridad referencial real.

CREATE TABLE IF NOT EXISTS cuentas_bancarias (
  idcuenta INT AUTO_INCREMENT PRIMARY KEY,

  idproveedor INT NULL
    COMMENT 'FK a proveedores. Se llena si la cuenta pertenece a un proveedor',
  idcliente INT NULL
    COMMENT 'FK a clientes. Reservado: la tabla clientes usa otra estructura, se activará al integrar ese módulo',

  numero_cuenta VARCHAR(60) NOT NULL
    COMMENT 'Texto, no numérico: hay países que usan letras y separadores',
  beneficiario VARCHAR(200) NULL
    COMMENT 'Nombre de la empresa según está registrado en su banco',
  direccion_beneficiario TEXT NULL,

  banco VARCHAR(200) NULL,
  direccion_banco TEXT NULL,

  codigo_aba VARCHAR(30) NULL
    COMMENT 'Routing number ABA. Casi exclusivo de USA',
  codigo_swift VARCHAR(30) NULL
    COMMENT 'Código SWIFT / BIC. Uso mundial',
  codigo_iban VARCHAR(60) NULL
    COMMENT 'IBAN. Suele ser el número de cuenta con caracteres antepuestos',

  moneda VARCHAR(20) NULL
    COMMENT 'Moneda en que se recibe dinero en la cuenta',
  comentarios TEXT NULL
    COMMENT 'Comentarios e instrucciones. Texto abierto',

  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_cuentas_proveedor
    FOREIGN KEY (idproveedor) REFERENCES proveedores(idproveedor)
    ON DELETE CASCADE ON UPDATE CASCADE,

  -- Debe pertenecer a un proveedor o a un cliente, no a ambos ni a ninguno
  CONSTRAINT chk_cuenta_titular
    CHECK (
      (idproveedor IS NOT NULL AND idcliente IS NULL)
      OR (idproveedor IS NULL AND idcliente IS NOT NULL)
    ),

  INDEX idx_cuenta_proveedor (idproveedor),
  INDEX idx_cuenta_cliente (idcliente),
  INDEX idx_cuenta_numero (numero_cuenta),
  INDEX idx_cuenta_activo (activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Cuentas bancarias de proveedores y clientes. Un titular puede tener varias';


-- =====================================================
-- 5. VISTA DE CONSULTA
-- =====================================================

CREATE OR REPLACE VIEW v_proveedores_resumen AS
SELECT
  p.idproveedor,
  p.codigo,
  p.tipo_proveedor,
  p.nombre_legal,
  p.nombre_comercial,
  p.alias,
  p.pais,
  p.ciudad,
  p.telefono,
  p.email,
  p.nit,
  p.nrc,
  p.giro,
  p.categoria_contribuyente,
  p.que_provee,
  p.incluir_en_catalogo,
  p.limite_credito_usd,
  p.saldo_actual,
  p.saldo_vencido,
  p.activo,
  (SELECT COUNT(*) FROM proveedor_contactos c
    WHERE c.idproveedor = p.idproveedor)         AS total_contactos,
  (SELECT COUNT(*) FROM cuentas_bancarias b
    WHERE b.idproveedor = p.idproveedor
      AND b.activo = TRUE)                       AS total_cuentas
FROM proveedores p;


-- =====================================================
-- FIN DE MIGRACIÓN 009
-- =====================================================
--
-- PENDIENTE / A CONFIRMAR CON EL CLIENTE:
--   1. Formato del código: la captura muestra "275" (numérico) pero el Excel
--      pide "PE0001"/"PL0005". Se implementó el tipado con override manual.
--   2. saldo_actual y saldo_vencido quedan en 0 hasta que exista el módulo
--      Cuentas por Pagar.
--   3. La tabla estructurada de direcciones (calle/número/ciudad/estado/país)
--      que sugiere el Excel quedó diferida: el cliente usa 2 direcciones libres.
--   4. cuentas_bancarias.idcliente no tiene FK todavía porque la tabla
--      `clientes` existente usa otra estructura de claves. Se agregará al
--      integrar el módulo de clientes.
-- =====================================================

SELECT 'Migración 009 completada - Módulo Proveedores (El Salvador)' AS status;
