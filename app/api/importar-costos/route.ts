import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import * as XLSX from 'xlsx';

// Mapeo de columnas del Excel a campos de la base de datos
const COLUMN_MAPPING: { [key: string]: string } = {
  // ID del producto
  'idprod': 'idprod',
  'id producto': 'idprod',
  'oe': 'OE',
  'referencia': 'OE',
  'referencia oe': 'OE',
  
  // Factura/Referencia
  'nofactura': 'nofactura',
  'no factura': 'nofactura',
  'numero factura': 'nofactura',
  'factura': 'nofactura',
  'referencia_costo': 'nofactura',
  'referencia costo': 'nofactura',
  'nodocto': 'nofactura',
  
  // Fecha
  'dt_compra': 'dt_compra',
  'fecha compra': 'dt_compra',
  'fecha': 'dt_compra',
  'fecha_referencia': 'dt_compra',
  'fecha referencia': 'dt_compra',
  
  // Costos - Nombres del cliente
  'costo': 'costo',
  'costo factura': 'costo',
  'costo_usd': 'costo',
  'costo usd': 'costo',
  
  'costo_proveedor': 'costo_proveedor',
  'costo proveedor': 'costo_proveedor',
  'costo_cambio_pagado': 'costo_proveedor',
  'costo cambio pagado': 'costo_proveedor',
  
  'costo_promedio': 'costo_promedio',
  'costo promedio': 'costo_promedio',
  
  'costo_local': 'costo_local',
  'costo local': 'costo_local',
  
  'costo_lclpromedio': 'costo_lclpromedio',
  'costo lclpromedio': 'costo_lclpromedio',
  
  'iva_pagado': 'iva_pagado',
  'iva pagado': 'iva_pagado',
  'iva': 'iva_pagado',
  
  // Campos de respaldo del cliente
  'costo_previo1': 'costo_previo1',
  'costo previo1': 'costo_previo1',
  'costo_previo2': 'costo_previo2',
  'costo previo2': 'costo_previo2',
  'costolcl_previo1': 'costop_previo1',
  'costolcl previo1': 'costop_previo1',
  'costolcl_previo2': 'costop_previo2',
  'costolcl previo2': 'costop_previo2',
};

function normalizeColumnName(name: string): string {
  return name.toLowerCase().trim().replace(/[_\-]/g, ' ');
}

function mapColumns(headers: string[]): { [key: number]: string } {
  const mapping: { [key: number]: string } = {};
  
  headers.forEach((header, index) => {
    const normalized = normalizeColumnName(header);
    if (COLUMN_MAPPING[normalized]) {
      mapping[index] = COLUMN_MAPPING[normalized];
    } else if (COLUMN_MAPPING[header.toLowerCase()]) {
      mapping[index] = COLUMN_MAPPING[header.toLowerCase()];
    }
  });
  
  return mapping;
}

// POST - Procesar archivo Excel de costos
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const action = formData.get('action') as string;

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 });
    }

    // Leer el archivo Excel/CSV
    const bytes = await file.arrayBuffer();
    const fileName = file.name.toLowerCase();
    
    let workbook;
    
    // Si es CSV, procesar con manejo especial de comillas
    if (fileName.endsWith('.csv')) {
      let text = new TextDecoder('utf-8').decode(bytes);
      
      if (text.includes('�')) {
        text = new TextDecoder('latin1').decode(bytes);
      }
      
      // Función para parsear una línea CSV
      const parseCSVLine = (line: string): string[] => {
        const row: string[] = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          
          if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
              current += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === ',' && !inQuotes) {
            row.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        row.push(current.trim());
        return row;
      };
      
      // Parsear CSV completo
      const lines = text.split(/\r?\n/);
      const csvData: string[][] = [];
      
      for (const line of lines) {
        if (!line.trim()) continue;
        csvData.push(parseCSVLine(line));
      }
      
      console.log(`📄 CSV parseado: ${csvData.length} filas`);
      console.log(`📄 Primera fila (${csvData[0]?.length} cols): ${JSON.stringify(csvData[0]?.slice(0, 5))}`);
      console.log(`📄 Segunda fila (${csvData[1]?.length} cols): ${JSON.stringify(csvData[1]?.slice(0, 5))}`);
      
      // Si la segunda fila tiene menos columnas que la primera, re-parsear
      if (csvData.length > 1 && csvData[0].length > 5 && csvData[1].length <= 5) {
        const firstDataCell = csvData[1][0];
        if (firstDataCell && firstDataCell.includes(',')) {
          console.log('⚠️ Detectado: datos en una sola columna, re-parseando...');
          for (let i = 1; i < csvData.length; i++) {
            if (csvData[i][0] && csvData[i][0].includes(',')) {
              csvData[i] = parseCSVLine(csvData[i][0]);
            }
          }
          console.log(`📄 Re-parseado: segunda fila ahora tiene ${csvData[1]?.length} cols`);
        }
      }
      
      const ws = XLSX.utils.aoa_to_sheet(csvData);
      workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, ws, 'Sheet1');
    } else {
      workbook = XLSX.read(bytes, { type: 'array' });
    }
    
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    if (rawData.length < 2) {
      return NextResponse.json({ error: 'El archivo está vacío o no tiene datos' }, { status: 400 });
    }

    const headers = rawData[0].map((h: any) => String(h || ''));
    const columnMapping = mapColumns(headers);
    
    // Verificar que tengamos OE (preferido) o idprod, y costo
    const hasIdProd = Object.values(columnMapping).includes('idprod');
    const hasOE = Object.values(columnMapping).includes('OE');
    const hasCosto = Object.values(columnMapping).includes('costo');
    
    if ((!hasIdProd && !hasOE) || !hasCosto) {
      return NextResponse.json({ 
        error: 'El archivo debe contener al menos las columnas "OE" (preferido) o "idprod" y "costo"',
        headers: headers,
        mappedColumns: columnMapping
      }, { status: 400 });
    }

    const costos: any[] = [];
    const errores: { fila: number; error: string }[] = [];

    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || row.length === 0 || row.every((cell: any) => !cell)) continue;

      const costoData: any = {};
      
      Object.entries(columnMapping).forEach(([colIndex, fieldName]) => {
        const value = row[parseInt(colIndex)];
        if (value !== undefined && value !== null && value !== '') {
          costoData[fieldName] = value;
        }
      });

      // Validar campos requeridos - solo idprod es obligatorio
      if (!costoData.idprod && !costoData.OE) {
        errores.push({ fila: i + 1, error: 'Falta idprod o referencia OE' });
        continue;
      }

      // Costo es opcional, si no existe se pone 0
      if (costoData.costo === undefined || costoData.costo === null || costoData.costo === '') {
        costoData.costo = 0;
      }

      // Convertir valores numéricos
      costoData.costo = parseFloat(costoData.costo) || 0;
      costoData.costo_proveedor = parseFloat(costoData.costo_proveedor) || 0;
      costoData.costo_promedio = parseFloat(costoData.costo_promedio) || 0;
      costoData.costo_local = parseFloat(costoData.costo_local) || costoData.costo;
      costoData.costo_lclpromedio = parseFloat(costoData.costo_lclpromedio) || 0;
      costoData.iva_pagado = parseFloat(costoData.iva_pagado) || 0;
      costoData.costo_previo1 = parseFloat(costoData.costo_previo1) || 0;
      costoData.costo_previo2 = parseFloat(costoData.costo_previo2) || 0;
      costoData.costop_previo1 = parseFloat(costoData.costop_previo1) || 0;
      costoData.costop_previo2 = parseFloat(costoData.costop_previo2) || 0;
      costoData._fila = i + 1;

      costos.push(costoData);
    }

    if (action === 'preview') {
      return NextResponse.json({
        success: true,
        headers: headers,
        columnMapping: columnMapping,
        totalFilas: rawData.length - 1,
        costosValidos: costos.length,
        errores: errores,
        preview: costos.slice(0, 10)
      });
    }

    if (action === 'import') {
      const connection = await connectDB();
      let actualizados = 0;
      let creados = 0;
      const erroresImport: { fila: number; error: string }[] = [];

      // Cargar mapeo de IDs guardado por la importación de productos
      let mapeoIds: { [key: string]: number } = {};
      try {
        const fs = await import('fs/promises');
        const path = await import('path');
        const mapeoPath = path.join(process.cwd(), 'temp_mapeo_ids.json');
        const mapeoData = await fs.readFile(mapeoPath, 'utf-8');
        mapeoIds = JSON.parse(mapeoData);
        console.log(`📋 Mapeo de IDs cargado: ${Object.keys(mapeoIds).length} registros`);
      } catch (e) {
        console.log('⚠️ No se encontró mapeo de IDs previo, se buscará por OE o idprod directo');
      }

      for (const costoData of costos) {
        try {
          let idprod = null;

          // 1. Primero intentar usar el mapeo guardado (idprod_excel → idprod_nuevo)
          if (costoData.idprod && mapeoIds[String(costoData.idprod)]) {
            idprod = mapeoIds[String(costoData.idprod)];
            console.log(`✅ Mapeo encontrado: ${costoData.idprod} → ${idprod}`);
          }
          
          // 2. Si no hay mapeo, buscar por OE
          if (!idprod && costoData.OE) {
            const [productos]: any = await connection.execute(
              'SELECT idprod FROM productos WHERE OE = ?',
              [costoData.OE]
            );
            if (productos.length > 0) {
              idprod = productos[0].idprod;
            }
          }
          
          // 3. Si no encontró por OE, intentar buscar por idprod directo (por si coincide)
          if (!idprod && costoData.idprod) {
            const [productos]: any = await connection.execute(
              'SELECT idprod FROM productos WHERE idprod = ?',
              [costoData.idprod]
            );
            if (productos.length > 0) {
              idprod = productos[0].idprod;
            }
          }

          if (!idprod) {
            erroresImport.push({ fila: costoData._fila, error: `Producto no encontrado (idprod Excel: ${costoData.idprod || 'N/A'}, OE: ${costoData.OE || 'N/A'})` });
            continue;
          }

          // Verificar si ya existe registro de costo para este producto
          const [existing]: any = await connection.execute(
            'SELECT idcosto, costo_local FROM costos WHERE idprod = ?',
            [idprod]
          );

          if (existing.length > 0) {
            // Actualizar - Si el Excel trae campos de respaldo, usarlos; si no, rotar
            const usarRespaldosExcel = costoData.costo_previo1 > 0 || costoData.costo_previo2 > 0;
            
            if (usarRespaldosExcel) {
              // Importación con datos completos del cliente
              await connection.execute(`
                UPDATE costos SET
                  costo = ?,
                  costo_proveedor = ?,
                  costo_promedio = ?,
                  costo_local = ?,
                  iva_pagado = ?,
                  costo_previo1 = ?,
                  costo_previo2 = ?,
                  costop_previo1 = ?,
                  costop_previo2 = ?,
                  nofactura = ?,
                  dt_compra = ?
                WHERE idprod = ?
              `, [
                costoData.costo,
                costoData.costo_proveedor,
                costoData.costo_promedio,
                costoData.costo_local,
                costoData.iva_pagado,
                costoData.costo_previo1,
                costoData.costo_previo2,
                costoData.costop_previo1,
                costoData.costop_previo2,
                costoData.nofactura || null,
                costoData.dt_compra || null,
                idprod
              ]);
            } else {
              // Rotación automática de respaldos
              await connection.execute(`
                UPDATE costos SET
                  costo_previo2 = costo_previo1,
                  costo_previo1 = costo_local,
                  costop_previo2 = costop_previo1,
                  costop_previo1 = costo_proveedor,
                  costo = ?,
                  costo_proveedor = ?,
                  costo_promedio = ?,
                  costo_local = ?,
                  iva_pagado = ?,
                  nofactura = ?,
                  dt_compra = ?
                WHERE idprod = ?
              `, [
                costoData.costo,
                costoData.costo_proveedor,
                costoData.costo_promedio || existing[0].costo_local,
                costoData.costo_local,
                costoData.iva_pagado,
                costoData.nofactura || null,
                costoData.dt_compra || null,
                idprod
              ]);
            }
            actualizados++;
          } else {
            // Crear nuevo registro con todos los campos
            await connection.execute(`
              INSERT INTO costos (idprod, costo, costo_proveedor, costo_promedio, costo_local, iva_pagado, 
                costo_previo1, costo_previo2, costop_previo1, costop_previo2, nofactura, dt_compra)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              idprod,
              costoData.costo,
              costoData.costo_proveedor,
              costoData.costo_promedio || costoData.costo,
              costoData.costo_local,
              costoData.iva_pagado,
              costoData.costo_previo1,
              costoData.costo_previo2,
              costoData.costop_previo1,
              costoData.costop_previo2,
              costoData.nofactura || null,
              costoData.dt_compra || null
            ]);
            creados++;
          }

          // También actualizar el costo en la tabla productos (para compatibilidad)
          await connection.execute(
            'UPDATE productos SET costo = ? WHERE idprod = ?',
            [costoData.costo, idprod]
          );

        } catch (error: any) {
          erroresImport.push({ fila: costoData._fila, error: error.message });
        }
      }

      await connection.end();

      return NextResponse.json({
        success: true,
        message: 'Importación de costos completada',
        actualizados,
        creados,
        errores: erroresImport
      });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });

  } catch (error: any) {
    console.error('Error al procesar archivo:', error);
    return NextResponse.json({ error: error.message || 'Error al procesar archivo' }, { status: 500 });
  }
}
