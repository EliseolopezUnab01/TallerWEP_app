import type { Connection, RowDataPacket } from 'mysql2/promise';

/** Opciones conocidas con su valor por defecto. Solo estas claves se aceptan al guardar. */
export const OPCIONES_SISTEMA = {
  cantidades_decimales: { defecto: '0', etiqueta: 'Trabajar con cantidades decimales' },
} as const;

export type ClaveConfiguracion = keyof typeof OPCIONES_SISTEMA;
export type ConfiguracionSistema = Record<ClaveConfiguracion, string>;

const VIGENCIA_MS = 60_000;
let cache: { valores: ConfiguracionSistema; hasta: number } | null = null;

function porDefecto(): ConfiguracionSistema {
  return Object.fromEntries(
    Object.entries(OPCIONES_SISTEMA).map(([clave, o]) => [clave, o.defecto])
  ) as ConfiguracionSistema;
}

export async function leerConfiguracion(connection: Connection): Promise<ConfiguracionSistema> {
  if (cache && cache.hasta > Date.now()) return cache.valores;
  const valores = porDefecto();
  try {
    const [filas] = await connection.execute<RowDataPacket[]>('SELECT clave, valor FROM configuracion_sistema');
    for (const f of filas) {
      if (f.clave in OPCIONES_SISTEMA) valores[f.clave as ClaveConfiguracion] = String(f.valor);
    }
  } catch {
    /* sin la migración 026 se usan los valores por defecto */
  }
  cache = { valores, hasta: Date.now() + VIGENCIA_MS };
  return valores;
}

export function olvidarConfiguracion() {
  cache = null;
}

export async function permiteDecimales(connection: Connection): Promise<boolean> {
  return (await leerConfiguracion(connection)).cantidades_decimales === '1';
}

export const AVISO_ENTEROS = 'El inventario se maneja en unidades enteras (Configuración > Sistema)';

/** Null si la cantidad es válida para inventario con la configuración dada. */
export function errorCantidadInventario(cantidad: number, decimales: boolean): string | null {
  return !decimales && !Number.isInteger(Number(cantidad)) ? AVISO_ENTEROS : null;
}
