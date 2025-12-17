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

    // Obtener historial de ajustes de precios con nombre de usuario y precios
    const [historial]: any = await connection.execute(
      `SELECT 
        ap.idajuste,
        ap.idusuario,
        ap.fecha,
        ap.razon_justificacion,
        ap.created_at,
        COALESCE(u.nombre, CONCAT('Usuario ', ap.idusuario)) as nombre_usuario,
        ap.precio1_anterior,
        ap.precio2_anterior,
        ap.precio3_anterior,
        ap.precio4_anterior,
        ap.precio5_anterior,
        ap.precio6_anterior,
        ap.precio7_anterior,
        ap.precio1_nuevo,
        ap.precio2_nuevo,
        ap.precio3_nuevo,
        ap.precio4_nuevo,
        ap.precio5_nuevo,
        ap.precio6_nuevo,
        ap.precio7_nuevo
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
