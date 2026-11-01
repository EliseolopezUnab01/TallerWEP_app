import { NextRequest, NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2/promise';
import { connectDB } from '@/lib/db';
import { limpiar } from '@/lib/compras-detalle-db';
import { eliminarArchivos } from '@/lib/archivos';

const ENTIDAD = 'PRODUCTO_TEMPORAL';
const CAMPOS = ['referencia_proveedor', 'descripcion', 'oems', 'marca', 'origen_producto', 'comentario'] as const;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get('id')) || 0;
  const connection = await connectDB();
  try {
    if (id) {
      const [rows] = await connection.execute<RowDataPacket[]>(
        `SELECT t.*, p.nombre_legal AS proveedor_nombre, f.nombre AS producto_final_nombre
         FROM productos_temporales t
         LEFT JOIN proveedores p ON p.idproveedor = t.idproveedor
         LEFT JOIN productos f ON f.idprod = t.idprod_final
         WHERE t.idtemporal = ?`,
        [id]
      );
      if (!rows[0]) return NextResponse.json({ error: 'Temporal no encontrado' }, { status: 404 });
      const [documentos] = await connection.execute<RowDataPacket[]>(
        `SELECT DISTINCT d.iddocumento, d.id_documento, d.tipo_documento, d.estado_documento
         FROM documentos_compras_detalle l JOIN documentos_compras d ON d.iddocumento = l.iddocumento
         WHERE l.idtemporal = ? OR (l.idprod = ? AND ? IS NOT NULL)
         ORDER BY d.iddocumento`,
        [id, rows[0].idprod_final ?? 0, rows[0].idprod_final ?? null]
      );
      const [imagenes] = await connection.execute<RowDataPacket[]>(
        'SELECT idarchivo, ruta, nombre_original FROM ruta_archivos WHERE entidad = ? AND identidad = ? ORDER BY idarchivo',
        [ENTIDAD, id]
      );
      return NextResponse.json({ success: true, temporal: rows[0], documentos, imagenes });
    }

    const filtros: string[] = [];
    const valores: (string | number)[] = [];
    const estado = searchParams.get('estado');
    const q = searchParams.get('q')?.trim();
    if (estado) {
      filtros.push('t.estado = ?');
      valores.push(estado);
    }
    if (q) {
      filtros.push('(t.codigo LIKE ? OR t.descripcion LIKE ? OR t.referencia_proveedor LIKE ? OR t.oems LIKE ?)');
      const like = `%${q}%`;
      valores.push(like, like, like, like);
    }
    const [temporales] = await connection.execute<RowDataPacket[]>(
      `SELECT t.idtemporal, t.codigo, t.referencia_proveedor, t.descripcion, t.marca, t.estado, t.idprod_final,
              p.nombre_legal AS proveedor_nombre,
              (SELECT COUNT(*) FROM ruta_archivos a WHERE a.entidad = '${ENTIDAD}' AND a.identidad = t.idtemporal) AS imagenes
       FROM productos_temporales t
       LEFT JOIN proveedores p ON p.idproveedor = t.idproveedor
       ${filtros.length ? `WHERE ${filtros.join(' AND ')}` : ''}
       ORDER BY t.idtemporal DESC LIMIT 200`,
      valores
    );
    return NextResponse.json({ success: true, temporales });
  } catch (error) {
    console.error('Error al obtener temporales:', error);
    return NextResponse.json({ error: 'Error al obtener temporales', detalle: (error as Error).message }, { status: 500 });
  } finally {
    await connection.end();
  }
}

// PUT: { idtemporal, ...campos } | { idtemporal, accion: 'descartar' } | { idtemporal, accion: 'convertir', idprod }
export async function PUT(request: NextRequest) {
  const body = (await request.json()) as Record<string, unknown>;
  const idtemporal = Number(body.idtemporal);
  if (!idtemporal) return NextResponse.json({ error: 'Falta idtemporal' }, { status: 400 });
  const connection = await connectDB();
  try {
    const [rows] = await connection.execute<RowDataPacket[]>(
      'SELECT idtemporal, codigo, estado FROM productos_temporales WHERE idtemporal = ?',
      [idtemporal]
    );
    const temporal = rows[0];
    if (!temporal) return NextResponse.json({ error: 'Temporal no encontrado' }, { status: 404 });
    if (temporal.estado !== 'ACTIVO') {
      return NextResponse.json({ error: `El temporal ya está ${temporal.estado}` }, { status: 400 });
    }

    if (body.accion === 'convertir') {
      const idprod = Number(body.idprod);
      const [prod] = await connection.execute<RowDataPacket[]>('SELECT idprod, nombre FROM productos WHERE idprod = ?', [idprod]);
      if (!prod[0]) return NextResponse.json({ error: 'El producto de inventario no existe' }, { status: 400 });

      await connection.beginTransaction();
      await connection.execute(
        "UPDATE productos_temporales SET estado = 'CONVERTIDO', idprod_final = ? WHERE idtemporal = ?",
        [idprod, idtemporal]
      );
      const [lineas] = await connection.execute<RowDataPacket[]>(
        'SELECT COUNT(*) AS n FROM documentos_compras_detalle WHERE idtemporal = ?',
        [idtemporal]
      );
      await connection.execute(
        'UPDATE documentos_compras_detalle SET idprod = ?, idtemporal = NULL WHERE idtemporal = ?',
        [idprod, idtemporal]
      );

      // Si el proceso ya tenía una fila del producto final, se suman las cantidades.
      const [choques] = await connection.execute<RowDataPacket[]>(
        `SELECT t.idpendiente AS idtemp, p.idpendiente AS idprod_fila
         FROM pedido_pendiente t JOIN pedido_pendiente p ON p.idproceso = t.idproceso AND p.idprod = ?
         WHERE t.idtemporal = ?`,
        [idprod, idtemporal]
      );
      for (const c of choques) {
        await connection.execute(
          `UPDATE pedido_pendiente p JOIN pedido_pendiente t ON t.idpendiente = ?
           SET p.cant_cotizado = p.cant_cotizado + t.cant_cotizado, p.cant_ordenado = p.cant_ordenado + t.cant_ordenado,
               p.cant_proforma = p.cant_proforma + t.cant_proforma, p.cant_factura = p.cant_factura + t.cant_factura,
               p.cant_recibido = p.cant_recibido + t.cant_recibido
           WHERE p.idpendiente = ?`,
          [c.idtemp, c.idprod_fila]
        );
        await connection.execute('DELETE FROM pedido_pendiente WHERE idpendiente = ?', [c.idtemp]);
      }
      await connection.execute('UPDATE pedido_pendiente SET idprod = ?, idtemporal = NULL WHERE idtemporal = ?', [
        idprod,
        idtemporal,
      ]);
      const imagenes = await eliminarArchivos(connection, { entidad: ENTIDAD, identidad: idtemporal });
      await connection.commit();
      return NextResponse.json({
        success: true,
        mensaje: `${temporal.codigo} enlazado a ${prod[0].nombre}: ${Number(lineas[0].n)} línea(s) actualizadas, ${imagenes} imagen(es) eliminadas`,
      });
    }

    if (body.accion === 'descartar') {
      const [activos] = await connection.execute<RowDataPacket[]>(
        `SELECT COUNT(*) AS n FROM documentos_compras_detalle l JOIN documentos_compras d ON d.iddocumento = l.iddocumento
         WHERE l.idtemporal = ? AND d.estado_documento <> 'ANULADO'`,
        [idtemporal]
      );
      if (Number(activos[0].n) > 0) {
        return NextResponse.json({ error: 'El temporal está en documentos vigentes; quite esas líneas o anule los documentos' }, { status: 400 });
      }
      await connection.execute("UPDATE productos_temporales SET estado = 'DESCARTADO' WHERE idtemporal = ?", [idtemporal]);
      await eliminarArchivos(connection, { entidad: ENTIDAD, identidad: idtemporal });
      return NextResponse.json({ success: true, mensaje: `${temporal.codigo} descartado` });
    }

    const datos: Record<string, string | null> = {};
    for (const campo of CAMPOS) if (body[campo] !== undefined) datos[campo] = limpiar(body[campo]);
    if ('descripcion' in datos && !datos.descripcion) {
      return NextResponse.json({ error: 'La descripción es obligatoria' }, { status: 400 });
    }
    const campos = Object.keys(datos);
    if (campos.length > 0) {
      await connection.execute(
        `UPDATE productos_temporales SET ${campos.map((c) => `${c} = ?`).join(', ')} WHERE idtemporal = ?`,
        [...campos.map((c) => datos[c]), idtemporal]
      );
    }
    return NextResponse.json({ success: true, mensaje: 'Temporal guardado' });
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      /* sin transacción */
    }
    console.error('Error al actualizar temporal:', error);
    return NextResponse.json({ error: 'Error al actualizar temporal', detalle: (error as Error).message }, { status: 500 });
  } finally {
    await connection.end();
  }
}
