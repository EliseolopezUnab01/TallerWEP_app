import { NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2/promise';
import { connectDB } from '@/lib/db';
import { COOKIE_SESION, DURACION_SESION_SEG, comparePasswords, generateToken } from '@/lib/auth';
import { cargarSesion, olvidarSesiones } from '@/lib/sesion';

export async function POST(request: Request) {
  let connection;
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email y contraseña son requeridos' }, { status: 400 });
    }

    connection = await connectDB();
    const [rows] = await connection.execute<RowDataPacket[]>(
      'SELECT id, password, activo FROM usuarios WHERE email = ?',
      [email]
    );
    const user = rows[0];
    if (!user || !(await comparePasswords(password, user.password))) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }
    if (Number(user.activo) !== 1) {
      return NextResponse.json({ error: 'El usuario está desactivado' }, { status: 403 });
    }
    await connection.execute('UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = ?', [user.id]);

    olvidarSesiones();
    const sesion = await cargarSesion(Number(user.id));
    const token = generateToken(Number(user.id));
    const res = NextResponse.json({ message: 'Login exitoso', token, user: sesion });
    res.cookies.set(COOKIE_SESION, token, {
      httpOnly: true,
      sameSite: 'lax',
      // Solo con HTTPS; en la red local del taller se entra por http.
      secure: process.env.COOKIE_SEGURA === '1',
      path: '/',
      maxAge: DURACION_SESION_SEG,
    });
    return res;
  } catch (error) {
    console.error('Login API error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  } finally {
    if (connection) await connection.end();
  }
}
