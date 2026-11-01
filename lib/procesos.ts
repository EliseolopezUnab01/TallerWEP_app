import type { RowDataPacket } from 'mysql2/promise';
import type { Conexion } from '@/lib/compras-detalle-db';
import type { ResultSetHeader } from 'mysql2/promise';
import { BASE_HACIENDA, RAZONES_NO_GASTO } from '@/lib/procesos-constantes';
import { MONEDAS } from '@/lib/documentos-compras-constantes';
import { nuevoNodocto, siguienteCorrelativo } from '@/lib/correlativos';
import { r8 } from '@/lib/decimales';

export async function crearProceso(
  connection: Conexion,
  datos: { descripcion?: string | null; origen_negociacion?: unknown; moneda_factura?: unknown; tipo_cambio_pagado?: unknown }
) {
  const nodocto = await nuevoNodocto(connection);
  const { codigo } = await siguienteCorrelativo(connection, 'IMP');
  const moneda = String(datos.moneda_factura || 'USD').toUpperCase();
  const tc = Number(datos.tipo_cambio_pagado);
  const [res] = await connection.execute<ResultSetHeader>(
    `INSERT INTO proceso_ingreso (codigo, nodocto, descripcion, origen_negociacion, moneda_factura, tipo_cambio_pagado)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      codigo,
      nodocto,
      datos.descripcion?.trim() || null,
      datos.origen_negociacion === 'NACIONAL' ? 'NACIONAL' : 'INTERNACIONAL',
      (MONEDAS as readonly string[]).includes(moneda) ? moneda : 'USD',
      tc > 0 ? tc : 1,
    ]
  );
  return { idproceso: res.insertId, codigo, nodocto };
}

export * from '@/lib/procesos-constantes';

export interface DocumentoSistema {
  tipo: 'COMPRA' | 'DOCUMENTO';
  id: number;
  nodocto: number;
  numero: string;
  fiscal: number;
  idproceso: number | null;
}

/** Busca un nodocto en compras o en documentos de compra. El monto de una compra es solo lo fiscal sin IVA. */
export async function buscarDocumento(connection: Conexion, nodocto: number): Promise<DocumentoSistema | null> {
  const [compras] = await connection.execute<RowDataPacket[]>(
    `SELECT idcompra, nodocto, COALESCE(numero_factura, numero_interno, CONCAT('Compra ', idcompra)) AS numero,
            sub_total, idproceso, estado
     FROM compras WHERE nodocto = ?`,
    [nodocto]
  );
  if (compras[0]) {
    const c = compras[0];
    return { tipo: 'COMPRA', id: Number(c.idcompra), nodocto, numero: String(c.numero), fiscal: Number(c.sub_total) || 0, idproceso: c.idproceso };
  }
  const [docs] = await connection.execute<RowDataPacket[]>(
    'SELECT iddocumento, nodocto, id_documento, total_usd, idproceso FROM documentos_compras WHERE nodocto = ?',
    [nodocto]
  );
  if (docs[0]) {
    const d = docs[0];
    return { tipo: 'DOCUMENTO', id: Number(d.iddocumento), nodocto, numero: String(d.id_documento), fiscal: Number(d.total_usd) || 0, idproceso: d.idproceso };
  }
  return null;
}

/** Asigna el proceso a un documento de compra y a toda su cadena (origen y derivados). */
export async function asignarCadena(connection: Conexion, nodocto: number, idproceso: number | null) {
  const visitados = new Set<number>();
  const pendientes = [nodocto];
  while (pendientes.length) {
    const actual = pendientes.pop()!;
    if (visitados.has(actual)) continue;
    visitados.add(actual);
    const [rel] = await connection.execute<RowDataPacket[]>(
      `SELECT nodocto_origen AS n FROM documentos_compras WHERE nodocto = ? AND nodocto_origen IS NOT NULL
       UNION SELECT nodocto FROM documentos_compras WHERE nodocto_origen = ?`,
      [actual, actual]
    );
    for (const r of rel) if (r.n) pendientes.push(Number(r.n));
  }
  const ids = [...visitados];
  await connection.execute(
    `UPDATE documentos_compras SET idproceso = ? WHERE nodocto IN (${ids.map(() => '?').join(',')})`,
    [idproceso, ...ids]
  );
  return ids.length;
}

/** Recalcula total de facturas, suma de documentos (fiscal) y el retaceo sugerido. */
export async function recalcularProceso(connection: Conexion, idproceso: number) {
  const [fact] = await connection.execute<RowDataPacket[]>(
    "SELECT COALESCE(SUM(sub_total), 0) AS total FROM compras WHERE idproceso = ? AND estado NOT IN ('ANULADA', 'INVALIDADO')",
    [idproceso]
  );
  const [docs] = await connection.execute<RowDataPacket[]>(
    `SELECT COALESCE(SUM(IF(razon_vinculo NOT IN (${RAZONES_NO_GASTO.map(() => '?').join(',')}), total_usd, 0)), 0) AS sumas,
            COALESCE(SUM(IF(incluir_retaceo = 1, total_usd, 0)), 0) AS incluidos
     FROM relacion_documentos WHERE idproceso = ?`,
    [...RAZONES_NO_GASTO, idproceso]
  );
  const [gastos] = await connection.execute<RowDataPacket[]>(
    'SELECT COALESCE(SUM(IF(incluir_retaceo = 1, monto_salida, 0)), 0) AS incluidos FROM gastos_sindocumento WHERE idproceso = ?',
    [idproceso]
  );
  const [duca] = await connection.execute<RowDataPacket[]>(
    'SELECT COALESCE(otros_cargos_pagados, 0) AS otros FROM datos_duca WHERE idproceso = ?',
    [idproceso]
  );
  await connection.execute('UPDATE proceso_ingreso SET total_factura = ?, sumas_documentos = ? WHERE idproceso = ?', [
    Number(fact[0].total),
    Number(docs[0].sumas),
    idproceso,
  ]);
  const documentos = Number(docs[0].incluidos);
  const sinDocumento = Number(gastos[0].incluidos);
  const otrosDuca = Number(duca[0]?.otros || 0);
  return {
    total_factura: Number(fact[0].total),
    sumas_documentos: Number(docs[0].sumas),
    sugerido: {
      documentos,
      sin_documento: sinDocumento,
      otros_cargos_duca: otrosDuca,
      total: r8(documentos + sinDocumento + otrosDuca),
    },
  };
}

export interface CategoriaInversion {
  categoria: string;
  documentos: number;
  sin_documento: number;
  real: number;
}

export interface ConceptoInversion {
  concepto: string;
  real: number;
  hacienda: number | null;
  categorias: string[];
}

/**
 * Inversión del proceso con dos columnas: lo pagado de verdad (documentos y gastos por categoría)
 * y la base de Hacienda del DUCA. El retaceo de costo usa lo real; los impuestos, la base de Hacienda.
 */
export async function inversionDelProceso(connection: Conexion, idproceso: number) {
  const [proc] = await connection.execute<RowDataPacket[]>(
    `SELECT p.total_factura, p.tipo_cambio_pagado, d.total_productos_duca, d.seguro_declarado, d.flete_declarado,
            d.gastos_declarados
     FROM proceso_ingreso p LEFT JOIN datos_duca d ON d.idproceso = p.idproceso WHERE p.idproceso = ?`,
    [idproceso]
  );
  const p = proc[0] ?? {};
  const [docs] = await connection.execute<RowDataPacket[]>(
    `SELECT razon_vinculo AS categoria, SUM(total_usd) AS total FROM relacion_documentos
     WHERE idproceso = ? AND razon_vinculo NOT IN (${RAZONES_NO_GASTO.map(() => '?').join(',')})
     GROUP BY razon_vinculo`,
    [idproceso, ...RAZONES_NO_GASTO]
  );
  const [gastos] = await connection.execute<RowDataPacket[]>(
    'SELECT categoria, SUM(monto_salida) AS total FROM gastos_sindocumento WHERE idproceso = ? GROUP BY categoria',
    [idproceso]
  );

  const porCategoria = new Map<string, CategoriaInversion>();
  const fila = (categoria: string) => {
    if (!porCategoria.has(categoria)) porCategoria.set(categoria, { categoria, documentos: 0, sin_documento: 0, real: 0 });
    return porCategoria.get(categoria)!;
  };
  for (const d of docs) fila(String(d.categoria)).documentos += Number(d.total) || 0;
  for (const g of gastos) fila(String(g.categoria || 'GASTO LOCAL')).sin_documento += Number(g.total) || 0;
  const categorias = [...porCategoria.values()].map((c) => ({ ...c, real: r8(c.documentos + c.sin_documento) }));

  const suma = (lista: CategoriaInversion[]) => r8(lista.reduce((s, c) => s + c.real, 0));
  const grupo = (campo: 'seguro_declarado' | 'flete_declarado' | null) =>
    categorias.filter((c) => (BASE_HACIENDA[c.categoria] ?? null) === campo);
  const seguro = grupo('seguro_declarado');
  const flete = grupo('flete_declarado');
  const otros = grupo(null);
  const conceptos: ConceptoInversion[] = [
    {
      concepto: 'Mercadería (FOB)',
      real: r8((Number(p.total_factura) || 0) * (Number(p.tipo_cambio_pagado) || 1)),
      hacienda: p.total_productos_duca == null ? null : Number(p.total_productos_duca),
      categorias: ['FACTURA'],
    },
    { concepto: 'Seguro', real: suma(seguro), hacienda: p.seguro_declarado == null ? null : Number(p.seguro_declarado), categorias: seguro.map((c) => c.categoria) },
    { concepto: 'Flete', real: suma(flete), hacienda: p.flete_declarado == null ? null : Number(p.flete_declarado), categorias: flete.map((c) => c.categoria) },
    { concepto: 'Otros gastos', real: suma(otros), hacienda: p.gastos_declarados == null ? null : Number(p.gastos_declarados), categorias: otros.map((c) => c.categoria) },
  ];
  return { conceptos, categorias };
}

/**
 * Reconstruye las cantidades de `pedido_pendiente` a partir de los documentos del proceso.
 * Los campos de backorder los captura el usuario y se conservan.
 */
export async function sincronizarPendientes(connection: Conexion, idproceso: number) {
  const [docs] = await connection.execute<RowDataPacket[]>(
    `SELECT d.tipo_documento, d.id_documento, d.fecha_documento, l.idprod, l.idtemporal, l.cantidad
     FROM documentos_compras d JOIN documentos_compras_detalle l ON l.iddocumento = d.iddocumento
     WHERE d.idproceso = ? AND d.estado_documento <> 'ANULADO'
     ORDER BY d.iddocumento`,
    [idproceso]
  );
  const [compras] = await connection.execute<RowDataPacket[]>(
    `SELECT c.estado, COALESCE(c.numero_factura, c.numero_interno) AS factura, c.fecha_emision, d.idprod, d.cantidad,
            COALESCE(cp.stock_aplicado, 0) AS en_bodega
     FROM compras c JOIN compras_detalle d ON d.idcompra = c.idcompra
     LEFT JOIN costos_productos cp ON cp.iddetalle = d.iddetalle
     WHERE c.idproceso = ? AND c.estado NOT IN ('ANULADA', 'INVALIDADO') AND d.idprod IS NOT NULL
     ORDER BY c.idcompra`,
    [idproceso]
  );

  type Fila = {
    idprod: number | null;
    idtemporal: number | null;
    cotizado: number;
    ordenado: number;
    proforma: number;
    factura: number;
    recibido: number;
    oc?: [string, string | null];
    pf?: [string, string | null];
    fc?: [string, string | null];
  };
  const filas = new Map<string, Fila>();
  const fila = (idprod: number | null, idtemporal: number | null) => {
    const clave = idprod ? `P${idprod}` : `T${idtemporal}`;
    if (!filas.has(clave)) filas.set(clave, { idprod, idtemporal: idprod ? null : idtemporal, cotizado: 0, ordenado: 0, proforma: 0, factura: 0, recibido: 0 });
    return filas.get(clave)!;
  };

  for (const d of docs) {
    const f = fila(d.idprod ? Number(d.idprod) : null, d.idtemporal ? Number(d.idtemporal) : null);
    const cant = Number(d.cantidad) || 0;
    if (d.tipo_documento === 'COTIZACION') f.cotizado += cant;
    if (d.tipo_documento === 'ORDEN') {
      f.ordenado += cant;
      f.oc = [d.id_documento, d.fecha_documento];
    }
    if (d.tipo_documento === 'PROFORMA') {
      f.proforma += cant;
      f.pf = [d.id_documento, d.fecha_documento];
    }
  }
  for (const c of compras) {
    const f = fila(Number(c.idprod), null);
    const cant = Number(c.cantidad) || 0;
    f.factura += cant;
    // Recibido = ya en bodega: la línea entró al stock con el retaceo aplicado.
    if (Number(c.en_bodega)) f.recibido += cant;
    f.fc = [String(c.factura ?? ''), c.fecha_emision];
  }

  const vigentes: number[] = [];
  for (const f of filas.values()) {
    await connection.execute(
      `INSERT INTO pedido_pendiente
         (idproceso, idprod, idtemporal, cant_cotizado, cant_ordenado, cant_proforma, cant_factura, cant_recibido,
          id_orden_compra, fecha_orden_compra, id_proforma, fecha_proforma, id_factura, fecha_factura)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         cant_cotizado = VALUES(cant_cotizado), cant_ordenado = VALUES(cant_ordenado), cant_proforma = VALUES(cant_proforma),
         cant_factura = VALUES(cant_factura), cant_recibido = VALUES(cant_recibido),
         id_orden_compra = VALUES(id_orden_compra), fecha_orden_compra = VALUES(fecha_orden_compra),
         id_proforma = VALUES(id_proforma), fecha_proforma = VALUES(fecha_proforma),
         id_factura = VALUES(id_factura), fecha_factura = VALUES(fecha_factura)`,
      [
        idproceso,
        f.idprod,
        f.idtemporal,
        f.cotizado,
        f.ordenado,
        f.proforma,
        f.factura,
        f.recibido,
        f.oc?.[0] ?? null,
        f.oc?.[1] ?? null,
        f.pf?.[0] ?? null,
        f.pf?.[1] ?? null,
        f.fc?.[0]?.slice(0, 100) || null,
        f.fc?.[1] ?? null,
      ]
    );
    const [id] = await connection.execute<RowDataPacket[]>(
      'SELECT idpendiente FROM pedido_pendiente WHERE idproceso = ? AND (idprod <=> ?) AND (idtemporal <=> ?)',
      [idproceso, f.idprod, f.idtemporal]
    );
    if (id[0]) vigentes.push(Number(id[0].idpendiente));
  }
  // Productos que ya no están en ningún documento: se borran si no tienen backorder capturado.
  await connection.execute(
    `DELETE FROM pedido_pendiente
     WHERE idproceso = ? AND backorder_total = 0 AND backorder_pagado = 0 AND backorder_por_pagar = 0
       ${vigentes.length ? `AND idpendiente NOT IN (${vigentes.map(() => '?').join(',')})` : ''}`,
    [idproceso, ...vigentes]
  );
  await connection.execute(
    `UPDATE pedido_pendiente SET cant_cotizado = 0, cant_ordenado = 0, cant_proforma = 0, cant_factura = 0, cant_recibido = 0
     WHERE idproceso = ? ${vigentes.length ? `AND idpendiente NOT IN (${vigentes.map(() => '?').join(',')})` : ''}`,
    [idproceso, ...vigentes]
  );
}
