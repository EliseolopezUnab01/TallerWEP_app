export const ESTADOS_TEXTO = [
  'EXCELENTE',
  'BUEN ESTADO',
  'REGULAR',
  'DAÑADO',
  'PELIGRO',
  'INSERVIBLE',
  'DESACTIVADO',
  'SIN VERIFICAR',
  'OTRO',
] as const;
export type EstadoTexto = (typeof ESTADOS_TEXTO)[number];

export const MOMENTOS_ESTADO = ['ENTRADA', 'SALIDA'] as const;

export const UNIDADES_CAPACIDAD = ['KG', 'TON', 'LB', 'PASAJEROS'] as const;

/** Días antes del vencimiento en que un recordatorio o la tarjeta se marca como próximo. */
export const DIAS_AVISO = 15;
/** Kilómetros antes del próximo cambio en que un recordatorio se marca como próximo. */
export const KM_AVISO = 500;

export type EstadoAviso = 'VENCIDO' | 'PROXIMO' | 'AL DIA' | 'SIN DATOS';

/** Vencido si ya pasó la fecha o el km; próximo si falta poco para cualquiera de los dos. */
export function estadoRecordatorio(
  proximoFecha: string | null,
  proximoKm: number | null,
  odometro: number | null,
  hoy = new Date()
): EstadoAviso {
  if (!proximoFecha && proximoKm == null) return 'SIN DATOS';
  const inicioHoy = new Date(hoy);
  inicioHoy.setHours(0, 0, 0, 0);
  const dias = proximoFecha
    ? Math.round((new Date(proximoFecha.slice(0, 10) + 'T00:00:00').getTime() - inicioHoy.getTime()) / 86_400_000)
    : null;
  const km = proximoKm != null && odometro != null ? proximoKm - odometro : null;
  if ((dias != null && dias < 0) || (km != null && km < 0)) return 'VENCIDO';
  if ((dias != null && dias <= DIAS_AVISO) || (km != null && km <= KM_AVISO)) return 'PROXIMO';
  return 'AL DIA';
}
