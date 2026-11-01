'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  Ban,
  CheckCircle2,
  Download,
  FilePlus2,
  ListPlus,
  Lock,
  Printer,
  RotateCcw,
  Save,
  Search,
  Trash2,
} from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { NotificationDropdown } from '@/components/notification-dropdown';
import { UserDropdown } from '@/components/user-dropdown';
import { UI } from '@/lib/ui';
import { CATEGORIAS_OPERACION } from '@/lib/compras-constantes';
import {
  INCOTERMS,
  MONEDAS,
  TIPOS_DOCUMENTO_COMPRA,
  etiquetaTipo,
  tipoSiguiente,
} from '@/lib/documentos-compras-constantes';
import { GrillaLineas } from './_components/GrillaLineas';
import { DialogoTemporal } from './_components/DialogoTemporal';
import { DialogoLineas, type Seleccion } from './_components/DialogoLineas';
import { exportarExcel, imprimirOrden } from './_components/exportar';
import {
  COLOR_ESTADO,
  fechaInput,
  fmtMoneda,
  type Contacto,
  type Derivado,
  type Documento,
  type DocumentoLista,
  type LineaDocumento,
  type ProveedorHit,
} from './_components/tipos';

type Aviso = { tipo: 'ok' | 'error'; texto: string } | null;
type Selector =
  | { modo: 'derivar' }
  | { modo: 'cargar'; solicitudes: DocumentoLista[]; idorigen: number | null; lineas: LineaDocumento[] }
  | null;

type FormEncabezado = Record<
  | 'idcontacto'
  | 'categoria_operacion'
  | 'fecha_documento'
  | 'moneda_documento'
  | 'tipo_cambio'
  | 'incoterm'
  | 'fecha_est_entrega'
  | 'condicion_pago'
  | 'acuerdo_pago'
  | 'comentarios',
  string
>;

const idDeUrl = () =>
  typeof window === 'undefined' ? null : Number(new URLSearchParams(window.location.search).get('id')) || null;

function aForm(d: Documento): FormEncabezado {
  return {
    idcontacto: d.idcontacto ? String(d.idcontacto) : '',
    categoria_operacion: d.categoria_operacion,
    fecha_documento: fechaInput(d.fecha_documento),
    moneda_documento: d.moneda_documento,
    tipo_cambio: String(Number(d.tipo_cambio)),
    incoterm: d.incoterm ?? '',
    fecha_est_entrega: fechaInput(d.fecha_est_entrega),
    condicion_pago: d.condicion_pago,
    acuerdo_pago: d.acuerdo_pago ?? '',
    comentarios: d.comentarios ?? '',
  };
}

async function pedir(url: string, metodo = 'GET', cuerpo?: unknown) {
  const res = await fetch(url, {
    method: metodo,
    headers: cuerpo ? { 'Content-Type': 'application/json' } : undefined,
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error en la solicitud');
  return data;
}

export default function DocumentosCompraPage() {
  const [lista, setLista] = useState<DocumentoLista[]>([]);
  const [filtros, setFiltros] = useState({ tipo: '', estado: '', q: '' });
  const [idActual, setIdActual] = useState<number | null>(idDeUrl);
  const [documento, setDocumento] = useState<Documento | null>(null);
  const [lineas, setLineas] = useState<LineaDocumento[]>([]);
  const [derivados, setDerivados] = useState<Derivado[]>([]);
  const [form, setForm] = useState<FormEncabezado | null>(null);
  const [contactosDe, setContactosDe] = useState<{ idproveedor: number; lista: Contacto[] } | null>(null);
  const [provTexto, setProvTexto] = useState('');
  const [provHits, setProvHits] = useState<ProveedorHit[]>([]);
  const [tipoNuevo, setTipoNuevo] = useState<string>('SOLICITUD');
  const [temporal, setTemporal] = useState<number | null>(null);
  const [selector, setSelector] = useState<Selector>(null);
  const [preguntaProceso, setPreguntaProceso] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);

  const notificar = useCallback((tipo: 'ok' | 'error', texto: string) => {
    setAviso({ tipo, texto });
    setTimeout(() => setAviso(null), 4000);
  }, []);
  const notificarError = useCallback((t: string) => notificar('error', t), [notificar]);

  const cargarLista = useCallback(async () => {
    const params = new URLSearchParams();
    if (filtros.tipo) params.set('tipo', filtros.tipo);
    if (filtros.estado) params.set('estado', filtros.estado);
    if (filtros.q.trim()) params.set('q', filtros.q.trim());
    try {
      const data = await pedir(`/api/documentos-compras?${params}`);
      setLista(data.documentos);
    } catch (e) {
      notificar('error', (e as Error).message);
    }
  }, [filtros, notificar]);

  const aplicarDocumento = useCallback((data: { documento: Documento; lineas: LineaDocumento[]; derivados: Derivado[] }) => {
    setDocumento(data.documento);
    setLineas(data.lineas);
    setDerivados(data.derivados);
    setForm(aForm(data.documento));
    window.history.replaceState(null, '', `/dashboard/compras/documentos?id=${data.documento.iddocumento}`);
  }, []);

  const cargarDocumento = useCallback(
    async (id: number) => {
      try {
        aplicarDocumento(await pedir(`/api/documentos-compras?id=${id}`));
      } catch (e) {
        notificar('error', (e as Error).message);
        setDocumento(null);
      }
    },
    [notificar, aplicarDocumento]
  );

  useEffect(() => {
    const t = setTimeout(cargarLista, 250);
    return () => clearTimeout(t);
  }, [cargarLista]);

  useEffect(() => {
    if (!idActual) return;
    let vigente = true;
    pedir(`/api/documentos-compras?id=${idActual}`)
      .then((data) => vigente && aplicarDocumento(data))
      .catch((e: Error) => vigente && notificar('error', e.message));
    return () => {
      vigente = false;
    };
  }, [idActual, aplicarDocumento, notificar]);

  const idproveedor = documento?.idproveedor ?? null;
  const contactos = idproveedor && contactosDe?.idproveedor === idproveedor ? contactosDe.lista : [];
  useEffect(() => {
    if (!idproveedor) return;
    let vigente = true;
    pedir(`/api/proveedores?id=${idproveedor}`)
      .then((data) => vigente && setContactosDe({ idproveedor, lista: data.contactos || [] }))
      .catch(() => vigente && setContactosDe({ idproveedor, lista: [] }));
    return () => {
      vigente = false;
    };
  }, [idproveedor]);

  useEffect(() => {
    const q = provTexto.trim();
    if (q.length < 2) return;
    let vigente = true;
    const t = setTimeout(async () => {
      try {
        const data = await pedir(`/api/proveedores?q=${encodeURIComponent(q)}&activo=true`);
        if (vigente) setProvHits((data.proveedores || []).slice(0, 8));
      } catch {
        if (vigente) setProvHits([]);
      }
    }, 250);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [provTexto]);

  const recargar = async () => {
    if (documento) await cargarDocumento(documento.iddocumento);
    await cargarLista();
  };

  const accion = async (fn: () => Promise<{ mensaje?: string; iddocumento?: number }>, abrirNuevo = false) => {
    try {
      const data = await fn();
      if (data.mensaje) notificar('ok', data.mensaje);
      if (abrirNuevo && data.iddocumento) {
        setIdActual(data.iddocumento);
        await cargarDocumento(data.iddocumento);
        await cargarLista();
      } else {
        await recargar();
      }
    } catch (e) {
      notificar('error', (e as Error).message);
    }
  };

  const editable = documento?.estado_documento === 'BORRADOR';
  const siguiente = documento ? tipoSiguiente(documento.tipo_documento) : null;

  const guardar = useCallback(async () => {
    if (!documento || !form || documento.estado_documento !== 'BORRADOR') return;
    try {
      await pedir('/api/documentos-compras', 'PUT', { iddocumento: documento.iddocumento, ...form });
      notificar('ok', 'Documento guardado');
      await cargarDocumento(documento.iddocumento);
      await cargarLista();
    } catch (e) {
      notificar('error', (e as Error).message);
    }
  }, [documento, form, notificar, cargarDocumento, cargarLista]);

  useEffect(() => {
    const atajo = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        guardar();
      }
    };
    window.addEventListener('keydown', atajo);
    return () => window.removeEventListener('keydown', atajo);
  }, [guardar]);

  const elegirProveedor = (p: ProveedorHit) => {
    setProvTexto('');
    setProvHits([]);
    if (!documento) return;
    accion(() =>
      pedir('/api/documentos-compras', 'PUT', {
        iddocumento: documento.iddocumento,
        idproveedor: p.idproveedor,
        ambito_operacion: p.tipo_proveedor === 'LOCAL' ? 'NACIONAL' : 'INTERNACIONAL',
      })
    );
  };

  const campo = (k: keyof FormEncabezado, v: string) => form && setForm({ ...form, [k]: v });

  const finalizar = (crear_proceso = false) => {
    if (!documento) return;
    setPreguntaProceso(false);
    accion(() => pedir('/api/documentos-compras', 'PUT', { iddocumento: documento.iddocumento, accion: 'finalizar', crear_proceso }));
  };

  const abrirCargarSolicitud = async () => {
    if (!documento) return;
    try {
      const data = await pedir('/api/documentos-compras?tipo=SOLICITUD');
      const solicitudes = (data.documentos as DocumentoLista[]).filter(
        (s) => s.estado_documento !== 'ANULADO' && (!s.idproceso || s.idproceso === documento.idproceso)
      );
      if (solicitudes.length === 0) return notificar('error', 'No hay solicitudes sin proceso o de este mismo proceso');
      setSelector({ modo: 'cargar', solicitudes, idorigen: null, lineas: [] });
    } catch (e) {
      notificar('error', (e as Error).message);
    }
  };

  const elegirSolicitud = async (idorigen: number) => {
    if (selector?.modo !== 'cargar') return;
    try {
      const data = await pedir(`/api/documentos-compras?id=${idorigen}`);
      setSelector({ ...selector, idorigen, lineas: data.lineas });
    } catch (e) {
      notificar('error', (e as Error).message);
    }
  };

  const confirmarSelector = (seleccion: Seleccion) => {
    if (!documento || !selector) return;
    const actual = selector;
    setSelector(null);
    if (actual.modo === 'derivar') {
      accion(() => pedir('/api/documentos-compras', 'POST', { accion: 'derivar', iddocumento: documento.iddocumento, lineas: seleccion }), true);
    } else if (actual.idorigen) {
      accion(() =>
        pedir('/api/documentos-compras', 'POST', { accion: 'cargar', iddocumento: documento.iddocumento, idorigen: actual.idorigen, lineas: seleccion })
      );
    }
  };

  const imprimir = async () => {
    if (!documento) return;
    try {
      const proveedor = documento.idproveedor ? (await pedir(`/api/proveedores?id=${documento.idproveedor}`)).proveedor : null;
      await imprimirOrden(documento, lineas, proveedor);
    } catch {
      notificar('error', 'No se pudo generar el PDF');
    }
  };

  return (
    <DashboardLayout>
      <div className={`${UI.canvas} flex flex-col gap-2 lg:h-[calc(100vh-3rem)]`}>
        <div className={`${UI.navbar} shrink-0`}>
          <div className="flex items-center gap-3">
            <span className={UI.navLabel}>Compras</span>
            <span className={UI.navDivider} />
            <span className={UI.navTitle}>Solicitudes, cotizaciones, órdenes y proformas</span>
          </div>
          <div className="flex items-center gap-3">
            <NotificationDropdown />
            <UserDropdown />
          </div>
        </div>

        <div className="grid gap-2 lg:flex-1 lg:min-h-0 lg:grid-cols-[18rem_1fr]">
          <aside className={`${UI.densePanel} flex flex-col min-h-[16rem] lg:min-h-0`}>
            <div className="flex flex-col gap-1.5 p-2 border-b border-border">
              <div className="flex gap-1.5">
                <select className={`${UI.denseSelect} flex-1`} value={tipoNuevo} onChange={(e) => setTipoNuevo(e.target.value)}>
                  {TIPOS_DOCUMENTO_COMPRA.map((t) => (
                    <option key={t.valor} value={t.valor}>
                      {t.etiqueta}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={UI.denseBtnPrimary}
                  onClick={() => accion(() => pedir('/api/documentos-compras', 'POST', { tipo_documento: tipoNuevo }), true)}
                >
                  <FilePlus2 className="h-3.5 w-3.5" /> Nuevo
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  className={`${UI.denseInput} w-full pl-7`}
                  placeholder="Número o proveedor"
                  value={filtros.q}
                  onChange={(e) => setFiltros({ ...filtros, q: e.target.value })}
                />
              </div>
              <div className="flex gap-1.5">
                <select className={`${UI.denseSelect} flex-1`} value={filtros.tipo} onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value })}>
                  <option value="">Todos los tipos</option>
                  {TIPOS_DOCUMENTO_COMPRA.map((t) => (
                    <option key={t.valor} value={t.valor}>
                      {t.etiqueta}
                    </option>
                  ))}
                </select>
                <select className={`${UI.denseSelect} flex-1`} value={filtros.estado} onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}>
                  <option value="">Todos</option>
                  <option value="BORRADOR">Borrador</option>
                  <option value="FINALIZADO">Finalizado</option>
                  <option value="ANULADO">Anulado</option>
                </select>
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              {lista.length === 0 ? (
                <p className="p-4 text-xs text-center text-muted-foreground">Sin documentos.</p>
              ) : (
                lista.map((d) => (
                  <button
                    key={d.iddocumento}
                    type="button"
                    onClick={() => setIdActual(d.iddocumento)}
                    className={`w-full text-left px-2.5 py-1.5 border-b border-border text-xs ${
                      d.iddocumento === documento?.iddocumento ? UI.denseRowActive : 'hover:bg-muted/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`${UI.denseMono} font-semibold`}>{d.id_documento}</span>
                      <span className={`rounded px-1 text-[9px] font-semibold ${COLOR_ESTADO[d.estado_documento]}`}>{d.estado_documento}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-muted-foreground">
                      <span className="truncate">{d.proveedor_nombre || 'Sin proveedor'}</span>
                      <span className={`${UI.denseMono} shrink-0`}>
                        {d.moneda_documento} {fmtMoneda(d.total_moneda)}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </aside>

          <section className="flex flex-col gap-2 min-h-0 lg:overflow-y-auto">
            {!documento || !form ? (
              <div className={`${UI.densePanel} flex-1 flex flex-col items-center justify-center gap-2 py-16 text-center`}>
                <p className="text-sm text-muted-foreground">Elija un documento de la lista o cree uno nuevo.</p>
                <p className="text-xs text-muted-foreground max-w-md">
                  Flujo: Solicitud → Cotización → Orden de compra → Proforma. La factura del proveedor se ingresa en{' '}
                  <Link href="/dashboard/compras/ingreso" className="text-primary underline">
                    Ingreso de Compras
                  </Link>
                  .
                </p>
              </div>
            ) : (
              <>
                <div className={`${UI.densePanel} flex flex-wrap items-center gap-2 px-3 py-2 shrink-0`}>
                  <span className="text-sm font-semibold">{etiquetaTipo(documento.tipo_documento)}</span>
                  <span className={`${UI.denseMono} text-sm`}>{documento.id_documento}</span>
                  <span className={`rounded px-1.5 text-[10px] font-semibold ${COLOR_ESTADO[documento.estado_documento]}`}>
                    {documento.estado_documento}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {documento.ambito_operacion === 'NACIONAL' ? 'Nacional' : 'Internacional'}
                  </span>
                  {documento.origen_id && (
                    <button type="button" className="text-[11px] text-primary hover:underline" onClick={() => setIdActual(documento.origen_id)}>
                      ← desde {documento.origen_numero}
                    </button>
                  )}
                  {documento.proceso_codigo && (
                    <Link href={`/dashboard/compras/procesos?id=${documento.idproceso}`} className="text-[11px] text-primary hover:underline">
                      Proceso {documento.proceso_codigo}
                    </Link>
                  )}
                  {derivados.map((d) => (
                    <button
                      key={d.iddocumento}
                      type="button"
                      className={`text-[11px] hover:underline ${d.estado_documento === 'ANULADO' ? 'text-muted-foreground line-through' : 'text-primary'}`}
                      onClick={() => setIdActual(d.iddocumento)}
                    >
                      → {d.id_documento}
                    </button>
                  ))}

                  <div className="ml-auto flex flex-wrap gap-1.5">
                    {editable && (
                      <button type="button" className={UI.denseBtn} onClick={guardar} title="Ctrl+S">
                        <Save className="h-3.5 w-3.5" /> Guardar
                      </button>
                    )}
                    {editable && documento.tipo_documento === 'COTIZACION' && (
                      <button type="button" className={UI.denseBtn} onClick={abrirCargarSolicitud}>
                        <ListPlus className="h-3.5 w-3.5" /> Cargar solicitud
                      </button>
                    )}
                    <button type="button" className={UI.denseBtn} disabled={lineas.length === 0} onClick={() => exportarExcel(documento, lineas)}>
                      <Download className="h-3.5 w-3.5" /> Excel
                    </button>
                    {documento.tipo_documento === 'ORDEN' && (
                      <button type="button" className={UI.denseBtn} disabled={lineas.length === 0} onClick={imprimir}>
                        <Printer className="h-3.5 w-3.5" /> PDF
                      </button>
                    )}
                    {siguiente && documento.estado_documento !== 'ANULADO' && (
                      <button type="button" className={UI.denseBtnPrimary} disabled={lineas.length === 0} onClick={() => setSelector({ modo: 'derivar' })}>
                        <ArrowRight className="h-3.5 w-3.5" /> Generar {etiquetaTipo(siguiente)}
                      </button>
                    )}
                    {editable && (
                      <button
                        type="button"
                        className={UI.denseBtn}
                        onClick={() => (documento.tipo_documento === 'SOLICITUD' && !documento.idproceso ? setPreguntaProceso(true) : finalizar())}
                      >
                        <Lock className="h-3.5 w-3.5" /> Finalizar
                      </button>
                    )}
                    {documento.estado_documento === 'FINALIZADO' && (
                      <button
                        type="button"
                        className={UI.denseBtn}
                        onClick={() => accion(() => pedir('/api/documentos-compras', 'PUT', { iddocumento: documento.iddocumento, accion: 'reabrir' }))}
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Reabrir
                      </button>
                    )}
                    {documento.estado_documento !== 'ANULADO' && (
                      <button
                        type="button"
                        className={UI.denseBtnDanger}
                        onClick={() =>
                          confirm(`¿Anular ${documento.id_documento}?`) &&
                          accion(() => pedir('/api/documentos-compras', 'PUT', { iddocumento: documento.iddocumento, accion: 'anular' }))
                        }
                      >
                        <Ban className="h-3.5 w-3.5" /> Anular
                      </button>
                    )}
                    {editable && (
                      <button
                        type="button"
                        className={UI.denseBtnDanger}
                        onClick={async () => {
                          if (!confirm(`¿Eliminar el borrador ${documento.id_documento}?`)) return;
                          try {
                            await pedir(`/api/documentos-compras?id=${documento.iddocumento}`, 'DELETE');
                            notificar('ok', 'Borrador eliminado');
                            setDocumento(null);
                            setIdActual(null);
                            window.history.replaceState(null, '', '/dashboard/compras/documentos');
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

                <div className={`${UI.densePanel} shrink-0`}>
                  <div className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="relative flex flex-col gap-1 sm:col-span-2">
                      <span className={UI.denseLabel}>Proveedor</span>
                      <input
                        className={UI.denseInput}
                        disabled={!editable}
                        placeholder={documento.proveedor_nombre ? `${documento.proveedor_codigo} — ${documento.proveedor_nombre}` : 'Alias, nombre, NIT o NRC'}
                        value={provTexto}
                        onChange={(e) => setProvTexto(e.target.value)}
                        onBlur={() => setTimeout(() => setProvHits([]), 150)}
                      />
                      {provHits.length > 0 && provTexto.trim().length >= 2 && (
                        <div className={`${UI.dropdown} absolute left-0 right-0 top-full mt-1 max-h-56 overflow-y-auto`}>
                          {provHits.map((p) => (
                            <button
                              key={p.idproveedor}
                              type="button"
                              className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted flex gap-2"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                elegirProveedor(p);
                              }}
                            >
                              <span className={`${UI.denseMono} w-16 shrink-0`}>{p.codigo}</span>
                              <span className="flex-1 truncate">{p.nombre_legal}</span>
                              <span className="text-muted-foreground">{p.tipo_proveedor === 'LOCAL' ? 'Local' : 'Extranjero'}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {documento.proveedor_nombre && (
                        <span className="text-[11px] text-muted-foreground truncate">
                          {documento.proveedor_codigo} — {documento.proveedor_nombre}
                        </span>
                      )}
                    </div>
                    <label className="flex flex-col gap-1">
                      <span className={UI.denseLabel}>Contacto</span>
                      <select className={UI.denseSelect} disabled={!editable || contactos.length === 0} value={form.idcontacto} onChange={(e) => campo('idcontacto', e.target.value)}>
                        <option value="">{contactos.length ? 'Sin contacto' : 'El proveedor no tiene contactos'}</option>
                        {contactos.map((c) => (
                          <option key={c.idcontacto} value={c.idcontacto}>
                            {c.nombre || 'Sin nombre'}
                            {c.puesto_cargo ? ` (${c.puesto_cargo})` : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className={UI.denseLabel}>Fecha</span>
                      <input type="date" className={UI.denseInput} disabled={!editable} value={form.fecha_documento} onChange={(e) => campo('fecha_documento', e.target.value)} />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className={UI.denseLabel}>Moneda</span>
                      <select
                        className={UI.denseSelect}
                        disabled={!editable}
                        value={form.moneda_documento}
                        onChange={(e) =>
                          setForm({ ...form, moneda_documento: e.target.value, tipo_cambio: e.target.value === 'USD' ? '1' : form.tipo_cambio })
                        }
                      >
                        {MONEDAS.map((m) => (
                          <option key={m}>{m}</option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className={UI.denseLabel} title="Dólares por unidad de la moneda">
                        Tipo de cambio (USD por {form.moneda_documento})
                      </span>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        className={`${UI.denseInput} text-right ${UI.denseMono}`}
                        disabled={!editable || form.moneda_documento === 'USD'}
                        value={form.tipo_cambio}
                        onChange={(e) => campo('tipo_cambio', e.target.value)}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className={UI.denseLabel}>Incoterm</span>
                      <select className={UI.denseSelect} disabled={!editable} value={form.incoterm} onChange={(e) => campo('incoterm', e.target.value)}>
                        <option value="">—</option>
                        {INCOTERMS.map((i) => (
                          <option key={i}>{i}</option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className={UI.denseLabel}>Entrega estimada</span>
                      <input type="date" className={UI.denseInput} disabled={!editable} value={form.fecha_est_entrega} onChange={(e) => campo('fecha_est_entrega', e.target.value)} />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className={UI.denseLabel}>Categoría</span>
                      <select className={UI.denseSelect} disabled={!editable} value={form.categoria_operacion} onChange={(e) => campo('categoria_operacion', e.target.value)}>
                        {CATEGORIAS_OPERACION.map((c) => (
                          <option key={c.valor} value={c.valor} title={c.ayuda}>{c.etiqueta}</option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className={UI.denseLabel}>Condición de pago</span>
                      <select className={UI.denseSelect} disabled={!editable} value={form.condicion_pago} onChange={(e) => campo('condicion_pago', e.target.value)}>
                        <option value="CONTADO">Contado</option>
                        <option value="CREDITO">Crédito</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 sm:col-span-2">
                      <span className={UI.denseLabel}>Acuerdo de pago</span>
                      <input
                        className={UI.denseInput}
                        disabled={!editable}
                        placeholder="Ej.: 30% anticipo / 70% contra entrega"
                        value={form.acuerdo_pago}
                        onChange={(e) => campo('acuerdo_pago', e.target.value)}
                      />
                    </label>
                    <label className="flex flex-col gap-1 sm:col-span-2 xl:col-span-4">
                      <span className={UI.denseLabel}>Comentarios</span>
                      <input className={UI.denseInput} disabled={!editable} value={form.comentarios} onChange={(e) => campo('comentarios', e.target.value)} />
                    </label>
                  </div>
                </div>

                <GrillaLineas
                  documento={documento}
                  lineas={lineas}
                  editable={editable}
                  onAgregar={async (cuerpo) => {
                    try {
                      const data = await pedir('/api/documentos-compras-detalle', 'POST', cuerpo);
                      if (data.idtemporal && !cuerpo.idprod) notificar('ok', 'Producto temporal creado; agregue imágenes desde su código');
                      await recargar();
                      return true;
                    } catch (e) {
                      notificar('error', (e as Error).message);
                      return false;
                    }
                  }}
                  onActualizar={(iddetalle, cambios) => accion(() => pedir('/api/documentos-compras-detalle', 'PUT', { iddetalle, ...cambios }))}
                  onReordenar={(orden) => accion(() => pedir('/api/documentos-compras-detalle', 'PUT', { iddocumento: documento.iddocumento, orden }))}
                  onEliminar={(l) =>
                    confirm(`¿Quitar la línea ${l.linea_visual}?`) &&
                    accion(() => pedir(`/api/documentos-compras-detalle?id=${l.iddetalle}`, 'DELETE'))
                  }
                  onTemporal={setTemporal}
                />
              </>
            )}
          </section>
        </div>
      </div>

      <DialogoTemporal
        idtemporal={temporal}
        onCerrar={() => setTemporal(null)}
        onCambio={(m) => {
          notificar('ok', m);
          recargar();
        }}
        onError={notificarError}
      />

      {documento && selector?.modo === 'derivar' && siguiente && (
        <DialogoLineas
          titulo={`Generar ${etiquetaTipo(siguiente)} desde ${documento.id_documento}`}
          lineas={lineas}
          textoConfirmar={`Generar ${etiquetaTipo(siguiente)}`}
          onConfirmar={confirmarSelector}
          onCerrar={() => setSelector(null)}
        />
      )}
      {documento && selector?.modo === 'cargar' && (
        <DialogoLineas
          titulo={`Cargar líneas de una solicitud en ${documento.id_documento}`}
          lineas={selector.lineas}
          textoConfirmar="Cargar líneas"
          encabezado={
            <label className="flex items-center gap-2 text-xs">
              <span className={UI.denseLabel}>Solicitud</span>
              <select className={`${UI.denseSelect} flex-1`} value={selector.idorigen ?? ''} onChange={(e) => e.target.value && elegirSolicitud(Number(e.target.value))}>
                <option value="">Elija una solicitud…</option>
                {selector.solicitudes.map((s) => (
                  <option key={s.iddocumento} value={s.iddocumento}>
                    {s.id_documento} · {s.proveedor_nombre || 'Sin proveedor'} · {s.total_lineas} línea(s){s.idproceso ? ' · mismo proceso' : ''}
                  </option>
                ))}
              </select>
            </label>
          }
          onConfirmar={confirmarSelector}
          onCerrar={() => setSelector(null)}
        />
      )}
      {documento && preguntaProceso && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPreguntaProceso(false)}>
          <div className={`${UI.densePanel} w-full max-w-sm`} onClick={(e) => e.stopPropagation()}>
            <div className={UI.densePanelTitle}>Finalizar {documento.id_documento}</div>
            <div className="flex flex-col gap-3 p-3">
              <p className="text-sm">¿Crear proceso de ingreso ahora o solo cotizar?</p>
              <p className="text-[11px] text-muted-foreground">
                Si crea el proceso, esta solicitud queda como su primer documento y lo que se genere después entra en él.
              </p>
              <div className="flex justify-end gap-1.5">
                <button type="button" className={UI.denseBtn} onClick={() => setPreguntaProceso(false)}>
                  Cancelar
                </button>
                <button type="button" className={UI.denseBtn} onClick={() => finalizar(false)}>
                  Solo cotizar
                </button>
                <button type="button" className={UI.denseBtnPrimary} onClick={() => finalizar(true)}>
                  Crear proceso
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
