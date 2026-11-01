import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type { connectDB } from '@/lib/db';
import { calcularLinea, CONDICIONES_IVA, DESTINOS, type CondicionIva, type Destino } from '@/lib/compras-detalle';
import { calcularResumen, type LineaResumen } from '@/lib/compras-resumen';
import { CATEGORIAS_OPERACION, NOMBRE_DESTINO, destinoPermitido } from '@/lib/compras-constantes';
import { siguienteCorrelativo } from '@/lib/correlativos';

export type Conexion = Awaited<ReturnType<typeof connectDB>>;

export const CAMPOS_LINEA = [
  'idcompra',
  'numero_linea',
  'numero_orden',
  'destino',
  'idcatalogo',
  'idprod',
  'referencia_proveedor',
  'descripcion',
  'cantidad',
  'costo_unitario',
  'descuento_porcentaje',
  'subtotal_sin_iva',
  'iva_unitario',
  'subtotal_con_iva',
  'exento_unitario',
  'no_sujeto_unitario',
  'condicion_iva',
  'numero_documento_rel',
  'codigo_tributo',
  'cargos_no_afectos',
  'imagen_url',
  'codigo_express',
  'iddetalle_origen',
  'ajuste_precio',
] as const;

export function limpiar(valor: unknown) {
  if (valor === undefined || valor === null) return null;
  const texto = String(valor).trim();
  return texto === '' ? null : texto;
}

export function aNumero(valor: unknown, defecto = 0): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : defecto;
}

/**
 * `destino` null = línea importada sin ficha que el usuario aún debe clasificar.
 * Solo el inventario lleva producto; la orden de trabajo es de express (obligatoria) y gastos (opcional).
 */
export function normalizarLinea(body: Record<string, unknown>, calcular = true) {
  const destino: string | null =
    body.destino === null || body.destino === ''
      ? null
      : DESTINOS.includes(String(body.destino) as Destino)
        ? String(body.destino)
        : 'INVENTARIO';

  const condicion_iva = CONDICIONES_IVA.includes(String(body.condicion_iva) as CondicionIva)
    ? (String(body.condicion_iva) as CondicionIva)
    : 'GRAVADA';

  const cantidad = aNumero(body.cantidad, 1);
  const costo_unitario = aNumero(body.costo_unitario, 0);
  const descuento_porcentaje = aNumero(body.descuento_porcentaje, 0);

  const calculados = calcular
    ? calcularLinea({ cantidad, costo_unitario, descuento_porcentaje, condicion_iva })
    : {
        subtotal_sin_iva: aNumero(body.subtotal_sin_iva),
        iva_unitario: aNumero(body.iva_unitario),
        exento_unitario: aNumero(body.exento_unitario),
        no_sujeto_unitario: aNumero(body.no_sujeto_unitario),
        subtotal_con_iva: aNumero(body.subtotal_con_iva),
      };

  return {
    idcompra: Number(body.idcompra),
    numero_linea: body.numero_linea ? Number(body.numero_linea) : null,
    numero_orden: destino === 'EXPRESS' || destino === 'GASTOS' ? limpiar(body.numero_orden) : null,
    destino,
    idcatalogo: destino === 'GASTOS' || destino === 'ACTIVOS' ? (body.idcatalogo ? Number(body.idcatalogo) : null) : null,
    idprod: destino === 'INVENTARIO' && body.idprod ? Number(body.idprod) : null,
    referencia_proveedor: limpiar(body.referencia_proveedor),
    descripcion: String(body.descripcion || '').trim(),
    cantidad,
    costo_unitario,
    descuento_porcentaje,
    ...calculados,
    condicion_iva,
    numero_documento_rel: limpiar(body.numero_documento_rel),
    codigo_tributo: limpiar(body.codigo_tributo) || (condicion_iva === 'GRAVADA' ? '20' : null),
    cargos_no_afectos: aNumero(body.cargos_no_afectos, 0),
    imagen_url: limpiar(body.imagen_url),
    codigo_express: destino === 'EXPRESS' ? limpiar(body.codigo_express) : null,
    iddetalle_origen: body.iddetalle_origen ? Number(body.iddetalle_origen) : null,
    ajuste_precio: body.iddetalle_origen && Number(body.ajuste_precio) ? 1 : 0,
  };
}

export type LineaNormalizada = ReturnType<typeof normalizarLinea>;

export interface CompraReglas {
  categoria_operacion: string | null;
  clase_documento: string | null;
  tipo_dte?: string | null;
}

/** Reglas del destino según el control 2 y la clase del documento. Null = válida. */
export function errorDestinoLinea(
  compra: CompraReglas,
  linea: { destino: string | null; idprod: number | null }
): string | null {
  if (linea.destino === null) return null;
  if (compra.clase_documento === 'IMPORTACION' && linea.destino === 'EXPRESS') {
    return 'Una importación no admite productos express';
  }
  if (!destinoPermitido(compra.categoria_operacion, linea.destino)) {
    const cat = CATEGORIAS_OPERACION.find((c) => c.valor === compra.categoria_operacion)?.etiqueta || compra.categoria_operacion;
    return `Un documento ${cat} no admite líneas de ${NOMBRE_DESTINO[linea.destino] || linea.destino}`;
  }
  if (linea.destino === 'INVENTARIO' && !linea.idprod) {
    return 'Los productos de inventario se eligen desde el buscador';
  }
  return null;
}

/** Asigna el código EX a una línea express que aún no lo tiene. */
export async function asignarCodigoExpress(connection: Conexion, linea: LineaNormalizada) {
  if (linea.destino === 'EXPRESS' && !linea.codigo_express) {
    linea.codigo_express = (await siguienteCorrelativo(connection, 'EX')).codigo;
  }
  return linea;
}

export async function siguienteNumeroLinea(connection: Conexion, idcompra: number) {
  const [rows] = await connection.execute<RowDataPacket[]>(
    'SELECT COALESCE(MAX(numero_linea), 0) + 1 AS siguiente FROM compras_detalle WHERE idcompra = ?',
    [idcompra]
  );
  return Number(rows[0].siguiente);
}

export async function insertarLinea(connection: Conexion, linea: LineaNormalizada) {
  const valores = CAMPOS_LINEA.map((c) => linea[c] ?? null);
  const [resultado] = await connection.execute<ResultSetHeader>(
    `INSERT INTO compras_detalle (${CAMPOS_LINEA.join(', ')})
     VALUES (${CAMPOS_LINEA.map(() => '?').join(', ')})`,
    valores
  );
  return resultado.insertId;
}

export async function persistirTotales(connection: Conexion, idcompra: number) {
  const [lineas] = await connection.execute<RowDataPacket[]>(
    `SELECT condicion_iva, subtotal_sin_iva, iva_unitario, cantidad, costo_unitario,
            descuento_porcentaje, cargos_no_afectos
     FROM compras_detalle WHERE idcompra = ?`,
    [idcompra]
  );
  const [encabezado] = await connection.execute<RowDataPacket[]>(
    `SELECT descuento_global_gravado, descuento_global_exento, descuento_global_no_sujeto,
            porcentaje_descuento, iva_retenido, iva_percibido, retencion_renta
     FROM compras WHERE idcompra = ?`,
    [idcompra]
  );
  const base = encabezado[0] || {};
  const resumen = calcularResumen({
    lineas: lineas as unknown as LineaResumen[],
    descuento_global_gravado: Number(base.descuento_global_gravado) || 0,
    descuento_global_exento: Number(base.descuento_global_exento) || 0,
    descuento_global_no_sujeto: Number(base.descuento_global_no_sujeto) || 0,
    porcentaje_descuento: Number(base.porcentaje_descuento) || 0,
    iva_retenido: Number(base.iva_retenido) || 0,
    iva_percibido: Number(base.iva_percibido) || 0,
    retencion_renta: Number(base.retencion_renta) || 0,
  });

  await connection.execute(
    `UPDATE compras SET
       total_gravado = ?, total_exento = ?, total_no_sujeto = ?, total_xcomprobar = ?,
       suma_operaciones = ?, total_descuento = ?, sub_total = ?, iva = ?,
       monto_total_operacion = ?, total_cargos_no_afectos = ?, total_pagar = ?,
       valor_en_letras = ?, updated_at = CURRENT_TIMESTAMP
     WHERE idcompra = ?`,
    [
      resumen.total_gravado,
      resumen.total_exento,
      resumen.total_no_sujeto,
      resumen.total_xcomprobar,
      resumen.suma_operaciones,
      resumen.total_descuento,
      resumen.sub_total,
      resumen.iva,
      resumen.monto_total_operacion,
      resumen.total_cargos_no_afectos,
      resumen.total_pagar,
      resumen.valor_en_letras,
      idcompra,
    ]
  );
  return resumen;
}
