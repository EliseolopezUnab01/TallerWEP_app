-- =====================================================
-- MIGRACIÓN 017: PULIDO DEL MÓDULO DE COMPRAS
-- Fecha: 2026-10-28
-- Fuente: videos del cliente (docs/fuentes/videos/transcripciones/) y sus
--         respuestas del 28/10:
--   * Decimales: estándar del sistema, guardar hasta 8. Al imprimir se
--     redondea a 4 o 2 sin alterar lo guardado.
--   * Nota de crédito: resta del inventario solo las líneas que en la factura
--     original entraron a inventario, y solo la cantidad de la nota.
--   * Control 2 de la pantalla: CONTABLE / EXPRES / GASTOS / OTRO.
-- Las cantidades y el stock no cambian de tipo.
-- Aplicar con: cmd /c "mysql -uroot --default-character-set=utf8mb4 taller_web < 017_pulido_compras.sql"
-- =====================================================

SET NAMES utf8mb4;

-- -----------------------------------------------------
-- 1. Montos, costos y tipos de cambio a 8 decimales
-- -----------------------------------------------------

ALTER TABLE compras
  MODIFY COLUMN total_gravado DECIMAL(20,8) NOT NULL DEFAULT 0,
  MODIFY COLUMN total_exento DECIMAL(20,8) NOT NULL DEFAULT 0,
  MODIFY COLUMN total_no_sujeto DECIMAL(20,8) NOT NULL DEFAULT 0,
  MODIFY COLUMN total_xcomprobar DECIMAL(20,8) NOT NULL DEFAULT 0,
  MODIFY COLUMN suma_operaciones DECIMAL(20,8) NOT NULL DEFAULT 0,
  MODIFY COLUMN descuento_global_gravado DECIMAL(20,8) NOT NULL DEFAULT 0,
  MODIFY COLUMN descuento_global_exento DECIMAL(20,8) NOT NULL DEFAULT 0,
  MODIFY COLUMN descuento_global_no_sujeto DECIMAL(20,8) NOT NULL DEFAULT 0,
  MODIFY COLUMN porcentaje_descuento DECIMAL(12,8) NOT NULL DEFAULT 0,
  MODIFY COLUMN total_descuento DECIMAL(20,8) NOT NULL DEFAULT 0,
  MODIFY COLUMN sub_total DECIMAL(20,8) NOT NULL DEFAULT 0,
  MODIFY COLUMN iva DECIMAL(20,8) NOT NULL DEFAULT 0,
  MODIFY COLUMN iva_retenido DECIMAL(20,8) NOT NULL DEFAULT 0,
  MODIFY COLUMN iva_percibido DECIMAL(20,8) NOT NULL DEFAULT 0,
  MODIFY COLUMN retencion_renta DECIMAL(20,8) NOT NULL DEFAULT 0,
  MODIFY COLUMN monto_total_operacion DECIMAL(20,8) NOT NULL DEFAULT 0,
  MODIFY COLUMN total_cargos_no_afectos DECIMAL(20,8) NOT NULL DEFAULT 0,
  MODIFY COLUMN total_pagar DECIMAL(20,8) NOT NULL DEFAULT 0;

ALTER TABLE compras_detalle
  MODIFY COLUMN costo_unitario DECIMAL(20,8) NOT NULL DEFAULT 0 COMMENT 'Control 30 - Hasta 8 decimales; se imprime a 4',
  MODIFY COLUMN descuento_porcentaje DECIMAL(12,8) NOT NULL DEFAULT 0 COMMENT 'Control 28/30 - Se resta del subtotal antes del IVA',
  MODIFY COLUMN subtotal_sin_iva DECIMAL(20,8) NOT NULL DEFAULT 0,
  MODIFY COLUMN iva_unitario DECIMAL(20,8) NOT NULL DEFAULT 0,
  MODIFY COLUMN subtotal_con_iva DECIMAL(20,8) NOT NULL DEFAULT 0,
  MODIFY COLUMN exento_unitario DECIMAL(20,8) NOT NULL DEFAULT 0,
  MODIFY COLUMN no_sujeto_unitario DECIMAL(20,8) NOT NULL DEFAULT 0,
  MODIFY COLUMN cargos_no_afectos DECIMAL(20,8) NOT NULL DEFAULT 0;

ALTER TABLE compras_pagos
  MODIFY COLUMN monto DECIMAL(20,8) NOT NULL DEFAULT 0;

ALTER TABLE costos
  MODIFY COLUMN costo DECIMAL(20,8) NULL DEFAULT 0 COMMENT 'Costo según factura de la compra más reciente',
  MODIFY COLUMN costo_proveedor DECIMAL(20,8) NULL DEFAULT 0 COMMENT 'Costo real pagado al proveedor',
  MODIFY COLUMN costo_promedio DECIMAL(20,8) NULL DEFAULT 0 COMMENT 'Costo promedio de todas las compras',
  MODIFY COLUMN costo_local DECIMAL(20,8) NULL DEFAULT 0 COMMENT 'Costo promedio en moneda local',
  MODIFY COLUMN costo_local_promedio DECIMAL(20,8) NULL DEFAULT 0 COMMENT 'Promedio del costo local (CSTLOCALP)',
  MODIFY COLUMN iva_pagado DECIMAL(20,8) NULL DEFAULT 0 COMMENT 'IVA pagado en la compra',
  MODIFY COLUMN costo_previo1 DECIMAL(20,8) NULL DEFAULT 0 COMMENT 'Respaldo 1: valor anterior de costo_local',
  MODIFY COLUMN costo_previo2 DECIMAL(20,8) NULL DEFAULT 0 COMMENT 'Respaldo 2: valor que tenía costo_previo1',
  MODIFY COLUMN costop_previo1 DECIMAL(20,8) NULL DEFAULT 0 COMMENT 'Respaldo 1 del costo promedio',
  MODIFY COLUMN costop_previo2 DECIMAL(20,8) NULL DEFAULT 0 COMMENT 'Respaldo 2 del costo promedio',
  MODIFY COLUMN costolcl_previo1 DECIMAL(20,8) NULL DEFAULT 0 COMMENT 'Costo local anterior',
  MODIFY COLUMN costolcl_previo2 DECIMAL(20,8) NULL DEFAULT 0 COMMENT 'Costo local previo a costolcl_previo1';

ALTER TABLE proceso_ingreso
  MODIFY COLUMN tipo_cambio_pagado DECIMAL(20,8) NOT NULL DEFAULT 1 COMMENT 'Dólares por unidad pagados al banco (CAMBIOBAN)',
  MODIFY COLUMN total_factura DECIMAL(20,8) NOT NULL DEFAULT 0 COMMENT 'Suma de las facturas de importación del proceso',
  MODIFY COLUMN sumas_documentos DECIMAL(20,8) NOT NULL DEFAULT 0 COMMENT 'Suma fiscal de los documentos relacionados (sin cuenta ajena)',
  MODIFY COLUMN total_retaceo DECIMAL(20,8) NOT NULL DEFAULT 0 COMMENT 'Gastos que el usuario decide repartir entre los productos';

ALTER TABLE relacion_documentos
  MODIFY COLUMN total_usd DECIMAL(20,8) NOT NULL DEFAULT 0 COMMENT 'Monto que participa en el proceso (para compras nacionales, solo lo fiscal)';

ALTER TABLE datos_duca
  MODIFY COLUMN tipo_cambio_duca DECIMAL(20,8) NOT NULL DEFAULT 1 COMMENT 'Tipo de cambio usado por Aduana (CAMBIOADU)',
  MODIFY COLUMN seguro_declarado DECIMAL(20,8) NOT NULL DEFAULT 0,
  MODIFY COLUMN flete_declarado DECIMAL(20,8) NOT NULL DEFAULT 0,
  MODIFY COLUMN total_productos_duca DECIMAL(20,8) NOT NULL DEFAULT 0,
  MODIFY COLUMN gastos_declarados DECIMAL(20,8) NOT NULL DEFAULT 0 COMMENT 'Otros gastos declarados (normalmente de origen)',
  MODIFY COLUMN valor_cif_duca DECIMAL(20,8) NOT NULL DEFAULT 0,
  MODIFY COLUMN gastos_no_declarados DECIMAL(20,8) NOT NULL DEFAULT 0,
  MODIFY COLUMN total_costos_operativos DECIMAL(20,8) NOT NULL DEFAULT 0 COMMENT 'Gastos declarados + no declarados que se reparten; sin impuestos',
  MODIFY COLUMN iva_pagado DECIMAL(20,8) NOT NULL DEFAULT 0,
  MODIFY COLUMN dai_pagado DECIMAL(20,8) NOT NULL DEFAULT 0,
  MODIFY COLUMN otros_cargos_pagados DECIMAL(20,8) NOT NULL DEFAULT 0,
  MODIFY COLUMN total_pagado_duca DECIMAL(20,8) NOT NULL DEFAULT 0,
  MODIFY COLUMN gasto_total_inversion DECIMAL(20,8) NOT NULL DEFAULT 0;

ALTER TABLE duca_detalles
  MODIFY COLUMN costo_divisa DECIMAL(20,8) NOT NULL DEFAULT 0 COMMENT 'Costo unitario en la moneda de la factura (CSTDIVISA)',
  MODIFY COLUMN costo_contable_usd DECIMAL(20,8) NOT NULL DEFAULT 0 COMMENT 'Costo unitario en dólares según Aduana (COSTO)',
  MODIFY COLUMN costo_cif DECIMAL(20,8) NOT NULL DEFAULT 0 COMMENT 'CIF unitario (CIFUNIT)',
  MODIFY COLUMN valor_dai DECIMAL(12,8) NOT NULL DEFAULT 0 COMMENT 'Porcentaje DAI (DAIVALOR)',
  MODIFY COLUMN dai_pagado DECIMAL(20,8) NOT NULL DEFAULT 0 COMMENT 'DAI unitario (DAIUNIT)',
  MODIFY COLUMN iva_pagado DECIMAL(20,8) NOT NULL DEFAULT 0 COMMENT 'IVA unitario (IVAUNIT)',
  MODIFY COLUMN gastos_aduana DECIMAL(20,8) NOT NULL DEFAULT 0 COMMENT 'Gastos repartidos por unidad (GASTOSUNIT)',
  MODIFY COLUMN subtotal_contable DECIMAL(20,8) NOT NULL DEFAULT 0,
  MODIFY COLUMN subtotal_cif DECIMAL(20,8) NOT NULL DEFAULT 0 COMMENT 'STOTALCIF',
  MODIFY COLUMN total_grupo_cif DECIMAL(20,8) NOT NULL DEFAULT 0 COMMENT 'CIF total del grupo usado como base del reparto (CIFGRUPO)',
  MODIFY COLUMN tipo_cambio_duca DECIMAL(20,8) NOT NULL DEFAULT 1;

ALTER TABLE costos_productos
  MODIFY COLUMN costo_divisa DECIMAL(20,8) NOT NULL DEFAULT 0,
  MODIFY COLUMN costo_contable_usd DECIMAL(20,8) NOT NULL DEFAULT 0,
  MODIFY COLUMN costo_pagado_usd DECIMAL(20,8) NOT NULL DEFAULT 0 COMMENT 'Lo pagado al proveedor con el tipo de cambio del banco',
  MODIFY COLUMN iva_pagado DECIMAL(20,8) NOT NULL DEFAULT 0,
  MODIFY COLUMN gastos_totales DECIMAL(20,8) NOT NULL DEFAULT 0 COMMENT 'Gastos repartidos por unidad, incluido DAI',
  MODIFY COLUMN costo_corregido DECIMAL(20,8) NULL DEFAULT NULL COMMENT 'Solo en casos raros; si tiene valor es el referente del costo pagado',
  MODIFY COLUMN costo_cif DECIMAL(20,8) NOT NULL DEFAULT 0,
  MODIFY COLUMN costo_destino DECIMAL(20,8) NOT NULL DEFAULT 0 COMMENT 'Costo puesto en bodega (COSTOLOCAL)',
  MODIFY COLUMN costo_destino_prom DECIMAL(20,8) NOT NULL DEFAULT 0 COMMENT 'Costo local promedio tras esta compra (CSTLOCALP)',
  MODIFY COLUMN tipo_cambio_pagado DECIMAL(20,8) NOT NULL DEFAULT 1;

ALTER TABLE gastos_sindocumento
  MODIFY COLUMN monto_salida DECIMAL(20,8) NOT NULL DEFAULT 0;

ALTER TABLE documentos_compras
  MODIFY COLUMN tipo_cambio DECIMAL(20,8) NOT NULL DEFAULT 1 COMMENT 'Dólares por unidad de la moneda del documento. Aproximado hasta completar el pago',
  MODIFY COLUMN subtotal_moneda DECIMAL(20,8) NOT NULL DEFAULT 0,
  MODIFY COLUMN subtotal_usd DECIMAL(20,8) NOT NULL DEFAULT 0,
  MODIFY COLUMN total_moneda DECIMAL(20,8) NOT NULL DEFAULT 0,
  MODIFY COLUMN total_usd DECIMAL(20,8) NOT NULL DEFAULT 0;

ALTER TABLE documentos_compras_detalle
  MODIFY COLUMN precio_moneda DECIMAL(20,8) NOT NULL DEFAULT 0,
  MODIFY COLUMN precio_usd DECIMAL(20,8) NOT NULL DEFAULT 0;

-- -----------------------------------------------------
-- 2. Control 2: CONTABLE / EXPRES / GASTOS / OTRO
-- -----------------------------------------------------

ALTER TABLE compras
  MODIFY COLUMN categoria_operacion ENUM('FISCAL','GASTO','MIXTO','CONTABLE','EXPRES','GASTOS','OTRO') NOT NULL DEFAULT 'CONTABLE';
UPDATE compras SET categoria_operacion = CASE categoria_operacion
  WHEN 'FISCAL' THEN 'CONTABLE' WHEN 'GASTO' THEN 'GASTOS' WHEN 'MIXTO' THEN 'OTRO' ELSE categoria_operacion END;
ALTER TABLE compras
  MODIFY COLUMN categoria_operacion ENUM('CONTABLE','EXPRES','GASTOS','OTRO') NOT NULL DEFAULT 'CONTABLE'
    COMMENT 'Control 2. CONTABLE = solo inventario; EXPRES = solo express; GASTOS = gastos o activos; OTRO = cualquiera';

ALTER TABLE documentos_compras
  MODIFY COLUMN categoria_operacion ENUM('FISCAL','GASTO','MIXTO','CONTABLE','EXPRES','GASTOS','OTRO') NOT NULL DEFAULT 'CONTABLE';
UPDATE documentos_compras SET categoria_operacion = CASE categoria_operacion
  WHEN 'FISCAL' THEN 'CONTABLE' WHEN 'GASTO' THEN 'GASTOS' WHEN 'MIXTO' THEN 'OTRO' ELSE categoria_operacion END;
ALTER TABLE documentos_compras
  MODIFY COLUMN categoria_operacion ENUM('CONTABLE','EXPRES','GASTOS','OTRO') NOT NULL DEFAULT 'CONTABLE';

-- -----------------------------------------------------
-- 3. Compras: stock aplicado y nota de crédito
-- -----------------------------------------------------

ALTER TABLE compras
  ADD COLUMN idcompra_origen INT NULL
    COMMENT 'Nota de crédito o débito: factura original que ajusta' AFTER idproceso,
  ADD COLUMN stock_aplicado TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1 = el registro ya movió stock_contable (para revertir exacto al anular)' AFTER fecha_registro,
  ADD KEY idx_compras_origen (idcompra_origen),
  ADD CONSTRAINT fk_compras_origen FOREIGN KEY (idcompra_origen) REFERENCES compras (idcompra) ON DELETE SET NULL;

ALTER TABLE compras_detalle
  MODIFY COLUMN destino ENUM('INVENTARIO','EXPRESS','ACTIVOS','GASTOS') NULL DEFAULT 'INVENTARIO'
    COMMENT 'Tipo de producto. NULL = pendiente de clasificar (líneas del JSON sin ficha)',
  ADD COLUMN iddetalle_origen INT NULL
    COMMENT 'Nota de crédito: línea de la factura original que ajusta' AFTER idcompra,
  ADD COLUMN codigo_express VARCHAR(20) NULL
    COMMENT 'Código incremental de la línea express (EXAA-000001)' AFTER numero_orden,
  ADD KEY idx_detalle_origen (iddetalle_origen),
  ADD CONSTRAINT fk_detalle_origen FOREIGN KEY (iddetalle_origen) REFERENCES compras_detalle (iddetalle) ON DELETE SET NULL;

-- -----------------------------------------------------
-- 4. Ficha del producto: %DAI de su partida
-- -----------------------------------------------------

ALTER TABLE productos
  ADD COLUMN porcentaje_dai DECIMAL(12,8) NULL DEFAULT NULL
    COMMENT 'Porcentaje DAI de la partida (codarancel). Se copia a la línea del DUCA' AFTER codarancel;

-- -----------------------------------------------------
-- 5. Documentos de compra: precio objetivo de la orden
-- -----------------------------------------------------

ALTER TABLE documentos_compras_detalle
  ADD COLUMN precio_objetivo DECIMAL(20,8) NULL DEFAULT NULL
    COMMENT 'Orden de compra: precio que se le pide al proveedor' AFTER precio_usd;

-- -----------------------------------------------------
-- 6. Proceso, DUCA y retaceo
-- -----------------------------------------------------

ALTER TABLE relacion_documentos
  MODIFY COLUMN razon_vinculo VARCHAR(40) NOT NULL
    COMMENT 'Categoría del documento en el proceso: FACTURA, PAGO, SEGURO, FLETE, FORWARDER... (lista abierta)';

ALTER TABLE gastos_sindocumento
  ADD COLUMN categoria VARCHAR(40) NOT NULL DEFAULT 'GASTO LOCAL'
    COMMENT 'Categoría para sumar con los documentos del proceso' AFTER descripcion;

ALTER TABLE datos_duca
  ADD COLUMN vts_pagado DECIMAL(20,8) NOT NULL DEFAULT 0 COMMENT 'VTS según el DUCA (informativo)' AFTER dai_pagado,
  ADD COLUMN its_pagado DECIMAL(20,8) NOT NULL DEFAULT 0 COMMENT 'ITS según el DUCA (informativo)' AFTER vts_pagado;

ALTER TABLE proceso_ingreso
  ADD COLUMN fecha_reapertura DATETIME NULL COMMENT 'Última vez que se reabrió el retaceo aplicado' AFTER fecha_retaceo,
  ADD COLUMN idusuario_reapertura INT NULL COMMENT 'Usuario que reabrió el retaceo' AFTER fecha_reapertura;

ALTER TABLE costos_productos
  ADD COLUMN costo_prom_anterior DECIMAL(20,8) NULL DEFAULT NULL
    COMMENT 'Costo local promedio antes de aplicar este proceso (para reaplicar sin duplicar)' AFTER costo_destino_prom,
  ADD COLUMN stock_anterior DECIMAL(14,4) NULL DEFAULT NULL
    COMMENT 'Stock contable antes de sumar esta línea' AFTER costo_prom_anterior,
  ADD COLUMN stock_aplicado TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1 = la cantidad ya se sumó a stock_contable' AFTER stock_anterior;

-- -----------------------------------------------------
-- 7. Correlativo EX para las líneas express
-- -----------------------------------------------------

ALTER TABLE correlativos
  MODIFY COLUMN tipo VARCHAR(20) NOT NULL
    COMMENT 'NODOCTO = ID global; CP, CI, SC, CT, OC, PF, IMP, PT, VH, EX = números visibles por tipo';

-- -----------------------------------------------------
-- 8. Condición de compra sin valor por defecto y vista del detalle
-- -----------------------------------------------------

ALTER TABLE compras
  MODIFY COLUMN condicion_operacion TINYINT NULL DEFAULT NULL
    COMMENT '1 contado, 2 crédito, 3 otro. NULL = el usuario aún no la elige (no se registra)';

-- Nota de crédito: una línea puede ser solo una rebaja de precio (no devuelve producto).
ALTER TABLE compras_detalle
  ADD COLUMN ajuste_precio TINYINT(1) NOT NULL DEFAULT 0
    COMMENT 'NC: 1 = solo rebaja el precio de la línea original; no resta stock ni cuenta como devolución' AFTER iddetalle_origen;

CREATE OR REPLACE VIEW v_compras_detalle AS
SELECT d.iddetalle, d.idcompra, d.numero_linea, d.numero_orden, d.codigo_express, d.destino,
       d.idcatalogo, c.codigo AS catalogo_codigo, c.nombre AS catalogo_nombre, c.tipo AS catalogo_tipo,
       d.idprod, p.OE AS producto_oe, p.idprodprov AS producto_codigo,
       d.referencia_proveedor, d.descripcion, d.cantidad, d.costo_unitario, d.descuento_porcentaje,
       d.subtotal_sin_iva, d.iva_unitario, d.subtotal_con_iva, d.exento_unitario, d.no_sujeto_unitario,
       d.condicion_iva, d.numero_documento_rel, d.codigo_tributo, d.cargos_no_afectos, d.imagen_url,
       d.iddetalle_origen, d.ajuste_precio, d.created_at, d.updated_at
FROM compras_detalle d
LEFT JOIN catalogo_contable c ON c.idcatalogo = d.idcatalogo
LEFT JOIN productos p ON p.idprod = d.idprod;
