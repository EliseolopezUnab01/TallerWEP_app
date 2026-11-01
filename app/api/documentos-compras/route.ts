import { NextRequest, NextResponse } from 'next/server';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { connectDB } from '@/lib/db';
import { nuevoNodocto, siguienteCorrelativo } from '@/lib/correlativos';
import { limpiar, type Conexion } from '@/lib/compras-detalle-db';
import { eliminarArchivos } from '@/lib/archivos';
import { asignarCadena, crearProceso, sincronizarPendientes } from '@/lib/procesos';
import { esCategoriaOperacion } from '@/lib/compras-constantes';
import {
  INCOTERMS,
  MONEDAS,
  TIPOS_DOCUMENTO_COMPRA,
  esTipoDocumentoCompra,
  prefijoDocumento,
  recalcularDocumento,
  tipoSiguiente,
  type TipoDocumentoCompra,
} from '@/lib/documentos-compras';

const CAMPOS_ENCABEZADO = [
  'idproveedor',
  'idcontacto',
  'categoria_operacion',
  'ambito_operacion',
  'fecha_documento',
  'comentarios',
  'moneda_documento',
  'tipo_cambio',
  'incoterm',
  'fecha_est_entrega',
  'condicion_pago',
  'acuerdo_pago',
] as const;

const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function extraerEncabezado(body: Record<string, unknown>) {
  const datos: Record<string, unknown> = {};
  for (const campo of CAMPOS_ENCABEZADO) {
    if (body[campo] === undefined) continue;
    const v = body[campo];
    switch (campo) {
      case 'idproveedor':
      case 'idcontacto':
        datos[campo] = v ? Number(v) : null;
        break;
      case 'tipo_cambio':
        datos[campo] = Number(v) > 0 ? Number(v) : 1;
        break;
      case 'categoria_operacion':
        datos[campo] = esCategoriaOperacion(v) ? v : 'CONTABLE';
        break;
      case 'ambito_operacion':
        datos[campo] = v === 'NACIONAL' ? 'NACIONAL' : 'INTERNACIONAL';
        break;
      case 'condicion_pago':
        datos[campo] = v === 'CREDITO' ? 'CREDITO' : 'CONTADO';
        break;
      case 'moneda_documento': {
        const m = String(v || 'USD').toUpperCase();
        datos[campo] = (MONEDAS as readonly string[]).includes(m) ? m : 'USD';
        break;
      }
      case 'incoterm': {
        const i = limpiar(v)?.toUpperCase() ?? null;
        datos[campo] = i && (INCOTERMS as readonly string[]).includes(i) ? i : null;
        break;
      }
      case 'fecha_documento':
        datos[campo] = limpiar(v) || hoy();
        break;
      default:
        datos[campo] = limpiar(v);
    }
  }
  if (datos.moneda_documento === 'USD') datos.tipo_cambio = 1;
  return datos;
}

async function leerDocumento(connection: Conexion, iddocumento: number) {
  const [rows] = await connection.execute<RowDataPacket[]>(
    `SELECT d.*, p.codigo AS proveedor_codigo, p.nombre_legal AS proveedor_nombre, p.tipo_proveedor,
            c.nombre AS contacto_nombre, o.id_documento AS origen_numero, o.iddocumento AS origen_id,
            pi.codigo AS proceso_codigo
     FROM documentos_compras d
     LEFT JOIN proveedores p ON p.idproveedor = d.idproveedor
     LEFT JOIN proveedor_contactos c ON c.idcontacto = d.idcontacto
     LEFT JOIN documentos_compras o ON o.nodocto = d.nodocto_origen
     LEFT JOIN proceso_ingreso pi ON pi.idproceso = d.idproceso
     WHERE d.iddocumento = ?`,
    [iddocumento]
  );
  return rows[0];
}

/** `lineas: [{ iddetalle, cantidad }]` del selector; null = todas con su cantidad. */
function leerSeleccion(valor: unknown): Map<number, number> | null {
  if (!Array.isArray(valor)) return null;
  const seleccion = new Map<number, number>();
  for (const l of valor as Record<string, unknown>[]) {
    const cantidad = Number(l.cantidad);
    if (Number(l.iddetalle) && cantidad > 0) seleccion.set(Number(l.iddetalle), cantidad);
  }
  return seleccion;
}

/** Copia líneas de otro documento al final de `iddocumento`; el temporal ya enlazado pasa como producto. */
async function copiarLineas(connection: Conexion, iddocumento: number, idorigen: number, seleccion: Map<number, number> | null) {
  const [origen] = await connection.execute<RowDataPacket[]>(
    `SELECT l.*, t.idprod_final FROM documentos_compras_detalle l
     LEFT JOIN productos_temporales t ON t.idtemporal = l.idtemporal
     WHERE l.iddocumento = ? ORDER BY l.linea_visual`,
    [idorigen]
  );
  const copiar = origen.filter((l) => !seleccion || seleccion.has(Number(l.iddetalle)));
  const [ult] = await connection.execute<RowDataPacket[]>(
    'SELECT COALESCE(MAX(linea_visual), 0) AS n FROM documentos_compras_detalle WHERE iddocumento = ?',
    [iddocumento]
  );
  let numero = Number(ult[0].n);
  for (const l of copiar) {
    const idprod = l.idprod ?? l.idprod_final ?? null;
    await connection.execute(
      `INSERT INTO documentos_compras_detalle
         (iddocumento, linea_visual, idprod, idtemporal, iddetalle_origen, referencia_proveedor, oems, descripcion_articulo,
          cantidad, estatus_articulo, precio_moneda, precio_usd, precio_objetivo, fecha_est_produccion, fecha_est_entrega,
          comentario_usuario, comentario_proveedor, origen_producto)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        iddocumento,
        ++numero,
        idprod,
        idprod ? null : l.idtemporal,
        l.iddetalle,
        l.referencia_proveedor,
        l.oems,
        l.descripcion_articulo,
        seleccion?.get(Number(l.iddetalle)) ?? l.cantidad,
        l.estatus_articulo,
        l.precio_moneda,
        l.precio_usd,
        l.precio_objetivo,
        l.fecha_est_produccion,
        l.fecha_est_entrega,
        l.comentario_usuario,
        l.comentario_proveedor,
        l.origen_producto,
      ]
    );
  }
  return copiar.length;
}

async function crearDocumento(
  connection: Conexion,
  tipo: TipoDocumentoCompra,
  datos: Record<string, unknown>,
  origen: number | null
) {
  const nodocto = await nuevoNodocto(connection);
  const { codigo } = await siguienteCorrelativo(connection, prefijoDocumento(tipo));
  const campos = Object.keys(datos);
  const [res] = await connection.execute<ResultSetHeader>(
    `INSERT INTO documentos_compras (nodocto, id_documento, tipo_documento, nodocto_origen${campos.map((c) => `, ${c}`).join('')})
     VALUES (?, ?, ?, ?${campos.map(() => ', ?').join('')})`,
    [nodocto, codigo, tipo, origen, ...campos.map((c) => datos[c] ?? null)]
  );
  return { iddocumento: res.insertId, nodocto, id_documento: codigo };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get('id')) || 0;
  const connection = await connectDB();
  try {
    if (id) {
      const documento = await leerDocumento(connection, id);
      if (!documento) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
      const [lineas] = await connection.execute<RowDataPacket[]>(
        `SELECT l.*, p.nombre AS producto_nombre, t.codigo AS temporal_codigo, t.estado AS temporal_estado,
                t.idprod_final,
                (SELECT COUNT(*) FROM ruta_archivos a WHERE a.entidad = 'PRODUCTO_TEMPORAL' AND a.identidad = l.idtemporal) AS temporal_imagenes
         FROM documentos_compras_detalle l
         LEFT JOIN productos p ON p.idprod = l.idprod
         LEFT JOIN productos_temporales t ON t.idtemporal = l.idtemporal
         WHERE l.iddocumento = ? ORDER BY l.linea_visual`,
        [id]
      );
      const [derivados] = await connection.execute<RowDataPacket[]>(
        `SELECT iddocumento, id_documento, tipo_documento, estado_documento
         FROM documentos_compras WHERE nodocto_origen = ? ORDER BY iddocumento`,
        [documento.nodocto]
      );
      return NextResponse.json({ success: true, documento, lineas, derivados });
    }

    const filtros: string[] = [];
    const valores: (string | number)[] = [];
    const tipo = searchParams.get('tipo');
    const estado = searchParams.get('estado');
    const q = searchParams.get('q')?.trim();
    const idproceso = Number(searchParams.get('idproceso')) || 0;
    if (tipo && esTipoDocumentoCompra(tipo)) {
      filtros.push('d.tipo_documento = ?');
      valores.push(tipo);
    }
    if (estado) {
      filtros.push('d.estado_documento = ?');
      valores.push(estado);
    }
    if (idproceso) {
      filtros.push('d.idproceso = ?');
      valores.push(idproceso);
    }
    if (q) {
      filtros.push('(d.id_documento LIKE ? OR p.nombre_legal LIKE ? OR p.alias LIKE ? OR p.codigo LIKE ? OR d.nodocto = ?)');
      const like = `%${q}%`;
      valores.push(like, like, like, like, /^\d+$/.test(q) ? Number(q) : -1);
    }
    const [documentos] = await connection.execute<RowDataPacket[]>(
      `SELECT d.iddocumento, d.nodocto, d.id_documento, d.tipo_documento, d.estado_documento, d.fecha_documento,
              d.moneda_documento, d.total_moneda, d.total_usd, d.idproceso,
              p.codigo AS proveedor_codigo, p.nombre_legal AS proveedor_nombre,
              (SELECT COUNT(*) FROM documentos_compras_detalle l WHERE l.iddocumento = d.iddocumento) AS total_lineas
       FROM documentos_compras d
       LEFT JOIN proveedores p ON p.idproveedor = d.idproveedor
       ${filtros.length ? `WHERE ${filtros.join(' AND ')}` : ''}
       ORDER BY d.iddocumento DESC LIMIT 200`,
      valores
    );
    return NextResponse.json({ success: true, documentos, tipos: TIPOS_DOCUMENTO_COMPRA });
  } catch (error) {
    console.error('Error al obtener documentos de compra:', error);
    return NextResponse.json({ error: 'Error al obtener documentos', detalle: (error as Error).message }, { status: 500 });
  } finally {
    await connection.end();
  }
}

// POST: crear { tipo_documento, ... } o derivar { accion: 'derivar', iddocumento, tipo_destino? }
export async function POST(request: NextRequest) {
  const body = (await request.json()) as Record<string, unknown>;
  const connection = await connectDB();
  try {
    if (body.accion === 'derivar') {
      const origen = await leerDocumento(connection, Number(body.iddocumento));
      if (!origen) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
      if (origen.estado_documento === 'ANULADO') {
        return NextResponse.json({ error: 'No se puede generar desde un documento anulado' }, { status: 400 });
      }
      const destino = body.tipo_destino ?? tipoSiguiente(origen.tipo_documento);
      if (!esTipoDocumentoCompra(destino)) {
        return NextResponse.json({ error: 'La proforma es el último documento; la factura se ingresa en Compras' }, { status: 400 });
      }

      await connection.beginTransaction();
      const copia: Record<string, unknown> = {
        categoria_operacion: origen.categoria_operacion,
        ambito_operacion: origen.ambito_operacion,
        idproceso: origen.idproceso,
        idproveedor: origen.idproveedor,
        idcontacto: origen.idcontacto,
        fecha_documento: hoy(),
        moneda_documento: origen.moneda_documento,
        tipo_cambio: origen.tipo_cambio,
        incoterm: origen.incoterm,
        fecha_est_entrega: origen.fecha_est_entrega,
        condicion_pago: origen.condicion_pago,
        acuerdo_pago: origen.acuerdo_pago,
      };
      const seleccion = leerSeleccion(body.lineas);
      if (seleccion && seleccion.size === 0) {
        await connection.rollback();
        return NextResponse.json({ error: 'Elija al menos una línea con cantidad' }, { status: 400 });
      }
      const nuevo = await crearDocumento(connection, destino, copia, Number(origen.nodocto));
      await copiarLineas(connection, nuevo.iddocumento, Number(origen.iddocumento), seleccion);
      if (origen.estado_documento === 'BORRADOR' && destino !== origen.tipo_documento) {
        await connection.execute(
          "UPDATE documentos_compras SET estado_documento = 'FINALIZADO' WHERE iddocumento = ?",
          [origen.iddocumento]
        );
      }
      await recalcularDocumento(connection, nuevo.iddocumento);
      if (origen.idproceso) await sincronizarPendientes(connection, Number(origen.idproceso));
      await connection.commit();
      return NextResponse.json({ success: true, ...nuevo, mensaje: `${nuevo.id_documento} generado desde ${origen.id_documento}` });
    }

    if (body.accion === 'cargar') {
      const destino = await leerDocumento(connection, Number(body.iddocumento));
      const origen = await leerDocumento(connection, Number(body.idorigen));
      if (!destino || !origen) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
      if (destino.estado_documento !== 'BORRADOR' || destino.tipo_documento !== 'COTIZACION') {
        return NextResponse.json({ error: 'Solo una cotización en borrador carga líneas de una solicitud' }, { status: 400 });
      }
      if (origen.tipo_documento !== 'SOLICITUD' || origen.estado_documento === 'ANULADO') {
        return NextResponse.json({ error: 'Elija una solicitud que no esté anulada' }, { status: 400 });
      }
      if (origen.idproceso && destino.idproceso && origen.idproceso !== destino.idproceso) {
        return NextResponse.json({ error: `${origen.id_documento} pertenece a otro proceso` }, { status: 400 });
      }
      const seleccion = leerSeleccion(body.lineas);
      await connection.beginTransaction();
      const copiadas = await copiarLineas(connection, Number(destino.iddocumento), Number(origen.iddocumento), seleccion);
      const idproceso = destino.idproceso ?? origen.idproceso ?? null;
      if (idproceso && !destino.idproceso) {
        await connection.execute('UPDATE documentos_compras SET idproceso = ? WHERE iddocumento = ?', [idproceso, destino.iddocumento]);
      }
      await recalcularDocumento(connection, Number(destino.iddocumento));
      if (idproceso) await sincronizarPendientes(connection, Number(idproceso));
      await connection.commit();
      return NextResponse.json({ success: true, mensaje: `${copiadas} línea(s) cargadas de ${origen.id_documento}` });
    }

    const tipo = body.tipo_documento ?? 'SOLICITUD';
    if (!esTipoDocumentoCompra(tipo)) return NextResponse.json({ error: 'Tipo de documento no válido' }, { status: 400 });
    const datos = extraerEncabezado(body);
    datos.fecha_documento ??= hoy();
    if (datos.idproveedor && body.ambito_operacion === undefined) {
      const [prov] = await connection.execute<RowDataPacket[]>(
        'SELECT tipo_proveedor FROM proveedores WHERE idproveedor = ?',
        [datos.idproveedor]
      );
      datos.ambito_operacion = prov[0]?.tipo_proveedor === 'LOCAL' ? 'NACIONAL' : 'INTERNACIONAL';
    }
    await connection.beginTransaction();
    const nuevo = await crearDocumento(connection, tipo, datos, null);
    await connection.commit();
    return NextResponse.json({ success: true, ...nuevo, mensaje: `${nuevo.id_documento} creado` });
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      /* sin transacción */
    }
    console.error('Error al crear documento de compra:', error);
    return NextResponse.json({ error: 'Error al crear documento', detalle: (error as Error).message }, { status: 500 });
  } finally {
    await connection.end();
  }
}

// PUT: { iddocumento, ...encabezado } o { iddocumento, accion: 'finalizar' | 'anular' | 'reabrir' }
export async function PUT(request: NextRequest) {
  const body = (await request.json()) as Record<string, unknown>;
  const iddocumento = Number(body.iddocumento);
  if (!iddocumento) return NextResponse.json({ error: 'Falta iddocumento' }, { status: 400 });
  const connection = await connectDB();
  try {
    const doc = await leerDocumento(connection, iddocumento);
    if (!doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });

    const accion = body.accion ? String(body.accion) : 'actualizar';
    if (accion === 'finalizar' || accion === 'anular' || accion === 'reabrir') {
      const [derivados] = await connection.execute<RowDataPacket[]>(
        "SELECT COUNT(*) AS n FROM documentos_compras WHERE nodocto_origen = ? AND estado_documento <> 'ANULADO'",
        [doc.nodocto]
      );
      const tieneDerivados = Number(derivados[0].n) > 0;
      const reglas: Record<string, [string[], string]> = {
        finalizar: [['BORRADOR'], 'FINALIZADO'],
        anular: [['BORRADOR', 'FINALIZADO'], 'ANULADO'],
        reabrir: [['FINALIZADO'], 'BORRADOR'],
      };
      const [desde, hacia] = reglas[accion];
      if (!desde.includes(doc.estado_documento)) {
        return NextResponse.json({ error: `No se puede ${accion} un documento ${doc.estado_documento}` }, { status: 400 });
      }
      if (accion !== 'finalizar' && tieneDerivados) {
        return NextResponse.json({ error: 'Ya hay documentos generados a partir de este; anúlelos primero' }, { status: 400 });
      }
      await connection.beginTransaction();
      await connection.execute('UPDATE documentos_compras SET estado_documento = ? WHERE iddocumento = ?', [hacia, iddocumento]);
      if (accion === 'finalizar' && body.crear_proceso && doc.tipo_documento === 'SOLICITUD' && !doc.idproceso) {
        const proceso = await crearProceso(connection, {
          descripcion: `Desde ${doc.id_documento}${doc.proveedor_nombre ? ` · ${doc.proveedor_nombre}` : ''}`,
          origen_negociacion: doc.ambito_operacion,
          moneda_factura: doc.moneda_documento,
          tipo_cambio_pagado: doc.tipo_cambio,
        });
        await asignarCadena(connection, Number(doc.nodocto), proceso.idproceso);
        await sincronizarPendientes(connection, proceso.idproceso);
        await connection.commit();
        return NextResponse.json({
          success: true,
          estado_documento: hacia,
          idproceso: proceso.idproceso,
          mensaje: `${doc.id_documento} finalizado; proceso ${proceso.codigo} creado`,
        });
      }
      await connection.commit();
      return NextResponse.json({ success: true, estado_documento: hacia });
    }

    if (doc.estado_documento !== 'BORRADOR') {
      return NextResponse.json({ error: 'Solo se editan documentos en BORRADOR' }, { status: 400 });
    }
    const datos = extraerEncabezado(body);
    if (datos.idproveedor !== undefined && datos.idproveedor !== doc.idproveedor && body.idcontacto === undefined) {
      datos.idcontacto = null;
    }
    const campos = Object.keys(datos);
    if (campos.length > 0) {
      await connection.execute(
        `UPDATE documentos_compras SET ${campos.map((c) => `${c} = ?`).join(', ')} WHERE iddocumento = ?`,
        [...campos.map((c) => datos[c] ?? null), iddocumento]
      );
    }
    await recalcularDocumento(connection, iddocumento);
    return NextResponse.json({ success: true, mensaje: 'Documento guardado' });
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      /* sin transacción */
    }
    console.error('Error al actualizar documento de compra:', error);
    return NextResponse.json({ error: 'Error al actualizar documento', detalle: (error as Error).message }, { status: 500 });
  } finally {
    await connection.end();
  }
}

export async function DELETE(request: NextRequest) {
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
  const connection = await connectDB();
  try {
    const doc = await leerDocumento(connection, id);
    if (!doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
    if (doc.estado_documento !== 'BORRADOR') {
      return NextResponse.json({ error: 'Solo se eliminan borradores; los demás se anulan' }, { status: 400 });
    }
    const [derivados] = await connection.execute<RowDataPacket[]>(
      'SELECT COUNT(*) AS n FROM documentos_compras WHERE nodocto_origen = ?',
      [doc.nodocto]
    );
    if (Number(derivados[0].n) > 0) {
      return NextResponse.json({ error: 'Hay documentos generados a partir de este' }, { status: 400 });
    }
    await connection.execute('DELETE FROM documentos_compras WHERE iddocumento = ?', [id]);
    await eliminarArchivos(connection, { nodocto: Number(doc.nodocto) });
    return NextResponse.json({ success: true, mensaje: 'Borrador eliminado' });
  } catch (error) {
    console.error('Error al eliminar documento de compra:', error);
    return NextResponse.json({ error: 'Error al eliminar documento', detalle: (error as Error).message }, { status: 500 });
  } finally {
    await connection.end();
  }
}
