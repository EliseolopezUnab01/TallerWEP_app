'use client';

import { useRef, useState } from 'react';
import { FileText, Trash2, Upload } from 'lucide-react';
import { UI } from '@/lib/ui';
import { fecha, type Fila } from '../../_components/comun';

export function PanelTarjeta({
  idvehiculo,
  archivos,
  onCambio,
  notificar,
}: {
  idvehiculo: number;
  archivos: Fila[];
  onCambio: () => Promise<void>;
  notificar: (tipo: 'ok' | 'error', texto: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);

  const subir = async (lista: FileList | null) => {
    if (!lista?.length) return;
    setSubiendo(true);
    try {
      for (const archivo of Array.from(lista)) {
        const form = new FormData();
        form.append('archivo', archivo);
        form.append('carpeta', 'vehiculos');
        form.append('entidad', 'VEHICULO');
        form.append('identidad', String(idvehiculo));
        form.append('descripcion', 'Tarjeta de circulación');
        const res = await fetch('/api/archivos', { method: 'POST', body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'No se pudo subir el archivo');
      }
      notificar('ok', 'Foto de la tarjeta guardada');
      await onCambio();
    } catch (e) {
      notificar('error', (e as Error).message);
    } finally {
      setSubiendo(false);
      if (input.current) input.current.value = '';
    }
  };

  const eliminar = async (id: unknown) => {
    if (!confirm('¿Eliminar esta foto?')) return;
    const res = await fetch(`/api/archivos?id=${id}`, { method: 'DELETE' });
    if (!res.ok) notificar('error', 'No se pudo eliminar la foto');
    await onCambio();
  };

  return (
    <div className={UI.densePanel}>
      <div className={`${UI.densePanelTitle} flex items-center justify-between`}>
        <span>Foto de la tarjeta vigente</span>
        <button type="button" className={`${UI.denseBtn} normal-case tracking-normal`} disabled={subiendo} onClick={() => input.current?.click()}>
          <Upload className="h-3 w-3" /> {subiendo ? 'Subiendo…' : 'Subir foto'}
        </button>
        <input ref={input} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => subir(e.target.files)} />
      </div>
      {archivos.length === 0 ? (
        <p className="p-3 text-xs text-muted-foreground">Sin foto. Suba el frente y el reverso de la tarjeta de circulación.</p>
      ) : (
        <div className="flex flex-wrap gap-2 p-3">
          {archivos.map((a) => {
            const ruta = String(a.ruta);
            const esImagen = /\.(jpe?g|png|webp|gif)$/i.test(ruta);
            return (
              <div key={String(a.idarchivo)} className="relative w-40 rounded-md border border-border overflow-hidden group">
                <a href={ruta} target="_blank" rel="noreferrer" className="block h-28 bg-muted">
                  {esImagen ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ruta} alt={String(a.nombre_original ?? 'Tarjeta')} className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full items-center justify-center">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                    </span>
                  )}
                </a>
                <div className="px-1.5 py-1 text-[10px] text-muted-foreground truncate">
                  {fecha(a.created_at)} · {String(a.nombre_original ?? '')}
                </div>
                <button
                  type="button"
                  aria-label="Eliminar foto"
                  className="absolute top-1 right-1 rounded bg-card/90 p-1 text-red-600 opacity-0 group-hover:opacity-100 focus:opacity-100"
                  onClick={() => eliminar(a.idarchivo)}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
