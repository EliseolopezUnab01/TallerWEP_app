'use client';
import { confirmar } from '@/components/ui/avisos';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Paperclip, Trash2, Upload } from 'lucide-react';
import { UI } from '@/lib/ui';
import type { Fila } from './comun';

type Destino = { nodocto: number } | { entidad: string; identidad: number };

interface Props {
  titulo: string;
  destino: Destino;
  editable?: boolean;
  compacto?: boolean;
  onCambio?: () => void;
}

const consulta = (d: Destino) =>
  'nodocto' in d ? `nodocto=${d.nodocto}` : `entidad=${encodeURIComponent(d.entidad)}&identidad=${d.identidad}`;

/** Lista y sube archivos (PDF, fotos) ligados a un documento o a una entidad del proceso. */
export function Adjuntos({ titulo, destino, editable = true, compacto, onCambio }: Props) {
  const [archivos, setArchivos] = useState<Fila[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const clave = consulta(destino);

  const cargar = useCallback(async () => {
    const res = await fetch(`/api/archivos?${clave}`);
    const data = await res.json();
    if (res.ok) setArchivos(data.archivos);
  }, [clave]);

  useEffect(() => {
    let vigente = true;
    fetch(`/api/archivos?${clave}`)
      .then((r) => r.json())
      .then((data) => vigente && setArchivos(data.archivos ?? []))
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, [clave]);

  const subir = async (lista: FileList | null) => {
    if (!lista?.length) return;
    setSubiendo(true);
    setError('');
    try {
      for (const archivo of Array.from(lista)) {
        const form = new FormData();
        form.append('archivo', archivo);
        form.append('carpeta', 'procesos');
        if ('nodocto' in destino) form.append('nodocto', String(destino.nodocto));
        else {
          form.append('entidad', destino.entidad);
          form.append('identidad', String(destino.identidad));
        }
        const res = await fetch('/api/archivos', { method: 'POST', body: form });
        if (!res.ok) throw new Error((await res.json()).error || 'No se pudo subir');
      }
      await cargar();
      onCambio?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubiendo(false);
      if (input.current) input.current.value = '';
    }
  };

  const quitar = async (id: unknown) => {
    if (!(await confirmar('¿Eliminar este archivo?'))) return;
    const res = await fetch(`/api/archivos?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      await cargar();
      onCambio?.();
    }
  };

  return (
    <div className={compacto ? 'flex flex-col gap-1' : `${UI.densePanel} flex flex-col`}>
      <div className={compacto ? 'flex items-center gap-2' : `${UI.densePanelTitle} flex items-center justify-between`}>
        <span className="flex items-center gap-1">
          <Paperclip className="h-3.5 w-3.5" /> {titulo} ({archivos.length})
        </span>
        {editable && (
          <>
            <input ref={input} type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={(e) => subir(e.target.files)} />
            <button type="button" className={UI.denseBtn} disabled={subiendo} onClick={() => input.current?.click()}>
              <Upload className="h-3.5 w-3.5" /> {subiendo ? 'Subiendo…' : 'Adjuntar'}
            </button>
          </>
        )}
      </div>
      {error && <p className="px-3 text-[11px] text-red-600 dark:text-red-400">{error}</p>}
      {archivos.length > 0 && (
        <ul className={`flex flex-wrap gap-1.5 ${compacto ? '' : 'p-2'}`}>
          {archivos.map((a) => {
            const ruta = String(a.ruta);
            const esImagen = /\.(jpe?g|png|webp|gif)$/i.test(ruta);
            return (
              <li key={String(a.idarchivo)} className="flex items-center gap-1 rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[11px]">
                <a href={ruta} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline max-w-[14rem]">
                  {esImagen && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ruta} alt="" className="h-5 w-5 rounded object-cover" />
                  )}
                  <span className="truncate">{String(a.nombre_original ?? ruta.split('/').pop())}</span>
                </a>
                {editable && (
                  <button type="button" className="text-muted-foreground hover:text-red-600" aria-label="Eliminar archivo" onClick={() => quitar(a.idarchivo)}>
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
