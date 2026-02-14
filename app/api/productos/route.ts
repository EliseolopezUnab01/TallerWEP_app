import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

// GET: Obtener todos los productos
export async function GET() {
  try {
    const connection = await connectDB();
    
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
        (SELECT imagen_url FROM producto_imagenes WHERE idprod = p.idprod ORDER BY es_principal DESC, orden ASC LIMIT 1) as imagen_principal
      FROM productos p
      LEFT JOIN categorias c ON p.idcategoria = c.idcategoria
      LEFT JOIN categorias_nuevo cn ON p.idcategoria_nuevo = cn.idcategoria
      LEFT JOIN grupos g ON p.id_grupo = g.id_grupo
      LEFT JOIN subgrupos sg ON p.id_subgrupo = sg.id_subgrupo
      LEFT JOIN precios pr ON p.idprod = pr.idprod
      ORDER BY p.created_at DESC
    `);
    
    // Obtener todas las imágenes de todos los productos para construir el arreglo `imagenes`
    const [imagesRows]: any = await connection.execute(`
      SELECT idprod, imagen_url, orden, es_principal
      FROM producto_imagenes
      ORDER BY idprod ASC, es_principal DESC, orden ASC
    `);

    await connection.end();

    const imagesByProduct: Record<number, string[]> = {};
    for (const row of imagesRows) {
      const id = Number(row.idprod);
      if (!imagesByProduct[id]) {
        imagesByProduct[id] = [];
      }
      imagesByProduct[id].push(row.imagen_url as string);
    }

    const productsWithImages = products.map((p: any) => ({
      ...p,
      imagenes: imagesByProduct[Number(p.idprod)] || [],
    }));

    return NextResponse.json({ products: productsWithImages });
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
    
    // Obtener datos del producto (28 campos + costo)
    const productoData = {
      tipo: formData.get('tipo') as string,
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

    // Insertar producto en la base de datos (28 campos + costo)
    const [result]: any = await connection.execute(
      `INSERT INTO productos (
        tipo, idprodprov, idprodpaquete, idprodfisico, OE, nombre, descripcion,
        etiquetas, marca, peso, codarancel, lado, modelo, clase, estilo, giro,
        capacidad, unimedida, idcategoria, codigo_barras, info_reservada,
        info_publica, info_referencias_directas, info_referencias_indirectas,
        exento, stock_contable, stock_fisico, costo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        productoData.tipo,
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