-- El stock inicial y las correcciones entran por un documento, no por la ficha del producto.

CREATE TABLE IF NOT EXISTS ajustes_inventario (
  idajuste INT AUTO_INCREMENT PRIMARY KEY,
  numero VARCHAR(20) NOT NULL,
  fecha DATE NOT NULL,
  motivo VARCHAR(200) NOT NULL,
  idusuario INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ajuste_numero (numero),
  CONSTRAINT fk_ajuste_usuario FOREIGN KEY (idusuario) REFERENCES usuarios (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Documento que mueve stock contable y fisico fuera de una compra';

CREATE TABLE IF NOT EXISTS ajustes_inventario_detalle (
  iddetalle INT AUTO_INCREMENT PRIMARY KEY,
  idajuste INT NOT NULL,
  idprod INT NOT NULL,
  cantidad_contable DECIMAL(14,4) NOT NULL DEFAULT 0,
  cantidad_fisico DECIMAL(14,4) NOT NULL DEFAULT 0,
  stock_contable_antes DECIMAL(14,4) NOT NULL,
  stock_fisico_antes DECIMAL(14,4) NOT NULL,
  CONSTRAINT fk_ajustedet_ajuste FOREIGN KEY (idajuste) REFERENCES ajustes_inventario (idajuste) ON DELETE CASCADE,
  CONSTRAINT fk_ajustedet_producto FOREIGN KEY (idprod) REFERENCES productos (idprod)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
