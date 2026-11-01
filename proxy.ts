import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE_SESION, getUserIdFromRequest } from '@/lib/auth';
import { cargarSesion, puede } from '@/lib/sesion';
import { permisoApi, permisoPagina } from '@/lib/permisos-constantes';

const API_PUBLICAS = ['/api/auth/login', '/api/auth/logout'];

function sinSesion(request: NextRequest, ruta: string) {
  if (ruta.startsWith('/dashboard')) {
    const res = NextResponse.redirect(new URL('/', request.url));
    res.cookies.delete(COOKIE_SESION);
    return res;
  }
  const res = NextResponse.json({ success: false, error: 'Sesión vencida; vuelva a iniciar sesión' }, { status: 401 });
  res.cookies.delete(COOKIE_SESION);
  return res;
}

export async function proxy(request: NextRequest) {
  const ruta = request.nextUrl.pathname;
  if (API_PUBLICAS.includes(ruta)) return NextResponse.next();

  const userId = getUserIdFromRequest(request);
  if (!userId) return sinSesion(request, ruta);

  let sesion;
  try {
    sesion = await cargarSesion(userId);
  } catch (error) {
    console.error('proxy: no se pudo leer la sesión', error);
    return NextResponse.json({ success: false, error: 'No hay conexión con la base de datos' }, { status: 503 });
  }
  if (!sesion) return sinSesion(request, ruta);

  if (ruta.startsWith('/api/')) {
    const permiso = permisoApi(ruta, request.method);
    if (permiso && !puede(sesion, permiso)) {
      return NextResponse.json({ success: false, error: 'No tiene permiso para esta acción' }, { status: 403 });
    }
  } else if (ruta.startsWith('/dashboard')) {
    const permiso = permisoPagina(ruta);
    if (permiso && !puede(sesion, permiso)) {
      const destino = new URL('/dashboard', request.url);
      destino.searchParams.set('sinpermiso', '1');
      return NextResponse.redirect(destino);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*', '/dashboard/:path*', '/dashboard', '/uploads/:path*'],
};
