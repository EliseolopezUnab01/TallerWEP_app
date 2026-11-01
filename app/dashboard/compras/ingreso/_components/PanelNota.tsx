'use client';

import { useCallback, useEffect, useState } from 'react';
import { ListPlus, X } from 'lucide-react';
import { UI } from '@/lib/ui';
import { NOMBRE_DESTINO } from '@/lib/compras-constantes';
import type { CompraCtx } from './useCompra';
import { fechaInput, fmt2, fmt4 } from './tipos';

interface FacturaOrigen {
  idcompra: number;
  numero_interno: string | null;
  numero_factura: string | null;
  tipo_dte: string;
  fecha_emision: string | null;
  total_pagar: number;
}

interface LineaOrigen {
  iddetalle: number;
  numero_linea: number;
  destino: string | null;
  descripcion: string;
  costo_unitario: number;
  comprado: number;
  devuelto: number;
  en_esta_nota: number;
  disponible: number;
}

interface Seleccion {
  marcada: boolean;
  ajuste: boolean;
  cantidad: string;
  costo: string;
}

async function pedir(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) throw new Error(data.error || 'Error de conexión');
  return data;
}

const enviar = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

/** Nota de crédito o débito: factura original y carga de sus líneas con la cantidad a devolver. */
export function PanelNota({ ctx }: { ctx: CompraCtx }) {
  const { compra, esBorrador, sucio } = ctx;
  const esCredito = compra?.tipo_dte === '05';
  const [facturas, setFacturas] = useState<FacturaOrigen[]>([]);
  const [elegida, setElegida] = useState('');
  const [dialogo, setDialogo] = useState(false);
  const [lineas, setLineas] = useState<LineaOrigen[]>([]);
  const [seleccion, setSeleccion] = useState<Record<number, Seleccion>>({});
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!compra?.idproveedor || !esBorrador) {
      setFacturas([]);
      return;
    }
    let vigente = true;
    pedir(`/api/compras-nota?idcompra=${compra.idcompra}&facturas=1`)
      .then((d) => vigente && setFacturas(d.facturas || []))
      .catch(() => vigente && setFacturas([]));
    return () => {
      vigente = false;
    };
  }, [compra?.idcompra, compra?.idproveedor, esBorrador]);

  const guardarAntes = async () => (sucio ? ctx.guardar() : true);

  const asignar = async () => {
    if (!compra || !elegida) return;
    if (!(await guardarAntes())) return;
    setOcupado(true);
    try {
      const d = await pedir('/api/compras-nota', enviar({ idcompra: compra.idcompra, accion: 'origen', idcompra_origen: Number(elegida) }));
      ctx.notificar('ok', d.mensaje);
      setElegida('');
      await ctx.recargar();
    } catch (e) {
      ctx.notificar('error', (e as Error).message);
    } finally {
      setOcupado(false);
    }
  };

  const abrirCarga = useCallback(async () => {
    if (!compra) return;
    try {
      const d = await pedir(`/api/compras-nota?idcompra=${compra.idcompra}`);
      const filas: LineaOrigen[] = d.lineas || [];
      setLineas(filas);
      setSeleccion(
        Object.fromEntries(
          filas.map((l) => [
            l.iddetalle,
            {
              marcada: false,
              ajuste: !esCredito,
              cantidad: String(Math.max(l.disponible - l.en_esta_nota, 0)),
              costo: esCredito ? String(Number(l.costo_unitario)) : '',
            },
          ])
        )
      );
      setDialogo(true);
    } catch (e) {
      ctx.notificar('error', (e as Error).message);
    }
  }, [compra, esCredito, ctx]);

  const cargar = async () => {
    if (!compra) return;
    const pedidas = lineas
      .filter((l) => seleccion[l.iddetalle]?.marcada)
      .map((l) => ({
        iddetalle_origen: l.iddetalle,
        cantidad: Number(seleccion[l.iddetalle].cantidad) || 0,
        costo_unitario: Number(seleccion[l.iddetalle].costo) || 0,
        ajuste_precio: seleccion[l.iddetalle].ajuste,
      }));
    if (!pedidas.length) {
      ctx.notificar('error', 'Marque al menos una línea');
      return;
    }
    setOcupado(true);
    try {
      const d = await pedir('/api/compras-nota', enviar({ idcompra: compra.idcompra, accion: 'cargar', lineas: pedidas }));
      ctx.notificar('ok', d.mensaje);
      setDialogo(false);
      await ctx.recargar();
    } catch (e) {
      ctx.notificar('error', (e as Error).message);
    } finally {
      setOcupado(false);
    }
  };

  const fijar = (id: number, parcial: Partial<Seleccion>) =>
    setSeleccion((s) => ({ ...s, [id]: { ...s[id], ...parcial, marcada: parcial.marcada ?? true } }));

  if (!compra) return null;

  return (
    <div className="flex flex-col gap-1.5 px-2 pt-2">
      <div className="flex items-center gap-1.5 text-xs">
        <span className={UI.denseLabel}>Factura original{esBorrador && <span className="text-amber-600"> *</span>}</span>
        <span className={`${UI.denseMono} ${compra.idcompra_origen ? 'text-foreground' : 'text-amber-700 dark:text-amber-400'}`}>
          {compra.idcompra_origen ? compra.origen_numero || `Compra #${compra.idcompra_origen}` : 'Sin elegir'}
        </span>
      </div>
      {esBorrador && (
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-1">
          <select
            aria-label="Factura original"
            className={`${UI.denseSelect} min-w-0`}
            disabled={!compra.idproveedor || ocupado}
            value={elegida}
            onChange={(e) => setElegida(e.target.value)}
          >
            <option value="">{compra.idproveedor ? `Facturas registradas (${facturas.length})` : 'Elija primero el proveedor'}</option>
            {facturas.map((f) => (
              <option key={f.idcompra} value={f.idcompra}>
                {f.numero_factura || f.numero_interno} · {fechaInput(f.fecha_emision)} · ${fmt2(f.total_pagar)}
              </option>
            ))}
          </select>
          <button type="button" className={UI.denseBtn} disabled={!elegida || ocupado} onClick={asignar}>
            Asignar
          </button>
          <button
            type="button"
            className={UI.denseBtnPrimary}
            disabled={!compra.idcompra_origen || ocupado}
            onClick={abrirCarga}
            title="Copiar líneas de la factura original con la cantidad a devolver"
          >
            <ListPlus className="w-3.5 h-3.5" /> Cargar líneas
          </button>
        </div>
      )}

      {dialogo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-label="Cargar líneas de la factura">
          <div className={`${UI.densePanel} w-full max-w-4xl max-h-[85vh] flex flex-col`}>
            <div className={`${UI.densePanelTitle} flex items-center gap-2`}>
              <span>Líneas de {compra.origen_numero || 'la factura original'}</span>
              <button type="button" className="ml-auto text-muted-foreground hover:text-foreground" onClick={() => setDialogo(false)} aria-label="Cerrar">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="px-3 pt-2 text-[11px] text-muted-foreground">
              {esCredito
                ? 'Devolución: resta del inventario solo en las líneas de inventario; express y gastos quedan solo en contabilidad. Rebaja de precio: no devuelve producto; el costo es el monto que se rebaja por unidad.'
                : 'Nota de débito: cada línea suma el monto unitario indicado; no mueve inventario.'}
            </p>
            <div className="flex-1 overflow-auto p-2">
              <table className={UI.denseTable}>
                <thead>
                  <tr>
                    <th className={UI.denseTh} />
                    <th className={`${UI.denseTh} text-right`}>No.</th>
                    <th className={UI.denseTh}>Tipo</th>
                    <th className={`${UI.denseTh} w-full`}>Descripción</th>
                    <th className={`${UI.denseTh} text-right`}>Comprado</th>
                    <th className={`${UI.denseTh} text-right`} title="Devuelto en otras notas registradas">Devuelto</th>
                    <th className={`${UI.denseTh} text-right`} title="Ya cargado en esta nota">En esta</th>
                    {esCredito && <th className={UI.denseTh}>Clase</th>}
                    <th className={`${UI.denseTh} text-right`}>Cantidad</th>
                    <th className={`${UI.denseTh} text-right`}>Costo unit.</th>
                  </tr>
                </thead>
                <tbody>
                  {lineas.map((l) => {
                    const s = seleccion[l.iddetalle];
                    const tope = s?.ajuste ? l.comprado : Math.max(l.disponible - l.en_esta_nota, 0);
                    const sinSaldo = !s?.ajuste && tope <= 0;
                    return (
                      <tr key={l.iddetalle} className={s?.marcada ? UI.denseRowActive : UI.denseRow}>
                        <td className={UI.denseTd}>
                          <input
                            type="checkbox"
                            className="accent-primary"
                            aria-label={`Cargar línea ${l.numero_linea}`}
                            checked={Boolean(s?.marcada)}
                            disabled={sinSaldo}
                            onChange={(e) => fijar(l.iddetalle, { marcada: e.target.checked })}
                          />
                        </td>
                        <td className={`${UI.denseTd} ${UI.denseMono} text-right`}>{l.numero_linea}</td>
                        <td className={`${UI.denseTd} text-[10px] font-semibold uppercase`}>
                          {l.destino ? NOMBRE_DESTINO[l.destino] || l.destino : '—'}
                        </td>
                        <td className={`${UI.denseTd} max-w-0 truncate`} title={l.descripcion}>{l.descripcion}</td>
                        <td className={`${UI.denseTd} ${UI.denseMono} text-right`}>{Number(l.comprado)}</td>
                        <td className={`${UI.denseTd} ${UI.denseMono} text-right`}>{Number(l.devuelto) || ''}</td>
                        <td className={`${UI.denseTd} ${UI.denseMono} text-right`}>{Number(l.en_esta_nota) || ''}</td>
                        {esCredito && (
                          <td className={UI.denseTd}>
                            <select
                              aria-label="Clase de línea"
                              className={`${UI.denseSelect} h-6`}
                              value={s?.ajuste ? 'ajuste' : 'devolucion'}
                              onChange={(e) => {
                                const ajuste = e.target.value === 'ajuste';
                                fijar(l.iddetalle, {
                                  ajuste,
                                  costo: ajuste ? '' : String(Number(l.costo_unitario)),
                                  cantidad: ajuste ? String(Number(l.comprado)) : String(Math.max(l.disponible - l.en_esta_nota, 0)),
                                });
                              }}
                            >
                              <option value="devolucion">Devolución</option>
                              <option value="ajuste">Rebaja de precio</option>
                            </select>
                          </td>
                        )}
                        <td className={UI.denseTd}>
                          <input
                            type="number"
                            step="any"
                            min={0}
                            max={tope}
                            aria-label="Cantidad"
                            className={`${UI.denseInput} ${UI.denseMono} h-6 w-20 text-right`}
                            value={s?.cantidad ?? ''}
                            title={`Máximo ${tope}`}
                            onChange={(e) => fijar(l.iddetalle, { cantidad: e.target.value })}
                          />
                        </td>
                        <td className={UI.denseTd}>
                          <input
                            type="number"
                            step="any"
                            min={0}
                            aria-label="Costo unitario"
                            className={`${UI.denseInput} ${UI.denseMono} h-6 w-24 text-right`}
                            value={s?.costo ?? ''}
                            placeholder={s?.ajuste ? 'Monto' : fmt4(l.costo_unitario)}
                            onChange={(e) => fijar(l.iddetalle, { costo: e.target.value })}
                          />
                        </td>
                      </tr>
                    );
                  })}
                  {lineas.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-3 py-6 text-center text-[11px] text-muted-foreground">
                        La factura original no tiene líneas.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2 px-3 py-2 border-t border-border">
              <button type="button" className={UI.denseBtn} onClick={() => setDialogo(false)}>
                Cancelar
              </button>
              <button type="button" className={UI.denseBtnPrimary} onClick={cargar} disabled={ocupado}>
                <ListPlus className="w-3.5 h-3.5" /> Cargar marcadas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
