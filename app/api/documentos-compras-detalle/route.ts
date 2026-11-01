import { NextRequest, NextResponse } from 'next/server';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { connectDB } from '@/lib/db';
import { aNumero, limpiar, type Conexion } from '@/lib/compras-detalle-db';
import { ESTATUS_ARTICULO, crearTemporal, recalcularDocumento } from '@/lib/documentos-compras';

const CAMPOS_LINEA = [
  'referencia_proveedor',
  'oems',
  'descripcion_articulo',
  'cantidad',
  'estatus_articulo',
  'precio_moneda',
  'precio_objetivo',
  'fecha_est_produccion',
  'fecha_est_entrega',
  'comentario_usuario',
  'comentario_proveedor',
  'origen_producto',
] as const;

function extraerLinea(body: Record<string, unknown>) {
  const datos: Record<string, unknown> = {};
  for (const campo of CAMPOS_LINEA) {
    if (body[campo] === undefined) continue;
    const v = body[campo];
    if (campo === 'cantidad' || campo === 'precio_moneda') {
      datos[campo] = Math.max(0, aNumero(v));
    } else if (campo === 'precio_objetivo') {
      datos[campo] = v === null || v === '' ? null : Math.max(0, aNumero(v));
    } else if (campo === 'estatus_articulo') {
      datos[campo] = (ESTATUS_ARTICULO as readonly string[]).includes(String(v)) ? v : 'DESCONOCIDO';
    } else {
      datos[campo] = limpiar(v);
    }
  }
  return datos;
}

/** Numera 1..n según `orden` (ids) o, si no se da, según el orden actual. */
async function renumerar(connection: Conexion, iddocumento: number, orden?: number[]) {
  const [filas] = await connection.execute<RowDataPacket[]>(
    'SELECT iddetalle FROM documentos_compras_detalle WHERE iddocumento = ? ORDER BY linea_visual',
    [iddocumento]
  );
  const actuales = filas.map((f) => Number(f.iddetalle));
  const pedidos = (orden ?? []).filter((id) => actuales.includes(id));
  const ids = [...pedidos, ...actuales.filter((id) => !pedidos.includes(id))];
  await connection.execute(
    'UPDATE documentos_compras_detalle SET linea_visual = linea_visual + 100000 WHERE iddocumento = ?',
    [iddocumento]
  );
  for (const [i, id] of ids.entries()) {
    await connection.execute('UPDATE documentos_compras_detalle SET linea_visual = ? WHERE iddetalle = ?', [i + 1, id]);
  }
}

async function documentoEditable(connection: Conexion, iddocumento: number) {
  const [rows] = await connection.execute<RowDataPacket[]>(
    'SELECT iddocumento, estado_documento, idproveedor FROM documentos_compras WHERE iddocumento = ?',
    [iddocumento]
  );
  const doc = rows[0];
  if (!doc) return { error: 'Documento no encontrado', status: 404 } as const;
  if (doc.estado_documento !== 'BORRADOR') return { error: 'Solo se editan documentos en BORRADOR', status: 400 } as const;
  return { doc } as const;
}

// POST: { iddocumento, idprod } desde inventario o { iddocumento, descripcion_articulo, ... } a mano (crea temporal)
export async function POST(request: NextRequest) {
  const body = (await request.json()) as Record<string, unknown>;
  const iddocumento = Number(body.iddocumento);
  if (!iddocumento) return NextResponse.json({ error: 'Falta iddocumento' }, { status: 400 });
  const connection = await connectDB();
  try {
    const estado = await documentoEditable(connection, iddocumento);
    if ('error' in estado) return NextResponse.json({ error: estado.error }, { status: estado.status });

    const datos = extraerLinea(body);
    let idprod = Number(body.idprod) || null;
    let idtemporal = Number(body.idtemporal) || null;

    await connection.beginTransaction();
    if (idprod) {
      const [prod] = await connection.execute<RowDataPacket[]>(
        'SELECT idprod, nombre, idprodprov, OE FROM productos WHERE idprod = ?',
        [idprod]
      );
      if (!prod[0]) {
        await connection.rollback();
        return NextResponse.json({ error: 'El producto no existe en inventario' }, { status: 400 });
      }
      datos.descripcion_articulo ??= prod[0].nombre;
      datos.referencia_proveedor ??= prod[0].idprodprov ?? null;
      datos.oems ??= prod[0].OE ?? null;
      idtemporal = null;
    } else if (idtemporal) {
      const [temp] = await connection.execute<RowDataPacket[]>(
        'SELECT idtemporal, descripcion, referencia_proveedor, oems, origen_producto, estado, idprod_final FROM productos_temporales WHERE idtemporal = ?',
        [idtemporal]
      );
      if (!temp[0] || temp[0].estado === 'DESCARTADO') {
        await connection.rollback();
        return NextResponse.json({ error: 'El producto temporal no existe o fue descartado' }, { status: 400 });
      }
      if (temp[0].idprod_final) {
        idprod = Number(temp[0].idprod_final);
        idtemporal = null;
      }
      datos.descripcion_articulo ??= temp[0].descripcion;
      datos.referencia_proveedor ??= temp[0].referencia_proveedor ?? null;
      datos.oems ??= temp[0].oems ?? null;
      datos.origen_producto ??= temp[0].origen_producto ?? null;
    } else {
      const descripcion = limpiar(datos.descripcion_articulo);
      if (!descripcion) {
        await connection.rollback();
        return NextResponse.json({ error: 'Escriba la descripción del producto' }, { status: 400 });
      }
      const temporal = await crearTemporal(connection, {
        descripcion,
        referencia_proveedor: limpiar(datos.referencia_proveedor),
        oems: limpiar(datos.oems),
        marca: limpiar(body.marca),
        origen_producto: limpiar(datos.origen_producto),
        idproveedor: estado.doc.idproveedor ? Number(estado.doc.idproveedor) : null,
      });
      idtemporal = temporal.idtemporal;
    }

    const [ult] = await connection.execute<RowDataPacket[]>(
      'SELECT COALESCE(MAX(linea_visual), 0) + 1 AS siguiente FROM documentos_compras_detalle WHERE iddocumento = ?',
      [iddocumento]
    );
    datos.cantidad ??= 1;
    const campos = Object.keys(datos);
    const [res] = await connection.execute<ResultSetHeader>(
      `INSERT INTO documentos_compras_detalle (iddocumento, linea_visual, idprod, idtemporal${campos.map((c) => `, ${c}`).join('')})
       VALUES (?, ?, ?, ?${campos.map(() => ', ?').join('')})`,
      [iddocumento, Number(ult[0].siguiente), idprod, idtemporal, ...campos.map((c) => datos[c] ?? null)]
    );
    await recalcularDocumento(connection, iddocumento);
    await connection.commit();
    return NextResponse.json({ success: true, iddetalle: res.insertId, idtemporal });
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      /* sin transacción */
    }
    console.error('Error al agregar línea de documento:', error);
    return NextResponse.json({ error: 'Error al agregar la línea', detalle: (error as Error).message }, { status: 500 });
  } finally {
    await connection.end();
  }
}

// PUT: { iddetalle, ...campos } o { iddocumento, orden: [iddetalle...] } para reordenar
export async function PUT(request: NextRequest) {
  const body = (await request.json()) as Record<string, unknown>;
  const connection = await connectDB();
  try {
    if (Array.isArray(body.orden)) {
      const iddocumento = Number(body.iddocumento);
      const estado = await documentoEditable(connection, iddocumento);
      if ('error' in estado) return NextResponse.json({ error: estado.error }, { status: estado.status });
      await connection.beginTransaction();
      await renumerar(connection, iddocumento, body.orden.map(Number).filter(Boolean));
      await connection.commit();
      return NextResponse.json({ success: true });
    }

    const iddetalle = Number(body.iddetalle);
    if (!iddetalle) return NextResponse.json({ error: 'Falta iddetalle' }, { status: 400 });
    const [linea] = await connection.execute<RowDataPacket[]>(
      'SELECT iddocumento FROM documentos_compras_detalle WHERE iddetalle = ?',
      [iddetalle]
    );
    if (!linea[0]) return NextResponse.json({ error: 'Línea no encontrada' }, { status: 404 });
    const iddocumento = Number(linea[0].iddocumento);
    const estado = await documentoEditable(connection, iddocumento);
    if ('error' in estado) return NextResponse.json({ error: estado.error }, { status: estado.status });

    const datos = extraerLinea(body);
    if ('descripcion_articulo' in datos && !datos.descripcion_articulo) {
      return NextResponse.json({ error: 'La descripción no puede quedar vacía' }, { status: 400 });
    }
    const campos = Object.keys(datos);
    if (campos.length > 0) {
      await connection.execute(
        `UPDATE documentos_compras_detalle SET ${campos.map((c) => `${c} = ?`).join(', ')} WHERE iddetalle = ?`,
        [...campos.map((c) => datos[c] ?? null), iddetalle]
      );
    }
    await recalcularDocumento(connection, iddocumento);
    return NextResponse.json({ success: true });
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      /* sin transacción */
    }
    console.error('Error al actualizar línea de documento:', error);
    return NextResponse.json({ error: 'Error al actualizar la línea', detalle: (error as Error).message }, { status: 500 });
  } finally {
    await connection.end();
  }
}

export async function DELETE(request: NextRequest) {
  const iddetalle = Number(new URL(request.url).searchParams.get('id'));
  if (!iddetalle) return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
  const connection = await connectDB();
  try {
    const [linea] = await connection.execute<RowDataPacket[]>(
      'SELECT iddocumento FROM documentos_compras_detalle WHERE iddetalle = ?',
      [iddetalle]
    );
    if (!linea[0]) return NextResponse.json({ error: 'Línea no encontrada' }, { status: 404 });
    const iddocumento = Number(linea[0].iddocumento);
    const estado = await documentoEditable(connection, iddocumento);
    if ('error' in estado) return NextResponse.json({ error: estado.error }, { status: estado.status });

    await connection.beginTransaction();
    await connection.execute('DELETE FROM documentos_compras_detalle WHERE iddetalle = ?', [iddetalle]);
    await renumerar(connection, iddocumento);
    await recalcularDocumento(connection, iddocumento);
    await connection.commit();
    return NextResponse.json({ success: true });
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      /* sin transacción */
    }
    console.error('Error al eliminar línea de documento:', error);
    return NextResponse.json({ error: 'Error al eliminar la línea', detalle: (error as Error).message }, { status: 500 });
  } finally {
    await connection.end();
  }
}
