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

    // PRIMERO: Obtener los precios actuales (antes de modificar)
    const [preciosActuales]: any = await connection.execute(
      `SELECT 
        precio_general as precio1,
        precio_mayorista as precio2,
        precio_cliente as precio3,
        precio_mecanico as precio4,
        precio_minorista as precio5,
        precio_especial as precio6,
        precio_especial as precio7
      FROM precios WHERE idprod = ?`,
      [productId]
    );

    const preciosAnteriores = preciosActuales[0] || {
      precio1: 0, precio2: 0, precio3: 0, precio4: 0, precio5: 0, precio6: 0, precio7: 0
    };

    console.log('📊 Precios anteriores:', preciosAnteriores);

    // SEGUNDO: Actualizar precios en la tabla precios
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

    // TERCERO: Registrar el ajuste con precios anteriores y nuevos
    // TODO: Obtener idusuario de la sesión actual
    const idusuario = 1; // Por ahora hardcodeado, después implementar autenticación

    console.log('📝 Insertando ajuste con historial de precios...');

    const [result]: any = await connection.execute(
      `INSERT INTO ajuste_precios (
        idusuario,
        idprod,
        fecha,
        razon_justificacion,
        precio1_anterior,
        precio2_anterior,
        precio3_anterior,
        precio4_anterior,
        precio5_anterior,
        precio6_anterior,
        precio7_anterior,
        precio1_nuevo,
        precio2_nuevo,
        precio3_nuevo,
        precio4_nuevo,
        precio5_nuevo,
        precio6_nuevo,
        precio7_nuevo
      ) VALUES (?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        idusuario, 
        productId, 
        justificacion,
        preciosAnteriores.precio1 || 0,
        preciosAnteriores.precio2 || 0,
        preciosAnteriores.precio3 || 0,
        preciosAnteriores.precio4 || 0,
        preciosAnteriores.precio5 || 0,
        preciosAnteriores.precio6 || 0,
        preciosAnteriores.precio7 || 0,
        precio1 || 0,
        precio2 || 0,
        precio3 || 0,
        precio4 || 0,
        precio5 || 0,
        precio6 || 0,
        precio7 || 0
      ]
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
