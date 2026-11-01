import type { RowDataPacket } from 'mysql2/promise';
import type { Conexion } from '@/lib/compras-detalle-db';
import { r8 } from '@/lib/decimales';
import { promedioActual, promedioPonderado, registrarCosto } from '@/lib/costos';

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
  descuento_afecta_costo: number;
}

async function leerCompra(connection: Conexion, idcompra: number): Promise<CompraStock | null> {
  const [rows] = await connection.execute<RowDataPacket[]>(
    `SELECT idcompra, nodocto, numero_factura, numero_interno, fecha_emision, clase_documento, tipo_dte, idproceso,
            stock_aplicado, descuento_afecta_costo
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

/**
 * Costo de la factura nacional: `costo` y `costo_local` reciben el mismo unitario.
 * Con el descuento informativo el unitario es el de antes del descuento; si el descuento baja el costo, el neto.
 */
async function actualizarCostos(
  connection: Conexion,
  compra: CompraStock,
  idprod: number,
  acc: { cantidad: number; neto: number; iva: number; bruto: number },
  stockPrevio: number
) {
  const total = Number(compra.descuento_afecta_costo) ? acc.neto : acc.bruto;
  const unitario = r8(total / acc.cantidad);
  const promedio = promedioPonderado(stockPrevio, await promedioActual(connection, idprod), acc.cantidad, total);
  await registrarCosto(connection, {
    idprod,
    costoFactura: unitario,
    costoLocal: unitario,
    promedio,
    costoProveedor: acc.bruto / acc.cantidad,
    ivaUnitario: acc.iva / acc.cantidad,
    nofactura: compra.numero_factura || compra.numero_interno || null,
    nodocto: compra.nodocto,
    dtCompra: compra.fecha_emision ?? null,
  });
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
