// Totales del resumen DTE (sección Resumen del Manual Funcional V 2.0).
// Cuerpo: hasta 4 decimales. Resumen: 2 decimales, holgura MH ±$0.01.
// PREGUNTA 1: el descuento por ítem se guarda pero NO se resta del subtotal.

import { IVA_TASA, type CondicionIva } from '@/lib/compras-detalle';

export interface LineaResumen {
  condicion_iva: CondicionIva | string;
  subtotal_sin_iva: number;
  iva_unitario: number;
  cantidad: number;
  descuento_porcentaje?: number;
  cargos_no_afectos?: number;
}

export interface ResumenInput {
  lineas: LineaResumen[];
  descuento_global_gravado?: number;
  descuento_global_exento?: number;
  descuento_global_no_sujeto?: number;
  porcentaje_descuento?: number;
  iva_retenido?: number;
  iva_percibido?: number;
  retencion_renta?: number;
}

export interface ResumenResult {
  total_gravado: number;
  total_exento: number;
  total_no_sujeto: number;
  total_xcomprobar: number;
  suma_operaciones: number;
  descuento_global_gravado: number;
  descuento_global_exento: number;
  descuento_global_no_sujeto: number;
  porcentaje_descuento: number;
  total_descuento: number;
  sub_total: number;
  iva: number;
  iva_retenido: number;
  iva_percibido: number;
  retencion_renta: number;
  monto_total_operacion: number;
  total_cargos_no_afectos: number;
  total_pagar: number;
  valor_en_letras: string;
}

export function redondear2(valor: number): number {
  return Math.round((Number(valor) || 0) * 100) / 100;
}

function aNumero(valor: unknown, defecto = 0): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : defecto;
}

const UNIDADES = [
  '', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
  'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete',
  'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés',
  'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve',
];
const DECENAS = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const CENTENAS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

function decenaALetras(n: number): string {
  if (n < 30) return UNIDADES[n];
  const d = Math.floor(n / 10);
  const u = n % 10;
  return u === 0 ? DECENAS[d] : `${DECENAS[d]} y ${UNIDADES[u]}`;
}

function centenaALetras(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'cien';
  if (n < 100) return decenaALetras(n);
  const c = Math.floor(n / 100);
  const resto = n % 100;
  return resto === 0 ? CENTENAS[c] : `${CENTENAS[c]} ${decenaALetras(resto)}`;
}

export function numeroALetras(monto: number): string {
  const valor = redondear2(Math.abs(monto));
  const enteros = Math.floor(valor);
  const centavos = Math.round((valor - enteros) * 100);

  if (enteros === 0) {
    return `Cero con ${String(centavos).padStart(2, '0')}/100 dólares`;
  }

  const millones = Math.floor(enteros / 1_000_000);
  const miles = Math.floor((enteros % 1_000_000) / 1000);
  const resto = enteros % 1000;

  const partes: string[] = [];
  if (millones === 1) partes.push('un millón');
  else if (millones > 1) partes.push(`${centenaALetras(millones)} millones`);

  if (miles === 1) partes.push('mil');
  else if (miles > 1) partes.push(`${centenaALetras(miles)} mil`);

  if (resto > 0) partes.push(centenaALetras(resto));

  const texto = partes.join(' ').replace(/^uno /, 'un ').replace(/ veintiuno$/, ' veintiún');
  const capitalizado = texto.charAt(0).toUpperCase() + texto.slice(1);
  return `${capitalizado} con ${String(centavos).padStart(2, '0')}/100 dólares`;
}

function descuentoInformativo(linea: LineaResumen): number {
  const porcentaje = aNumero(linea.descuento_porcentaje);
  if (porcentaje <= 0) return 0;
  return redondear2((aNumero(linea.subtotal_sin_iva) * porcentaje) / 100);
}

export function calcularResumen(input: ResumenInput): ResumenResult {
  let total_gravado = 0;
  let total_exento = 0;
  let total_no_sujeto = 0;
  let total_xcomprobar = 0;
  let iva_lineas = 0;
  let total_cargos_no_afectos = 0;
  let descuento_por_item = 0;

  for (const linea of input.lineas) {
    const subtotal = aNumero(linea.subtotal_sin_iva);
    const cantidad = aNumero(linea.cantidad, 1);
    const ivaLinea = redondear2(aNumero(linea.iva_unitario) * cantidad);
    total_cargos_no_afectos += aNumero(linea.cargos_no_afectos);
    descuento_por_item += descuentoInformativo(linea);

    switch (linea.condicion_iva) {
      case 'GRAVADA':
        total_gravado += subtotal;
        iva_lineas += ivaLinea;
        break;
      case 'EXENTO':
        total_exento += subtotal;
        break;
      case 'NO_SUJETO':
        total_no_sujeto += subtotal;
        break;
      case 'XCOMPROBAR':
        total_xcomprobar += subtotal;
        break;
    }
  }

  total_gravado = redondear2(total_gravado);
  total_exento = redondear2(total_exento);
  total_no_sujeto = redondear2(total_no_sujeto);
  total_xcomprobar = redondear2(total_xcomprobar);
  iva_lineas = redondear2(iva_lineas);
  total_cargos_no_afectos = redondear2(total_cargos_no_afectos);
  descuento_por_item = redondear2(descuento_por_item);

  const descuento_global_gravado = redondear2(aNumero(input.descuento_global_gravado));
  const descuento_global_exento = redondear2(aNumero(input.descuento_global_exento));
  const descuento_global_no_sujeto = redondear2(aNumero(input.descuento_global_no_sujeto));
  const porcentaje_descuento = redondear2(aNumero(input.porcentaje_descuento));

  const suma_operaciones = redondear2(total_gravado + total_exento + total_no_sujeto);
  const desc_globales = redondear2(
    descuento_global_gravado + descuento_global_exento + descuento_global_no_sujeto
  );
  const total_descuento = redondear2(descuento_por_item + desc_globales);

  const gravado_neto = redondear2(Math.max(0, total_gravado - descuento_global_gravado));
  const exento_neto = redondear2(Math.max(0, total_exento - descuento_global_exento));
  const no_sujeto_neto = redondear2(Math.max(0, total_no_sujeto - descuento_global_no_sujeto));
  const sub_total = redondear2(gravado_neto + exento_neto + no_sujeto_neto);

  const iva = redondear2(gravado_neto * IVA_TASA);
  const iva_retenido = redondear2(aNumero(input.iva_retenido));
  const iva_percibido = redondear2(aNumero(input.iva_percibido));
  const retencion_renta = redondear2(aNumero(input.retencion_renta));

  const monto_total_operacion = redondear2(sub_total + iva + iva_percibido);
  const total_pagar = redondear2(
    monto_total_operacion - iva_retenido - retencion_renta + total_cargos_no_afectos + total_xcomprobar
  );

  return {
    total_gravado,
    total_exento,
    total_no_sujeto,
    total_xcomprobar,
    suma_operaciones,
    descuento_global_gravado,
    descuento_global_exento,
    descuento_global_no_sujeto,
    porcentaje_descuento,
    total_descuento,
    sub_total,
    iva,
    iva_retenido,
    iva_percibido,
    retencion_renta,
    monto_total_operacion,
    total_cargos_no_afectos,
    total_pagar,
    valor_en_letras: numeroALetras(total_pagar),
  };
}

export function calcularFechaVencimiento(
  fechaEmision: string | Date | null | undefined,
  plazoTipo: string | null | undefined,
  plazoPeriodo: number | null | undefined
): string | null {
  if (!fechaEmision || !plazoTipo || !plazoPeriodo || plazoPeriodo <= 0) return null;

  const fecha = new Date(fechaEmision);
  if (Number.isNaN(fecha.getTime())) return null;

  if (plazoTipo === '01') fecha.setDate(fecha.getDate() + plazoPeriodo);
  else if (plazoTipo === '02') fecha.setMonth(fecha.getMonth() + plazoPeriodo);
  else if (plazoTipo === '03') fecha.setFullYear(fecha.getFullYear() + plazoPeriodo);
  else return null;

  return fecha.toISOString().slice(0, 10);
}
