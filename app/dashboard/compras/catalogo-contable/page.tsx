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
  Search, Plus, Save, Trash2, Receipt, Building, X, Loader2,
  AlertCircle, CheckCircle2, Pencil, BookOpen, RotateCcw,
} from 'lucide-react';

// ---------- Tipos ----------

type Tipo = 'GASTO' | 'ACTIVO';

interface Rubro {
  idcatalogo: number;
  tipo: Tipo;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  cuenta_contable: string | null;
  condicion_iva_sugerida: string | null;
  activo: number;
}

interface FormRubro {
  idcatalogo: number;
  tipo: Tipo;
  codigo: string;
  nombre: string;
  descripcion: string;
  cuenta_contable: string;
  condicion_iva_sugerida: string;
  activo: boolean;
}

const FORM_VACIO = (tipo: Tipo): FormRubro => ({
  idcatalogo: 0,
  tipo,
  codigo: '',
  nombre: '',
  descripcion: '',
  cuenta_contable: '',
  condicion_iva_sugerida: '',
  activo: true,
});

// Control 19 del documento del cliente
const CONDICIONES_IVA = [
  { valor: '', etiqueta: 'Sin sugerencia' },
  { valor: 'GRAVADA', etiqueta: 'Gravada / Afecta' },
  { valor: 'EXENTO', etiqueta: 'Exento' },
  { valor: 'NO_SUJETO', etiqueta: 'No sujeto' },
  { valor: 'XCOMPROBAR', etiqueta: 'Por comprobar' },
];

const INPUT_CLS = 'bg-white dark:bg-surface-deep border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus-visible:ring-primary';
const SELECT_CLS = 'w-full h-9 rounded-md bg-white dark:bg-surface-deep border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-sm px-3 focus:outline-none focus:ring-2 focus:ring-primary';
const LABEL_CLS = 'text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400';

export default function CatalogoContablePage() {
  const [rubros, setRubros] = useState<Rubro[]>([]);
  const [tipoActivo, setTipoActivo] = useState<Tipo>('GASTO');
  const [busqueda, setBusqueda] = useState('');
  const [verInactivos, setVerInactivos] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [form, setForm] = useState<FormRubro | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const notificar = (tipo: 'ok' | 'error', texto: string) => {
    setAviso({ tipo, texto });
    setTimeout(() => setAviso(null), 4000);
  };

  // ---------- Carga ----------

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const params = new URLSearchParams();
      if (busqueda.trim()) params.set('q', busqueda.trim());
      if (!verInactivos) params.set('activo', 'true');

      const res = await fetch(`/api/catalogo-contable?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setRubros(data.rubros);
      } else {
        notificar('error', data.error || 'No se pudo cargar el catálogo');
      }
    } catch {
      notificar('error', 'Error de conexión al cargar el catálogo');
    } finally {
      setCargando(false);
    }
  }, [busqueda, verInactivos]);

  useEffect(() => {
    const t = setTimeout(cargar, 300);
    return () => clearTimeout(t);
  }, [cargar]);

  // ---------- Acciones ----------

  const nuevoRubro = async () => {
    const base = FORM_VACIO(tipoActivo);
    try {
      const res = await fetch(`/api/catalogo-contable?sugerir_codigo=${tipoActivo}`);
      const data = await res.json();
      if (data.success) base.codigo = data.codigo;
    } catch {
      // Si falla la sugerencia el usuario puede escribir el código a mano
    }
    setForm(base);
  };

  const editarRubro = (r: Rubro) => {
    setForm({
      idcatalogo: r.idcatalogo,
      tipo: r.tipo,
      codigo: r.codigo,
      nombre: r.nombre,
      descripcion: r.descripcion || '',
      cuenta_contable: r.cuenta_contable || '',
      condicion_iva_sugerida: r.condicion_iva_sugerida || '',
      activo: !!r.activo,
    });
  };

  const guardar = async () => {
    if (!form) return;

    if (!form.nombre.trim()) {
      notificar('error', 'El nombre del rubro es obligatorio');
      return;
    }

    setGuardando(true);
    try {
      const esNuevo = form.idcatalogo === 0;
      const res = await fetch('/api/catalogo-contable', {
        method: esNuevo ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (data.success) {
        notificar('ok', data.mensaje);
        setForm(null);
        cargar();
      } else {
        notificar('error', data.error || 'No se pudo guardar');
      }
    } catch {
      notificar('error', 'Error de conexión al guardar');
    } finally {
      setGuardando(false);
    }
  };

  const cambiarEstado = async (r: Rubro) => {
    // Baja lógica: los rubros quedan referenciados por compras históricas
    if (r.activo) {
      const ok = confirm(`¿Desactivar "${r.nombre}"?\n\nDejará de aparecer en el desplegable de compras, pero se conserva en el historial.`);
      if (!ok) return;

      try {
        const res = await fetch(`/api/catalogo-contable?id=${r.idcatalogo}`, {
          method: 'DELETE',
        });
        const data = await res.json();
        if (data.success) {
          notificar('ok', data.mensaje);
          cargar();
        } else {
          notificar('error', data.error || 'No se pudo desactivar');
        }
      } catch {
        notificar('error', 'Error de conexión');
      }
      return;
    }

    // Reactivar
    try {
      const res = await fetch('/api/catalogo-contable', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...r, activo: true }),
      });
      const data = await res.json();
      if (data.success) {
        notificar('ok', 'Rubro reactivado');
        cargar();
      } else {
        notificar('error', data.error || 'No se pudo reactivar');
      }
    } catch {
      notificar('error', 'Error de conexión');
    }
  };

  const setCampo = (campo: keyof FormRubro) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm((f) => (f ? { ...f, [campo]: e.target.value } : f));
  };

  // ---------- Derivados ----------

  const gastos = rubros.filter((r) => r.tipo === 'GASTO');
  const activos = rubros.filter((r) => r.tipo === 'ACTIVO');

  const listaRubros = (items: Rubro[], vacio: string) => (
    <div className="space-y-2">
      {cargando ? (
        <div className="flex items-center justify-center py-14 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-14 text-slate-500 text-sm">{vacio}</div>
      ) : (
        items.map((r) => (
          <div
            key={r.idcatalogo}
            className={`rounded-lg border px-4 py-3 transition-colors ${
              form?.idcatalogo === r.idcatalogo
                ? 'border-primary bg-primary/10'
                : 'border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-background hover:border-primary/60'
            } ${!r.activo ? 'opacity-50' : ''}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono text-primary">{r.codigo}</span>
                  <span className="text-sm text-slate-700 dark:text-slate-200">{r.nombre}</span>
                  {!r.activo && (
                    <span className="text-[10px] text-red-400 uppercase">inactivo</span>
                  )}
                </div>

                {r.descripcion && (
                  <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">{r.descripcion}</p>
                )}

                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  {r.cuenta_contable && (
                    <span className="text-[11px] text-slate-400 font-mono">
                      Cta. {r.cuenta_contable}
                    </span>
                  )}
                  {r.condicion_iva_sugerida && (
                    <Badge
                      variant="outline"
                      className="text-[10px] border-slate-600 text-slate-400 py-0"
                    >
                      Sugiere: {r.condicion_iva_sugerida.replace(/_/g, ' ')}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost" size="icon"
                  onClick={() => editarRubro(r)}
                  title="Editar"
                  className="text-slate-400 hover:text-primary h-8 w-8"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost" size="icon"
                  onClick={() => cambiarEstado(r)}
                  title={r.activo ? 'Desactivar' : 'Reactivar'}
                  className={`h-8 w-8 ${
                    r.activo
                      ? 'text-slate-400 hover:text-red-400'
                      : 'text-slate-400 hover:text-emerald-400'
                  }`}
                >
                  {r.activo
                    ? <Trash2 className="h-4 w-4" />
                    : <RotateCcw className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-slate-50 dark:bg-surface-deep p-6">
        <div className="space-y-6">

          {/* Navbar */}
          <div className="rounded-xl border border-sky-200 dark:border-primary/30 bg-white dark:bg-background px-5 py-3 flex items-center justify-between gap-4 shadow-sm dark:shadow-[0_0_25px_rgba(15,23,42,0.9)]">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Compras</span>
              <span className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
              <span className="text-sm tracking-[0.18em] uppercase text-slate-700 dark:text-slate-200">Catálogo Contable</span>
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
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Catálogo contable</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Rubros de gastos y activos que se eligen al registrar una compra
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-primary border-primary/50">
              <BookOpen className="h-3.5 w-3.5 mr-1" />
              {rubros.length} rubros
            </Badge>
            <Button
              onClick={nuevoRubro}
              className="bg-primary hover:bg-primary/80 text-white rounded-full"
            >
              <Plus className="h-4 w-4 mr-1" /> Nuevo
            </Button>
            <Button
              onClick={guardar}
              disabled={!form || guardando}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full disabled:opacity-40"
            >
              {guardando
                ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                : <Save className="h-4 w-4 mr-1" />}
              Guardar
            </Button>
          </div>
        </div>

        {/* Nota del cliente */}
        <div className="rounded-lg border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-background px-4 py-3 text-xs text-slate-500 dark:text-slate-500 dark:text-slate-400">
          Este listado se activa y es obligatorio cuando el destino de la compra es
          <span className="text-slate-300"> Gastos </span> o
          <span className="text-slate-300"> Activos</span>. Los rubros cargados son los
          ejemplos del documento del cliente; el catálogo definitivo lo entregará el contador.
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Panel izquierdo: lista */}
          <Card className="lg:col-span-2 bg-white dark:bg-card border border-sky-200/80 dark:border-primary/30 shadow-sm dark:shadow-lg rounded-xl">
            <CardContent className="p-4 space-y-4">

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Input
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Código, nombre o descripción..."
                    className={`${INPUT_CLS} pl-9`}
                  />
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-400 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={verInactivos}
                    onChange={(e) => setVerInactivos(e.target.checked)}
                    className="accent-primary"
                  />
                  Ver inactivos
                </label>
              </div>

              <Tabs
                value={tipoActivo}
                onValueChange={(v) => setTipoActivo(v as Tipo)}
                className="w-full"
              >
                <TabsList className="bg-slate-100 dark:bg-surface-deep border border-slate-200 dark:border-slate-700/60 w-full justify-start">
                  <TabsTrigger
                    value="GASTO"
                    className="data-[state=active]:bg-primary data-[state=active]:text-white text-slate-400"
                  >
                    <Receipt className="h-4 w-4 mr-1.5" /> Gastos
                    <span className="ml-1.5 text-[11px] opacity-70">{gastos.length}</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="ACTIVO"
                    className="data-[state=active]:bg-primary data-[state=active]:text-white text-slate-400"
                  >
                    <Building className="h-4 w-4 mr-1.5" /> Activos
                    <span className="ml-1.5 text-[11px] opacity-70">{activos.length}</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="GASTO" className="mt-4">
                  {listaRubros(gastos, 'Sin rubros de gasto registrados')}
                </TabsContent>

                <TabsContent value="ACTIVO" className="mt-4">
                  {listaRubros(activos, 'Sin rubros de activo registrados')}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Panel derecho: formulario */}
          <Card className="lg:col-span-1 bg-white dark:bg-card border border-sky-200/80 dark:border-primary/30 shadow-sm dark:shadow-lg rounded-xl">
            <CardContent className="p-5">
              {!form ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-500 text-center">
                  <BookOpen className="h-12 w-12 mb-4 opacity-40" />
                  <p className="text-sm">Selecciona un rubro para editarlo</p>
                  <p className="text-xs mt-1">o presiona Nuevo rubro</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider text-primary">
                      {form.idcatalogo ? 'Editar rubro' : 'Nuevo rubro'}
                    </span>
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => setForm(null)}
                      className="text-slate-500 hover:text-slate-300 h-7"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-1.5">
                    <Label className={LABEL_CLS}>Tipo</Label>
                    <select
                      value={form.tipo}
                      onChange={setCampo('tipo')}
                      className={SELECT_CLS}
                    >
                      <option value="GASTO">Gasto</option>
                      <option value="ACTIVO">Activo</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className={LABEL_CLS}>Código</Label>
                    <Input
                      value={form.codigo}
                      onChange={setCampo('codigo')}
                      className={`${INPUT_CLS} font-mono`}
                      placeholder="Se genera solo si lo dejas vacío"
                      maxLength={20}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className={LABEL_CLS}>
                      Nombre <span className="text-red-400">*</span>
                    </Label>
                    <Input
                      value={form.nombre}
                      onChange={setCampo('nombre')}
                      className={INPUT_CLS}
                      maxLength={150}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className={LABEL_CLS}>Descripción</Label>
                    <Textarea
                      value={form.descripcion}
                      onChange={setCampo('descripcion')}
                      rows={3}
                      className={INPUT_CLS}
                      placeholder="Qué entra en este rubro"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className={LABEL_CLS}>Cuenta contable</Label>
                    <Input
                      value={form.cuenta_contable}
                      onChange={setCampo('cuenta_contable')}
                      className={`${INPUT_CLS} font-mono`}
                      placeholder="Pendiente del contador"
                      maxLength={30}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className={LABEL_CLS}>Condición de IVA sugerida</Label>
                    <select
                      value={form.condicion_iva_sugerida}
                      onChange={setCampo('condicion_iva_sugerida')}
                      className={SELECT_CLS}
                    >
                      {CONDICIONES_IVA.map((c) => (
                        <option key={c.valor} value={c.valor}>{c.etiqueta}</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-500">
                      Se precargará en la compra al elegir este rubro. El usuario puede cambiarla.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
