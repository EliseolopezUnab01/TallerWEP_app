export const TIPOS_DOCUMENTO_COMPRA = [
  { valor: 'SOLICITUD', prefijo: 'SC', etiqueta: 'Solicitud' },
  { valor: 'COTIZACION', prefijo: 'CT', etiqueta: 'Cotización' },
  { valor: 'ORDEN', prefijo: 'OC', etiqueta: 'Orden de compra' },
  { valor: 'PROFORMA', prefijo: 'PF', etiqueta: 'Proforma' },
] as const;

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
  const i = TIPOS_DOCUMENTO_COMPRA.findIndex((t) => t.valor === tipo);
  return i >= 0 && i < TIPOS_DOCUMENTO_COMPRA.length - 1 ? TIPOS_DOCUMENTO_COMPRA[i + 1].valor : null;
}

export const etiquetaTipo = (tipo: string) => TIPOS_DOCUMENTO_COMPRA.find((t) => t.valor === tipo)?.etiqueta ?? tipo;
