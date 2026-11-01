-- Fase 4: OE del express, backorder calculado, tipo Gastos y numero del proveedor.

ALTER TABLE compras_detalle
  ADD COLUMN referencia_oem VARCHAR(50) NULL
    COMMENT 'OEM digitado en express o gasto; el de inventario sale de la ficha' AFTER referencia_proveedor;

ALTER TABLE documentos_compras
  MODIFY COLUMN tipo_documento ENUM('SOLICITUD','COTIZACION','ORDEN','PROFORMA','GASTO') NOT NULL,
  ADD COLUMN numero_proveedor VARCHAR(60) NULL
    COMMENT 'Numero de cotizacion o proforma que envia el proveedor' AFTER comentarios;

-- El total deja de ser reservado + en proceso. Es lo pedido menos lo recibido.
ALTER TABLE pedido_pendiente DROP COLUMN backorder_total;
ALTER TABLE pedido_pendiente
  ADD COLUMN backorder_total DECIMAL(14,4)
    GENERATED ALWAYS AS (
      GREATEST(0, GREATEST(IFNULL(cant_ordenado, 0), IFNULL(cant_proforma, 0), IFNULL(cant_factura, 0)) - IFNULL(cant_recibido, 0))
    ) STORED
    AFTER backorder_enproceso;

UPDATE pedido_pendiente
SET backorder_por_pagar = GREATEST(0, backorder_total - backorder_pagado);

CREATE OR REPLACE VIEW v_compras_detalle AS
SELECT d.iddetalle, d.idcompra, d.numero_linea, d.numero_orden, d.codigo_express, d.destino,
       d.idcatalogo, c.codigo AS catalogo_codigo, c.nombre AS catalogo_nombre, c.tipo AS catalogo_tipo,
       d.idprod, COALESCE(d.referencia_oem, p.OE) AS producto_oe, p.idprodprov AS producto_codigo,
       d.referencia_proveedor, d.referencia_oem, d.descripcion, d.cantidad, d.uni_medida, d.tipo_item,
       d.costo_unitario, d.descuento_porcentaje,
       d.subtotal_sin_iva, d.iva_unitario, d.subtotal_con_iva, d.exento_unitario, d.no_sujeto_unitario,
       d.condicion_iva, d.numero_documento_rel, d.codigo_tributo, d.cargos_no_afectos, d.imagen_url,
       d.iddetalle_origen, d.ajuste_precio, d.created_at, d.updated_at
FROM compras_detalle d
LEFT JOIN catalogo_contable c ON c.idcatalogo = d.idcatalogo
LEFT JOIN productos p ON p.idprod = d.idprod;
