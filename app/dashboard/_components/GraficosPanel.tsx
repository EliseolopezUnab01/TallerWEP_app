'use client';

import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';

/** Debe coincidir con la leyenda de app/dashboard/page.tsx. */
const STOCK_COLORS = ['#10b981', '#f59e0b', '#64748b', '#ef4444'];
const BAR_COLOR = '#0e88c9';

const CHART_TOOLTIP = {
  background: 'var(--tooltip-bg)',
  border: '1px solid var(--tooltip-border)',
  borderRadius: 8,
  fontSize: 12,
  color: '#e2e8f0',
};

export function GraficoStock({ datos }: { datos: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240} minWidth={200}>
      <PieChart>
        <Pie
          data={datos}
          isAnimationActive={false}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={3}
          dataKey="value"
          stroke="none"
        >
          {datos.map((_, i) => (
            <Cell key={i} fill={STOCK_COLORS[i % STOCK_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={CHART_TOOLTIP} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function GraficoCategorias({ datos }: { datos: { nombre: string; cantidad: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={datos} layout="vertical" margin={{ left: 8, right: 16 }}>
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
  );
}
