// Los 7 niveles de precio, en el orden confirmado por el cliente (01/11): los mayores van primero.
// Toda ruta o pantalla que lea o escriba precios usa esta tabla; precioN = nivel N.

export interface NivelPrecio {
  numero: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  /** Sufijo de las columnas en `precios`: precio_<clave>, porcentaje_<clave>, ganancia_<clave>. */
  clave: 'general_alto' | 'general' | 'cliente' | 'mecanico' | 'mayorista' | 'inversor' | 'especial';
  nombre: string;
}

export const NIVELES_PRECIO: readonly NivelPrecio[] = [
  { numero: 1, clave: 'general_alto', nombre: 'General alto' },
  { numero: 2, clave: 'general', nombre: 'General normal' },
  { numero: 3, clave: 'cliente', nombre: 'Cliente' },
  { numero: 4, clave: 'mecanico', nombre: 'Mecánico / minorista' },
  { numero: 5, clave: 'mayorista', nombre: 'Mayorista' },
  { numero: 6, clave: 'inversor', nombre: 'Inversor' },
  { numero: 7, clave: 'especial', nombre: 'Especial' },
];

export type ClaveNivel = NivelPrecio['clave'];
export const CLAVES_NIVEL = NIVELES_PRECIO.map((n) => n.clave);

export function nivelPorClave(clave: string) {
  return NIVELES_PRECIO.find((n) => n.clave === clave) ?? null;
}

/** Fragmento SELECT con alias precio1..precio7 sobre la tabla `precios` (alias por defecto `pr`). */
export function sqlPrecios(alias = 'pr') {
  return NIVELES_PRECIO.map((n) => `${alias}.precio_${n.clave} AS precio${n.numero}`).join(', ');
}

/** Igual que sqlPrecios pero también porcentaje y ganancia de cada nivel. */
export function sqlPreciosCompleto(alias = 'pr') {
  return NIVELES_PRECIO.flatMap((n) => [
    `${alias}.precio_${n.clave} AS precio${n.numero}`,
    `${alias}.porcentaje_${n.clave} AS porcentaje${n.numero}`,
    `${alias}.ganancia_${n.clave} AS ganancia${n.numero}`,
  ]).join(', ');
}
