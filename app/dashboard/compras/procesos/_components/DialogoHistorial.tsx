'use client';

import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { UI } from '@/lib/ui';
import { Dato, fecha, fmt, pedir, type Fila } from './comun';

interface Historial {
  producto: Fila;
  documentos: Fila[];
  compras: Fila[];
  pendientes: Fila[];
}

/** Historial de un producto a través de cotizaciones, compras, DUCA, costos y backorders. */
export function DialogoHistorial({ idprod, onCerrar }: { idprod: number | null; onCerrar: () => void }) {
  const [datos, setDatos] = useState<{ id: number; historial: Historial | null; error?: string } | null>(null);

  useEffect(() => {
    if (!idprod) return;
    let vigente = true;
    pedir(`/api/historial-producto?idprod=${idprod}`)
      .then((d) => vigente && setDatos({ id: idprod, historial: d }))
      .catch((e: Error) => vigente && setDatos({ id: idprod, historial: null, error: e.message }));
    return () => {
      vigente = false;
    };
  }, [idprod]);

  if (!idprod) return null;
  const actual = datos?.id === idprod ? datos : null;
  const h = actual?.historial;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={onCerrar}>
      <div className={`${UI.densePanel} w-full max-w-5xl max-h-[90vh] flex flex-col`} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Historial del producto">
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border">
          <span className="text-sm font-semibold">
            Historial {idprod}
            {h ? ` — ${String(h.producto.nombre)}` : ''}
          </span>
          <button type="button" className={UI.denseBtn} onClick={onCerrar} aria-label="Cerrar">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        {!actual ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !h ? (
          <p className={`${UI.avisoError} m-3 px-3 py-2 text-xs`}>{actual.error}</p>
        ) : (
          <div className="overflow-y-auto p-3 flex flex-col gap-3">
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <Dato etiqueta="Stock contable" valor={fmt(h.producto.stock_contable, 0)} />
              <Dato etiqueta="Costo local" valor={fmt(h.producto.costo_local)} fuerte />
              <Dato etiqueta="Costo local promedio" valor={fmt(h.producto.costo_local_promedio)} />
              <Dato etiqueta="Anterior" valor={fmt(h.producto.costolcl_previo1)} />
              <Dato etiqueta="Previo" valor={fmt(h.producto.costolcl_previo2)} />
              <Dato etiqueta="Última factura" valor={`${String(h.producto.nofactura ?? '—')} ${fecha(h.producto.dt_compra)}`} />
            </div>

            <Tabla
              titulo="Compras e importaciones"
              filas={h.compras}
              columnas={[
                ['Fecha', (f) => fecha(f.fecha_emision)],
                ['Factura', (f) => String(f.factura ?? '')],
                ['Proveedor', (f) => String(f.proveedor ?? '')],
                ['Proceso', (f) => String(f.proceso ?? '—')],
                ['Cant.', (f) => fmt(f.cantidad, 0), true],
                ['Costo fact.', (f) => fmt(f.costo_unitario, 4), true],
                ['CIF', (f) => (f.costo_cif == null ? '—' : fmt(f.costo_cif, 4)), true],
                ['DAI', (f) => (f.dai_pagado == null ? '—' : fmt(f.dai_pagado, 4)), true],
                ['Gastos', (f) => (f.gastos_totales == null ? '—' : fmt(f.gastos_totales, 4)), true],
                ['Costo destino', (f) => (f.costo_destino == null ? '—' : fmt(f.costo_destino, 4)), true],
                ['Promedio', (f) => (f.costo_destino_prom == null ? '—' : fmt(f.costo_destino_prom, 4)), true],
              ]}
            />
            <Tabla
              titulo="Solicitudes, cotizaciones, órdenes y proformas"
              filas={h.documentos}
              columnas={[
                ['Fecha', (f) => fecha(f.fecha_documento)],
                ['Documento', (f) => String(f.id_documento)],
                ['Estado', (f) => String(f.estado_documento)],
                ['Proveedor', (f) => String(f.proveedor ?? '')],
                ['Proceso', (f) => String(f.proceso ?? '—')],
                ['Cant.', (f) => fmt(f.cantidad, 0), true],
                ['Precio', (f) => `${String(f.moneda_documento)} ${fmt(f.precio_moneda, 4)}`, true],
                ['USD', (f) => fmt(f.precio_usd, 4), true],
                ['Estatus', (f) => String(f.estatus_articulo)],
              ]}
            />
            <Tabla
              titulo="Backorders"
              filas={h.pendientes}
              columnas={[
                ['Proceso', (f) => String(f.proceso)],
                ['Ordenado', (f) => fmt(f.cant_ordenado, 0), true],
                ['Factura', (f) => fmt(f.cant_factura, 0), true],
                ['BO total', (f) => fmt(f.backorder_total, 0), true],
                ['Por pagar', (f) => fmt(f.backorder_por_pagar, 0), true],
                ['Estatus', (f) => String(f.estatus_backorder)],
              ]}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function Tabla({ titulo, filas, columnas }: { titulo: string; filas: Fila[]; columnas: [string, (f: Fila) => string, boolean?][] }) {
  return (
    <div className="rounded-md border border-border overflow-auto">
      <div className={UI.densePanelTitle}>
        {titulo} ({filas.length})
      </div>
      {filas.length === 0 ? (
        <p className="px-3 py-3 text-xs text-muted-foreground">Sin registros.</p>
      ) : (
        <table className={UI.denseTable}>
          <thead>
            <tr>
              {columnas.map(([t, , der]) => (
                <th key={t} className={`${UI.denseTh} ${der ? 'text-right' : ''}`}>
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={i}>
                {columnas.map(([t, valor, der]) => (
                  <td key={t} className={`${UI.denseTd} ${der ? `text-right ${UI.denseMono}` : ''}`}>
                    {valor(f)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
