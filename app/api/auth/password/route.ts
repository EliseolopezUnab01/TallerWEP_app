import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { comparePasswords, getUserIdFromRequest, hashPassword } from '@/lib/auth';

export async function PUT(request: NextRequest) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let connection;
  try {
    const body = await request.json();
    const actual = String(body.password_actual || '');
    const nueva = String(body.password_nueva || '');
    const confirmar = String(body.password_confirmar || '');

    if (!actual || !nueva) {
      return NextResponse.json(
        { error: 'Indique la contraseña actual y la nueva' },
        { status: 400 }
      );
    }

    if (nueva.length < 6) {
      return NextResponse.json(
        { error: 'La nueva contraseña debe tener al menos 6 caracteres' },
        { status: 400 }
      );
    }

    if (nueva !== confirmar) {
      return NextResponse.json(
        { error: 'La confirmación no coincide con la nueva contraseña' },
        { status: 400 }
      );
    }

    connection = await connectDB();
    const [rows]: any = await connection.execute(
      'SELECT password FROM usuarios WHERE id = ?',
      [userId]
    );

    if (rows.length === 0) {
      await connection.end();
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const valida = await comparePasswords(actual, rows[0].password);
    if (!valida) {
      await connection.end();
      return NextResponse.json({ error: 'La contraseña actual es incorrecta' }, { status: 401 });
    }

    const hash = await hashPassword(nueva);
    await connection.execute('UPDATE usuarios SET password = ? WHERE id = ?', [hash, userId]);
    await connection.end();

    return NextResponse.json({ success: true, mensaje: 'Contraseña actualizada' });
  } catch (error: any) {
    if (connection) await connection.end();
    console.error('Error auth/password:', error);
    return NextResponse.json({ error: 'Error al cambiar contraseña' }, { status: 500 });
  }
}
