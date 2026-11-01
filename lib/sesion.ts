import { NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2/promise';
import { connectDB } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth';
import { tienePermiso } from '@/lib/permisos-constantes';

export interface Sesion {
  id: number;
  nombre: string;
  email: string;
  idrol: number | null;
  rol: string | null;
  esAdmin: boolean;
  permisos: string[];
}

const CACHE_MS = 15_000;
const cache = new Map<number, { sesion: Sesion | null; expira: number }>();

/** Vacía la caché de permisos (tras editar usuarios o roles). */
export function olvidarSesiones() {
  cache.clear();
}

export async function cargarSesion(userId: number): Promise<Sesion | null> {
  const guardada = cache.get(userId);
  if (guardada && guardada.expira > Date.now()) return guardada.sesion;

  const connection = await connectDB();
  try {
    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT u.id, u.nombre, u.email, u.idrol, u.activo, r.nombre AS rol, COALESCE(r.es_admin, 0) AS es_admin
       FROM usuarios u LEFT JOIN roles r ON r.idrol = u.idrol WHERE u.id = ?`,
      [userId]
    );
    const u = rows[0];
    let sesion: Sesion | null = null;
    if (u && Number(u.activo) === 1) {
      const [perms] = u.idrol
        ? await connection.execute<RowDataPacket[]>('SELECT permiso FROM rol_permisos WHERE idrol = ?', [u.idrol])
        : [[] as RowDataPacket[]];
      sesion = {
        id: Number(u.id),
        nombre: String(u.nombre),
        email: String(u.email),
        idrol: u.idrol ? Number(u.idrol) : null,
        rol: u.rol ? String(u.rol) : null,
        esAdmin: Number(u.es_admin) === 1,
        permisos: perms.map((p) => String(p.permiso)),
      };
    }
    cache.set(userId, { sesion, expira: Date.now() + CACHE_MS });
    return sesion;
  } finally {
    await connection.end();
  }
}

export async function obtenerSesion(request: Request): Promise<Sesion | null> {
  const userId = getUserIdFromRequest(request);
  if (!userId) return null;
  return cargarSesion(userId);
}

export function puede(sesion: Sesion, permiso: string) {
  return tienePermiso(sesion.permisos, permiso, sesion.esAdmin);
}

/**
 * Exige sesión y, si se indica, un permiso. Devuelve la sesión o la respuesta de error lista para retornar:
 *   const auth = await requierePermiso(request, 'compras.reabrir');
 *   if (auth instanceof NextResponse) return auth;
 */
export async function requierePermiso(request: Request, permiso?: string): Promise<Sesion | NextResponse> {
  const sesion = await obtenerSesion(request);
  if (!sesion) return NextResponse.json({ success: false, error: 'Sesión vencida; vuelva a iniciar sesión' }, { status: 401 });
  if (permiso && !puede(sesion, permiso)) {
    return NextResponse.json({ success: false, error: 'No tiene permiso para esta acción' }, { status: 403 });
  }
  return sesion;
}

/** Id del usuario de la sesión o null (para guardar quién hizo el cambio). */
export async function usuarioDeRequest(request: Request): Promise<number | null> {
  return (await obtenerSesion(request))?.id ?? null;
}
