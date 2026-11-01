'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, FilePlus2, Save, Search, Trash2 } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { NotificationDropdown } from '@/components/notification-dropdown';
import { UserDropdown } from '@/components/user-dropdown';
import { UI } from '@/lib/ui';
import { MONEDAS } from '@/lib/documentos-compras-constantes';
import { ESTADOS_PROCESO } from '@/lib/procesos-constantes';
import { Dato, fmt, num, pedir, type DetalleProceso, type Fila } from './_components/comun';
import { PanelDocumentos } from './_components/PanelDocumentos';
import { PanelDuca } from './_components/PanelDuca';
import { PanelPendientes } from './_components/PanelPendientes';
import { PanelGastos } from './_components/PanelGastos';
import { DialogoHistorial } from './_components/DialogoHistorial';

type Aviso = { tipo: 'ok' | 'error'; texto: string } | null;
type Pestana = 'documentos' | 'duca' | 'pendientes' | 'gastos';

const PESTANAS: { id: Pestana; etiqueta: string }[] = [
  { id: 'documentos', etiqueta: 'Documentos' },
  { id: 'duca', etiqueta: 'DUCA y retaceo' },
  { id: 'pendientes', etiqueta: 'Pedido pendiente' },
  { id: 'gastos', etiqueta: 'Gastos sin documento' },
];

const COLOR = {
  BORRADOR: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  FINALIZADO: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
};

const idDeUrl = () =>
  typeof window === 'undefined' ? null : Number(new URLSearchParams(window.location.search).get('id')) || null;

function aForm(p: DetalleProceso['proceso']) {
  return {
    descripcion: p.descripcion ?? '',
    estado_proceso: p.estado_proceso,
    origen_negociacion: p.origen_negociacion,
    factura_compra: p.factura_compra ?? '',
    moneda_factura: p.moneda_factura,
    tipo_cambio_pagado: String(num(p.tipo_cambio_pagado)),
    total_retaceo: String(num(p.total_retaceo)),
    comentarios: p.comentarios ?? '',
  };
}

export default function ProcesosPage() {
  const [lista, setLista] = useState<Fila[]>([]);
  const [q, setQ] = useState('');
  const [idActual, setIdActual] = useState<number | null>(idDeUrl);
  const [detalle, setDetalle] = useState<DetalleProceso | null>(null);
  const [form, setForm] = useState<ReturnType<typeof aForm> | null>(null);
  const [pestana, setPestana] = useState<Pestana>('documentos');
  const [historial, setHistorial] = useState<number | null>(null);
  const [aviso, setAviso] = useState<Aviso>(null);

  const notificar = useCallback((tipo: 'ok' | 'error', texto: string) => {
    setAviso({ tipo, texto });
    setTimeout(() => setAviso(null), 4500);
  }, []);
  const notificarError = useCallback((texto: string) => notificar('error', texto), [notificar]);

  const cargarLista = useCallback(async () => {
    try {
      const data = await pedir(`/api/procesos${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);
      setLista(data.procesos);
    } catch (e) {
      notificar('error', (e as Error).message);
    }
  }, [q, notificar]);

  const aplicar = useCallback((data: DetalleProceso) => {
    setDetalle(data);
    setForm(aForm(data.proceso));
    window.history.replaceState(null, '', `/dashboard/compras/procesos?id=${data.proceso.idproceso}`);
  }, []);

  const recargar = useCallback(
    async (id = detalle?.proceso.idproceso) => {
      if (!id) return;
      try {
        aplicar(await pedir(`/api/procesos?id=${id}`));
      } catch (e) {
        notificar('error', (e as Error).message);
      }
      await cargarLista();
    },
    [detalle?.proceso.idproceso, aplicar, notificar, cargarLista]
  );

  useEffect(() => {
    const t = setTimeout(cargarLista, 250);
    return () => clearTimeout(t);
  }, [cargarLista]);

  useEffect(() => {
    if (!idActual) return;
    let vigente = true;
    pedir(`/api/procesos?id=${idActual}`)
      .then((data) => vigente && aplicar(data))
      .catch((e: Error) => vigente && notificar('error', e.message));
    return () => {
      vigente = false;
    };
  }, [idActual, aplicar, notificar]);

  const accion = async (cuerpo: Record<string, unknown>) => {
    if (!detalle) return false;
    try {
      const data = await pedir('/api/procesos', 'POST', { idproceso: detalle.proceso.idproceso, ...cuerpo });
      if (data.mensaje) notificar('ok', data.mensaje);
      await recargar();
      return true;
    } catch (e) {
      notificar('error', (e as Error).message);
      return false;
    }
  };

  const guardar = async (extra: Record<string, unknown> = {}) => {
    if (!detalle || !form) return;
    try {
      await pedir('/api/procesos', 'PUT', { idproceso: detalle.proceso.idproceso, ...form, ...extra });
      notificar('ok', 'Proceso guardado');
      await recargar();
    } catch (e) {
      notificar('error', (e as Error).message);
    }
  };

  const crear = async () => {
    try {
      const data = await pedir('/api/procesos', 'POST', { accion: 'crear' });
      notificar('ok', data.mensaje);
      setIdActual(data.idproceso);
      await cargarLista();
    } catch (e) {
      notificar('error', (e as Error).message);
    }
  };

  const editable = detalle?.proceso.estado_documento === 'BORRADOR';
  const sugerido = detalle?.resumen.sugerido;

  return (
    <DashboardLayout>
      <div className={`${UI.canvas} flex flex-col gap-2 lg:h-[calc(100vh-3rem)]`}>
        <div className={`${UI.navbar} shrink-0`}>
          <div className="flex items-center gap-3">
            <span className={UI.navLabel}>Compras</span>
            <span className={UI.navDivider} />
            <span className={UI.navTitle}>Procesos de ingreso e importación</span>
          </div>
          <div className="flex items-center gap-3">
            <NotificationDropdown />
            <UserDropdown />
          </div>
        </div>

        <div className="grid gap-2 lg:flex-1 lg:min-h-0 lg:grid-cols-[16rem_1fr]">
          <aside className={`${UI.densePanel} flex flex-col min-h-[12rem] lg:min-h-0`}>
            <div className="flex flex-col gap-1.5 p-2 border-b border-border">
              <button type="button" className={`${UI.denseBtnPrimary} justify-center`} onClick={crear}>
                <FilePlus2 className="h-3.5 w-3.5" /> Nuevo proceso
              </button>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input className={`${UI.denseInput} w-full pl-7`} placeholder="Código, factura o DUCA" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              {lista.length === 0 ? (
                <p className="p-4 text-xs text-center text-muted-foreground">Sin procesos.</p>
              ) : (
                lista.map((p) => (
                  <button
                    key={String(p.idproceso)}
                    type="button"
                    onClick={() => setIdActual(Number(p.idproceso))}
                    className={`w-full text-left px-2.5 py-1.5 border-b border-border text-xs ${
                      Number(p.idproceso) === detalle?.proceso.idproceso ? UI.denseRowActive : 'hover:bg-muted/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`${UI.denseMono} font-semibold`}>{String(p.codigo)}</span>
                      <span className={`rounded px-1 text-[9px] font-semibold ${COLOR[p.estado_documento as keyof typeof COLOR]}`}>
                        {p.estado_documento === 'FINALIZADO' ? 'RETACEADO' : String(p.estado_proceso)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-muted-foreground">
                      <span className="truncate">{String(p.descripcion || p.numero_duca || 'Sin descripción')}</span>
                      <span className={`${UI.denseMono} shrink-0`}>{fmt(p.total_factura)}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </aside>

          <section className="flex flex-col gap-2 min-h-0 lg:overflow-y-auto">
            {!detalle || !form ? (
              <div className={`${UI.densePanel} flex-1 flex flex-col items-center justify-center gap-2 py-16 text-center`}>
                <p className="text-sm text-muted-foreground">Elija un proceso o cree uno nuevo.</p>
                <p className="text-xs text-muted-foreground max-w-md">
                  Un proceso agrupa las facturas de importación, los documentos de gasto (BL, seguro, transporte), el DUCA y el retaceo que
                  da el costo local de cada producto.
                </p>
              </div>
            ) : (
              <>
                <div className={`${UI.densePanel} shrink-0`}>
                  <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-border">
                    <span className={`${UI.denseMono} text-sm font-semibold`}>{detalle.proceso.codigo}</span>
                    <span className={`rounded px-1.5 text-[10px] font-semibold ${COLOR[detalle.proceso.estado_documento]}`}>
                      {!editable ? 'RETACEO APLICADO' : detalle.proceso.fecha_retaceo ? 'REABIERTO' : 'BORRADOR'}
                    </span>
                    <span className={`${UI.denseMono} text-[11px] text-muted-foreground`}>ID {detalle.proceso.nodocto}</span>
                    <div className="ml-auto flex gap-1.5">
                      <button type="button" className={UI.denseBtn} onClick={() => guardar()}>
                        <Save className="h-3.5 w-3.5" /> Guardar
                      </button>
                      {editable && !detalle.proceso.fecha_retaceo && (
                        <button
                          type="button"
                          className={UI.denseBtnDanger}
                          aria-label="Eliminar proceso"
                          onClick={async () => {
                            if (!confirm(`¿Eliminar ${detalle.proceso.codigo}? Las facturas y documentos quedan sin proceso.`)) return;
                            try {
                              const data = await pedir(`/api/procesos?id=${detalle.proceso.idproceso}`, 'DELETE');
                              notificar('ok', data.mensaje);
                              setDetalle(null);
                              setIdActual(null);
                              window.history.replaceState(null, '', '/dashboard/compras/procesos');
                              await cargarLista();
                            } catch (e) {
                              notificar('error', (e as Error).message);
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-4">
                    <label className="flex flex-col gap-1 sm:col-span-2">
                      <span className={UI.denseLabel}>Descripción</span>
                      <input className={UI.denseInput} disabled={!editable} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className={UI.denseLabel}>Estado del proceso</span>
                      <select className={UI.denseSelect} value={form.estado_proceso} onChange={(e) => setForm({ ...form, estado_proceso: e.target.value })}>
                        {ESTADOS_PROCESO.map((e) => (
                          <option key={e}>{e}</option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className={UI.denseLabel}>Origen</span>
                      <select className={UI.denseSelect} disabled={!editable} value={form.origen_negociacion} onChange={(e) => setForm({ ...form, origen_negociacion: e.target.value })}>
                        <option value="INTERNACIONAL">Internacional</option>
                        <option value="NACIONAL">Nacional</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className={UI.denseLabel}>Factura(s) del proveedor</span>
                      <input className={UI.denseInput} disabled={!editable} value={form.factura_compra} onChange={(e) => setForm({ ...form, factura_compra: e.target.value })} />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className={UI.denseLabel}>Moneda de la factura</span>
                      <select
                        className={UI.denseSelect}
                        disabled={!editable}
                        value={form.moneda_factura}
                        onChange={(e) => setForm({ ...form, moneda_factura: e.target.value, tipo_cambio_pagado: e.target.value === 'USD' ? '1' : form.tipo_cambio_pagado })}
                      >
                        {MONEDAS.map((m) => (
                          <option key={m}>{m}</option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className={UI.denseLabel}>TC pagado al banco (USD por {form.moneda_factura})</span>
                      <input
                        type="number"
                        step="any"
                        className={`${UI.denseInput} text-right ${UI.denseMono}`}
                        disabled={!editable || form.moneda_factura === 'USD'}
                        value={form.tipo_cambio_pagado}
                        onChange={(e) => setForm({ ...form, tipo_cambio_pagado: e.target.value })}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className={UI.denseLabel}>Comentarios</span>
                      <input className={UI.denseInput} value={form.comentarios} onChange={(e) => setForm({ ...form, comentarios: e.target.value })} />
                    </label>
                  </div>
                  <div className="flex flex-wrap items-end gap-x-6 gap-y-2 px-3 py-2 border-t border-border">
                    <Dato etiqueta={`Total facturas (${detalle.proceso.moneda_factura})`} valor={fmt(detalle.resumen.total_factura)} />
                    <Dato etiqueta="Suma documentos (fiscal)" valor={fmt(detalle.resumen.sumas_documentos)} />
                    <Dato
                      etiqueta="Sugerido a retacear"
                      valor={`${fmt(sugerido?.total)}`}
                    />
                    <span className="text-[11px] text-muted-foreground self-center">
                      docs {fmt(sugerido?.documentos)} + sin doc. {fmt(sugerido?.sin_documento)} + otros DUCA {fmt(sugerido?.otros_cargos_duca)}
                    </span>
                    <label className="flex flex-col gap-1 ml-auto">
                      <span className={UI.denseLabel}>Total a retacear</span>
                      <div className="flex gap-1.5">
                        <input
                          type="number"
                          step="any"
                          className={`${UI.denseInput} w-28 text-right ${UI.denseMono} font-semibold`}
                          disabled={!editable}
                          value={form.total_retaceo}
                          onChange={(e) => setForm({ ...form, total_retaceo: e.target.value })}
                        />
                        {editable && (
                          <button
                            type="button"
                            className={UI.denseBtn}
                            disabled={!sugerido || num(form.total_retaceo) === sugerido.total}
                            onClick={() => guardar({ total_retaceo: sugerido?.total ?? 0 })}
                          >
                            Usar sugerido
                          </button>
                        )}
                      </div>
                    </label>
                  </div>
                </div>

                <div className="flex gap-1 shrink-0 border-b border-border">
                  {PESTANAS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPestana(p.id)}
                      className={`px-3 py-1.5 text-xs border-b-2 -mb-px ${
                        pestana === p.id ? 'border-primary text-primary font-medium' : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {p.etiqueta}
                      {p.id === 'pendientes' && detalle.pendientes.length > 0 && ` (${detalle.pendientes.length})`}
                    </button>
                  ))}
                </div>

                {pestana === 'documentos' && (
                  <PanelDocumentos
                    detalle={detalle}
                    editable={editable}
                    accion={accion}
                    onError={notificarError}
                    actualizarRelacion={async (idrelacion, cambios) => {
                      try {
                        await pedir('/api/procesos', 'PUT', { idrelacion, ...cambios });
                        await recargar();
                      } catch (e) {
                        notificar('error', (e as Error).message);
                      }
                    }}
                  />
                )}
                {pestana === 'duca' && <PanelDuca detalle={detalle} editable={editable} accion={accion} onHistorial={setHistorial} />}
                {pestana === 'pendientes' && <PanelPendientes detalle={detalle} accion={accion} onHistorial={setHistorial} />}
                {pestana === 'gastos' && <PanelGastos detalle={detalle} editable={editable} accion={accion} />}
              </>
            )}
          </section>
        </div>
      </div>

      <DialogoHistorial idprod={historial} onCerrar={() => setHistorial(null)} />

      {aviso && (
        <div
          className={`fixed bottom-6 right-6 z-[60] max-w-md px-3 py-2 flex items-center gap-2 text-xs shadow-lg ${
            aviso.tipo === 'ok' ? UI.avisoOk : UI.avisoError
          }`}
        >
          {aviso.tipo === 'ok' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          {aviso.texto}
        </div>
      )}
    </DashboardLayout>
  );
}
