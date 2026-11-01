-- 019: datos de la empresa que usa el sistema (antes en NEXT_PUBLIC_EMPRESA_*).
-- Una fila activa. La clave de la API de Hacienda y la del certificado van en .env.local.

CREATE TABLE IF NOT EXISTS empresa (
  idempresa INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(250) NOT NULL COMMENT 'Razón social',
  nombre_comercial VARCHAR(150) NULL,
  nit VARCHAR(14) NULL COMMENT 'Sin guiones',
  nrc VARCHAR(8) NULL COMMENT 'Sin guiones',
  cod_actividad VARCHAR(6) NULL COMMENT 'CAT-019',
  desc_actividad VARCHAR(150) NULL,
  departamento CHAR(2) NULL COMMENT 'CAT-012',
  municipio CHAR(2) NULL COMMENT 'CAT-013',
  direccion VARCHAR(200) NULL COMMENT 'Complemento de la dirección',
  telefono VARCHAR(30) NULL,
  correo VARCHAR(100) NULL,
  categoria_contribuyente ENUM('GRAN_CONTRIBUYENTE','CONTRIBUYENTE','PEQUENO','OTRO') NOT NULL DEFAULT 'OTRO'
    COMMENT 'Igual que en proveedores; CONTRIBUYENTE = mediano',
  agente_retencion TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Designado por Hacienda para retener 1% de IVA',
  descuento_modo ENUM('INFORMATIVO','COSTO') NOT NULL DEFAULT 'INFORMATIVO'
    COMMENT 'Valor por defecto de compras.descuento_afecta_costo',
  -- Hacienda (facturación electrónica)
  dte_ambiente CHAR(2) NOT NULL DEFAULT '00' COMMENT '00 pruebas, 01 producción',
  dte_usuario_api VARCHAR(30) NULL COMMENT 'Usuario de la API (normalmente el NIT)',
  tipo_establecimiento CHAR(2) NOT NULL DEFAULT '02' COMMENT 'CAT-009: 01 sucursal, 02 casa matriz, 04 bodega, 07 patio',
  cod_estable_mh CHAR(4) NULL COMMENT 'Código de establecimiento asignado por Hacienda',
  cod_estable VARCHAR(10) NULL COMMENT 'Código interno del establecimiento',
  cod_punto_venta_mh CHAR(4) NULL,
  cod_punto_venta VARCHAR(15) NULL,
  prefijo_control CHAR(8) NOT NULL DEFAULT 'M001P001' COMMENT 'Parte central del número de control DTE-XX-????????-correlativo',
  responsable_nombre VARCHAR(100) NULL COMMENT 'Responsable por defecto en las invalidaciones',
  responsable_tipo_doc CHAR(2) NULL COMMENT 'CAT-022',
  responsable_num_doc VARCHAR(20) NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO empresa (nombre, categoria_contribuyente, descuento_modo)
SELECT 'Taller', 'OTRO', 'INFORMATIVO' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM empresa);
