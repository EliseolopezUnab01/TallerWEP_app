'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ImagePlus, Link2, Loader2, Save, Trash2, X } from 'lucide-react';
import { UI } from '@/lib/ui';
import { BuscadorProducto } from './BuscadorProducto';
import { COLOR_ESTADO } from './tipos';
import type { ProductoHit } from '../../ingreso/_components/tipos';

interface Temporal {
  idtemporal: number;
  codigo: string;
  referencia_proveedor: string | null;
  descripcion: string;
  oems: string | null;
  marca: string | null;
  origen_producto: string | null;
  comentario: string | null;
  estado: 'ACTIVO' | 'CONVERTIDO' | 'DESCARTADO';
  idprod_final: number | null;
  proveedor_nombre: string | null;
  producto_final_nombre: string | null;
}

interface Imagen {
  idarchivo: number;
  ruta: string;
  nombre_original: string | null;
}

interface DocUso {
  iddocumento: number;
  id_documento: string;
  estado_documento: string;
}

interface Props {
  idtemporal: number | null;
  onCerrar: () => void;
  onCambio: (mensaje: string) => void;
  onError: (mensaje: string) => void;
}

const CAMPOS: { campo: keyof Temporal; etiqueta: string; largo?: boolean }[] = [
  { campo: 'descripcion', etiqueta: 'Descripción' },
  { campo: 'referencia_proveedor', etiqueta: 'Ref. proveedor' },
  { campo: 'marca', etiqueta: 'Marca' },
  { campo: 'origen_producto', etiqueta: 'Origen' },
  { campo: 'oems', etiqueta: 'OEM (uno por línea)', largo: true },
  { campo: 'comentario', etiqueta: 'Comentario', largo: true },
];

/** Ficha del producto temporal: datos, imágenes de referencia y enlace a la ficha de inventario. */
export function DialogoTemporal({ idtemporal, onCerrar, onCambio, onError }: Props) {
  const [temporal, setTemporal] = useState<Temporal | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [imagenes, setImagenes] = useState<Imagen[]>([]);
  const [documentos, setDocumentos] = useState<DocUso[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [destino, setDestino] = useState<ProductoHit | null>(null);
  const refArchivo = useRef<HTMLInputElement>(null);

  const cargar = useCallback(async () => {
    if (!idtemporal) return;
    const res = await fetch(`/api/productos-temporales?id=${idtemporal}`);
    const data = await res.json();
    if (!data.success) {
      onError(data.error || 'No se pudo abrir el temporal');
      return;
    }
    setTemporal(data.temporal);
    setImagenes(data.imagenes);
    setDocumentos(data.documentos);
    setForm(Object.fromEntries(CAMPOS.map(({ campo }) => [campo, String(data.temporal[campo] ?? '')])));
  }, [idtemporal, onError]);

  useEffect(() => {
    setTemporal(null);
    setDestino(null);
    cargar();
  }, [cargar]);

  if (!idtemporal) return null;
  const activo = temporal?.estado === 'ACTIVO';

  const enviar = async (cuerpo: Record<string, unknown>) => {
    setOcupado(true);
    try {
      const res = await fetch('/api/productos-temporales', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idtemporal, ...cuerpo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar');
      onCambio(data.mensaje);
      await cargar();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setOcupado(false);
    }
  };

  const subir = async (archivos: FileList | null) => {
    if (!archivos?.length) return;
    setOcupado(true);
    try {
      for (const archivo of Array.from(archivos)) {
        const datos = new FormData();
        datos.set('archivo', archivo);
        datos.set('carpeta', 'temporales');
        datos.set('entidad', 'PRODUCTO_TEMPORAL');
        datos.set('identidad', String(idtemporal));
        const res = await fetch('/api/archivos', { method: 'POST', body: datos });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'No se pudo subir la imagen');
      }
      await cargar();
      onCambio('Imagen agregada');
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setOcupado(false);
      if (refArchivo.current) refArchivo.current.value = '';
    }
  };

  const quitarImagen = async (id: number) => {
    if (!confirm('¿Eliminar esta imagen?')) return;
    const res = await fetch(`/api/archivos?id=${id}`, { method: 'DELETE' });
    if (res.ok) await cargar();
    else onError('No se pudo eliminar la imagen');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={onCerrar}>
      <div
        className={`${UI.densePanel} w-full max-w-3xl max-h-[90vh] flex flex-col`}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Producto temporal"
      >
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold">{temporal?.codigo ?? 'Producto temporal'}</span>
            {temporal && (
              <span className={`rounded px-1.5 text-[10px] font-semibold ${COLOR_ESTADO[temporal.estado === 'ACTIVO' ? 'BORRADOR' : temporal.estado === 'CONVERTIDO' ? 'FINALIZADO' : 'ANULADO']}`}>
                {temporal.estado}
              </span>
            )}
            {temporal?.proveedor_nombre && <span className="text-xs text-muted-foreground">{temporal.proveedor_nombre}</span>}
          </div>
          <button type="button" className={UI.denseBtn} onClick={onCerrar} aria-label="Cerrar">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {!temporal ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="overflow-y-auto p-3 flex flex-col gap-3">
            {temporal.estado === 'CONVERTIDO' && (
              <p className={`${UI.avisoOk} px-3 py-2 text-xs`}>
                Enlazado a la ficha {temporal.idprod_final} — {temporal.producto_final_nombre}. Las líneas de los documentos ya usan ese
                producto.
              </p>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              {CAMPOS.map(({ campo, etiqueta, largo }) => (
                <label key={campo} className={`flex flex-col gap-1 ${largo ? 'sm:col-span-2' : ''}`}>
                  <span className={UI.denseLabel}>{etiqueta}</span>
                  {largo ? (
                    <textarea
                      className={`${UI.denseInput} h-14 py-1`}
                      value={form[campo] ?? ''}
                      disabled={!activo}
                      onChange={(e) => setForm({ ...form, [campo]: e.target.value })}
                    />
                  ) : (
                    <input
                      className={UI.denseInput}
                      value={form[campo] ?? ''}
                      disabled={!activo}
                      onChange={(e) => setForm({ ...form, [campo]: e.target.value })}
                    />
                  )}
                </label>
              ))}
            </div>

            {activo && (
              <div className="flex justify-end">
                <button type="button" className={UI.denseBtnPrimary} disabled={ocupado} onClick={() => enviar(form)}>
                  <Save className="h-3.5 w-3.5" /> Guardar datos
                </button>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className={UI.denseLabel}>Imágenes de referencia ({imagenes.length})</span>
                {activo && (
                  <>
                    <input
                      ref={refArchivo}
                      type="file"
                      accept="image/*,application/pdf"
                      multiple
                      className="hidden"
                      onChange={(e) => subir(e.target.files)}
                    />
                    <button type="button" className={UI.denseBtn} disabled={ocupado} onClick={() => refArchivo.current?.click()}>
                      <ImagePlus className="h-3.5 w-3.5" /> Agregar
                    </button>
                  </>
                )}
              </div>
              {imagenes.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {activo ? 'Sin imágenes. Se borran al enlazar el temporal con su ficha de inventario.' : 'Sin imágenes.'}
                </p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {imagenes.map((img) => (
                    <div key={img.idarchivo} className="relative group rounded-md border border-border overflow-hidden aspect-square bg-muted">
                      <a href={img.ruta} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img.ruta} alt={img.nombre_original ?? ''} className="h-full w-full object-cover" />
                      </a>
                      {activo && (
                        <button
                          type="button"
                          className="absolute top-1 right-1 rounded bg-black/60 p-1 text-white opacity-0 group-hover:opacity-100"
                          onClick={() => quitarImagen(img.idarchivo)}
                          aria-label="Eliminar imagen"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {activo && (
              <div className="flex flex-col gap-2 rounded-md border border-dashed border-border p-2">
                <span className={UI.denseLabel}>Enlazar con ficha de inventario</span>
                <p className="text-[11px] text-muted-foreground">
                  Cree la ficha en{' '}
                  <Link href="/dashboard/inventario/nuevo" target="_blank" className="text-primary underline">
                    Nuevo Producto
                  </Link>{' '}
                  y luego búsquela aquí. Todas las líneas con {temporal.codigo} pasarán a ese producto y las imágenes se eliminarán.
                </p>
                <div className="flex items-center gap-2">
                  <BuscadorProducto onElegir={setDestino} disabled={ocupado} />
                  <button
                    type="button"
                    className={UI.denseBtnPrimary}
                    disabled={!destino || ocupado}
                    onClick={() => {
                      if (destino && confirm(`¿Enlazar ${temporal.codigo} con ${destino.idprod} — ${destino.nombre}?`)) {
                        enviar({ accion: 'convertir', idprod: destino.idprod });
                      }
                    }}
                  >
                    <Link2 className="h-3.5 w-3.5" /> Enlazar
                  </button>
                </div>
                {destino && (
                  <p className="text-xs">
                    Elegido: <span className={UI.denseMono}>{destino.idprod}</span> — {destino.nombre}
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1 text-[11px] text-muted-foreground">
                Usado en:
                {documentos.length === 0 ? ' ningún documento' : documentos.map((d) => <span key={d.iddocumento} className={UI.denseMono}>{d.id_documento}</span>)}
              </div>
              {activo && (
                <button
                  type="button"
                  className={UI.denseBtnDanger}
                  disabled={ocupado}
                  onClick={() => confirm(`¿Descartar ${temporal.codigo}?`) && enviar({ accion: 'descartar' })}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Descartar
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
