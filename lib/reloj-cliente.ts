'use client';

export interface EstadoReloj {
  /** Minutos que el reloj de esta PC va adelantado (+) o atrasado (-) respecto a la referencia. */
  minutos: number;
  tolerancia: number;
  referencia: string;
  zona: string;
}

const CLAVE = 'reloj_verificado';
const VIGENCIA_MS = 30 * 60 * 1000;
let pendiente: Promise<EstadoReloj | null> | null = null;

function guardado(): EstadoReloj | null {
  try {
    const crudo = sessionStorage.getItem(CLAVE);
    if (!crudo) return null;
    const { hasta, estado } = JSON.parse(crudo);
    return hasta > Date.now() ? estado : null;
  } catch {
    return null;
  }
}

async function consultar(): Promise<EstadoReloj | null> {
  const zona = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/El_Salvador';
  const res = await fetch(`/api/server-time?timezone=${encodeURIComponent(zona)}`);
  const data = await res.json();
  if (!data.success) return null;
  const estado: EstadoReloj = {
    minutos: Math.round((Date.now() - Number(data.serverTime.timestamp)) / 60000),
    tolerancia: Number(data.maxToleranceMinutes) || 5,
    referencia: data.serverTime.formatted,
    zona,
  };
  sessionStorage.setItem(CLAVE, JSON.stringify({ hasta: Date.now() + VIGENCIA_MS, estado }));
  return estado;
}

/** Compara el reloj de la PC con la hora de referencia una vez por sesión (se renueva cada 30 min). */
export function verificarReloj(): Promise<EstadoReloj | null> {
  const previo = guardado();
  if (previo) return Promise.resolve(previo);
  pendiente ??= consultar()
    .catch(() => null)
    .finally(() => {
      pendiente = null;
    });
  return pendiente;
}
