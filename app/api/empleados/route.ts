import { NextRequest, NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2/promise';
import { connectDB } from '@/lib/db';
import {
  CAMPOS_EMPLEADO,
  actualizarFila,
  codigoSiguiente,
  errorDuplicado,
  extraerCampos,
  insertarFila,
} from '@/lib/taller';

// GET: lista (?q=, ?activos=1) | ?id=
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get('id')) || 0;
  const connection = await connectDB();
  try {
    if (id) {
      const [rows] = await connection.execute<RowDataPacket[]>('SELECT * FROM empleados WHERE id = ?', [id]);
      if (!rows[0]) return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
      return NextResponse.json({ success: true, empleado: rows[0] });
    }
    const filtros: string[] = [];
    const valores: string[] = [];
    const q = searchParams.get('q')?.trim();
    if (q) {
      filtros.push('(codigo LIKE ? OR nombre LIKE ? OR apellido LIKE ? OR dui LIKE ? OR puesto LIKE ?)');
      const like = `%${q}%`;
      valores.push(like, like, like, like, like);
    }
    if (searchParams.get('activos') === '1') filtros.push('activo = 1');
    const [empleados] = await connection.execute<RowDataPacket[]>(
      `SELECT id, codigo, nombre, apellido, dui, puesto, departamento, telefono, activo
       FROM empleados
       ${filtros.length ? `WHERE ${filtros.join(' AND ')}` : ''}
       ORDER BY nombre, apellido LIMIT 300`,
      valores
    );
    return NextResponse.json({ success: true, empleados });
  } catch (error) {
    console.error('Error al obtener empleados:', error);
    return NextResponse.json({ error: 'Error al obtener empleados', detalle: (error as Error).message }, { status: 500 });
  } finally {
    await connection.end();
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Record<string, unknown>;
  const datos = extraerCampos(body, CAMPOS_EMPLEADO);
  if (!datos.nombre || !datos.apellido) {
    return NextResponse.json({ error: 'Nombre y apellido son obligatorios' }, { status: 400 });
  }
  const connection = await connectDB();
  try {
    if (!datos.codigo) datos.codigo = await codigoSiguiente(connection, 'empleados', 'EMP');
    if (datos.activo === undefined) datos.activo = 1;
    const id = await insertarFila(connection, 'empleados', datos);
    return NextResponse.json({ success: true, id, codigo: datos.codigo, mensaje: `Empleado ${datos.codigo} creado` });
  } catch (error) {
    if (errorDuplicado(error)) return NextResponse.json({ error: 'Ya existe un empleado con ese código' }, { status: 400 });
    console.error('Error al crear empleado:', error);
    return NextResponse.json({ error: 'Error al crear empleado', detalle: (error as Error).message }, { status: 500 });
  } finally {
    await connection.end();
  }
}

export async function PUT(request: NextRequest) {
  const body = (await request.json()) as Record<string, unknown>;
  const id = Number(body.id);
  if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
  const datos = extraerCampos(body, CAMPOS_EMPLEADO);
  for (const campo of ['codigo', 'nombre', 'apellido']) {
    if (campo in datos && !datos[campo]) return NextResponse.json({ error: `El campo ${campo} es obligatorio` }, { status: 400 });
  }
  const connection = await connectDB();
  try {
    await actualizarFila(connection, 'empleados', 'id', id, datos);
    return NextResponse.json({ success: true, mensaje: 'Empleado guardado' });
  } catch (error) {
    if (errorDuplicado(error)) return NextResponse.json({ error: 'Ya existe un empleado con ese código' }, { status: 400 });
    console.error('Error al actualizar empleado:', error);
    return NextResponse.json({ error: 'Error al actualizar empleado', detalle: (error as Error).message }, { status: 500 });
  } finally {
    await connection.end();
  }
}

// DELETE ?id=: si ya aparece en revisiones u órdenes, se desactiva en vez de borrarse.
export async function DELETE(request: NextRequest) {
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
  const connection = await connectDB();
  try {
    const [uso] = await connection.execute<RowDataPacket[]>(
      `SELECT (SELECT COUNT(*) FROM estado_partes WHERE idempleado = ?)
            + (SELECT COUNT(*) FROM orden_reparaciones WHERE ? IN (idempleado1, idempleado2, idempleado3)) AS n`,
      [id, id]
    );
    if (Number(uso[0].n) > 0) {
      await connection.execute('UPDATE empleados SET activo = 0 WHERE id = ?', [id]);
      return NextResponse.json({ success: true, mensaje: 'El empleado tiene historial; quedó inactivo' });
    }
    await connection.execute('DELETE FROM empleados WHERE id = ?', [id]);
    return NextResponse.json({ success: true, mensaje: 'Empleado eliminado' });
  } catch (error) {
    console.error('Error al eliminar empleado:', error);
    return NextResponse.json({ error: 'Error al eliminar empleado', detalle: (error as Error).message }, { status: 500 });
  } finally {
    await connection.end();
  }
}
