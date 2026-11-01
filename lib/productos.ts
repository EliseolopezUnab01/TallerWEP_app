import path from 'path';
import { mkdir, unlink, writeFile } from 'fs/promises';
import type { RowDataPacket } from 'mysql2/promise';
import type { Conexion } from '@/lib/compras-detalle-db';
import { EXTENSIONES_IMAGEN, extensionDe } from '@/lib/archivos';

const CARPETA_IMAGENES = path.join(process.cwd(), 'public', 'uploads', 'productos');
const MAX_IMAGEN = 10 * 1024 * 1024;

/** Código jerárquico CC + GGG + SSS (8 dígitos) a partir de categoría, grupo y subgrupo. */
export async function codigoJerarquico(
  connection: Conexion,
  idcategoria: number | null,
  idGrupo: number | null,
  idSubgrupo: number | null
): Promise<string | null> {
  if (!idcategoria) return null;
  let grupo = '000';
  let subgrupo = '000';
  if (idGrupo) {
    const [g] = await connection.execute<RowDataPacket[]>('SELECT codigo FROM grupos WHERE id_grupo = ?', [idGrupo]);
    if (g[0]) grupo = String(g[0].codigo);
  }
  if (idSubgrupo) {
    const [s] = await connection.execute<RowDataPacket[]>('SELECT codigo FROM subgrupos WHERE id_subgrupo = ?', [idSubgrupo]);
    if (s[0]) subgrupo = String(s[0].codigo);
  }
  return `${String(idcategoria).padStart(2, '0')}${grupo.padStart(3, '0')}${subgrupo.padStart(3, '0')}`;
}

/** Guarda las imágenes válidas (jpg, png, webp, gif hasta 10 MB) y las registra en producto_imagenes. */
export async function guardarImagenesProducto(connection: Conexion, idprod: number, archivos: File[]) {
  const validas = archivos.filter(
    (f) => f && f.size > 0 && f.size <= MAX_IMAGEN && EXTENSIONES_IMAGEN.includes(extensionDe(f.name)) && !f.type.includes('svg')
  );
  if (validas.length === 0) return [];
  await mkdir(CARPETA_IMAGENES, { recursive: true });
  const [maxRows] = await connection.execute<RowDataPacket[]>(
    'SELECT COALESCE(MAX(orden), -1) AS max_orden, COUNT(*) AS total FROM producto_imagenes WHERE idprod = ?',
    [idprod]
  );
  let orden = Number(maxRows[0].max_orden) + 1;
  const sinPrincipal = Number(maxRows[0].total) === 0;
  const urls: string[] = [];
  for (const [i, archivo] of validas.entries()) {
    const nombre = `producto_${idprod}_${Date.now()}_${i}.${extensionDe(archivo.name)}`;
    await writeFile(path.join(CARPETA_IMAGENES, nombre), Buffer.from(await archivo.arrayBuffer()));
    const url = `/uploads/productos/${nombre}`;
    await connection.execute('INSERT INTO producto_imagenes (idprod, imagen_url, orden, es_principal) VALUES (?, ?, ?, ?)', [
      idprod,
      url,
      orden++,
      sinPrincipal && i === 0 ? 1 : 0,
    ]);
    urls.push(url);
  }
  return urls;
}

/** Borra una imagen del producto; solo toca archivos dentro de public/uploads/productos. */
export async function borrarImagenProducto(connection: Conexion, idprod: number, url: string) {
  await connection.execute('DELETE FROM producto_imagenes WHERE idprod = ? AND imagen_url = ?', [idprod, url]);
  if (!url.startsWith('/uploads/productos/')) return;
  const archivo = path.normalize(path.join(CARPETA_IMAGENES, path.basename(url)));
  if (!archivo.startsWith(CARPETA_IMAGENES + path.sep)) return;
  try {
    await unlink(archivo);
  } catch {
    /* ya no existe */
  }
}
