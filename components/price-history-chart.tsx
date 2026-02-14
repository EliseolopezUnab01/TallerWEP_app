'use client';

import React, { useState, useEffect, useMemo, memo, useRef, lazy, Suspense } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

// Cache global para la librería recharts - evita múltiples imports
let rechartsCache: any = null;
let rechartsPromise: Promise<any> | null = null;

const loadRecharts = () => {
  if (rechartsCache) return Promise.resolve(rechartsCache);
  if (!rechartsPromise) {
    rechartsPromise = import('recharts').then(mod => {
      rechartsCache = mod;
      return mod;
    });
  }
  return rechartsPromise;
};

interface HistorialEntry {
  idajuste: number;
  fecha: string;
  precio1_anterior: number;
  precio2_anterior: number;
  precio3_anterior: number;
  precio4_anterior: number;
  precio5_anterior: number;
  precio6_anterior: number;
  precio1_nuevo: number;
  precio2_nuevo: number;
  precio3_nuevo: number;
  precio4_nuevo: number;
  precio5_nuevo: number;
  precio6_nuevo: number;
}

const PRICE_CONFIG = [
  { key: 'general', label: 'GEN', fullLabel: 'General', color: '#0e88c9', anteriorKey: 'precio1_anterior', nuevoKey: 'precio1_nuevo', priceKey: 'precio1' },
  { key: 'mayorista', label: 'MAY', fullLabel: 'Mayorista', color: '#10b981', anteriorKey: 'precio2_anterior', nuevoKey: 'precio2_nuevo', priceKey: 'precio2' },
  { key: 'cliente', label: 'CLI', fullLabel: 'Cliente', color: '#f59e0b', anteriorKey: 'precio3_anterior', nuevoKey: 'precio3_nuevo', priceKey: 'precio3' },
  { key: 'mecanico', label: 'MEC', fullLabel: 'Mecánico', color: '#8b5cf6', anteriorKey: 'precio4_anterior', nuevoKey: 'precio4_nuevo', priceKey: 'precio4' },
  { key: 'minorista', label: 'MIN', fullLabel: 'Minorista', color: '#ef4444', anteriorKey: 'precio5_anterior', nuevoKey: 'precio5_nuevo', priceKey: 'precio5' },
  { key: 'especial', label: 'ESP', fullLabel: 'Especial', color: '#06b6d4', anteriorKey: 'precio6_anterior', nuevoKey: 'precio6_nuevo', priceKey: 'precio6' },
];

interface PriceHistoryChartProps {
  idprod: number;
  currentPrices: {
    precio1?: string | number;
    precio2?: string | number;
    precio3?: string | number;
    precio4?: string | number;
    precio5?: string | number;
    precio6?: string | number;
  };
}

// AreaChart con recharts - Optimizado con cache global y dimensiones fijas
const EvolutionChart = memo(function EvolutionChart({ data, color, idprod }: { data: { name: string; precio: number }[]; color: string; idprod: number }) {
  const [Lib, setLib] = useState<any>(rechartsCache);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!Lib) {
      loadRecharts().then(setLib);
    }
  }, [Lib]);

  // Memoizar los datos para evitar re-renders innecesarios
  const memoizedData = useMemo(() => data, [JSON.stringify(data)]);
  const gradientId = useMemo(() => `grad-${idprod}-${color.replace('#','')}`, [idprod, color]);

  // Memoizar el tooltip para evitar recrearlo en cada render
  const tooltipContent = useMemo(() => {
    return ({ active, payload, label }: any) => {
      if (!active || !payload?.length) return null;
      return (
        <div className="bg-[#0d1523] border rounded-md px-2 py-1.5 shadow-lg" style={{ borderColor: color + '60' }}>
          <p className="text-[9px] text-slate-500">{label}</p>
          <p className="text-xs font-bold" style={{ color }}>${parseFloat(payload[0].value).toFixed(2)}</p>
        </div>
      );
    };
  }, [color]);

  if (!Lib) return <div className="h-[100px] bg-[#0a0f1a] rounded-lg border border-slate-800/30 animate-pulse" />;

  const { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip: RTooltip } = Lib;

  // Usar dimensiones fijas en lugar de ResponsiveContainer para mejor rendimiento
  return (
    <div ref={containerRef} className="bg-[#0a0f1a] rounded-lg overflow-hidden border border-slate-800/30">
      <AreaChart width={380} height={100} data={memoizedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" strokeOpacity={0.3} vertical={false} />
        <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 7 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#334155', fontSize: 7 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${v.toFixed(0)}`} domain={['dataMin - 50', 'dataMax + 50']} />
        <RTooltip content={tooltipContent} />
        <Area 
          type="monotone" 
          dataKey="precio" 
          stroke={color} 
          strokeWidth={2} 
          fill={`url(#${gradientId})`} 
          dot={{ r: 3, fill: color, stroke: '#0d1523', strokeWidth: 1.5 }} 
          activeDot={{ r: 5, fill: color, stroke: '#fff', strokeWidth: 2 }} 
          isAnimationActive={false}
        />
      </AreaChart>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison para evitar re-renders innecesarios
  return prevProps.idprod === nextProps.idprod && 
         prevProps.color === nextProps.color &&
         JSON.stringify(prevProps.data) === JSON.stringify(nextProps.data);
});

export function PriceHistoryChart({ idprod, currentPrices }: PriceHistoryChartProps) {
  const [historial, setHistorial] = useState<HistorialEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPrice, setSelectedPrice] = useState(0);

  useEffect(() => {
    const fetchHistorial = async () => {
      try {
        const res = await fetch(`/api/ajuste-precios/historial?idprod=${idprod}`);
        const data = await res.json();
        if (data.historial) {
          setHistorial(data.historial.reverse());
        }
      } catch (e) {
        console.error('Error cargando historial:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchHistorial();
  }, [idprod]);

  // Precios actuales
  const preciosActuales = PRICE_CONFIG.map(cfg => ({
    ...cfg,
    valor: parseFloat(String(currentPrices[cfg.priceKey as keyof typeof currentPrices] || '0')) || 0,
  })).filter(p => p.valor > 0);

  // Construir datos de evolución para UN solo precio
  const buildChartData = (cfg: typeof PRICE_CONFIG[0]) => {
    const data: { name: string; precio: number }[] = [];
    for (let i = 0; i < historial.length; i++) {
      const entry = historial[i] as any;
      const fecha = new Date(entry.fecha).toLocaleDateString('es', { day: '2-digit', month: 'short' });
      if (i === 0) {
        const anterior = parseFloat(entry[cfg.anteriorKey]) || 0;
        if (anterior > 0) data.push({ name: 'Inicial', precio: anterior });
      }
      const nuevo = parseFloat(entry[cfg.nuevoKey]) || 0;
      if (nuevo > 0) data.push({ name: fecha, precio: nuevo });
    }
    const currentVal = parseFloat(String(currentPrices[cfg.priceKey as keyof typeof currentPrices] || '0')) || 0;
    if (currentVal > 0) {
      const last = data[data.length - 1];
      if (!last || Math.abs(last.precio - currentVal) > 0.01) {
        data.push({ name: 'Actual', precio: currentVal });
      }
    }
    return data;
  };

  if (loading) {
    return (
      <div className="pt-2 border-t border-slate-700/50">
        <div className="text-[10px] text-slate-500 text-center py-4 animate-pulse">Cargando...</div>
      </div>
    );
  }

  const hasHistory = historial.length > 0;
  const availablePrices = preciosActuales.length > 0 ? preciosActuales : PRICE_CONFIG.filter(cfg =>
    historial.some((e: any) => (parseFloat(e[cfg.nuevoKey]) || 0) > 0)
  ).map(cfg => ({ ...cfg, valor: 0 }));

  if (availablePrices.length === 0) return null;

  const selected = availablePrices[selectedPrice] || availablePrices[0];
  const chartData = hasHistory ? buildChartData(selected) : [];
  const firstVal = chartData[0]?.precio || 0;
  const lastVal = chartData[chartData.length - 1]?.precio || 0;
  const diff = lastVal - firstVal;
  const diffPercent = firstVal > 0 ? ((diff / firstVal) * 100) : 0;

  return (
    <div className="pt-2 border-t border-slate-700/50 space-y-2">
      {/* Precios Actuales */}
      {preciosActuales.length > 0 && (
        <div>
          <div className="text-[10px] text-slate-500 mb-1.5 font-medium uppercase tracking-wide">Precios de Venta</div>
          <div className="grid grid-cols-3 gap-x-2 gap-y-1">
            {preciosActuales.map((p) => (
              <div key={p.key} className="flex flex-col">
                <span className="text-[8px] uppercase tracking-wider" style={{ color: p.color + '99' }}>{p.fullLabel}</span>
                <span className="text-xs font-bold" style={{ color: p.color }}>${p.valor.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}


      {/* Gráfica de evolución (si hay historial) */}
      {hasHistory && chartData.length >= 2 && (
        <div>
          {/* Selector de precio */}
          <div className="flex items-center gap-1 mb-1.5 flex-wrap">
            {availablePrices.map((p, i) => (
              <button
                key={p.key}
                onClick={() => setSelectedPrice(i)}
                className={`px-1.5 py-0.5 rounded text-[8px] font-medium transition-all ${
                  selectedPrice === i ? 'text-white shadow-sm' : 'text-slate-500 hover:text-slate-300 bg-transparent'
                }`}
                style={selectedPrice === i ? { backgroundColor: p.color, boxShadow: `0 0 8px ${p.color}40` } : {}}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Valor + tendencia */}
          <div className="flex items-end justify-between mb-1">
            <span className="text-lg font-bold" style={{ color: selected.color }}>${lastVal.toFixed(2)}</span>
            {diff !== 0 && (
              <div className={`flex items-center gap-0.5 text-[10px] ${diff > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {diff > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                <span className="font-medium">{diff > 0 ? '+' : ''}{diffPercent.toFixed(1)}%</span>
              </div>
            )}
          </div>

          {/* AreaChart */}
          <EvolutionChart data={chartData} color={selected.color} idprod={idprod} />
        </div>
      )}
    </div>
  );
}
