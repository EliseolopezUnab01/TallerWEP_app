import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';

export async function GET(
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

    const connection = await connectDB();

    console.log('🔍 Buscando historial para producto:', productId);

    // Obtener historial de ajustes de precios con nombre de usuario
    const [historial]: any = await connection.execute(
      `SELECT 
        ap.idajuste,
        ap.idusuario,
        ap.fecha,
        ap.razon_justificacion,
        ap.created_at,
        COALESCE(u.nombre, CONCAT('Usuario ', ap.idusuario)) as nombre_usuario
      FROM ajuste_precios ap
      LEFT JOIN usuarios u ON ap.idusuario = u.id
      WHERE ap.idprod = ?
      ORDER BY ap.fecha DESC`,
      [productId]
    );

    console.log('📊 Historial encontrado:', historial.length, 'registros');
    if (historial.length > 0) {
      console.log('Primer registro:', historial[0]);
    }

    await connection.end();

    return NextResponse.json({
      success: true,
      historial: historial
    });

  } catch (error: any) {
    console.error('Error al obtener historial:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
