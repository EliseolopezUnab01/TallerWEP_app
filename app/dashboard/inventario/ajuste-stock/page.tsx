'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BarraPantalla } from '@/components/barra-pantalla';
import { avisar } from '@/components/ui/avisos';
import { UI } from '@/lib/ui';
import { fechaLocalISO } from '@/lib/fechas';
import { formatoCantidad } from '@/lib/decimales';
import { AVISO_ENTEROS } from '@/lib/configuracion';
import { useConfiguracion } from '@/lib/configuracion-cliente';

interface Linea {
  idprod: number;
  nombre: string;
  contable: string;
  fisico: string;
}

interface Ajuste {
  idajuste: number;
  numero: string;
  fecha: string;
  motivo: string;
  lineas: number;
}

export default function AjusteStockPage() {
  const [motivo, setMotivo] = useState('');
  const [fecha, setFecha] = useState(() => fechaLocalISO());
  const [busqueda, setBusqueda] = useState('');
  const [hits, setHits] = useState<{ idprod: number; nombre: string; stock_contable: number }[]>([]);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [ajustes, setAjustes] = useState<Ajuste[]>([]);
  const [guardando, setGuardando] = useState(false);
  const config = useConfiguracion();
  const soloEnteros = config?.cantidades_decimales !== '1';
  const paso = soloEnteros ? 1 : 'any';

  const cargar = () => {
    fetch('/api/ajustes-inventario')
      .then((r) => r.json())
      .then((d) => setAjustes(d.ajustes || []))
      .catch(() => setAjustes([]));
  };

  useEffect(() => {
    cargar();
  }, []);

  useEffect(() => {
    const q = busqueda.trim();
    if (q.length < 2) return;
    const t = setTimeout(() => {
      fetch(`/api/productos?search=${encodeURIComponent(q)}&limit=8`)
        .then((r) => r.json())
        .then((d) => setHits(d.products || []))
        .catch(() => setHits([]));
    }, 250);
    return () => clearTimeout(t);
  }, [busqueda]);

  const agregar = (p: { idprod: number; nombre: string }) => {
    setLineas((prev) => (prev.some((l) => l.idprod === p.idprod) ? prev : [...prev, { idprod: p.idprod, nombre: p.nombre, contable: '', fisico: '' }]));
    setBusqueda('');
    setHits([]);
  };

  const guardar = async () => {
    if (guardando) return;
    if (soloEnteros && lineas.some((l) => !Number.isInteger(Number(l.contable || 0)) || !Number.isInteger(Number(l.fisico || 0)))) {
      avisar(AVISO_ENTEROS, 'error');
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch('/api/ajustes-inventario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          motivo,
          fecha,
          lineas: lineas.map((l) => ({
            idprod: l.idprod,
            cantidad_contable: Number(l.contable) || 0,
            cantidad_fisico: Number(l.fisico) || 0,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        avisar(data.error || 'No se pudo guardar', 'error');
        return;
      }
      avisar(`Ajuste ${data.numero} aplicado`, 'ok');
      setLineas([]);
      setMotivo('');
      cargar();
    } catch {
      avisar('Error al conectar con el servidor', 'error');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <div className={`${UI.canvas} flex h-full min-h-0 flex-col gap-2`}>
        <BarraPantalla modulo="Inventario" titulo="Ajuste de inventario" />
        <div className="grid min-h-0 flex-1 gap-3 overflow-auto lg:grid-cols-[1fr_18rem]">
          <div className={`${UI.densePanel} p-3`}>
            <p className="mb-3 text-xs text-muted-foreground">
              Suma o resta stock. Use un número negativo para bajarlo. El alta y la importación dejan el producto en cero.{' '}
              <Link href="/dashboard/inventario/nuevo" className="text-primary hover:underline">Nuevo producto</Link>
            </p>
            <div className="mb-3 flex flex-wrap gap-2">
              <label className="flex flex-col gap-1">
                <span className={UI.denseLabel}>Fecha</span>
                <input type="date" className={UI.denseInput} value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </label>
              <label className="flex min-w-[16rem] flex-1 flex-col gap-1">
                <span className={UI.denseLabel}>Motivo</span>
                <input className={UI.denseInput} value={motivo} placeholder="Inventario inicial, conteo, corrección…" onChange={(e) => setMotivo(e.target.value)} />
              </label>
            </div>
            <label className="mb-2 flex flex-col gap-1">
              <span className={UI.denseLabel}>Producto</span>
              <input className={UI.denseInput} value={busqueda} placeholder="Nombre, OE o código" onChange={(e) => setBusqueda(e.target.value)} />
            </label>
            {hits.length > 0 && (
              <ul className="mb-3 max-h-40 overflow-auto rounded border border-border">
                {hits.map((p) => (
                  <li key={p.idprod}>
                    <button type="button" className="flex w-full justify-between px-2 py-1 text-left text-xs hover:bg-muted" onClick={() => agregar(p)}>
                      <span><span className={UI.denseMono}>{p.idprod}</span> {p.nombre}</span>
                      <span className="text-muted-foreground">stock {formatoCantidad(p.stock_contable)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <table className={UI.denseTable}>
              <thead>
                <tr>
                  <th className={UI.denseTh}>Producto</th>
                  <th className={`${UI.denseTh} text-right`}>Contable</th>
                  <th className={`${UI.denseTh} text-right`}>Físico</th>
                  <th className={UI.denseTh} />
                </tr>
              </thead>
              <tbody>
                {lineas.length === 0 ? (
                  <tr>
                    <td colSpan={4} className={`${UI.denseTd} py-6 text-center text-muted-foreground`}>Busque un producto y indique cuánto entra o sale.</td>
                  </tr>
                ) : (
                  lineas.map((l) => (
                    <tr key={l.idprod}>
                      <td className={UI.denseTd}><span className={UI.denseMono}>{l.idprod}</span> {l.nombre}</td>
                      <td className={UI.denseTd}>
                        <input type="number" step={paso} className={`${UI.denseInput} w-24 text-right`} value={l.contable} onChange={(e) => setLineas(lineas.map((x) => x.idprod === l.idprod ? { ...x, contable: e.target.value } : x))} />
                      </td>
                      <td className={UI.denseTd}>
                        <input type="number" step={paso} className={`${UI.denseInput} w-24 text-right`} value={l.fisico} onChange={(e) => setLineas(lineas.map((x) => x.idprod === l.idprod ? { ...x, fisico: e.target.value } : x))} />
                      </td>
                      <td className={UI.denseTd}>
                        <button type="button" className="text-xs text-red-600" onClick={() => setLineas(lineas.filter((x) => x.idprod !== l.idprod))}>Quitar</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <div className="mt-3 flex justify-end">
              <button type="button" className={UI.denseBtnPrimary} disabled={guardando || lineas.length === 0} onClick={guardar}>
                {guardando ? 'Guardando…' : 'Aplicar ajuste'}
              </button>
            </div>
          </div>
          <aside className={`${UI.densePanel} p-3`}>
            <div className={UI.densePanelTitle}>Últimos ajustes</div>
            <ul className="mt-2 space-y-2 text-xs">
              {ajustes.length === 0 && <li className="text-muted-foreground">Todavía no hay ajustes.</li>}
              {ajustes.map((a) => (
                <li key={a.idajuste} className="border-b border-border pb-2">
                  <div className="font-medium">{a.numero}</div>
                  <div className="text-muted-foreground">{String(a.fecha).slice(0, 10)} · {a.lineas} línea(s)</div>
                  <div>{a.motivo}</div>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </div>
    </>
  );
}
