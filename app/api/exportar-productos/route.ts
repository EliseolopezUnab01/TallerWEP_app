import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import * as XLSX from 'xlsx';

export async function GET(request: NextRequest) {
  try {
    const connection = await connectDB();
    
    // Obtener todos los productos con sus costos
    const [productos]: any = await connection.execute(`
      SELECT 
        p.idprod,
        p.idprodprov,
        p.idprodpaquete,
        p.idprodfisico,
        p.OE,
        p.nombre,
        p.descripcion,
        p.etiquetas,
        p.marca,
        p.peso,
        p.codarancel,
        p.lado,
        p.modelo,
        p.clase,
        p.estilo,
        p.giro,
        p.capacidad,
        p.unimedida,
        p.idcategoria,
        p.codigo_barras,
        p.info_reservada,
        p.info_publica,
        p.info_referencias_directas,
        p.info_referencias_indirectas,
        p.exento,
        p.stock_contable,
        p.stock_fisico,
        p.created_at,
        p.updated_at,
        p.aplicacion_marcas,
        COALESCE(c.costo, p.costo) as costo,
        c.costo_local,
        c.costo_proveedor,
        c.costo_promedio,
        c.iva_pagado,
        c.costo_previo1,
        c.costo_previo2,
        c.costop_previo1,
        c.costop_previo2,
        c.nofactura,
        c.dt_compra
      FROM productos p
      LEFT JOIN costos c ON p.idprod = c.idprod
      ORDER BY p.idprod
    `);
    
    await connection.end();

    if (productos.length === 0) {
      return NextResponse.json({ error: 'No hay productos para exportar' }, { status: 404 });
    }

    // Crear workbook de Excel
    const workbook = XLSX.utils.book_new();
    
    // Convertir datos a formato de hoja
    const worksheet = XLSX.utils.json_to_sheet(productos);
    
    // Agregar la hoja al workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Productos');
    
    // Generar buffer del archivo Excel
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    // Crear respuesta con el archivo
    const response = new NextResponse(excelBuffer);
    response.headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    response.headers.set('Content-Disposition', `attachment; filename="productos_${new Date().toISOString().split('T')[0]}.xlsx"`);
    
    return response;

  } catch (error: any) {
    console.error('Error al exportar productos:', error);
    return NextResponse.json({ error: error.message || 'Error al exportar productos' }, { status: 500 });
  }
}
