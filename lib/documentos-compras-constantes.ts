export const TIPOS_DOCUMENTO_COMPRA = [
  { valor: 'SOLICITUD', prefijo: 'SC', etiqueta: 'Solicitud' },
  { valor: 'COTIZACION', prefijo: 'CT', etiqueta: 'Cotización' },
  { valor: 'ORDEN', prefijo: 'OC', etiqueta: 'Orden de compra' },
  { valor: 'PROFORMA', prefijo: 'PF', etiqueta: 'Proforma' },
  { valor: 'GASTO', prefijo: 'GT', etiqueta: 'Gastos' },
] as const;

/** La cadena de derivación no incluye Gastos: una proforma no se convierte en gasto. */
const CADENA_DOCUMENTO = ['SOLICITUD', 'COTIZACION', 'ORDEN', 'PROFORMA'] as const;

export type TipoDocumentoCompra = (typeof TIPOS_DOCUMENTO_COMPRA)[number]['valor'];

export const ESTATUS_ARTICULO = [
  'DESCONOCIDO',
  'DISPONIBLE',
  'BAJO STOCK',
  'SIN STOCK',
  'EN DESARROLLO',
  'DESCONTINUADO',
] as const;

export const INCOTERMS = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'] as const;

export const MONEDAS = ['USD', 'EUR', 'CNY', 'MXN', 'GTQ', 'BRL', 'JPY'] as const;

export function esTipoDocumentoCompra(v: unknown): v is TipoDocumentoCompra {
  return TIPOS_DOCUMENTO_COMPRA.some((t) => t.valor === v);
}

/** Tipo siguiente en la cadena solicitud → cotización → orden → proforma; null al final. */
export function tipoSiguiente(tipo: string): TipoDocumentoCompra | null {
  const i = CADENA_DOCUMENTO.indexOf(tipo as (typeof CADENA_DOCUMENTO)[number]);
  return i >= 0 && i < CADENA_DOCUMENTO.length - 1 ? CADENA_DOCUMENTO[i + 1] : null;
}

export const etiquetaTipo = (tipo: string) => TIPOS_DOCUMENTO_COMPRA.find((t) => t.valor === tipo)?.etiqueta ?? tipo;
