/**
 * Estándar de decimales del sistema (cliente, 28/10): los cálculos y lo que se
 * guarda llevan hasta 8 decimales. Solo al mostrar o imprimir se redondea a
 * 4 o a 2, y lo guardado no cambia.
 */
export const DECIMALES_SISTEMA = 8;

export function r8(valor: number): number {
  const n = Number(valor) || 0;
  return Math.round(n * 1e8) / 1e8;
}

/** Redondeo para mostrar o imprimir. No usar el resultado para guardar ni calcular. */
export function formatoImpresion(valor: number | string | null | undefined, decimales: 2 | 4 = 2): string {
  const n = Number(valor) || 0;
  return n.toLocaleString('en-US', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
}

/** Costo unitario en pantalla: al menos 2 decimales y hasta 4 si los tiene. */
export function formatoCosto(valor: number | string | null | undefined): string {
  const n = Number(valor) || 0;
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

/** Cantidad o existencia en pantalla: sin decimales si es entera, hasta 4 si no. */
export function formatoCantidad(valor: number | string | null | undefined): string {
  const n = Number(valor) || 0;
  return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

export function redondeoImpresion(valor: number | string | null | undefined, decimales: 2 | 4 = 2): number {
  const n = Number(valor) || 0;
  const f = 10 ** decimales;
  return Math.round(n * f) / f;
}
