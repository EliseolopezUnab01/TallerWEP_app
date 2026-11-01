import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

export const COOKIE_SESION = 'taller_sesion';
export const DURACION_SESION_SEG = 7 * 24 * 60 * 60;

function secreto(): string {
  const s = process.env.JWT_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === 'production') throw new Error('Falta JWT_SECRET en .env.local');
  return 'solo-desarrollo-sin-jwt-secret';
}

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

export async function comparePasswords(password: string, hashedPassword: string): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword);
}

export function generateToken(userId: number): string {
  return jwt.sign({ userId }, secreto(), { expiresIn: DURACION_SESION_SEG });
}

export function verifyToken(token: string): { userId: number } {
  return jwt.verify(token, secreto()) as { userId: number };
}

function leerCookie(request: Request, nombre: string): string | null {
  const cabecera = request.headers.get('cookie');
  if (!cabecera) return null;
  for (const parte of cabecera.split(';')) {
    const [k, ...v] = parte.trim().split('=');
    if (k === nombre) return decodeURIComponent(v.join('='));
  }
  return null;
}

/** Token de la cookie de sesión o, si no hay, de la cabecera Authorization. */
export function tokenDeRequest(request: Request): string | null {
  const cookie = leerCookie(request, COOKIE_SESION);
  if (cookie) return cookie;
  const auth = request.headers.get('authorization');
  return auth?.startsWith('Bearer ') ? auth.slice(7) : null;
}

export function getUserIdFromRequest(request: Request): number | null {
  const token = tokenDeRequest(request);
  if (!token) return null;
  try {
    return verifyToken(token).userId;
  } catch {
    return null;
  }
}
