import { NextResponse } from 'next/server';
import type { ResultSetHeader } from 'mysql2/promise';
import { connectDB } from '@/lib/db';
import { codigoJerarquico, guardarImagenesProducto } from '@/lib/productos';
import { sqlPrecios } from '@/lib/precios-niveles';

// GET: Obtener productos con paginación
export async function GET(request: Request) {
  let connection: Awaited<ReturnType<typeof connectDB>> | undefined;
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(parseInt(searchParams.get('page') || '1') || 1, 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50') || 50, 1), 500);
    const search = searchParams.get('search') || '';
    const categoria = searchParams.get('categoria') || '';
    const filters = searchParams.get('filters') || ''; // Filtros múltiples separados por coma
    const offset = (page - 1) * limit;
    
    connection = await connectDB();
    
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
        if (filterList.includes('referencia')) searchFields.push('p.idprodprov');
        if (filterList.includes('idprod')) searchFields.push('CAST(p.idprod AS CHAR)');
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
        cn.nombre as categoria_nombre,
        cn.nombre as categoria_nueva_nombre,
        g.codigo as grupo_codigo,
        g.nombre as grupo_nombre,
        sg.codigo as subgrupo_codigo,
        sg.nombre as subgrupo_nombre,
        ${sqlPrecios('pr')},
        COALESCE(co.costo, p.costo) as costo,
        COALESCE(co.costo_local, p.costo_local, p.costo) as costo_local,
        COALESCE(co.iva_pagado, p.iva_pagado, 0) as iva_pagado,
        co.costo_promedio,
        co.costo_proveedor,
        (SELECT imagen_url FROM producto_imagenes WHERE idprod = p.idprod ORDER BY es_principal DESC, orden ASC LIMIT 1) as imagen_principal
      FROM productos p
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
  } finally {
    if (connection) await connection.end();
  }
}

const texto = (f: FormData, campo: string) => {
  const v = f.get(campo);
  return v === null || v === '' || v === 'null' ? null : String(v).trim();
};
const entero = (f: FormData, campo: string) => Number(texto(f, campo)) || null;

// POST: Crear nuevo producto. El stock arranca en 0: solo lo mueven compras y ajustes de inventario.
export async function POST(request: Request) {
  const formData = await request.formData();
  const nombre = texto(formData, 'nombre');
  const OE = texto(formData, 'OE');
  if (!nombre || !OE) {
    return NextResponse.json({ error: 'Nombre y Referencia OE son requeridos' }, { status: 400 });
  }
  const idcategoria = entero(formData, 'idcategoria_nuevo');
  const idGrupo = entero(formData, 'id_grupo');
  const idSubgrupo = entero(formData, 'id_subgrupo');
  const costo = Number(texto(formData, 'costo')) || 0;
  const pesoTxt = texto(formData, 'peso');
  const daiTxt = texto(formData, 'porcentaje_dai');

  const CAMPOS_TEXTO = [
    'idprodprov', 'idprodpaquete', 'idprodfisico', 'descripcion', 'etiquetas', 'marca', 'codarancel', 'lado',
    'modelo', 'clase', 'estilo', 'giro', 'capacidad', 'unimedida', 'idcategoria', 'codigo_barras', 'info_reservada',
    'info_publica', 'info_referencias_directas', 'info_referencias_indirectas',
  ];

  const connection = await connectDB();
  try {
    await connection.beginTransaction();
    const datos: Record<string, string | number | null> = {
      OE,
      nombre,
      exento: formData.get('exento') === 'true' ? 1 : 0,
      peso: pesoTxt ? Number(pesoTxt) : null,
      porcentaje_dai: daiTxt ? Number(daiTxt) : null,
      idcategoria_nuevo: idcategoria,
      id_grupo: idGrupo,
      id_subgrupo: idSubgrupo,
      codigo_jerarquico: texto(formData, 'codigo_jerarquico') ?? (await codigoJerarquico(connection, idcategoria, idGrupo, idSubgrupo)),
      stock_contable: 0,
      stock_fisico: 0,
      costo,
    };
    for (const c of CAMPOS_TEXTO) datos[c] = texto(formData, c);
    const campos = Object.keys(datos);
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO productos (${campos.join(', ')}) VALUES (${campos.map(() => '?').join(', ')})`,
      campos.map((c) => datos[c])
    );
    const productId = result.insertId;
    await connection.execute('INSERT INTO costos (idprod, costo, costo_local, costo_promedio, costo_local_promedio) VALUES (?, ?, ?, ?, ?)', [
      productId, costo, costo, costo, costo,
    ]);
    const imagenes = await guardarImagenesProducto(connection, productId, formData.getAll('imagenes') as File[]);
    await connection.commit();
    return NextResponse.json({
      success: true,
      message: 'Producto guardado exitosamente',
      productId,
      imagenes,
      totalImagenes: imagenes.length,
    });
  } catch (error) {
    await connection.rollback().catch(() => {});
    console.error('Error al guardar producto:', error);
    return NextResponse.json({ error: 'Error interno del servidor', details: (error as Error).message }, { status: 500 });
  } finally {
    await connection.end();
  }
}
