'use client';
import { confirmar } from '@/components/ui/avisos';

import { useState } from 'react';
import { CheckCheck, Plus, Trash2 } from 'lucide-react';
import { UI } from '@/lib/ui';
import { estadoRecordatorio } from '@/lib/taller-constantes';
import { COLOR_AVISO, InputBlur, Insignia, fecha, fmt, hoyISO } from '../../_components/comun';
import type { Accion, DetalleVehiculo, Sistema } from './tipos';

const VACIO = { descripcion: '', idsistema: '', idparte: '', intervalo_dias: '', intervalo_km: '', ultimo_fecha: '', ultimo_km: '' };

export function PanelRecordatorios({
  detalle,
  sistemas,
  accion,
}: {
  detalle: DetalleVehiculo;
  sistemas: Sistema[];
  accion: Accion;
}) {
  const [nuevo, setNuevo] = useState<typeof VACIO | null>(null);
  const odometro = detalle.vehiculo.odometro_actual ?? null;
  const instaladas = detalle.partes.filter((p) => p.estado_instalacion === 'INSTALADA');
  const editar = (id: number, campo: string, valor: string) =>
    accion('/api/recordatorios', 'PUT', { idrecordatorio: id, [campo]: valor });

  return (
    <div className={UI.densePanel}>
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-border">
        <button
          type="button"
          className={UI.denseBtnPrimary}
          onClick={() => setNuevo(nuevo ? null : { ...VACIO, ultimo_fecha: hoyISO(), ultimo_km: odometro ? String(odometro) : '' })}
        >
          <Plus className="h-3.5 w-3.5" /> Nuevo recordatorio
        </button>
        <span className="ml-auto text-[11px] text-muted-foreground">
          Vence por fecha o por kilometraje, lo que llegue primero. Odómetro actual: {odometro != null ? `${fmt(odometro)} km` : 'sin dato'}.
        </span>
      </div>

      {nuevo && (
        <div className="grid gap-2 p-3 border-b border-border bg-muted/30 sm:grid-cols-3 xl:grid-cols-7 items-end">
          <label className="flex flex-col gap-1 sm:col-span-3 xl:col-span-2">
            <span className={UI.denseLabel}>Descripción *</span>
            <input
              className={UI.denseInput}
              placeholder="Cambio de aceite de motor"
              value={nuevo.descripcion}
              onChange={(e) => setNuevo({ ...nuevo, descripcion: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={UI.denseLabel}>Sistema</span>
            <select className={UI.denseSelect} value={nuevo.idsistema} onChange={(e) => setNuevo({ ...nuevo, idsistema: e.target.value })}>
              <option value="">—</option>
              {sistemas.map((s) => (
                <option key={s.idsistema} value={s.idsistema}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={UI.denseLabel}>Parte</span>
            <select
              className={UI.denseSelect}
              value={nuevo.idparte}
              onChange={(e) => {
                const parte = instaladas.find((p) => String(p.idparte) === e.target.value);
                setNuevo({ ...nuevo, idparte: e.target.value, idsistema: parte ? String(parte.idsistema) : nuevo.idsistema });
              }}
            >
              <option value="">—</option>
              {instaladas.map((p) => (
                <option key={p.idparte} value={p.idparte}>
                  {p.nombre_parte}
                  {p.posicion ? ` · ${p.posicion}` : ''}
                </option>
              ))}
            </select>
          </label>
          {(
            [
              ['intervalo_dias', 'Cada (días)', 'number'],
              ['intervalo_km', 'Cada (km)', 'number'],
              ['ultimo_fecha', 'Último cambio', 'date'],
              ['ultimo_km', 'Km del último cambio', 'number'],
            ] as const
          ).map(([campo, etiqueta, tipo]) => (
            <label key={campo} className="flex flex-col gap-1">
              <span className={UI.denseLabel}>{etiqueta}</span>
              <input
                type={tipo}
                className={`${UI.denseInput} ${tipo === 'number' ? `text-right ${UI.denseMono}` : ''}`}
                value={nuevo[campo]}
                onChange={(e) => setNuevo({ ...nuevo, [campo]: e.target.value })}
              />
            </label>
          ))}
          <div className="flex gap-1.5">
            <button
              type="button"
              className={UI.denseBtnPrimary}
              onClick={async () => {
                if (await accion('/api/recordatorios', 'POST', { idvehiculo: detalle.vehiculo.id, ...nuevo })) setNuevo(null);
              }}
            >
              Guardar
            </button>
            <button type="button" className={UI.denseBtn} onClick={() => setNuevo(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {detalle.recordatorios.length === 0 ? (
        <p className="p-4 text-xs text-center text-muted-foreground">Sin recordatorios. Agregue los mantenimientos periódicos del vehículo.</p>
      ) : (
        <div className="overflow-auto">
          <table className={UI.denseTable}>
            <thead>
              <tr>
                <th className={UI.denseTh}>Estado</th>
                <th className={UI.denseTh}>Mantenimiento</th>
                <th className={UI.denseTh}>Cada · días / km</th>
                <th className={UI.denseTh}>Último cambio · fecha / km</th>
                <th className={UI.denseTh}>Próximo</th>
                <th className={`${UI.denseTh} right-0 z-20`} />
              </tr>
            </thead>
            <tbody>
              {detalle.recordatorios.map((r) => {
                const estado = r.activo ? estadoRecordatorio(r.proximo_fecha, r.proximo_km, odometro) : 'INACTIVO';
                return (
                  <tr key={r.idrecordatorio} className={r.activo ? '' : 'opacity-55'}>
                    <td className={UI.denseTd}>
                      <Insignia texto={estado} color={COLOR_AVISO[estado]} />
                    </td>
                    <td className={UI.denseTd}>
                      <InputBlur valor={r.descripcion} className="w-44" onGuardar={(v) => editar(r.idrecordatorio, 'descripcion', v)} />
                      <div className="text-[10px] text-muted-foreground">{[r.sistema_nombre, r.nombre_parte].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td className={UI.denseTd}>
                      <div className="flex gap-1">
                        <InputBlur tipo="number" valor={r.intervalo_dias} className="w-14" onGuardar={(v) => editar(r.idrecordatorio, 'intervalo_dias', v)} />
                        <InputBlur tipo="number" valor={r.intervalo_km} className="w-20" onGuardar={(v) => editar(r.idrecordatorio, 'intervalo_km', v)} />
                      </div>
                    </td>
                    <td className={UI.denseTd}>
                      <div className="flex gap-1">
                        <InputBlur tipo="date" valor={r.ultimo_fecha} className="w-32" onGuardar={(v) => editar(r.idrecordatorio, 'ultimo_fecha', v)} />
                        <InputBlur tipo="number" valor={r.ultimo_km} className="w-20" onGuardar={(v) => editar(r.idrecordatorio, 'ultimo_km', v)} />
                      </div>
                    </td>
                    <td className={`${UI.denseTd} ${UI.denseMono}`}>
                      {fecha(r.proximo_fecha) || '—'}
                      {r.proximo_km != null && <div className="text-[10px] text-muted-foreground">{fmt(r.proximo_km)} km</div>}
                    </td>
                    <td className={`${UI.denseTd} text-right sticky right-0 bg-card`}>
                      <div className="inline-flex items-center gap-1">
                        <label className="flex items-center gap-1 text-[10px] text-muted-foreground mr-1" title="Desactivar sin borrar">
                          <input
                            type="checkbox"
                            className="accent-primary"
                            checked={!!r.activo}
                            onChange={(e) => editar(r.idrecordatorio, 'activo', e.target.checked ? '1' : '0')}
                          />
                          Activo
                        </label>
                        <button
                          type="button"
                          className={UI.denseBtn}
                          title="Marca el cambio como hecho hoy con el odómetro actual"
                          onClick={() => accion('/api/recordatorios', 'POST', { accion: 'realizado', idrecordatorio: r.idrecordatorio })}
                        >
                          <CheckCheck className="h-3 w-3" /> Realizado
                        </button>
                        <button
                          type="button"
                          className={UI.denseBtnDanger}
                          aria-label="Eliminar recordatorio"
                          onClick={async () => {
                            if ((await confirmar(`¿Eliminar el recordatorio "${r.descripcion}"?`))) {
                              await accion(`/api/recordatorios?id=${r.idrecordatorio}`, 'DELETE');
                            }
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
