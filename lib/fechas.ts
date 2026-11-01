/** Fecha AAAA-MM-DD en la hora local del equipo (toISOString la daría en UTC: de noche ya es "mañana"). */
export function fechaLocalISO(fecha: Date = new Date()): string {
  const a = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${a}-${m}-${d}`;
}

/** Hora local HH:MM:SS. */
export function horaLocal(fecha: Date = new Date()): string {
  return fecha.toTimeString().slice(0, 8);
}

/** Convierte 'AAAA-MM-DD' o Date en un Date a medianoche local. */
export function aFechaLocal(valor: string | Date): Date {
  if (valor instanceof Date) return new Date(valor.getFullYear(), valor.getMonth(), valor.getDate());
  const [a, m, d] = valor.slice(0, 10).split('-').map(Number);
  return new Date(a, (m || 1) - 1, d || 1);
}
