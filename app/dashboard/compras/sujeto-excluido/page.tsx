'use client';
import { confirmar } from '@/components/ui/avisos';

import { useCallback, useEffect, useState } from 'react';
import { Ban, FileText, Loader2, Plus, Send, Save } from 'lucide-react';
import { NotificationDropdown } from '@/components/notification-dropdown';
import { UserDropdown } from '@/components/user-dropdown';
import { UI } from '@/lib/ui';
import { useSesion } from '@/lib/sesion-cliente';
import { FORMAS_PAGO } from '@/lib/compras-constantes';

interface Linea {
  tipo_item: number;
  idprod: number | null;
  codigo: string;
  descripcion: string;
  cantidad: number;
  precio_uni: number;
  monto_descu: number;
}

interface Documento {
  idfse: number;
  estado: string;
  numero_control: string;
  codigo_generacion: string;
  fecha_emision: string;
  nombre: string;
  total_pagar: number;
  sello_recepcion: string | null;
  idcompra: number | null;
}

const VACIA: Linea = { tipo_item: 1, idprod: null, codigo: '', descripcion: '', cantidad: 1, precio_uni: 0, monto_descu: 0 };

const DEPARTAMENTOS: [string, string][] = [
  ['01', 'Ahuachapán'], ['02', 'Santa Ana'], ['03', 'Sonsonate'], ['04', 'Chalatenango'],
  ['05', 'La Libertad'], ['06', 'San Salvador'], ['07', 'Cuscatlán'], ['08', 'La Paz'],
  ['09', 'Cabañas'], ['10', 'San Vicente'], ['11', 'Usulután'], ['12', 'San Miguel'],
  ['13', 'Morazán'], ['14', 'La Unión'],
];

const FORM_INICIAL = {
  tipo_documento: '13',
  num_documento: '',
  nombre: '',
  cod_actividad: '',
  desc_actividad: '',
  departamento: '06',
  municipio: '14',
  direccion: '',
  telefono: '',
  correo: '',
  condicion_operacion: '1',
  codigo_forma_pago: '01',
  retencion_renta: '',
  observaciones: '',
};

const dinero = (n: unknown) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function SujetoExcluidoPage() {
  const { puede } = useSesion();
  const emitir = puede('hacienda.emitir');
  const [lista, setLista] = useState<Documento[]>([]);
  const [idfse, setIdfse] = useState<number | null>(null);
  const [estado, setEstado] = useState<string | null>(null);
  const [control, setControl] = useState('');
  const [sello, setSello] = useState<string | null>(null);
  const [consulta, setConsulta] = useState<string | null>(null);
  const [form, setForm] = useState(FORM_INICIAL);
  const [lineas, setLineas] = useState<Linea[]>([{ ...VACIA }]);
  const [rentaSugerida, setRentaSugerida] = useState(0);
  const [ambiente, setAmbiente] = useState('00');
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [productos, setProductos] = useState<{ idprod: number; nombre: string; idprodprov: string | null }[]>([]);

  const avisar = (tipo: 'ok' | 'error', texto: string) => setAviso({ tipo, texto });

  const cargarLista = useCallback(async () => {
    const data = await fetch('/api/sujeto-excluido').then((r) => r.json());
    if (data.success) setLista(data.documentos);
  }, []);

  useEffect(() => {
    cargarLista();
    fetch('/api/empresa')
      .then((r) => r.json())
      .then((d) => { if (d.empresa?.dte_ambiente) setAmbiente(d.empresa.dte_ambiente); })
      .catch(() => {});
  }, [cargarLista]);

  useEffect(() => {
    if (busqueda.trim().length < 2) return setProductos([]);
    const t = setTimeout(() => {
      fetch(`/api/productos?search=${encodeURIComponent(busqueda)}&limit=8`)
        .then((r) => r.json())
        .then((d) => setProductos(d.products || []))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [busqueda]);

  const nuevo = () => {
    setIdfse(null);
    setEstado(null);
    setControl('');
    setSello(null);
    setConsulta(null);
    setForm(FORM_INICIAL);
    setLineas([{ ...VACIA }]);
    setRentaSugerida(0);
  };

  const abrir = async (id: number) => {
    const data = await fetch(`/api/sujeto-excluido?id=${id}`).then((r) => r.json());
    if (!data.success) return avisar('error', data.error || 'No se pudo abrir');
    const d = data.documento;
    setIdfse(d.idfse);
    setEstado(d.estado);
    setControl(d.numero_control);
    setSello(d.sello_recepcion);
    setConsulta(data.consulta);
    setRentaSugerida(Number(data.renta_sugerida) || 0);
    setForm({
      tipo_documento: d.tipo_documento,
      num_documento: d.num_documento,
      nombre: d.nombre,
      cod_actividad: d.cod_actividad || '',
      desc_actividad: d.desc_actividad || '',
      departamento: d.departamento,
      municipio: d.municipio,
      direccion: d.direccion,
      telefono: d.telefono || '',
      correo: d.correo || '',
      condicion_operacion: String(d.condicion_operacion),
      codigo_forma_pago: d.codigo_forma_pago,
      retencion_renta: String(Number(d.retencion_renta) || ''),
      observaciones: d.observaciones || '',
    });
    setLineas(
      data.lineas.map((l: Linea) => ({
        tipo_item: Number(l.tipo_item),
        idprod: l.idprod,
        codigo: l.codigo || '',
        descripcion: l.descripcion,
        cantidad: Number(l.cantidad),
        precio_uni: Number(l.precio_uni),
        monto_descu: Number(l.monto_descu),
      }))
    );
  };

  const cuerpo = () => ({
    ...form,
    retencion_renta: form.retencion_renta === '' ? null : Number(form.retencion_renta),
    lineas,
    idfse,
  });

  const persistir = async () => {
    const res = await fetch('/api/sujeto-excluido', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'guardar', ...cuerpo() }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'No se pudo guardar');
    await cargarLista();
    await abrir(data.idfse);
    return data.idfse as number;
  };

  const guardar = async () => {
    setOcupado(true);
    try {
      await persistir();
      avisar('ok', 'Borrador guardado');
    } catch (e) {
      avisar('error', (e as Error).message);
    } finally {
      setOcupado(false);
    }
  };

  const emitirDte = async () => {
    if (!(await confirmar(`Se enviará a Hacienda en ambiente ${ambiente === '01' ? 'PRODUCCIÓN' : 'de pruebas'}. ¿Continuar?`))) return;
    setOcupado(true);
    try {
      const id = await persistir();
      const res = await fetch('/api/sujeto-excluido', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'emitir', idfse: id }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Hacienda no aceptó el documento');
      avisar('ok', data.mensaje);
      await cargarLista();
      await abrir(id);
    } catch (e) {
      avisar('error', (e as Error).message);
    } finally {
      setOcupado(false);
    }
  };

  const invalidar = async () => {
    const motivo = prompt('Motivo de la invalidación (lo recibe Hacienda):');
    if (!motivo?.trim() || !idfse) return;
    setOcupado(true);
    try {
      const res = await fetch('/api/sujeto-excluido', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'invalidar', idfse, motivo: motivo.trim() }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'No se pudo invalidar');
      avisar('ok', data.mensaje);
      await cargarLista();
      await abrir(idfse);
    } catch (e) {
      avisar('error', (e as Error).message);
    } finally {
      setOcupado(false);
    }
  };

  const pdf = async () => {
    const { default: jsPDF } = await import('jspdf');
    const QR = await import('qrcode');
    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('FACTURA DE SUJETO EXCLUIDO', 14, 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(control, 14, 22);
    doc.text(form.nombre, 14, 27);
    doc.text(`Documento ${form.tipo_documento} ${form.num_documento}`, 14, 32);
    if (consulta) {
      const img = await QR.toDataURL(consulta, { margin: 0, width: 120 });
      doc.addImage(img, 'PNG', 160, 12, 32, 32);
      doc.text('Consulta en Hacienda', 160, 48);
    }
    let y = 56;
    doc.setFont('helvetica', 'bold');
    lineas.forEach((l) => {
      const total = Math.max(0, l.cantidad * l.precio_uni - l.monto_descu);
      doc.setFont('helvetica', 'normal');
      doc.text(`${l.cantidad}  ${l.descripcion}`.slice(0, 80), 14, y);
      doc.text(`$${dinero(total)}`, 190, y, { align: 'right' });
      y += 5;
    });
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.text(`Renta retenida  $${dinero(form.retencion_renta)}`, 14, y);
    doc.text(`Total a pagar  $${dinero(lineas.reduce((s, l) => s + Math.max(0, l.cantidad * l.precio_uni - l.monto_descu), 0) - (Number(form.retencion_renta) || 0))}`, 14, y + 6);
    if (sello) doc.text(`Sello: ${sello}`, 14, y + 14);
    doc.save(`${control || 'fse'}.pdf`);
  };

  const bloqueado = estado === 'ACEPTADO' || estado === 'INVALIDADO';
  const subtotal = lineas.reduce((s, l) => s + Math.max(0, l.cantidad * l.precio_uni - l.monto_descu), 0);

  const campo = (etiqueta: string, clave: keyof typeof form, tipo = 'text') => (
    <label className="flex flex-col gap-1">
      <span className={UI.denseLabel}>{etiqueta}</span>
      <input
        className={UI.denseInput}
        type={tipo}
        disabled={bloqueado}
        value={form[clave]}
        onChange={(e) => setForm({ ...form, [clave]: e.target.value })}
      />
    </label>
  );

  return (
    <>
      <div className={UI.page}>
        <div className={UI.stack}>
          <div className={UI.navbar}>
            <div className="flex items-center gap-3">
              <span className={UI.navLabel}>Compras</span>
              <span className={UI.navDivider} />
              <span className={UI.navTitle}>Sujeto excluido</span>
              <span className={UI.densePendingTag}>{ambiente === '01' ? 'Producción' : 'Pruebas'}</span>
            </div>
            <div className="flex items-center gap-3">
              <NotificationDropdown />
              <UserDropdown />
            </div>
          </div>

          {aviso && <div className={`${aviso.tipo === 'ok' ? UI.avisoOk : UI.avisoError} px-3 py-2 text-xs`}>{aviso.texto}</div>}

          <div className="grid gap-3 lg:grid-cols-[16rem_minmax(0,1fr)]">
            <div className={`${UI.densePanel} overflow-auto max-h-[75vh]`}>
              <div className="p-2 border-b border-border">
                <button type="button" className={UI.denseBtnPrimary} onClick={nuevo}>
                  <Plus className="w-3.5 h-3.5" /> Nueva
                </button>
              </div>
              {lista.map((d) => (
                <button
                  key={d.idfse}
                  type="button"
                  className={`w-full text-left px-3 py-2 border-t border-border text-xs hover:bg-muted/60 ${idfse === d.idfse ? 'bg-primary/10' : ''}`}
                  onClick={() => abrir(d.idfse)}
                >
                  <span className="font-semibold">{d.estado}</span>
                  <span className="block truncate">{d.nombre}</span>
                  <span className="text-muted-foreground">{String(d.fecha_emision).slice(0, 10)} · ${dinero(d.total_pagar)}</span>
                </button>
              ))}
            </div>

            <div className={`${UI.densePanel} p-3 space-y-3`}>
              <p className="text-xs text-muted-foreground">
                Compra a una persona no inscrita en IVA. No lleva IVA. El ambiente se cambia en Configuración &gt; Empresa.
                {control && <span className="block font-mono mt-1">{control}{sello ? ` · sello ${sello}` : ''}</span>}
              </p>
              <div className="grid gap-2 sm:grid-cols-4">
                <label className="flex flex-col gap-1">
                  <span className={UI.denseLabel}>Documento</span>
                  <select className={UI.denseSelect} disabled={bloqueado} value={form.tipo_documento} onChange={(e) => setForm({ ...form, tipo_documento: e.target.value })}>
                    <option value="13">DUI</option>
                    <option value="36">NIT</option>
                    <option value="02">Carnet</option>
                    <option value="03">Pasaporte</option>
                    <option value="37">Otro</option>
                  </select>
                </label>
                {campo('Número', 'num_documento')}
                {campo('Nombre del vendedor', 'nombre')}
                {campo('Teléfono', 'telefono')}
                {campo('Actividad', 'cod_actividad')}
                {campo('Descripción de actividad', 'desc_actividad')}
                <label className="flex flex-col gap-1">
                  <span className={UI.denseLabel}>Departamento</span>
                  <select className={UI.denseSelect} disabled={bloqueado} value={form.departamento} onChange={(e) => setForm({ ...form, departamento: e.target.value })}>
                    {DEPARTAMENTOS.map(([c, n]) => <option key={c} value={c}>{c} {n}</option>)}
                  </select>
                </label>
                {campo('Municipio', 'municipio')}
                <label className="flex flex-col gap-1 sm:col-span-2">
                  <span className={UI.denseLabel}>Dirección</span>
                  <input className={UI.denseInput} disabled={bloqueado} value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
                </label>
                {campo('Correo', 'correo')}
                <label className="flex flex-col gap-1">
                  <span className={UI.denseLabel}>Condición</span>
                  <select className={UI.denseSelect} disabled={bloqueado} value={form.condicion_operacion} onChange={(e) => setForm({ ...form, condicion_operacion: e.target.value })}>
                    <option value="1">Contado</option>
                    <option value="2">Crédito</option>
                    <option value="3">Otro</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className={UI.denseLabel}>Pago</span>
                  <select className={UI.denseSelect} disabled={bloqueado} value={form.codigo_forma_pago} onChange={(e) => setForm({ ...form, codigo_forma_pago: e.target.value })}>
                    {FORMAS_PAGO.map((f) => <option key={f.codigo} value={f.codigo}>{f.nombre}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1" title={rentaSugerida ? `Sugerida: $${dinero(rentaSugerida)} (10 % si hay un servicio)` : 'Sin retención sugerida: no hay servicios'}>
                  <span className={UI.denseLabel}>Renta retenida</span>
                  <input className={UI.denseInput} disabled={bloqueado} inputMode="decimal" placeholder={rentaSugerida ? String(rentaSugerida) : '0.00'} value={form.retencion_renta} onChange={(e) => setForm({ ...form, retencion_renta: e.target.value })} />
                </label>
              </div>

              <div className="overflow-auto">
                <table className={UI.denseTable}>
                  <thead>
                    <tr>
                      {['Tipo', 'Descripción', 'Cant.', 'Precio', 'Descuento', 'Total', ''].map((h) => (
                        <th key={h} className={UI.denseTh}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lineas.map((l, i) => (
                      <tr key={i}>
                        <td className={UI.denseTd}>
                          <select className={UI.denseSelect} disabled={bloqueado} value={l.tipo_item} onChange={(e) => setLineas(lineas.map((x, j) => j === i ? { ...x, tipo_item: Number(e.target.value) } : x))}>
                            <option value={1}>Bien</option>
                            <option value={2}>Servicio</option>
                            <option value={3}>Ambos</option>
                          </select>
                        </td>
                        <td className={UI.denseTd}>
                          <input className={`${UI.denseInput} w-56`} disabled={bloqueado} value={l.descripcion} onChange={(e) => setLineas(lineas.map((x, j) => j === i ? { ...x, descripcion: e.target.value } : x))} />
                          {l.idprod && <span className="block text-[10px] text-muted-foreground">Ficha {l.codigo || l.idprod}: entra a inventario</span>}
                        </td>
                        <td className={UI.denseTd}><input className={`${UI.denseInput} w-16`} disabled={bloqueado} type="number" value={l.cantidad} onChange={(e) => setLineas(lineas.map((x, j) => j === i ? { ...x, cantidad: Number(e.target.value) } : x))} /></td>
                        <td className={UI.denseTd}><input className={`${UI.denseInput} w-20`} disabled={bloqueado} type="number" value={l.precio_uni} onChange={(e) => setLineas(lineas.map((x, j) => j === i ? { ...x, precio_uni: Number(e.target.value) } : x))} /></td>
                        <td className={UI.denseTd}><input className={`${UI.denseInput} w-16`} disabled={bloqueado} type="number" value={l.monto_descu} onChange={(e) => setLineas(lineas.map((x, j) => j === i ? { ...x, monto_descu: Number(e.target.value) } : x))} /></td>
                        <td className={`${UI.denseTd} ${UI.denseMono}`}>{dinero(Math.max(0, l.cantidad * l.precio_uni - l.monto_descu))}</td>
                        <td className={UI.denseTd}>
                          <button type="button" className={UI.denseBtnDanger} disabled={bloqueado || lineas.length === 1} onClick={() => setLineas(lineas.filter((_, j) => j !== i))}>Quitar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {!bloqueado && (
                <div className="flex flex-wrap items-end gap-2">
                  <button type="button" className={UI.denseBtn} onClick={() => setLineas([...lineas, { ...VACIA }])}>Agregar ítem</button>
                  <label className="flex flex-col gap-1">
                    <span className={UI.denseLabel}>Buscar ficha (entra a inventario)</span>
                    <input className={`${UI.denseInput} w-56`} value={busqueda} placeholder="Nombre o código" onChange={(e) => setBusqueda(e.target.value)} />
                  </label>
                  {productos.map((p) => (
                    <button
                      key={p.idprod}
                      type="button"
                      className={UI.denseBtn}
                      onClick={() => {
                        setLineas([...lineas, { ...VACIA, idprod: p.idprod, codigo: p.idprodprov || String(p.idprod), descripcion: p.nombre }]);
                        setBusqueda('');
                        setProductos([]);
                      }}
                    >
                      {p.nombre}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold mr-auto">Subtotal ${dinero(subtotal)}</span>
                <button type="button" className={UI.denseBtn} disabled={bloqueado || ocupado} onClick={guardar}>
                  {ocupado ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Guardar
                </button>
                <button type="button" className={UI.denseBtnPrimary} disabled={!emitir || bloqueado || ocupado} title={emitir ? 'Firmar y enviar a Hacienda' : 'Su rol no emite DTE'} onClick={emitirDte}>
                  <Send className="w-3.5 h-3.5" /> Emitir
                </button>
                <button type="button" className={UI.denseBtn} disabled={estado !== 'ACEPTADO'} onClick={pdf}>
                  <FileText className="w-3.5 h-3.5" /> PDF
                </button>
                <button type="button" className={UI.denseBtnDanger} disabled={!emitir || estado !== 'ACEPTADO' || ocupado} onClick={invalidar}>
                  <Ban className="w-3.5 h-3.5" /> Invalidar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
