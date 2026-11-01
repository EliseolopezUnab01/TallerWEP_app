import { NextRequest, NextResponse } from 'next/server';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { connectDB } from '@/lib/db';
import { nuevoNodocto, siguienteCorrelativo } from '@/lib/correlativos';
import { aNumero, insertarLinea, limpiar, normalizarLinea, persistirTotales, type Conexion } from '@/lib/compras-detalle-db';
import { MONEDAS } from '@/lib/documentos-compras-constantes';
import { eliminarArchivos } from '@/lib/archivos';
import { r8 } from '@/lib/decimales';
import {
  ESTADOS_PROCESO,
  RAZONES_NO_GASTO,
  asignarCadena,
  buscarDocumento,
  crearProceso,
  inversionDelProceso,
  normalizarCategoria,
  recalcularProceso,
  sincronizarPendientes,
} from '@/lib/procesos';
import {
  calcularRetaceo,
  finalizarRetaceo,
  guardarCalculoDuca,
  lineasDelProceso,
  parametrosDelProceso,
  reabrirRetaceo,
} from '@/lib/retaceo';
import { comparePasswords } from '@/lib/auth';
import { requierePermiso } from '@/lib/sesion';

/** Lo que ya pasó por aduana: no cambia después del primer retaceo aplicado. */
const CAMPOS_ADUANA = [
  'numero_duca',
  'fecha_duca',
  'mandamiento_pago',
  'incoterm_duca',
  'tipo_cambio_duca',
  'seguro_declarado',
  'flete_declarado',
  'total_productos_duca',
  'gastos_declarados',
  'valor_cif_duca',
  'iva_pagado',
  'dai_pagado',
  'vts_pagado',
  'its_pagado',
  'otros_cargos_pagados',
  'total_pagado_duca',
];

const CAMPOS_DUCA = [
  'numero_duca',
  'fecha_duca',
  'mandamiento_pago',
  'incoterm_duca',
  'tipo_cambio_duca',
  'seguro_declarado',
  'flete_declarado',
  'total_productos_duca',
  'gastos_declarados',
  'valor_cif_duca',
  'gastos_no_declarados',
  'total_costos_operativos',
  'peso_carga',
  'volumen_carga',
  'iva_pagado',
  'dai_pagado',
  'vts_pagado',
  'its_pagado',
  'otros_cargos_pagados',
  'total_pagado_duca',
  'gasto_total_inversion',
  'comentarios',
] as const;
const TEXTO_DUCA = ['numero_duca', 'fecha_duca', 'mandamiento_pago', 'incoterm_duca', 'peso_carga', 'volumen_carga', 'comentarios'];

const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

async function leerProceso(connection: Conexion, idproceso: number) {
  const [rows] = await connection.execute<RowDataPacket[]>('SELECT * FROM proceso_ingreso WHERE idproceso = ?', [idproceso]);
  return rows[0];
}

async function detalleProceso(connection: Conexion, idproceso: number) {
  const proceso = await leerProceso(connection, idproceso);
  if (!proceso) return null;
  const resumen = await recalcularProceso(connection, idproceso);
  const [facturas] = await connection.execute<RowDataPacket[]>(
    `SELECT c.idcompra, c.nodocto, c.numero_interno, c.numero_factura, c.estado, c.clase_documento, c.fecha_emision,
            c.sub_total, c.total_pagar, p.nombre_legal AS proveedor_nombre,
            (SELECT COUNT(*) FROM compras_detalle d WHERE d.idcompra = c.idcompra) AS total_lineas
     FROM compras c LEFT JOIN proveedores p ON p.idproveedor = c.idproveedor
     WHERE c.idproceso = ? ORDER BY c.idcompra`,
    [idproceso]
  );
  const [documentos] = await connection.execute<RowDataPacket[]>(
    `SELECT iddocumento, nodocto, id_documento, tipo_documento, estado_documento, moneda_documento, total_moneda, total_usd
     FROM documentos_compras WHERE idproceso = ? ORDER BY iddocumento`,
    [idproceso]
  );
  const [relaciones] = await connection.execute<RowDataPacket[]>(
    `SELECT r.*, COALESCE(c.numero_factura, c.numero_interno, dc.id_documento) AS numero_sistema,
            c.idcompra, dc.iddocumento, c.total_xcomprobar
     FROM relacion_documentos r
     LEFT JOIN compras c ON c.nodocto = r.nodocto
     LEFT JOIN documentos_compras dc ON dc.nodocto = r.nodocto
     WHERE r.idproceso = ? ORDER BY r.idrelacion`,
    [idproceso]
  );
  const [ducas] = await connection.execute<RowDataPacket[]>('SELECT * FROM datos_duca WHERE idproceso = ?', [idproceso]);
  const [gastos] = await connection.execute<RowDataPacket[]>(
    'SELECT * FROM gastos_sindocumento WHERE idproceso = ? ORDER BY idgasto',
    [idproceso]
  );
  const [pendientes] = await connection.execute<RowDataPacket[]>(
    `SELECT pp.*, COALESCE(p.nombre, t.descripcion) AS descripcion, t.codigo AS temporal_codigo, p.idprodprov
     FROM pedido_pendiente pp
     LEFT JOIN productos p ON p.idprod = pp.idprod
     LEFT JOIN productos_temporales t ON t.idtemporal = pp.idtemporal
     WHERE pp.idproceso = ? ORDER BY COALESCE(p.nombre, t.descripcion)`,
    [idproceso]
  );
  const lineas = await lineasDelProceso(connection, idproceso);
  const parametros = await parametrosDelProceso(connection, idproceso);
  const simulacion =
    parametros && lineas.length
      ? calcularRetaceo(
          lineas.map((l) => ({
            iddetalle: Number(l.iddetalle),
            idprod: l.idprod ? Number(l.idprod) : null,
            cantidad: Number(l.cantidad),
            costo_divisa: Number(l.costo_divisa),
            valor_dai: Number(l.valor_dai),
            costo_corregido: l.costo_corregido == null ? null : Number(l.costo_corregido),
          })),
          parametros
        )
      : null;
  const inversion = await inversionDelProceso(connection, idproceso);
  const duca = ducas[0] ?? null;
  const impuestos = [
    { impuesto: 'DAI', calculado: simulacion?.dai_calculado ?? null, duca: duca ? Number(duca.dai_pagado) : null },
    { impuesto: 'IVA', calculado: simulacion?.iva_calculado ?? null, duca: duca ? Number(duca.iva_pagado) : null },
    { impuesto: 'VTS', calculado: null, duca: duca ? Number(duca.vts_pagado) : null },
    { impuesto: 'ITS', calculado: null, duca: duca ? Number(duca.its_pagado) : null },
  ];
  const [archivosGastos] = await connection.execute<RowDataPacket[]>(
    `SELECT identidad, COUNT(*) AS total FROM ruta_archivos
     WHERE entidad = 'GASTO' AND identidad IN (SELECT idgasto FROM gastos_sindocumento WHERE idproceso = ?)
     GROUP BY identidad`,
    [idproceso]
  );
  const conArchivos = new Map(archivosGastos.map((a) => [Number(a.identidad), Number(a.total)]));
  return {
    proceso,
    resumen,
    facturas,
    documentos,
    relaciones,
    duca,
    gastos: gastos.map((g) => ({ ...g, archivos: conArchivos.get(Number(g.idgasto)) ?? 0 })),
    pendientes,
    lineas,
    simulacion,
    inversion,
    impuestos,
    aduana_bloqueada: Boolean(proceso.fecha_retaceo),
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get('id')) || 0;
  const connection = await connectDB();
  try {
    if (id) {
      const detalle = await detalleProceso(connection, id);
      if (!detalle) return json({ error: 'Proceso no encontrado' }, 404);
      return json({ success: true, ...detalle });
    }
    const filtros: string[] = [];
    const valores: (string | number)[] = [];
    const q = searchParams.get('q')?.trim();
    const estado = searchParams.get('estado');
    if (estado) {
      filtros.push('p.estado_documento = ?');
      valores.push(estado);
    }
    if (q) {
      filtros.push('(p.codigo LIKE ? OR p.descripcion LIKE ? OR p.factura_compra LIKE ? OR d.numero_duca LIKE ?)');
      const like = `%${q}%`;
      valores.push(like, like, like, like);
    }
    const [procesos] = await connection.execute<RowDataPacket[]>(
      `SELECT p.idproceso, p.codigo, p.descripcion, p.estado_documento, p.estado_proceso, p.origen_negociacion,
              p.total_factura, p.total_retaceo, p.created_at, d.numero_duca,
              (SELECT COUNT(*) FROM compras c WHERE c.idproceso = p.idproceso) AS facturas
       FROM proceso_ingreso p LEFT JOIN datos_duca d ON d.idproceso = p.idproceso
       ${filtros.length ? `WHERE ${filtros.join(' AND ')}` : ''}
       ORDER BY p.idproceso DESC LIMIT 200`,
      valores
    );
    return json({ success: true, procesos });
  } catch (error) {
    console.error('Error al obtener procesos:', error);
    return json({ error: 'Error al obtener procesos', detalle: (error as Error).message }, 500);
  } finally {
    await connection.end();
  }
}

// POST: crear proceso o ejecutar una acción { accion, idproceso, ... }
export async function POST(request: NextRequest) {
  const body = (await request.json()) as Record<string, unknown>;
  const accion = String(body.accion || 'crear');
  const connection = await connectDB();
  try {
    if (accion === 'crear') {
      await connection.beginTransaction();
      const { idproceso, codigo } = await crearProceso(connection, {
        descripcion: limpiar(body.descripcion),
        origen_negociacion: body.origen_negociacion,
        moneda_factura: body.moneda_factura,
        tipo_cambio_pagado: body.tipo_cambio_pagado,
      });
      await connection.commit();
      return json({ success: true, idproceso, codigo, mensaje: `Proceso ${codigo} creado` });
    }

    const idproceso = Number(body.idproceso);
    const proceso = idproceso ? await leerProceso(connection, idproceso) : null;
    if (!proceso) return json({ error: 'Proceso no encontrado' }, 404);
    const cerrado = proceso.estado_documento === 'FINALIZADO';
    const aduanaBloqueada = Boolean(proceso.fecha_retaceo);
    const accionesCerrado = ['sincronizar', 'pendiente', 'reabrir'];
    if (cerrado && !accionesCerrado.includes(accion)) {
      return json({ error: 'El retaceo ya se aplicó; reábralo para hacer cambios' }, 400);
    }

    switch (accion) {
      case 'reabrir': {
        const auth = await requierePermiso(request, 'compras.reabrir');
        if (auth instanceof NextResponse) return auth;
        const idusuario = auth.id;
        const clave = String(body.password || '');
        if (!clave) return json({ error: 'Escriba su contraseña' }, 400);
        const [usuarios] = await connection.execute<RowDataPacket[]>('SELECT password FROM usuarios WHERE id = ?', [idusuario]);
        if (!usuarios[0] || !(await comparePasswords(clave, usuarios[0].password))) {
          return json({ error: 'Contraseña incorrecta' }, 401);
        }
        await reabrirRetaceo(connection, idproceso, idusuario);
        return json({
          success: true,
          mensaje: 'Retaceo reabierto. Agregue lo olvidado y vuelva a aplicar; los datos de aduana quedan bloqueados.',
        });
      }

      case 'vincular': {
        const razon = normalizarCategoria(body.razon_vinculo);
        if (!razon) return json({ error: 'Indique la categoría del documento' }, 400);
        const nodocto = Number(body.nodocto) || null;
        const ref = limpiar(body.ref_documento);
        if (!nodocto && !ref) return json({ error: 'Indique el ID del documento o una referencia externa' }, 400);

        await connection.beginTransaction();
        let total = aNumero(body.total_usd);
        let mensaje = `${ref} vinculado como ${razon}`;
        if (nodocto) {
          const doc = await buscarDocumento(connection, nodocto);
          if (!doc) {
            await connection.rollback();
            return json({ error: `No existe un documento con ID ${nodocto}` }, 400);
          }
          const [dup] = await connection.execute<RowDataPacket[]>(
            'SELECT idrelacion FROM relacion_documentos WHERE idproceso = ? AND nodocto = ? AND razon_vinculo = ?',
            [idproceso, nodocto, razon]
          );
          if (dup[0]) {
            await connection.rollback();
            return json({ error: `${doc.numero} ya está vinculado como ${razon}` }, 400);
          }
          if (doc.idproceso && doc.idproceso !== idproceso && (razon === 'FACTURA' || doc.tipo === 'DOCUMENTO')) {
            await connection.rollback();
            return json({ error: `${doc.numero} ya pertenece a otro proceso` }, 400);
          }
          if (body.total_usd === undefined || body.total_usd === '') total = doc.fiscal;
          if (doc.tipo === 'COMPRA' && razon === 'FACTURA') {
            const [express] = await connection.execute<RowDataPacket[]>(
              "SELECT COUNT(*) AS total FROM compras_detalle WHERE idcompra = ? AND destino = 'EXPRESS'",
              [doc.id]
            );
            if (Number(express[0].total) > 0) {
              await connection.rollback();
              return json({ error: `${doc.numero} tiene líneas express; express no entra en un DUCA` }, 400);
            }
            await connection.execute('UPDATE compras SET idproceso = ? WHERE idcompra = ?', [idproceso, doc.id]);
          }
          if (doc.tipo === 'DOCUMENTO') await asignarCadena(connection, nodocto, idproceso);
          mensaje = `${doc.numero} vinculado como ${razon}`;
        }
        const incluir =
          body.incluir_retaceo === undefined ? !(RAZONES_NO_GASTO as readonly string[]).includes(razon) : Boolean(body.incluir_retaceo);
        await connection.execute(
          `INSERT INTO relacion_documentos (idproceso, nodocto, ref_documento, razon_vinculo, total_usd, incluir_retaceo, comentarios)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [idproceso, nodocto, ref, razon, total, incluir ? 1 : 0, limpiar(body.comentarios)]
        );
        await sincronizarPendientes(connection, idproceso);
        await connection.commit();
        return json({ success: true, mensaje });
      }

      case 'desvincular': {
        const idrelacion = Number(body.idrelacion);
        const [rels] = await connection.execute<RowDataPacket[]>(
          'SELECT * FROM relacion_documentos WHERE idrelacion = ? AND idproceso = ?',
          [idrelacion, idproceso]
        );
        const rel = rels[0];
        if (!rel) return json({ error: 'Vínculo no encontrado' }, 404);
        if (rel.razon_vinculo === 'FACTURA' && rel.nodocto) {
          const [enBodega] = await connection.execute<RowDataPacket[]>(
            `SELECT COUNT(*) AS total FROM costos_productos cp
             JOIN compras_detalle d ON d.iddetalle = cp.iddetalle JOIN compras c ON c.idcompra = d.idcompra
             WHERE c.nodocto = ? AND cp.stock_aplicado = 1`,
            [rel.nodocto]
          );
          if (Number(enBodega[0].total) > 0) {
            return json({ error: 'Esa factura ya entró al inventario con el retaceo; no se puede desvincular' }, 400);
          }
        }
        await connection.beginTransaction();
        await connection.execute('DELETE FROM relacion_documentos WHERE idrelacion = ?', [idrelacion]);
        if (rel.nodocto) {
          const [otros] = await connection.execute<RowDataPacket[]>(
            'SELECT razon_vinculo FROM relacion_documentos WHERE idproceso = ? AND nodocto = ?',
            [idproceso, rel.nodocto]
          );
          const doc = await buscarDocumento(connection, Number(rel.nodocto));
          if (doc?.tipo === 'COMPRA' && rel.razon_vinculo === 'FACTURA' && !otros.some((o) => o.razon_vinculo === 'FACTURA')) {
            await connection.execute('DELETE FROM duca_detalles WHERE iddetalle IN (SELECT iddetalle FROM compras_detalle WHERE idcompra = ?)', [doc.id]);
            await connection.execute('UPDATE compras SET idproceso = NULL WHERE idcompra = ?', [doc.id]);
          }
          if (doc?.tipo === 'DOCUMENTO' && otros.length === 0) await asignarCadena(connection, Number(rel.nodocto), null);
        }
        await sincronizarPendientes(connection, idproceso);
        await connection.commit();
        return json({ success: true, mensaje: 'Vínculo eliminado' });
      }

      case 'duca': {
        const datos: Record<string, unknown> = {};
        for (const campo of CAMPOS_DUCA) {
          if (body[campo] === undefined) continue;
          if (aduanaBloqueada && CAMPOS_ADUANA.includes(campo)) continue;
          datos[campo] = TEXTO_DUCA.includes(campo) ? limpiar(body[campo]) : aNumero(body[campo]);
        }
        if (datos.tipo_cambio_duca !== undefined && !(Number(datos.tipo_cambio_duca) > 0)) datos.tipo_cambio_duca = 1;
        const [existe] = await connection.execute<RowDataPacket[]>('SELECT idduca FROM datos_duca WHERE idproceso = ?', [idproceso]);
        const campos = Object.keys(datos);
        if (existe[0]) {
          if (campos.length) {
            await connection.execute(
              `UPDATE datos_duca SET ${campos.map((c) => `${c} = ?`).join(', ')} WHERE idproceso = ?`,
              [...campos.map((c) => datos[c] ?? null), idproceso]
            );
          }
        } else {
          const nodocto = await nuevoNodocto(connection);
          await connection.execute(
            `INSERT INTO datos_duca (idproceso, nodocto${campos.map((c) => `, ${c}`).join('')})
             VALUES (?, ?${campos.map(() => ', ?').join('')})`,
            [idproceso, nodocto, ...campos.map((c) => datos[c] ?? null)]
          );
        }
        if (datos.numero_duca !== undefined) {
          await connection.execute('UPDATE duca_detalles SET numero_duca = ? WHERE idproceso = ?', [datos.numero_duca, idproceso]);
        }
        return json({ success: true, mensaje: 'DUCA guardado' });
      }

      case 'linea_duca': {
        const iddetalle = Number(body.iddetalle);
        const [linea] = await connection.execute<RowDataPacket[]>(
          `SELECT d.iddetalle, d.idprod, COALESCE(cp.stock_aplicado, 0) AS aplicada
           FROM compras_detalle d JOIN compras c ON c.idcompra = d.idcompra
           LEFT JOIN costos_productos cp ON cp.iddetalle = d.iddetalle
           WHERE d.iddetalle = ? AND c.idproceso = ?`,
          [iddetalle, idproceso]
        );
        if (!linea[0]) return json({ error: 'La línea no pertenece a este proceso' }, 400);
        if (Number(linea[0].aplicada)) return json({ error: 'La partida y el DAI de esa línea ya pasaron por aduana; no se cambian' }, 400);
        const valorDai = Math.max(0, aNumero(body.valor_dai));
        await connection.execute(
          `INSERT INTO duca_detalles (idproceso, iddetalle, idprod, codigo_arancelario, valor_dai, dai_preferente)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE codigo_arancelario = VALUES(codigo_arancelario), valor_dai = VALUES(valor_dai),
             dai_preferente = VALUES(dai_preferente)`,
          [idproceso, iddetalle, linea[0].idprod, limpiar(body.codigo_arancelario), valorDai, body.dai_preferente ? 1 : 0]
        );
        return json({ success: true });
      }

      case 'ingresar_factura': {
        const [docs] = await connection.execute<RowDataPacket[]>(
          `SELECT iddocumento, id_documento, idproveedor, estado_documento FROM documentos_compras
           WHERE iddocumento = ? AND idproceso = ?`,
          [Number(body.iddocumento), idproceso]
        );
        const doc = docs[0];
        if (!doc) return json({ error: 'El documento no pertenece a este proceso' }, 400);
        if (doc.estado_documento === 'ANULADO') return json({ error: `${doc.id_documento} está anulado` }, 400);
        if (!doc.idproveedor) return json({ error: `${doc.id_documento} no tiene proveedor` }, 400);

        const pedidas = new Map<number, number>();
        for (const l of Array.isArray(body.lineas) ? (body.lineas as Record<string, unknown>[]) : []) {
          const cantidad = aNumero(l.cantidad);
          if (Number(l.iddetalle) && cantidad > 0) pedidas.set(Number(l.iddetalle), cantidad);
        }
        if (pedidas.size === 0) return json({ error: 'Marque al menos una línea que sí salió' }, 400);

        const [lineas] = await connection.execute<RowDataPacket[]>(
          `SELECT l.iddetalle, l.linea_visual, COALESCE(l.idprod, t.idprod_final) AS idprod, l.descripcion_articulo,
                  l.referencia_proveedor, l.precio_moneda, l.cantidad
           FROM documentos_compras_detalle l LEFT JOIN productos_temporales t ON t.idtemporal = l.idtemporal
           WHERE l.iddocumento = ? ORDER BY l.linea_visual`,
          [doc.iddocumento]
        );
        const elegidas = lineas.filter((l) => pedidas.has(Number(l.iddetalle)));
        const sinFicha = elegidas.filter((l) => !l.idprod).map((l) => l.linea_visual);
        if (sinFicha.length) {
          return json({ error: `Línea(s) ${sinFicha.join(', ')}: el producto temporal aún no tiene ficha; enlácelo antes de facturar` }, 400);
        }
        const excedidas = elegidas.filter((l) => pedidas.get(Number(l.iddetalle))! > Number(l.cantidad)).map((l) => l.linea_visual);
        if (excedidas.length) return json({ error: `Línea(s) ${excedidas.join(', ')}: la cantidad pasa la del documento` }, 400);

        const nacional = proceso.origen_negociacion === 'NACIONAL';
        await connection.beginTransaction();
        const nodocto = await nuevoNodocto(connection);
        const { codigo } = await siguienteCorrelativo(connection, nacional ? 'CP' : 'CI');
        const [res] = await connection.execute<ResultSetHeader>(
          `INSERT INTO compras (estado, nodocto, numero_interno, clase_documento, tipo_dte, categoria_operacion, idproveedor,
                                fecha_emision, numero_factura, idproceso, descuento_afecta_costo)
           VALUES ('BORRADOR', ?, ?, ?, ?, 'CONTABLE', ?, CURDATE(), ?, ?,
                   COALESCE((SELECT descuento_modo = 'COSTO' FROM empresa WHERE activo = 1 ORDER BY idempresa LIMIT 1), 0))`,
          [nodocto, codigo, nacional ? 'DTE' : 'IMPORTACION', nacional ? '03' : null, doc.idproveedor, limpiar(body.numero_factura), idproceso]
        );
        const idcompra = res.insertId;
        for (const [i, l] of elegidas.entries()) {
          await insertarLinea(
            connection,
            normalizarLinea({
              idcompra,
              numero_linea: i + 1,
              destino: 'INVENTARIO',
              idprod: l.idprod,
              referencia_proveedor: l.referencia_proveedor,
              descripcion: l.descripcion_articulo,
              cantidad: pedidas.get(Number(l.iddetalle)),
              costo_unitario: Number(l.precio_moneda),
              condicion_iva: nacional ? 'GRAVADA' : 'NO_SUJETO',
            })
          );
        }
        await persistirTotales(connection, idcompra);
        const compra = await buscarDocumento(connection, nodocto);
        await connection.execute(
          `INSERT INTO relacion_documentos (idproceso, nodocto, razon_vinculo, total_usd, incluir_retaceo, comentarios)
           VALUES (?, ?, 'FACTURA', ?, 0, ?)`,
          [idproceso, nodocto, compra?.fiscal ?? 0, `Desde ${doc.id_documento}`]
        );
        await sincronizarPendientes(connection, idproceso);
        await connection.commit();
        return json({
          success: true,
          idcompra,
          mensaje: `Factura ${codigo} creada en borrador con ${elegidas.length} línea(s) de ${doc.id_documento}`,
        });
      }

      case 'gasto': {
        const descripcion = limpiar(body.descripcion);
        if (!descripcion) return json({ error: 'Escriba la descripción del gasto' }, 400);
        const [res] = await connection.execute<ResultSetHeader>(
          `INSERT INTO gastos_sindocumento
             (idproceso, ref_nodocto, ref_orden_servicio, ref_otros, descripcion, categoria, recibe, entrega, monto_salida, fecha_salida, incluir_retaceo, comentario)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            idproceso,
            Number(body.ref_nodocto) || null,
            limpiar(body.ref_orden_servicio),
            limpiar(body.ref_otros),
            descripcion,
            normalizarCategoria(body.categoria) || 'GASTO LOCAL',
            limpiar(body.recibe),
            limpiar(body.entrega),
            aNumero(body.monto_salida),
            limpiar(body.fecha_salida),
            body.incluir_retaceo === false ? 0 : 1,
            limpiar(body.comentario),
          ]
        );
        return json({ success: true, idgasto: res.insertId, mensaje: 'Gasto agregado' });
      }

      case 'quitar_gasto': {
        const idgasto = Number(body.idgasto);
        const [res] = await connection.execute<ResultSetHeader>(
          'DELETE FROM gastos_sindocumento WHERE idgasto = ? AND idproceso = ?',
          [idgasto, idproceso]
        );
        if (res.affectedRows) await eliminarArchivos(connection, { entidad: 'GASTO', identidad: idgasto });
        return json({ success: true, mensaje: 'Gasto eliminado' });
      }

      case 'calcular': {
        await connection.beginTransaction();
        const calculo = await guardarCalculoDuca(connection, idproceso);
        await connection.commit();
        return json({ success: true, mensaje: `Cálculo DUCA guardado en ${calculo.lineas.length} línea(s)`, calculo });
      }

      case 'finalizar': {
        const auth = await requierePermiso(request, 'compras.registrar');
        if (auth instanceof NextResponse) return auth;
        await connection.beginTransaction();
        const calculo = await finalizarRetaceo(connection, idproceso);
        await connection.commit();
        return json({
          success: true,
          mensaje: `Retaceo aplicado: ${calculo.lineas.length} línea(s), costo destino total ${calculo.total_destino.toFixed(2)}`,
        });
      }

      case 'sincronizar': {
        await connection.beginTransaction();
        await sincronizarPendientes(connection, idproceso);
        await connection.commit();
        return json({ success: true, mensaje: 'Pedido pendiente actualizado' });
      }

      case 'pendiente': {
        const idpendiente = Number(body.idpendiente);
        const reservado = Math.max(0, aNumero(body.backorder_reservado));
        const enproceso = Math.max(0, aNumero(body.backorder_enproceso));
        const total = reservado + enproceso;
        const pagado = Math.max(0, aNumero(body.backorder_pagado));
        if (pagado > total + 0.00005) return json({ error: 'Lo pagado no puede superar el backorder total' }, 400);
        const estatus = ['ACTIVO', 'CANCELADO', 'FINALIZADO'].includes(String(body.estatus_backorder)) ? body.estatus_backorder : 'ACTIVO';
        const [res] = await connection.execute<ResultSetHeader>(
          `UPDATE pedido_pendiente SET backorder_reservado = ?, backorder_enproceso = ?, backorder_pagado = ?,
             backorder_por_pagar = ?, fecha_estimada_backorder = ?, estatus_backorder = ?
           WHERE idpendiente = ? AND idproceso = ?`,
          [reservado, enproceso, pagado, r8(total - pagado), limpiar(body.fecha_estimada_backorder), estatus, idpendiente, idproceso]
        );
        if (!res.affectedRows) return json({ error: 'Fila no encontrada' }, 404);
        return json({ success: true });
      }

      default:
        return json({ error: 'Acción no válida' }, 400);
    }
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      /* sin transacción */
    }
    console.error('Error en procesos:', error);
    return json({ error: (error as Error).message || 'Error en el proceso' }, 500);
  } finally {
    await connection.end();
  }
}

// PUT: encabezado { idproceso, ... } o vínculo { idrelacion, total_usd, incluir_retaceo, comentarios }
export async function PUT(request: NextRequest) {
  const body = (await request.json()) as Record<string, unknown>;
  const connection = await connectDB();
  try {
    if (body.idrelacion) {
      const [rels] = await connection.execute<RowDataPacket[]>(
        `SELECT r.idrelacion, p.estado_documento FROM relacion_documentos r JOIN proceso_ingreso p ON p.idproceso = r.idproceso
         WHERE r.idrelacion = ?`,
        [Number(body.idrelacion)]
      );
      if (!rels[0]) return json({ error: 'Vínculo no encontrado' }, 404);
      if (rels[0].estado_documento === 'FINALIZADO') return json({ error: 'El retaceo ya se aplicó' }, 400);
      const sets: string[] = [];
      const vals: (string | number | null)[] = [];
      if (body.total_usd !== undefined) {
        sets.push('total_usd = ?');
        vals.push(aNumero(body.total_usd));
      }
      if (body.incluir_retaceo !== undefined) {
        sets.push('incluir_retaceo = ?');
        vals.push(body.incluir_retaceo ? 1 : 0);
      }
      if (body.comentarios !== undefined) {
        sets.push('comentarios = ?');
        vals.push(limpiar(body.comentarios));
      }
      if (sets.length) await connection.execute(`UPDATE relacion_documentos SET ${sets.join(', ')} WHERE idrelacion = ?`, [...vals, Number(body.idrelacion)]);
      return json({ success: true });
    }

    const idproceso = Number(body.idproceso);
    const proceso = idproceso ? await leerProceso(connection, idproceso) : null;
    if (!proceso) return json({ error: 'Proceso no encontrado' }, 404);
    const cerrado = proceso.estado_documento === 'FINALIZADO';
    const datos: Record<string, unknown> = {};
    if (body.estado_proceso !== undefined && (ESTADOS_PROCESO as readonly string[]).includes(String(body.estado_proceso))) {
      datos.estado_proceso = body.estado_proceso;
    }
    if (body.comentarios !== undefined) datos.comentarios = limpiar(body.comentarios);
    if (!cerrado) {
      if (body.descripcion !== undefined) datos.descripcion = limpiar(body.descripcion);
      if (body.factura_compra !== undefined) datos.factura_compra = limpiar(body.factura_compra);
      if (body.origen_negociacion !== undefined) datos.origen_negociacion = body.origen_negociacion === 'NACIONAL' ? 'NACIONAL' : 'INTERNACIONAL';
      if (body.moneda_factura !== undefined) {
        const m = String(body.moneda_factura).toUpperCase();
        datos.moneda_factura = (MONEDAS as readonly string[]).includes(m) ? m : 'USD';
      }
      if (body.tipo_cambio_pagado !== undefined) datos.tipo_cambio_pagado = aNumero(body.tipo_cambio_pagado) > 0 ? aNumero(body.tipo_cambio_pagado) : 1;
      if (datos.moneda_factura === 'USD') datos.tipo_cambio_pagado = 1;
      if (body.total_retaceo !== undefined) datos.total_retaceo = Math.max(0, aNumero(body.total_retaceo));
    }
    const campos = Object.keys(datos);
    if (campos.length) {
      await connection.execute(
        `UPDATE proceso_ingreso SET ${campos.map((c) => `${c} = ?`).join(', ')} WHERE idproceso = ?`,
        [...campos.map((c) => datos[c] ?? null), idproceso]
      );
    }
    return json({ success: true, mensaje: 'Proceso guardado' });
  } catch (error) {
    console.error('Error al actualizar proceso:', error);
    return json({ error: 'Error al actualizar proceso', detalle: (error as Error).message }, 500);
  } finally {
    await connection.end();
  }
}

export async function DELETE(request: NextRequest) {
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return json({ error: 'Falta el id' }, 400);
  const connection = await connectDB();
  try {
    const proceso = await leerProceso(connection, id);
    if (!proceso) return json({ error: 'Proceso no encontrado' }, 404);
    if (proceso.estado_documento === 'FINALIZADO' || proceso.fecha_retaceo) {
      return json({ error: 'Un proceso con retaceo aplicado no se elimina' }, 400);
    }
    await connection.beginTransaction();
    const [duca] = await connection.execute<RowDataPacket[]>('SELECT nodocto FROM datos_duca WHERE idproceso = ?', [id]);
    const [gastos] = await connection.execute<RowDataPacket[]>('SELECT idgasto FROM gastos_sindocumento WHERE idproceso = ?', [id]);
    for (const g of gastos) await eliminarArchivos(connection, { entidad: 'GASTO', identidad: Number(g.idgasto) });
    await connection.execute('DELETE FROM proceso_ingreso WHERE idproceso = ?', [id]);
    await eliminarArchivos(connection, { nodocto: Number(proceso.nodocto) });
    if (duca[0]) await eliminarArchivos(connection, { nodocto: Number(duca[0].nodocto) });
    await connection.commit();
    return json({ success: true, mensaje: `Proceso ${proceso.codigo} eliminado` });
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      /* sin transacción */
    }
    console.error('Error al eliminar proceso:', error);
    return json({ error: 'Error al eliminar proceso', detalle: (error as Error).message }, 500);
  } finally {
    await connection.end();
  }
}
