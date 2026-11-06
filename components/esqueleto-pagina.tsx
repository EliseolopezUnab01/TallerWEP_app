/** Marcador mientras carga una pantalla del panel: mismo encuadre que el contenido real. */
export function EsqueletoPagina() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Cargando">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-muted" />
        <div className="space-y-2">
          <div className="h-4 w-48 rounded bg-muted" />
          <div className="h-3 w-72 rounded bg-muted/70" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 rounded-xl border border-border bg-card" />
        ))}
      </div>
      <div className="h-[50vh] rounded-xl border border-border bg-card" />
    </div>
  );
}
