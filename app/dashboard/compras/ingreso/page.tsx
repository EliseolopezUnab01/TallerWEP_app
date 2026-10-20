'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { NotificationDropdown } from '@/components/notification-dropdown';
import { UserDropdown } from '@/components/user-dropdown';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { UI } from '@/lib/ui';
import {
  TIPOS_DTE_COMPRAS,
  CONDICIONES_OPERACION,
  PLAZOS,
  tipoDteRequiereRelacionados,
} from '@/lib/compras-constantes';
import { calcularResumen, type LineaResumen } from '@/lib/compras-resumen';
import {
  AlertCircle, CheckCircle2, FilePlus, Loader2, Plus, Save, Trash2,
  Pencil, ChevronUp, ChevronDown, Ban, Check, X,
} from 'lucide-react';

interface CompraLista {
  idcompra: number;
  estado: string;
  tipo_dte: string | null;
  tipo_dte_abrev: string | null;
  idproveedor: number | null;
  proveedor_codigo: string | null;
  proveedor_nombre: string | null;
  numero_factura: string | null;
  fecha_emision: string | null;
  total_pagar: number;
  total_lineas: number;
  updated_at: string;
}

interface Compra {
  idcompra: number;
  estado: string;
  tipo_dte: string | null;
  idproveedor: number | null;
  proveedor_codigo: string | null;
  proveedor_nombre: string | null;
  proveedor_nrc: string | null;
  proveedor_nit: string | null;
  notas: string | null;
  numero_control: string | null;
  codigo_generacion: string | null;
  sello_recepcion: string | null;
  numero_factura: string | null;
  referencia_contable: string | null;
  fecha_emision: string | null;
  fecha_recepcion: string | null;
  fecha_registro: string | null;
  descuento_global_gravado: number;
  descuento_global_exento: number;
  descuento_global_no_sujeto: number;
  porcentaje_descuento: number;
  iva_retenido: number;
  iva_percibido: number;
  retencion_renta: number;
  condicion_operacion: number | null;
  plazo_tipo: string | null;
  plazo_periodo: number | null;
  fecha_vencimiento_pago: string | null;
  total_pagar: number;
  valor_en_letras: string | null;
}

interface Linea {
  iddetalle: number;
  numero_linea: number;
  numero_orden: string | null;
  destino: string;
  idcatalogo: number | null;
  catalogo_nombre: string | null;
  idprod: number | null;
  referencia_proveedor: string | null;
  descripcion: string;
  cantidad: number;
  costo_unitario: number;
  descuento_porcentaje: number;
  subtotal_sin_iva: number;
  iva_unitario: number;
  subtotal_con_iva: number;
  condicion_iva: string;
  numero_documento_rel: string | null;
  codigo_tributo: string | null;
  cargos_no_afectos: number;
}

interface Pago {
  idpago: number;
  codigo_forma_pago: string;
  forma_pago_nombre: string;
  monto: number;
  referencia: string | null;
  plazo_tipo: string | null;
  plazo_periodo: number | null;
}

interface DocRel {
  idrelacion: number;
  tipo_dte_relacionado: string;
  tipo_generacion: number;
  numero_documento: string;
  fecha_generacion: string;
  abreviatura: string | null;
}

interface ProveedorHit {
  idproveedor: number;
  codigo: string;
  nombre_legal: string;
  nit: string | null;
  nrc: string | null;
}

interface Catalogos {
  tipos_dte: { codigo: string; nombre: string; abreviatura: string }[];
  formas_pago: { codigo: string; nombre: string }[];
  tributos: { codigo: string; nombre: string }[];
}

interface Rubro {
  idcatalogo: number;
  tipo: string;
  codigo: string;
  nombre: string;
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
  codigo_tributo: string;
  cargos_no_afectos: string;
  numero_documento_rel: string;
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
  codigo_tributo: '20',
  cargos_no_afectos: '0',
  numero_documento_rel: '',
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

function fmt2(n: number | string | null | undefined) {
  return Number(n || 0).toFixed(2);
}

function fechaInput(valor: string | null | undefined) {
  if (!valor) return '';
  return String(valor).slice(0, 10);
}

export default function IngresoCompraPage() {
  const [lista, setLista] = useState<CompraLista[]>([]);
  const [filtroEstado, setFiltroEstado] = useState('BORRADOR');
  const [idActivo, setIdActivo] = useState<number | null>(null);
  const [compra, setCompra] = useState<Compra | null>(null);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [docsRel, setDocsRel] = useState<DocRel[]>([]);
  const [catalogos, setCatalogos] = useState<Catalogos>({ tipos_dte: [], formas_pago: [], tributos: [] });
  const [rubros, setRubros] = useState<Rubro[]>([]);

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const [formLinea, setFormLinea] = useState<FormLinea | null>(null);
  const [busquedaProv, setBusquedaProv] = useState('');
  const [proveedores, setProveedores] = useState<ProveedorHit[]>([]);
  const [busquedaProd, setBusquedaProd] = useState('');
  const [productos, setProductos] = useState<{ idprod: number; nombre: string; OE: string | null }[]>([]);

  const [formPago, setFormPago] = useState({ codigo: '01', monto: '', referencia: '' });
  const [formRel, setFormRel] = useState({
    tipo_dte_relacionado: '03',
    tipo_generacion: '2',
    numero_documento: '',
    fecha_generacion: '',
  });

  const notificar = (tipo: 'ok' | 'error', texto: string) => {
    setAviso({ tipo, texto });
    setTimeout(() => setAviso(null), 4500);
  };

  const cargarLista = useCallback(async () => {
    setCargando(true);
    try {
      const res = await fetch(`/api/compras?estado=${filtroEstado}`);
      const data = await res.json();
      if (data.success) setLista(data.compras);
      else notificar('error', data.error || 'No se pudieron cargar las compras');
    } catch {
      notificar('error', 'Error de conexión al listar compras');
    } finally {
      setCargando(false);
    }
  }, [filtroEstado]);

  const cargarCatalogos = useCallback(async () => {
    try {
      const [cat, rub] = await Promise.all([
        fetch('/api/catalogos-dte').then((r) => r.json()),
        fetch('/api/catalogo-contable?activo=true').then((r) => r.json()),
      ]);
      if (cat.success) {
        setCatalogos({
          tipos_dte: cat.tipos_dte,
          formas_pago: cat.formas_pago,
          tributos: cat.tributos,
        });
      }
      if (rub.success) setRubros(rub.rubros);
    } catch {
      /* silencioso */
    }
  }, []);

  const cargarDetalle = useCallback(async (id: number) => {
    try {
      const [c, l, p, d] = await Promise.all([
        fetch(`/api/compras?id=${id}`).then((r) => r.json()),
        fetch(`/api/compras-detalle?idcompra=${id}`).then((r) => r.json()),
        fetch(`/api/compras-pagos?idcompra=${id}`).then((r) => r.json()),
        fetch(`/api/compras-documentos-rel?idcompra=${id}`).then((r) => r.json()),
      ]);
      if (c.success) setCompra(c.compra);
      if (l.success) setLineas(l.lineas);
      if (p.success) setPagos(p.pagos);
      if (d.success) setDocsRel(d.documentos);
    } catch {
      notificar('error', 'Error al cargar el detalle');
    }
  }, []);

  useEffect(() => {
    cargarLista();
    cargarCatalogos();
  }, [cargarLista, cargarCatalogos]);

  useEffect(() => {
    if (idActivo) cargarDetalle(idActivo);
  }, [idActivo, cargarDetalle]);

  const resumenLocal = useMemo(() => {
    if (!compra) return null;
    return calcularResumen({
      lineas: lineas as LineaResumen[],
      descuento_global_gravado: Number(compra.descuento_global_gravado) || 0,
      descuento_global_exento: Number(compra.descuento_global_exento) || 0,
      descuento_global_no_sujeto: Number(compra.descuento_global_no_sujeto) || 0,
      porcentaje_descuento: Number(compra.porcentaje_descuento) || 0,
      iva_retenido: Number(compra.iva_retenido) || 0,
      iva_percibido: Number(compra.iva_percibido) || 0,
      retencion_renta: Number(compra.retencion_renta) || 0,
    });
  }, [compra, lineas]);

  const esBorrador = compra?.estado === 'BORRADOR';
  const esNcNd = tipoDteRequiereRelacionados(compra?.tipo_dte);

  const patchCompra = (parcial: Partial<Compra>) => {
    if (!compra) return;
    setCompra({ ...compra, ...parcial });
  };

  const crearCompra = async () => {
    try {
      const res = await fetch('/api/compras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo_dte: '03', condicion_operacion: 1 }),
      });
      const data = await res.json();
      if (data.success) {
        notificar('ok', `Borrador #${data.idcompra} creado`);
        setFiltroEstado('BORRADOR');
        setIdActivo(data.idcompra);
        await cargarLista();
      } else {
        notificar('error', data.error || 'No se pudo crear');
      }
    } catch {
      notificar('error', 'Error de conexión');
    }
  };

  const guardarEncabezado = async (accion: 'actualizar' | 'registrar' | 'anular' = 'actualizar') => {
    if (!compra) return;
    setGuardando(true);
    try {
      const res = await fetch('/api/compras', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idcompra: compra.idcompra,
          accion,
          tipo_dte: compra.tipo_dte,
          idproveedor: compra.idproveedor,
          notas: compra.notas,
          numero_control: compra.numero_control,
          codigo_generacion: compra.codigo_generacion,
          sello_recepcion: compra.sello_recepcion,
          numero_factura: compra.numero_factura,
          referencia_contable: compra.referencia_contable,
          fecha_emision: compra.fecha_emision,
          fecha_recepcion: compra.fecha_recepcion,
          descuento_global_gravado: compra.descuento_global_gravado,
          descuento_global_exento: compra.descuento_global_exento,
          descuento_global_no_sujeto: compra.descuento_global_no_sujeto,
          porcentaje_descuento: compra.porcentaje_descuento,
          iva_retenido: compra.iva_retenido,
          iva_percibido: compra.iva_percibido,
          retencion_renta: compra.retencion_renta,
          condicion_operacion: compra.condicion_operacion,
          plazo_tipo: compra.plazo_tipo,
          plazo_periodo: compra.plazo_periodo,
        }),
      });
      const data = await res.json();
      if (data.success) {
        notificar('ok', data.mensaje || 'Guardado');
        await cargarDetalle(compra.idcompra);
        await cargarLista();
      } else {
        notificar('error', data.error || 'No se pudo guardar');
      }
    } catch {
      notificar('error', 'Error de conexión');
    } finally {
      setGuardando(false);
    }
  };

  const eliminarCompra = async () => {
    if (!compra) return;
    if (!confirm(`¿Eliminar borrador #${compra.idcompra}?`)) return;
    try {
      const res = await fetch(`/api/compras?id=${compra.idcompra}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        notificar('ok', 'Borrador eliminado');
        setIdActivo(null);
        setCompra(null);
        setLineas([]);
        await cargarLista();
      } else {
        notificar('error', data.error || 'No se pudo eliminar');
      }
    } catch {
      notificar('error', 'Error de conexión');
    }
  };

  const buscarProveedores = async (q: string) => {
    setBusquedaProv(q);
    if (q.trim().length < 2) {
      setProveedores([]);
      return;
    }
    try {
      const res = await fetch(`/api/proveedores?q=${encodeURIComponent(q)}&activo=true`);
      const data = await res.json();
      if (data.success && data.proveedores) {
        setProveedores(data.proveedores.slice(0, 8));
      }
    } catch {
      /* silencioso */
    }
  };

  const buscarProductos = async (q: string) => {
    setBusquedaProd(q);
    if (q.trim().length < 2) {
      setProductos([]);
      return;
    }
    try {
      const res = await fetch(`/api/productos?search=${encodeURIComponent(q)}&limit=8`);
      const data = await res.json();
      if (data.products) {
        setProductos(data.products.map((p: any) => ({ idprod: p.idprod, nombre: p.nombre, OE: p.OE })));
      }
    } catch {
      /* silencioso */
    }
  };

  const guardarLinea = async () => {
    if (!formLinea || !compra) return;
    if (!formLinea.descripcion.trim()) {
      notificar('error', 'La descripción es obligatoria');
      return;
    }
    const payload = {
      idcompra: compra.idcompra,
      numero_orden: formLinea.numero_orden || null,
      destino: formLinea.destino,
      idcatalogo: formLinea.idcatalogo ? Number(formLinea.idcatalogo) : null,
      idprod: formLinea.idprod ? Number(formLinea.idprod) : null,
      referencia_proveedor: formLinea.referencia_proveedor || null,
      descripcion: formLinea.descripcion,
      cantidad: Number(formLinea.cantidad),
      costo_unitario: Number(formLinea.costo_unitario),
      descuento_porcentaje: Number(formLinea.descuento_porcentaje),
      condicion_iva: formLinea.condicion_iva,
      codigo_tributo: formLinea.codigo_tributo || null,
      cargos_no_afectos: Number(formLinea.cargos_no_afectos) || 0,
      numero_documento_rel: formLinea.numero_documento_rel || null,
    };
    const esNuevo = formLinea.iddetalle === 0;
    try {
      const res = await fetch('/api/compras-detalle', {
        method: esNuevo ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(esNuevo ? payload : { ...payload, iddetalle: formLinea.iddetalle }),
      });
      const data = await res.json();
      if (data.success) {
        notificar('ok', esNuevo ? 'Línea agregada' : 'Línea actualizada');
        setFormLinea(null);
        await cargarDetalle(compra.idcompra);
      } else {
        notificar('error', data.error || 'No se pudo guardar la línea');
      }
    } catch {
      notificar('error', 'Error de conexión');
    }
  };

  const eliminarLinea = async (iddetalle: number) => {
    if (!compra || !confirm('¿Eliminar esta línea?')) return;
    try {
      const res = await fetch(`/api/compras-detalle?id=${iddetalle}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        notificar('ok', 'Línea eliminada');
        await cargarDetalle(compra.idcompra);
      } else {
        notificar('error', data.error || 'No se pudo eliminar');
      }
    } catch {
      notificar('error', 'Error de conexión');
    }
  };

  const moverLinea = async (index: number, direccion: 'up' | 'down') => {
    if (!compra) return;
    const nuevo = direccion === 'up' ? index - 1 : index + 1;
    if (nuevo < 0 || nuevo >= lineas.length) return;
    const orden = [...lineas];
    [orden[index], orden[nuevo]] = [orden[nuevo], orden[index]];
    try {
      await fetch('/api/compras-detalle', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idcompra: compra.idcompra, orden: orden.map((l) => l.iddetalle) }),
      });
      await cargarDetalle(compra.idcompra);
    } catch {
      notificar('error', 'No se pudo reordenar');
    }
  };

  const agregarPago = async () => {
    if (!compra) return;
    try {
      const res = await fetch('/api/compras-pagos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idcompra: compra.idcompra,
          codigo_forma_pago: formPago.codigo,
          monto: Number(formPago.monto) || 0,
          referencia: formPago.referencia || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFormPago({ codigo: '01', monto: '', referencia: '' });
        await cargarDetalle(compra.idcompra);
      } else {
        notificar('error', data.error || 'No se pudo agregar el pago');
      }
    } catch {
      notificar('error', 'Error de conexión');
    }
  };

  const eliminarPago = async (idpago: number) => {
    if (!compra) return;
    try {
      const res = await fetch(`/api/compras-pagos?id=${idpago}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) await cargarDetalle(compra.idcompra);
      else notificar('error', data.error || 'No se pudo eliminar');
    } catch {
      notificar('error', 'Error de conexión');
    }
  };

  const agregarRel = async () => {
    if (!compra) return;
    try {
      const res = await fetch('/api/compras-documentos-rel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idcompra: compra.idcompra,
          ...formRel,
          tipo_generacion: Number(formRel.tipo_generacion),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFormRel({ tipo_dte_relacionado: '03', tipo_generacion: '2', numero_documento: '', fecha_generacion: '' });
        await cargarDetalle(compra.idcompra);
      } else {
        notificar('error', data.error || 'No se pudo agregar el documento');
      }
    } catch {
      notificar('error', 'Error de conexión');
    }
  };

  const eliminarRel = async (idrelacion: number) => {
    if (!compra) return;
    try {
      const res = await fetch(`/api/compras-documentos-rel?id=${idrelacion}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) await cargarDetalle(compra.idcompra);
      else notificar('error', data.error || 'No se pudo eliminar');
    } catch {
      notificar('error', 'Error de conexión');
    }
  };

  const rubrosFiltrados = rubros.filter((r) => {
    if (formLinea?.destino === 'GASTOS') return r.tipo === 'GASTO';
    if (formLinea?.destino === 'ACTIVOS') return r.tipo === 'ACTIVO';
    return false;
  });

  const sumaPagos = pagos.reduce((acc, p) => acc + Number(p.monto || 0), 0);

  return (
    <DashboardLayout>
      <div className={UI.page}>
        <div className={UI.stack}>
          <div className={UI.navbar}>
            <div className="flex items-center gap-3">
              <span className={UI.navLabel}>Compras</span>
              <span className={UI.navDivider} />
              <span className={UI.navTitle}>Ingreso de compra</span>
            </div>
            <div className="flex items-center gap-3">
              <NotificationDropdown />
              <UserDropdown />
            </div>
          </div>

          {aviso && (
            <div className={`px-4 py-3 flex items-center gap-2 text-sm ${aviso.tipo === 'ok' ? UI.avisoOk : UI.avisoError}`}>
              {aviso.tipo === 'ok' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              {aviso.texto}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className={UI.heading}>Ingreso de compras nacionales</h1>
              <p className={UI.subheading}>
                Registro de DTE recibidos: Factura, Crédito Fiscal, Nota de Crédito, Nota de Débito y Sujeto Excluido
              </p>
            </div>
            <Button onClick={crearCompra} className="bg-primary hover:bg-primary/80 text-white rounded-full">
              <FilePlus className="h-4 w-4 mr-1" /> Nueva compra
            </Button>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            <Card className={`xl:col-span-1 ${UI.card}`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex gap-2">
                  {['BORRADOR', 'REGISTRADA', 'ANULADA'].map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => { setFiltroEstado(e); setIdActivo(null); setCompra(null); }}
                      className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-full border ${
                        filtroEstado === e ? 'border-primary text-primary bg-primary/10' : 'border-border text-muted-foreground'
                      }`}
                    >
                      {e.toLowerCase()}
                    </button>
                  ))}
                </div>
                {cargando ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                ) : lista.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Sin documentos en este estado.</p>
                ) : (
                  <ul className="space-y-2 max-h-[70vh] overflow-y-auto">
                    {lista.map((c) => (
                      <li key={c.idcompra}>
                        <button
                          type="button"
                          onClick={() => setIdActivo(c.idcompra)}
                          className={`w-full text-left p-3 ${idActivo === c.idcompra ? UI.listItemActive : UI.listItem}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium">#{c.idcompra} {c.tipo_dte_abrev || ''}</span>
                            <Badge variant="outline" className="text-[10px]">{fmt2(c.total_pagar)}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {c.proveedor_nombre || 'Sin proveedor'} · {c.numero_factura || 's/n'}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <div className="xl:col-span-3 space-y-6">
              {!compra ? (
                <Card className={UI.card}>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    Seleccione una compra o cree un nuevo borrador.
                  </CardContent>
                </Card>
              ) : (
                <>
                  <Card className={UI.card}>
                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <h2 className="text-sm font-semibold uppercase tracking-wider">A. Encabezado DTE</h2>
                        <Badge variant="outline">{compra.estado}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {TIPOS_DTE_COMPRAS.map((t) => (
                          <button
                            key={t.codigo}
                            type="button"
                            disabled={!esBorrador}
                            onClick={() => patchCompra({ tipo_dte: t.codigo })}
                            className={`px-3 py-1.5 rounded-full text-xs border ${
                              compra.tipo_dte === t.codigo
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border text-muted-foreground'
                            }`}
                          >
                            {t.abrev}
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="relative md:col-span-2">
                          <label className={UI.label}>Proveedor</label>
                          <Input
                            className={UI.input}
                            disabled={!esBorrador}
                            placeholder="Buscar por código, nombre, NIT o alias"
                            value={compra.proveedor_nombre || busquedaProv}
                            onChange={(e) => {
                              patchCompra({ proveedor_nombre: '' });
                              buscarProveedores(e.target.value);
                            }}
                          />
                          {proveedores.length > 0 && (
                            <ul className={`absolute z-20 mt-1 w-full ${UI.dropdown}`}>
                              {proveedores.map((p) => (
                                <li key={p.idproveedor}>
                                  <button
                                    type="button"
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                                    onClick={() => {
                                      patchCompra({
                                        idproveedor: p.idproveedor,
                                        proveedor_nombre: p.nombre_legal,
                                        proveedor_codigo: p.codigo,
                                        proveedor_nit: p.nit,
                                        proveedor_nrc: p.nrc,
                                      });
                                      setProveedores([]);
                                      setBusquedaProv('');
                                    }}
                                  >
                                    {p.codigo} · {p.nombre_legal}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                          {(compra.proveedor_nit || compra.proveedor_nrc) && (
                            <p className="text-[11px] text-muted-foreground mt-1">
                              NIT {compra.proveedor_nit || '—'} · NRC {compra.proveedor_nrc || '—'}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className={UI.label}>N° factura</label>
                          <Input className={UI.input} disabled={!esBorrador} value={compra.numero_factura || ''} onChange={(e) => patchCompra({ numero_factura: e.target.value })} />
                        </div>
                        <div>
                          <label className={UI.label}>N° control</label>
                          <Input className={UI.input} disabled={!esBorrador} value={compra.numero_control || ''} onChange={(e) => patchCompra({ numero_control: e.target.value })} />
                        </div>
                        <div>
                          <label className={UI.label}>Código generación</label>
                          <Input className={UI.input} disabled={!esBorrador} value={compra.codigo_generacion || ''} onChange={(e) => patchCompra({ codigo_generacion: e.target.value })} />
                        </div>
                        <div>
                          <label className={UI.label}>Sello recepción</label>
                          <Input className={UI.input} disabled={!esBorrador} value={compra.sello_recepcion || ''} onChange={(e) => patchCompra({ sello_recepcion: e.target.value })} />
                        </div>
                        <div>
                          <label className={UI.label}>Ref. contable</label>
                          <Input className={UI.input} disabled={!esBorrador} maxLength={30} value={compra.referencia_contable || ''} onChange={(e) => patchCompra({ referencia_contable: e.target.value })} />
                        </div>
                        <div>
                          <label className={UI.label}>Fecha emisión</label>
                          <Input type="date" className={UI.input} disabled={!esBorrador} value={fechaInput(compra.fecha_emision)} onChange={(e) => patchCompra({ fecha_emision: e.target.value })} />
                        </div>
                        <div>
                          <label className={UI.label}>Fecha recepción</label>
                          <Input type="date" className={UI.input} disabled={!esBorrador} value={fechaInput(compra.fecha_recepcion)} onChange={(e) => patchCompra({ fecha_recepcion: e.target.value })} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {esNcNd && (
                    <Card className={UI.card}>
                      <CardContent className="p-5 space-y-3">
                        <h2 className="text-sm font-semibold uppercase tracking-wider">B. Documentos relacionados</h2>
                        {esBorrador && (
                          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                            <select className={UI.select} value={formRel.tipo_dte_relacionado} onChange={(e) => setFormRel({ ...formRel, tipo_dte_relacionado: e.target.value })}>
                              {(catalogos.tipos_dte.length
                                ? catalogos.tipos_dte.map((t) => ({ codigo: t.codigo, label: t.abreviatura }))
                                : TIPOS_DTE_COMPRAS.map((t) => ({ codigo: t.codigo, label: t.abrev }))
                              ).map((t) => (
                                <option key={t.codigo} value={t.codigo}>{t.label} {t.codigo}</option>
                              ))}
                            </select>
                            <select className={UI.select} value={formRel.tipo_generacion} onChange={(e) => setFormRel({ ...formRel, tipo_generacion: e.target.value })}>
                              <option value="2">Electrónico</option>
                              <option value="1">Físico</option>
                            </select>
                            <Input className={UI.input} placeholder="N° / UUID" value={formRel.numero_documento} onChange={(e) => setFormRel({ ...formRel, numero_documento: e.target.value })} />
                            <Input type="date" className={UI.input} value={formRel.fecha_generacion} onChange={(e) => setFormRel({ ...formRel, fecha_generacion: e.target.value })} />
                            <Button type="button" onClick={agregarRel} className="bg-primary text-white"><Plus className="h-4 w-4 mr-1" /> Agregar</Button>
                          </div>
                        )}
                        <ul className="space-y-1 text-sm">
                          {docsRel.map((d) => (
                            <li key={d.idrelacion} className="flex items-center justify-between border-b border-border py-1">
                              <span>{d.abreviatura || d.tipo_dte_relacionado} · {d.tipo_generacion === 1 ? 'Físico' : 'Electrónico'} · {d.numero_documento} · {fechaInput(d.fecha_generacion)}</span>
                              {esBorrador && (
                                <button type="button" onClick={() => eliminarRel(d.idrelacion)} className="text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                              )}
                            </li>
                          ))}
                          {docsRel.length === 0 && <li className="text-muted-foreground text-xs">Sin documentos relacionados. Obligatorio para NC/ND.</li>}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  <Card className={UI.card}>
                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold uppercase tracking-wider">C. Líneas</h2>
                        {esBorrador && (
                          <Button type="button" onClick={() => setFormLinea(FORM_VACIO())} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full">
                            <Plus className="h-4 w-4 mr-1" /> Agregar línea
                          </Button>
                        )}
                      </div>

                      {formLinea && esBorrador && (
                        <div className="rounded-lg border border-border p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
                          <div className="md:col-span-2 relative">
                            <label className={UI.label}>Producto / descripción</label>
                            <Input className={UI.input} value={busquedaProd || formLinea.descripcion} onChange={(e) => {
                              setFormLinea({ ...formLinea, descripcion: e.target.value });
                              buscarProductos(e.target.value);
                            }} />
                            {productos.length > 0 && (
                              <ul className={`absolute z-20 mt-1 w-full ${UI.dropdown}`}>
                                {productos.map((p) => (
                                  <li key={p.idprod}>
                                    <button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-muted" onClick={() => {
                                      setFormLinea({ ...formLinea, idprod: String(p.idprod), descripcion: p.nombre, referencia_proveedor: p.OE || formLinea.referencia_proveedor });
                                      setProductos([]);
                                      setBusquedaProd('');
                                    }}>
                                      {p.nombre} {p.OE ? `(${p.OE})` : ''}
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                          <div>
                            <label className={UI.label}>Referencia proveedor</label>
                            <Input className={UI.input} value={formLinea.referencia_proveedor} onChange={(e) => setFormLinea({ ...formLinea, referencia_proveedor: e.target.value })} />
                          </div>
                          <div>
                            <label className={UI.label}>Orden</label>
                            <Input className={UI.input} value={formLinea.numero_orden} onChange={(e) => setFormLinea({ ...formLinea, numero_orden: e.target.value })} />
                          </div>
                          <div>
                            <label className={UI.label}>Destino</label>
                            <select className={UI.select} value={formLinea.destino} onChange={(e) => setFormLinea({ ...formLinea, destino: e.target.value, idcatalogo: '' })}>
                              {DESTINOS.map((d) => <option key={d.valor} value={d.valor}>{d.etiqueta}</option>)}
                            </select>
                          </div>
                          {(formLinea.destino === 'GASTOS' || formLinea.destino === 'ACTIVOS') && (
                            <div>
                              <label className={UI.label}>Rubro contable</label>
                              <select className={UI.select} value={formLinea.idcatalogo} onChange={(e) => setFormLinea({ ...formLinea, idcatalogo: e.target.value })}>
                                <option value="">Seleccione</option>
                                {rubrosFiltrados.map((r) => <option key={r.idcatalogo} value={r.idcatalogo}>{r.codigo} {r.nombre}</option>)}
                              </select>
                            </div>
                          )}
                          <div>
                            <label className={UI.label}>Cantidad</label>
                            <Input className={UI.input} type="number" value={formLinea.cantidad} onChange={(e) => setFormLinea({ ...formLinea, cantidad: e.target.value })} />
                          </div>
                          <div>
                            <label className={UI.label}>Costo</label>
                            <Input className={UI.input} type="number" value={formLinea.costo_unitario} onChange={(e) => setFormLinea({ ...formLinea, costo_unitario: e.target.value })} />
                          </div>
                          <div>
                            <label className={UI.label}>% Desc.</label>
                            <Input className={UI.input} type="number" value={formLinea.descuento_porcentaje} onChange={(e) => setFormLinea({ ...formLinea, descuento_porcentaje: e.target.value })} />
                          </div>
                          <div>
                            <label className={UI.label}>Condición IVA</label>
                            <select className={UI.select} value={formLinea.condicion_iva} onChange={(e) => setFormLinea({ ...formLinea, condicion_iva: e.target.value, codigo_tributo: e.target.value === 'GRAVADA' ? '20' : '' })}>
                              {CONDICIONES_IVA.map((c) => <option key={c.valor} value={c.valor}>{c.etiqueta}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className={UI.label}>Tributo</label>
                            <select className={UI.select} value={formLinea.codigo_tributo} onChange={(e) => setFormLinea({ ...formLinea, codigo_tributo: e.target.value })}>
                              <option value="">Ninguno</option>
                              {catalogos.tributos.map((t) => <option key={t.codigo} value={t.codigo}>{t.codigo} {t.nombre}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className={UI.label}>Cargos no afectos</label>
                            <Input className={UI.input} type="number" value={formLinea.cargos_no_afectos} onChange={(e) => setFormLinea({ ...formLinea, cargos_no_afectos: e.target.value })} />
                          </div>
                          {esNcNd && (
                            <div>
                              <label className={UI.label}>Doc. relacionado</label>
                              <Input className={UI.input} value={formLinea.numero_documento_rel} onChange={(e) => setFormLinea({ ...formLinea, numero_documento_rel: e.target.value })} />
                            </div>
                          )}
                          <div className="md:col-span-4 flex gap-2">
                            <Button type="button" onClick={guardarLinea} className="bg-primary text-white"><Save className="h-4 w-4 mr-1" /> Guardar línea</Button>
                            <Button type="button" variant="ghost" onClick={() => setFormLinea(null)}><X className="h-4 w-4 mr-1" /> Cancelar</Button>
                          </div>
                        </div>
                      )}

                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className={UI.tableHead}>
                            <tr>
                              <th className="p-2 text-left">No.</th>
                              <th className="p-2 text-left">Descripción</th>
                              <th className="p-2 text-right">Cant</th>
                              <th className="p-2 text-right">Costo</th>
                              <th className="p-2 text-right">Subtotal</th>
                              <th className="p-2 text-left">IVA</th>
                              <th className="p-2"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {lineas.map((l, i) => (
                              <tr key={l.iddetalle} className={UI.tableRow}>
                                <td className="p-2">{l.numero_linea}</td>
                                <td className="p-2">
                                  <div>{l.descripcion}</div>
                                  <div className="text-[11px] text-muted-foreground">{l.destino} · {l.condicion_iva}</div>
                                </td>
                                <td className="p-2 text-right">{fmt2(l.cantidad)}</td>
                                <td className="p-2 text-right">{fmt2(l.costo_unitario)}</td>
                                <td className="p-2 text-right">{fmt2(l.subtotal_sin_iva)}</td>
                                <td className="p-2">{l.condicion_iva === 'GRAVADA' ? fmt2(Number(l.iva_unitario) * Number(l.cantidad)) : '—'}</td>
                                <td className="p-2 whitespace-nowrap">
                                  {esBorrador && (
                                    <>
                                      <button type="button" onClick={() => moverLinea(i, 'up')} className="p-1 text-muted-foreground"><ChevronUp className="h-3.5 w-3.5" /></button>
                                      <button type="button" onClick={() => moverLinea(i, 'down')} className="p-1 text-muted-foreground"><ChevronDown className="h-3.5 w-3.5" /></button>
                                      <button type="button" onClick={() => setFormLinea({
                                        iddetalle: l.iddetalle,
                                        numero_orden: l.numero_orden || '',
                                        destino: l.destino,
                                        idcatalogo: l.idcatalogo ? String(l.idcatalogo) : '',
                                        idprod: l.idprod ? String(l.idprod) : '',
                                        referencia_proveedor: l.referencia_proveedor || '',
                                        descripcion: l.descripcion,
                                        cantidad: String(l.cantidad),
                                        costo_unitario: String(l.costo_unitario),
                                        descuento_porcentaje: String(l.descuento_porcentaje),
                                        condicion_iva: l.condicion_iva,
                                        codigo_tributo: l.codigo_tributo || '',
                                        cargos_no_afectos: String(l.cargos_no_afectos || 0),
                                        numero_documento_rel: l.numero_documento_rel || '',
                                      })} className="p-1 text-primary"><Pencil className="h-3.5 w-3.5" /></button>
                                      <button type="button" onClick={() => eliminarLinea(l.iddetalle)} className="p-1 text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                                    </>
                                  )}
                                </td>
                              </tr>
                            ))}
                            {lineas.length === 0 && (
                              <tr><td colSpan={7} className="p-4 text-center text-muted-foreground text-xs">Sin líneas</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className={UI.card}>
                      <CardContent className="p-5 space-y-3">
                        <h2 className="text-sm font-semibold uppercase tracking-wider">D. Resumen</h2>
                        {resumenLocal && (
                          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                            <dt className="text-muted-foreground">Gravado</dt><dd className="text-right">{fmt2(resumenLocal.total_gravado)}</dd>
                            <dt className="text-muted-foreground">Exento</dt><dd className="text-right">{fmt2(resumenLocal.total_exento)}</dd>
                            <dt className="text-muted-foreground">No sujeto</dt><dd className="text-right">{fmt2(resumenLocal.total_no_sujeto)}</dd>
                            <dt className="text-muted-foreground">XComprobar (contable)</dt><dd className="text-right">{fmt2(resumenLocal.total_xcomprobar)}</dd>
                            <dt className="text-muted-foreground">Subtotal fiscal</dt><dd className="text-right">{fmt2(resumenLocal.sub_total)}</dd>
                            <dt className="text-muted-foreground">IVA 13%</dt><dd className="text-right">{fmt2(resumenLocal.iva)}</dd>
                            <dt className="font-semibold">Total a pagar</dt><dd className="text-right font-semibold text-primary">{fmt2(resumenLocal.total_pagar)}</dd>
                          </dl>
                        )}
                        <p className="text-[11px] text-muted-foreground italic">{resumenLocal?.valor_en_letras}</p>
                        {esBorrador && (
                          <div className="grid grid-cols-2 gap-2 pt-2">
                            <div>
                              <label className={UI.label}>Desc. glob. gravado</label>
                              <Input className={UI.input} type="number" value={compra.descuento_global_gravado} onChange={(e) => patchCompra({ descuento_global_gravado: Number(e.target.value) })} />
                            </div>
                            <div>
                              <label className={UI.label}>IVA retenido</label>
                              <Input className={UI.input} type="number" value={compra.iva_retenido} onChange={(e) => patchCompra({ iva_retenido: Number(e.target.value) })} />
                            </div>
                            <div>
                              <label className={UI.label}>IVA percibido</label>
                              <Input className={UI.input} type="number" value={compra.iva_percibido} onChange={(e) => patchCompra({ iva_percibido: Number(e.target.value) })} />
                            </div>
                            <div>
                              <label className={UI.label}>Retención renta</label>
                              <Input className={UI.input} type="number" value={compra.retencion_renta} onChange={(e) => patchCompra({ retencion_renta: Number(e.target.value) })} />
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className={UI.card}>
                      <CardContent className="p-5 space-y-3">
                        <h2 className="text-sm font-semibold uppercase tracking-wider">E. Condición de pago</h2>
                        <div className="flex flex-wrap gap-2">
                          {CONDICIONES_OPERACION.map((c) => (
                            <button
                              key={c.codigo}
                              type="button"
                              disabled={!esBorrador}
                              onClick={() => patchCompra({ condicion_operacion: c.codigo })}
                              className={`px-3 py-1.5 rounded-full text-xs border ${
                                Number(compra.condicion_operacion) === c.codigo
                                  ? 'border-primary bg-primary/10 text-primary'
                                  : 'border-border text-muted-foreground'
                              }`}
                            >
                              {c.nombre}
                            </button>
                          ))}
                        </div>
                        {Number(compra.condicion_operacion) === 2 && esBorrador && (
                          <div className="grid grid-cols-2 gap-2">
                            <select className={UI.select} value={compra.plazo_tipo || '01'} onChange={(e) => patchCompra({ plazo_tipo: e.target.value })}>
                              {PLAZOS.map((p) => <option key={p.codigo} value={p.codigo}>{p.nombre}</option>)}
                            </select>
                            <Input className={UI.input} type="number" placeholder="Período" value={compra.plazo_periodo || ''} onChange={(e) => patchCompra({ plazo_periodo: Number(e.target.value) })} />
                          </div>
                        )}
                        {esBorrador && (
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                            <select className={UI.select} value={formPago.codigo} onChange={(e) => setFormPago({ ...formPago, codigo: e.target.value })}>
                              {catalogos.formas_pago.map((f) => <option key={f.codigo} value={f.codigo}>{f.nombre}</option>)}
                            </select>
                            <Input className={UI.input} type="number" placeholder="Monto" value={formPago.monto} onChange={(e) => setFormPago({ ...formPago, monto: e.target.value })} />
                            <Input className={UI.input} placeholder="Referencia" value={formPago.referencia} onChange={(e) => setFormPago({ ...formPago, referencia: e.target.value })} />
                            <Button type="button" onClick={agregarPago} className="bg-primary text-white"><Plus className="h-4 w-4" /></Button>
                          </div>
                        )}
                        <ul className="text-sm space-y-1">
                          {pagos.map((p) => (
                            <li key={p.idpago} className="flex justify-between items-center">
                              <span>{p.forma_pago_nombre} {p.referencia ? `· ${p.referencia}` : ''}</span>
                              <span className="flex items-center gap-2">
                                {fmt2(p.monto)}
                                {esBorrador && <button type="button" onClick={() => eliminarPago(p.idpago)} className="text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>}
                              </span>
                            </li>
                          ))}
                        </ul>
                        <p className="text-xs text-muted-foreground">Pagos {fmt2(sumaPagos)} / total {fmt2(resumenLocal?.total_pagar)}</p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="flex flex-wrap gap-2 justify-end">
                    {esBorrador && (
                      <>
                        <Button type="button" variant="ghost" onClick={eliminarCompra} className="text-red-500"><Trash2 className="h-4 w-4 mr-1" /> Eliminar borrador</Button>
                        <Button type="button" disabled={guardando} onClick={() => guardarEncabezado('actualizar')} className="bg-card border border-border">
                          <Save className="h-4 w-4 mr-1" /> Guardar borrador
                        </Button>
                        <Button type="button" disabled={guardando} onClick={() => guardarEncabezado('registrar')} className="bg-primary text-white">
                          <Check className="h-4 w-4 mr-1" /> Registrar
                        </Button>
                      </>
                    )}
                    {compra.estado === 'REGISTRADA' && (
                      <Button type="button" disabled={guardando} onClick={() => {
                        if (confirm('¿Anular esta compra registrada?')) guardarEncabezado('anular');
                      }} className="bg-red-600 text-white">
                        <Ban className="h-4 w-4 mr-1" /> Anular
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
