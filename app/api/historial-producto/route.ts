import { NextRequest, NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2/promise';
import { connectDB } from '@/lib/db';

// GET ?idprod= : documentos de compra, facturas, cálculo DUCA, costos por proceso y backorders del producto
export async function GET(request: NextRequest) {
  const idprod = Number(new URL(request.url).searchParams.get('idprod'));
  if (!idprod) return NextResponse.json({ error: 'Falta idprod' }, { status: 400 });
  const connection = await connectDB();
  try {
    const [producto] = await connection.execute<RowDataPacket[]>(
      `SELECT p.idprod, p.nombre, p.idprodprov, p.stock_contable, c.costo_local, c.costo_local_promedio,
              c.costolcl_previo1, c.costolcl_previo2, c.nofactura, c.dt_compra
       FROM productos p LEFT JOIN costos c ON c.idprod = p.idprod WHERE p.idprod = ?`,
      [idprod]
    );
    if (!producto[0]) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });

    const [documentos] = await connection.execute<RowDataPacket[]>(
      `SELECT d.iddocumento, d.id_documento, d.tipo_documento, d.estado_documento, d.fecha_documento, d.moneda_documento,
              l.cantidad, l.precio_moneda, l.precio_usd, l.estatus_articulo, pr.nombre_legal AS proveedor, pi.codigo AS proceso
       FROM documentos_compras_detalle l
       JOIN documentos_compras d ON d.iddocumento = l.iddocumento
       LEFT JOIN proveedores pr ON pr.idproveedor = d.idproveedor
       LEFT JOIN proceso_ingreso pi ON pi.idproceso = d.idproceso
       WHERE l.idprod = ? ORDER BY d.fecha_documento DESC, d.iddocumento DESC LIMIT 100`,
      [idprod]
    );
    const [compras] = await connection.execute<RowDataPacket[]>(
      `SELECT c.idcompra, COALESCE(c.numero_factura, c.numero_interno) AS factura, c.estado, c.clase_documento, c.fecha_emision,
              d.iddetalle, d.cantidad, d.costo_unitario, d.destino, pr.nombre_legal AS proveedor, pi.codigo AS proceso,
              dd.costo_cif, dd.dai_pagado, dd.gastos_aduana, dd.codigo_arancelario, dd.valor_dai,
              cp.costo_pagado_usd, cp.gastos_totales, cp.costo_destino, cp.costo_destino_prom
       FROM compras_detalle d
       JOIN compras c ON c.idcompra = d.idcompra
       LEFT JOIN proveedores pr ON pr.idproveedor = c.idproveedor
       LEFT JOIN proceso_ingreso pi ON pi.idproceso = c.idproceso
       LEFT JOIN duca_detalles dd ON dd.iddetalle = d.iddetalle
       LEFT JOIN costos_productos cp ON cp.iddetalle = d.iddetalle
       WHERE d.idprod = ? AND c.estado NOT IN ('ANULADA', 'INVALIDADO')
       ORDER BY c.fecha_emision DESC, c.idcompra DESC LIMIT 100`,
      [idprod]
    );
    const [pendientes] = await connection.execute<RowDataPacket[]>(
      `SELECT pp.*, pi.codigo AS proceso FROM pedido_pendiente pp JOIN proceso_ingreso pi ON pi.idproceso = pp.idproceso
       WHERE pp.idprod = ? ORDER BY pp.idpendiente DESC LIMIT 50`,
      [idprod]
    );
    return NextResponse.json({ success: true, producto: producto[0], documentos, compras, pendientes });
  } catch (error) {
    console.error('Error al obtener historial del producto:', error);
    return NextResponse.json({ error: 'Error al obtener historial', detalle: (error as Error).message }, { status: 500 });
  } finally {
    await connection.end();
  }
}
