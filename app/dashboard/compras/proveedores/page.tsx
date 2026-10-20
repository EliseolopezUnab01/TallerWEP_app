'use client';

import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { NotificationDropdown } from '@/components/notification-dropdown';
import { UserDropdown } from '@/components/user-dropdown';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Search, Plus, Save, Trash2, Building2, Users, Landmark,
  Globe, MapPin, X, Loader2, AlertCircle, CheckCircle2, Pencil,
  ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight,
  FileSpreadsheet, Printer,
} from 'lucide-react';

// ---------- Tipos ----------

interface ProveedorLista {
  idproveedor: number;
  codigo: string;
  tipo_proveedor: 'LOCAL' | 'EXTRANJERO';
  nombre_legal: string;
  nombre_comercial: string | null;
  alias: string | null;
  pais: string | null;
  nit: string | null;
  activo: number;
  total_contactos: number;
  total_cuentas: number;
}

interface Contacto {
  orden: number;
  nombre: string;
  puesto_cargo: string;
  telefono: string;
  movil: string;
  email: string;
}

interface Cuenta {
  idcuenta?: number;
  numero_cuenta: string;
  beneficiario: string;
  direccion_beneficiario: string;
  banco: string;
  direccion_banco: string;
  codigo_aba: string;
  codigo_swift: string;
  codigo_iban: string;
  moneda: string;
  comentarios: string;
}

const CONTACTO_VACIO = (orden: number): Contacto => ({
  orden, nombre: '', puesto_cargo: '', telefono: '', movil: '', email: '',
});

const CUENTA_VACIA = (): Cuenta => ({
  numero_cuenta: '', beneficiario: '', direccion_beneficiario: '', banco: '',
  direccion_banco: '', codigo_aba: '', codigo_swift: '', codigo_iban: '',
  moneda: '', comentarios: '',
});

const FORM_VACIO = {
  idproveedor: 0,
  codigo: '',
  tipo_proveedor: 'LOCAL',
  nombre_legal: '',
  nombre_comercial: '',
  alias: '',
  direccion: '',
  ciudad: '',
  direccion2: '',
  ciudad2: '',
  pais: 'EL SALVADOR',
  telefono: '',
  telefono2: '',
  fax: '',
  email: '',
  sitio_web: '',
  nit: '',
  nrc: '',
  giro: '',
  categoria_contribuyente: 'CONTRIBUYENTE',
  que_provee: 'PRODUCTO',
  incluir_en_catalogo: false,
  limite_credito_usd: '0.00',
  dias_credito: '30',
  moneda: 'USD',
  terminos_comentarios: '',
  activo: true,
  saldo_actual: '0.00',
  saldo_vencido: '0.00',
};

// Clases reutilizadas para inputs y selects
const INPUT_CLS = 'bg-white dark:bg-surface-deep border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus-visible:ring-primary';
const SELECT_CLS = 'w-full h-9 rounded-md bg-white dark:bg-surface-deep border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-sm px-3 focus:outline-none focus:ring-2 focus:ring-primary';
const LABEL_CLS = 'text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400';

export default function ProveedoresPage() {
  const [lista, setLista] = useState<ProveedorLista[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'activos' | 'inactivos' | 'todos'>('activos');
  const [cargandoLista, setCargandoLista] = useState(true);
  const [guardando, setGuardando] = useState(false);
  // Marca si hay cambios sin guardar, para no perderlos al cambiar de ficha
  const [sucio, setSucio] = useState(false);

  const [form, setForm] = useState<any>({ ...FORM_VACIO });
  const [contactos, setContactos] = useState<Contacto[]>([
    CONTACTO_VACIO(1), CONTACTO_VACIO(2),
  ]);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [cuentaEditando, setCuentaEditando] = useState<Cuenta | null>(null);

  const [modo, setModo] = useState<'vacio' | 'nuevo' | 'editar'>('vacio');
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const notificar = (tipo: 'ok' | 'error', texto: string) => {
    setAviso({ tipo, texto });
    setTimeout(() => setAviso(null), 4000);
  };

  // ---------- Carga de datos ----------

  const cargarLista = useCallback(async () => {
    setCargandoLista(true);
    try {
      const params = new URLSearchParams();
      if (busqueda.trim()) params.set('q', busqueda.trim());
      if (filtroTipo) params.set('tipo', filtroTipo);

      const res = await fetch(`/api/proveedores?${params.toString()}`);
      const data = await res.json();
      if (!data.success) return;

      // El filtro de estado se aplica en cliente: la API solo expone activo=true
      const filtrados = (data.proveedores as ProveedorLista[]).filter((p) => {
        if (filtroEstado === 'activos') return !!p.activo;
        if (filtroEstado === 'inactivos') return !p.activo;
        return true;
      });
      setLista(filtrados);
    } catch {
      notificar('error', 'No se pudo cargar la lista de proveedores');
    } finally {
      setCargandoLista(false);
    }
  }, [busqueda, filtroTipo, filtroEstado]);

  useEffect(() => {
    const t = setTimeout(() => cargarLista(), 300);
    return () => clearTimeout(t);
  }, [cargarLista]);

  // forzar = true omite el aviso de cambios sin guardar (uso interno tras guardar)
  const abrirProveedor = async (id: number, forzar = false) => {
    if (!forzar && sucio && !confirm('Hay cambios sin guardar. ¿Descartarlos?')) return;
    try {
      const res = await fetch(`/api/proveedores?id=${id}`);
      const data = await res.json();
      if (!data.success) return notificar('error', data.error || 'No se pudo abrir');

      const p = data.proveedor;
      setForm({
        ...FORM_VACIO,
        // Los NULL de BD se convierten a '' para los inputs controlados
        ...Object.fromEntries(
          Object.entries(p).map(([k, v]) => [k, v === null ? '' : v])
        ),
        // Conversiones explícitas, deben quedar después de la normalización
        incluir_en_catalogo: !!p.incluir_en_catalogo,
        activo: !!p.activo,
        limite_credito_usd: String(p.limite_credito_usd ?? '0.00'),
        dias_credito: String(p.dias_credito ?? '30'),
        saldo_actual: String(p.saldo_actual ?? '0.00'),
        saldo_vencido: String(p.saldo_vencido ?? '0.00'),
      });

      const cs: Contacto[] = (data.contactos || []).map((c: any, i: number) => ({
        orden: c.orden ?? i + 1,
        nombre: c.nombre || '',
        puesto_cargo: c.puesto_cargo || '',
        telefono: c.telefono || '',
        movil: c.movil || '',
        email: c.email || '',
      }));
      while (cs.length < 2) cs.push(CONTACTO_VACIO(cs.length + 1));
      setContactos(cs);

      setCuentas((data.cuentas || []).map((c: any) => ({
        idcuenta: c.idcuenta,
        numero_cuenta: c.numero_cuenta || '',
        beneficiario: c.beneficiario || '',
        direccion_beneficiario: c.direccion_beneficiario || '',
        banco: c.banco || '',
        direccion_banco: c.direccion_banco || '',
        codigo_aba: c.codigo_aba || '',
        codigo_swift: c.codigo_swift || '',
        codigo_iban: c.codigo_iban || '',
        moneda: c.moneda || '',
        comentarios: c.comentarios || '',
      })));

      setCuentaEditando(null);
      setModo('editar');
      setSucio(false);
    } catch {
      notificar('error', 'Error al abrir el proveedor');
    }
  };

  const nuevoProveedor = async () => {
    if (sucio && !confirm('Hay cambios sin guardar. ¿Descartarlos?')) return;
    setForm({ ...FORM_VACIO });
    setContactos([CONTACTO_VACIO(1), CONTACTO_VACIO(2)]);
    setCuentas([]);
    setCuentaEditando(null);
    setModo('nuevo');
    setSucio(false);
    // Sugerir código según el tipo por defecto
    try {
      const res = await fetch('/api/proveedores?sugerir_codigo=LOCAL');
      const data = await res.json();
      if (data.success) setForm((f: any) => ({ ...f, codigo: data.codigo }));
    } catch { /* el backend lo genera igual si queda vacío */ }
  };

  // Al cambiar el tipo en modo nuevo, se resugiere el código
  const cambiarTipo = async (tipo: string) => {
    setForm((f: any) => ({ ...f, tipo_proveedor: tipo }));
    setSucio(true);
    if (modo !== 'nuevo') return;
    try {
      const res = await fetch(`/api/proveedores?sugerir_codigo=${tipo}`);
      const data = await res.json();
      if (data.success) setForm((f: any) => ({ ...f, codigo: data.codigo }));
    } catch { /* ignorar */ }
  };

  // ---------- Guardar ----------

  const guardar = async () => {
    if (!form.nombre_legal.trim()) {
      return notificar('error', 'El nombre legal es obligatorio');
    }

    setGuardando(true);
    try {
      const payload = {
        ...form,
        limite_credito_usd: parseFloat(form.limite_credito_usd) || 0,
        dias_credito: parseInt(form.dias_credito) || 0,
        contactos,
      };
      delete payload.saldo_actual;
      delete payload.saldo_vencido;

      const esNuevo = modo === 'nuevo';
      const res = await fetch('/api/proveedores', {
        method: esNuevo ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!data.success) {
        notificar('error', data.error || 'No se pudo guardar');
        return;
      }

      notificar('ok', data.mensaje || 'Guardado');
      setSucio(false);
      await cargarLista();
      await abrirProveedor(esNuevo ? data.idproveedor : form.idproveedor, true);
    } catch {
      notificar('error', 'Error de conexión al guardar');
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async () => {
    if (modo !== 'editar') return;
    if (!confirm(`¿Desactivar el proveedor "${form.nombre_legal}"?`)) return;

    try {
      const res = await fetch(`/api/proveedores?id=${form.idproveedor}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!data.success) return notificar('error', data.error || 'No se pudo desactivar');

      notificar('ok', 'Proveedor desactivado');
      setForm({ ...FORM_VACIO });
      setModo('vacio');
      setSucio(false);
      cargarLista();
    } catch {
      notificar('error', 'Error al desactivar');
    }
  };

  // ---------- Navegación entre registros ----------

  const indiceActual = lista.findIndex((p) => p.idproveedor === form.idproveedor);

  const irA = (destino: 'primero' | 'anterior' | 'siguiente' | 'ultimo') => {
    if (lista.length === 0) return;
    let i: number;
    switch (destino) {
      case 'primero': i = 0; break;
      case 'ultimo': i = lista.length - 1; break;
      case 'anterior': i = Math.max(0, indiceActual - 1); break;
      case 'siguiente': i = Math.min(lista.length - 1, indiceActual + 1); break;
    }
    abrirProveedor(lista[i].idproveedor);
  };

  // ---------- Exportar a Excel ----------

  const exportarExcel = async () => {
    if (lista.length === 0) return notificar('error', 'No hay registros para exportar');
    try {
      const XLSX = await import('xlsx');
      const filas = lista.map((p) => ({
        'Código': p.codigo,
        'Tipo': p.tipo_proveedor,
        'Nombre legal': p.nombre_legal,
        'Nombre comercial': p.nombre_comercial || '',
        'Alias': p.alias || '',
        'País': p.pais || '',
        'NIT': p.nit || '',
        'Contactos': p.total_contactos,
        'Cuentas': p.total_cuentas,
        'Estado': p.activo ? 'Activo' : 'Inactivo',
      }));

      const hoja = XLSX.utils.json_to_sheet(filas);
      hoja['!cols'] = [
        { wch: 10 }, { wch: 12 }, { wch: 38 }, { wch: 28 }, { wch: 14 },
        { wch: 16 }, { wch: 20 }, { wch: 10 }, { wch: 9 }, { wch: 10 },
      ];
      const libro = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(libro, hoja, 'Proveedores');

      const fecha = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(libro, `proveedores_${fecha}.xlsx`);
      notificar('ok', `${lista.length} proveedor(es) exportado(s)`);
    } catch {
      notificar('error', 'No se pudo generar el archivo de Excel');
    }
  };

  // ---------- Imprimir ficha ----------

  const imprimirFicha = async () => {
    if (modo !== 'editar') return;
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text('Ficha de Proveedor', 14, 18);
      doc.setFontSize(10);
      doc.setTextColor(110);
      doc.text(`${form.codigo} · ${form.nombre_legal}`, 14, 25);
      doc.setTextColor(0);

      autoTable(doc, {
        startY: 32,
        head: [['Datos generales', '']],
        body: [
          ['Código', form.codigo || '-'],
          ['Tipo', form.tipo_proveedor === 'EXTRANJERO' ? 'Extranjero' : 'Local'],
          ['Nombre legal', form.nombre_legal || '-'],
          ['Nombre comercial', form.nombre_comercial || '-'],
          ['Alias', form.alias || '-'],
          ['Dirección', [form.direccion, form.ciudad].filter(Boolean).join(', ') || '-'],
          ['Dirección 2', [form.direccion2, form.ciudad2].filter(Boolean).join(', ') || '-'],
          ['País', form.pais || '-'],
          ['Teléfono', [form.telefono, form.telefono2].filter(Boolean).join(' / ') || '-'],
          ['Email', form.email || '-'],
          ['Sitio web', form.sitio_web || '-'],
          ['NIT', form.nit || '-'],
          ['NRC', form.nrc || '-'],
          ['Giro', form.giro || '-'],
          ['Categoría', String(form.categoria_contribuyente || '-').replace(/_/g, ' ')],
          ['Qué provee', String(form.que_provee || '-').replace(/_/g, ' ')],
          ['Límite de crédito', `$${Number(form.limite_credito_usd || 0).toFixed(2)}`],
          ['Días de crédito', String(form.dias_credito ?? '-')],
        ],
        theme: 'striped',
        headStyles: { fillColor: [14, 136, 201] },
        styles: { fontSize: 9 },
        columnStyles: { 0: { cellWidth: 45, fontStyle: 'bold' } },
      });

      const contactosLlenos = contactos.filter((c) => c.nombre || c.telefono || c.movil || c.email);
      if (contactosLlenos.length > 0) {
        autoTable(doc, {
          head: [['Contacto', 'Puesto', 'Teléfono', 'Móvil', 'Email']],
          body: contactosLlenos.map((c) => [
            c.nombre || '-', c.puesto_cargo || '-', c.telefono || '-',
            c.movil || '-', c.email || '-',
          ]),
          theme: 'grid',
          headStyles: { fillColor: [14, 136, 201] },
          styles: { fontSize: 8 },
        });
      }

      if (cuentas.length > 0) {
        autoTable(doc, {
          head: [['Cuenta', 'Banco', 'Moneda', 'SWIFT', 'IBAN', 'ABA']],
          body: cuentas.map((c) => [
            c.numero_cuenta || '-', c.banco || '-', c.moneda || '-',
            c.codigo_swift || '-', c.codigo_iban || '-', c.codigo_aba || '-',
          ]),
          theme: 'grid',
          headStyles: { fillColor: [14, 136, 201] },
          styles: { fontSize: 7 },
        });
      }

      doc.save(`proveedor_${form.codigo}.pdf`);
      notificar('ok', 'Ficha generada');
    } catch {
      notificar('error', 'No se pudo generar el PDF');
    }
  };

  // ---------- Cuentas bancarias ----------

  // Recarga solo las cuentas. Evita recargar toda la ficha, que descartaría
  // ediciones sin guardar de las otras pestañas.
  const recargarCuentas = async (idproveedor: number) => {
    try {
      const res = await fetch(`/api/proveedores/cuentas?idproveedor=${idproveedor}`);
      const data = await res.json();
      if (!data.success) return;
      setCuentas((data.cuentas || []).map((c: any) => ({
        idcuenta: c.idcuenta,
        numero_cuenta: c.numero_cuenta || '',
        beneficiario: c.beneficiario || '',
        direccion_beneficiario: c.direccion_beneficiario || '',
        banco: c.banco || '',
        direccion_banco: c.direccion_banco || '',
        codigo_aba: c.codigo_aba || '',
        codigo_swift: c.codigo_swift || '',
        codigo_iban: c.codigo_iban || '',
        moneda: c.moneda || '',
        comentarios: c.comentarios || '',
      })));
    } catch { /* se mantiene la lista actual */ }
  };

  const guardarCuenta = async () => {
    if (!cuentaEditando) return;
    if (!cuentaEditando.numero_cuenta.trim()) {
      return notificar('error', 'El número de cuenta es obligatorio');
    }
    if (modo === 'nuevo') {
      return notificar('error', 'Guardá primero el proveedor para agregarle cuentas');
    }

    const esNueva = !cuentaEditando.idcuenta;
    try {
      const res = await fetch('/api/proveedores/cuentas', {
        method: esNueva ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...cuentaEditando, idproveedor: form.idproveedor }),
      });
      const data = await res.json();
      if (!data.success) return notificar('error', data.error || 'No se pudo guardar la cuenta');

      notificar('ok', data.mensaje || 'Cuenta guardada');
      setCuentaEditando(null);
      await recargarCuentas(form.idproveedor);
      await cargarLista();
    } catch {
      notificar('error', 'Error al guardar la cuenta');
    }
  };

  const eliminarCuenta = async (idcuenta?: number) => {
    if (!idcuenta) return;
    if (!confirm('¿Eliminar esta cuenta bancaria?')) return;
    try {
      const res = await fetch(`/api/proveedores/cuentas?idcuenta=${idcuenta}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!data.success) return notificar('error', data.error || 'No se pudo eliminar');
      notificar('ok', 'Cuenta eliminada');
      await recargarCuentas(form.idproveedor);
      await cargarLista();
    } catch {
      notificar('error', 'Error al eliminar la cuenta');
    }
  };

  // ---------- Helpers de render ----------

  const set = (campo: string) => (e: any) => {
    setForm((f: any) => ({ ...f, [campo]: e.target.value }));
    setSucio(true);
  };

  const setContacto = (i: number, campo: keyof Contacto) => (e: any) => {
    setContactos((cs) =>
      cs.map((c, idx) => (idx === i ? { ...c, [campo]: e.target.value } : c))
    );
    setSucio(true);
  };

  const setCuenta = (campo: keyof Cuenta) => (e: any) =>
    setCuentaEditando((c) => (c ? { ...c, [campo]: e.target.value } : c));

  const campo = (etiqueta: string, nombre: string, extra?: { placeholder?: string; maxLength?: number }) => (
    <div className="space-y-1.5">
      <Label className={LABEL_CLS}>{etiqueta}</Label>
      <Input
        value={form[nombre] ?? ''}
        onChange={set(nombre)}
        className={INPUT_CLS}
        placeholder={extra?.placeholder}
        maxLength={extra?.maxLength}
        disabled={modo === 'vacio'}
      />
    </div>
  );

  const hayFicha = modo !== 'vacio';

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-slate-50 dark:bg-surface-deep p-6">
        <div className="space-y-6">

          {/* Navbar */}
          <div className="rounded-xl border border-sky-200 dark:border-primary/30 bg-white dark:bg-background px-5 py-3 flex items-center justify-between gap-4 shadow-sm dark:shadow-[0_0_25px_rgba(15,23,42,0.9)]">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Compras</span>
              <span className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
              <span className="text-sm tracking-[0.18em] uppercase text-slate-700 dark:text-slate-200">Proveedores</span>
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
              <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Proveedores</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Datos generales, contactos y cuentas bancarias
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {sucio && (
                <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Cambios sin guardar
                </Badge>
              )}
              <Badge variant="outline" className="text-primary border-primary/50">
                <Building2 className="h-3.5 w-3.5 mr-1" />
                {lista.length} registros
              </Badge>

              {/* Navegación primero / anterior / siguiente / último */}
              <div className="flex items-center rounded-full border border-slate-700 overflow-hidden">
                <Button
                  variant="ghost" size="icon"
                  onClick={() => irA('primero')}
                  disabled={lista.length === 0 || indiceActual === 0}
                  title="Primero"
                  className="h-8 w-8 rounded-none text-slate-400 hover:text-primary disabled:opacity-30"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost" size="icon"
                  onClick={() => irA('anterior')}
                  disabled={lista.length === 0 || indiceActual <= 0}
                  title="Anterior"
                  className="h-8 w-8 rounded-none text-slate-400 hover:text-primary disabled:opacity-30"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-2 text-xs text-slate-500 dark:text-slate-500 tabular-nums">
                  {indiceActual >= 0 ? indiceActual + 1 : '-'}/{lista.length}
                </span>
                <Button
                  variant="ghost" size="icon"
                  onClick={() => irA('siguiente')}
                  disabled={lista.length === 0 || indiceActual === lista.length - 1}
                  title="Siguiente"
                  className="h-8 w-8 rounded-none text-slate-400 hover:text-primary disabled:opacity-30"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost" size="icon"
                  onClick={() => irA('ultimo')}
                  disabled={lista.length === 0 || indiceActual === lista.length - 1}
                  title="Último"
                  className="h-8 w-8 rounded-none text-slate-400 hover:text-primary disabled:opacity-30"
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>

              <Button
                onClick={exportarExcel}
                variant="outline"
                title="Enviar a Excel"
                className="border-emerald-600/50 text-emerald-400 hover:bg-emerald-600/10 rounded-full"
              >
                <FileSpreadsheet className="h-4 w-4" />
              </Button>
              <Button
                onClick={imprimirFicha}
                disabled={modo !== 'editar'}
                variant="outline"
                title="Imprimir ficha"
                className="border-slate-600 text-slate-300 hover:bg-slate-700/30 rounded-full disabled:opacity-40"
              >
                <Printer className="h-4 w-4" />
              </Button>

              <Button
                onClick={nuevoProveedor}
                className="bg-primary hover:bg-primary/80 text-white rounded-full"
              >
                <Plus className="h-4 w-4 mr-1" /> Nuevo
              </Button>
              <Button
                onClick={guardar}
                disabled={!hayFicha || guardando}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full disabled:opacity-40"
              >
                {guardando
                  ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  : <Save className="h-4 w-4 mr-1" />}
                Guardar
              </Button>
              <Button
                onClick={eliminar}
                disabled={modo !== 'editar'}
                variant="outline"
                className="border-red-500/50 text-red-400 hover:bg-red-500/10 rounded-full disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Panel izquierdo: buscador + lista */}
            <Card className="lg:col-span-1 bg-white dark:bg-card border border-sky-200/80 dark:border-primary/30">
              <CardContent className="p-4 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Input
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Código, alias, nombre o NIT..."
                    className={`${INPUT_CLS} pl-9`}
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Busca por alias y por ID de proveedor, además del nombre.
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={filtroTipo}
                    onChange={(e) => setFiltroTipo(e.target.value)}
                    className={SELECT_CLS}
                  >
                    <option value="">Todo tipo</option>
                    <option value="LOCAL">Locales</option>
                    <option value="EXTRANJERO">Extranjeros</option>
                  </select>
                  <select
                    value={filtroEstado}
                    onChange={(e) => setFiltroEstado(e.target.value as any)}
                    className={SELECT_CLS}
                  >
                    <option value="activos">Activos</option>
                    <option value="inactivos">Inactivos</option>
                    <option value="todos">Todos</option>
                  </select>
                </div>

                <div className="max-h-[560px] overflow-y-auto space-y-1.5 pr-1">
                  {cargandoLista ? (
                    <div className="flex items-center justify-center py-10 text-slate-500">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  ) : lista.length === 0 ? (
                    <div className="text-center py-10 text-slate-500 text-sm">
                      Sin proveedores registrados
                    </div>
                  ) : (
                    lista.map((p) => (
                      <button
                        key={p.idproveedor}
                        onClick={() => abrirProveedor(p.idproveedor)}
                        className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${
                          form.idproveedor === p.idproveedor
                            ? 'border-primary bg-primary/10'
                            : 'border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-background hover:border-primary/60'
                        } ${!p.activo ? 'opacity-50' : ''}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-mono text-primary">{p.codigo}</span>
                          <span className="text-[10px] uppercase tracking-wider text-slate-500">
                            {p.tipo_proveedor === 'EXTRANJERO' ? 'Ext.' : 'Local'}
                          </span>
                        </div>
                        <div className="text-sm text-slate-700 dark:text-slate-200 truncate">{p.nombre_legal}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {p.alias && (
                            <span className="text-[11px] text-slate-400">{p.alias}</span>
                          )}
                          {p.total_cuentas > 0 && (
                            <span className="text-[11px] text-slate-500 flex items-center gap-0.5">
                              <Landmark className="h-3 w-3" />{p.total_cuentas}
                            </span>
                          )}
                          {!p.activo && (
                            <span className="text-[10px] text-red-400 uppercase">inactivo</span>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Panel derecho: ficha */}
            <Card className="lg:col-span-2 bg-white dark:bg-card border border-sky-200/80 dark:border-primary/30">
              <CardContent className="p-5">
                {!hayFicha ? (
                  <div className="flex flex-col items-center justify-center py-24 text-slate-500">
                    <Building2 className="h-14 w-14 mb-4 opacity-40" />
                    <p className="text-sm">Selecciona un proveedor de la lista</p>
                    <p className="text-xs mt-1">o presiona Nuevo para crear uno</p>
                  </div>
                ) : (
                  <Tabs defaultValue="general" className="w-full">
                    <TabsList className="bg-slate-100 dark:bg-surface-deep border border-slate-200 dark:border-slate-700/60 w-full justify-start">
                      <TabsTrigger
                        value="general"
                        className="data-[state=active]:bg-primary data-[state=active]:text-white text-slate-400"
                      >
                        <Building2 className="h-4 w-4 mr-1.5" /> General
                      </TabsTrigger>
                      <TabsTrigger
                        value="contactos"
                        className="data-[state=active]:bg-primary data-[state=active]:text-white text-slate-400"
                      >
                        <Users className="h-4 w-4 mr-1.5" /> Contactos
                      </TabsTrigger>
                      <TabsTrigger
                        value="cuentas"
                        className="data-[state=active]:bg-primary data-[state=active]:text-white text-slate-400"
                      >
                        <Landmark className="h-4 w-4 mr-1.5" /> Cuentas
                        {cuentas.length > 0 && (
                          <span className="ml-1.5 text-[10px] bg-slate-700 rounded-full px-1.5">
                            {cuentas.length}
                          </span>
                        )}
                      </TabsTrigger>
                    </TabsList>

                    {/* ---------- GENERAL ---------- */}
                    <TabsContent value="general" className="space-y-5 mt-5">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="space-y-1.5">
                          <Label className={LABEL_CLS}>Código</Label>
                          <Input
                            value={form.codigo}
                            onChange={set('codigo')}
                            className={`${INPUT_CLS} font-mono`}
                            maxLength={20}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className={LABEL_CLS}>Tipo</Label>
                          <select
                            value={form.tipo_proveedor}
                            onChange={(e) => cambiarTipo(e.target.value)}
                            className={SELECT_CLS}
                          >
                            <option value="LOCAL">Local / Nacional</option>
                            <option value="EXTRANJERO">Extranjero</option>
                          </select>
                        </div>
                        <div className="md:col-span-2">
                          {campo('Alias (para búsquedas)', 'alias', { placeholder: 'Ej: LCR', maxLength: 60 })}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className={LABEL_CLS}>
                            Nombre legal <span className="text-red-400">*</span>
                          </Label>
                          <Input
                            value={form.nombre_legal}
                            onChange={set('nombre_legal')}
                            className={INPUT_CLS}
                            maxLength={200}
                          />
                        </div>
                        {campo('Nombre comercial', 'nombre_comercial', { maxLength: 200 })}
                      </div>

                      {/* Direcciones */}
                      <div className="rounded-lg border border-slate-700/50 p-4 space-y-4">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary">
                          <MapPin className="h-3.5 w-3.5" /> Ubicación
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="md:col-span-2">{campo('Dirección', 'direccion')}</div>
                          {campo('Ciudad', 'ciudad', { maxLength: 100 })}
                          <div className="md:col-span-2">{campo('Dirección 2', 'direccion2')}</div>
                          {campo('Ciudad 2', 'ciudad2', { maxLength: 100 })}
                        </div>
                        {campo('País', 'pais', { maxLength: 100 })}
                      </div>

                      {/* Contacto de la empresa */}
                      <div className="rounded-lg border border-slate-700/50 p-4 space-y-4">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary">
                          <Globe className="h-3.5 w-3.5" /> Contacto de la empresa
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {campo('Teléfono', 'telefono', { maxLength: 30 })}
                          {campo('Teléfono 2', 'telefono2', { maxLength: 30 })}
                          {campo('Fax', 'fax', { maxLength: 30 })}
                          <div className="md:col-span-2">
                            {campo('Correo electrónico', 'email', { maxLength: 150 })}
                          </div>
                          {campo('Sitio web', 'sitio_web', { maxLength: 200 })}
                        </div>
                      </div>

                      {/* Datos fiscales */}
                      <div className="rounded-lg border border-slate-700/50 p-4 space-y-4">
                        <div className="text-xs uppercase tracking-wider text-primary">
                          Datos fiscales
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {campo('NIT / Reg. tributario', 'nit', { maxLength: 30 })}
                          {campo('NRC / Reg. fiscal', 'nrc', { maxLength: 30 })}
                          {campo('Giro', 'giro', { maxLength: 200 })}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className={LABEL_CLS}>Términos y comentarios</Label>
                        <Textarea
                          value={form.terminos_comentarios ?? ''}
                          onChange={set('terminos_comentarios')}
                          rows={4}
                          className={INPUT_CLS}
                        />
                      </div>
                    </TabsContent>

                    {/* ---------- CONTACTOS ---------- */}
                    <TabsContent value="contactos" className="space-y-4 mt-5">
                      <p className="text-xs text-slate-500 dark:text-slate-500">
                        El formulario del cliente maneja dos contactos. Podés agregar más si
                        el proveedor los tiene.
                      </p>

                      {contactos.map((c, i) => (
                        <div key={i} className="rounded-lg border border-slate-700/50 p-4 space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-xs uppercase tracking-wider text-primary">
                              Contacto {i + 1}
                            </span>
                            {contactos.length > 2 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setContactos((cs) => cs.filter((_, idx) => idx !== i))
                                }
                                className="text-slate-500 hover:text-red-400 h-7"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <Label className={LABEL_CLS}>Nombre</Label>
                              <Input value={c.nombre} onChange={setContacto(i, 'nombre')} className={INPUT_CLS} maxLength={150} />
                            </div>
                            <div className="space-y-1.5">
                              <Label className={LABEL_CLS}>Puesto / Cargo</Label>
                              <Input value={c.puesto_cargo} onChange={setContacto(i, 'puesto_cargo')} className={INPUT_CLS} maxLength={100} />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                              <Label className={LABEL_CLS}>Teléfono</Label>
                              <Input value={c.telefono} onChange={setContacto(i, 'telefono')} className={INPUT_CLS} maxLength={30} />
                            </div>
                            <div className="space-y-1.5">
                              <Label className={LABEL_CLS}>Móvil</Label>
                              <Input value={c.movil} onChange={setContacto(i, 'movil')} className={INPUT_CLS} maxLength={30} />
                            </div>
                            <div className="space-y-1.5">
                              <Label className={LABEL_CLS}>Email</Label>
                              <Input value={c.email} onChange={setContacto(i, 'email')} className={INPUT_CLS} maxLength={150} />
                            </div>
                          </div>
                        </div>
                      ))}

                      <Button
                        variant="outline"
                        onClick={() =>
                          setContactos((cs) => [...cs, CONTACTO_VACIO(cs.length + 1)])
                        }
                        className="border-primary/50 text-primary hover:bg-primary/10 rounded-full"
                      >
                        <Plus className="h-4 w-4 mr-1" /> Agregar contacto
                      </Button>
                    </TabsContent>

                    {/* ---------- CUENTAS ---------- */}
                    <TabsContent value="cuentas" className="space-y-4 mt-5">
                      {modo === 'nuevo' && (
                        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300 flex items-center gap-2">
                          <AlertCircle className="h-4 w-4" />
                          Guardá primero el proveedor para poder agregarle cuentas.
                        </div>
                      )}

                      {/* Lista de cuentas */}
                      {cuentas.length > 0 && (
                        <div className="space-y-2">
                          {cuentas.map((c) => (
                            <div
                              key={c.idcuenta}
                              className="rounded-lg border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-background px-4 py-3 flex items-center justify-between gap-3"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-sm text-slate-700 dark:text-slate-200">{c.numero_cuenta}</span>
                                  {c.moneda && (
                                    <Badge variant="outline" className="text-[10px] border-slate-600 text-slate-400">
                                      {c.moneda}
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-xs text-slate-400 truncate">
                                  {c.banco || 'Sin banco'}
                                  {c.beneficiario ? ` · ${c.beneficiario}` : ''}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Button
                                  variant="ghost" size="icon"
                                  onClick={() => setCuentaEditando({ ...c })}
                                  className="text-slate-400 hover:text-primary h-8 w-8"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost" size="icon"
                                  onClick={() => eliminarCuenta(c.idcuenta)}
                                  className="text-slate-400 hover:text-red-400 h-8 w-8"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {!cuentaEditando ? (
                        <Button
                          variant="outline"
                          disabled={modo === 'nuevo'}
                          onClick={() => setCuentaEditando(CUENTA_VACIA())}
                          className="border-primary/50 text-primary hover:bg-primary/10 rounded-full disabled:opacity-40"
                        >
                          <Plus className="h-4 w-4 mr-1" /> Agregar cuenta bancaria
                        </Button>
                      ) : (
                        <div className="rounded-lg border border-primary/40 p-4 space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-xs uppercase tracking-wider text-primary">
                              {cuentaEditando.idcuenta ? 'Editar cuenta' : 'Nueva cuenta'}
                            </span>
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => setCuentaEditando(null)}
                              className="text-slate-500 hover:text-slate-300 h-7"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-2 space-y-1.5">
                              <Label className={LABEL_CLS}>
                                Número de cuenta <span className="text-red-400">*</span>
                              </Label>
                              <Input
                                value={cuentaEditando.numero_cuenta}
                                onChange={setCuenta('numero_cuenta')}
                                className={`${INPUT_CLS} font-mono`}
                                maxLength={60}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className={LABEL_CLS}>Moneda</Label>
                              <Input
                                value={cuentaEditando.moneda}
                                onChange={setCuenta('moneda')}
                                className={INPUT_CLS}
                                placeholder="USD, EURO..."
                                maxLength={20}
                              />
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <Label className={LABEL_CLS}>Beneficiario</Label>
                            <Input
                              value={cuentaEditando.beneficiario}
                              onChange={setCuenta('beneficiario')}
                              className={INPUT_CLS}
                              maxLength={200}
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label className={LABEL_CLS}>Dirección del beneficiario</Label>
                            <Input
                              value={cuentaEditando.direccion_beneficiario}
                              onChange={setCuenta('direccion_beneficiario')}
                              className={INPUT_CLS}
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <Label className={LABEL_CLS}>Banco</Label>
                              <Input
                                value={cuentaEditando.banco}
                                onChange={setCuenta('banco')}
                                className={INPUT_CLS}
                                maxLength={200}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className={LABEL_CLS}>Dirección del banco</Label>
                              <Input
                                value={cuentaEditando.direccion_banco}
                                onChange={setCuenta('direccion_banco')}
                                className={INPUT_CLS}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                              <Label className={LABEL_CLS}>Cód. ABA (USA)</Label>
                              <Input
                                value={cuentaEditando.codigo_aba}
                                onChange={setCuenta('codigo_aba')}
                                className={`${INPUT_CLS} font-mono`}
                                maxLength={30}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className={LABEL_CLS}>SWIFT / BIC</Label>
                              <Input
                                value={cuentaEditando.codigo_swift}
                                onChange={setCuenta('codigo_swift')}
                                className={`${INPUT_CLS} font-mono`}
                                maxLength={30}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className={LABEL_CLS}>IBAN (Europa)</Label>
                              <Input
                                value={cuentaEditando.codigo_iban}
                                onChange={setCuenta('codigo_iban')}
                                className={`${INPUT_CLS} font-mono`}
                                maxLength={60}
                              />
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <Label className={LABEL_CLS}>Comentarios / Instrucciones</Label>
                            <Textarea
                              value={cuentaEditando.comentarios}
                              onChange={setCuenta('comentarios')}
                              rows={3}
                              className={INPUT_CLS}
                            />
                          </div>

                          <Button
                            onClick={guardarCuenta}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full"
                          >
                            <Save className="h-4 w-4 mr-1" /> Guardar cuenta
                          </Button>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Barra inferior: común a las 3 pestañas, como en el sistema del cliente */}
          {hayFicha && (
            <Card className="bg-white dark:bg-background border border-sky-200/80 dark:border-primary/30">
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                  <div className="space-y-1.5">
                    <Label className={LABEL_CLS}>Proveedor aplica a</Label>
                    <select
                      value={form.categoria_contribuyente}
                      onChange={set('categoria_contribuyente')}
                      className={SELECT_CLS}
                    >
                      <option value="CONTRIBUYENTE">Contribuyente</option>
                      <option value="GRAN_CONTRIBUYENTE">Gran Contribuyente</option>
                      <option value="PEQUENO">Pequeño</option>
                      <option value="OTRO">Otro</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className={LABEL_CLS}>¿Qué provee?</Label>
                    <select
                      value={form.que_provee}
                      onChange={set('que_provee')}
                      className={SELECT_CLS}
                    >
                      <option value="PRODUCTO">Producto</option>
                      <option value="GASTO">Gasto</option>
                      <option value="PRODUCTO_Y_GASTO">Producto y Gasto</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className={LABEL_CLS}>Límite de crédito (USD)</Label>
                    <Input
                      type="number" step="0.01" min="0"
                      value={form.limite_credito_usd}
                      onChange={set('limite_credito_usd')}
                      className={INPUT_CLS}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className={LABEL_CLS}>Días de crédito</Label>
                    <Input
                      type="number" min="0"
                      value={form.dias_credito}
                      onChange={set('dias_credito')}
                      className={INPUT_CLS}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-6 mt-5 pt-4 border-t border-slate-700/50">
                  <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!form.incluir_en_catalogo}
                      onChange={(e) => {
                        setForm((f: any) => ({ ...f, incluir_en_catalogo: e.target.checked }));
                        setSucio(true);
                      }}
                      className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-surface-deep accent-primary"
                    />
                    Incluir en catálogo
                  </label>

                  <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!form.activo}
                      onChange={(e) => {
                        setForm((f: any) => ({ ...f, activo: e.target.checked }));
                        setSucio(true);
                      }}
                      className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-surface-deep accent-primary"
                    />
                    Activo
                  </label>

                  {/* Saldos: los alimentará Cuentas por Pagar cuando exista */}
                  <div className="flex items-center gap-4 ml-auto text-xs">
                    <div className="text-slate-500">
                      Saldo actual:{' '}
                      <span className="text-slate-300 font-mono">
                        ${Number(form.saldo_actual || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="text-slate-500">
                      Saldo vencido:{' '}
                      <span className="text-slate-300 font-mono">
                        ${Number(form.saldo_vencido || 0).toFixed(2)}
                      </span>
                    </div>
                    <span className="text-slate-600 italic">
                      (los actualizará Cuentas por Pagar)
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
