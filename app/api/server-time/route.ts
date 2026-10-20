import { NextResponse } from 'next/server';

// API para obtener la hora de un servicio externo confiable
// Acepta la zona horaria del cliente como parámetro
export async function GET(request: Request) {
  try {
    // Obtener zona horaria del cliente desde query params
    const { searchParams } = new URL(request.url);
    const clientTimezone = searchParams.get('timezone') || 'America/El_Salvador';
    
    // Intentar obtener hora de WorldTimeAPI (servicio gratuito y confiable)
    let externalTime = null;
    let source = 'external';
    
    try {
      // WorldTimeAPI - servicio gratuito
      const response = await fetch(`http://worldtimeapi.org/api/timezone/${clientTimezone}`, {
        signal: AbortSignal.timeout(5000) // timeout de 5 segundos
      });
      
      if (response.ok) {
        const data = await response.json();
        externalTime = new Date(data.datetime);
      }
    } catch (e) {
      console.log('WorldTimeAPI no disponible, intentando alternativa...');
    }
    
    // Si WorldTimeAPI falla, intentar con timeapi.io
    if (!externalTime) {
      try {
        const response = await fetch(`https://timeapi.io/api/Time/current/zone?timeZone=${clientTimezone}`, {
          signal: AbortSignal.timeout(5000)
        });
        
        if (response.ok) {
          const data = await response.json();
          // timeapi.io devuelve: { year, month, day, hour, minute, seconds, ... }
          externalTime = new Date(data.year, data.month - 1, data.day, data.hour, data.minute, data.seconds);
        }
      } catch (e) {
        console.log('timeapi.io no disponible');
      }
    }
    
    // Si ambos servicios fallan, usar hora del servidor como fallback (con advertencia)
    if (!externalTime) {
      externalTime = new Date();
      source = 'server_fallback';
      console.warn('⚠️ Usando hora del servidor local como fallback');
    }
    
    // Formatear fecha/hora en la zona horaria del cliente
    const formatter = new Intl.DateTimeFormat('es', {
      timeZone: clientTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    const parts = formatter.formatToParts(externalTime);
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';
    
    return NextResponse.json({
      success: true,
      serverTime: {
        iso: externalTime.toISOString(),
        timestamp: externalTime.getTime(),
        timezone: clientTimezone,
        formatted: `${getPart('day')}/${getPart('month')}/${getPart('year')} ${getPart('hour')}:${getPart('minute')}:${getPart('second')}`,
        date: `${getPart('year')}-${getPart('month')}-${getPart('day')}`,
        time: `${getPart('hour')}:${getPart('minute')}:${getPart('second')}`,
        year: parseInt(getPart('year')),
        month: parseInt(getPart('month')),
        day: parseInt(getPart('day')),
        hour: parseInt(getPart('hour')),
        minute: parseInt(getPart('minute')),
        second: parseInt(getPart('second'))
      },
      source: source, // 'external' o 'server_fallback'
      // Tolerancia máxima en minutos (si la diferencia es mayor, hay problema)
      maxToleranceMinutes: 5
    });
  } catch (error) {
    console.error('Error obteniendo hora:', error);
    return NextResponse.json(
      { error: 'Error al obtener hora' },
      { status: 500 }
    );
  }
}
