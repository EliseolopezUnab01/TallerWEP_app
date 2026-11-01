'use client';

import { UI } from '@/lib/ui';

export type Fila = Record<string, unknown> & { [k: string]: unknown };

export interface DetalleProceso {
  proceso: Fila & {
    idproceso: number;
    codigo: string;
    nodocto: number;
    estado_documento: 'BORRADOR' | 'FINALIZADO';
    estado_proceso: string;
    origen_negociacion: string;
    descripcion: string | null;
    factura_compra: string | null;
    moneda_factura: string;
    tipo_cambio_pagado: number;
    total_retaceo: number;
    comentarios: string | null;
    fecha_retaceo: string | null;
    fecha_reapertura: string | null;
  };
  inversion: {
    conceptos: { concepto: string; real: number; hacienda: number | null; categorias: string[] }[];
    categorias: { categoria: string; documentos: number; sin_documento: number; real: number }[];
  };
  impuestos: { impuesto: string; calculado: number | null; duca: number | null }[];
  aduana_bloqueada: boolean;
  resumen: {
    total_factura: number;
    sumas_documentos: number;
    sugerido: { documentos: number; sin_documento: number; otros_cargos_duca: number; total: number };
  };
  facturas: Fila[];
  documentos: Fila[];
  relaciones: Fila[];
  duca: Fila | null;
  gastos: Fila[];
  pendientes: Fila[];
  lineas: Fila[];
  simulacion: {
    lineas: Fila[];
    total_contable: number;
    total_grupo_cif: number;
    dai_calculado: number;
    iva_calculado: number;
    dai_aplicado: number;
    iva_aplicado: number;
    gastos_aplicados: number;
    total_destino: number;
  } | null;
}

export async function pedir(url: string, metodo = 'GET', cuerpo?: unknown) {
  const headers: Record<string, string> = {};
  if (cuerpo) headers['Content-Type'] = 'application/json';
  const token = typeof window === 'undefined' ? null : localStorage.getItem('token');
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, {
    method: metodo,
    headers,
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error en la solicitud');
  return data;
}

export const num = (v: unknown) => Number(v) || 0;

export const fmt = (n: unknown, dec = 2) =>
  num(n).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });

export const fecha = (v: unknown) => (v ? String(v).slice(0, 10) : '');

/** Input que guarda al salir (blur o Enter) solo si el valor cambió. */
export function InputBlur({
  valor,
  onGuardar,
  tipo = 'text',
  className = '',
  disabled,
  placeholder,
}: {
  valor: unknown;
  onGuardar: (v: string) => void;
  tipo?: 'text' | 'number' | 'date';
  className?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  const inicial = tipo === 'number' ? String(num(valor)) : tipo === 'date' ? fecha(valor) : String(valor ?? '');
  return (
    <input
      key={inicial}
      type={tipo}
      step={tipo === 'number' ? 'any' : undefined}
      defaultValue={inicial}
      disabled={disabled}
      placeholder={placeholder}
      className={`${UI.denseInput} ${tipo === 'number' ? `text-right ${UI.denseMono}` : ''} ${className}`}
      onBlur={(e) => e.target.value !== inicial && onGuardar(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  );
}

export function Dato({ etiqueta, valor, fuerte }: { etiqueta: string; valor: string; fuerte?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className={UI.denseLabel}>{etiqueta}</span>
      <span className={`${UI.denseMono} text-sm ${fuerte ? 'font-semibold text-foreground' : ''}`}>{valor}</span>
    </div>
  );
}
