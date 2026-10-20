'use client';

import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { NotificationDropdown } from '@/components/notification-dropdown';
import { UserDropdown } from '@/components/user-dropdown';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Search, Plus, Save, Trash2, X, Loader2, AlertCircle, CheckCircle2,
  Pencil, ListOrdered, ChevronUp, ChevronDown, ShoppingCart, Package,
} from 'lucide-react';

// ---------- Tipos ----------

interface Borrador {
  idcompra: number;
  estado: string;
  idproveedor: number | null;
  proveedor_codigo: string | null;
  proveedor_nombre: string | null;
  total_lineas: number;
  updated_at: string;
}

interface Linea {
  iddetalle: number;
  idcompra: number;
  numero_linea: number;
  numero_orden: string | null;
  destino: string;
  idcatalogo: number | null;
  catalogo_codigo: string | null;
  catalogo_nombre: string | null;
  idprod: number | null;
  producto_oe: string | null;
  referencia_proveedor: string | null;
  descripcion: string;
  cantidad: number;
  costo_unitario: number;
  descuento_porcentaje: number;
  subtotal_sin_iva: number;
  iva_unitario: number;
  subtotal_con_iva: number;
  exento_unitario: number;
  no_sujeto_unitario: number;
  condicion_iva: string;
  imagen_url: string | null;
}

interface Rubro {
  idcatalogo: number;
  tipo: string;
  codigo: string;
  nombre: string;
  condicion_iva_sugerida: string | null;
}

interface ProductoBusqueda {
  idprod: number;
  nombre: string;
  OE: string | null;
  imagen_principal?: string | null;
}

interface FormLinea {
  iddetalle: number;
  numero_orden: string;
  destino: string;
  idcatalogo: string;
  idprod: string;
  referencia_proveedor: string;
  descripcion: string;
  cantidad: string;
  costo_unitario: string;
  descuento_porcentaje: string;
  condicion_iva: string;
}

const FORM_VACIO = (): FormLinea => ({
  iddetalle: 0,
  numero_orden: '',
  destino: 'INVENTARIO',
  idcatalogo: '',
  idprod: '',
  referencia_proveedor: '',
  descripcion: '',
  cantidad: '1',
  costo_unitario: '0',
  descuento_porcentaje: '0',
  condicion_iva: 'GRAVADA',
});

const DESTINOS = [
  { valor: 'INVENTARIO', etiqueta: 'Inventario' },
  { valor: 'EXPRESS', etiqueta: 'Express' },
  { valor: 'ACTIVOS', etiqueta: 'Activos' },
  { valor: 'GASTOS', etiqueta: 'Gastos' },
];

const CONDICIONES_IVA = [
  { valor: 'GRAVADA', etiqueta: 'Gravada' },
  { valor: 'EXENTO', etiqueta: 'Exento' },
  { valor: 'NO_SUJETO', etiqueta: 'No sujeto' },
  { valor: 'XCOMPROBAR', etiqueta: 'Por comprobar' },
];

const INPUT_CLS = 'bg-white dark:bg-surface-deep border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus-visible:ring-primary';
const SELECT_CLS = 'w-full h-9 rounded-md bg-white dark:bg-surface-deep border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-sm px-3 focus:outline-none focus:ring-2 focus:ring-primary';
const LABEL_CLS = 'text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400';

function fmt4(n: number | string | null | undefined) {
  return Number(n || 0).toFixed(4);
}

function fmt2(n: number | string | null | undefined) {
  return Number(n || 0).toFixed(2);
}

export default function LineasCompraPage() {
  const [borradores, setBorradores] = useState<Borrador[]>([]);
  const [compraActiva, setCompraActiva] = useState<number | null>(null);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [rubros, setRubros] = useState<Rubro[]>([]);
  const [cargando, setCargando] = useState(true);
  const [cargandoLineas, setCargandoLineas] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [form, setForm] = useState<FormLinea | null>(null);
  const [busquedaProd, setBusquedaProd] = useState('');
  const [productos, setProductos] = useState<ProductoBusqueda[]>([]);
  const [buscandoProd, setBuscandoProd] = useState(false);

  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const notificar = (tipo: 'ok' | 'error', texto: string) => {
    setAviso({ tipo, texto });
    setTimeout(() => setAviso(null), 4000);
  };

  const requiereCatalogo = (destino: string) => destino === 'GASTOS' || destino === 'ACTIVOS';

  // ---------- Carga ----------

  const cargarBorradores = useCallback(async () => {
    setCargando(true);
    try {
      const res = await fetch('/api/compras?estado=BORRADOR');
      const data = await res.json();
      if (data.success) {
        setBorradores(data.compras);
        if (data.compras.length > 0 && !compraActiva) {
          setCompraActiva(data.compras[0].idcompra);
        }
      } else {
        notificar('error', data.error || 'No se pudieron cargar los borradores');
      }
    } catch {
      notificar('error', 'Error de conexión al cargar borradores');
    } finally {
      setCargando(false);
    }
  }, [compraActiva]);

  const cargarLineas = useCallback(async (idcompra: number) => {
    setCargandoLineas(true);
    try {
      const res = await fetch(`/api/compras-detalle?idcompra=${idcompra}`);
      const data = await res.json();
      if (data.success) {
        setLineas(data.lineas);
      } else {
        notificar('error', data.error || 'No se pudieron cargar las líneas');
      }
    } catch {
      notificar('error', 'Error de conexión al cargar líneas');
    } finally {
      setCargandoLineas(false);
    }
  }, []);

  const cargarRubros = useCallback(async () => {
    try {
      const res = await fetch('/api/catalogo-contable?activo=true');
      const data = await res.json();
      if (data.success) setRubros(data.rubros);
    } catch {
      /* silencioso */
    }
  }, []);

  useEffect(() => {
    cargarBorradores();
    cargarRubros();
  }, [cargarBorradores, cargarRubros]);

  useEffect(() => {
    if (compraActiva) cargarLineas(compraActiva);
  }, [compraActiva, cargarLineas]);

  // ---------- Acciones borrador ----------

  const crearBorrador = async () => {
    try {
      const res = await fetch('/api/compras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        notificar('ok', `Borrador #${data.idcompra} creado`);
        setCompraActiva(data.idcompra);
        await cargarBorradores();
      } else {
        notificar('error', data.error || 'No se pudo crear el borrador');
      }
    } catch {
      notificar('error', 'Error de conexión');
    }
  };

  const eliminarBorrador = async () => {
    if (!compraActiva) return;
    if (!confirm(`¿Eliminar borrador #${compraActiva} y todas sus líneas?`)) return;

    try {
      const res = await fetch(`/api/compras?id=${compraActiva}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        notificar('ok', 'Borrador eliminado');
        setCompraActiva(null);
        setLineas([]);
        await cargarBorradores();
      } else {
        notificar('error', data.error || 'No se pudo eliminar');
      }
    } catch {
      notificar('error', 'Error de conexión');
    }
  };

  // ---------- Producto ----------

  const buscarProductos = async (q: string) => {
    setBusquedaProd(q);
    if (q.trim().length < 2) {
      setProductos([]);
      return;
    }
    setBuscandoProd(true);
    try {
      const res = await fetch(`/api/productos?search=${encodeURIComponent(q)}&limit=8`);
      const data = await res.json();
      if (data.products) {
        setProductos(data.products.map((p: any) => ({
          idprod: p.idprod,
          nombre: p.nombre,
          OE: p.OE,
          imagen_principal: p.imagen_principal,
        })));
      }
    } catch {
      /* silencioso */
    } finally {
      setBuscandoProd(false);
    }
  };

  const seleccionarProducto = (p: ProductoBusqueda) => {
    if (!form) return;
    setForm({
      ...form,
      idprod: String(p.idprod),
      descripcion: p.nombre,
      referencia_proveedor: p.OE || form.referencia_proveedor,
    });
    setProductos([]);
    setBusquedaProd('');
  };

  // ---------- Líneas ----------

  const abrirNueva = () => {
    setForm(FORM_VACIO());
    setProductos([]);
    setBusquedaProd('');
  };

  const abrirEditar = (linea: Linea) => {
    setForm({
      iddetalle: linea.iddetalle,
      numero_orden: linea.numero_orden || '',
      destino: linea.destino,
      idcatalogo: linea.idcatalogo ? String(linea.idcatalogo) : '',
      idprod: linea.idprod ? String(linea.idprod) : '',
      referencia_proveedor: linea.referencia_proveedor || '',
      descripcion: linea.descripcion,
      cantidad: String(linea.cantidad),
      costo_unitario: String(linea.costo_unitario),
      descuento_porcentaje: String(linea.descuento_porcentaje),
      condicion_iva: linea.condicion_iva,
    });
  };

  const guardarLinea = async () => {
    if (!form || !compraActiva) return;

    if (!form.descripcion.trim()) {
      notificar('error', 'La descripción es obligatoria');
      return;
    }
    if (requiereCatalogo(form.destino) && !form.idcatalogo) {
      notificar('error', 'Seleccione un rubro contable para Gastos o Activos');
      return;
    }

    setGuardando(true);
    try {
      const payload: Record<string, unknown> = {
        idcompra: compraActiva,
        numero_orden: form.numero_orden || null,
        destino: form.destino,
        idcatalogo: form.idcatalogo ? Number(form.idcatalogo) : null,
        idprod: form.idprod ? Number(form.idprod) : null,
        referencia_proveedor: form.referencia_proveedor || null,
        descripcion: form.descripcion,
        cantidad: Number(form.cantidad),
        costo_unitario: Number(form.costo_unitario),
        descuento_porcentaje: Number(form.descuento_porcentaje),
        condicion_iva: form.condicion_iva,
      };

      const esNuevo = form.iddetalle === 0;
      const res = await fetch('/api/compras-detalle', {
        method: esNuevo ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(esNuevo ? payload : { ...payload, iddetalle: form.iddetalle }),
      });
      const data = await res.json();

      if (data.success) {
        notificar('ok', esNuevo ? 'Línea agregada' : 'Línea actualizada');
        setForm(null);
        await cargarLineas(compraActiva);
        await cargarBorradores();
      } else {
        notificar('error', data.error || 'No se pudo guardar');
      }
    } catch {
      notificar('error', 'Error de conexión');
    } finally {
      setGuardando(false);
    }
  };

  const eliminarLinea = async (iddetalle: number) => {
    if (!confirm('¿Eliminar esta línea?')) return;
    try {
      const res = await fetch(`/api/compras-detalle?id=${iddetalle}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success && compraActiva) {
        notificar('ok', 'Línea eliminada');
        await cargarLineas(compraActiva);
        await cargarBorradores();
      } else {
        notificar('error', data.error || 'No se pudo eliminar');
      }
    } catch {
      notificar('error', 'Error de conexión');
    }
  };

  const moverLinea = async (index: number, direccion: 'up' | 'down') => {
    if (!compraActiva) return;
    const nuevoIndex = direccion === 'up' ? index - 1 : index + 1;
    if (nuevoIndex < 0 || nuevoIndex >= lineas.length) return;

    const orden = [...lineas];
    [orden[index], orden[nuevoIndex]] = [orden[nuevoIndex], orden[index]];

    try {
      const res = await fetch('/api/compras-detalle', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idcompra: compraActiva,
          orden: orden.map((l) => l.iddetalle),
        }),
      });
      const data = await res.json();
      if (data.success) {
        await cargarLineas(compraActiva);
      } else {
        notificar('error', data.error || 'No se pudo reordenar');
      }
    } catch {
      notificar('error', 'Error de conexión');
    }
  };

  const rubrosFiltrados = rubros.filter((r) => {
    if (form?.destino === 'GASTOS') return r.tipo === 'GASTO';
    if (form?.destino === 'ACTIVOS') return r.tipo === 'ACTIVO';
    return false;
  });

  const borradorActual = borradores.find((b) => b.idcompra === compraActiva);

  // ---------- Render ----------

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-slate-50 dark:bg-surface-deep p-6">
        <div className="space-y-6">

          {/* Navbar */}
          <div className="rounded-xl border border-sky-200 dark:border-primary/30 bg-white dark:bg-background px-5 py-3 flex items-center justify-between gap-4 shadow-sm dark:shadow-[0_0_25px_rgba(15,23,42,0.9)]">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Compras</span>
              <span className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
              <span className="text-sm tracking-[0.18em] uppercase text-slate-700 dark:text-slate-200">Líneas de Compra</span>
            </div>
            <div className="flex items-center gap-3">
              <NotificationDropdown />
              <UserDropdown />
            </div>
          </div>

          {/* Aviso */}
          {aviso && (
            <div className={`rounded-lg border px-4 py-3 flex items-center gap-2 text-sm ${
              aviso.tipo === 'ok'
                ? 'border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300'
            }`}>
              {aviso.tipo === 'ok'
                ? <CheckCircle2 className="h-4 w-4" />
                : <AlertCircle className="h-4 w-4" />}
              {aviso.texto}
            </div>
          )}

          {/* Encabezado + acciones */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Detalle de compra</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Control 30 — borradores con líneas independientes; mismo producto puede repetirse con distinto precio
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-primary border-primary/50">
                <ListOrdered className="h-3.5 w-3.5 mr-1" />
                {borradores.length} borradores
              </Badge>
              {compraActiva && (
                <Badge variant="outline" className="text-slate-300 border-slate-600">
                  {lineas.length} líneas
                </Badge>
              )}
              <Button
                onClick={crearBorrador}
                className="bg-primary hover:bg-primary/80 text-white rounded-full"
              >
                <Plus className="h-4 w-4 mr-1" /> Nuevo borrador
              </Button>
              {compraActiva && (
                <Button
                  onClick={abrirNueva}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full"
                >
                  <Plus className="h-4 w-4 mr-1" /> Agregar línea
                </Button>
              )}
            </div>
          </div>

          {/* Nota del control 30 */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-background px-4 py-3 text-xs text-slate-500 dark:text-slate-500 dark:text-slate-400">
            Las líneas se capturan en borradores hasta que el cliente defina el encabezado completo de la factura
            (Fase 4). El descuento se guarda como porcentaje informativo; aún no se resta del subtotal.
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Panel borradores */}
            <Card className="lg:col-span-1 bg-white dark:bg-card border border-sky-200/80 dark:border-primary/30 shadow-sm dark:shadow-lg rounded-xl">
              <CardContent className="p-4">
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-4">
                  Borradores
                </h2>

                {cargando ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : borradores.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-6">
                    Sin borradores. Presione Nuevo borrador para empezar.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {borradores.map((b) => (
                      <li key={b.idcompra}>
                        <button
                          type="button"
                          onClick={() => setCompraActiva(b.idcompra)}
                          className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${
                            compraActiva === b.idcompra
                              ? 'border-primary bg-primary/10'
                              : 'border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-background hover:border-primary/60'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">#{b.idcompra}</span>
                            <Badge variant="outline" className="text-[10px] border-slate-600 text-slate-400 py-0">
                              {b.total_lineas} líneas
                            </Badge>
                          </div>
                          {b.proveedor_nombre && (
                            <p className="text-xs text-slate-500 dark:text-slate-500 truncate mt-1">{b.proveedor_nombre}</p>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {compraActiva && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={eliminarBorrador}
                    className="w-full mt-4 text-red-400 hover:text-red-300 hover:bg-red-950/30"
                  >
                    <Trash2 className="h-3 w-3 mr-1" /> Eliminar borrador
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Grid de líneas */}
            <div className="lg:col-span-3">
              {!compraActiva ? (
                <Card className="bg-white dark:bg-card border border-sky-200/80 dark:border-primary/30 shadow-sm dark:shadow-lg rounded-xl">
                  <CardContent className="p-12 text-center text-slate-500">
                    <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-40" />
                    Seleccione o cree un borrador para capturar líneas
                  </CardContent>
                </Card>
              ) : cargandoLineas ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : lineas.length === 0 ? (
                <Card className="bg-white dark:bg-card border border-sky-200/80 dark:border-primary/30 shadow-sm dark:shadow-lg rounded-xl">
                  <CardContent className="p-8 text-center text-slate-500">
                    <Package className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">Sin líneas en borrador #{compraActiva}</p>
                    <p className="text-xs mt-1">Presione Agregar línea para capturar la primera fila del documento</p>
                  </CardContent>
                </Card>
              ) : (
                <Card className="bg-white dark:bg-card border border-sky-200/80 dark:border-primary/30 shadow-sm dark:shadow-lg rounded-xl overflow-hidden">
                  <CardContent className="p-0">
                    {borradorActual?.proveedor_nombre && (
                      <div className="px-4 py-3 border-b border-slate-700/60">
                        <p className="text-xs text-slate-500 dark:text-slate-500 uppercase tracking-wider">Proveedor</p>
                        <p className="text-sm text-slate-700 dark:text-slate-200">{borradorActual.proveedor_nombre}</p>
                      </div>
                    )}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-100 dark:bg-background text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
                            <th className="px-3 py-3 text-left w-8">No.</th>
                            <th className="px-3 py-3 text-left">Orden</th>
                            <th className="px-3 py-3 text-left">Tipo</th>
                            <th className="px-3 py-3 text-left">Referencia</th>
                            <th className="px-3 py-3 text-left min-w-[160px]">Descripción</th>
                            <th className="px-3 py-3 text-right">Cant.</th>
                            <th className="px-3 py-3 text-right">Costo</th>
                            <th className="px-3 py-3 text-right">Subtotal</th>
                            <th className="px-3 py-3 text-right">IVA u.</th>
                            <th className="px-3 py-3 text-right">Sub c/IVA</th>
                            <th className="px-3 py-3 text-center">IVA</th>
                            <th className="px-3 py-3 text-right">Desc%</th>
                            <th className="px-3 py-3 text-left">Rubro</th>
                            <th className="px-3 py-3 text-center w-24">Acc.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lineas.map((l, idx) => (
                            <tr key={l.iddetalle} className="border-t border-slate-200 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-background/60">
                              <td className="px-3 py-2.5 text-slate-300">{l.numero_linea}</td>
                              <td className="px-3 py-2.5 text-slate-400">{l.numero_orden || '—'}</td>
                              <td className="px-3 py-2.5">
                                <Badge variant="outline" className="text-[10px] border-slate-600 text-slate-300 py-0">
                                  {l.destino}
                                </Badge>
                              </td>
                              <td className="px-3 py-2.5 text-slate-400 font-mono text-xs">
                                {l.referencia_proveedor || l.producto_oe || '—'}
                              </td>
                              <td className="px-3 py-2.5 text-slate-200">
                                <div className="flex items-center gap-2">
                                  {l.imagen_url && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={l.imagen_url} alt="" className="h-8 w-8 rounded object-cover" />
                                  )}
                                  <span className="truncate max-w-[200px]" title={l.descripcion}>
                                    {l.descripcion}
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-right text-slate-300 tabular-nums">{fmt4(l.cantidad)}</td>
                              <td className="px-3 py-2.5 text-right text-slate-300 tabular-nums">{fmt4(l.costo_unitario)}</td>
                              <td className="px-3 py-2.5 text-right text-slate-200 tabular-nums">{fmt2(l.subtotal_sin_iva)}</td>
                              <td className="px-3 py-2.5 text-right text-slate-400 tabular-nums">{fmt4(l.iva_unitario)}</td>
                              <td className="px-3 py-2.5 text-right text-slate-200 tabular-nums">{fmt2(l.subtotal_con_iva)}</td>
                              <td className="px-3 py-2.5 text-center">
                                <span className="text-[10px] text-slate-400">{l.condicion_iva}</span>
                              </td>
                              <td className="px-3 py-2.5 text-right text-slate-400 tabular-nums">{fmt2(l.descuento_porcentaje)}</td>
                              <td className="px-3 py-2.5 text-xs text-slate-500 dark:text-slate-500 font-mono">
                                {l.catalogo_codigo || '—'}
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    variant="ghost" size="icon"
                                    onClick={() => moverLinea(idx, 'up')}
                                    disabled={idx === 0}
                                    title="Subir"
                                    className="h-7 w-7 text-slate-400 hover:text-primary disabled:opacity-30"
                                  >
                                    <ChevronUp className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost" size="icon"
                                    onClick={() => moverLinea(idx, 'down')}
                                    disabled={idx === lineas.length - 1}
                                    title="Bajar"
                                    className="h-7 w-7 text-slate-400 hover:text-primary disabled:opacity-30"
                                  >
                                    <ChevronDown className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost" size="icon"
                                    onClick={() => abrirEditar(l)}
                                    title="Editar"
                                    className="h-7 w-7 text-slate-400 hover:text-primary"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost" size="icon"
                                    onClick={() => eliminarLinea(l.iddetalle)}
                                    title="Eliminar"
                                    className="h-7 w-7 text-slate-400 hover:text-red-400"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

        </div>

        {/* Modal formulario línea */}
        {form && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <Card className="bg-white dark:bg-card border border-sky-200/80 dark:border-primary/30 shadow-sm dark:shadow-lg rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                    {form.iddetalle ? 'Editar línea' : 'Nueva línea'}
                  </h3>
                  <button type="button" onClick={() => setForm(null)} className="text-slate-400 hover:text-slate-800 dark:hover:text-slate-200">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Búsqueda producto */}
                  <div className="sm:col-span-2">
                    <Label className={LABEL_CLS}>Producto (opcional)</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <Input
                        className={`${INPUT_CLS} pl-9`}
                        placeholder="Buscar por nombre, OE, código..."
                        value={busquedaProd}
                        onChange={(e) => buscarProductos(e.target.value)}
                      />
                      {buscandoProd && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />
                      )}
                    </div>
                    {productos.length > 0 && (
                      <ul className="mt-1 rounded-md border border-slate-700 bg-surface-deep max-h-40 overflow-y-auto">
                        {productos.map((p) => (
                          <li key={p.idprod}>
                            <button
                              type="button"
                              onClick={() => seleccionarProducto(p)}
                              className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-primary/10"
                            >
                              <span className="font-medium">{p.nombre}</span>
                              {p.OE && <span className="text-slate-500 ml-2 font-mono text-xs">{p.OE}</span>}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {form.idprod && (
                      <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">ID producto: {form.idprod}</p>
                    )}
                  </div>

                  <div>
                    <Label className={LABEL_CLS}>Orden OT</Label>
                    <Input
                      className={INPUT_CLS}
                      value={form.numero_orden}
                      onChange={(e) => setForm({ ...form, numero_orden: e.target.value })}
                      placeholder="Ej: OT-2024-001"
                    />
                  </div>

                  <div>
                    <Label className={LABEL_CLS}>Destino (Control 29)</Label>
                    <select
                      className={SELECT_CLS}
                      value={form.destino}
                      onChange={(e) => setForm({ ...form, destino: e.target.value, idcatalogo: '' })}
                    >
                      {DESTINOS.map((d) => (
                        <option key={d.valor} value={d.valor}>{d.etiqueta}</option>
                      ))}
                    </select>
                  </div>

                  {requiereCatalogo(form.destino) && (
                    <div className="sm:col-span-2">
                      <Label className={LABEL_CLS}>Rubro contable (Control 29.1) *</Label>
                      <select
                        className={SELECT_CLS}
                        value={form.idcatalogo}
                        onChange={(e) => {
                          const rubro = rubrosFiltrados.find((r) => String(r.idcatalogo) === e.target.value);
                          setForm({
                            ...form,
                            idcatalogo: e.target.value,
                            descripcion: rubro && !form.idprod ? rubro.nombre : form.descripcion,
                            condicion_iva: rubro?.condicion_iva_sugerida || form.condicion_iva,
                          });
                        }}
                      >
                        <option value="">— Seleccionar rubro —</option>
                        {rubrosFiltrados.map((r) => (
                          <option key={r.idcatalogo} value={r.idcatalogo}>
                            {r.codigo} — {r.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <Label className={LABEL_CLS}>Referencia proveedor</Label>
                    <Input
                      className={INPUT_CLS}
                      value={form.referencia_proveedor}
                      onChange={(e) => setForm({ ...form, referencia_proveedor: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label className={LABEL_CLS}>Condición IVA (Control 19)</Label>
                    <select
                      className={SELECT_CLS}
                      value={form.condicion_iva}
                      onChange={(e) => setForm({ ...form, condicion_iva: e.target.value })}
                    >
                      {CONDICIONES_IVA.map((c) => (
                        <option key={c.valor} value={c.valor}>{c.etiqueta}</option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <Label className={LABEL_CLS}>Descripción *</Label>
                    <Input
                      className={INPUT_CLS}
                      value={form.descripcion}
                      onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                      readOnly={!!form.idprod}
                      title={form.idprod ? 'Viene del inventario (control 30)' : undefined}
                    />
                  </div>

                  <div>
                    <Label className={LABEL_CLS}>Cantidad</Label>
                    <Input
                      className={INPUT_CLS}
                      type="number"
                      step="0.0001"
                      value={form.cantidad}
                      onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label className={LABEL_CLS}>Costo unitario (4 dec.)</Label>
                    <Input
                      className={INPUT_CLS}
                      type="number"
                      step="0.0001"
                      value={form.costo_unitario}
                      onChange={(e) => setForm({ ...form, costo_unitario: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label className={LABEL_CLS}>Descuento %</Label>
                    <Input
                      className={INPUT_CLS}
                      type="number"
                      step="0.01"
                      value={form.descuento_porcentaje}
                      onChange={(e) => setForm({ ...form, descuento_porcentaje: e.target.value })}
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">Informativo hasta confirmar con el cliente</p>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <Button variant="ghost" onClick={() => setForm(null)} className="text-slate-400">
                    Cancelar
                  </Button>
                  <Button
                    onClick={guardarLinea}
                    disabled={guardando}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-6"
                  >
                    {guardando ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                    Guardar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
