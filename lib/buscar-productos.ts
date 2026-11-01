'use client';

import { useEffect, useState } from 'react';
import type { SingleFilterType } from '@/components/search-filters';

/**
 * Busca productos en el servidor (sin traer todo el catálogo) con una espera corta mientras se escribe.
 * Devuelve hasta `limite` coincidencias; sin término trae los primeros `limite` productos.
 */
export function useBuscarProductos<T = any>(
  termino: string,
  filtros: SingleFilterType[] = [],
  limite = 50
) {
  const [productos, setProductos] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [inicial, setInicial] = useState(true);
  const claveFiltros = filtros.join(',');

  useEffect(() => {
    const control = new AbortController();
    const espera = setTimeout(async () => {
      setCargando(true);
      try {
        const params = new URLSearchParams({ limit: String(limite) });
        if (termino.trim()) params.set('search', termino.trim());
        if (claveFiltros) params.set('filters', claveFiltros);
        const res = await fetch(`/api/productos?${params}`, { signal: control.signal });
        if (res.ok) {
          const data = await res.json();
          setProductos(data.products || []);
          setTotal(data.pagination?.total ?? data.total ?? (data.products || []).length);
        }
      } catch (e) {
        if ((e as Error).name !== 'AbortError') console.error('Error al buscar productos:', e);
      } finally {
        if (!control.signal.aborted) {
          setCargando(false);
          setInicial(false);
        }
      }
    }, termino ? 250 : 0);
    return () => {
      clearTimeout(espera);
      control.abort();
    };
  }, [termino, claveFiltros, limite]);

  /** `inicial` solo es true hasta la primera respuesta; sirve para no desmontar el buscador en cada búsqueda. */
  return { productos, total, cargando, inicial };
}
