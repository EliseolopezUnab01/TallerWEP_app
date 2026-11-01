import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { Conexion } from '@/lib/compras-detalle-db';
import { siguienteCorrelativo, type TipoCorrelativo } from '@/lib/correlativos';
import { TIPOS_DOCUMENTO_COMPRA, type TipoDocumentoCompra } from '@/lib/documentos-compras-constantes';
import { r8 } from '@/lib/decimales';

export * from '@/lib/documentos-compras-constantes';

export function prefijoDocumento(tipo: TipoDocumentoCompra): TipoCorrelativo {
  return TIPOS_DOCUMENTO_COMPRA.find((t) => t.valor === tipo)!.prefijo;
}

/** Precio en dólares a partir del precio en la moneda del documento. */
export function aDolares(precioMoneda: number, moneda: string, tipoCambio: number) {
  return moneda === 'USD' ? r8(precioMoneda) : r8(precioMoneda * (tipoCambio || 1));
}

/** Recalcula precio_usd de las líneas y los totales del encabezado. */
export async function recalcularDocumento(connection: Conexion, iddocumento: number) {
  const [doc] = await connection.execute<RowDataPacket[]>(
    'SELECT moneda_documento, tipo_cambio FROM documentos_compras WHERE iddocumento = ?',
    [iddocumento]
  );
  if (!doc[0]) return;
  const moneda = String(doc[0].moneda_documento);
  const cambio = Number(doc[0].tipo_cambio) || 1;
  await connection.execute(
    `UPDATE documentos_compras_detalle
     SET precio_usd = IF(? = 'USD', precio_moneda, ROUND(precio_moneda * ?, 8))
     WHERE iddocumento = ?`,
    [moneda, cambio, iddocumento]
  );
  await connection.execute(
    `UPDATE documentos_compras d
     JOIN (SELECT iddocumento,
                  COALESCE(SUM(cantidad * precio_moneda), 0) AS sm,
                  COALESCE(SUM(cantidad * precio_usd), 0) AS su
           FROM documentos_compras_detalle WHERE iddocumento = ?) t ON t.iddocumento = d.iddocumento
     SET d.subtotal_moneda = ROUND(t.sm, 8), d.total_moneda = ROUND(t.sm, 8),
         d.subtotal_usd = ROUND(t.su, 8), d.total_usd = ROUND(t.su, 8)
     WHERE d.iddocumento = ?`,
    [iddocumento, iddocumento]
  );
  await connection.execute(
    `UPDATE documentos_compras SET subtotal_moneda = 0, total_moneda = 0, subtotal_usd = 0, total_usd = 0
     WHERE iddocumento = ? AND NOT EXISTS (SELECT 1 FROM documentos_compras_detalle WHERE iddocumento = ?)`,
    [iddocumento, iddocumento]
  );
}

/** Crea un producto temporal y devuelve su id y código PT. */
export async function crearTemporal(
  connection: Conexion,
  datos: {
    descripcion: string;
    referencia_proveedor?: string | null;
    oems?: string | null;
    marca?: string | null;
    origen_producto?: string | null;
    idproveedor?: number | null;
  }
) {
  const { codigo } = await siguienteCorrelativo(connection, 'PT');
  const [res] = await connection.execute<ResultSetHeader>(
    `INSERT INTO productos_temporales (codigo, referencia_proveedor, descripcion, oems, marca, origen_producto, idproveedor)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      codigo,
      datos.referencia_proveedor ?? null,
      datos.descripcion,
      datos.oems ?? null,
      datos.marca ?? null,
      datos.origen_producto ?? null,
      datos.idproveedor ?? null,
    ]
  );
  return { idtemporal: res.insertId, codigo };
}
