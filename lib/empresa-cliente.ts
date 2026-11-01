'use client';

import type { Empresa } from '@/lib/empresa';

let cache: Promise<Empresa | null> | null = null;

/** Datos de la empresa para documentos impresos en el navegador. */
export function obtenerEmpresa(forzar = false): Promise<Empresa | null> {
  if (!cache || forzar) {
    cache = fetch('/api/empresa', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => (d.success ? (d.empresa as Empresa) : null))
      .catch(() => null);
  }
  return cache;
}
