-- =====================================================
-- MIGRACIÓN 014: ID GLOBAL DE DOCUMENTOS (NODOCTO) Y CORRELATIVOS
-- Fecha: 2026-10-16
-- Fuente: respuestas del cliente (docs/fuentes/preguntas-importantes_extraido.txt)
--         y Word "Modulo Compras actualizado" (control 2)
-- =====================================================
--
-- nodocto: ID interno único para cualquier documento (compras, ventas,
-- cotizaciones, DUCA...). Formato AA + 6 dígitos, ej. 26000001.
-- Además cada tipo tiene un número visible para el usuario (CP26-000001,
-- IMP-2026-00001...). Ambos salen de la tabla `correlativos`.
-- `compras` y `compras_detalle` no se recrean: solo se agregan columnas.
-- =====================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS correlativos (
  tipo VARCHAR(20) NOT NULL
    COMMENT 'NODOCTO = ID global; CP, CI, SC, CT, OC, PF, IMP, PT, VH = números visibles por tipo',
  anio SMALLINT NOT NULL
    COMMENT 'Año del correlativo. Cada año reinicia en 1',
  ultimo INT NOT NULL DEFAULT 0
    COMMENT 'Último número entregado',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (tipo, anio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Control de correlativos de documentos (equivalente a la tabla de control de Fox)';

ALTER TABLE compras
  ADD COLUMN nodocto BIGINT NULL
    COMMENT 'ID global del documento. AA + 6 dígitos' AFTER idcompra,
  ADD COLUMN numero_interno VARCHAR(20) NULL
    COMMENT 'Número visible por tipo: CP (compra nacional) o CI (compra de importación)' AFTER nodocto,
  ADD COLUMN clase_documento ENUM('DTE','IMPORTACION') NOT NULL DEFAULT 'DTE'
    COMMENT 'DTE = compra nacional con documento electrónico; IMPORTACION = factura de proveedor extranjero' AFTER estado,
  ADD COLUMN categoria_operacion ENUM('FISCAL','GASTO','MIXTO') NOT NULL DEFAULT 'FISCAL'
    COMMENT 'Control 2. Informativo para contabilidad. GASTO bloquea destinos INVENTARIO y EXPRESS' AFTER clase_documento,
  ADD COLUMN idproceso INT NULL
    COMMENT 'Proceso de ingreso al que pertenece (importaciones)' AFTER idproveedor,
  ADD UNIQUE KEY uq_compras_nodocto (nodocto),
  ADD UNIQUE KEY uq_compras_numero_interno (numero_interno),
  ADD KEY idx_compras_proceso (idproceso);

-- Las compras existentes reciben nodocto y número interno en orden de creación.
SET @n := 0;
UPDATE compras
SET nodocto = (YEAR(created_at) MOD 100) * 1000000 + (@n := @n + 1),
    numero_interno = CONCAT('CP', LPAD(YEAR(created_at) MOD 100, 2, '0'), '-', LPAD(@n, 6, '0'))
WHERE nodocto IS NULL
ORDER BY idcompra;

INSERT INTO correlativos (tipo, anio, ultimo)
SELECT 'NODOCTO', 2026, COUNT(*) FROM compras
ON DUPLICATE KEY UPDATE ultimo = GREATEST(ultimo, VALUES(ultimo));

INSERT INTO correlativos (tipo, anio, ultimo)
SELECT 'CP', 2026, COUNT(*) FROM compras
ON DUPLICATE KEY UPDATE ultimo = GREATEST(ultimo, VALUES(ultimo));

ALTER TABLE catalogo_contable
  ADD COLUMN codigo_oficial VARCHAR(30) NULL
    COMMENT 'Código oficial (Hacienda o norma contable), si existe' AFTER cuenta_contable;

CREATE TABLE IF NOT EXISTS ruta_archivos (
  idarchivo INT AUTO_INCREMENT PRIMARY KEY,
  nodocto BIGINT NULL
    COMMENT 'Documento al que pertenece el archivo. Un documento puede tener varios',
  entidad VARCHAR(30) NULL
    COMMENT 'Para registros que no son documentos: VEHICULO, PRODUCTO_TEMPORAL...',
  identidad INT NULL
    COMMENT 'ID del registro de la entidad',
  ruta VARCHAR(500) NOT NULL
    COMMENT 'Ruta pública del archivo',
  nombre_original VARCHAR(255) NULL,
  tipo_archivo VARCHAR(80) NULL
    COMMENT 'Tipo MIME o etiqueta (TARJETA, DUCA, FACTURA...)',
  descripcion VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_ruta_nodocto (nodocto),
  KEY idx_ruta_entidad (entidad, identidad)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Archivos vinculados a documentos o registros del sistema';

CREATE TABLE IF NOT EXISTS esquemas_dte (
  nodocto BIGINT PRIMARY KEY
    COMMENT 'Documento interno al que corresponde el JSON',
  codigo_generacion VARCHAR(36) NULL,
  tipo_dte VARCHAR(2) NULL
    COMMENT 'Código CAT-002 (01, 03, 05...)',
  tipo_movimiento ENUM('COMPRA','VENTA') NOT NULL DEFAULT 'COMPRA',
  version SMALLINT NULL
    COMMENT 'identificacion.version del JSON de Hacienda',
  esquema_json LONGTEXT NOT NULL
    COMMENT 'JSON completo recibido o emitido. Respaldo documental',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_esquemas_codigo (codigo_generacion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='JSON completo de cada DTE de compra o venta, con su versión';
