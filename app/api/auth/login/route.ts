import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { comparePasswords, generateToken } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email y contraseña son requeridos' },
        { status: 400 }
      );
    }

    const connection = await connectDB();
    
    const [rows]: any = await connection.execute(
      'SELECT * FROM usuarios WHERE email = ?',
      [email]
    );

    await connection.end();

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'Credenciales inválidas' },
        { status: 401 }
      );
    }

    const user = rows[0];
    const isPasswordValid = await comparePasswords(password, user.password);

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Credenciales inválidas' },
        { status: 401 }
      );
    }

    const token = generateToken(user.id);

    return NextResponse.json({
      message: 'Login exitoso',
      token,
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre
      }
    });

  } catch (error) {
    console.error('Login API error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}