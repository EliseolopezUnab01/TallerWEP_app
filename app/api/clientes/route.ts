import { NextRequest, NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2/promise';
import { connectDB } from '@/lib/db';
import {
  CAMPOS_CLIENTE,
  actualizarFila,
  codigoSiguiente,
  errorDuplicado,
  extraerCampos,
  insertarFila,
} from '@/lib/taller';

// GET: lista (?q=, ?activos=1) | ?id= (cliente y sus vehículos)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get('id')) || 0;
  const connection = await connectDB();
  try {
    if (id) {
      const [rows] = await connection.execute<RowDataPacket[]>('SELECT * FROM clientes WHERE id = ?', [id]);
      if (!rows[0]) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
      const [vehiculos] = await connection.execute<RowDataPacket[]>(
        `SELECT id, codigo, placa, anio_placa, marca, modelo, anio_modelo, color, activo
         FROM vehiculos WHERE cliente_id = ? ORDER BY placa`,
        [id]
      );
      return NextResponse.json({ success: true, cliente: rows[0], vehiculos });
    }

    const filtros: string[] = [];
    const valores: string[] = [];
    const q = searchParams.get('q')?.trim();
    if (q) {
      filtros.push('(c.codigo LIKE ? OR c.nombre LIKE ? OR c.dui LIKE ? OR c.nit LIKE ? OR c.telefono LIKE ?)');
      const like = `%${q}%`;
      valores.push(like, like, like, like, like);
    }
    if (searchParams.get('activos') === '1') filtros.push('c.activo = 1');
    const [clientes] = await connection.execute<RowDataPacket[]>(
      `SELECT c.id, c.codigo, c.nombre, c.tipo, c.dui, c.nit, c.nrc, c.telefono, c.municipio, c.activo,
              (SELECT COUNT(*) FROM vehiculos v WHERE v.cliente_id = c.id) AS vehiculos
       FROM clientes c
       ${filtros.length ? `WHERE ${filtros.join(' AND ')}` : ''}
       ORDER BY c.nombre LIMIT 300`,
      valores
    );
    return NextResponse.json({ success: true, clientes });
  } catch (error) {
    console.error('Error al obtener clientes:', error);
    return NextResponse.json({ error: 'Error al obtener clientes', detalle: (error as Error).message }, { status: 500 });
  } finally {
    await connection.end();
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Record<string, unknown>;
  const datos = extraerCampos(body, CAMPOS_CLIENTE);
  if (!datos.nombre) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
  const connection = await connectDB();
  try {
    if (!datos.codigo) datos.codigo = await codigoSiguiente(connection, 'clientes', 'CLI');
    if (datos.activo === undefined) datos.activo = 1;
    const id = await insertarFila(connection, 'clientes', datos);
    return NextResponse.json({ success: true, id, codigo: datos.codigo, mensaje: `Cliente ${datos.codigo} creado` });
  } catch (error) {
    if (errorDuplicado(error)) return NextResponse.json({ error: 'Ya existe un cliente con ese código' }, { status: 400 });
    console.error('Error al crear cliente:', error);
    return NextResponse.json({ error: 'Error al crear cliente', detalle: (error as Error).message }, { status: 500 });
  } finally {
    await connection.end();
  }
}

export async function PUT(request: NextRequest) {
  const body = (await request.json()) as Record<string, unknown>;
  const id = Number(body.id);
  if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
  const datos = extraerCampos(body, CAMPOS_CLIENTE);
  if ('nombre' in datos && !datos.nombre) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
  if ('codigo' in datos && !datos.codigo) return NextResponse.json({ error: 'El código es obligatorio' }, { status: 400 });
  const connection = await connectDB();
  try {
    await actualizarFila(connection, 'clientes', 'id', id, datos);
    return NextResponse.json({ success: true, mensaje: 'Cliente guardado' });
  } catch (error) {
    if (errorDuplicado(error)) return NextResponse.json({ error: 'Ya existe un cliente con ese código' }, { status: 400 });
    console.error('Error al actualizar cliente:', error);
    return NextResponse.json({ error: 'Error al actualizar cliente', detalle: (error as Error).message }, { status: 500 });
  } finally {
    await connection.end();
  }
}

// DELETE ?id=: solo si no tiene vehículos ni órdenes; si los tiene, se desactiva.
export async function DELETE(request: NextRequest) {
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
  const connection = await connectDB();
  try {
    const [uso] = await connection.execute<RowDataPacket[]>(
      `SELECT (SELECT COUNT(*) FROM vehiculos WHERE cliente_id = ?) AS vehiculos,
              (SELECT COUNT(*) FROM ordenes_trabajo WHERE cliente_id = ?) AS ordenes`,
      [id, id]
    );
    if (Number(uso[0].vehiculos) + Number(uso[0].ordenes) > 0) {
      await connection.execute('UPDATE clientes SET activo = 0 WHERE id = ?', [id]);
      return NextResponse.json({ success: true, mensaje: 'El cliente tiene vehículos u órdenes; quedó inactivo' });
    }
    await connection.execute('DELETE FROM clientes WHERE id = ?', [id]);
    return NextResponse.json({ success: true, mensaje: 'Cliente eliminado' });
  } catch (error) {
    console.error('Error al eliminar cliente:', error);
    return NextResponse.json({ error: 'Error al eliminar cliente', detalle: (error as Error).message }, { status: 500 });
  } finally {
    await connection.end();
  }
}
