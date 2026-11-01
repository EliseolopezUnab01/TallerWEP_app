import { NextRequest, NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2/promise';
import { connectDB } from '@/lib/db';
import type { Disponibilidad } from '@/lib/disponibilidad';

const MAX_IDS = 300;

const aFecha = (v: unknown) => (v ? (v instanceof Date ? v.toISOString() : String(v)).slice(0, 10) : null);

// GET ?ids=1,2,3 → stock contable y físico, lo que viene en camino (procesos abiertos) y la última compra.
export async function GET(request: NextRequest) {
  const ids = [
    ...new Set(
      (new URL(request.url).searchParams.get('ids') || '')
        .split(',')
        .map(Number)
        .filter((n) => Number.isInteger(n) && n > 0)
    ),
  ].slice(0, MAX_IDS);
  if (ids.length === 0) return NextResponse.json({ success: true, disponibilidad: {} });

  const marcas = ids.map(() => '?').join(',');
  const connection = await connectDB();
  try {
    const [productos] = await connection.execute<RowDataPacket[]>(
      `SELECT idprod, stock_contable, stock_fisico FROM productos WHERE idprod IN (${marcas})`,
      ids
    );
    const [camino] = await connection.execute<RowDataPacket[]>(
      `SELECT pp.idprod, pi.idproceso, pi.codigo, pi.estado_proceso,
              GREATEST(GREATEST(pp.cant_proforma, pp.cant_ordenado, pp.cant_factura) - pp.cant_recibido, 0) AS cantidad,
              COALESCE(pp.fecha_estimada_backorder, pp.fecha_proforma, pp.fecha_orden_compra) AS fecha
       FROM pedido_pendiente pp
       JOIN proceso_ingreso pi ON pi.idproceso = pp.idproceso
       WHERE pp.idprod IN (${marcas}) AND pp.estatus_backorder = 'ACTIVO' AND pi.estado_documento = 'BORRADOR'`,
      ids
    );
    const [compras] = await connection.execute<RowDataPacket[]>(
      `SELECT d.idprod, c.idcompra, c.fecha_emision, COALESCE(c.numero_factura, c.numero_interno) AS factura,
              d.cantidad, d.costo_unitario, p.nombre_legal AS proveedor
       FROM compras_detalle d
       JOIN compras c ON c.idcompra = d.idcompra
       LEFT JOIN proveedores p ON p.idproveedor = c.idproveedor
       WHERE d.idprod IN (${marcas}) AND c.estado = 'REGISTRADA' AND d.destino = 'INVENTARIO'
         AND COALESCE(c.tipo_dte, '') NOT IN ('05', '06')
       ORDER BY c.fecha_emision DESC, c.idcompra DESC`,
      ids
    );

    const disponibilidad: Record<number, Disponibilidad> = {};
    for (const p of productos) {
      disponibilidad[Number(p.idprod)] = {
        contable: Number(p.stock_contable) || 0,
        fisico: Number(p.stock_fisico) || 0,
        en_camino: 0,
        fecha_estimada: null,
        procesos: [],
        ultima_compra: null,
      };
    }
    for (const c of camino) {
      const d = disponibilidad[Number(c.idprod)];
      const cantidad = Number(c.cantidad) || 0;
      if (!d || cantidad <= 0) continue;
      const fecha = aFecha(c.fecha);
      d.en_camino += cantidad;
      if (fecha && (!d.fecha_estimada || fecha < d.fecha_estimada)) d.fecha_estimada = fecha;
      d.procesos.push({ idproceso: Number(c.idproceso), codigo: String(c.codigo), estado: String(c.estado_proceso), cantidad, fecha });
    }
    for (const c of compras) {
      const d = disponibilidad[Number(c.idprod)];
      if (!d || d.ultima_compra) continue;
      d.ultima_compra = {
        idcompra: Number(c.idcompra),
        fecha: aFecha(c.fecha_emision),
        factura: c.factura ? String(c.factura) : null,
        proveedor: c.proveedor ? String(c.proveedor) : null,
        cantidad: Number(c.cantidad),
        costo: Number(c.costo_unitario),
      };
    }
    return NextResponse.json({ success: true, disponibilidad });
  } catch (error) {
    console.error('Error al consultar disponibilidad:', error);
    return NextResponse.json({ error: 'Error al consultar disponibilidad' }, { status: 500 });
  } finally {
    await connection.end();
  }
}
