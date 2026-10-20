import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let connection;
  try {
    connection = await connectDB();
    const [rows]: any = await connection.execute(
      'SELECT id, nombre, email FROM usuarios WHERE id = ?',
      [userId]
    );
    await connection.end();

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ success: true, user: rows[0] });
  } catch (error: any) {
    if (connection) await connection.end();
    console.error('Error auth/me GET:', error);
    return NextResponse.json({ error: 'Error al obtener perfil' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let connection;
  try {
    const body = await request.json();
    const nombre = String(body.nombre || '').trim();

    if (!nombre) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
    }

    connection = await connectDB();
    await connection.execute('UPDATE usuarios SET nombre = ? WHERE id = ?', [nombre, userId]);

    const [rows]: any = await connection.execute(
      'SELECT id, nombre, email FROM usuarios WHERE id = ?',
      [userId]
    );
    await connection.end();

    return NextResponse.json({
      success: true,
      user: rows[0],
      mensaje: 'Perfil actualizado',
    });
  } catch (error: any) {
    if (connection) await connection.end();
    console.error('Error auth/me PUT:', error);
    return NextResponse.json({ error: 'Error al actualizar perfil' }, { status: 500 });
  }
}
