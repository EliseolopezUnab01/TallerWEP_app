'use client';

import { useCallback, useEffect, useState } from 'react';
import { tienePermiso } from '@/lib/permisos-constantes';

export interface SesionCliente {
  id: number;
  nombre: string;
  email: string;
  idrol: number | null;
  rol: string | null;
  esAdmin: boolean;
  permisos: string[];
}

// Se conserva entre pantallas: cada página monta su propio DashboardLayout.
let actual: SesionCliente | null = null;
let pendiente: Promise<SesionCliente | null> | null = null;
const oyentes = new Set<(s: SesionCliente | null) => void>();

async function pedir(): Promise<SesionCliente | null> {
  const res = await fetch('/api/auth/me', { cache: 'no-store' });
  if (res.status === 401) return null;
  const data = await res.json();
  return data.success ? (data.user as SesionCliente) : null;
}

export async function refrescarSesion(): Promise<SesionCliente | null> {
  pendiente ??= pedir().finally(() => {
    pendiente = null;
  });
  actual = await pendiente;
  if (actual) localStorage.setItem('user', JSON.stringify(actual));
  oyentes.forEach((f) => f(actual));
  return actual;
}

export async function cerrarSesion() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch {
    /* sin conexión: igual se limpia lo local */
  }
  actual = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('notifications');
  sessionStorage.removeItem('time_verified');
}

/** Sesión del usuario: `undefined` mientras carga, `null` si no hay. */
export function useSesion() {
  const [sesion, setSesion] = useState<SesionCliente | null | undefined>(actual ?? undefined);

  useEffect(() => {
    oyentes.add(setSesion);
    if (!actual) refrescarSesion().catch(() => setSesion(null));
    return () => {
      oyentes.delete(setSesion);
    };
  }, []);

  const puede = useCallback(
    (permiso: string | null | undefined) => !permiso || (!!sesion && tienePermiso(sesion.permisos, permiso, sesion.esAdmin)),
    [sesion]
  );

  return { sesion, puede };
}
