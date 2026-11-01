'use client';

import { useEffect, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { UI } from '@/lib/ui';
import { GloboStock, useDisponibilidad } from '@/components/ui/globo-stock';
import type { ProductoHit } from '../../ingreso/_components/tipos';

interface Props {
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  onElegir: (p: ProductoHit) => void;
}

/** Busca en inventario por referencia, código, OEM o nombre y devuelve el producto elegido. */
export function BuscadorProducto({ placeholder, disabled, autoFocus, onElegir }: Props) {
  const [texto, setTexto] = useState('');
  const [hits, setHits] = useState<ProductoHit[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [activo, setActivo] = useState(0);
  const disponibilidad = useDisponibilidad(abierto ? hits.map((p) => p.idprod) : []);

  useEffect(() => {
    const q = texto.trim();
    if (q.length < 2) return;
    let vigente = true;
    const t = setTimeout(async () => {
      setCargando(true);
      try {
        const res = await fetch(`/api/productos?${new URLSearchParams({ search: q, limit: '20' })}`);
        const data = await res.json();
        if (vigente) {
          setHits(data.products || []);
          setActivo(0);
          setAbierto(true);
        }
      } catch {
        if (vigente) setHits([]);
      } finally {
        if (vigente) setCargando(false);
      }
    }, 250);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [texto]);

  const elegir = (p: ProductoHit) => {
    onElegir(p);
    setTexto('');
    setHits([]);
    setAbierto(false);
  };

  return (
    <div className="relative flex-1 min-w-0">
      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
      <input
        className={`${UI.denseInput} w-full pl-7`}
        placeholder={placeholder ?? 'Referencia, código, OEM o nombre'}
        value={texto}
        disabled={disabled}
        autoFocus={autoFocus}
        onChange={(e) => setTexto(e.target.value)}
        onFocus={() => hits.length > 0 && setAbierto(true)}
        onBlur={() => setTimeout(() => setAbierto(false), 150)}
        onKeyDown={(e) => {
          if (!abierto || hits.length === 0) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActivo((a) => Math.min(a + 1, hits.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActivo((a) => Math.max(a - 1, 0));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            elegir(hits[activo]);
          } else if (e.key === 'Escape') {
            setAbierto(false);
          }
        }}
      />
      {cargando && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      {abierto && texto.trim().length >= 2 && (
        <div className={`${UI.dropdown} absolute left-0 right-0 top-full mt-1 max-h-64 overflow-y-auto`}>
          {hits.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">Sin resultados en inventario</p>
          ) : (
            hits.map((p, i) => (
              <button
                key={p.idprod}
                type="button"
                className={`w-full text-left px-3 py-1.5 text-xs flex gap-2 ${i === activo ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  elegir(p);
                }}
              >
                <span className={`${UI.denseMono} w-12 shrink-0 text-muted-foreground`}>{p.idprod}</span>
                <span className="w-24 shrink-0 truncate">{p.idprodprov || '—'}</span>
                <span className="flex-1 truncate">{p.nombre}</span>
                <span className="shrink-0 text-muted-foreground">{p.marca || ''}</span>
                <span className={`${UI.denseMono} inline-flex w-14 shrink-0 items-center justify-end gap-1`}>
                  <GloboStock idprod={p.idprod} datos={disponibilidad[p.idprod]} />
                  {Number(p.stock_contable || 0)}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
