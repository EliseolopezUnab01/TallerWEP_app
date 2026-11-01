import type { RowDataPacket } from 'mysql2/promise';
import type { Conexion } from '@/lib/compras-detalle-db';
import { r8 } from '@/lib/decimales';

/**
 * Única rutina que escribe el costo vigente de un producto en `costos`.
 *
 * Escalera de respaldos (respuesta 2 del cliente, 01/11):
 *   costo_previo2    ← costo_previo1,    costo_previo1    ← costo
 *   costolcl_previo2 ← costolcl_previo1, costolcl_previo1 ← costo_local
 *   costop_previo2   ← costop_previo1,   costop_previo1   ← costo_promedio
 *
 * - Factura nacional: `costoFactura` y `costoLocal` son el mismo costo unitario.
 * - Retaceo: `costoFactura` es el costo de la factura en su divisa y `costoLocal` el costo retaceado.
 * - Reaplicar un retaceo ya aplicado (tras reabrirlo) pasa `rotar: false`: se corrigen los valores sin
 *   empujar otra vez la escalera.
 */
export interface EntradaCosto {
  idprod: number;
  costoFactura: number;
  costoLocal: number;
  /** Promedio ponderado ya calculado, en moneda local. */
  promedio: number;
  costoProveedor?: number | null;
  ivaUnitario?: number | null;
  nofactura?: string | null;
  nodocto?: number | null;
  dtCompra?: string | Date | null;
  rotar?: boolean;
}

export async function registrarCosto(connection: Conexion, e: EntradaCosto): Promise<void> {
  const [rows] = await connection.execute<RowDataPacket[]>(
    'SELECT idcosto FROM costos WHERE idprod = ? ORDER BY idcosto LIMIT 1',
    [e.idprod]
  );
  const costo = r8(e.costoFactura);
  const local = r8(e.costoLocal);
  const promedio = r8(e.promedio);
  const proveedor = r8(e.costoProveedor ?? e.costoFactura);
  const iva = r8(e.ivaUnitario ?? 0);
  const factura = e.nofactura ? String(e.nofactura).slice(0, 50) : null;

  if (rows[0]) {
    const escalera = e.rotar === false
      ? ''
      : `costo_previo2 = costo_previo1, costo_previo1 = costo,
         costolcl_previo2 = costolcl_previo1, costolcl_previo1 = costo_local,
         costop_previo2 = costop_previo1, costop_previo1 = costo_promedio,`;
    await connection.execute(
      `UPDATE costos SET ${escalera}
         costo = ?, costo_local = ?, costo_promedio = ?, costo_local_promedio = ?,
         costo_proveedor = ?, iva_pagado = ?, nofactura = ?, nodocto = ?, dt_compra = ?
       WHERE idcosto = ?`,
      [costo, local, promedio, promedio, proveedor, iva, factura, e.nodocto ?? null, e.dtCompra ?? null, rows[0].idcosto]
    );
  } else {
    await connection.execute(
      `INSERT INTO costos (idprod, nofactura, nodocto, dt_compra, costo, costo_local, costo_promedio, costo_local_promedio,
                           costo_proveedor, iva_pagado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [e.idprod, factura, e.nodocto ?? null, e.dtCompra ?? null, costo, local, promedio, promedio, proveedor, iva]
    );
  }
  // productos.costo es una copia de lectura rápida del costo local vigente.
  await connection.execute('UPDATE productos SET costo = ? WHERE idprod = ?', [local, e.idprod]);
}

/** Promedio ponderado con el stock que había antes de la entrada. Sin stock previo, el costo de la entrada. */
export function promedioPonderado(stockPrevio: number, promedioPrevio: number, cantidad: number, totalEntrada: number) {
  if (cantidad <= 0) return r8(promedioPrevio);
  return r8(
    stockPrevio > 0 && promedioPrevio > 0
      ? (stockPrevio * promedioPrevio + totalEntrada) / (stockPrevio + cantidad)
      : totalEntrada / cantidad
  );
}

/** Promedio local vigente del producto, con los respaldos de lectura que usaban las rutas viejas. */
export async function promedioActual(connection: Conexion, idprod: number): Promise<number> {
  const [rows] = await connection.execute<RowDataPacket[]>(
    'SELECT costo, costo_local, costo_promedio, costo_local_promedio FROM costos WHERE idprod = ? ORDER BY idcosto LIMIT 1',
    [idprod]
  );
  const c = rows[0];
  return Number(c?.costo_local_promedio) || Number(c?.costo_promedio) || Number(c?.costo_local) || Number(c?.costo) || 0;
}
