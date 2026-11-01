// Cálculos de línea de compra (control 30). IVA El Salvador = 13%.
// El descuento por línea se resta antes del IVA, como en el totalizador del
// cliente (sumas, descuento, subtotal). Se guarda con hasta 8 decimales.

import { r8 } from '@/lib/decimales';

export const IVA_TASA = 0.13;

export const DESTINOS = ['INVENTARIO', 'EXPRESS', 'ACTIVOS', 'GASTOS'] as const;
export type Destino = (typeof DESTINOS)[number];

export const CONDICIONES_IVA = ['GRAVADA', 'EXENTO', 'NO_SUJETO', 'XCOMPROBAR'] as const;
export type CondicionIva = (typeof CONDICIONES_IVA)[number];

export interface LineaCalculoInput {
  cantidad: number;
  costo_unitario: number;
  descuento_porcentaje?: number;
  condicion_iva: CondicionIva;
  cargos_no_afectos?: number;
}

export interface LineaCalculoResult {
  subtotal_sin_iva: number;
  iva_unitario: number;
  exento_unitario: number;
  no_sujeto_unitario: number;
  subtotal_con_iva: number;
}

export function calcularLinea(input: LineaCalculoInput): LineaCalculoResult {
  const cantidad = Number(input.cantidad) || 0;
  const costo = Number(input.costo_unitario) || 0;
  const porcentaje = Math.min(100, Math.max(0, Number(input.descuento_porcentaje) || 0));
  const costoNeto = r8(costo * (1 - porcentaje / 100));
  const subtotal_sin_iva = r8(cantidad * costoNeto);

  let iva_unitario = 0;
  let exento_unitario = 0;
  let no_sujeto_unitario = 0;

  switch (input.condicion_iva) {
    case 'GRAVADA':
      iva_unitario = r8(costoNeto * IVA_TASA);
      break;
    case 'EXENTO':
      exento_unitario = costoNeto;
      break;
    case 'NO_SUJETO':
      no_sujeto_unitario = costoNeto;
      break;
    case 'XCOMPROBAR':
      break;
  }

  const subtotal_con_iva =
    input.condicion_iva === 'GRAVADA' ? r8(subtotal_sin_iva + cantidad * iva_unitario) : subtotal_sin_iva;

  return {
    subtotal_sin_iva,
    iva_unitario,
    exento_unitario,
    no_sujeto_unitario,
    subtotal_con_iva,
  };
}

/** Monto del descuento de una línea (cantidad × costo × %). */
export function descuentoLinea(cantidad: number, costo: number, porcentaje: number): number {
  const p = Math.min(100, Math.max(0, Number(porcentaje) || 0));
  return r8((Number(cantidad) || 0) * (Number(costo) || 0) * (p / 100));
}

export function requiereCatalogo(destino: string): boolean {
  return destino === 'GASTOS' || destino === 'ACTIVOS';
}

export function tipoCatalogoEsperado(destino: string): 'GASTO' | 'ACTIVO' | null {
  if (destino === 'GASTOS') return 'GASTO';
  if (destino === 'ACTIVOS') return 'ACTIVO';
  return null;
}
