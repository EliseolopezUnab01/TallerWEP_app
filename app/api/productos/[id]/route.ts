import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { writeFile, mkdir, unlink } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

// PUT: Actualizar producto completo (con FormData para imágenes)
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { id } = params;
    
    // Verificar si es FormData (actualización completa) o JSON (solo precios)
    const contentType = request.headers.get('content-type') || '';
    const isFormData = contentType.includes('multipart/form-data');
    
    if (isFormData) {
      // Actualización completa del producto con imágenes
      return await handleFullProductUpdate(request, id);
    } else {
      // Actualización solo de precios (comportamiento anterior)
      const body = await request.json();
      return await handlePriceUpdate(body, id);
    }
  } catch (error: any) {
    console.error('Error al actualizar producto:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    );
  }
}

// Función para actualizar el producto completo con FormData
async function handleFullProductUpdate(request: Request, id: string) {
  try {
    const formData = await request.formData();
    const connection = await connectDB();

    // Verificar que el producto existe
    const [existing]: any = await connection.execute(
      'SELECT idprod FROM productos WHERE idprod = ?',
      [id]
    );

    if (existing.length === 0) {
      await connection.end();
      return NextResponse.json(
        { error: 'Producto no encontrado' },
        { status: 404 }
      );
    }

    // Extraer datos del FormData (27 campos del Excel + costo + campos de categorización)
    const updateData: any = {};
    const fields = [
      'idprodprov', 'idprodpaquete', 'idprodfisico', 'OE',
      'nombre', 'descripcion', 'etiquetas', 'marca', 'peso', 'codarancel',
      'lado', 'modelo', 'clase', 'estilo', 'giro', 'capacidad', 'unimedida',
      'idcategoria', 'codigo_barras', 'info_reservada', 'info_publica',
      'info_referencias_directas', 'info_referencias_indirectas',
      'exento', 'stock_contable', 'stock_fisico', 'costo',
      'idcategoria_nuevo', 'id_grupo', 'id_subgrupo', 'codigo_jerarquico'
    ];

    fields.forEach(field => {
      const value = formData.get(field);
      if (value !== null) {
        // Convertir "null" string a null real, y valores numéricos
        if (value === 'null' || value === '') {
          updateData[field] = null;
        } else if (['idcategoria_nuevo', 'id_grupo', 'id_subgrupo', 'idcategoria', 'stock_contable', 'stock_fisico'].includes(field)) {
          updateData[field] = value ? parseInt(value as string) : null;
        } else {
          updateData[field] = value;
        }
      }
    });
    
    console.log('📦 Datos a actualizar:', updateData);

    // Actualizar datos del producto
    if (Object.keys(updateData).length > 0) {
      const updateFields = Object.keys(updateData).map(field => `${field} = ?`);
      const updateValues = Object.values(updateData);
      updateValues.push(id);

      await connection.execute(
        `UPDATE productos SET ${updateFields.join(', ')} WHERE idprod = ?`,
        updateValues
      );
    }

    // Actualizar tabla costos si se modificó el costo
    if (updateData.costo !== undefined) {
      const costoValue = parseFloat(updateData.costo) || 0;
      // Verificar si existe registro en costos
      const [existingCosto]: any = await connection.execute(
        'SELECT idcosto FROM costos WHERE idprod = ?', [id]
      );
      if (existingCosto.length > 0) {
        // Actualizar con rotación de respaldos
        await connection.execute(`
          UPDATE costos SET
            costo_previo2 = costo_previo1,
            costo_previo1 = costo_local,
            costo = ?,
            costo_local = ?
          WHERE idprod = ?
        `, [costoValue, costoValue, id]);
      } else {
        // Crear nuevo registro
        await connection.execute(
          'INSERT INTO costos (idprod, costo, costo_local, costo_promedio) VALUES (?, ?, ?, ?)',
          [id, costoValue, costoValue, costoValue]
        );
      }
    }

    // Manejar imágenes nuevas (soporta ambos nombres: 'imagenes' y 'newImages')
    let imagenes = formData.getAll('imagenes') as File[];
    if (imagenes.length === 0) {
      imagenes = formData.getAll('newImages') as File[];
    }
    if (imagenes.length > 0) {
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'productos');
      
      try {
        await mkdir(uploadDir, { recursive: true });
      } catch (error) {
        console.log('Directorio ya existe o error al crear:', error);
      }

      for (const imagen of imagenes) {
        if (imagen.size > 0) {
          const bytes = await imagen.arrayBuffer();
          const buffer = Buffer.from(bytes);
          const filename = `${Date.now()}-${imagen.name}`;
          const filepath = path.join(uploadDir, filename);
          
          await writeFile(filepath, buffer);
          
          const imageUrl = `/uploads/productos/${filename}`;
          
          // Obtener el orden máximo actual
          const [maxOrden]: any = await connection.execute(
            'SELECT COALESCE(MAX(orden), 0) as max_orden FROM producto_imagenes WHERE idprod = ?',
            [id]
          );
          const nuevoOrden = maxOrden[0].max_orden + 1;
          
          // Insertar imagen en la base de datos
          await connection.execute(
            'INSERT INTO producto_imagenes (idprod, imagen_url, orden, es_principal) VALUES (?, ?, ?, ?)',
            [id, imageUrl, nuevoOrden, 0]
          );
        }
      }
    }

    // Manejar eliminación de imágenes (soporta ambos nombres de campo)
    const imagenesEliminar = formData.getAll('imagesToDelete');
    if (imagenesEliminar && imagenesEliminar.length > 0) {
      for (const imagenUrl of imagenesEliminar) {
        const urlString = imagenUrl.toString();
        
        // Eliminar de la base de datos
        await connection.execute(
          'DELETE FROM producto_imagenes WHERE idprod = ? AND imagen_url = ?',
          [id, urlString]
        );
        
        // Eliminar archivo físico del servidor
        try {
          const filePath = path.join(process.cwd(), 'public', urlString);
          if (existsSync(filePath)) {
            await unlink(filePath);
            console.log('Archivo eliminado:', filePath);
          }
        } catch (fileError) {
          console.error('Error al eliminar archivo físico:', fileError);
          // Continuar aunque falle la eliminación del archivo
        }
      }
    }

    // Obtener el producto actualizado con toda su información incluyendo precios e imagen
    const [updatedProduct]: any = await connection.execute(`
      SELECT p.*, c.nombre as categoria_nombre,
        pr.precio_general as precio1, pr.precio_mayorista as precio2, 
        pr.precio_cliente as precio3, pr.precio_mecanico as precio4,
        pr.precio_minorista as precio5, pr.precio_especial as precio6, pr.precio_especial as precio7,
        COALESCE(
          (SELECT imagen_url FROM producto_imagenes WHERE idprod = p.idprod AND es_principal = 1 LIMIT 1),
          (SELECT imagen_url FROM producto_imagenes WHERE idprod = p.idprod ORDER BY orden LIMIT 1)
        ) as imagen_principal
      FROM productos p
      LEFT JOIN categorias c ON p.idcategoria = c.idcategoria
      LEFT JOIN precios pr ON p.idprod = pr.idprod
      WHERE p.idprod = ?
    `, [id]);

    await connection.end();

    return NextResponse.json({
      success: true,
      message: 'Producto actualizado exitosamente',
      product: updatedProduct[0] || null
    });

  } catch (error: any) {
    console.error('Error en handleFullProductUpdate:', error);
    throw error;
  }
}

// Función para actualizar solo precios (comportamiento anterior)
async function handlePriceUpdate(body: any, id: string) {
  try {
    console.log('PUT /api/productos/[id] - ID recibido:', id);
    console.log('PUT /api/productos/[id] - Body:', body);

    // Validar que el ID sea válido
    if (!id || isNaN(Number(id))) {
      console.error('ID inválido:', id);
      return NextResponse.json(
        { error: 'ID de producto inválido' },
        { status: 400 }
      );
    }

    const connection = await connectDB();

    // Verificar que el producto existe
    const [existing]: any = await connection.execute(
      'SELECT idprod FROM productos WHERE idprod = ?',
      [id]
    );

    if (existing.length === 0) {
      await connection.end();
      return NextResponse.json(
        { error: 'Producto no encontrado' },
        { status: 404 }
      );
    }

    // Actualizar costo en tabla productos si viene en el body
    if (body.costo !== undefined) {
      await connection.execute(
        'UPDATE productos SET costo = ? WHERE idprod = ?',
        [body.costo, id]
      );
      console.log('Costo actualizado:', body.costo);
    }

    // Mapear los nombres de campos del frontend a los de la base de datos
    const preciosData: any = {};
    if (body.precio1 !== undefined) preciosData.precio_general = body.precio1;
    if (body.precio2 !== undefined) preciosData.precio_mayorista = body.precio2;
    if (body.precio3 !== undefined) preciosData.precio_cliente = body.precio3;
    if (body.precio4 !== undefined) preciosData.precio_mecanico = body.precio4;
    if (body.precio5 !== undefined) preciosData.precio_minorista = body.precio5;
    if (body.precio6 !== undefined) preciosData.precio_mayorista = body.precio6; // Nota: hay dos mayorista
    if (body.precio7 !== undefined) preciosData.precio_especial = body.precio7;

    // Si hay precios para actualizar
    if (Object.keys(preciosData).length > 0) {
      // Verificar si ya existe un registro de precios para este producto
      const [existingPrecios]: any = await connection.execute(
        'SELECT idprod FROM precios WHERE idprod = ?',
        [id]
      );

      if (existingPrecios.length > 0) {
        // UPDATE: Actualizar precios existentes
        const updateFields = Object.keys(preciosData).map(field => `${field} = ?`);
        const updateValues = Object.values(preciosData);
        updateValues.push(id);

        console.log('Actualizando precios:', updateFields.join(', '));
        await connection.execute(
          `UPDATE precios SET ${updateFields.join(', ')} WHERE idprod = ?`,
          updateValues
        );
      } else {
        // INSERT: Crear nuevo registro de precios
        preciosData.idprod = id;
        const fields = Object.keys(preciosData);
        const placeholders = fields.map(() => '?').join(', ');
        const values = Object.values(preciosData);

        console.log('Insertando nuevos precios para producto:', id);
        await connection.execute(
          `INSERT INTO precios (${fields.join(', ')}) VALUES (${placeholders})`,
          values
        );
      }
    }

    await connection.end();

    return NextResponse.json({
      success: true,
      message: 'Producto actualizado exitosamente'
    });

  } catch (error: any) {
    console.error('Error al actualizar producto:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    );
  }
}

// GET: Obtener un producto específico
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { id } = params;

    if (!id || isNaN(Number(id))) {
      return NextResponse.json(
        { error: 'ID de producto inválido' },
        { status: 400 }
      );
    }

    const connection = await connectDB();

    const [products]: any = await connection.execute(
      `SELECT 
        p.*,
        c.nombre as categoria_nombre,
        cn.nombre as categoria_nueva_nombre,
        pr.precio_general as precio1,
        pr.precio_mayorista as precio2,
        pr.precio_cliente as precio3,
        pr.precio_mecanico as precio4,
        pr.precio_minorista as precio5,
        pr.precio_especial as precio6,
        pr.precio_especial as precio7,
        (SELECT imagen_url FROM producto_imagenes WHERE idprod = p.idprod ORDER BY es_principal DESC, orden ASC LIMIT 1) as imagen_principal
      FROM productos p
      LEFT JOIN categorias c ON p.idcategoria = c.idcategoria
      LEFT JOIN categorias_nuevo cn ON p.idcategoria_nuevo = cn.idcategoria
      LEFT JOIN precios pr ON p.idprod = pr.idprod
      WHERE p.idprod = ?`,
      [id]
    );

    if (products.length === 0) {
      await connection.end();
      return NextResponse.json(
        { error: 'Producto no encontrado' },
        { status: 404 }
      );
    }

    // Obtener imágenes del producto
    const [images]: any = await connection.execute(
      `SELECT imagen_url, orden, es_principal
       FROM producto_imagenes
       WHERE idprod = ?
       ORDER BY es_principal DESC, orden ASC`,
      [id]
    );

    await connection.end();

    const product = {
      ...products[0],
      imagenes: images.map((img: any) => img.imagen_url)
    };

    return NextResponse.json({ product });

  } catch (error) {
    console.error('Error al obtener producto:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// DELETE: Eliminar producto
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { id } = params;
    
    const connection = await connectDB();
    
    // Verificar que el producto existe
    const [existing]: any = await connection.execute(
      'SELECT idprod FROM productos WHERE idprod = ?',
      [id]
    );
    
    if (existing.length === 0) {
      await connection.end();
      return NextResponse.json(
        { error: 'Producto no encontrado' },
        { status: 404 }
      );
    }
    
    // Eliminar imágenes asociadas
    await connection.execute(
      'DELETE FROM producto_imagenes WHERE idprod = ?',
      [id]
    );
    
    // Eliminar costos asociados
    await connection.execute(
      'DELETE FROM costos WHERE idprod = ?',
      [id]
    );
    
    // Eliminar precios asociados
    await connection.execute(
      'DELETE FROM precios WHERE idprod = ?',
      [id]
    );
    
    // Eliminar el producto
    await connection.execute(
      'DELETE FROM productos WHERE idprod = ?',
      [id]
    );
    
    await connection.end();
    
    return NextResponse.json({ success: true, message: 'Producto eliminado correctamente' });
    
  } catch (error: any) {
    console.error('Error al eliminar producto:', error);
    return NextResponse.json(
      { error: 'Error al eliminar producto', details: error.message },
      { status: 500 }
    );
  }
}
