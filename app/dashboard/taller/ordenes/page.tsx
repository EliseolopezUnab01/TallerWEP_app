'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { NotificationDropdown } from '@/components/notification-dropdown';
import { UserDropdown } from '@/components/user-dropdown';
import { avisar } from '@/components/ui/avisos';
import { UI } from '@/lib/ui';

interface OrdenLista {
  id: number;
  numero_orden: string;
  estado: string;
  cliente: string;
  placa: string | null;
}

interface Reparacion {
  tipo: string;
  cantidad: string;
  tarea_actividad: string;
}
interface Repuesto {
  idprod: string;
  descripcion: string;
  cantidad: string;
}

export default function OrdenesPage() {
  const [lista, setLista] = useState<OrdenLista[]>([]);
  const [clientes, setClientes] = useState<{ id: number; nombre: string; codigo: string }[]>([]);
  const [vehiculos, setVehiculos] = useState<{ id: number; placa: string | null; marca: string; modelo: string; cliente_id: number }[]>([]);
  const [id, setId] = useState<number | null>(null);
  const [numero, setNumero] = useState('');
  const [estado, setEstado] = useState('PROCESO');
  const [clienteId, setClienteId] = useState('');
  const [vehiculoId, setVehiculoId] = useState('');
  const [conductor, setConductor] = useState('');
  const [solicitadas, setSolicitadas] = useState('');
  const [realizadas, setRealizadas] = useState('');
  const [comentarios, setComentarios] = useState('');
  const [odometro, setOdometro] = useState('');
  const [reparaciones, setReparaciones] = useState<Reparacion[]>([]);
  const [repuestos, setRepuestos] = useState<Repuesto[]>([]);
  const [comprados, setComprados] = useState<{ descripcion: string; cantidad: number; numero_interno: string }[]>([]);
  const cerrada = estado === 'FINALIZADA' || estado === 'CANCELADA';

  const nueva = () => {
    setId(null);
    setNumero('');
    setEstado('PROCESO');
    setClienteId('');
    setVehiculoId('');
    setConductor('');
    setSolicitadas('');
    setRealizadas('');
    setComentarios('');
    setOdometro('');
    setReparaciones([]);
    setRepuestos([]);
    setComprados([]);
  };

  const cargarLista = () => {
    fetch('/api/ordenes-trabajo')
      .then((r) => r.json())
      .then((d) => setLista(d.ordenes || []))
      .catch(() => setLista([]));
  };

  useEffect(() => {
    cargarLista();
    fetch('/api/clientes').then((r) => r.json()).then((d) => setClientes(d.clientes || d.data || [])).catch(() => setClientes([]));
    fetch('/api/vehiculos').then((r) => r.json()).then((d) => setVehiculos(d.vehiculos || [])).catch(() => setVehiculos([]));
  }, []);

  const abrir = async (idorden: number) => {
    const res = await fetch(`/api/ordenes-trabajo?id=${idorden}`);
    const data = await res.json();
    if (!res.ok) return avisar(data.error || 'No se pudo abrir', 'error');
    const o = data.orden;
    setId(o.id);
    setNumero(o.numero_orden);
    setEstado(o.estado);
    setClienteId(String(o.cliente_id));
    setVehiculoId(String(o.vehiculo_id));
    setConductor(o.conductor_nombre || '');
    setSolicitadas(o.reparaciones_solicitadas || '');
    setRealizadas(o.reparaciones_realizadas || '');
    setComentarios(o.comentarios || '');
    setOdometro(o.odometro_inicial ?? '');
    setReparaciones((data.reparaciones || []).map((r: Reparacion & { cantidad: number }) => ({
      tipo: r.tipo,
      cantidad: String(r.cantidad ?? 1),
      tarea_actividad: r.tarea_actividad || '',
    })));
    setRepuestos((data.repuestos || []).map((r: { idprod: number | null; descripcion: string; cantidad: number }) => ({
      idprod: r.idprod ? String(r.idprod) : '',
      descripcion: r.descripcion,
      cantidad: String(r.cantidad),
    })));
    setComprados(data.comprados || []);
  };

  const crear = async () => {
    const res = await fetch('/api/ordenes-trabajo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cliente_id: Number(clienteId), vehiculo_id: Number(vehiculoId), conductor_nombre: conductor, reparaciones_solicitadas: solicitadas }),
    });
    const data = await res.json();
    if (!res.ok) return avisar(data.error || 'No se pudo crear', 'error');
    avisar(`Orden ${data.numero_orden} creada`, 'ok');
    cargarLista();
    abrir(data.id);
  };

  const guardar = async () => {
    if (!id) return;
    const res = await fetch('/api/ordenes-trabajo', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        estado,
        conductor_nombre: conductor,
        reparaciones_solicitadas: solicitadas,
        reparaciones_realizadas: realizadas,
        comentarios,
        odometro_inicial: odometro,
        reparaciones,
        repuestos,
      }),
    });
    const data = await res.json();
    if (!res.ok) return avisar(data.error || 'No se pudo guardar', 'error');
    avisar('Orden guardada', 'ok');
    cargarLista();
    abrir(id);
  };

  const vehiculosCliente = vehiculos.filter((v) => String(v.cliente_id) === clienteId);

  return (
    <DashboardLayout>
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <div>
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Taller</span>
            <h1 className="text-sm font-semibold">Órdenes de trabajo</h1>
          </div>
          <div className="flex items-center gap-2">
            <NotificationDropdown />
            <UserDropdown />
          </div>
        </div>
        <div className="grid min-h-0 flex-1 gap-3 overflow-auto p-4 lg:grid-cols-[16rem_1fr]">
          <aside className={`${UI.densePanel} overflow-auto`}>
            <div className={`${UI.densePanelTitle} flex items-center justify-between`}>
              Órdenes
              <button type="button" className={UI.denseBtn} onClick={nueva}>Nueva</button>
            </div>
            {lista.map((o) => (
              <button key={o.id} type="button" className="block w-full border-b border-border px-3 py-2 text-left text-xs hover:bg-muted" onClick={() => abrir(o.id)}>
                <div className="font-medium">{o.numero_orden}</div>
                <div className="text-muted-foreground">{o.cliente} · {o.placa || 'sin placa'} · {o.estado}</div>
              </button>
            ))}
            {lista.length === 0 && <p className="p-3 text-xs text-muted-foreground">No hay órdenes.</p>}
          </aside>
          <section className={`${UI.densePanel} space-y-3 p-3`}>
            <div className="flex flex-wrap gap-2">
              <label className="flex flex-col gap-1">
                <span className={UI.denseLabel}>Cliente</span>
                <select className={UI.denseSelect} disabled={Boolean(id)} value={clienteId} onChange={(e) => { setClienteId(e.target.value); setVehiculoId(''); }}>
                  <option value="">Elegir…</option>
                  {clientes.map((c) => <option key={c.id} value={c.id}>{c.codigo} · {c.nombre}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className={UI.denseLabel}>Vehículo</span>
                <select className={UI.denseSelect} disabled={Boolean(id)} value={vehiculoId} onChange={(e) => setVehiculoId(e.target.value)}>
                  <option value="">Elegir…</option>
                  {vehiculosCliente.map((v) => <option key={v.id} value={v.id}>{v.placa || 'Sin placa'} · {v.marca} {v.modelo}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className={UI.denseLabel}>Conductor</span>
                <input className={UI.denseInput} value={conductor} onChange={(e) => setConductor(e.target.value)} />
              </label>
              {id && (
                <label className="flex flex-col gap-1">
                  <span className={UI.denseLabel}>Estado</span>
                  <select className={UI.denseSelect} disabled={cerrada} value={estado} onChange={(e) => setEstado(e.target.value)}>
                    <option>PROCESO</option>
                    <option>ESPERA</option>
                    <option>FINALIZADA</option>
                    <option>CANCELADA</option>
                  </select>
                </label>
              )}
            </div>
            {!id ? (
              <button type="button" className={UI.denseBtnPrimary} onClick={crear}>Crear orden</button>
            ) : (
              <>
                <p className="text-sm font-semibold">{numero}</p>
                <label className="flex flex-col gap-1">
                  <span className={UI.denseLabel}>Solicitado</span>
                  <textarea className={UI.denseInput} rows={2} disabled={cerrada} value={solicitadas} onChange={(e) => setSolicitadas(e.target.value)} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className={UI.denseLabel}>Realizado</span>
                  <textarea className={UI.denseInput} rows={2} disabled={cerrada} value={realizadas} onChange={(e) => setRealizadas(e.target.value)} />
                </label>
                <label className="flex min-w-[8rem] flex-col gap-1">
                  <span className={UI.denseLabel}>Odómetro</span>
                  <input type="number" className={`${UI.denseInput} w-32`} disabled={cerrada} value={odometro} onChange={(e) => setOdometro(e.target.value)} />
                </label>
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className={UI.denseLabel}>Tareas</span>
                    {!cerrada && <button type="button" className={UI.denseBtn} onClick={() => setReparaciones([...reparaciones, { tipo: 'SOLICITADA', cantidad: '1', tarea_actividad: '' }])}>Agregar</button>}
                  </div>
                  {reparaciones.map((r, i) => (
                    <div key={i} className="mb-1 flex gap-1">
                      <select className={UI.denseSelect} disabled={cerrada} value={r.tipo} onChange={(e) => setReparaciones(reparaciones.map((x, n) => n === i ? { ...x, tipo: e.target.value } : x))}>
                        <option>SOLICITADA</option>
                        <option>REALIZADA</option>
                      </select>
                      <input className={`${UI.denseInput} w-16`} disabled={cerrada} value={r.cantidad} onChange={(e) => setReparaciones(reparaciones.map((x, n) => n === i ? { ...x, cantidad: e.target.value } : x))} />
                      <input className={`${UI.denseInput} flex-1`} disabled={cerrada} placeholder="Tarea" value={r.tarea_actividad} onChange={(e) => setReparaciones(reparaciones.map((x, n) => n === i ? { ...x, tarea_actividad: e.target.value } : x))} />
                    </div>
                  ))}
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className={UI.denseLabel}>Repuestos de la orden</span>
                    {!cerrada && <button type="button" className={UI.denseBtn} onClick={() => setRepuestos([...repuestos, { idprod: '', descripcion: '', cantidad: '1' }])}>Agregar</button>}
                  </div>
                  {repuestos.map((r, i) => (
                    <div key={i} className="mb-1 flex gap-1">
                      <input className={`${UI.denseInput} w-20`} disabled={cerrada} placeholder="Id prod." value={r.idprod} onChange={(e) => setRepuestos(repuestos.map((x, n) => n === i ? { ...x, idprod: e.target.value } : x))} />
                      <input className={`${UI.denseInput} flex-1`} disabled={cerrada} placeholder="Descripción" value={r.descripcion} onChange={(e) => setRepuestos(repuestos.map((x, n) => n === i ? { ...x, descripcion: e.target.value } : x))} />
                      <input className={`${UI.denseInput} w-16`} disabled={cerrada} value={r.cantidad} onChange={(e) => setRepuestos(repuestos.map((x, n) => n === i ? { ...x, cantidad: e.target.value } : x))} />
                    </div>
                  ))}
                </div>
                {comprados.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    Comprados en express: {comprados.map((c) => `${c.descripcion} (${c.cantidad})`).join(' · ')}
                  </div>
                )}
                <label className="flex flex-col gap-1">
                  <span className={UI.denseLabel}>Comentarios</span>
                  <input className={UI.denseInput} disabled={cerrada} value={comentarios} onChange={(e) => setComentarios(e.target.value)} />
                </label>
                {!cerrada && <button type="button" className={UI.denseBtnPrimary} onClick={guardar}>Guardar</button>}
              </>
            )}
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}
