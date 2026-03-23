import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';

// GET - Obtener costos de un producto o todos los costos
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const idprod = searchParams.get('idprod');

  try {
    const connection = await connectDB();

    if (idprod) {
      // Obtener costo de un producto específico
      const [rows]: any = await connection.execute(`
        SELECT 
          c.*,
          p.nombre as producto_nombre,
          p.OE,
          p.marca
        FROM costos c
        INNER JOIN productos p ON c.idprod = p.idprod
        WHERE c.idprod = ?
      `, [idprod]);

      await connection.end();

      if (rows.length === 0) {
        return NextResponse.json({ error: 'Costo no encontrado para este producto' }, { status: 404 });
      }

      return NextResponse.json({ success: true, costo: rows[0] });
    } else {
      // Obtener todos los costos
      const [rows]: any = await connection.execute(`
        SELECT 
          c.*,
          p.nombre as producto_nombre,
          p.OE,
          p.marca
        FROM costos c
        INNER JOIN productos p ON c.idprod = p.idprod
        ORDER BY c.updated_at DESC
      `);

      await connection.end();
      return NextResponse.json({ success: true, costos: rows });
    }
  } catch (error) {
    console.error('Error al obtener costos:', error);
    return NextResponse.json({ error: 'Error al obtener costos' }, { status: 500 });
  }
}

// POST - Crear o actualizar costo de un producto (con rotación de respaldos)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      idprod, 
      costo, 
      costo_proveedor, 
      iva_pagado, 
      nofactura, 
      dt_compra 
    } = body;

    if (!idprod) {
      return NextResponse.json({ error: 'idprod es requerido' }, { status: 400 });
    }

    const connection = await connectDB();

    // Verificar si ya existe un registro de costo para este producto
    const [existing]: any = await connection.execute(
      'SELECT * FROM costos WHERE idprod = ?',
      [idprod]
    );

    if (existing.length > 0) {
      // Actualizar con rotación de respaldos
      const costoActual = existing[0];
      
      await connection.execute(`
        UPDATE costos SET
          -- Rotar respaldos de costo_local
          costo_previo2 = costo_previo1,
          costo_previo1 = costo_local,
          
          -- Rotar respaldos de costo_promedio
          costop_previo2 = costop_previo1,
          costop_previo1 = costo_promedio,
          
          -- Actualizar valores actuales
          costo = ?,
          costo_local = ?,
          costo_proveedor = ?,
          iva_pagado = ?,
          costo_promedio = (costo_promedio + ?) / 2,
          
          -- Datos de factura
          nofactura = ?,
          dt_compra = ?
        WHERE idprod = ?
      `, [
        costo || 0,
        costo || 0,
        costo_proveedor || 0,
        iva_pagado || 0,
        costo || 0,
        nofactura || null,
        dt_compra || null,
        idprod
      ]);

      await connection.end();
      return NextResponse.json({ 
        success: true, 
        message: 'Costo actualizado con respaldos',
        respaldos: {
          costo_previo1: costoActual.costo_local,
          costo_previo2: costoActual.costo_previo1
        }
      });
    } else {
      // Crear nuevo registro de costo
      await connection.execute(`
        INSERT INTO costos (idprod, costo, costo_local, costo_proveedor, iva_pagado, costo_promedio, nofactura, dt_compra)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        idprod,
        costo || 0,
        costo || 0,
        costo_proveedor || 0,
        iva_pagado || 0,
        costo || 0,
        nofactura || null,
        dt_compra || null
      ]);

      await connection.end();
      return NextResponse.json({ success: true, message: 'Costo creado exitosamente' });
    }
  } catch (error) {
    console.error('Error al guardar costo:', error);
    return NextResponse.json({ error: 'Error al guardar costo' }, { status: 500 });
  }
}

// PUT - Actualizar costo sin rotación de respaldos (edición directa)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      idprod, 
      costo, 
      costo_local,
      costo_proveedor, 
      costo_promedio,
      iva_pagado, 
      nofactura, 
      dt_compra 
    } = body;

    if (!idprod) {
      return NextResponse.json({ error: 'idprod es requerido' }, { status: 400 });
    }

    const connection = await connectDB();

    // Verificar si existe
    const [existing]: any = await connection.execute(
      'SELECT idcosto FROM costos WHERE idprod = ?',
      [idprod]
    );

    if (existing.length === 0) {
      await connection.end();
      return NextResponse.json({ error: 'Registro de costo no encontrado' }, { status: 404 });
    }

    // Construir query de actualización dinámicamente
    const updates: string[] = [];
    const values: any[] = [];

    if (costo !== undefined) { updates.push('costo = ?'); values.push(costo); }
    if (costo_local !== undefined) { updates.push('costo_local = ?'); values.push(costo_local); }
    if (costo_proveedor !== undefined) { updates.push('costo_proveedor = ?'); values.push(costo_proveedor); }
    if (costo_promedio !== undefined) { updates.push('costo_promedio = ?'); values.push(costo_promedio); }
    if (iva_pagado !== undefined) { updates.push('iva_pagado = ?'); values.push(iva_pagado); }
    if (nofactura !== undefined) { updates.push('nofactura = ?'); values.push(nofactura); }
    if (dt_compra !== undefined) { updates.push('dt_compra = ?'); values.push(dt_compra); }

    if (updates.length === 0) {
      await connection.end();
      return NextResponse.json({ error: 'No hay campos para actualizar' }, { status: 400 });
    }

    values.push(idprod);
    await connection.execute(
      `UPDATE costos SET ${updates.join(', ')} WHERE idprod = ?`,
      values
    );

    await connection.end();
    return NextResponse.json({ success: true, message: 'Costo actualizado' });
  } catch (error) {
    console.error('Error al actualizar costo:', error);
    return NextResponse.json({ error: 'Error al actualizar costo' }, { status: 500 });
  }
}

// DELETE - Eliminar registro de costo
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const idprod = searchParams.get('idprod');

  if (!idprod) {
    return NextResponse.json({ error: 'idprod es requerido' }, { status: 400 });
  }

  try {
    const connection = await connectDB();
    
    await connection.execute('DELETE FROM costos WHERE idprod = ?', [idprod]);
    
    await connection.end();
    return NextResponse.json({ success: true, message: 'Costo eliminado' });
  } catch (error) {
    console.error('Error al eliminar costo:', error);
    return NextResponse.json({ error: 'Error al eliminar costo' }, { status: 500 });
  }
}
