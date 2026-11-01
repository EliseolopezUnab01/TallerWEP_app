import path from 'path';
import { mkdir, unlink, writeFile } from 'fs/promises';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { Conexion } from '@/lib/compras-detalle-db';

/** Carpetas bajo public/uploads. Las de inventario (productos) no se usan aquí. */
export const CARPETAS_ARCHIVOS = ['temporales', 'documentos', 'procesos', 'vehiculos'] as const;
export type CarpetaArchivo = (typeof CARPETAS_ARCHIVOS)[number];

export interface DestinoArchivo {
  carpeta: CarpetaArchivo;
  nodocto?: number | null;
  entidad?: string | null;
  identidad?: number | null;
  tipo_archivo?: string | null;
  descripcion?: string | null;
}

const MAX_BYTES = 15 * 1024 * 1024;

function nombreSeguro(nombre: string) {
  const base = path.basename(nombre).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return base.replace(/[^\w.-]+/g, '_').slice(-80) || 'archivo';
}

export async function guardarArchivo(connection: Conexion, archivo: File, destino: DestinoArchivo) {
  if (archivo.size === 0) throw new Error('El archivo está vacío');
  if (archivo.size > MAX_BYTES) throw new Error('El archivo supera 15 MB');
  const carpeta = path.join(process.cwd(), 'public', 'uploads', destino.carpeta);
  await mkdir(carpeta, { recursive: true });
  const nombre = `${Date.now()}-${nombreSeguro(archivo.name)}`;
  await writeFile(path.join(carpeta, nombre), Buffer.from(await archivo.arrayBuffer()));
  const ruta = `/uploads/${destino.carpeta}/${nombre}`;
  const [res] = await connection.execute<ResultSetHeader>(
    `INSERT INTO ruta_archivos (nodocto, entidad, identidad, ruta, nombre_original, tipo_archivo, descripcion)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      destino.nodocto ?? null,
      destino.entidad ?? null,
      destino.identidad ?? null,
      ruta,
      archivo.name.slice(0, 255),
      destino.tipo_archivo ?? (archivo.type || null),
      destino.descripcion ?? null,
    ]
  );
  return { idarchivo: res.insertId, ruta };
}

async function borrarFisico(ruta: string) {
  if (!ruta.startsWith('/uploads/')) return;
  const relativa = ruta.replace(/^\/uploads\//, '');
  if (!CARPETAS_ARCHIVOS.some((c) => relativa.startsWith(`${c}/`))) return;
  try {
    await unlink(path.join(process.cwd(), 'public', 'uploads', relativa));
  } catch {
    /* el archivo ya no existe */
  }
}

/** Borra registros y archivos físicos que cumplan el filtro (por id, nodocto o entidad). */
export async function eliminarArchivos(
  connection: Conexion,
  filtro: { idarchivo?: number; nodocto?: number; entidad?: string; identidad?: number }
) {
  const condiciones: string[] = [];
  const valores: (string | number)[] = [];
  if (filtro.idarchivo) {
    condiciones.push('idarchivo = ?');
    valores.push(filtro.idarchivo);
  }
  if (filtro.nodocto) {
    condiciones.push('nodocto = ?');
    valores.push(filtro.nodocto);
  }
  if (filtro.entidad && filtro.identidad) {
    condiciones.push('entidad = ? AND identidad = ?');
    valores.push(filtro.entidad, filtro.identidad);
  }
  if (condiciones.length === 0) return 0;
  const where = condiciones.join(' AND ');
  const [filas] = await connection.execute<RowDataPacket[]>(`SELECT ruta FROM ruta_archivos WHERE ${where}`, valores);
  for (const f of filas) await borrarFisico(String(f.ruta));
  await connection.execute(`DELETE FROM ruta_archivos WHERE ${where}`, valores);
  return filas.length;
}
