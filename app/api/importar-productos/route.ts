import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import * as XLSX from 'xlsx';

// Mapeo de columnas del Excel a campos de la base de datos
const COLUMN_MAPPING: { [key: string]: string } = {
  // ID del producto (para actualizaciones)
  'idprod': 'idprod',
  'id': 'idprod',
  
  // Códigos de identificación
  'idprodprov': 'idprodprov',
  'codigo proveedor': 'idprodprov',
  'cod proveedor': 'idprodprov',
  'idprodpaquete': 'idprodpaquete',
  'codigo paquete': 'idprodpaquete',
  'cod paquete': 'idprodpaquete',
  'idprodfisico': 'idprodfisico',
  'id producto fisico': 'idprodfisico',
  
  // Referencia OE
  'oe': 'OE',
  'referencia oe': 'OE',
  'referencia': 'OE',
  
  // Datos básicos
  'nombre': 'nombre',
  'nombre producto': 'nombre',
  'producto': 'nombre',
  'descripcion': 'descripcion',
  'descripción': 'descripcion',
  'etiquetas': 'etiquetas',
  'tags': 'etiquetas',
  'marca': 'marca',
  'peso': 'peso',
  'codarancel': 'codarancel',
  'codigo arancel': 'codarancel',
  'cod arancel': 'codarancel',
  
  // Características
  'lado': 'lado',
  'modelo': 'modelo',
  'clase': 'clase',
  'estilo': 'estilo',
  'giro': 'giro',
  'capacidad': 'capacidad',
  
  // Unidad y categoría
  'unimedida': 'unimedida',
  'unidad medida': 'unimedida',
  'unidad de medida': 'unimedida',
  'idcategoria': 'idcategoria',
  'categoria': 'idcategoria',
  
  // Códigos de barras
  'codigo_barras': 'codigo_barras',
  'codigo barras': 'codigo_barras',
  'codigobarras': 'codigo_barras',
  'barcode': 'codigo_barras',
  
  // Información adicional
  'info_reservada': 'info_reservada',
  'info reservada': 'info_reservada',
  'info_publica': 'info_publica',
  'info publica': 'info_publica',
  'info_referencias_directas': 'info_referencias_directas',
  'referencias directas': 'info_referencias_directas',
  'info_referencias_indirectas': 'info_referencias_indirectas',
  'referencias indirectas': 'info_referencias_indirectas',
  
  // Stock e inventario
  'exento': 'exento',
  'stock_contable': 'stock_contable',
  'stock contable': 'stock_contable',
  'stock': 'stock_contable',
  'stock_fisico': 'stock_fisico',
  'stock fisico': 'stock_fisico',
  
  // Costo
  'costo': 'costo',
  'precio costo': 'costo',
  
  // Aplicaciones
  'aplicacion_marcas': 'aplicacion_marcas',
  'aplicacion': 'aplicacion_marcas',
  'aplicaciones': 'aplicacion_marcas',
  
  // Fechas (del cliente)
  'fecha_creacion': 'created_at',
  'fecha creacion': 'created_at',
  'fecha_actualizacion': 'updated_at',
  'fecha actualizacion': 'updated_at',
  'ultima_compra': 'ultima_compra',
  'ultima compra': 'ultima_compra',
  'ultima_venta': 'ultima_venta',
  'ultima venta': 'ultima_venta',
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

// POST - Procesar archivo Excel y devolver preview
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const action = formData.get('action') as string; // 'preview' o 'import'

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
      
      // Si tiene caracteres extraños, intentar latin1
      if (text.includes('�')) {
        text = new TextDecoder('latin1').decode(bytes);
      }
      
      // Debug: ver las primeras líneas del archivo
      const lines = text.split(/\r?\n/);
      console.log(`📄 Total líneas: ${lines.length}`);
      console.log(`📄 Línea 1 (headers): ${lines[0]?.substring(0, 200)}`);
      console.log(`📄 Línea 2 (datos): ${lines[1]?.substring(0, 200)}`);
      
      // Parsear CSV manualmente manejando comillas correctamente
      const parseCSVLine = (line: string): string[] => {
        const row: string[] = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          
          if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
              // Comilla escapada ""
              current += '"';
              i++;
            } else {
              // Toggle estado de comillas
              inQuotes = !inQuotes;
            }
          } else if (char === ',' && !inQuotes) {
            // Fin de campo
            row.push(current);
            current = '';
          } else {
            current += char;
          }
        }
        // Agregar último campo
        row.push(current);
        return row;
      };
      
      const csvData: string[][] = [];
      for (const line of lines) {
        if (!line.trim()) continue;
        const parsedLine = parseCSVLine(line);
        csvData.push(parsedLine);
      }
      
      console.log(`📄 CSV parseado: ${csvData.length} filas`);
      console.log(`📄 Primera fila parseada (${csvData[0]?.length} cols): ${JSON.stringify(csvData[0]?.slice(0, 5))}`);
      console.log(`📄 Segunda fila parseada (${csvData[1]?.length} cols): ${JSON.stringify(csvData[1]?.slice(0, 5))}`);
      
      // Si la segunda fila tiene solo 1 columna pero debería tener más, el archivo tiene formato incorrecto
      // Intentar detectar si los datos están todos en una columna
      if (csvData.length > 1 && csvData[0].length > 5 && csvData[1].length <= 5) {
        // El problema es que los datos de la fila 2+ están mal formateados
        // Revisar si la primera columna de la fila 2 contiene todos los datos
        const firstDataCell = csvData[1][0];
        if (firstDataCell && firstDataCell.includes(',')) {
          console.log('⚠️ Detectado: datos en una sola columna, re-parseando...');
          // Re-parsear la primera columna como si fuera una línea CSV completa
          for (let i = 1; i < csvData.length; i++) {
            if (csvData[i][0] && csvData[i][0].includes(',')) {
              csvData[i] = parseCSVLine(csvData[i][0]);
            }
          }
          console.log(`📄 Re-parseado: segunda fila ahora tiene ${csvData[1]?.length} cols`);
        }
      }
      
      // Convertir a formato de workbook
      const ws = XLSX.utils.aoa_to_sheet(csvData);
      workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, ws, 'Sheet1');
    } else {
      workbook = XLSX.read(bytes, { type: 'array' });
    }
    
    // Tomar la primera hoja
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convertir a JSON
    const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    
    console.log(`📊 Total filas leídas: ${rawData.length}`);
    console.log(`📊 Primera fila (headers): ${JSON.stringify(rawData[0]?.slice(0, 5))}`);
    if (rawData.length > 1) {
      console.log(`📊 Segunda fila (datos): ${JSON.stringify(rawData[1]?.slice(0, 5))}`);
    }
    
    if (rawData.length < 2) {
      return NextResponse.json({ error: 'El archivo está vacío o no tiene datos' }, { status: 400 });
    }

    // Primera fila son los headers
    const headers = rawData[0].map((h: any) => String(h || '').trim());
    const columnMapping = mapColumns(headers);
    
    console.log(`📊 Headers detectados: ${headers.slice(0, 10).join(', ')}`);
    console.log(`📊 Mapeo de columnas: ${JSON.stringify(columnMapping)}`);
    
    // Verificar que tengamos al menos nombre (OE es opcional)
    const hasNombre = Object.values(columnMapping).includes('nombre');
    const hasIdProd = Object.values(columnMapping).includes('idprod');
    
    if (!hasNombre) {
      return NextResponse.json({ 
        error: 'El archivo debe contener al menos la columna "Nombre"',
        headers: headers,
        mappedColumns: columnMapping
      }, { status: 400 });
    }

    // Procesar filas de datos
    const productos: any[] = [];
    const errores: { fila: number; error: string }[] = [];

    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || row.length === 0 || row.every((cell: any) => !cell)) continue;

      const producto: any = {};
      
      Object.entries(columnMapping).forEach(([colIndex, fieldName]) => {
        const value = row[parseInt(colIndex)];
        if (value !== undefined && value !== null && value !== '') {
          producto[fieldName] = value;
        }
      });

      // Validar campos requeridos - solo nombre es obligatorio
      if (!producto.nombre) {
        errores.push({ fila: i + 1, error: 'Falta nombre del producto' });
        continue;
      }
      
      // OE queda vacío si no existe (no generar temporal)
      if (!producto.OE) {
        producto.OE = '';
      }

      // Valores por defecto
      producto.stock_contable = parseInt(producto.stock_contable) || 0;
      producto.stock_fisico = parseInt(producto.stock_fisico) || 0;
      producto.costo = parseFloat(producto.costo) || 0;
      producto.exento = producto.exento === true || producto.exento === 'true' || producto.exento === '1' || producto.exento === 1;
      producto._fila = i + 1;

      productos.push(producto);
    }

    // Si es solo preview, devolver los datos
    if (action === 'preview') {
      return NextResponse.json({
        success: true,
        headers: headers,
        debug: {
          totalFilasRaw: rawData.length,
          primeraFila: rawData[0]?.slice(0, 5),
          segundaFila: rawData[1]?.slice(0, 5),
          columnMapping: columnMapping
        },
        columnMapping: columnMapping,
        totalFilas: rawData.length - 1,
        productosValidos: productos.length,
        errores: errores,
        preview: productos.slice(0, 10) // Mostrar solo los primeros 10
      });
    }

    // Si es import, insertar en la base de datos
    if (action === 'import') {
      const connection = await connectDB();
      let insertados = 0;
      let actualizados = 0;
      const erroresImport: { fila: number; error: string }[] = [];
      
      // Mapeo de idprod_excel → idprod_nuevo para vincular costos después
      const mapeoIds: { [key: string]: number } = {};

      for (const producto of productos) {
        try {
          // Buscar si ya existe el producto usando el mapeo de idprod del Excel
          // Si ya importamos este idprod antes, actualizamos en lugar de insertar
          let existingIdProd: number | null = null;
          
          // Verificar si este idprod del Excel ya fue mapeado a un idprod de la BD
          if (producto.idprod && mapeoIds[String(producto.idprod)]) {
            existingIdProd = mapeoIds[String(producto.idprod)];
          }

          if (existingIdProd) {
            // Actualizar producto existente (ya fue importado antes en esta sesión)
            const updateFields: string[] = [];
            const updateValues: any[] = [];

            const fieldsToUpdate = ['nombre', 'descripcion', 'marca', 'etiquetas', 'peso', 
              'lado', 'modelo', 'clase', 'estilo', 'giro', 'capacidad', 'unimedida',
              'codigo_barras', 'stock_contable', 'stock_fisico', 'costo', 'aplicacion_marcas',
              'idprodprov', 'idprodpaquete', 'idprodfisico', 'OE'];

            fieldsToUpdate.forEach(field => {
              if (producto[field] !== undefined) {
                updateFields.push(`${field} = ?`);
                updateValues.push(producto[field]);
              }
            });

            if (updateFields.length > 0) {
              updateValues.push(existingIdProd);
              await connection.execute(
                `UPDATE productos SET ${updateFields.join(', ')} WHERE idprod = ?`,
                updateValues
              );
              actualizados++;
            }
          } else {
            // Insertar nuevo producto
            const [result]: any = await connection.execute(
              `INSERT INTO productos (
                idprodprov, idprodpaquete, idprodfisico, OE, nombre, descripcion,
                etiquetas, marca, peso, codarancel, lado, modelo, clase, estilo, giro,
                capacidad, unimedida, idcategoria, codigo_barras, info_reservada,
                info_publica, info_referencias_directas, info_referencias_indirectas,
                exento, stock_contable, stock_fisico, costo, aplicacion_marcas
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                producto.idprodprov || null,
                producto.idprodpaquete || null,
                producto.idprodfisico || null,
                producto.OE,
                producto.nombre,
                producto.descripcion || null,
                producto.etiquetas || null,
                producto.marca || null,
                producto.peso || null,
                producto.codarancel || null,
                producto.lado || null,
                producto.modelo || null,
                producto.clase || null,
                producto.estilo || null,
                producto.giro || null,
                producto.capacidad || null,
                producto.unimedida || null,
                producto.idcategoria || null,
                producto.codigo_barras || null,
                producto.info_reservada || null,
                producto.info_publica || null,
                producto.info_referencias_directas || null,
                producto.info_referencias_indirectas || null,
                producto.exento ? 1 : 0,
                producto.stock_contable,
                producto.stock_fisico,
                producto.costo,
                producto.aplicacion_marcas || null
              ]
            );

            // Crear registro en tabla costos
            await connection.execute(
              'INSERT INTO costos (idprod, costo, costo_local, costo_promedio) VALUES (?, ?, ?, ?)',
              [result.insertId, producto.costo, producto.costo, producto.costo]
            );

            // Guardar mapeo: idprod del Excel → idprod nuevo asignado
            if (producto.idprod) {
              mapeoIds[String(producto.idprod)] = result.insertId;
            }

            insertados++;
          }
        } catch (error: any) {
          erroresImport.push({ fila: producto._fila, error: error.message });
        }
      }

      // Guardar mapeo en la sesión/localStorage del servidor para uso posterior
      // Lo guardamos en un archivo temporal para que la importación de costos pueda usarlo
      const fs = await import('fs/promises');
      const path = await import('path');
      const mapeoPath = path.join(process.cwd(), 'temp_mapeo_ids.json');
      await fs.writeFile(mapeoPath, JSON.stringify(mapeoIds, null, 2));

      await connection.end();

      return NextResponse.json({
        success: true,
        message: 'Importación completada',
        insertados,
        actualizados,
        errores: erroresImport,
        mapeoIds, // Devolver mapeo para referencia
        mapeoGuardado: Object.keys(mapeoIds).length > 0
      });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });

  } catch (error: any) {
    console.error('Error al procesar archivo:', error);
    return NextResponse.json({ error: error.message || 'Error al procesar archivo' }, { status: 500 });
  }
}
