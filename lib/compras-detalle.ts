// Cálculos de línea de compra (control 30). IVA El Salvador = 13%.
// PREGUNTA 1 pendiente al cliente: el descuento se guarda pero NO se resta
// del subtotal hasta confirmar si es informativo o aplicado.

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

function redondear4(valor: number): number {
  return Math.round(valor * 10000) / 10000;
}

export function calcularLinea(input: LineaCalculoInput): LineaCalculoResult {
  const cantidad = Number(input.cantidad) || 0;
  const costo = Number(input.costo_unitario) || 0;
  const subtotal_sin_iva = redondear4(cantidad * costo);

  let iva_unitario = 0;
  let exento_unitario = 0;
  let no_sujeto_unitario = 0;

  switch (input.condicion_iva) {
    case 'GRAVADA':
      iva_unitario = redondear4(costo * IVA_TASA);
      break;
    case 'EXENTO':
      exento_unitario = redondear4(costo);
      break;
    case 'NO_SUJETO':
      no_sujeto_unitario = redondear4(costo);
      break;
    case 'XCOMPROBAR':
      break;
  }

  const subtotal_con_iva =
    input.condicion_iva === 'GRAVADA'
      ? redondear4(cantidad * (costo + iva_unitario))
      : subtotal_sin_iva;

  return {
    subtotal_sin_iva,
    iva_unitario,
    exento_unitario,
    no_sujeto_unitario,
    subtotal_con_iva,
  };
}

export function requiereCatalogo(destino: string): boolean {
  return destino === 'GASTOS' || destino === 'ACTIVOS';
}

export function tipoCatalogoEsperado(destino: string): 'GASTO' | 'ACTIVO' | null {
  if (destino === 'GASTOS') return 'GASTO';
  if (destino === 'ACTIVOS') return 'ACTIVO';
  return null;
}
