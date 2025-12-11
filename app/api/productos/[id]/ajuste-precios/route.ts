import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const productId = parseInt(id);

    if (isNaN(productId)) {
      return NextResponse.json(
        { error: 'ID de producto inválido' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      precio1,
      precio2,
      precio3,
      precio4,
      precio5,
      precio6,
      precio7,
      justificacion
    } = body;

    if (!justificacion || justificacion.trim() === '') {
      return NextResponse.json(
        { error: 'La justificación es requerida' },
        { status: 400 }
      );
    }

    const connection = await connectDB();

    // Actualizar precios en la tabla precios
    await connection.execute(
      `UPDATE precios SET 
        precio_general = ?,
        precio_mayorista = ?,
        precio_cliente = ?,
        precio_mecanico = ?,
        precio_minorista = ?,
        precio_especial = ?,
        updated_at = NOW()
      WHERE idprod = ?`,
      [
        precio1 || 0,
        precio2 || 0,
        precio3 || 0,
        precio4 || 0,
        precio5 || 0,
        precio7 || 0,
        productId
      ]
    );

    console.log('✅ Precios actualizados para producto:', productId);

    // Registrar el ajuste en la tabla ajuste_precios
    // TODO: Obtener idusuario de la sesión actual
    const idusuario = 1; // Por ahora hardcodeado, después implementar autenticación

    console.log('📝 Insertando ajuste:', { idusuario, productId, justificacion });

    const [result]: any = await connection.execute(
      `INSERT INTO ajuste_precios (
        idusuario,
        idprod,
        fecha,
        razon_justificacion
      ) VALUES (?, ?, NOW(), ?)`,
      [idusuario, productId, justificacion]
    );

    console.log('✅ Ajuste registrado con ID:', result.insertId);

    await connection.end();

    return NextResponse.json({
      success: true,
      message: 'Ajuste de precios guardado exitosamente'
    });

  } catch (error: any) {
    console.error('Error al guardar ajuste de precios:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
