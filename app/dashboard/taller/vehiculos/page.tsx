'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Plus, Save, Search, Trash2 } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { UI } from '@/lib/ui';
import { UNIDADES_CAPACIDAD, estadoRecordatorio } from '@/lib/taller-constantes';
import {
  BarraTaller,
  COLOR_AVISO,
  Formulario,
  Insignia,
  Toast,
  aValores,
  fecha,
  fmt,
  idDeUrl,
  pedir,
  useAviso,
  type Fila,
  type Seccion,
  type Valores,
} from '../_components/comun';
import { PanelPartes } from './_components/PanelPartes';
import { PanelEstados } from './_components/PanelEstados';
import { PanelRecordatorios } from './_components/PanelRecordatorios';
import { PanelTarjeta } from './_components/PanelTarjeta';
import type { DetalleVehiculo, Sistema } from './_components/tipos';

type Pestana = 'ficha' | 'partes' | 'estados' | 'recordatorios';
const RUTA = '/dashboard/taller/vehiculos';

function secciones(clientes: Fila[]): Seccion[] {
  return [
    {
      titulo: 'Vehículo',
      campos: [
        {
          campo: 'cliente_id',
          etiqueta: 'Cliente',
          tipo: 'select',
          ancho: 2,
          obligatorio: true,
          opciones: clientes.map((c) => ({ valor: String(c.id), etiqueta: `${c.nombre} (${c.codigo})` })),
        },
        { campo: 'placa', etiqueta: 'Placa', placeholder: 'C79371' },
        { campo: 'anio_placa', etiqueta: 'Año de la placa', tipo: 'number', placeholder: '2011' },
        { campo: 'marca', etiqueta: 'Marca', obligatorio: true },
        { campo: 'modelo', etiqueta: 'Modelo', obligatorio: true },
        { campo: 'anio_modelo', etiqueta: 'Año del modelo', tipo: 'number' },
        { campo: 'color', etiqueta: 'Color' },
        { campo: 'clase', etiqueta: 'Clase', placeholder: 'CAMIÓN, PICK UP…' },
        { campo: 'tipo', etiqueta: 'Tipo' },
        { campo: 'vin', etiqueta: 'VIN' },
        { campo: 'numero_motor', etiqueta: 'N.º de motor' },
        { campo: 'numero_chasis', etiqueta: 'N.º de chasis' },
      ],
    },
    {
      titulo: 'Capacidad',
      campos: [
        { campo: 'ejes', etiqueta: 'Ejes', tipo: 'number' },
        { campo: 'tara', etiqueta: 'Tara', tipo: 'number' },
        { campo: 'unidad_capacidad', etiqueta: 'Unidad de capacidad', tipo: 'select', opciones: UNIDADES_CAPACIDAD },
        { campo: 'capacidad_carga', etiqueta: 'Capacidad de carga', tipo: 'number' },
        { campo: 'capacidad_maxima', etiqueta: 'Capacidad máxima', tipo: 'number' },
        { campo: 'traccion', etiqueta: 'Tracción', placeholder: '4X2' },
        { campo: 'odometro_actual', etiqueta: 'Odómetro actual', tipo: 'number' },
        { campo: 'unidad_odometro', etiqueta: 'Unidad del odómetro', tipo: 'select', opciones: ['KM', 'MILLAS'] },
      ],
    },
    {
      titulo: 'Tarjeta de circulación vigente',
      campos: [
        { campo: 'dominio', etiqueta: 'Dominio' },
        { campo: 'en_calidad', etiqueta: 'En calidad de' },
        { campo: 'propietario_nombre', etiqueta: 'Propietario', ancho: 2 },
        { campo: 'propietario_dui', etiqueta: 'DUI del propietario' },
        { campo: 'tarjeta_emision', etiqueta: 'Emisión', tipo: 'date' },
        { campo: 'tarjeta_vencimiento', etiqueta: 'Vencimiento', tipo: 'date' },
        { campo: 'activo', etiqueta: 'Activo', tipo: 'check' },
        { campo: 'propietario_domicilio', etiqueta: 'Domicilio del propietario', ancho: 2 },
        { campo: 'notas', etiqueta: 'Notas', tipo: 'textarea', ancho: 2 },
      ],
    },
  ];
}

const clienteNuevoDeUrl = () =>
  typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('nuevo');

export default function VehiculosPage() {
  const { aviso, notificar } = useAviso();
  const [lista, setLista] = useState<Fila[]>([]);
  const [q, setQ] = useState('');
  const [idActual, setIdActual] = useState<number | null>(idDeUrl);
  const [detalle, setDetalle] = useState<DetalleVehiculo | null>(null);
  const [valores, setValores] = useState<Valores | null>(() => {
    const cliente = clienteNuevoDeUrl();
    return cliente ? { ...aValores(null, secciones([])), cliente_id: cliente } : null;
  });
  const [pestana, setPestana] = useState<Pestana>('ficha');
  const [clientes, setClientes] = useState<Fila[]>([]);
  const [empleados, setEmpleados] = useState<Fila[]>([]);
  const [sistemas, setSistemas] = useState<Sistema[]>([]);

  const formulario = useMemo(() => secciones(clientes), [clientes]);
  const nuevo = valores !== null && !detalle;

  const cargarLista = useCallback(async () => {
    try {
      const data = await pedir(`/api/vehiculos${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);
      setLista(data.vehiculos);
    } catch (e) {
      notificar('error', (e as Error).message);
    }
  }, [q, notificar]);

  const aplicar = useCallback((data: DetalleVehiculo) => {
    setDetalle(data);
    setValores(aValores(data.vehiculo, secciones([])));
    window.history.replaceState(null, '', `${RUTA}?id=${data.vehiculo.id}`);
  }, []);

  const recargar = useCallback(async () => {
    if (!detalle) return;
    try {
      aplicar(await pedir(`/api/vehiculos?id=${detalle.vehiculo.id}`));
    } catch (e) {
      notificar('error', (e as Error).message);
    }
    await cargarLista();
  }, [detalle, aplicar, notificar, cargarLista]);

  useEffect(() => {
    const t = setTimeout(cargarLista, 250);
    return () => clearTimeout(t);
  }, [cargarLista]);

  useEffect(() => {
    let vigente = true;
    Promise.all([pedir('/api/clientes'), pedir('/api/empleados?activos=1'), pedir('/api/sistemas-vehiculo?activos=1')])
      .then(([c, e, s]) => {
        if (!vigente) return;
        setClientes(c.clientes);
        setEmpleados(e.empleados);
        setSistemas(s.sistemas);
      })
      .catch((e: Error) => vigente && notificar('error', e.message));
    return () => {
      vigente = false;
    };
  }, [notificar]);

  useEffect(() => {
    if (!idActual) return;
    let vigente = true;
    pedir(`/api/vehiculos?id=${idActual}`)
      .then((data) => vigente && aplicar(data))
      .catch((e: Error) => vigente && notificar('error', e.message));
    return () => {
      vigente = false;
    };
  }, [idActual, aplicar, notificar]);

  const accion = useCallback(
    async (url: string, metodo: string, cuerpo?: unknown) => {
      try {
        const data = await pedir(url, metodo, cuerpo);
        if (data.mensaje) notificar('ok', data.mensaje);
        await recargar();
        return true;
      } catch (e) {
        notificar('error', (e as Error).message);
        return false;
      }
    },
    [notificar, recargar]
  );

  const iniciarNuevo = () => {
    setDetalle(null);
    setIdActual(null);
    setPestana('ficha');
    setValores(aValores(null, formulario));
    window.history.replaceState(null, '', RUTA);
  };

  const guardar = async () => {
    if (!valores) return;
    try {
      if (nuevo) {
        const data = await pedir('/api/vehiculos', 'POST', valores);
        notificar('ok', data.mensaje);
        setIdActual(data.id);
        await cargarLista();
      } else if (detalle) {
        await accion('/api/vehiculos', 'PUT', { ...valores, id: detalle.vehiculo.id });
      }
    } catch (e) {
      notificar('error', (e as Error).message);
    }
  };

  const eliminar = async () => {
    if (!detalle || !confirm(`¿Eliminar ${detalle.vehiculo.codigo}? Se borran sus partes, revisiones, recordatorios y fotos.`)) return;
    try {
      const data = await pedir(`/api/vehiculos?id=${detalle.vehiculo.id}`, 'DELETE');
      notificar('ok', data.mensaje);
      if (data.mensaje?.includes('inactivo')) await recargar();
      else {
        setDetalle(null);
        setValores(null);
        setIdActual(null);
        window.history.replaceState(null, '', RUTA);
        await cargarLista();
      }
    } catch (e) {
      notificar('error', (e as Error).message);
    }
  };

  const v = detalle?.vehiculo;
  const odometro = v?.odometro_actual ?? null;
  const tarjeta = v?.tarjeta_vencimiento ? estadoRecordatorio(fecha(v.tarjeta_vencimiento), null, null) : null;
  const avisos = (detalle?.recordatorios ?? [])
    .filter((r) => r.activo)
    .map((r) => estadoRecordatorio(fecha(r.proximo_fecha) || null, r.proximo_km, odometro));
  const vencidos = avisos.filter((a) => a === 'VENCIDO').length;
  const proximos = avisos.filter((a) => a === 'PROXIMO').length;

  const PESTANAS: { id: Pestana; etiqueta: string }[] = [
    { id: 'ficha', etiqueta: 'Ficha y tarjeta' },
    { id: 'partes', etiqueta: `Partes (${detalle?.partes.filter((p) => p.estado_instalacion === 'INSTALADA').length ?? 0})` },
    { id: 'estados', etiqueta: `Revisiones (${detalle?.estados.length ?? 0})` },
    { id: 'recordatorios', etiqueta: `Recordatorios${vencidos ? ` (${vencidos} vencido${vencidos > 1 ? 's' : ''})` : ''}` },
  ];

  return (
    <DashboardLayout>
      <div
        className={`${UI.canvas} flex flex-col gap-2 lg:h-[calc(100vh-3rem)]`}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && valores && pestana === 'ficha') {
            e.preventDefault();
            guardar();
          }
        }}
      >
        <BarraTaller titulo="Vehículos" />
        <div className="grid gap-2 lg:flex-1 lg:min-h-0 lg:grid-cols-[16rem_1fr]">
          <aside className={`${UI.densePanel} flex flex-col min-h-[12rem] lg:min-h-0`}>
            <div className="flex flex-col gap-1.5 p-2 border-b border-border">
              <button type="button" className={`${UI.denseBtnPrimary} justify-center`} onClick={iniciarNuevo}>
                <Plus className="h-3.5 w-3.5" /> Nuevo vehículo
              </button>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input className={`${UI.denseInput} w-full pl-7`} placeholder="Placa, marca, VIN o cliente" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              {lista.length === 0 ? (
                <p className="p-4 text-xs text-center text-muted-foreground">Sin vehículos.</p>
              ) : (
                lista.map((f) => (
                  <button
                    key={String(f.id)}
                    type="button"
                    onClick={() => setIdActual(Number(f.id))}
                    className={`w-full text-left px-2.5 py-1.5 border-b border-border text-xs ${
                      Number(f.id) === v?.id ? UI.denseRowActive : 'hover:bg-muted/60'
                    } ${Number(f.activo) ? '' : 'opacity-60'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`${UI.denseMono} font-semibold`}>
                        {String(f.placa ?? f.codigo)}
                        {f.anio_placa ? <span className="font-normal text-muted-foreground"> / {String(f.anio_placa)}</span> : null}
                      </span>
                      {Number(f.recordatorios_vencidos) > 0 && (
                        <Insignia texto={`${f.recordatorios_vencidos} vencido`} color={COLOR_AVISO.VENCIDO} />
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 text-muted-foreground">
                      <span className="truncate">
                        {String(f.marca)} {String(f.modelo)}
                      </span>
                      <span className="truncate text-right">{String(f.cliente_nombre)}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </aside>

          <section className="flex flex-col gap-2 min-h-0 lg:overflow-y-auto">
            {!valores ? (
              <div className={`${UI.densePanel} flex-1 flex flex-col items-center justify-center gap-2 py-16 text-center`}>
                <p className="text-sm text-muted-foreground">Elija un vehículo o registre uno nuevo.</p>
                <p className="text-xs text-muted-foreground max-w-md">
                  Cada vehículo guarda los datos de su tarjeta de circulación vigente, las partes que el taller documenta, las revisiones de
                  entrada y salida, y los recordatorios de mantenimiento.
                </p>
              </div>
            ) : (
              <>
                <div className={`${UI.densePanel} shrink-0`}>
                  <div className="flex flex-wrap items-center gap-2 px-3 py-2">
                    {v ? (
                      <>
                        <span className={`${UI.denseMono} text-sm font-semibold`}>
                          {v.placa ?? 'Sin placa'}
                          {v.anio_placa ? <span className="font-normal text-muted-foreground"> / {String(v.anio_placa)}</span> : null}
                        </span>
                        <span className="text-sm">
                          {String(v.marca)} {String(v.modelo)} {v.anio_modelo ? String(v.anio_modelo) : ''}
                        </span>
                        <span className={`${UI.denseMono} text-[11px] text-muted-foreground`}>{v.codigo}</span>
                        <Link href={`/dashboard/taller/clientes?id=${v.cliente_id}`} className="text-xs text-primary hover:underline">
                          {v.cliente_nombre}
                        </Link>
                        <span className={`${UI.denseMono} text-xs text-muted-foreground`}>
                          {odometro != null ? `${fmt(odometro)} ${String(v.unidad_odometro ?? 'KM').toLowerCase()}` : ''}
                        </span>
                        {tarjeta && tarjeta !== 'AL DIA' && (
                          <Insignia
                            texto={tarjeta === 'VENCIDO' ? 'TARJETA VENCIDA' : `TARJETA VENCE ${fecha(v.tarjeta_vencimiento)}`}
                            color={COLOR_AVISO[tarjeta]}
                          />
                        )}
                        {(vencidos > 0 || proximos > 0) && (
                          <button type="button" onClick={() => setPestana('recordatorios')} className="inline-flex items-center gap-1 text-xs">
                            <AlertTriangle className={`h-3.5 w-3.5 ${vencidos ? 'text-red-500' : UI.textWarn}`} />
                            {vencidos > 0 && `${vencidos} vencido${vencidos > 1 ? 's' : ''}`}
                            {vencidos > 0 && proximos > 0 && ' · '}
                            {proximos > 0 && `${proximos} próximo${proximos > 1 ? 's' : ''}`}
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="text-sm font-semibold">Nuevo vehículo</span>
                    )}
                    {pestana === 'ficha' && (
                      <div className="ml-auto flex gap-1.5">
                        <button type="button" className={UI.denseBtnPrimary} onClick={guardar} title="Ctrl+S">
                          <Save className="h-3.5 w-3.5" /> Guardar
                        </button>
                        {detalle && (
                          <button type="button" className={UI.denseBtnDanger} aria-label="Eliminar vehículo" onClick={eliminar}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {detalle && (
                  <div className="flex gap-1 shrink-0 border-b border-border overflow-x-auto">
                    {PESTANAS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPestana(p.id)}
                        className={`px-3 py-1.5 text-xs whitespace-nowrap border-b-2 -mb-px ${
                          pestana === p.id ? 'border-primary text-primary font-medium' : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {p.etiqueta}
                      </button>
                    ))}
                  </div>
                )}

                {(pestana === 'ficha' || !detalle) && (
                  <>
                    <div className={`${UI.densePanel} shrink-0`}>
                      <Formulario secciones={formulario} valores={valores} onCambio={(c, val) => setValores({ ...valores, [c]: val })} />
                    </div>
                    {detalle && (
                      <PanelTarjeta idvehiculo={detalle.vehiculo.id} archivos={detalle.archivos} onCambio={recargar} notificar={notificar} />
                    )}
                  </>
                )}
                {detalle && pestana === 'partes' && <PanelPartes detalle={detalle} sistemas={sistemas} accion={accion} />}
                {detalle && pestana === 'estados' && (
                  <PanelEstados key={detalle.vehiculo.id} detalle={detalle} empleados={empleados} accion={accion} />
                )}
                {detalle && pestana === 'recordatorios' && <PanelRecordatorios detalle={detalle} sistemas={sistemas} accion={accion} />}
              </>
            )}
          </section>
        </div>
      </div>
      <Toast aviso={aviso} />
    </DashboardLayout>
  );
}
