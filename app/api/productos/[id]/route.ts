import { NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2/promise';
import { connectDB } from '@/lib/db';
import { sqlPrecios } from '@/lib/precios-niveles';
import { borrarImagenProducto, codigoJerarquico, guardarImagenesProducto } from '@/lib/productos';

type Contexto = { params: Promise<{ id: string }> };

// Campos de la ficha que se pueden editar. Stock y costo NO: solo cambian por compras,
// retaceos y ajustes de inventario. Los precios se cambian en Ajuste de Precios.
const CAMPOS_TEXTO = [
  'idprodprov', 'idprodpaquete', 'idprodfisico', 'OE', 'nombre', 'descripcion', 'etiquetas', 'marca', 'codarancel',
  'lado', 'modelo', 'clase', 'estilo', 'giro', 'capacidad', 'unimedida', 'idcategoria', 'codigo_barras',
  'info_reservada', 'info_publica', 'info_referencias_directas', 'info_referencias_indirectas', 'codigo_jerarquico',
];
const CAMPOS_NUMERO = ['peso', 'porcentaje_dai'];
const CAMPOS_ENTERO = ['idcategoria_nuevo', 'id_grupo', 'id_subgrupo'];

function idValido(id: string) {
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

async function leerProducto(connection: Awaited<ReturnType<typeof connectDB>>, idprod: number) {
  const [rows] = await connection.execute<RowDataPacket[]>(
    `SELECT p.*, cn.nombre AS categoria_nombre, cn.nombre AS categoria_nueva_nombre, ${sqlPrecios('pr')},
            COALESCE(co.costo, p.costo) AS costo, COALESCE(co.costo_local, p.costo_local) AS costo_local,
            (SELECT imagen_url FROM producto_imagenes WHERE idprod = p.idprod ORDER BY es_principal DESC, orden ASC LIMIT 1) AS imagen_principal
     FROM productos p
     LEFT JOIN categorias_nuevo cn ON p.idcategoria_nuevo = cn.idcategoria
     LEFT JOIN precios pr ON p.idprod = pr.idprod
     LEFT JOIN costos co ON co.idprod = p.idprod
     WHERE p.idprod = ?`,
    [idprod]
  );
  return rows[0] ?? null;
}

// PUT (multipart): actualiza la ficha del producto e imágenes.
export async function PUT(request: Request, context: Contexto) {
  const idprod = idValido((await context.params).id);
  if (!idprod) return NextResponse.json({ error: 'ID de producto inválido' }, { status: 400 });
  if (!(request.headers.get('content-type') || '').includes('multipart/form-data')) {
    return NextResponse.json({ error: 'Los precios se cambian en Ajuste de Precios; el costo, con compras o retaceos' }, { status: 400 });
  }

  const formData = await request.formData();
  const connection = await connectDB();
  try {
    const [existe] = await connection.execute<RowDataPacket[]>('SELECT idprod FROM productos WHERE idprod = ?', [idprod]);
    if (!existe[0]) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });

    const datos: Record<string, string | number | null> = {};
    const leer = (campo: string) => {
      const v = formData.get(campo);
      if (v === null) return undefined;
      return v === '' || v === 'null' ? null : String(v).trim();
    };
    for (const c of CAMPOS_TEXTO) {
      const v = leer(c);
      if (v !== undefined) datos[c] = v;
    }
    for (const c of CAMPOS_NUMERO) {
      const v = leer(c);
      if (v !== undefined) datos[c] = v === null ? null : Number(v) || 0;
    }
    for (const c of CAMPOS_ENTERO) {
      const v = leer(c);
      if (v !== undefined) datos[c] = v === null ? null : parseInt(v) || null;
    }
    const exento = leer('exento');
    if (exento !== undefined) datos.exento = exento === 'true' || exento === '1' ? 1 : 0;
    if (datos.nombre === null || datos.OE === null) {
      return NextResponse.json({ error: 'Nombre y Referencia OE son requeridos' }, { status: 400 });
    }

    await connection.beginTransaction();
    if (datos.idcategoria_nuevo !== undefined && datos.codigo_jerarquico === undefined) {
      datos.codigo_jerarquico = await codigoJerarquico(
        connection,
        datos.idcategoria_nuevo as number | null,
        (datos.id_grupo as number | null) ?? null,
        (datos.id_subgrupo as number | null) ?? null
      );
    }
    const campos = Object.keys(datos);
    if (campos.length > 0) {
      await connection.execute(`UPDATE productos SET ${campos.map((c) => `${c} = ?`).join(', ')} WHERE idprod = ?`, [
        ...campos.map((c) => datos[c]),
        idprod,
      ]);
    }

    let nuevas = formData.getAll('imagenes') as File[];
    if (nuevas.length === 0) nuevas = formData.getAll('newImages') as File[];
    await guardarImagenesProducto(connection, idprod, nuevas);
    for (const url of formData.getAll('imagesToDelete')) await borrarImagenProducto(connection, idprod, String(url));
    await connection.commit();

    return NextResponse.json({ success: true, message: 'Producto actualizado exitosamente', product: await leerProducto(connection, idprod) });
  } catch (error) {
    await connection.rollback().catch(() => {});
    console.error('Error al actualizar producto:', error);
    return NextResponse.json({ error: 'Error interno del servidor', details: (error as Error).message }, { status: 500 });
  } finally {
    await connection.end();
  }
}

// GET: un producto con precios, costo e imágenes
export async function GET(_request: Request, context: Contexto) {
  const idprod = idValido((await context.params).id);
  if (!idprod) return NextResponse.json({ error: 'ID de producto inválido' }, { status: 400 });
  const connection = await connectDB();
  try {
    const producto = await leerProducto(connection, idprod);
    if (!producto) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    const [images] = await connection.execute<RowDataPacket[]>(
      'SELECT imagen_url FROM producto_imagenes WHERE idprod = ? ORDER BY es_principal DESC, orden ASC',
      [idprod]
    );
    return NextResponse.json({ product: { ...producto, imagenes: images.map((i) => i.imagen_url) } });
  } catch (error) {
    console.error('Error al obtener producto:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  } finally {
    await connection.end();
  }
}

// DELETE: elimina el producto si no tiene movimientos; todo dentro de una transacción.
export async function DELETE(_request: Request, context: Contexto) {
  const idprod = idValido((await context.params).id);
  if (!idprod) return NextResponse.json({ error: 'ID de producto inválido' }, { status: 400 });
  const connection = await connectDB();
  try {
    const [existe] = await connection.execute<RowDataPacket[]>('SELECT idprod FROM productos WHERE idprod = ?', [idprod]);
    if (!existe[0]) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    const [usos] = await connection.execute<RowDataPacket[]>(
      'SELECT (SELECT COUNT(*) FROM compras_detalle WHERE idprod = ?) AS compras',
      [idprod]
    );
    if (Number(usos[0].compras) > 0) {
      return NextResponse.json({ error: 'El producto tiene compras registradas; no se puede eliminar' }, { status: 400 });
    }
    const [imagenes] = await connection.execute<RowDataPacket[]>('SELECT imagen_url FROM producto_imagenes WHERE idprod = ?', [idprod]);

    await connection.beginTransaction();
    await connection.execute('DELETE FROM producto_imagenes WHERE idprod = ?', [idprod]);
    await connection.execute('DELETE FROM costos WHERE idprod = ?', [idprod]);
    await connection.execute('DELETE FROM precios WHERE idprod = ?', [idprod]);
    await connection.execute('DELETE FROM productos WHERE idprod = ?', [idprod]);
    await connection.commit();
    for (const img of imagenes) await borrarImagenProducto(connection, idprod, String(img.imagen_url));
    return NextResponse.json({ success: true, message: 'Producto eliminado correctamente' });
  } catch (error) {
    await connection.rollback().catch(() => {});
    console.error('Error al eliminar producto:', error);
    return NextResponse.json({ error: 'Error al eliminar producto', details: (error as Error).message }, { status: 500 });
  } finally {
    await connection.end();
  }
}
