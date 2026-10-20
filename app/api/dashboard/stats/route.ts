import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';

export async function GET() {
  let connection;
  try {
    connection = await connectDB();

    const [[inv]]: any = await connection.execute(`
      SELECT
        COUNT(*) AS total_productos,
        SUM(CASE WHEN COALESCE(stock_contable, 0) > 5 THEN 1 ELSE 0 END) AS stock_ok,
        SUM(CASE WHEN COALESCE(stock_contable, 0) > 0 AND COALESCE(stock_contable, 0) <= 5 THEN 1 ELSE 0 END) AS stock_bajo,
        SUM(CASE WHEN COALESCE(stock_contable, 0) = 0 THEN 1 ELSE 0 END) AS stock_cero,
        SUM(CASE WHEN COALESCE(stock_contable, 0) < 0 THEN 1 ELSE 0 END) AS stock_negativo
      FROM productos
    `);

    const [[prov]]: any = await connection.execute(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN activo = TRUE THEN 1 ELSE 0 END) AS activos
      FROM proveedores
    `);

    let compras = { borradores: 0, lineas: 0 };
    try {
      const [[c]]: any = await connection.execute(`
        SELECT
          (SELECT COUNT(*) FROM compras WHERE estado = 'BORRADOR') AS borradores,
          (SELECT COUNT(*) FROM compras_detalle) AS lineas
      `);
      compras = { borradores: c.borradores || 0, lineas: c.lineas || 0 };
    } catch {
      /* tablas compras pueden no existir en BD antigua */
    }

    let rubros = 0;
    try {
      const [[r]]: any = await connection.execute(
        'SELECT COUNT(*) AS total FROM catalogo_contable WHERE activo = TRUE'
      );
      rubros = r.total || 0;
    } catch {
      /* */
    }

    const [categorias]: any = await connection.execute(`
      SELECT
        COALESCE(cn.nombre, 'Sin categoría') AS nombre,
        COUNT(*) AS cantidad
      FROM productos p
      LEFT JOIN categorias_nuevo cn ON p.idcategoria_nuevo = cn.idcategoria
      GROUP BY cn.nombre
      ORDER BY cantidad DESC
      LIMIT 8
    `);

    await connection.end();

    return NextResponse.json({
      success: true,
      inventario: {
        total: inv.total_productos || 0,
        stockOk: inv.stock_ok || 0,
        stockBajo: inv.stock_bajo || 0,
        stockCero: inv.stock_cero || 0,
        stockNegativo: inv.stock_negativo || 0,
      },
      proveedores: {
        total: prov.total || 0,
        activos: prov.activos || 0,
      },
      compras,
      catalogo: { rubrosActivos: rubros },
      categorias: categorias.map((c: { nombre: string; cantidad: number }) => ({
        nombre: c.nombre,
        cantidad: Number(c.cantidad),
      })),
    });
  } catch (error: any) {
    if (connection) await connection.end();
    console.error('Error dashboard stats:', error);
    return NextResponse.json(
      { error: 'Error al cargar estadísticas', detalle: error.message },
      { status: 500 }
    );
  }
}
