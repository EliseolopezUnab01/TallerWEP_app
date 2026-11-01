import type { RowDataPacket } from 'mysql2/promise';
import type { Conexion } from '@/lib/compras-detalle-db';
import { r8 } from '@/lib/decimales';

/**
 * Stock y costos de compras nacionales.
 * - Factura (01, 03, 14): suma a stock_contable las líneas INVENTARIO con producto y actualiza `costos`.
 * - Nota de crédito (05): resta la cantidad de las líneas INVENTARIO que vienen de la factura original.
 * - Nota de débito (06) e importaciones: no tocan stock aquí (la importación entra con el retaceo).
 * - Facturas ya vinculadas a un proceso de ingreso: tampoco; su mercadería entra con el retaceo.
 * `compras.stock_aplicado` evita aplicar dos veces y permite revertir al anular.
 */

interface CompraStock {
  idcompra: number;
  nodocto: number | null;
  numero_factura: string | null;
  numero_interno: string | null;
  fecha_emision: string | Date | null;
  clase_documento: string;
  tipo_dte: string | null;
  idproceso: number | null;
  stock_aplicado: number;
}

async function leerCompra(connection: Conexion, idcompra: number): Promise<CompraStock | null> {
  const [rows] = await connection.execute<RowDataPacket[]>(
    `SELECT idcompra, nodocto, numero_factura, numero_interno, fecha_emision, clase_documento, tipo_dte, idproceso, stock_aplicado
     FROM compras WHERE idcompra = ?`,
    [idcompra]
  );
  return (rows[0] as CompraStock) ?? null;
}

export function mueveStock(compra: Pick<CompraStock, 'clase_documento' | 'tipo_dte'>): 'suma' | 'resta' | null {
  if (compra.clase_documento === 'IMPORTACION') return null;
  if (compra.tipo_dte === '05') return 'resta';
  if (compra.tipo_dte === '06') return null;
  return 'suma';
}

/** Líneas que mueven stock: inventario con producto; en la NC solo las que vienen de la factura original. */
async function lineasConStock(connection: Conexion, idcompra: number, esNota: boolean) {
  const [rows] = await connection.execute<RowDataPacket[]>(
    `SELECT idprod, cantidad, subtotal_sin_iva, iva_unitario, costo_unitario
     FROM compras_detalle
     WHERE idcompra = ? AND destino = 'INVENTARIO' AND idprod IS NOT NULL AND cantidad > 0
       ${esNota ? 'AND iddetalle_origen IS NOT NULL AND ajuste_precio = 0' : ''}`,
    [idcompra]
  );
  const porProducto = new Map<number, { cantidad: number; neto: number; iva: number; bruto: number }>();
  for (const l of rows) {
    const idprod = Number(l.idprod);
    const cant = Number(l.cantidad) || 0;
    const acc = porProducto.get(idprod) ?? { cantidad: 0, neto: 0, iva: 0, bruto: 0 };
    acc.cantidad += cant;
    acc.neto += Number(l.subtotal_sin_iva) || 0;
    acc.iva += (Number(l.iva_unitario) || 0) * cant;
    acc.bruto += (Number(l.costo_unitario) || 0) * cant;
    porProducto.set(idprod, acc);
  }
  return porProducto;
}

/** Actualiza `costos` con el costo de la factura; rota los respaldos y pondera el promedio con el stock previo. */
async function actualizarCostos(
  connection: Conexion,
  compra: CompraStock,
  idprod: number,
  acc: { cantidad: number; neto: number; iva: number; bruto: number },
  stockPrevio: number
) {
  const [rows] = await connection.execute<RowDataPacket[]>(
    'SELECT idcosto, costo, costo_promedio, costo_local, costo_local_promedio FROM costos WHERE idprod = ? ORDER BY idcosto LIMIT 1',
    [idprod]
  );
  const c = rows[0];
  const unitario = r8(acc.neto / acc.cantidad);
  const promPrevio = Number(c?.costo_local_promedio) || Number(c?.costo_promedio) || Number(c?.costo_local) || Number(c?.costo) || 0;
  const promedio = r8(
    stockPrevio > 0 && promPrevio > 0 ? (stockPrevio * promPrevio + acc.neto) / (stockPrevio + acc.cantidad) : unitario
  );
  const proveedor = r8(acc.bruto / acc.cantidad);
  const ivaUnit = r8(acc.iva / acc.cantidad);
  const factura = String(compra.numero_factura || compra.numero_interno || '').slice(0, 50) || null;
  const fecha = compra.fecha_emision ?? null;

  if (c) {
    await connection.execute(
      `UPDATE costos SET
         costo_previo2 = costo_previo1, costo_previo1 = costo,
         costop_previo2 = costop_previo1, costop_previo1 = costo_promedio,
         costolcl_previo2 = costolcl_previo1, costolcl_previo1 = costo_local,
         costo = ?, costo_promedio = ?, costo_local = ?, costo_local_promedio = ?,
         costo_proveedor = ?, iva_pagado = ?, nofactura = ?, nodocto = ?, dt_compra = ?
       WHERE idcosto = ?`,
      [unitario, promedio, unitario, promedio, proveedor, ivaUnit, factura, compra.nodocto, fecha, c.idcosto]
    );
  } else {
    await connection.execute(
      `INSERT INTO costos (idprod, nofactura, nodocto, dt_compra, costo, costo_promedio, costo_local, costo_local_promedio,
                           costo_proveedor, iva_pagado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [idprod, factura, compra.nodocto, fecha, unitario, promedio, unitario, promedio, proveedor, ivaUnit]
    );
  }
}

/** Aplica el efecto del documento al registrarlo. Devuelve cuántos productos movió. */
export async function aplicarStockAlRegistrar(connection: Conexion, idcompra: number): Promise<number> {
  const compra = await leerCompra(connection, idcompra);
  if (!compra || Number(compra.stock_aplicado)) return 0;
  const efecto = mueveStock(compra);
  if (!efecto || (efecto === 'suma' && compra.idproceso)) return 0;

  const lineas = await lineasConStock(connection, idcompra, efecto === 'resta');
  for (const [idprod, acc] of lineas) {
    if (efecto === 'suma') {
      const [prod] = await connection.execute<RowDataPacket[]>('SELECT stock_contable FROM productos WHERE idprod = ?', [idprod]);
      const stockPrevio = Math.max(Number(prod[0]?.stock_contable) || 0, 0);
      await connection.execute('UPDATE productos SET stock_contable = stock_contable + ? WHERE idprod = ?', [acc.cantidad, idprod]);
      await actualizarCostos(connection, compra, idprod, acc, stockPrevio);
    } else {
      await connection.execute('UPDATE productos SET stock_contable = stock_contable - ? WHERE idprod = ?', [acc.cantidad, idprod]);
    }
  }
  await connection.execute('UPDATE compras SET stock_aplicado = 1 WHERE idcompra = ?', [idcompra]);
  return lineas.size;
}

/** Al anular: devuelve el stock que movió el documento. Los costos guardados no se recalculan. */
export async function revertirStockAlAnular(connection: Conexion, idcompra: number): Promise<number> {
  const compra = await leerCompra(connection, idcompra);
  if (!compra || !Number(compra.stock_aplicado)) return 0;
  const efecto = mueveStock(compra);
  if (!efecto) return 0;
  const lineas = await lineasConStock(connection, idcompra, efecto === 'resta');
  for (const [idprod, acc] of lineas) {
    const signo = efecto === 'suma' ? '-' : '+';
    await connection.execute(`UPDATE productos SET stock_contable = stock_contable ${signo} ? WHERE idprod = ?`, [acc.cantidad, idprod]);
  }
  await connection.execute('UPDATE compras SET stock_aplicado = 0 WHERE idcompra = ?', [idcompra]);
  return lineas.size;
}
