import type { Connection, RowDataPacket } from 'mysql2/promise';

export type TipoCorrelativo =
  | 'NODOCTO'
  | 'CP'
  | 'CI'
  | 'SC'
  | 'CT'
  | 'OC'
  | 'PF'
  | 'IMP'
  | 'PT'
  | 'VH'
  | 'EX';

function formatear(tipo: TipoCorrelativo, anio: number, numero: number) {
  const aa = String(anio % 100).padStart(2, '0');
  switch (tipo) {
    case 'NODOCTO':
      return String((anio % 100) * 1_000_000 + numero);
    case 'IMP':
      return `IMP-${anio}-${String(numero).padStart(5, '0')}`;
    case 'PT':
    case 'VH':
      return `${tipo}${aa}-${String(numero).padStart(5, '0')}`;
    default:
      return `${tipo}${aa}-${String(numero).padStart(6, '0')}`;
  }
}

/**
 * Entrega el siguiente número del tipo indicado. El incremento es atómico
 * (LAST_INSERT_ID en el mismo UPDATE), así que dos usuarios nunca reciben
 * el mismo número aunque no haya transacción abierta.
 */
export async function siguienteCorrelativo(
  connection: Connection,
  tipo: TipoCorrelativo,
  fecha = new Date()
) {
  const anio = fecha.getFullYear();
  await connection.query(
    `INSERT INTO correlativos (tipo, anio, ultimo) VALUES (?, ?, LAST_INSERT_ID(1))
     ON DUPLICATE KEY UPDATE ultimo = LAST_INSERT_ID(ultimo + 1)`,
    [tipo, anio]
  );
  const [filas] = await connection.query<RowDataPacket[]>('SELECT LAST_INSERT_ID() AS numero');
  const numero = Number(filas[0].numero);
  return { numero, codigo: formatear(tipo, anio, numero) };
}

export async function nuevoNodocto(connection: Connection, fecha = new Date()) {
  const { codigo } = await siguienteCorrelativo(connection, 'NODOCTO', fecha);
  return Number(codigo);
}
