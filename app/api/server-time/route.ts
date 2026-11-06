import { NextResponse } from 'next/server';

const ESPERA_MS = 2000;
const VIGENCIA_MS = 10 * 60 * 1000;

// Diferencia entre la hora de referencia y el reloj del servidor; se reutiliza unos minutos.
let referencia: { desfaseMs: number; fuente: 'external' | 'server_fallback'; hasta: number } | null = null;

async function horaExterna(): Promise<Date | null> {
  try {
    const r = await fetch('http://worldtimeapi.org/api/timezone/Etc/UTC', { signal: AbortSignal.timeout(ESPERA_MS) });
    if (r.ok) {
      const data = await r.json();
      if (data.unixtime) return new Date(Number(data.unixtime) * 1000);
    }
  } catch {
    /* se intenta la alternativa */
  }
  try {
    const r = await fetch('https://timeapi.io/api/Time/current/zone?timeZone=UTC', { signal: AbortSignal.timeout(ESPERA_MS) });
    if (r.ok) {
      const d = await r.json();
      return new Date(Date.UTC(d.year, d.month - 1, d.day, d.hour, d.minute, d.seconds));
    }
  } catch {
    /* sin servicios externos */
  }
  return null;
}

async function obtenerReferencia() {
  if (referencia && referencia.hasta > Date.now()) return referencia;
  const externa = await horaExterna();
  referencia = externa
    ? { desfaseMs: externa.getTime() - Date.now(), fuente: 'external', hasta: Date.now() + VIGENCIA_MS }
    : { desfaseMs: 0, fuente: 'server_fallback', hasta: Date.now() + 60_000 };
  return referencia;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let zona = searchParams.get('timezone') || 'America/El_Salvador';
    try {
      new Intl.DateTimeFormat('es', { timeZone: zona });
    } catch {
      zona = 'America/El_Salvador';
    }

    const ref = await obtenerReferencia();
    const ahora = new Date(Date.now() + ref.desfaseMs);
    const partes = new Intl.DateTimeFormat('es', {
      timeZone: zona,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(ahora);
    const p = (tipo: string) => partes.find((x) => x.type === tipo)?.value || '';

    return NextResponse.json({
      success: true,
      serverTime: {
        iso: ahora.toISOString(),
        timestamp: ahora.getTime(),
        timezone: zona,
        formatted: `${p('day')}/${p('month')}/${p('year')} ${p('hour')}:${p('minute')}:${p('second')}`,
        date: `${p('year')}-${p('month')}-${p('day')}`,
        time: `${p('hour')}:${p('minute')}:${p('second')}`,
        year: parseInt(p('year')),
        month: parseInt(p('month')),
        day: parseInt(p('day')),
        hour: parseInt(p('hour')),
        minute: parseInt(p('minute')),
        second: parseInt(p('second')),
      },
      source: ref.fuente,
      maxToleranceMinutes: 5,
    });
  } catch (error) {
    console.error('Error obteniendo hora:', error);
    return NextResponse.json({ error: 'Error al obtener hora' }, { status: 500 });
  }
}
