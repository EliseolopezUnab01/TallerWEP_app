import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';

export async function GET() {
  let connection;
  try {
    connection = await connectDB();

    const [tipos_dte]: any = await connection.execute(
      `SELECT codigo, nombre, abreviatura, descripcion
       FROM cat_tipos_dte
       WHERE activo_compras = 1
       ORDER BY codigo ASC`
    );

    const [formas_pago]: any = await connection.execute(
      'SELECT codigo, nombre FROM cat_formas_pago ORDER BY codigo ASC'
    );

    const [tributos]: any = await connection.execute(
      'SELECT codigo, nombre, seccion, tasa FROM cat_tributos ORDER BY codigo ASC'
    );

    await connection.end();

    return NextResponse.json({
      success: true,
      tipos_dte,
      formas_pago,
      tributos,
    });
  } catch (error: any) {
    if (connection) await connection.end();
    console.error('Error al obtener catálogos DTE:', error);
    return NextResponse.json(
      { error: 'Error al obtener catálogos DTE', detalle: error.message },
      { status: 500 }
    );
  }
}
