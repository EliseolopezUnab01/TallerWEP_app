'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/dashboard-layout';
import { NotificationDropdown } from '@/components/notification-dropdown';
import { UserDropdown } from '@/components/user-dropdown';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Package, ShoppingCart, Truck, Users, FileText, Wrench,
  Car, ClipboardList, Loader2, TrendingUp,
  AlertTriangle, CheckCircle2, Clock, BarChart3,
} from 'lucide-react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';

interface DashboardStats {
  inventario: {
    total: number;
    stockOk: number;
    stockBajo: number;
    stockCero: number;
    stockNegativo: number;
  };
  proveedores: { total: number; activos: number };
  compras: { borradores: number; lineas: number };
  catalogo: { rubrosActivos: number };
  categorias: { nombre: string; cantidad: number }[];
}

const STOCK_COLORS = ['#10b981', '#f59e0b', '#64748b', '#ef4444'];
const BAR_COLOR = '#0e88c9';

const CARD =
  'bg-card border border-border shadow-[0_8px_30px_rgba(14,136,201,0.08)] dark:shadow-[0_0_30px_rgba(14,136,201,0.08)] rounded-xl';

const CHART_TOOLTIP = {
  background: 'var(--tooltip-bg)',
  border: '1px solid var(--tooltip-border)',
  borderRadius: 8,
  fontSize: 12,
  color: '#e2e8f0',
};

const ACCIONES = [
  {
    label: 'Inventario', sub: 'Productos y stock', href: '/dashboard/inventario/administrar', icon: Package, ready: true,
    tint: 'from-emerald-50 to-white dark:from-background dark:to-background',
    border: 'border-emerald-300/80 dark:border-emerald-500/40',
    glow: 'shadow-emerald-200/80 hover:shadow-emerald-300/90 dark:hover:shadow-emerald-500/20',
    iconBg: 'bg-emerald-100 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/30',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    label: 'Compras', sub: 'Proveedores y líneas', href: '/dashboard/compras/proveedores', icon: ShoppingCart, ready: true,
    tint: 'from-violet-50 to-white dark:from-background dark:to-background',
    border: 'border-violet-300/80 dark:border-violet-500/40',
    glow: 'shadow-violet-200/80 hover:shadow-violet-300/90 dark:hover:shadow-violet-500/20',
    iconBg: 'bg-violet-100 dark:bg-violet-500/15 border-violet-200 dark:border-violet-500/30',
    iconColor: 'text-violet-600 dark:text-violet-400',
  },
  {
    label: 'Proveedores', sub: 'Ficha y cuentas', href: '/dashboard/compras/proveedores', icon: Truck, ready: true,
    tint: 'from-cyan-50 to-white dark:from-background dark:to-background',
    border: 'border-cyan-300/80 dark:border-cyan-500/40',
    glow: 'shadow-cyan-200/80 hover:shadow-cyan-300/90 dark:hover:shadow-cyan-500/20',
    iconBg: 'bg-cyan-100 dark:bg-cyan-500/15 border-cyan-200 dark:border-cyan-500/30',
    iconColor: 'text-cyan-600 dark:text-cyan-400',
  },
  {
    label: 'Recepción', sub: 'Vehículos', href: '#', icon: Car, ready: false,
    tint: 'from-blue-50/70 to-white dark:from-background dark:to-background',
    border: 'border-blue-200 dark:border-blue-500/30',
    glow: 'shadow-blue-100/60 dark:shadow-none',
    iconBg: 'bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20',
    iconColor: 'text-blue-400 dark:text-blue-400/70',
  },
  {
    label: 'Taller', sub: 'Órdenes de trabajo', href: '#', icon: Wrench, ready: false,
    tint: 'from-orange-50/70 to-white dark:from-background dark:to-background',
    border: 'border-orange-200 dark:border-orange-500/30',
    glow: 'shadow-orange-100/60 dark:shadow-none',
    iconBg: 'bg-orange-50 dark:bg-orange-500/10 border-orange-100 dark:border-orange-500/20',
    iconColor: 'text-orange-400 dark:text-orange-400/70',
  },
  {
    label: 'Cotizaciones', sub: 'Presupuestos', href: '#', icon: ClipboardList, ready: false,
    tint: 'from-amber-50/70 to-white dark:from-background dark:to-background',
    border: 'border-amber-200 dark:border-amber-500/30',
    glow: 'shadow-amber-100/60 dark:shadow-none',
    iconBg: 'bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20',
    iconColor: 'text-amber-400 dark:text-amber-400/70',
  },
  {
    label: 'Clientes', sub: 'Directorio', href: '#', icon: Users, ready: false,
    tint: 'from-pink-50/70 to-white dark:from-background dark:to-background',
    border: 'border-pink-200 dark:border-pink-500/30',
    glow: 'shadow-pink-100/60 dark:shadow-none',
    iconBg: 'bg-pink-50 dark:bg-pink-500/10 border-pink-100 dark:border-pink-500/20',
    iconColor: 'text-pink-400 dark:text-pink-400/70',
  },
  {
    label: 'Facturación', sub: 'DTE y ventas', href: '#', icon: FileText, ready: false,
    tint: 'from-rose-50/70 to-white dark:from-background dark:to-background',
    border: 'border-rose-200 dark:border-rose-500/30',
    glow: 'shadow-rose-100/60 dark:shadow-none',
    iconBg: 'bg-rose-50 dark:bg-rose-500/10 border-rose-100 dark:border-rose-500/20',
    iconColor: 'text-rose-400 dark:text-rose-400/70',
  },
];

const MODULOS = [
  { nombre: 'Inventario', pct: 95, estado: 'Operativo' },
  { nombre: 'Compras — Proveedores', pct: 90, estado: 'Operativo' },
  { nombre: 'Compras — Catálogo contable', pct: 100, estado: 'Operativo' },
  { nombre: 'Compras — Líneas (Control 30)', pct: 100, estado: 'Operativo' },
  { nombre: 'Compras — Factura completa', pct: 15, estado: 'Esperando cliente' },
  { nombre: 'Órdenes de trabajo', pct: 10, estado: 'Pendiente' },
  { nombre: 'Ventas / Facturación', pct: 0, estado: 'Pendiente' },
  { nombre: 'Cuentas por pagar', pct: 0, estado: 'Pendiente' },
];

function fmt(n: number) {
  return n.toLocaleString('es-SV');
}

function Tile({ item }: { item: typeof ACCIONES[0] }) {
  const Icon = item.icon;
  const inner = (
    <div
      className={`group relative overflow-hidden rounded-2xl border bg-gradient-to-br ${item.tint} ${item.border} p-4 shadow-md ${item.glow} transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
        item.ready ? 'cursor-pointer' : 'opacity-70'
      }`}
    >
      <div className="absolute -top-6 -right-6 h-20 w-20 rounded-full bg-white/40 dark:bg-white/5 blur-xl pointer-events-none" />
      <div className="relative flex flex-col items-center text-center gap-2 py-1">
        <div className={`rounded-xl p-3 border shadow-inner ${item.iconBg}`}>
          <Icon className={`h-6 w-6 ${item.iconColor}`} />
        </div>
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{item.label}</span>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">{item.sub}</span>
        {!item.ready && (
          <Badge variant="outline" className="text-[10px] border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 mt-1 bg-white/70 dark:bg-transparent">
            Próximamente
          </Badge>
        )}
      </div>
    </div>
  );

  if (item.ready && item.href !== '#') {
    return <Link href={item.href}>{inner}</Link>;
  }
  return inner;
}

function KpiCard({
  label, value, sub, gradient, icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  gradient: string;
  icon: typeof Package;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-4 ${gradient} shadow-[0_10px_28px_rgba(15,23,42,0.18)] dark:shadow-lg`}>
      <div className="absolute inset-0 bg-gradient-to-tr from-white/15 via-transparent to-black/10 pointer-events-none" />
      <div className="absolute top-0 right-0 w-28 h-28 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-sm" />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-white/85 font-medium">{label}</p>
          <p className="text-2xl font-bold text-white mt-1 tabular-nums drop-shadow-sm">{value}</p>
          {sub && <p className="text-xs text-white/75 mt-0.5">{sub}</p>}
        </div>
        <Icon className="h-9 w-9 text-white/35" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard/stats')
      .then((r) => r.json())
      .then((d) => { if (d.success) setStats(d); })
      .catch(() => {})
      .finally(() => setCargando(false));
  }, []);

  const stockPie = stats
    ? [
        { name: 'Stock OK', value: stats.inventario.stockOk },
        { name: 'Stock bajo', value: stats.inventario.stockBajo },
        { name: 'Sin stock', value: stats.inventario.stockCero },
        { name: 'Negativo', value: stats.inventario.stockNegativo },
      ].filter((x) => x.value > 0)
    : [];

  const catBars = stats?.categorias.slice(0, 6) || [];

  return (
    <DashboardLayout>
      <div className="-mx-6 -mt-6 space-y-6">
        {/* Hero */}
        <div className="relative h-[220px] sm:h-[260px] overflow-hidden">
          <div
            className="absolute inset-0 bg-sky-100 dark:bg-[#0a0f1a]"
            style={{
              backgroundImage: `
                linear-gradient(105deg, color-mix(in oklab, var(--hero-bg) 92%, transparent) 0%, color-mix(in oklab, var(--hero-bg) 55%, transparent) 40%, rgba(14,136,201,0.28) 100%),
                linear-gradient(180deg, transparent 55%, var(--hero-fade) 100%),
                radial-gradient(ellipse 80% 60% at 85% 50%, rgba(14,136,201,0.25), transparent),
                url('/images/dashboard-hero.jpg')
              `,
              backgroundSize: 'cover',
              backgroundPosition: 'center right',
            }}
          />
          {/* Fallback grid si no hay imagen */}
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage: `
                linear-gradient(rgba(14,136,201,0.08) 1px, transparent 1px),
                linear-gradient(90deg, rgba(14,136,201,0.08) 1px, transparent 1px)
              `,
              backgroundSize: '40px 40px',
            }}
          />
          <div className="relative z-10 h-full px-6 flex flex-col justify-between py-5">
            <div className="flex items-center justify-between">
              <div className="rounded-xl border border-border bg-card/90 backdrop-blur px-4 py-2 flex items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Taller Web</span>
                <span className="h-4 w-px bg-border" />
                <span className="text-sm text-foreground">Panel de control</span>
              </div>
              <div className="flex items-center gap-2">
                <NotificationDropdown />
                <UserDropdown />
              </div>
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white tracking-tight drop-shadow-lg">
                Centro de operaciones
              </h1>
              <p className="text-slate-700 dark:text-white/80 text-sm sm:text-base mt-1 max-w-xl">
                Vista general del taller — inventario, compras y módulos en desarrollo
              </p>
            </div>
          </div>
        </div>

        <div className="relative px-6 space-y-6 pb-8 bg-gradient-to-b from-slate-100/80 via-slate-50 to-white dark:from-transparent dark:via-transparent dark:to-transparent">
          {/* Accesos rápidos */}
          <section className="rounded-2xl border border-border bg-card/70 dark:bg-background/40 backdrop-blur-sm p-5 shadow-[0_12px_40px_rgba(14,136,201,0.07)] dark:shadow-none">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-4">
              Accesos rápidos
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {ACCIONES.map((a) => (
                <Tile key={a.label} item={a} />
              ))}
            </div>
          </section>

          {/* KPIs */}
          {cargando ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : stats && (
            <>
              <section className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                <KpiCard
                  label="Productos"
                  value={fmt(stats.inventario.total)}
                  sub="En catálogo"
                  gradient="bg-gradient-to-br from-blue-500 via-blue-600 to-blue-800"
                  icon={Package}
                />
                <KpiCard
                  label="Proveedores"
                  value={fmt(stats.proveedores.activos)}
                  sub={`${stats.proveedores.total} registrados`}
                  gradient="bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-800"
                  icon={Truck}
                />
                <KpiCard
                  label="Borradores compra"
                  value={fmt(stats.compras.borradores)}
                  sub={`${stats.compras.lineas} líneas`}
                  gradient="bg-gradient-to-br from-violet-500 via-violet-600 to-violet-800"
                  icon={ShoppingCart}
                />
                <KpiCard
                  label="Rubros contables"
                  value={fmt(stats.catalogo.rubrosActivos)}
                  sub="Gastos y activos"
                  gradient="bg-gradient-to-br from-cyan-500 via-cyan-600 to-cyan-800"
                  icon={BarChart3}
                />
                <KpiCard
                  label="Ventas totales"
                  value="—"
                  sub="Módulo pendiente"
                  gradient="bg-gradient-to-br from-slate-500 via-slate-600 to-slate-800"
                  icon={TrendingUp}
                />
                <KpiCard
                  label="Órdenes taller"
                  value="—"
                  sub="Módulo pendiente"
                  gradient="bg-gradient-to-br from-orange-500 via-orange-600 to-orange-800"
                  icon={Wrench}
                />
              </section>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Estado taller — placeholder futurista */}
                <Card className={`lg:col-span-2 ${CARD} overflow-hidden`}>
                  <CardContent className="p-0">
                    <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-gradient-to-r from-sky-50/80 to-transparent dark:from-transparent">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                          Estado del taller
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">Órdenes de trabajo por etapa</p>
                      </div>
                      <Badge variant="outline" className="border-amber-400/60 text-amber-600 dark:text-amber-400 text-[10px] bg-amber-50 dark:bg-transparent">
                        <Clock className="h-3 w-3 mr-1" /> En diseño
                      </Badge>
                    </div>
                    <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {['Diagnóstico', 'En proceso', 'Esperando repuesto', 'Listo entrega'].map((etapa) => (
                        <div
                          key={etapa}
                          className="rounded-xl border border-border dark:border-dashed bg-muted/40 p-4 text-center shadow-sm dark:shadow-none"
                        >
                          <Car className="h-8 w-8 mx-auto text-slate-400 dark:text-slate-600 mb-2" />
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{etapa}</p>
                          <p className="text-lg font-bold text-slate-700 dark:text-slate-600 mt-1">0</p>
                        </div>
                      ))}
                    </div>
                    <p className="px-5 pb-4 text-xs text-slate-500 text-center">
                      Conectaremos esta sección cuando el módulo de órdenes de trabajo esté listo
                    </p>
                  </CardContent>
                </Card>

                {/* Alertas inventario */}
                <Card className={CARD}>
                  <CardContent className="p-5 space-y-4">
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                      Alertas de inventario
                    </h3>
                    <div className="space-y-3">
                      {stats.inventario.stockBajo > 0 && (
                        <div className="flex items-center gap-3 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2">
                          <AlertTriangle className="h-4 w-4 text-amber-500 dark:text-amber-400 shrink-0" />
                          <div>
                            <p className="text-sm text-amber-800 dark:text-amber-200">{stats.inventario.stockBajo} con stock bajo</p>
                            <p className="text-[10px] text-amber-600 dark:text-amber-400/80">≤ 5 unidades</p>
                          </div>
                        </div>
                      )}
                      {stats.inventario.stockCero > 0 && (
                        <div className="flex items-center gap-3 rounded-lg bg-slate-500/10 border border-slate-400/40 dark:border-slate-600/40 px-3 py-2">
                          <Package className="h-4 w-4 text-slate-500 dark:text-slate-400 shrink-0" />
                          <p className="text-sm text-slate-700 dark:text-slate-300">{stats.inventario.stockCero} sin stock</p>
                        </div>
                      )}
                      {stats.inventario.stockNegativo > 0 && (
                        <div className="flex items-center gap-3 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2">
                          <AlertTriangle className="h-4 w-4 text-red-500 dark:text-red-400 shrink-0" />
                          <p className="text-sm text-red-700 dark:text-red-200">{stats.inventario.stockNegativo} stock negativo</p>
                        </div>
                      )}
                      {stats.inventario.stockBajo === 0 &&
                        stats.inventario.stockCero === 0 &&
                        stats.inventario.stockNegativo === 0 && (
                        <div className="flex items-center gap-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                          <p className="text-sm text-emerald-700 dark:text-emerald-200">Sin alertas críticas</p>
                        </div>
                      )}
                    </div>
                    <Link
                      href="/dashboard/inventario/administrar"
                      className="block text-center text-xs text-primary hover:underline mt-2"
                    >
                      Ver inventario completo →
                    </Link>
                  </CardContent>
                </Card>
              </div>

              {/* Gráficos */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className={CARD}>
                  <CardContent className="p-5">
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-4">
                      Distribución de stock
                    </h3>
                    {stockPie.length > 0 ? (
                      <ResponsiveContainer width="100%" height={240}>
                        <PieChart>
                          <Pie
                            data={stockPie}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={85}
                            paddingAngle={3}
                            dataKey="value"
                            stroke="none"
                          >
                            {stockPie.map((_, i) => (
                              <Cell key={i} fill={STOCK_COLORS[i % STOCK_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={CHART_TOOLTIP} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-center text-slate-500 py-16 text-sm">Sin datos de inventario</p>
                    )}
                    <div className="flex flex-wrap justify-center gap-3 mt-2">
                      {stockPie.map((s, i) => (
                        <span key={s.name} className="flex items-center gap-1.5 text-xs text-slate-400">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ background: STOCK_COLORS[i % STOCK_COLORS.length] }}
                          />
                          {s.name}: {s.value}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className={CARD}>
                  <CardContent className="p-5">
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-4">
                      Productos por categoría
                    </h3>
                    {catBars.length > 0 ? (
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={catBars} layout="vertical" margin={{ left: 8, right: 16 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                          <XAxis type="number" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
                          <YAxis
                            type="category"
                            dataKey="nombre"
                            width={100}
                            tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
                          />
                          <Tooltip contentStyle={CHART_TOOLTIP} />
                          <Bar dataKey="cantidad" fill={BAR_COLOR} radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-center text-slate-500 py-16 text-sm">Sin categorías asignadas</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Finanzas placeholder + roadmap */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className={`${CARD} overflow-hidden`}>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                        Análisis financiero
                      </h3>
                      <Badge variant="outline" className="text-[10px] border-slate-300 dark:border-slate-600 text-slate-500 bg-white/80 dark:bg-transparent">
                        Próximamente
                      </Badge>
                    </div>
                    <div className="relative h-48 rounded-xl border border-border dark:border-dashed bg-gradient-to-b from-sky-50 to-white dark:from-surface-deep/50 dark:to-surface-deep/50 flex items-center justify-center overflow-hidden shadow-inner">
                      <div
                        className="absolute inset-0 opacity-30 dark:opacity-20"
                        style={{
                          background: 'linear-gradient(180deg, transparent, rgba(14,136,201,0.35))',
                        }}
                      />
                      <svg viewBox="0 0 400 120" className="w-full h-full p-4 opacity-50 dark:opacity-40">
                        <polyline
                          fill="none"
                          stroke="#0e88c9"
                          strokeWidth="2.5"
                          points="0,80 50,70 100,75 150,50 200,55 250,30 300,40 350,20 400,25"
                          style={{ filter: 'drop-shadow(0 0 6px #0e88c9)' }}
                        />
                      </svg>
                      <p className="absolute text-xs text-slate-500">
                        Ventas, utilidad y CxP — cuando existan los módulos
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className={CARD}>
                  <CardContent className="p-5">
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-4">
                      Avance del sistema
                    </h3>
                    <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                      {MODULOS.map((m) => (
                        <div key={m.nombre}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-700 dark:text-slate-300 truncate pr-2">{m.nombre}</span>
                            <span className="text-slate-500 shrink-0">{m.estado}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden shadow-inner">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-primary to-cyan-400 transition-all shadow-[0_0_8px_rgba(14,136,201,0.45)]"
                              style={{ width: `${m.pct}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
