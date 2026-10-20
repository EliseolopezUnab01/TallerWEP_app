// Catálogos y constantes del módulo de compras nacionales (DTE Hacienda SV).
// Fuente: Manual Funcional del Sistema de Transmisión V 2.0 + CAT-002/016/017/018.

export const TIPOS_DTE_COMPRAS = [
  { codigo: '01', nombre: 'Factura Electrónica', abrev: 'FE' },
  { codigo: '03', nombre: 'Comprobante de Crédito Fiscal', abrev: 'CCFE' },
  { codigo: '05', nombre: 'Nota de Crédito Electrónica', abrev: 'NCE' },
  { codigo: '06', nombre: 'Nota de Débito Electrónica', abrev: 'NDE' },
  { codigo: '14', nombre: 'Factura de Sujeto Excluido', abrev: 'FSEE' },
] as const;

export type CodigoDte = (typeof TIPOS_DTE_COMPRAS)[number]['codigo'];

export const DTE_REQUIERE_RELACIONADOS: CodigoDte[] = ['05', '06'];

export const CONDICIONES_OPERACION = [
  { codigo: 1, nombre: 'Contado' },
  { codigo: 2, nombre: 'Crédito' },
  { codigo: 3, nombre: 'Otro (mixto)' },
] as const;

export type CondicionOperacion = (typeof CONDICIONES_OPERACION)[number]['codigo'];

export const ESTADOS_COMPRA = ['BORRADOR', 'REGISTRADA', 'ANULADA'] as const;
export type EstadoCompra = (typeof ESTADOS_COMPRA)[number];

export const PLAZOS = [
  { codigo: '01', nombre: 'Días' },
  { codigo: '02', nombre: 'Meses' },
  { codigo: '03', nombre: 'Años' },
] as const;

export const FORMAS_PAGO = [
  { codigo: '01', nombre: 'Billetes y monedas' },
  { codigo: '02', nombre: 'Tarjeta débito' },
  { codigo: '03', nombre: 'Tarjeta crédito' },
  { codigo: '04', nombre: 'Cheque' },
  { codigo: '05', nombre: 'Transferencia / Depósito bancario' },
  { codigo: '06', nombre: 'Vales o cupones' },
  { codigo: '08', nombre: 'Dinero electrónico' },
  { codigo: '12', nombre: 'Cuentas por pagar / Intercambio' },
  { codigo: '13', nombre: 'Dinero electrónico no bancario' },
  { codigo: '14', nombre: 'Bitcoin' },
  { codigo: '99', nombre: 'Otro' },
] as const;

export function esTipoDteCompra(codigo: unknown): codigo is CodigoDte {
  return TIPOS_DTE_COMPRAS.some((t) => t.codigo === codigo);
}

export function tipoDteRequiereRelacionados(codigo: string | null | undefined): boolean {
  return codigo === '05' || codigo === '06';
}

export function nombreTipoDte(codigo: string | null | undefined): string {
  const encontrado = TIPOS_DTE_COMPRAS.find((t) => t.codigo === codigo);
  return encontrado ? encontrado.abrev : codigo || '—';
}
