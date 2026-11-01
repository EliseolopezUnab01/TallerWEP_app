import { NextRequest, NextResponse } from 'next/server';
import type { Connection, RowDataPacket } from 'mysql2/promise';
import { connectDB } from '@/lib/db';
import { limpiar } from '@/lib/compras-detalle-db';
import {
  CAMPOS_RECORDATORIO,
  DIAS_AVISO,
  KM_AVISO,
  actualizarFila,
  avanzarOdometro,
  extraerCampos,
  insertarFila,
} from '@/lib/taller';

type Datos = Record<string, string | number | null>;

async function validar(connection: Connection, idvehiculo: number, datos: Datos, actual?: Datos) {
  const dias = 'intervalo_dias' in datos ? datos.intervalo_dias : actual?.intervalo_dias;
  const km = 'intervalo_km' in datos ? datos.intervalo_km : actual?.intervalo_km;
  if (!dias && !km) return 'Indique cada cuántos días o cada cuántos km';
  if ((dias != null && Number(dias) <= 0) || (km != null && Number(km) <= 0)) return 'Los intervalos deben ser mayores que cero';
  if (datos.idparte) {
    const [p] = await connection.execute<RowDataPacket[]>('SELECT idvehiculo FROM vehiculo_partes WHERE idparte = ?', [datos.idparte]);
    if (!p[0] || Number(p[0].idvehiculo) !== idvehiculo) return 'La parte no es de este vehículo';
  }
  return null;
}

// GET ?dias=: recordatorios activos vencidos o próximos de todos los vehículos
export async function GET(request: NextRequest) {
  const dias = Number(new URL(request.url).searchParams.get('dias')) || DIAS_AVISO;
  const connection = await connectDB();
  try {
    const [recordatorios] = await connection.execute<RowDataPacket[]>(
      `SELECT r.*, v.codigo AS vehiculo_codigo, v.placa, v.odometro_actual, c.nombre AS cliente_nombre
       FROM recordatorios_mantenimiento r
       JOIN vehiculos v ON v.id = r.idvehiculo
       JOIN clientes c ON c.id = v.cliente_id
       WHERE r.activo = 1 AND v.activo = 1
         AND (r.proximo_fecha <= CURDATE() + INTERVAL ? DAY OR r.proximo_km <= v.odometro_actual + ?)
       ORDER BY r.proximo_fecha LIMIT 300`,
      [dias, KM_AVISO]
    );
    return NextResponse.json({ success: true, recordatorios });
  } catch (error) {
    console.error('Error al obtener recordatorios:', error);
    return NextResponse.json({ error: 'Error al obtener recordatorios', detalle: (error as Error).message }, { status: 500 });
  } finally {
    await connection.end();
  }
}

// POST: { idvehiculo, ...campos } | { accion: 'realizado', idrecordatorio, fecha?, km? }
export async function POST(request: NextRequest) {
  const body = (await request.json()) as Record<string, unknown>;
  const connection = await connectDB();
  try {
    if (body.accion === 'realizado') {
      const [rows] = await connection.execute<RowDataPacket[]>(
        `SELECT r.idrecordatorio, r.idvehiculo, r.descripcion, v.odometro_actual
         FROM recordatorios_mantenimiento r JOIN vehiculos v ON v.id = r.idvehiculo WHERE r.idrecordatorio = ?`,
        [Number(body.idrecordatorio)]
      );
      const r = rows[0];
      if (!r) return NextResponse.json({ error: 'Recordatorio no encontrado' }, { status: 404 });
      const d = new Date();
      const fecha = limpiar(body.fecha)?.slice(0, 10) || `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const km = Number(body.km) || Number(r.odometro_actual) || null;
      await connection.execute(
        'UPDATE recordatorios_mantenimiento SET ultimo_fecha = ?, ultimo_km = ? WHERE idrecordatorio = ?',
        [fecha, km, r.idrecordatorio]
      );
      await avanzarOdometro(connection, Number(r.idvehiculo), km);
      return NextResponse.json({ success: true, mensaje: `${r.descripcion}: realizado el ${fecha}` });
    }

    const idvehiculo = Number(body.idvehiculo);
    const datos = extraerCampos(body, CAMPOS_RECORDATORIO);
    if (!idvehiculo || !datos.descripcion) return NextResponse.json({ error: 'Indique vehículo y descripción' }, { status: 400 });
    const error = await validar(connection, idvehiculo, datos);
    if (error) return NextResponse.json({ error }, { status: 400 });
    if (datos.activo === undefined) datos.activo = 1;
    const id = await insertarFila(connection, 'recordatorios_mantenimiento', { ...datos, idvehiculo });
    return NextResponse.json({ success: true, id, mensaje: 'Recordatorio creado' });
  } catch (error) {
    console.error('Error en recordatorios:', error);
    return NextResponse.json({ error: 'Error al guardar recordatorio', detalle: (error as Error).message }, { status: 500 });
  } finally {
    await connection.end();
  }
}

export async function PUT(request: NextRequest) {
  const body = (await request.json()) as Record<string, unknown>;
  const id = Number(body.idrecordatorio);
  if (!id) return NextResponse.json({ error: 'Falta idrecordatorio' }, { status: 400 });
  const datos = extraerCampos(body, CAMPOS_RECORDATORIO);
  if ('descripcion' in datos && !datos.descripcion) return NextResponse.json({ error: 'La descripción es obligatoria' }, { status: 400 });
  const connection = await connectDB();
  try {
    const [rows] = await connection.execute<RowDataPacket[]>(
      'SELECT idvehiculo, intervalo_dias, intervalo_km FROM recordatorios_mantenimiento WHERE idrecordatorio = ?',
      [id]
    );
    if (!rows[0]) return NextResponse.json({ error: 'Recordatorio no encontrado' }, { status: 404 });
    const error = await validar(connection, Number(rows[0].idvehiculo), datos, rows[0] as Datos);
    if (error) return NextResponse.json({ error }, { status: 400 });
    await actualizarFila(connection, 'recordatorios_mantenimiento', 'idrecordatorio', id, datos);
    return NextResponse.json({ success: true, mensaje: 'Recordatorio guardado' });
  } catch (error) {
    console.error('Error al actualizar recordatorio:', error);
    return NextResponse.json({ error: 'Error al actualizar recordatorio', detalle: (error as Error).message }, { status: 500 });
  } finally {
    await connection.end();
  }
}

export async function DELETE(request: NextRequest) {
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
  const connection = await connectDB();
  try {
    await connection.execute('DELETE FROM recordatorios_mantenimiento WHERE idrecordatorio = ?', [id]);
    return NextResponse.json({ success: true, mensaje: 'Recordatorio eliminado' });
  } catch (error) {
    console.error('Error al eliminar recordatorio:', error);
    return NextResponse.json({ error: 'Error al eliminar recordatorio', detalle: (error as Error).message }, { status: 500 });
  } finally {
    await connection.end();
  }
}
