'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Package } from 'lucide-react';
import { DialogoHistorial } from '@/app/dashboard/compras/procesos/_components/DialogoHistorial';
import type { Disponibilidad } from '@/lib/disponibilidad';

const VIGENCIA_MS = 60_000;
const cache = new Map<number, { t: number; d: Disponibilidad }>();
const vigente = (id: number) => {
  const c = cache.get(id);
  return c && Date.now() - c.t < VIGENCIA_MS ? c.d : undefined;
};

async function pedirDisponibilidad(ids: number[]) {
  const faltan = ids.filter((id) => !vigente(id));
  if (faltan.length) {
    const res = await fetch(`/api/productos/disponibilidad?ids=${faltan.join(',')}`);
    if (res.ok) {
      const data = await res.json();
      const t = Date.now();
      for (const [id, d] of Object.entries(data.disponibilidad ?? {})) cache.set(Number(id), { t, d: d as Disponibilidad });
    }
  }
  const datos: Record<number, Disponibilidad> = {};
  for (const id of ids) {
    const d = cache.get(id)?.d;
    if (d) datos[id] = d;
  }
  return datos;
}

/** Disponibilidad de varios productos en una sola consulta (para listas). */
export function useDisponibilidad(ids: number[]) {
  const clave = [...new Set(ids.filter(Boolean))].sort((a, b) => a - b).join(',');
  const [datos, setDatos] = useState<Record<number, Disponibilidad>>({});
  useEffect(() => {
    if (!clave) return;
    let activo = true;
    pedirDisponibilidad(clave.split(',').map(Number))
      .then((d) => activo && setDatos(d))
      .catch(() => undefined);
    return () => {
      activo = false;
    };
  }, [clave]);
  return datos;
}

const n = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 2 });
const dinero = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });

function color(d: Disponibilidad | undefined) {
  if (!d) return 'text-muted-foreground';
  if (d.contable > 0) return 'text-emerald-600 dark:text-emerald-400';
  if (d.en_camino > 0) return 'text-amber-500 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

/** Bloque para la ficha del producto: última compra y lo que viene en camino. */
export function FichaCompras({ idprod }: { idprod: number }) {
  const d = useDisponibilidad([idprod])[idprod];
  const [historial, setHistorial] = useState(false);
  return (
    <>
    <div className="grid grid-cols-2 border-b border-slate-200 dark:border-secondary text-sm">
      <div className="p-4 border-r border-slate-200 dark:border-secondary">
        <div className="text-xs text-slate-500 dark:text-slate-400 uppercase">Última compra</div>
        {!d ? (
          <div className="text-muted-foreground">…</div>
        ) : d.ultima_compra ? (
          <>
            <div className="font-semibold text-slate-900 dark:text-slate-200">
              {d.ultima_compra.fecha ?? '—'} · {n(d.ultima_compra.cantidad)} × ${dinero(d.ultima_compra.costo)}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {d.ultima_compra.factura ?? ''} {d.ultima_compra.proveedor ? `· ${d.ultima_compra.proveedor}` : ''}
            </div>
          </>
        ) : (
          <div className="text-muted-foreground">Sin compras registradas</div>
        )}
      </div>
      <div className="p-4">
        <div className="text-xs text-slate-500 dark:text-slate-400 uppercase">En camino</div>
        {!d ? (
          <div className="text-muted-foreground">…</div>
        ) : d.en_camino > 0 ? (
          <>
            <div className="font-semibold text-amber-600 dark:text-amber-400">
              {n(d.en_camino)} {d.fecha_estimada ? `· aprox. ${d.fecha_estimada}` : ''}
            </div>
            <div className="truncate text-xs text-muted-foreground">{d.procesos.map((p) => p.codigo).join(', ')}</div>
          </>
        ) : (
          <div className="text-muted-foreground">Nada en procesos abiertos</div>
        )}
        <button type="button" className="mt-2 text-xs text-primary hover:underline" onClick={() => setHistorial(true)}>
          Ver historial de compras
        </button>
      </div>
    </div>
    <DialogoHistorial idprod={historial ? idprod : null} onCerrar={() => setHistorial(false)} />
    </>
  );
}

interface Props {
  idprod: number;
  /** Si no se pasa, se consulta al pasar el mouse. */
  datos?: Disponibilidad;
  className?: string;
}

/** Ícono de stock con una mini ventana flotante al pasar el mouse (contable, físico, en camino, última compra). */
export function GloboStock({ idprod, datos, className = '' }: Props) {
  const [propios, setPropios] = useState<Disponibilidad | undefined>(() => vigente(idprod));
  const [pos, setPos] = useState<{ x: number; y: number; arriba: boolean } | null>(null);
  const ancla = useRef<HTMLSpanElement>(null);
  const cerrar = useRef<ReturnType<typeof setTimeout> | null>(null);
  const d = datos ?? propios;

  const abrir = () => {
    if (cerrar.current) clearTimeout(cerrar.current);
    const r = ancla.current?.getBoundingClientRect();
    if (!r) return;
    const arriba = r.bottom + 220 > window.innerHeight;
    setPos({ x: Math.min(r.left, window.innerWidth - 280), y: arriba ? r.top - 6 : r.bottom + 6, arriba });
    if (!datos && !vigente(idprod)) pedirDisponibilidad([idprod]).then((m) => setPropios(m[idprod]));
  };
  const salir = () => {
    cerrar.current = setTimeout(() => setPos(null), 120);
  };

  return (
    <>
      <span
        ref={ancla}
        className={`inline-flex cursor-help items-center ${color(d)} ${className}`}
        onMouseEnter={abrir}
        onMouseLeave={salir}
        onFocus={abrir}
        onBlur={salir}
        tabIndex={0}
        aria-label="Disponibilidad"
      >
        <Package className="h-3.5 w-3.5" />
      </span>
      {pos &&
        createPortal(
          <div
            className="fixed z-[80] w-[17rem] rounded-md border border-border bg-popover p-2.5 text-xs text-popover-foreground shadow-lg"
            style={{ left: pos.x, top: pos.y, transform: pos.arriba ? 'translateY(-100%)' : undefined }}
            onMouseEnter={() => cerrar.current && clearTimeout(cerrar.current)}
            onMouseLeave={salir}
          >
            {!d ? (
              <p className="text-muted-foreground">Consultando…</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                <div className="grid grid-cols-3 gap-1 text-center">
                  <div className="rounded bg-muted/60 px-1 py-1">
                    <div className="text-[10px] text-muted-foreground">Contable</div>
                    <div className={`font-mono font-semibold ${color(d)}`}>{n(d.contable)}</div>
                  </div>
                  <div className="rounded bg-muted/60 px-1 py-1">
                    <div className="text-[10px] text-muted-foreground">Físico</div>
                    <div className="font-mono font-semibold">{n(d.fisico)}</div>
                  </div>
                  <div className="rounded bg-muted/60 px-1 py-1">
                    <div className="text-[10px] text-muted-foreground">En camino</div>
                    <div className="font-mono font-semibold text-amber-600 dark:text-amber-400">{n(d.en_camino)}</div>
                  </div>
                </div>
                {d.procesos.length > 0 && (
                  <div className="flex flex-col gap-0.5">
                    {d.fecha_estimada && (
                      <div className="text-[11px]">
                        Llega aprox. <span className="font-semibold">{d.fecha_estimada}</span>
                      </div>
                    )}
                    {d.procesos.map((p) => (
                      <div key={p.idproceso} className="flex justify-between text-[11px] text-muted-foreground">
                        <span>
                          {p.codigo} · {p.estado.toLowerCase()}
                        </span>
                        <span className="font-mono">{n(p.cantidad)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="border-t border-border pt-1.5 text-[11px]">
                  {d.ultima_compra ? (
                    <>
                      <div className="text-muted-foreground">Última compra</div>
                      <div className="flex justify-between">
                        <span>{d.ultima_compra.fecha ?? '—'}</span>
                        <span className="font-mono">
                          {n(d.ultima_compra.cantidad)} × ${dinero(d.ultima_compra.costo)}
                        </span>
                      </div>
                      <div className="truncate text-muted-foreground">
                        {d.ultima_compra.factura ?? ''} {d.ultima_compra.proveedor ? `· ${d.ultima_compra.proveedor}` : ''}
                      </div>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Sin compras registradas</span>
                  )}
                </div>
              </div>
            )}
          </div>,
          document.body
        )}
    </>
  );
}
