'use client';

import { RefreshCw } from 'lucide-react';
import { UI } from '@/lib/ui';
import { InputBlur, fmt, num, type DetalleProceso, type Fila } from './comun';

interface Props {
  detalle: DetalleProceso;
  accion: (cuerpo: Record<string, unknown>) => Promise<boolean>;
  onHistorial: (idprod: number) => void;
}

export function PanelPendientes({ detalle, accion, onHistorial }: Props) {
  const { pendientes } = detalle;

  const guardar = (p: Fila, cambios: Record<string, unknown>) =>
    accion({
      accion: 'pendiente',
      idpendiente: p.idpendiente,
      backorder_reservado: p.backorder_reservado,
      backorder_enproceso: p.backorder_enproceso,
      backorder_pagado: p.backorder_pagado,
      fecha_estimada_backorder: p.fecha_estimada_backorder ? String(p.fecha_estimada_backorder).slice(0, 10) : '',
      estatus_backorder: p.estatus_backorder,
      ...cambios,
    });

  return (
    <div className={`${UI.densePanel} overflow-auto`}>
      <div className={`${UI.densePanelTitle} flex items-center justify-between`}>
        <span>Pedido pendiente por producto ({pendientes.length})</span>
        <button type="button" className={UI.denseBtn} onClick={() => accion({ accion: 'sincronizar' })}>
          <RefreshCw className="h-3.5 w-3.5" /> Actualizar cantidades
        </button>
      </div>
      <table className={UI.denseTable}>
        <thead>
          <tr>
            <th className={UI.denseTh}>Producto</th>
            <th className={`${UI.denseTh} text-right`}>Cotizado</th>
            <th className={`${UI.denseTh} text-right`}>Ordenado</th>
            <th className={`${UI.denseTh} text-right`}>Proforma</th>
            <th className={`${UI.denseTh} text-right`}>Factura</th>
            <th className={`${UI.denseTh} text-right`}>Recibido</th>
            <th className={`${UI.denseTh} text-right`}>BO reservado</th>
            <th className={`${UI.denseTh} text-right`}>BO en proceso</th>
            <th className={`${UI.denseTh} text-right`}>BO total</th>
            <th className={`${UI.denseTh} text-right`}>BO pagado</th>
            <th className={`${UI.denseTh} text-right`}>BO por pagar</th>
            <th className={UI.denseTh}>Fecha est. BO</th>
            <th className={UI.denseTh}>Estatus</th>
            <th className={UI.denseTh}>OC / PF / Factura</th>
          </tr>
        </thead>
        <tbody>
          {pendientes.length === 0 ? (
            <tr>
              <td colSpan={14} className={`${UI.denseTd} py-6 text-center text-muted-foreground`}>
                Las cantidades salen de las cotizaciones, órdenes, proformas y facturas vinculadas al proceso.
              </td>
            </tr>
          ) : (
            pendientes.map((p) => {
              const faltante = num(p.cant_ordenado) - num(p.cant_factura);
              return (
                <tr key={String(p.idpendiente)} className="hover:bg-muted/40">
                  <td className={`${UI.denseTd} max-w-[16rem] truncate`} title={String(p.descripcion ?? '')}>
                    {p.idprod ? (
                      <button type="button" className="text-primary hover:underline" onClick={() => onHistorial(Number(p.idprod))}>
                        <span className={UI.denseMono}>{String(p.idprod)}</span>
                      </button>
                    ) : (
                      <span className="rounded px-1 text-[10px] font-semibold bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300">
                        {String(p.temporal_codigo)}
                      </span>
                    )}{' '}
                    {String(p.descripcion ?? '')}
                  </td>
                  <td className={`${UI.denseTd} ${UI.denseMono} text-right`}>{fmt(p.cant_cotizado, 0)}</td>
                  <td className={`${UI.denseTd} ${UI.denseMono} text-right`}>{fmt(p.cant_ordenado, 0)}</td>
                  <td className={`${UI.denseTd} ${UI.denseMono} text-right`}>{fmt(p.cant_proforma, 0)}</td>
                  <td className={`${UI.denseTd} ${UI.denseMono} text-right ${faltante > 0 ? UI.textWarn : ''}`} title={faltante > 0 ? `Faltan ${faltante} de lo ordenado` : undefined}>
                    {fmt(p.cant_factura, 0)}
                  </td>
                  <td className={`${UI.denseTd} ${UI.denseMono} text-right`}>{fmt(p.cant_recibido, 0)}</td>
                  <td className={UI.denseTd}>
                    <InputBlur tipo="number" valor={p.backorder_reservado} className="w-20" onGuardar={(v) => guardar(p, { backorder_reservado: v })} />
                  </td>
                  <td className={UI.denseTd}>
                    <InputBlur tipo="number" valor={p.backorder_enproceso} className="w-20" onGuardar={(v) => guardar(p, { backorder_enproceso: v })} />
                  </td>
                  <td className={`${UI.denseTd} ${UI.denseMono} text-right font-semibold`}>{fmt(p.backorder_total, 0)}</td>
                  <td className={UI.denseTd}>
                    <InputBlur tipo="number" valor={p.backorder_pagado} className="w-20" onGuardar={(v) => guardar(p, { backorder_pagado: v })} />
                  </td>
                  <td className={`${UI.denseTd} ${UI.denseMono} text-right`}>{fmt(p.backorder_por_pagar, 0)}</td>
                  <td className={UI.denseTd}>
                    <InputBlur tipo="date" valor={p.fecha_estimada_backorder} className="w-32" onGuardar={(v) => guardar(p, { fecha_estimada_backorder: v })} />
                  </td>
                  <td className={UI.denseTd}>
                    <select className={`${UI.denseSelect} w-28`} value={String(p.estatus_backorder)} onChange={(e) => guardar(p, { estatus_backorder: e.target.value })}>
                      <option>ACTIVO</option>
                      <option>CANCELADO</option>
                      <option>FINALIZADO</option>
                    </select>
                  </td>
                  <td className={`${UI.denseTd} text-muted-foreground`}>
                    {[p.id_orden_compra, p.id_proforma, p.id_factura].filter(Boolean).join(' · ') || '—'}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
      <p className="px-3 py-2 text-[11px] text-muted-foreground">
        Backorder total = reservado + en proceso = pagado + por pagar. Lo por pagar se calcula solo.
      </p>
    </div>
  );
}
