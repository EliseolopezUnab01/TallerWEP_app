'use client';

import { useCallback, useState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { NotificationDropdown } from '@/components/notification-dropdown';
import { UserDropdown } from '@/components/user-dropdown';
import { UI } from '@/lib/ui';

export type Fila = Record<string, unknown>;
export type Valores = Record<string, string>;

export async function pedir(url: string, metodo = 'GET', cuerpo?: unknown) {
  const res = await fetch(url, {
    method: metodo,
    headers: cuerpo ? { 'Content-Type': 'application/json' } : undefined,
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error en la solicitud');
  return data;
}

export const num = (v: unknown) => Number(v) || 0;
export const fmt = (n: unknown, dec = 0) =>
  num(n).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
export const fecha = (v: unknown) => (v ? String(v).slice(0, 10) : '');
export const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const idDeUrl = () =>
  typeof window === 'undefined' ? null : Number(new URLSearchParams(window.location.search).get('id')) || null;

type Aviso = { tipo: 'ok' | 'error'; texto: string } | null;

export function useAviso() {
  const [aviso, setAviso] = useState<Aviso>(null);
  const notificar = useCallback((tipo: 'ok' | 'error', texto: string) => {
    setAviso({ tipo, texto });
    setTimeout(() => setAviso(null), 4500);
  }, []);
  return { aviso, notificar };
}

export function Toast({ aviso }: { aviso: Aviso }) {
  if (!aviso) return null;
  return (
    <div
      className={`fixed bottom-6 right-6 z-[60] max-w-md px-3 py-2 flex items-center gap-2 text-xs shadow-lg ${
        aviso.tipo === 'ok' ? UI.avisoOk : UI.avisoError
      }`}
    >
      {aviso.tipo === 'ok' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
      {aviso.texto}
    </div>
  );
}

export function BarraTaller({ titulo }: { titulo: string }) {
  return (
    <div className={`${UI.navbar} shrink-0`}>
      <div className="flex items-center gap-3">
        <span className={UI.navLabel}>Taller</span>
        <span className={UI.navDivider} />
        <span className={UI.navTitle}>{titulo}</span>
      </div>
      <div className="flex items-center gap-3">
        <NotificationDropdown />
        <UserDropdown />
      </div>
    </div>
  );
}

type Opcion = string | { valor: string; etiqueta: string };

export interface Campo {
  campo: string;
  etiqueta: string;
  tipo?: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'check';
  opciones?: readonly Opcion[];
  /** Columnas que ocupa en la cuadrícula de 4. */
  ancho?: 1 | 2 | 4;
  placeholder?: string;
  obligatorio?: boolean;
}

export interface Seccion {
  titulo: string;
  campos: Campo[];
}

/** Convierte una fila de la API a los valores de texto del formulario. */
export function aValores(fila: Fila | null, secciones: Seccion[]): Valores {
  const valores: Valores = {};
  for (const s of secciones) {
    for (const c of s.campos) {
      const v = fila?.[c.campo];
      if (c.tipo === 'check') valores[c.campo] = fila ? (Number(v) ? '1' : '0') : '1';
      else if (c.tipo === 'date') valores[c.campo] = fecha(v);
      else valores[c.campo] = v == null ? '' : String(v);
    }
  }
  return valores;
}

const ANCHO = { 1: '', 2: 'sm:col-span-2', 4: 'sm:col-span-2 xl:col-span-4' } as const;

export function Formulario({
  secciones,
  valores,
  onCambio,
}: {
  secciones: Seccion[];
  valores: Valores;
  onCambio: (campo: string, valor: string) => void;
}) {
  return (
    <>
      {secciones.map((s) => (
        <div key={s.titulo} className="border-b border-border last:border-b-0">
          <div className={UI.densePanelTitle}>{s.titulo}</div>
          <div className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-4">
            {s.campos.map((c) => {
              const valor = valores[c.campo] ?? '';
              const comun = { id: `f-${c.campo}`, value: valor };
              let control;
              if (c.tipo === 'check') {
                control = (
                  <input
                    id={comun.id}
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={valor === '1'}
                    onChange={(e) => onCambio(c.campo, e.target.checked ? '1' : '0')}
                  />
                );
              } else if (c.tipo === 'select') {
                control = (
                  <select {...comun} className={UI.denseSelect} onChange={(e) => onCambio(c.campo, e.target.value)}>
                    <option value="">—</option>
                    {(c.opciones ?? []).map((o) => {
                      const op = typeof o === 'string' ? { valor: o, etiqueta: o } : o;
                      return (
                        <option key={op.valor} value={op.valor}>
                          {op.etiqueta}
                        </option>
                      );
                    })}
                  </select>
                );
              } else if (c.tipo === 'textarea') {
                control = (
                  <textarea
                    {...comun}
                    rows={2}
                    placeholder={c.placeholder}
                    className={`${UI.denseInput} h-auto py-1`}
                    onChange={(e) => onCambio(c.campo, e.target.value)}
                  />
                );
              } else {
                control = (
                  <input
                    {...comun}
                    type={c.tipo ?? 'text'}
                    step={c.tipo === 'number' ? 'any' : undefined}
                    placeholder={c.placeholder}
                    className={`${UI.denseInput} ${c.tipo === 'number' ? `text-right ${UI.denseMono}` : ''}`}
                    onChange={(e) => onCambio(c.campo, e.target.value)}
                  />
                );
              }
              return (
                <label
                  key={c.campo}
                  htmlFor={comun.id}
                  className={`flex ${c.tipo === 'check' ? 'flex-row-reverse justify-end items-center gap-2 self-end h-7' : 'flex-col gap-1'} ${ANCHO[c.ancho ?? 1]}`}
                >
                  <span className={UI.denseLabel}>
                    {c.etiqueta}
                    {c.obligatorio && <span className="text-red-500"> *</span>}
                  </span>
                  {control}
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

/** Input que guarda al salir (blur o Enter) solo si el valor cambió; vacío se mantiene vacío. */
export function InputBlur({
  valor,
  onGuardar,
  tipo = 'text',
  className = '',
}: {
  valor: unknown;
  onGuardar: (v: string) => void;
  tipo?: 'text' | 'number' | 'date';
  className?: string;
}) {
  const inicial = valor == null ? '' : tipo === 'date' ? fecha(valor) : String(valor);
  return (
    <input
      key={inicial}
      type={tipo}
      step={tipo === 'number' ? 'any' : undefined}
      defaultValue={inicial}
      className={`${UI.denseInput} ${tipo === 'number' ? `text-right ${UI.denseMono}` : ''} ${className}`}
      onBlur={(e) => e.target.value !== inicial && onGuardar(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  );
}

export function Insignia({ texto, color }: { texto: string; color: string }) {
  return <span className={`rounded px-1.5 text-[10px] font-semibold whitespace-nowrap ${color}`}>{texto}</span>;
}

export const COLOR_AVISO = {
  VENCIDO: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  PROXIMO: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  'AL DIA': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  'SIN DATOS': 'bg-muted text-muted-foreground',
  INACTIVO: 'bg-muted text-muted-foreground',
} as const;
