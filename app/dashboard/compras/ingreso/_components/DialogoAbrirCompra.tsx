'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { UI } from '@/lib/ui';
import { ESTADOS_COMPRA } from '@/lib/compras-constantes';
import { fechaInput, fmt2, type CompraLista } from './tipos';

const ESTILO_ESTADO: Record<string, string> = {
  BORRADOR: 'text-amber-700 dark:text-amber-300',
  REGISTRADA: 'text-emerald-700 dark:text-emerald-300',
  ANULADA: 'text-red-600 dark:text-red-400',
  INVALIDADO: 'text-slate-500 dark:text-slate-400 line-through',
};

interface Props {
  abierto: boolean;
  idActual: number | null;
  onCerrar: () => void;
  onElegir: (id: number) => void;
}

export function DialogoAbrirCompra({ abierto, idActual, onCerrar, onElegir }: Props) {
  const [estado, setEstado] = useState('BORRADOR');
  const [q, setQ] = useState('');
  const [compras, setCompras] = useState<CompraLista[]>([]);
  const [cargando, setCargando] = useState(false);
  const refQ = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!abierto) return;
    setTimeout(() => refQ.current?.focus(), 0);
    let vigente = true;
    const t = setTimeout(async () => {
      setCargando(true);
      try {
        const params = new URLSearchParams();
        if (estado) params.set('estado', estado);
        if (q.trim()) params.set('q', q.trim());
        const res = await fetch(`/api/compras?${params}`);
        const data = await res.json();
        if (vigente) setCompras(data.success ? data.compras || [] : []);
      } catch {
        if (vigente) setCompras([]);
      } finally {
        if (vigente) setCargando(false);
      }
    }, 200);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [abierto, estado, q]);

  useEffect(() => {
    if (!abierto) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] bg-slate-900/40 dark:bg-black/60 backdrop-blur-[1px]" onMouseDown={onCerrar}>
      <div
        className={`${UI.densePanel} w-[min(56rem,94vw)] max-h-[75vh] flex flex-col shadow-xl`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
          <span className="text-sm font-semibold">Abrir compra</span>
          <div className="flex gap-0.5 ml-3">
            {[...ESTADOS_COMPRA, ''].map((e) => (
              <button
                key={e || 'todas'}
                type="button"
                onClick={() => setEstado(e)}
                className={`h-6 px-2 rounded text-[11px] font-medium ${
                  estado === e ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                {e ? e.charAt(0) + e.slice(1).toLowerCase() : 'Todas'}
              </button>
            ))}
          </div>
          <div className="relative flex-1 ml-2">
            <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              ref={refQ}
              className={`${UI.denseInput} w-full pl-7`}
              placeholder="Proveedor, código, número de factura o código de generación"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && compras[0]) onElegir(compras[0].idcompra);
              }}
            />
          </div>
          <button type="button" className="p-1 rounded text-muted-foreground hover:bg-muted" onClick={onCerrar} title="Cerrar (Esc)">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          <table className={UI.denseTable}>
            <thead>
              <tr>
                <th className={UI.denseTh}>Número</th>
                <th className={UI.denseTh}>Estado</th>
                <th className={UI.denseTh}>Tipo</th>
                <th className={UI.denseTh}>Emisión</th>
                <th className={UI.denseTh}>Factura</th>
                <th className={`${UI.denseTh} w-full`}>Proveedor</th>
                <th className={`${UI.denseTh} text-right`}>Líneas</th>
                <th className={`${UI.denseTh} text-right`}>Total</th>
              </tr>
            </thead>
            <tbody>
              {compras.map((c) => (
                <tr
                  key={c.idcompra}
                  className={c.idcompra === idActual ? UI.denseRowActive : UI.denseRow}
                  onClick={() => onElegir(c.idcompra)}
                >
                  <td className={`${UI.denseTd} ${UI.denseMono} whitespace-nowrap`} title={c.nodocto ? `Nodocto ${c.nodocto}` : undefined}>
                    {c.numero_interno || c.idcompra}
                  </td>
                  <td className={`${UI.denseTd} font-semibold text-[11px] ${ESTILO_ESTADO[c.estado] || ''}`}>{c.estado}</td>
                  <td className={UI.denseTd}>
                    {c.clase_documento === 'IMPORTACION' ? 'Importación' : c.tipo_dte_abrev || c.tipo_dte || '—'}
                  </td>
                  <td className={`${UI.denseTd} ${UI.denseMono}`}>{fechaInput(c.fecha_emision) || '—'}</td>
                  <td className={`${UI.denseTd} ${UI.denseMono}`}>{c.numero_factura || '—'}</td>
                  <td className={`${UI.denseTd} max-w-0 truncate`}>
                    {c.proveedor_codigo && <span className={`${UI.denseMono} text-primary mr-1.5`}>{c.proveedor_codigo}</span>}
                    {c.proveedor_nombre || <span className="text-muted-foreground">Sin proveedor</span>}
                  </td>
                  <td className={`${UI.denseTd} ${UI.denseMono} text-right`}>{c.total_lineas}</td>
                  <td className={`${UI.denseTd} ${UI.denseMono} text-right font-semibold`}>{fmt2(c.total_pagar)}</td>
                </tr>
              ))}
              {compras.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-[11px] text-muted-foreground">
                    {cargando ? 'Cargando…' : 'No hay compras con ese filtro'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
