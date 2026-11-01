'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Plus, Save, Search, Trash2 } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { confirmar } from '@/components/ui/avisos';
import { UI } from '@/lib/ui';
import {
  BarraTaller,
  Formulario,
  Insignia,
  COLOR_AVISO,
  Toast,
  aValores,
  idDeUrl,
  pedir,
  useAviso,
  type Fila,
  type Seccion,
  type Valores,
} from './comun';

export interface ConfigCatalogo {
  titulo: string;
  api: string;
  ruta: string;
  claveLista: string;
  claveDetalle: string;
  secciones: Seccion[];
  placeholderBusqueda: string;
  textoNuevo: string;
  textoVacio: ReactNode;
  filaLista: (f: Fila) => { principal: string; secundario: string; derecha?: string };
  titulo_ficha: (f: Fila) => string;
  extra?: (detalle: Record<string, unknown>) => ReactNode;
}

export function CatalogoFicha({ config }: { config: ConfigCatalogo }) {
  const { aviso, notificar } = useAviso();
  const [lista, setLista] = useState<Fila[]>([]);
  const [q, setQ] = useState('');
  const [idActual, setIdActual] = useState<number | null>(idDeUrl);
  const [detalle, setDetalle] = useState<Record<string, unknown> | null>(null);
  const [valores, setValores] = useState<Valores | null>(null);

  const fila = detalle?.[config.claveDetalle] as Fila | undefined;
  const nuevo = valores !== null && !fila;

  const cargarLista = useCallback(async () => {
    try {
      const data = await pedir(`${config.api}${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);
      setLista(data[config.claveLista]);
    } catch (e) {
      notificar('error', (e as Error).message);
    }
  }, [q, config.api, config.claveLista, notificar]);

  const aplicar = useCallback(
    (data: Record<string, unknown>) => {
      setDetalle(data);
      const f = data[config.claveDetalle] as Fila;
      setValores(aValores(f, config.secciones));
      window.history.replaceState(null, '', `${config.ruta}?id=${f.id}`);
    },
    [config.claveDetalle, config.secciones, config.ruta]
  );

  useEffect(() => {
    const t = setTimeout(cargarLista, 250);
    return () => clearTimeout(t);
  }, [cargarLista]);

  useEffect(() => {
    if (!idActual) return;
    let vigente = true;
    pedir(`${config.api}?id=${idActual}`)
      .then((data) => vigente && aplicar(data))
      .catch((e: Error) => vigente && notificar('error', e.message));
    return () => {
      vigente = false;
    };
  }, [idActual, config.api, aplicar, notificar]);

  const iniciarNuevo = () => {
    setDetalle(null);
    setIdActual(null);
    setValores(aValores(null, config.secciones));
    window.history.replaceState(null, '', config.ruta);
  };

  const guardar = async () => {
    if (!valores) return;
    try {
      if (nuevo) {
        const data = await pedir(config.api, 'POST', valores);
        notificar('ok', data.mensaje);
        setIdActual(data.id);
      } else if (fila) {
        const data = await pedir(config.api, 'PUT', { ...valores, id: fila.id });
        notificar('ok', data.mensaje);
        aplicar(await pedir(`${config.api}?id=${fila.id}`));
      }
      await cargarLista();
    } catch (e) {
      notificar('error', (e as Error).message);
    }
  };

  const eliminar = async () => {
    if (!fila || !(await confirmar(`¿Eliminar ${config.titulo_ficha(fila)}?`))) return;
    try {
      const data = await pedir(`${config.api}?id=${fila.id}`, 'DELETE');
      notificar('ok', data.mensaje);
      if (data.mensaje?.includes('inactivo')) aplicar(await pedir(`${config.api}?id=${fila.id}`));
      else {
        setDetalle(null);
        setValores(null);
        setIdActual(null);
        window.history.replaceState(null, '', config.ruta);
      }
      await cargarLista();
    } catch (e) {
      notificar('error', (e as Error).message);
    }
  };

  return (
    <DashboardLayout>
      <div
        className={`${UI.canvas} flex flex-col gap-2 lg:h-[calc(100vh-3rem)]`}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && valores) {
            e.preventDefault();
            guardar();
          }
        }}
      >
        <BarraTaller titulo={config.titulo} />
        <div className="grid gap-2 lg:flex-1 lg:min-h-0 lg:grid-cols-[16rem_1fr]">
          <aside className={`${UI.densePanel} flex flex-col min-h-[12rem] lg:min-h-0`}>
            <div className="flex flex-col gap-1.5 p-2 border-b border-border">
              <button type="button" className={`${UI.denseBtnPrimary} justify-center`} onClick={iniciarNuevo}>
                <Plus className="h-3.5 w-3.5" /> {config.textoNuevo}
              </button>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  className={`${UI.denseInput} w-full pl-7`}
                  placeholder={config.placeholderBusqueda}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              {lista.length === 0 ? (
                <p className="p-4 text-xs text-center text-muted-foreground">Sin registros.</p>
              ) : (
                lista.map((f) => {
                  const v = config.filaLista(f);
                  return (
                    <button
                      key={String(f.id)}
                      type="button"
                      onClick={() => setIdActual(Number(f.id))}
                      className={`w-full text-left px-2.5 py-1.5 border-b border-border text-xs ${
                        Number(f.id) === Number(fila?.id) ? UI.denseRowActive : 'hover:bg-muted/60'
                      } ${Number(f.activo) ? '' : 'opacity-60'}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate">{v.principal}</span>
                        {!Number(f.activo) && <Insignia texto="INACTIVO" color={COLOR_AVISO.INACTIVO} />}
                      </div>
                      <div className="flex items-center justify-between gap-2 text-muted-foreground">
                        <span className={`${UI.denseMono} truncate`}>{v.secundario}</span>
                        {v.derecha && <span className="shrink-0">{v.derecha}</span>}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          <section className="flex flex-col gap-2 min-h-0 lg:overflow-y-auto">
            {!valores ? (
              <div className={`${UI.densePanel} flex-1 flex flex-col items-center justify-center gap-2 py-16 text-center`}>
                {config.textoVacio}
              </div>
            ) : (
              <>
                <div className={`${UI.densePanel} shrink-0`}>
                  <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-border">
                    <span className="text-sm font-semibold">{fila ? config.titulo_ficha(fila) : config.textoNuevo}</span>
                    <div className="ml-auto flex gap-1.5">
                      <button type="button" className={UI.denseBtnPrimary} onClick={guardar} title="Ctrl+S">
                        <Save className="h-3.5 w-3.5" /> Guardar
                      </button>
                      {fila && (
                        <button type="button" className={UI.denseBtnDanger} aria-label="Eliminar" onClick={eliminar}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <Formulario secciones={config.secciones} valores={valores} onCambio={(c, v) => setValores({ ...valores, [c]: v })} />
                </div>
                {detalle && config.extra?.(detalle)}
              </>
            )}
          </section>
        </div>
      </div>
      <Toast aviso={aviso} />
    </DashboardLayout>
  );
}
