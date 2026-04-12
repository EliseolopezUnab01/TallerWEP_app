import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

// GET: Obtener productos con paginación
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';
    const categoria = searchParams.get('categoria') || '';
    const filters = searchParams.get('filters') || ''; // Filtros múltiples separados por coma
    const offset = (page - 1) * limit;
    
    const connection = await connectDB();
    
    // Construir condiciones de filtro
    let whereConditions: string[] = [];
    let params: any[] = [];
    
    if (search) {
      const filterList = filters ? filters.split(',').filter(f => f.trim()) : [];
      
      // Dividir búsqueda en palabras para búsqueda flexible
      // Ejemplo: "hi crem" busca productos que contengan "hi" Y "crem" en cualquier orden
      const words = search.trim().split(/\s+/).filter(w => w.length > 0);
      
      // Definir campos de búsqueda según filtros
      let searchFields: string[] = [];
      if (filterList.length === 0) {
        // Buscar en todos los campos principales
        searchFields = ['p.nombre', 'p.OE', 'p.marca', 'p.codigo_barras', 'p.idprodprov', 'p.descripcion', 'p.etiquetas', 'p.aplicacion_marcas'];
      } else {
        if (filterList.includes('nombre')) searchFields.push('p.nombre');
        if (filterList.includes('descripcion')) searchFields.push('p.descripcion');
        if (filterList.includes('codigo')) {
          searchFields.push('p.codigo_barras', 'p.idprodprov', 'p.idprodpaquete', 'p.idprodfisico');
        }
        if (filterList.includes('oem')) searchFields.push('p.OE');
        if (filterList.includes('etiquetas')) searchFields.push('p.etiquetas');
        if (filterList.includes('aplicacion')) searchFields.push('p.aplicacion_marcas', 'p.marca');
      }
      
      // Concatenar todos los campos en un solo texto para búsqueda flexible
      // Cada palabra debe encontrarse en el texto combinado de todos los campos
      const concatFields = `CONCAT_WS(' ', ${searchFields.map(f => `COALESCE(${f}, '')`).join(', ')})`;
      
      // Cada palabra debe estar en el texto concatenado
      const wordConditions: string[] = [];
      for (const word of words) {
        wordConditions.push(`${concatFields} LIKE ?`);
        params.push(`%${word}%`);
      }
      
      if (wordConditions.length > 0) {
        whereConditions.push(`(${wordConditions.join(' AND ')})`);
      }
    }
    
    if (categoria) {
      whereConditions.push(`p.idcategoria_nuevo = ?`);
      params.push(categoria);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Ejecutar consultas en paralelo para mayor velocidad
    const [countResult, statsResult]: any = await Promise.all([
      // Total para paginación
      connection.execute(
        `SELECT COUNT(*) as total FROM productos p ${whereClause}`,
        params
      ),
      // Estadísticas globales (solo si no hay búsqueda activa para ahorrar tiempo)
      !search ? connection.execute(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN stock_contable > 0 THEN 1 ELSE 0 END) as en_stock,
          SUM(CASE WHEN stock_contable = 0 OR stock_contable IS NULL THEN 1 ELSE 0 END) as sin_stock
        FROM productos
      `) : Promise.resolve([[{ total: 0, en_stock: 0, sin_stock: 0 }]])
    ]);
    
    const total = countResult[0][0].total;
    const totalPages = Math.ceil(total / limit);
    const stats = {
      totalProductos: statsResult[0][0].total || 0,
      enStock: statsResult[0][0].en_stock || 0,
      sinStock: statsResult[0][0].sin_stock || 0
    };
    
    // Obtener productos paginados
    const [products]: any = await connection.execute(`
      SELECT 
        p.*,
        c.nombre as categoria_nombre,
        cn.nombre as categoria_nueva_nombre,
        g.codigo as grupo_codigo,
        g.nombre as grupo_nombre,
        sg.codigo as subgrupo_codigo,
        sg.nombre as subgrupo_nombre,
        pr.precio_general as precio1,
        pr.precio_mayorista as precio2,
        pr.precio_cliente as precio3,
        pr.precio_mecanico as precio4,
        pr.precio_minorista as precio5,
        pr.precio_mayorista as precio6,
        pr.precio_especial as precio7,
        COALESCE(co.costo, p.costo) as costo,
        COALESCE(co.costo_local, p.costo_local, p.costo) as costo_local,
        COALESCE(co.iva_pagado, p.iva_pagado, 0) as iva_pagado,
        co.costo_promedio,
        co.costo_proveedor,
        (SELECT imagen_url FROM producto_imagenes WHERE idprod = p.idprod ORDER BY es_principal DESC, orden ASC LIMIT 1) as imagen_principal
      FROM productos p
      LEFT JOIN categorias c ON p.idcategoria = c.idcategoria
      LEFT JOIN categorias_nuevo cn ON p.idcategoria_nuevo = cn.idcategoria
      LEFT JOIN grupos g ON p.id_grupo = g.id_grupo
      LEFT JOIN subgrupos sg ON p.id_subgrupo = sg.id_subgrupo
      LEFT JOIN precios pr ON p.idprod = pr.idprod
      LEFT JOIN costos co ON p.idprod = co.idprod
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);
    
    // Obtener imágenes solo de los productos de esta página
    const productIds = products.map((p: any) => p.idprod);
    let imagesByProduct: Record<number, string[]> = {};
    
    if (productIds.length > 0) {
      const placeholders = productIds.map(() => '?').join(',');
      const [imagesRows]: any = await connection.execute(`
        SELECT idprod, imagen_url, orden, es_principal
        FROM producto_imagenes
        WHERE idprod IN (${placeholders})
        ORDER BY idprod ASC, es_principal DESC, orden ASC
      `, productIds);

      for (const row of imagesRows) {
        const id = Number(row.idprod);
        if (!imagesByProduct[id]) {
          imagesByProduct[id] = [];
        }
        imagesByProduct[id].push(row.imagen_url as string);
      }
    }

    await connection.end();

    const productsWithImages = products.map((p: any) => ({
      ...p,
      imagenes: imagesByProduct[Number(p.idprod)] || [],
    }));

    return NextResponse.json({ 
      products: productsWithImages,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      stats
    });
  } catch (error) {
    console.error('Error al obtener productos:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST: Crear nuevo producto
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    
    // Obtener datos del producto (27 campos del Excel + costo)
    const productoData = {
      idprodprov: formData.get('idprodprov') as string,
      idprodpaquete: formData.get('idprodpaquete') as string,
      idprodfisico: formData.get('idprodfisico') as string,
      OE: formData.get('OE') as string,
      nombre: formData.get('nombre') as string,
      descripcion: formData.get('descripcion') as string,
      etiquetas: formData.get('etiquetas') as string,
      marca: formData.get('marca') as string,
      peso: formData.get('peso') ? parseFloat(formData.get('peso') as string) : null,
      codarancel: formData.get('codarancel') as string,
      lado: formData.get('lado') as string,
      modelo: formData.get('modelo') as string,
      clase: formData.get('clase') as string,
      estilo: formData.get('estilo') as string,
      giro: formData.get('giro') as string,
      capacidad: formData.get('capacidad') as string,
      unimedida: formData.get('unimedida') as string,
      idcategoria: formData.get('idcategoria') as string,
      codigo_barras: formData.get('codigo_barras') as string,
      info_reservada: formData.get('info_reservada') as string,
      info_publica: formData.get('info_publica') as string,
      info_referencias_directas: formData.get('info_referencias_directas') as string,
      info_referencias_indirectas: formData.get('info_referencias_indirectas') as string,
      exento: formData.get('exento') === 'true',
      stock_contable: formData.get('stock_contable') ? parseInt(formData.get('stock_contable') as string) : 0,
      stock_fisico: formData.get('stock_fisico') ? parseInt(formData.get('stock_fisico') as string) : 0,
      costo: formData.get('costo') ? parseFloat(formData.get('costo') as string) : 0,
    };

    // Validaciones básicas
    if (!productoData.nombre || !productoData.OE) {
      return NextResponse.json(
        { error: 'Nombre y Referencia OE son requeridos' },
        { status: 400 }
      );
    }

    const connection = await connectDB();

    // Verificar si ya existe un producto con el mismo OE
    const [existingOE]: any = await connection.execute(
      'SELECT idprod FROM productos WHERE OE = ?',
      [productoData.OE]
    );

    if (existingOE.length > 0) {
      await connection.end();
      return NextResponse.json(
        { error: 'Ya existe un producto con esta referencia OE' },
        { status: 400 }
      );
    }

    // Insertar producto en la base de datos (27 campos del Excel + costo)
    const [result]: any = await connection.execute(
      `INSERT INTO productos (
        idprodprov, idprodpaquete, idprodfisico, OE, nombre, descripcion,
        etiquetas, marca, peso, codarancel, lado, modelo, clase, estilo, giro,
        capacidad, unimedida, idcategoria, codigo_barras, info_reservada,
        info_publica, info_referencias_directas, info_referencias_indirectas,
        exento, stock_contable, stock_fisico, costo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        productoData.idprodprov,
        productoData.idprodpaquete,
        productoData.idprodfisico,
        productoData.OE,
        productoData.nombre,
        productoData.descripcion,
        productoData.etiquetas,
        productoData.marca,
        productoData.peso,
        productoData.codarancel,
        productoData.lado,
        productoData.modelo,
        productoData.clase,
        productoData.estilo,
        productoData.giro,
        productoData.capacidad,
        productoData.unimedida,
        productoData.idcategoria,
        productoData.codigo_barras,
        productoData.info_reservada,
        productoData.info_publica,
        productoData.info_referencias_directas,
        productoData.info_referencias_indirectas,
        productoData.exento,
        productoData.stock_contable,
        productoData.stock_fisico,
        productoData.costo
      ]
    );

    const productId = result.insertId;

    // Crear registro en tabla costos
    await connection.execute(
      `INSERT INTO costos (idprod, costo, costo_local, costo_promedio) VALUES (?, ?, ?, ?)`,
      [productId, productoData.costo, productoData.costo, productoData.costo]
    );

    // Procesar imágenes
    const imagenes: string[] = [];
    const imageFiles = formData.getAll('imagenes') as File[];

    if (imageFiles.length > 0 && imageFiles[0].size > 0) {
      // Crear directorio si no existe
      const uploadDir = join(process.cwd(), 'public', 'uploads', 'productos');
      if (!existsSync(uploadDir)) {
        await mkdir(uploadDir, { recursive: true });
      }

      for (let i = 0; i < imageFiles.length; i++) {
        const imageFile = imageFiles[i];
        
        if (imageFile && imageFile.size > 0) {
          // Validar tipo de archivo
          if (!imageFile.type.startsWith('image/')) {
            continue; // Saltar archivos que no son imágenes
          }

          // Validar tamaño (max 10MB)
          if (imageFile.size > 10 * 1024 * 1024) {
            console.warn(`Imagen ${imageFile.name} excede el tamaño máximo de 10MB`);
            continue;
          }

          // Generar nombre único para la imagen
          const timestamp = Date.now();
          const extension = imageFile.name.split('.').pop() || 'jpg';
          const filename = `producto_${productId}_${i}_${timestamp}.${extension}`;
          const filepath = join(uploadDir, filename);

          try {
            // Convertir File a Buffer y guardar
            const bytes = await imageFile.arrayBuffer();
            const buffer = Buffer.from(bytes);
            await writeFile(filepath, buffer);

            // Guardar ruta en la base de datos
            const imageUrl = `/uploads/productos/${filename}`;
            await connection.execute(
              'INSERT INTO producto_imagenes (idprod, imagen_url, orden, es_principal) VALUES (?, ?, ?, ?)',
              [productId, imageUrl, i, i === 0 ? 1 : 0]
            );

            imagenes.push(imageUrl);
          } catch (error) {
            console.error(`Error al guardar imagen ${i}:`, error);
            // Continuar con las siguientes imágenes aunque falle una
          }
        }
      }
    }

    await connection.end();

    return NextResponse.json({
      success: true,
      message: 'Producto guardado exitosamente',
      productId: productId,
      imagenes: imagenes,
      totalImagenes: imagenes.length
    });

  } catch (error) {
    console.error('Error al guardar producto:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}