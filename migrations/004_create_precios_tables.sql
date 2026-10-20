-- Tabla: precios
-- Almacena los 7 tipos de precios para cada producto
CREATE TABLE IF NOT EXISTS precios (
  idprod INT PRIMARY KEY,
  precio_manual DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Precio manual si el usuario lo establece',
  precio_pvr DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Precio PVR (Precio de Venta Recomendado)',
  precio_lcl DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Precio LCL',
  precio_general DECIMAL(10,2) DEFAULT 0.00 COMMENT 'GENERAL, ALTO. Precio más alto',
  precio_cliente DECIMAL(10,2) DEFAULT 0.00 COMMENT 'CLIENTE. Persona que ya ha rentado algo y nos prefiere',
  precio_mecanico DECIMAL(10,2) DEFAULT 0.00 COMMENT 'MECÁNICO o MINORISTA. Quien compra muy poco y no es cuando siempre en compras menores',
  precio_minorista DECIMAL(10,2) DEFAULT 0.00 COMMENT 'MAYORISTA. Quien compra por montos considerables',
  precio_mayorista DECIMAL(10,2) DEFAULT 0.00 COMMENT 'MAYORISTA (con contrato). Muy conocida que contrata sin regatear',
  precio_especial DECIMAL(10,2) DEFAULT 0.00 COMMENT 'ESPECIAL. Valor de control que indica el precio mínimo al que se puede vender un producto sin perderle a la venta',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (idprod) REFERENCES productos(idprod) ON DELETE CASCADE,
  INDEX idx_precios_idprod (idprod)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla: ajuste_precios
-- Historial de ajustes de precios
CREATE TABLE IF NOT EXISTS ajuste_precios (
  idajuste INT AUTO_INCREMENT PRIMARY KEY,
  idusuario INT COMMENT 'Identificador del usuario que cambia o ajusta un precio',
  idprod INT COMMENT 'Identificador del producto que recibe el cambio',
  fecha DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha del ajuste',
  razon_justificacion TEXT COMMENT 'Razón o justificación del porqué cambió el precio',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (idprod) REFERENCES productos(idprod) ON DELETE CASCADE,
  INDEX idx_ajuste_precios_idprod (idprod),
  INDEX idx_ajuste_precios_fecha (fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
