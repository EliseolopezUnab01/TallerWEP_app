import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { promedioActual, registrarCosto } from '@/lib/costos';

// GET - Costo de un producto o todos los costos
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const idprod = searchParams.get('idprod');

  let connection: Awaited<ReturnType<typeof connectDB>> | undefined;
  try {
    connection = await connectDB();

    if (idprod) {
      const [rows]: any = await connection.execute(
        `SELECT c.*, p.nombre AS producto_nombre, p.OE, p.marca
         FROM costos c INNER JOIN productos p ON c.idprod = p.idprod
         WHERE c.idprod = ?`,
        [idprod]
      );
      if (rows.length === 0) {
        return NextResponse.json({ error: 'Costo no encontrado para este producto' }, { status: 404 });
      }
      return NextResponse.json({ success: true, costo: rows[0] });
    }

    const [rows]: any = await connection.execute(
      `SELECT c.*, p.nombre AS producto_nombre, p.OE, p.marca
       FROM costos c INNER JOIN productos p ON c.idprod = p.idprod
       ORDER BY c.updated_at DESC`
    );
    return NextResponse.json({ success: true, costos: rows });
  } catch (error) {
    console.error('Error al obtener costos:', error);
    return NextResponse.json({ error: 'Error al obtener costos' }, { status: 500 });
  } finally {
    if (connection) await connection.end();
  }
}

/**
 * POST - Corrección manual del costo vigente. Pasa por la misma escalera de respaldos que las compras,
 * así el costo anterior queda en costo_previo1 / costolcl_previo1.
 */
export async function POST(request: NextRequest) {
  let connection: Awaited<ReturnType<typeof connectDB>> | undefined;
  try {
    const body = await request.json();
    const idprod = Number(body.idprod);
    const costo = Number(body.costo);
    if (!idprod) return NextResponse.json({ error: 'idprod es requerido' }, { status: 400 });
    if (!Number.isFinite(costo) || costo < 0) {
      return NextResponse.json({ error: 'El costo debe ser un número mayor o igual a cero' }, { status: 400 });
    }
    const costoLocal = body.costo_local === undefined || body.costo_local === '' ? costo : Number(body.costo_local);
    if (!Number.isFinite(costoLocal) || costoLocal < 0) {
      return NextResponse.json({ error: 'El costo local no es válido' }, { status: 400 });
    }

    connection = await connectDB();
    const [prod]: any = await connection.execute('SELECT idprod FROM productos WHERE idprod = ?', [idprod]);
    if (prod.length === 0) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });

    const promedio = (await promedioActual(connection, idprod)) || costoLocal;
    await connection.beginTransaction();
    await registrarCosto(connection, {
      idprod,
      costoFactura: costo,
      costoLocal,
      promedio,
      costoProveedor: body.costo_proveedor === undefined ? null : Number(body.costo_proveedor) || 0,
      ivaUnitario: Number(body.iva_pagado) || 0,
      nofactura: body.nofactura || null,
      dtCompra: body.dt_compra || null,
    });
    await connection.commit();
    return NextResponse.json({ success: true, message: 'Costo corregido; el anterior quedó como respaldo' });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    console.error('Error al guardar costo:', error);
    return NextResponse.json({ error: 'Error al guardar costo' }, { status: 500 });
  } finally {
    if (connection) await connection.end();
  }
}
