'use client';
import { confirmar } from '@/components/ui/avisos';

import { useState } from 'react';
import { ClipboardCheck, Trash2 } from 'lucide-react';
import { UI } from '@/lib/ui';
import { ESTADOS_TEXTO, MOMENTOS_ESTADO } from '@/lib/taller-constantes';
import { Insignia, fecha, fmt, hoyISO, type Fila } from '../../_components/comun';
import { COLOR_ESTADO, type Accion, type DetalleVehiculo } from './tipos';

type Revision = { estado_visual: string; estado_texto: string; comentario: string };
const REVISION_VACIA: Revision = { estado_visual: '', estado_texto: '', comentario: '' };

export function PanelEstados({
  detalle,
  empleados,
  accion,
}: {
  detalle: DetalleVehiculo;
  empleados: Fila[];
  accion: Accion;
}) {
  const instaladas = detalle.partes.filter((p) => p.estado_instalacion === 'INSTALADA');
  const [cabecera, setCabecera] = useState({
    momento: 'ENTRADA',
    fecha: hoyISO(),
    kilometraje: detalle.vehiculo.odometro_actual ? String(detalle.vehiculo.odometro_actual) : '',
    idempleado: '',
    idorden: '',
  });
  const [filas, setFilas] = useState<Record<number, Revision>>({});
  const [filtroParte, setFiltroParte] = useState('');

  const cambiar = (idparte: number, campo: keyof Revision, valor: string) =>
    setFilas({ ...filas, [idparte]: { ...(filas[idparte] ?? REVISION_VACIA), [campo]: valor } });

  const conCambios = Object.entries(filas).filter(([, r]) => r.estado_visual || r.estado_texto || r.comentario.trim());

  const guardar = async () => {
    const registros = conCambios.map(([idparte, r]) => ({ idparte: Number(idparte), momento: cabecera.momento, ...r }));
    const ok = await accion('/api/estado-partes', 'POST', { ...cabecera, registros });
    if (ok) setFilas({});
  };

  const historial = detalle.estados.filter((e) => !filtroParte || String(e.idparte) === filtroParte);

  return (
    <div className="flex flex-col gap-2">
      <div className={UI.densePanel}>
        <div className={UI.densePanelTitle}>Registrar revisión</div>
        <div className="grid gap-2 p-3 sm:grid-cols-3 xl:grid-cols-[repeat(5,minmax(0,1fr))_auto] items-end border-b border-border">
          <label className="flex flex-col gap-1">
            <span className={UI.denseLabel}>Momento</span>
            <select className={UI.denseSelect} value={cabecera.momento} onChange={(e) => setCabecera({ ...cabecera, momento: e.target.value })}>
              {MOMENTOS_ESTADO.map((m) => (
                <option key={m} value={m} title={m === 'ENTRADA' ? 'Al recibir el vehículo' : 'Al entregar el vehículo'}>
                  {m === 'ENTRADA' ? 'Entrada' : 'Salida'}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={UI.denseLabel}>Fecha</span>
            <input type="date" className={UI.denseInput} value={cabecera.fecha} onChange={(e) => setCabecera({ ...cabecera, fecha: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={UI.denseLabel}>Kilometraje</span>
            <input
              type="number"
              className={`${UI.denseInput} text-right ${UI.denseMono}`}
              value={cabecera.kilometraje}
              onChange={(e) => setCabecera({ ...cabecera, kilometraje: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={UI.denseLabel}>Revisó</span>
            <select className={UI.denseSelect} value={cabecera.idempleado} onChange={(e) => setCabecera({ ...cabecera, idempleado: e.target.value })}>
              <option value="">—</option>
              {empleados.map((e) => (
                <option key={String(e.id)} value={String(e.id)}>
                  {String(e.nombre)} {String(e.apellido)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={UI.denseLabel}>Orden de trabajo</span>
            <select className={UI.denseSelect} value={cabecera.idorden} onChange={(e) => setCabecera({ ...cabecera, idorden: e.target.value })}>
              <option value="">Sin orden</option>
              {detalle.ordenes.map((o) => (
                <option key={String(o.id)} value={String(o.id)}>
                  {String(o.numero_orden)} · {String(o.estado)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={`${UI.denseBtnPrimary} justify-center whitespace-nowrap`}
            disabled={conCambios.length === 0}
            onClick={guardar}
          >
            <ClipboardCheck className="h-3.5 w-3.5" /> Guardar revisión ({conCambios.length})
          </button>
        </div>
        {instaladas.length === 0 ? (
          <p className="p-3 text-xs text-muted-foreground">Agregue primero las partes del vehículo en la pestaña Partes.</p>
        ) : (
          <div className="overflow-auto max-h-[22rem]">
            <table className={UI.denseTable}>
              <thead>
                <tr>
                  <th className={UI.denseTh}>Sistema</th>
                  <th className={UI.denseTh}>Parte</th>
                  <th className={UI.denseTh}>Último estado</th>
                  <th className={UI.denseTh}>Visual 1–10</th>
                  <th className={UI.denseTh}>Estado</th>
                  <th className={`${UI.denseTh} w-full`}>Comentario</th>
                </tr>
              </thead>
              <tbody>
                {instaladas.map((p) => {
                  const r = filas[p.idparte];
                  return (
                    <tr key={p.idparte} className={r && (r.estado_visual || r.estado_texto) ? 'bg-primary/5' : ''}>
                      <td className={`${UI.denseTd} text-muted-foreground`}>{p.sistema_nombre}</td>
                      <td className={UI.denseTd}>
                        {p.nombre_parte}
                        {p.posicion && <span className="text-muted-foreground"> · {p.posicion}</span>}
                      </td>
                      <td className={UI.denseTd}>
                        {p.ultimo_estado ? (
                          <Insignia texto={`${p.ultimo_estado}${p.ultimo_visual != null ? ` ${p.ultimo_visual}` : ''}`} color={COLOR_ESTADO[p.ultimo_estado] ?? ''} />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className={UI.denseTd}>
                        <select
                          aria-label={`Visual ${p.nombre_parte}`}
                          className={`${UI.denseSelect} w-16`}
                          value={r?.estado_visual ?? ''}
                          onChange={(e) => cambiar(p.idparte, 'estado_visual', e.target.value)}
                        >
                          <option value="">—</option>
                          {Array.from({ length: 10 }, (_, i) => 10 - i).map((n) => (
                            <option key={n}>{n}</option>
                          ))}
                        </select>
                      </td>
                      <td className={UI.denseTd}>
                        <select
                          aria-label={`Estado ${p.nombre_parte}`}
                          className={UI.denseSelect}
                          value={r?.estado_texto ?? ''}
                          onChange={(e) => cambiar(p.idparte, 'estado_texto', e.target.value)}
                        >
                          <option value="">—</option>
                          {ESTADOS_TEXTO.map((t) => (
                            <option key={t}>{t}</option>
                          ))}
                        </select>
                      </td>
                      <td className={UI.denseTd}>
                        <input
                          aria-label={`Comentario ${p.nombre_parte}`}
                          className={`${UI.denseInput} w-full min-w-[8rem]`}
                          value={r?.comentario ?? ''}
                          onChange={(e) => cambiar(p.idparte, 'comentario', e.target.value)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="px-3 py-1.5 border-t border-border text-[11px] text-muted-foreground">
          Solo se guardan las partes a las que les puso estado o comentario; las demás quedan con su última revisión.
        </p>
      </div>

      <div className={UI.densePanel}>
        <div className={`${UI.densePanelTitle} flex items-center justify-between gap-2`}>
          <span>Historial ({historial.length})</span>
          <select
            aria-label="Filtrar por parte"
            className={`${UI.denseSelect} normal-case tracking-normal font-normal`}
            value={filtroParte}
            onChange={(e) => setFiltroParte(e.target.value)}
          >
            <option value="">Todas las partes</option>
            {detalle.partes.map((p) => (
              <option key={p.idparte} value={String(p.idparte)}>
                {p.sistema_nombre} · {p.nombre_parte}
                {p.estado_instalacion === 'RETIRADA' ? ' (retirada)' : ''}
              </option>
            ))}
          </select>
        </div>
        {historial.length === 0 ? (
          <p className="p-3 text-xs text-muted-foreground">Sin revisiones registradas.</p>
        ) : (
          <div className="overflow-auto max-h-[24rem]">
            <table className={UI.denseTable}>
              <thead>
                <tr>
                  <th className={UI.denseTh}>Fecha</th>
                  <th className={UI.denseTh}>Momento</th>
                  <th className={UI.denseTh}>Parte</th>
                  <th className={UI.denseTh}>Estado</th>
                  <th className={`${UI.denseTh} text-right`}>Km</th>
                  <th className={UI.denseTh}>Revisó</th>
                  <th className={UI.denseTh}>Orden</th>
                  <th className={UI.denseTh}>Comentario</th>
                  <th className={UI.denseTh} />
                </tr>
              </thead>
              <tbody>
                {historial.map((e) => (
                  <tr key={String(e.idestado)}>
                    <td className={`${UI.denseTd} ${UI.denseMono}`}>{fecha(e.fecha)}</td>
                    <td className={UI.denseTd}>{String(e.momento)}</td>
                    <td className={UI.denseTd}>
                      <span className="text-muted-foreground">{String(e.sistema_nombre)} · </span>
                      {String(e.nombre_parte)}
                    </td>
                    <td className={UI.denseTd}>
                      <span className="inline-flex items-center gap-1.5">
                        <Insignia texto={String(e.estado_texto)} color={COLOR_ESTADO[String(e.estado_texto)] ?? ''} />
                        {e.estado_visual != null && <span className={`${UI.denseMono} font-semibold`}>{String(e.estado_visual)}/10</span>}
                      </span>
                    </td>
                    <td className={`${UI.denseTd} ${UI.denseMono} text-right`}>{e.kilometraje != null ? fmt(e.kilometraje) : ''}</td>
                    <td className={UI.denseTd}>{String(e.empleado_nombre ?? '')}</td>
                    <td className={`${UI.denseTd} ${UI.denseMono}`}>{String(e.numero_orden ?? '')}</td>
                    <td className={`${UI.denseTd} whitespace-normal min-w-[10rem]`}>{String(e.comentario ?? '')}</td>
                    <td className={`${UI.denseTd} text-right`}>
                      <button
                        type="button"
                        className={UI.denseBtnDanger}
                        aria-label="Eliminar revisión"
                        onClick={async () => {
                          if ((await confirmar('¿Eliminar esta revisión?'))) await accion(`/api/estado-partes?id=${e.idestado}`, 'DELETE');
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
