import { NextRequest, NextResponse } from 'next/server';
import type { Connection, RowDataPacket } from 'mysql2/promise';
import { connectDB } from '@/lib/db';
import { CAMPOS_ESTADO, actualizarFila, avanzarOdometro, extraerCampos, insertarFila } from '@/lib/taller';

type Datos = Record<string, string | number | null>;

async function validar(connection: Connection, idparte: number, datos: Datos) {
  const [p] = await connection.execute<RowDataPacket[]>('SELECT idparte, idvehiculo FROM vehiculo_partes WHERE idparte = ?', [idparte]);
  if (!p[0]) return { error: `La parte ${idparte} no existe` };
  if (datos.estado_visual != null && (Number(datos.estado_visual) < 1 || Number(datos.estado_visual) > 10)) {
    return { error: 'El estado visual va de 1 a 10' };
  }
  if (datos.idorden) {
    const [o] = await connection.execute<RowDataPacket[]>('SELECT vehiculo_id FROM ordenes_trabajo WHERE id = ?', [datos.idorden]);
    if (!o[0] || Number(o[0].vehiculo_id) !== Number(p[0].idvehiculo)) return { error: 'La orden no es de este vehículo' };
  }
  if (datos.idempleado) {
    const [e] = await connection.execute<RowDataPacket[]>('SELECT id FROM empleados WHERE id = ?', [datos.idempleado]);
    if (!e[0]) return { error: 'El empleado no existe' };
  }
  return { idvehiculo: Number(p[0].idvehiculo) };
}

// POST: { idparte, momento, ... } | { registros: [{ idparte, momento, ... }], idorden?, idempleado?, kilometraje?, fecha? }
// Los datos comunes (orden, empleado, km, fecha) se aplican a cada registro que no los traiga.
export async function POST(request: NextRequest) {
  const body = (await request.json()) as Record<string, unknown>;
  const lista = Array.isArray(body.registros) ? (body.registros as Record<string, unknown>[]) : [body];
  const comunes = extraerCampos(body, { idorden: 'entero', idempleado: 'entero', kilometraje: 'entero', fecha: 'fecha' });
  if (lista.length === 0) return NextResponse.json({ error: 'No hay registros' }, { status: 400 });
  const connection = await connectDB();
  try {
    await connection.beginTransaction();
    const ids: number[] = [];
    for (const registro of lista) {
      const idparte = Number(registro.idparte);
      const datos = { ...comunes, ...extraerCampos(registro, CAMPOS_ESTADO) };
      for (const k of Object.keys(datos)) if (datos[k] === null && comunes[k] != null) datos[k] = comunes[k];
      if (!datos.momento) {
        await connection.rollback();
        return NextResponse.json({ error: 'Indique si la revisión es de ENTRADA o de SALIDA' }, { status: 400 });
      }
      const r = await validar(connection, idparte, datos);
      if ('error' in r) {
        await connection.rollback();
        return NextResponse.json({ error: r.error }, { status: 400 });
      }
      if (!datos.estado_texto) delete datos.estado_texto;
      if (!datos.fecha) delete datos.fecha;
      ids.push(await insertarFila(connection, 'estado_partes', { ...datos, idparte }));
      await avanzarOdometro(connection, r.idvehiculo, Number(datos.kilometraje) || null);
    }
    await connection.commit();
    return NextResponse.json({ success: true, ids, mensaje: `${ids.length} revisión(es) registrada(s)` });
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      /* sin transacción */
    }
    console.error('Error al registrar estado:', error);
    return NextResponse.json({ error: 'Error al registrar estado', detalle: (error as Error).message }, { status: 500 });
  } finally {
    await connection.end();
  }
}

export async function PUT(request: NextRequest) {
  const body = (await request.json()) as Record<string, unknown>;
  const idestado = Number(body.idestado);
  if (!idestado) return NextResponse.json({ error: 'Falta idestado' }, { status: 400 });
  const datos = extraerCampos(body, CAMPOS_ESTADO);
  if ('momento' in datos && !datos.momento) return NextResponse.json({ error: 'Momento no válido' }, { status: 400 });
  if ('estado_texto' in datos && !datos.estado_texto) datos.estado_texto = 'SIN VERIFICAR';
  if ('fecha' in datos && !datos.fecha) delete datos.fecha;
  const connection = await connectDB();
  try {
    const [e] = await connection.execute<RowDataPacket[]>('SELECT idparte FROM estado_partes WHERE idestado = ?', [idestado]);
    if (!e[0]) return NextResponse.json({ error: 'Revisión no encontrada' }, { status: 404 });
    const r = await validar(connection, Number(e[0].idparte), datos);
    if ('error' in r) return NextResponse.json({ error: r.error }, { status: 400 });
    await actualizarFila(connection, 'estado_partes', 'idestado', idestado, datos);
    return NextResponse.json({ success: true, mensaje: 'Revisión guardada' });
  } catch (error) {
    console.error('Error al actualizar estado:', error);
    return NextResponse.json({ error: 'Error al actualizar estado', detalle: (error as Error).message }, { status: 500 });
  } finally {
    await connection.end();
  }
}

export async function DELETE(request: NextRequest) {
  const idestado = Number(new URL(request.url).searchParams.get('id'));
  if (!idestado) return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
  const connection = await connectDB();
  try {
    await connection.execute('DELETE FROM estado_partes WHERE idestado = ?', [idestado]);
    return NextResponse.json({ success: true, mensaje: 'Revisión eliminada' });
  } catch (error) {
    console.error('Error al eliminar estado:', error);
    return NextResponse.json({ error: 'Error al eliminar estado', detalle: (error as Error).message }, { status: 500 });
  } finally {
    await connection.end();
  }
}
