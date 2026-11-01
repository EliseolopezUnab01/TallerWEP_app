-- La tabla categorias (códigos de texto: MOTOR, FRENOS…) quedó reemplazada
-- por categorias_nuevo. Ningún producto apuntaba a sus 9 filas.
-- productos.idcategoria se conserva: guarda códigos de importación que no
-- coinciden con ninguna de las dos tablas.

DROP TABLE IF EXISTS categorias;
