import { NextRequest, NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2/promise';
import { connectDB } from '@/lib/db';
import { actualizarFila, errorDuplicado, extraerCampos, insertarFila } from '@/lib/taller';

const CAMPOS = { nombre: 'mayus', descripcion: 'texto', orden: 'entero', activo: 'bool' } as const;

// GET ?activos=1
export async function GET(request: NextRequest) {
  const soloActivos = new URL(request.url).searchParams.get('activos') === '1';
  const connection = await connectDB();
  try {
    const [sistemas] = await connection.execute<RowDataPacket[]>(
      `SELECT s.*, (SELECT COUNT(*) FROM vehiculo_partes p WHERE p.idsistema = s.idsistema) AS partes
       FROM cat_sistemas_vehiculo s ${soloActivos ? 'WHERE s.activo = 1' : ''}
       ORDER BY s.orden, s.nombre`
    );
    return NextResponse.json({ success: true, sistemas });
  } catch (error) {
    console.error('Error al obtener sistemas:', error);
    return NextResponse.json({ error: 'Error al obtener sistemas', detalle: (error as Error).message }, { status: 500 });
  } finally {
    await connection.end();
  }
}

export async function POST(request: NextRequest) {
  const datos = extraerCampos((await request.json()) as Record<string, unknown>, CAMPOS);
  if (!datos.nombre) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
  const connection = await connectDB();
  try {
    if (datos.orden == null) {
      const [m] = await connection.query<RowDataPacket[]>('SELECT COALESCE(MAX(orden), 0) + 10 AS o FROM cat_sistemas_vehiculo');
      datos.orden = Number(m[0].o);
    }
    if (datos.activo === undefined) datos.activo = 1;
    const id = await insertarFila(connection, 'cat_sistemas_vehiculo', datos);
    return NextResponse.json({ success: true, id, mensaje: 'Sistema creado' });
  } catch (error) {
    if (errorDuplicado(error)) return NextResponse.json({ error: 'Ese sistema ya existe' }, { status: 400 });
    console.error('Error al crear sistema:', error);
    return NextResponse.json({ error: 'Error al crear sistema', detalle: (error as Error).message }, { status: 500 });
  } finally {
    await connection.end();
  }
}

export async function PUT(request: NextRequest) {
  const body = (await request.json()) as Record<string, unknown>;
  const id = Number(body.idsistema);
  if (!id) return NextResponse.json({ error: 'Falta idsistema' }, { status: 400 });
  const datos = extraerCampos(body, CAMPOS);
  if ('nombre' in datos && !datos.nombre) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
  const connection = await connectDB();
  try {
    await actualizarFila(connection, 'cat_sistemas_vehiculo', 'idsistema', id, datos);
    return NextResponse.json({ success: true, mensaje: 'Sistema guardado' });
  } catch (error) {
    if (errorDuplicado(error)) return NextResponse.json({ error: 'Ese sistema ya existe' }, { status: 400 });
    console.error('Error al actualizar sistema:', error);
    return NextResponse.json({ error: 'Error al actualizar sistema', detalle: (error as Error).message }, { status: 500 });
  } finally {
    await connection.end();
  }
}

// DELETE ?id=: solo si ninguna parte ni recordatorio lo usa; si no, desactívelo.
export async function DELETE(request: NextRequest) {
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
  const connection = await connectDB();
  try {
    const [uso] = await connection.execute<RowDataPacket[]>(
      `SELECT (SELECT COUNT(*) FROM vehiculo_partes WHERE idsistema = ?)
            + (SELECT COUNT(*) FROM recordatorios_mantenimiento WHERE idsistema = ?) AS n`,
      [id, id]
    );
    if (Number(uso[0].n) > 0) {
      return NextResponse.json({ error: 'El sistema está en uso; desactívelo en lugar de eliminarlo' }, { status: 400 });
    }
    await connection.execute('DELETE FROM cat_sistemas_vehiculo WHERE idsistema = ?', [id]);
    return NextResponse.json({ success: true, mensaje: 'Sistema eliminado' });
  } catch (error) {
    console.error('Error al eliminar sistema:', error);
    return NextResponse.json({ error: 'Error al eliminar sistema', detalle: (error as Error).message }, { status: 500 });
  } finally {
    await connection.end();
  }
}
