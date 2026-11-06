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

    const ordenes = { PROCESO: 0, ESPERA: 0, FINALIZADA: 0, CANCELADA: 0, abiertas: 0 };
    try {
      const [filas]: any = await connection.execute(
        `SELECT estado, COUNT(*) AS total FROM ordenes_trabajo
          WHERE estado IN ('PROCESO','ESPERA') OR COALESCE(fecha_final, fecha_inicial) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
          GROUP BY estado`
      );
      for (const f of filas) {
        if (f.estado in ordenes) ordenes[f.estado as keyof typeof ordenes] = Number(f.total);
      }
      ordenes.abiertas = ordenes.PROCESO + ordenes.ESPERA;
    } catch {
      /* tabla de órdenes puede no existir en BD antigua */
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
        total: Number(inv.total_productos) || 0,
        stockOk: Number(inv.stock_ok) || 0,
        stockBajo: Number(inv.stock_bajo) || 0,
        stockCero: Number(inv.stock_cero) || 0,
        stockNegativo: Number(inv.stock_negativo) || 0,
      },
      proveedores: {
        total: Number(prov.total) || 0,
        activos: Number(prov.activos) || 0,
      },
      compras: { borradores: Number(compras.borradores) || 0, lineas: Number(compras.lineas) || 0 },
      ordenes,
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
  } finally {
    if (connection) await connection.end();
  }
}
