import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';

// GET: Obtener historial de ajustes de un producto
export async function GET(request: Request) {
  let connection;
  try {
    const { searchParams } = new URL(request.url);
    const idprod = searchParams.get('idprod');

    if (!idprod) {
      return NextResponse.json({ error: 'Se requiere idprod' }, { status: 400 });
    }

    connection = await connectDB();

    // Consultar historial con todos los precios anteriores y nuevos
    const [historial]: any = await connection.execute(`
      SELECT 
        ap.idajuste,
        ap.fecha,
        ap.razon_justificacion,
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
        ap.precio7_nuevo,
        u.nombre as usuario_nombre
      FROM ajuste_precios ap
      LEFT JOIN usuarios u ON ap.idusuario = u.id
      WHERE ap.idprod = ?
      ORDER BY ap.fecha DESC
      LIMIT 10
    `, [idprod]);

    await connection.end();

    return NextResponse.json({
      success: true,
      historial
    });
  } catch (error) {
    console.error('Error al obtener historial:', error);
    if (connection) await connection.end();
    return NextResponse.json({ 
      error: 'Error al obtener historial de ajustes',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
