/** Sugerencias de categoría para documentos y gastos del proceso. La lista es abierta (hasta 40 caracteres). */
export const RAZONES_VINCULO = [
  'FACTURA',
  'PROFORMA',
  'PAGO',
  'SEGURO',
  'FLETE',
  'FORWARDER',
  'IMPUESTOS',
  'TRANSPORTE',
  'BL',
  'ALMACEN',
  'GASTO ORIGEN',
  'GASTO LOCAL',
  'OTRO',
] as const;

export const ESTADOS_PROCESO = ['COTIZANDO', 'PRODUCCION', 'PAGADO', 'EN TRANSITO', 'BODEGA'] as const;

/** Razones que no son gasto: no suman a `sumas_documentos` ni se proponen para el retaceo. */
export const RAZONES_NO_GASTO = ['FACTURA', 'PROFORMA', 'PAGO'] as const;

/** Normaliza una categoría escrita por el usuario. Vacía = no válida. */
export function normalizarCategoria(valor: unknown): string | null {
  const texto = String(valor ?? '').trim().toUpperCase().replace(/\s+/g, ' ').slice(0, 40);
  return texto || null;
}

/**
 * Concepto del DUCA con el que se compara cada categoría (base de Hacienda).
 * Las que no aparecen se comparan contra los gastos declarados.
 */
export const BASE_HACIENDA: Record<string, 'seguro_declarado' | 'flete_declarado'> = {
  SEGURO: 'seguro_declarado',
  FLETE: 'flete_declarado',
  TRANSPORTE: 'flete_declarado',
  FORWARDER: 'flete_declarado',
  BL: 'flete_declarado',
};
