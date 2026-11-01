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

/** Una nota de crédito o débito solo se emite sobre un crédito fiscal (03) o un comprobante de retención (07). */
export const TIPOS_ORIGEN_NOTA = ['03', '07'] as const;

export function esOrigenNota(codigo: string | null | undefined): boolean {
  return (TIPOS_ORIGEN_NOTA as readonly string[]).includes(String(codigo ?? ''));
}

export const CONDICIONES_OPERACION = [
  { codigo: 1, nombre: 'Contado' },
  { codigo: 2, nombre: 'Crédito' },
  { codigo: 3, nombre: 'Otro (mixto)' },
] as const;

export type CondicionOperacion = (typeof CONDICIONES_OPERACION)[number]['codigo'];

/** INVALIDADO: el emisor invalidó el DTE ante Hacienda; no cuenta para stock, libros ni saldos. */
export const ESTADOS_COMPRA = ['BORRADOR', 'REGISTRADA', 'ANULADA', 'INVALIDADO'] as const;
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
  { codigo: '05', nombre: 'Transferencia / depósito bancario' },
  { codigo: '08', nombre: 'Dinero electrónico' },
  { codigo: '09', nombre: 'Monedero electrónico' },
  { codigo: '11', nombre: 'Bitcoin' },
  { codigo: '12', nombre: 'Otras criptomonedas' },
  { codigo: '13', nombre: 'Cuentas por pagar del receptor' },
  { codigo: '14', nombre: 'Giro bancario' },
  { codigo: '99', nombre: 'Otros (indicar el medio de pago)' },
] as const;

export function esTipoDteCompra(codigo: unknown): codigo is CodigoDte {
  return TIPOS_DTE_COMPRAS.some((t) => t.codigo === codigo);
}

export function tipoDteRequiereRelacionados(codigo: string | null | undefined): boolean {
  return codigo === '05' || codigo === '06';
}

/**
 * Efecto del documento sobre el saldo con el proveedor y las sumas de un proceso.
 * Manual MH V 2.0 (págs. 41–42): devoluciones, descuentos y rebajas de precio se
 * ajustan con nota de crédito (resta); la nota de débito aumenta el monto (suma).
 */
export function signoDocumento(codigo: string | null | undefined): 1 | -1 {
  return codigo === '05' ? -1 : 1;
}

/**
 * Control 2 de la pantalla (video del cliente, 27/10). El tipo de documento
 * (crédito fiscal, consumidor final) es otro control: un documento EXPRES
 * sigue siendo fiscal para el IVA.
 */
export const CATEGORIAS_OPERACION = [
  { valor: 'CONTABLE', etiqueta: 'Contable', ayuda: 'Solo productos de inventario' },
  { valor: 'EXPRES', etiqueta: 'Expres', ayuda: 'Solo productos express (con orden de trabajo)' },
  { valor: 'GASTOS', etiqueta: 'Gastos', ayuda: 'Solo gastos o activos con su rubro' },
  { valor: 'OTRO', etiqueta: 'Otro', ayuda: 'Inventario, express y gastos en el mismo documento' },
] as const;

export type CategoriaOperacion = (typeof CATEGORIAS_OPERACION)[number]['valor'];

export function esCategoriaOperacion(valor: unknown): valor is CategoriaOperacion {
  return CATEGORIAS_OPERACION.some((c) => c.valor === valor);
}

const DESTINOS_POR_CATEGORIA: Record<CategoriaOperacion, readonly string[]> = {
  CONTABLE: ['INVENTARIO'],
  EXPRES: ['EXPRESS'],
  GASTOS: ['GASTOS', 'ACTIVOS'],
  OTRO: ['INVENTARIO', 'EXPRESS', 'GASTOS', 'ACTIVOS'],
};

export function destinoPermitido(categoria: string | null | undefined, destino: string): boolean {
  const permitidos = DESTINOS_POR_CATEGORIA[esCategoriaOperacion(categoria) ? categoria : 'CONTABLE'];
  return permitidos.includes(destino);
}

export function destinosDeCategoria(categoria: string | null | undefined): readonly string[] {
  return DESTINOS_POR_CATEGORIA[esCategoriaOperacion(categoria) ? categoria : 'CONTABLE'];
}

export const NOMBRE_DESTINO: Record<string, string> = {
  INVENTARIO: 'Inventario',
  EXPRESS: 'Express',
  GASTOS: 'Gasto',
  ACTIVOS: 'Activo',
};

/** Avisos con el texto que usa el sistema actual del cliente. */
export const AVISOS_COMPRA = {
  condicion: 'Debe elegir la condición de compra',
  tipoProducto: 'Es obligatorio que elija una opción para el tipo de producto',
  confirmarCambios: '¿Está seguro de hacer cambios?',
  eliminarItem: 'Seguro de eliminar este ítem',
} as const;

export function nombreTipoDte(codigo: string | null | undefined): string {
  const encontrado = TIPOS_DTE_COMPRAS.find((t) => t.codigo === codigo);
  return encontrado ? encontrado.abrev : codigo || '—';
}
