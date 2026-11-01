'use client';
import { confirmar } from '@/components/ui/avisos';

import { Fragment, useState } from 'react';
import { Paperclip, Plus, Trash2 } from 'lucide-react';
import { UI } from '@/lib/ui';
import { RAZONES_NO_GASTO, RAZONES_VINCULO } from '@/lib/procesos-constantes';
import { fecha, fmt, type DetalleProceso } from './comun';
import { Adjuntos } from './Adjuntos';

interface Props {
  detalle: DetalleProceso;
  editable: boolean;
  accion: (cuerpo: Record<string, unknown>) => Promise<boolean>;
}

const CATEGORIAS = RAZONES_VINCULO.filter((r) => !(RAZONES_NO_GASTO as readonly string[]).includes(r));

const vacio = {
  descripcion: '',
  categoria: 'GASTO LOCAL',
  monto_salida: '',
  fecha_salida: '',
  recibe: '',
  entrega: '',
  ref_orden_servicio: '',
  ref_otros: '',
  incluir_retaceo: true,
};

export function PanelGastos({ detalle, editable, accion }: Props) {
  const [form, setForm] = useState(vacio);
  const [abierto, setAbierto] = useState<number | null>(null);
  const { gastos } = detalle;

  const agregar = async () => {
    if (await accion({ accion: 'gasto', ...form })) setForm({ ...vacio, categoria: form.categoria });
  };

  return (
    <div className="flex flex-col gap-2">
      {editable && (
        <div className={`${UI.densePanel} flex flex-wrap items-end gap-2 p-3`}>
          <label className="flex flex-col gap-1 flex-[2] min-w-[12rem]">
            <span className={UI.denseLabel}>Descripción *</span>
            <input className={UI.denseInput} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={UI.denseLabel}>Categoría</span>
            <input
              list="categorias-gasto"
              maxLength={40}
              className={`${UI.denseInput} w-32 uppercase`}
              value={form.categoria}
              onChange={(e) => setForm({ ...form, categoria: e.target.value.toUpperCase() })}
            />
            <datalist id="categorias-gasto">
              {CATEGORIAS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label className="flex flex-col gap-1">
            <span className={UI.denseLabel}>Monto USD</span>
            <input
              type="number"
              step="any"
              className={`${UI.denseInput} w-24 text-right`}
              value={form.monto_salida}
              onChange={(e) => setForm({ ...form, monto_salida: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={UI.denseLabel}>Fecha</span>
            <input type="date" className={UI.denseInput} value={form.fecha_salida} onChange={(e) => setForm({ ...form, fecha_salida: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={UI.denseLabel}>Recibe</span>
            <input className={`${UI.denseInput} w-28`} value={form.recibe} onChange={(e) => setForm({ ...form, recibe: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={UI.denseLabel}>Entrega</span>
            <input className={`${UI.denseInput} w-28`} value={form.entrega} onChange={(e) => setForm({ ...form, entrega: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={UI.denseLabel}>Ticket / voucher</span>
            <input className={`${UI.denseInput} w-28`} value={form.ref_otros} onChange={(e) => setForm({ ...form, ref_otros: e.target.value })} />
          </label>
          <label className="flex items-center gap-1 pb-1.5 text-xs">
            <input type="checkbox" checked={form.incluir_retaceo} onChange={(e) => setForm({ ...form, incluir_retaceo: e.target.checked })} />
            Retacear
          </label>
          <button type="button" className={UI.denseBtnPrimary} disabled={!form.descripcion.trim()} onClick={agregar}>
            <Plus className="h-3.5 w-3.5" /> Agregar
          </button>
        </div>
      )}
      <div className={`${UI.densePanel} overflow-auto`}>
        <div className={UI.densePanelTitle}>Gastos sin documento ({gastos.length})</div>
        <table className={UI.denseTable}>
          <thead>
            <tr>
              <th className={UI.denseTh}>Fecha</th>
              <th className={UI.denseTh}>Descripción</th>
              <th className={UI.denseTh}>Categoría</th>
              <th className={UI.denseTh}>Recibe</th>
              <th className={UI.denseTh}>Entrega</th>
              <th className={UI.denseTh}>Referencia</th>
              <th className={`${UI.denseTh} text-right`}>Monto</th>
              <th className={`${UI.denseTh} text-center`}>Retacear</th>
              <th className={UI.denseTh} />
            </tr>
          </thead>
          <tbody>
            {gastos.length === 0 ? (
              <tr>
                <td colSpan={9} className={`${UI.denseTd} py-6 text-center text-muted-foreground`}>
                  Propinas, tickets y otros pagos sin comprobante fiscal.
                </td>
              </tr>
            ) : (
              gastos.map((g) => {
                const id = Number(g.idgasto);
                return (
                  <Fragment key={id}>
                    <tr>
                      <td className={UI.denseTd}>{fecha(g.fecha_salida) || '—'}</td>
                      <td className={UI.denseTd}>{String(g.descripcion)}</td>
                      <td className={UI.denseTd}>{String(g.categoria ?? 'GASTO LOCAL')}</td>
                      <td className={UI.denseTd}>{String(g.recibe ?? '')}</td>
                      <td className={UI.denseTd}>{String(g.entrega ?? '')}</td>
                      <td className={UI.denseTd}>{String(g.ref_otros ?? g.ref_orden_servicio ?? '')}</td>
                      <td className={`${UI.denseTd} ${UI.denseMono} text-right`}>{fmt(g.monto_salida)}</td>
                      <td className={`${UI.denseTd} text-center`}>{Number(g.incluir_retaceo) ? 'Sí' : 'No'}</td>
                      <td className={`${UI.denseTd} whitespace-nowrap`}>
                        <button
                          type="button"
                          className={`p-1 hover:text-primary ${Number(g.archivos) ? 'text-primary' : 'text-muted-foreground'}`}
                          aria-label="Archivos del gasto"
                          onClick={() => setAbierto(abierto === id ? null : id)}
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                          {Number(g.archivos) > 0 && <span className="text-[10px]">{String(g.archivos)}</span>}
                        </button>
                        {editable && (
                          <button
                            type="button"
                            className="p-1 text-muted-foreground hover:text-red-600"
                            aria-label="Eliminar gasto"
                            onClick={async () => (await confirmar('¿Eliminar este gasto y sus archivos?')) && accion({ accion: 'quitar_gasto', idgasto: g.idgasto })}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                    {abierto === id && (
                      <tr>
                        <td colSpan={9} className={`${UI.denseTd} bg-muted/30`}>
                          <Adjuntos compacto titulo="Ticket o foto del gasto" destino={{ entidad: 'GASTO', identidad: id }} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
