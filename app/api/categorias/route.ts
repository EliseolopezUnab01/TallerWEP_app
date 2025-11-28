import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';

// GET: Obtener todas las categorías
export async function GET() {
  try {
    const connection = await connectDB();
    
    const [categorias]: any = await connection.execute(`
      SELECT * FROM categorias 
      ORDER BY idcategoria
    `);

    await connection.end();

    return NextResponse.json({ categorias });
  } catch (error) {
    console.error('Error al obtener categorías:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST: Crear nueva categoría
export async function POST(request: Request) {
  try {
    const { idcategoria, nombre, descripcion } = await request.json();

    // Validaciones
    if (!idcategoria || !nombre) {
      return NextResponse.json(
        { error: 'Código y nombre de categoría son requeridos' },
        { status: 400 }
      );
    }

    if (idcategoria.length > 6) {
      return NextResponse.json(
        { error: 'El código de categoría no puede tener más de 6 caracteres' },
        { status: 400 }
      );
    }

    const connection = await connectDB();

    // Verificar si ya existe la categoría
    const [existing]: any = await connection.execute(
      'SELECT idcategoria FROM categorias WHERE idcategoria = ?',
      [idcategoria]
    );

    if (existing.length > 0) {
      await connection.end();
      return NextResponse.json(
        { error: 'Ya existe una categoría con este código' },
        { status: 400 }
      );
    }

    // Insertar nueva categoría
    await connection.execute(
      'INSERT INTO categorias (idcategoria, nombre, descripcion) VALUES (?, ?, ?)',
      [idcategoria, nombre, descripcion || null]
    );

    await connection.end();

    return NextResponse.json({
      success: true,
      message: 'Categoría creada exitosamente'
    });

  } catch (error) {
    console.error('Error al crear categoría:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}