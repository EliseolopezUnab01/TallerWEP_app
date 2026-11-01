import { NextRequest, NextResponse } from 'next/server';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { connectDB } from '@/lib/db';
import { siguienteCorrelativo } from '@/lib/correlativos';
import { aNumero, limpiar } from '@/lib/compras-detalle-db';
import { requierePermiso } from '@/lib/sesion';

const ESTADOS = ['PROCESO', 'FINALIZADA', 'ESPERA', 'CANCELADA'];
const TIPOS = ['MANTENIMIENTO', 'REPARACION', 'DIAGNOSTICO', 'OTRO'];

export async function GET(request: NextRequest) {
  const id = Number(new URL(request.url).searchParams.get('id')) || 0;
  const connection = await connectDB();
  try {
    if (!id) {
      const [ordenes] = await connection.execute<RowDataPacket[]>(
        `SELECT o.id, o.numero_orden, o.estado, o.tipo_servicio, o.fecha_inicial, o.reparaciones_solicitadas,
                c.nombre AS cliente, v.placa
         FROM ordenes_trabajo o
         JOIN clientes c ON c.id = o.cliente_id
         JOIN vehiculos v ON v.id = o.vehiculo_id
         ORDER BY o.id DESC LIMIT 80`
      );
      return NextResponse.json({ success: true, ordenes });
    }
    const [ordenes] = await connection.execute<RowDataPacket[]>(
      `SELECT o.*, c.nombre AS cliente, v.placa, v.marca, v.modelo
       FROM ordenes_trabajo o
       JOIN clientes c ON c.id = o.cliente_id
       JOIN vehiculos v ON v.id = o.vehiculo_id
       WHERE o.id = ?`,
      [id]
    );
    if (!ordenes[0]) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
    const [reparaciones] = await connection.execute<RowDataPacket[]>(
      'SELECT * FROM orden_reparaciones WHERE orden_id = ? ORDER BY id',
      [id]
    );
    const [repuestos] = await connection.execute<RowDataPacket[]>(
      'SELECT * FROM orden_repuestos WHERE idorden = ? ORDER BY idrepuesto',
      [id]
    );
    const [comprados] = await connection.execute<RowDataPacket[]>(
      `SELECT d.iddetalle, d.descripcion, d.cantidad, d.idprod, c.numero_interno
       FROM compras_detalle d JOIN compras c ON c.idcompra = d.idcompra
       WHERE d.idorden = ?`,
      [id]
    );
    return NextResponse.json({ success: true, orden: ordenes[0], reparaciones, repuestos, comprados });
  } catch (error) {
    console.error('Error al leer órdenes:', error);
    return NextResponse.json({ error: 'Error al leer órdenes' }, { status: 500 });
  } finally {
    await connection.end();
  }
}

export async function POST(request: NextRequest) {
  const auth = await requierePermiso(request, 'taller.editar');
  if (auth instanceof NextResponse) return auth;
  const body = await request.json().catch(() => ({}));
  const cliente = Number(body.cliente_id);
  const vehiculo = Number(body.vehiculo_id);
  if (!cliente || !vehiculo) return NextResponse.json({ error: 'Indique el cliente y el vehículo' }, { status: 400 });
  const connection = await connectDB();
  try {
    const [vh] = await connection.execute<RowDataPacket[]>(
      'SELECT id FROM vehiculos WHERE id = ? AND cliente_id = ?',
      [vehiculo, cliente]
    );
    if (!vh[0]) return NextResponse.json({ error: 'Ese vehículo no es de ese cliente' }, { status: 400 });
    const { codigo } = await siguienteCorrelativo(connection, 'OT');
    const estado = ESTADOS.includes(String(body.estado)) ? body.estado : 'PROCESO';
    const tipo = TIPOS.includes(String(body.tipo_servicio)) ? body.tipo_servicio : 'REPARACION';
    const [res] = await connection.execute<ResultSetHeader>(
      `INSERT INTO ordenes_trabajo
         (numero_orden, cliente_id, vehiculo_id, conductor_nombre, estado, tipo_servicio, reparaciones_solicitadas, fecha_inicial)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURDATE())`,
      [codigo, cliente, vehiculo, limpiar(body.conductor_nombre), estado, tipo, limpiar(body.reparaciones_solicitadas)]
    );
    return NextResponse.json({ success: true, id: res.insertId, numero_orden: codigo });
  } catch (error) {
    console.error('Error al crear orden:', error);
    return NextResponse.json({ error: 'Error al crear la orden' }, { status: 500 });
  } finally {
    await connection.end();
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requierePermiso(request, 'taller.editar');
  if (auth instanceof NextResponse) return auth;
  const body = await request.json().catch(() => ({}));
  const id = Number(body.id);
  if (!id) return NextResponse.json({ error: 'Falta la orden' }, { status: 400 });
  const connection = await connectDB();
  try {
    const [actual] = await connection.execute<RowDataPacket[]>('SELECT id, estado FROM ordenes_trabajo WHERE id = ?', [id]);
    if (!actual[0]) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
    if (actual[0].estado === 'FINALIZADA' || actual[0].estado === 'CANCELADA') {
      return NextResponse.json({ error: 'Esa orden ya está cerrada' }, { status: 400 });
    }
    await connection.beginTransaction();
    const estado = ESTADOS.includes(String(body.estado)) ? body.estado : actual[0].estado;
    await connection.execute(
      `UPDATE ordenes_trabajo
       SET conductor_nombre = ?, reparaciones_solicitadas = ?, reparaciones_realizadas = ?, comentarios = ?, estado = ?,
           odometro_inicial = ?, fecha_final = IF(? IN ('FINALIZADA','CANCELADA'), CURDATE(), fecha_final)
       WHERE id = ?`,
      [
        limpiar(body.conductor_nombre),
        limpiar(body.reparaciones_solicitadas),
        limpiar(body.reparaciones_realizadas),
        limpiar(body.comentarios),
        estado,
        body.odometro_inicial === '' || body.odometro_inicial == null ? null : Math.max(0, Math.round(aNumero(body.odometro_inicial))),
        estado,
        id,
      ]
    );
    await connection.execute('DELETE FROM orden_reparaciones WHERE orden_id = ?', [id]);
    for (const r of Array.isArray(body.reparaciones) ? body.reparaciones : []) {
      const tarea = limpiar(r.tarea_actividad);
      if (!tarea) continue;
      const tipo = r.tipo === 'REALIZADA' ? 'REALIZADA' : 'SOLICITADA';
      await connection.execute(
        `INSERT INTO orden_reparaciones (orden_id, tipo, cantidad, tarea_actividad, idempleado1)
         VALUES (?, ?, ?, ?, ?)`,
        [id, tipo, Math.max(1, Math.round(aNumero(r.cantidad, 1))), tarea, r.idempleado1 ? Number(r.idempleado1) : null]
      );
    }
    await connection.execute('DELETE FROM orden_repuestos WHERE idorden = ?', [id]);
    for (const r of Array.isArray(body.repuestos) ? body.repuestos : []) {
      const descripcion = limpiar(r.descripcion);
      if (!descripcion) continue;
      let idprod: number | null = r.idprod ? Number(r.idprod) : null;
      if (idprod) {
        const [prod] = await connection.execute<RowDataPacket[]>('SELECT idprod FROM productos WHERE idprod = ?', [idprod]);
        if (!prod[0]) idprod = null;
      }
      await connection.execute(
        'INSERT INTO orden_repuestos (idorden, idprod, descripcion, cantidad) VALUES (?, ?, ?, ?)',
        [id, idprod, descripcion, Math.max(0, aNumero(r.cantidad, 1)) || 1]
      );
    }
    await connection.commit();
    return NextResponse.json({ success: true });
  } catch (error) {
    await connection.rollback().catch(() => {});
    console.error('Error al guardar orden:', error);
    return NextResponse.json({ error: 'Error al guardar la orden' }, { status: 500 });
  } finally {
    await connection.end();
  }
}
