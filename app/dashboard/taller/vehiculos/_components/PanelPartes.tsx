'use client';

import { Fragment, useState } from 'react';
import { ArrowRightLeft, Pencil, Plus, Trash2, Undo2 } from 'lucide-react';
import { UI } from '@/lib/ui';
import { Insignia, fecha, fmt, hoyISO } from '../../_components/comun';
import { COLOR_ESTADO, type Accion, type DetalleVehiculo, type Parte, type Sistema } from './tipos';

type Modo = 'editar' | 'reemplazar' | 'retirar';
type Valores = Record<string, string>;

const VACIA: Valores = {
  idsistema: '',
  nombre_parte: '',
  posicion: '',
  marca: '',
  referencia: '',
  numero_serie: '',
  fecha_instalacion: '',
  km_instalacion: '',
  comentario: '',
};

function Entrada({
  etiqueta,
  valor,
  onCambio,
  tipo = 'text',
  className = '',
}: {
  etiqueta: string;
  valor: string;
  onCambio: (v: string) => void;
  tipo?: string;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className={UI.denseLabel}>{etiqueta}</span>
      <input
        type={tipo}
        className={`${UI.denseInput} ${tipo === 'number' ? `text-right ${UI.denseMono}` : ''}`}
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
      />
    </label>
  );
}

export function PanelPartes({
  detalle,
  sistemas,
  accion,
}: {
  detalle: DetalleVehiculo;
  sistemas: Sistema[];
  accion: Accion;
}) {
  const odometro = detalle.vehiculo.odometro_actual ? String(detalle.vehiculo.odometro_actual) : '';
  const [nueva, setNueva] = useState<Valores | null>(null);
  const [verRetiradas, setVerRetiradas] = useState(false);
  const [op, setOp] = useState<{ parte: Parte; modo: Modo; v: Valores } | null>(null);

  const partes = detalle.partes.filter((p) => verRetiradas || p.estado_instalacion === 'INSTALADA');
  const retiradas = detalle.partes.length - detalle.partes.filter((p) => p.estado_instalacion === 'INSTALADA').length;
  const grupos = partes.reduce<Record<string, Parte[]>>((acc, p) => {
    (acc[p.sistema_nombre] ??= []).push(p);
    return acc;
  }, {});

  const abrir = (parte: Parte, modo: Modo) => {
    const base: Valores =
      modo === 'editar'
        ? {
            idsistema: String(parte.idsistema),
            nombre_parte: parte.nombre_parte,
            posicion: parte.posicion ?? '',
            marca: parte.marca ?? '',
            referencia: parte.referencia ?? '',
            numero_serie: parte.numero_serie ?? '',
            fecha_instalacion: fecha(parte.fecha_instalacion),
            km_instalacion: parte.km_instalacion != null ? String(parte.km_instalacion) : '',
            comentario: parte.comentario ?? '',
          }
        : { fecha: hoyISO(), km: odometro, marca: '', referencia: '', numero_serie: '', comentario: '' };
    setOp({ parte, modo, v: base });
  };

  const confirmar = async () => {
    if (!op) return;
    const { parte, modo, v } = op;
    const ok =
      modo === 'editar'
        ? await accion('/api/vehiculo-partes', 'PUT', { idparte: parte.idparte, ...v })
        : await accion('/api/vehiculo-partes', 'POST', { accion: modo, idparte: parte.idparte, ...v });
    if (ok) setOp(null);
  };

  const cambiarOp = (campo: string, valor: string) => op && setOp({ ...op, v: { ...op.v, [campo]: valor } });

  return (
    <div className={`${UI.densePanel} flex flex-col min-h-0`}>
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-border">
        <button
          type="button"
          className={UI.denseBtnPrimary}
          onClick={() => setNueva(nueva ? null : { ...VACIA, fecha_instalacion: hoyISO(), km_instalacion: odometro })}
        >
          <Plus className="h-3.5 w-3.5" /> Agregar parte
        </button>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" className="accent-primary" checked={verRetiradas} onChange={(e) => setVerRetiradas(e.target.checked)} />
          Mostrar retiradas ({retiradas})
        </label>
        <span className="ml-auto text-[11px] text-muted-foreground">
          Un reemplazo agrega la pieza nueva y deja la anterior como retirada, con su fecha y kilometraje.
        </span>
      </div>

      {nueva && (
        <div className="grid gap-2 p-3 border-b border-border bg-muted/30 sm:grid-cols-2 xl:grid-cols-5">
          <label className="flex flex-col gap-1">
            <span className={UI.denseLabel}>Sistema *</span>
            <select className={UI.denseSelect} value={nueva.idsistema} onChange={(e) => setNueva({ ...nueva, idsistema: e.target.value })}>
              <option value="">—</option>
              {sistemas.map((s) => (
                <option key={s.idsistema} value={s.idsistema}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </label>
          <Entrada etiqueta="Parte *" valor={nueva.nombre_parte} onCambio={(v) => setNueva({ ...nueva, nombre_parte: v })} className="xl:col-span-2" />
          <Entrada etiqueta="Posición" valor={nueva.posicion} onCambio={(v) => setNueva({ ...nueva, posicion: v })} />
          <Entrada etiqueta="Marca" valor={nueva.marca} onCambio={(v) => setNueva({ ...nueva, marca: v })} />
          <Entrada etiqueta="Referencia" valor={nueva.referencia} onCambio={(v) => setNueva({ ...nueva, referencia: v })} />
          <Entrada etiqueta="N.º de serie" valor={nueva.numero_serie} onCambio={(v) => setNueva({ ...nueva, numero_serie: v })} />
          <Entrada etiqueta="Instalada el" tipo="date" valor={nueva.fecha_instalacion} onCambio={(v) => setNueva({ ...nueva, fecha_instalacion: v })} />
          <Entrada etiqueta="Km al instalar" tipo="number" valor={nueva.km_instalacion} onCambio={(v) => setNueva({ ...nueva, km_instalacion: v })} />
          <div className="flex items-end gap-1.5">
            <button
              type="button"
              className={UI.denseBtnPrimary}
              onClick={async () => {
                if (await accion('/api/vehiculo-partes', 'POST', { idvehiculo: detalle.vehiculo.id, ...nueva })) setNueva(null);
              }}
            >
              Guardar
            </button>
            <button type="button" className={UI.denseBtn} onClick={() => setNueva(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="overflow-auto min-h-0">
        {partes.length === 0 ? (
          <p className="p-4 text-xs text-center text-muted-foreground">
            Sin partes registradas. Documente las piezas que el taller revisa o cambia (por ejemplo, Frenos → resorte de fricción).
          </p>
        ) : (
          <table className={UI.denseTable}>
            <thead>
              <tr>
                <th className={UI.denseTh}>Parte</th>
                <th className={UI.denseTh}>Posición</th>
                <th className={UI.denseTh}>Marca / referencia</th>
                <th className={UI.denseTh}>Instalada</th>
                <th className={UI.denseTh}>Último estado</th>
                <th className={`${UI.denseTh} right-0 z-20`} />
              </tr>
            </thead>
            <tbody>
              {Object.entries(grupos).map(([sistema, lista]) => (
                <Fragment key={sistema}>
                  <tr>
                    <td colSpan={6} className="px-2 py-1 border-t border-border bg-muted/50 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {sistema}
                    </td>
                  </tr>
                  {lista.map((p) => {
                    const retirada = p.estado_instalacion === 'RETIRADA';
                    const abierta = op?.parte.idparte === p.idparte;
                    return (
                      <Fragment key={p.idparte}>
                        <tr className={retirada ? 'opacity-55' : ''}>
                          <td className={UI.denseTd}>
                            <span className="font-medium">{p.nombre_parte}</span>
                            {retirada && <Insignia texto="RETIRADA" color="ml-1.5 bg-muted text-muted-foreground" />}
                            {p.reemplaza_a && !retirada && (
                              <span className="ml-1.5 text-[10px] text-muted-foreground" title={`Reemplazó a: ${p.reemplaza_nombre ?? ''}`}>
                                reemplazo
                              </span>
                            )}
                            {p.producto_nombre && <div className="text-[10px] text-muted-foreground">Inventario: {p.producto_nombre}</div>}
                          </td>
                          <td className={UI.denseTd}>{p.posicion ?? ''}</td>
                          <td className={UI.denseTd}>
                            {[p.marca, p.referencia].filter(Boolean).join(' · ')}
                            {p.numero_serie && <div className="text-[10px] text-muted-foreground">S/N {p.numero_serie}</div>}
                          </td>
                          <td className={`${UI.denseTd} ${UI.denseMono}`}>
                            {fecha(p.fecha_instalacion) || '—'}
                            {p.km_instalacion != null && <div className="text-[10px] text-muted-foreground">{fmt(p.km_instalacion)} km</div>}
                            {retirada && (
                              <div className="text-[10px] text-muted-foreground">
                                retirada {fecha(p.fecha_retiro)}
                                {p.km_retiro != null && ` · ${fmt(p.km_retiro)} km`}
                              </div>
                            )}
                          </td>
                          <td className={UI.denseTd}>
                            {p.ultimo_estado ? (
                              <span className="inline-flex items-center gap-1.5" title={`Revisada el ${fecha(p.ultima_revision)}`}>
                                <Insignia texto={p.ultimo_estado} color={COLOR_ESTADO[p.ultimo_estado] ?? ''} />
                                {p.ultimo_visual != null && <span className={`${UI.denseMono} font-semibold`}>{p.ultimo_visual}/10</span>}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Sin revisar</span>
                            )}
                          </td>
                          <td className={`${UI.denseTd} text-right sticky right-0 bg-card`}>
                            <div className="inline-flex gap-1">
                              <button type="button" className={UI.denseBtn} title="Editar" onClick={() => abrir(p, 'editar')}>
                                <Pencil className="h-3 w-3" />
                              </button>
                              {!retirada && (
                                <>
                                  <button type="button" className={UI.denseBtn} onClick={() => abrir(p, 'reemplazar')}>
                                    <ArrowRightLeft className="h-3 w-3" /> Reemplazar
                                  </button>
                                  <button type="button" className={UI.denseBtn} title="Retirar sin reemplazo" onClick={() => abrir(p, 'retirar')}>
                                    <Undo2 className="h-3 w-3" />
                                  </button>
                                </>
                              )}
                              <button
                                type="button"
                                className={UI.denseBtnDanger}
                                title="Eliminar (solo errores de captura)"
                                onClick={async () => {
                                  if (confirm(`¿Eliminar ${p.nombre_parte}? Úselo solo para corregir errores de captura.`)) {
                                    await accion(`/api/vehiculo-partes?id=${p.idparte}`, 'DELETE');
                                  }
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {abierta && op && (
                          <tr>
                            <td colSpan={6} className="px-2 py-2 border-t border-border bg-muted/30">
                              <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6 items-end">
                                <span className="text-xs font-semibold sm:col-span-3 xl:col-span-6">
                                  {op.modo === 'editar' && `Editar ${p.nombre_parte}`}
                                  {op.modo === 'reemplazar' && `Reemplazar ${p.nombre_parte}: datos de la pieza nueva`}
                                  {op.modo === 'retirar' && `Retirar ${p.nombre_parte} sin reemplazo`}
                                </span>
                                {op.modo === 'editar' ? (
                                  <>
                                    <label className="flex flex-col gap-1">
                                      <span className={UI.denseLabel}>Sistema</span>
                                      <select className={UI.denseSelect} value={op.v.idsistema} onChange={(e) => cambiarOp('idsistema', e.target.value)}>
                                        {sistemas.map((s) => (
                                          <option key={s.idsistema} value={s.idsistema}>
                                            {s.nombre}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                    <Entrada etiqueta="Parte" valor={op.v.nombre_parte} onCambio={(v) => cambiarOp('nombre_parte', v)} />
                                    <Entrada etiqueta="Posición" valor={op.v.posicion} onCambio={(v) => cambiarOp('posicion', v)} />
                                    <Entrada etiqueta="Instalada el" tipo="date" valor={op.v.fecha_instalacion} onCambio={(v) => cambiarOp('fecha_instalacion', v)} />
                                    <Entrada etiqueta="Km al instalar" tipo="number" valor={op.v.km_instalacion} onCambio={(v) => cambiarOp('km_instalacion', v)} />
                                  </>
                                ) : (
                                  <>
                                    <Entrada etiqueta="Fecha" tipo="date" valor={op.v.fecha} onCambio={(v) => cambiarOp('fecha', v)} />
                                    <Entrada etiqueta="Kilometraje" tipo="number" valor={op.v.km} onCambio={(v) => cambiarOp('km', v)} />
                                  </>
                                )}
                                {op.modo !== 'retirar' && (
                                  <>
                                    <Entrada etiqueta="Marca" valor={op.v.marca} onCambio={(v) => cambiarOp('marca', v)} />
                                    <Entrada etiqueta="Referencia" valor={op.v.referencia} onCambio={(v) => cambiarOp('referencia', v)} />
                                    <Entrada etiqueta="N.º de serie" valor={op.v.numero_serie} onCambio={(v) => cambiarOp('numero_serie', v)} />
                                  </>
                                )}
                                <Entrada etiqueta="Comentario" valor={op.v.comentario} onCambio={(v) => cambiarOp('comentario', v)} className="sm:col-span-2" />
                                <div className="flex gap-1.5">
                                  <button type="button" className={UI.denseBtnPrimary} onClick={confirmar}>
                                    {op.modo === 'editar' ? 'Guardar' : op.modo === 'reemplazar' ? 'Reemplazar' : 'Retirar'}
                                  </button>
                                  <button type="button" className={UI.denseBtn} onClick={() => setOp(null)}>
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
