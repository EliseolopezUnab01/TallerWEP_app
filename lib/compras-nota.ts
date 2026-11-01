import type { RowDataPacket } from 'mysql2/promise';
import type { Conexion } from '@/lib/compras-detalle-db';
import { r8 } from '@/lib/decimales';

/**
 * Nota de crédito sobre una factura registrada (cliente, 28/10):
 * - Cada línea de la NC apunta a su línea original (`iddetalle_origen`) y conserva su destino.
 * - Una devolución no puede pasar de lo comprado menos lo ya devuelto en otras NC registradas.
 * - `ajuste_precio = 1` es una rebaja de precio: no devuelve producto ni cuenta contra el tope.
 */

export interface LineaOrigen {
  iddetalle: number;
  numero_linea: number;
  destino: string | null;
  idprod: number | null;
  idcatalogo: number | null;
  descripcion: string;
  referencia_proveedor: string | null;
  numero_orden: string | null;
  codigo_express: string | null;
  condicion_iva: string;
  costo_unitario: number;
  descuento_porcentaje: number;
  comprado: number;
  devuelto: number;
  en_esta_nota: number;
  disponible: number;
}

export async function lineasOrigen(connection: Conexion, idnota: number, idorigen: number): Promise<LineaOrigen[]> {
  const [rows] = await connection.execute<RowDataPacket[]>(
    `SELECT d.iddetalle, d.numero_linea, d.destino, d.idprod, d.idcatalogo, d.descripcion, d.referencia_proveedor,
            d.numero_orden, d.codigo_express, d.condicion_iva, d.costo_unitario, d.descuento_porcentaje,
            d.cantidad AS comprado,
            COALESCE((SELECT SUM(n.cantidad) FROM compras_detalle n JOIN compras c ON c.idcompra = n.idcompra
                      WHERE n.iddetalle_origen = d.iddetalle AND n.ajuste_precio = 0
                        AND c.estado = 'REGISTRADA' AND c.idcompra <> ?), 0) AS devuelto,
            COALESCE((SELECT SUM(n.cantidad) FROM compras_detalle n
                      WHERE n.iddetalle_origen = d.iddetalle AND n.ajuste_precio = 0 AND n.idcompra = ?), 0) AS en_esta_nota
     FROM compras_detalle d WHERE d.idcompra = ? ORDER BY d.numero_linea`,
    [idnota, idnota, idorigen]
  );
  return rows.map((r) => {
    const comprado = Number(r.comprado) || 0;
    const devuelto = Number(r.devuelto) || 0;
    return {
      iddetalle: Number(r.iddetalle),
      numero_linea: Number(r.numero_linea),
      destino: r.destino,
      idprod: r.idprod ? Number(r.idprod) : null,
      idcatalogo: r.idcatalogo ? Number(r.idcatalogo) : null,
      descripcion: r.descripcion,
      referencia_proveedor: r.referencia_proveedor,
      numero_orden: r.numero_orden,
      codigo_express: r.codigo_express,
      condicion_iva: r.condicion_iva,
      costo_unitario: Number(r.costo_unitario) || 0,
      descuento_porcentaje: Number(r.descuento_porcentaje) || 0,
      comprado,
      devuelto,
      en_esta_nota: Number(r.en_esta_nota) || 0,
      disponible: r8(Math.max(comprado - devuelto, 0)),
    };
  });
}

/** Cantidad máxima que una línea de la NC puede devolver, sin contar la propia línea. */
export async function topeDevolucion(
  connection: Conexion,
  idnota: number,
  iddetalleOrigen: number,
  excluirIddetalle = 0
): Promise<{ comprado: number; maximo: number } | null> {
  const [rows] = await connection.execute<RowDataPacket[]>(
    `SELECT d.cantidad AS comprado,
            COALESCE((SELECT SUM(n.cantidad) FROM compras_detalle n JOIN compras c ON c.idcompra = n.idcompra
                      WHERE n.iddetalle_origen = d.iddetalle AND n.ajuste_precio = 0 AND n.iddetalle <> ?
                        AND (c.estado = 'REGISTRADA' OR c.idcompra = ?)), 0) AS usado
     FROM compras_detalle d WHERE d.iddetalle = ?`,
    [excluirIddetalle, idnota, iddetalleOrigen]
  );
  if (!rows[0]) return null;
  const comprado = Number(rows[0].comprado) || 0;
  return { comprado, maximo: r8(Math.max(comprado - (Number(rows[0].usado) || 0), 0)) };
}

/** Errores de tope al registrar la NC (devoluciones que pasan lo disponible). */
export async function erroresTopeNota(connection: Conexion, idnota: number): Promise<string[]> {
  const [rows] = await connection.execute<RowDataPacket[]>(
    `SELECT n.iddetalle_origen, SUM(n.cantidad) AS cantidad, MIN(n.numero_linea) AS linea
     FROM compras_detalle n
     WHERE n.idcompra = ? AND n.iddetalle_origen IS NOT NULL AND n.ajuste_precio = 0
     GROUP BY n.iddetalle_origen`,
    [idnota]
  );
  const errores: string[] = [];
  for (const r of rows) {
    const [otros] = await connection.execute<RowDataPacket[]>(
      `SELECT d.cantidad AS comprado,
              COALESCE((SELECT SUM(n.cantidad) FROM compras_detalle n JOIN compras c ON c.idcompra = n.idcompra
                        WHERE n.iddetalle_origen = d.iddetalle AND n.ajuste_precio = 0
                          AND c.estado = 'REGISTRADA' AND c.idcompra <> ?), 0) AS devuelto
       FROM compras_detalle d WHERE d.iddetalle = ?`,
      [idnota, r.iddetalle_origen]
    );
    const disponible = Math.max((Number(otros[0]?.comprado) || 0) - (Number(otros[0]?.devuelto) || 0), 0);
    if (Number(r.cantidad) > disponible + 1e-8) {
      errores.push(`La línea ${r.linea} devuelve ${Number(r.cantidad)} y solo quedan ${disponible} por devolver`);
    }
  }
  return errores;
}
