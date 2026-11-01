'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, GripVertical, History, ImageOff, Pencil, Trash2, X } from 'lucide-react';
import { UI } from '@/lib/ui';
import { DialogoHistorial } from '@/app/dashboard/compras/procesos/_components/DialogoHistorial';
import type { CompraCtx } from './useCompra';
import { CONDICIONES_IVA_UI, DESTINOS_UI, fmt2, fmt4, type FormLinea, type Linea } from './tipos';

const ESTILO_DESTINO: Record<string, string> = {
  INVENTARIO: 'text-sky-700 dark:text-sky-300',
  EXPRESS: 'text-violet-700 dark:text-violet-300',
  GASTOS: 'text-amber-700 dark:text-amber-300',
  ACTIVOS: 'text-emerald-700 dark:text-emerald-300',
};

/** Columnas de importación del control 30: se llenan con el cálculo DUCA y el retaceo del proceso. */
const COLUMNAS_IMPORTACION: { titulo: string; valor: (l: Linea) => string | null }[] = [
  { titulo: 'DAI', valor: (l) => (l.imp_dai_unitario == null ? null : fmt4(l.imp_dai_unitario)) },
  { titulo: 'Cargos Or.', valor: (l) => (l.imp_gastos_unitario == null ? null : fmt4(l.imp_gastos_unitario)) },
  { titulo: 'CIF Prod.', valor: (l) => (l.imp_costo_cif == null ? null : fmt4(l.imp_costo_cif)) },
  { titulo: 'St. CIF', valor: (l) => (l.imp_subtotal_cif == null ? null : fmt2(l.imp_subtotal_cif)) },
  { titulo: 'Cst. Local', valor: (l) => (l.imp_costo_local == null ? null : fmt4(l.imp_costo_local)) },
  {
    titulo: 'St. Local',
    valor: (l) => (l.imp_costo_local == null ? null : fmt2(Number(l.imp_costo_local) * Number(l.cantidad))),
  },
  { titulo: 'Partida', valor: (l) => l.imp_partida || null },
];

export function lineaAForm(l: Linea): FormLinea {
  return {
    iddetalle: l.iddetalle,
    numero_orden: l.numero_orden || '',
    destino: l.destino || '',
    codigo_express: l.codigo_express || '',
    iddetalle_origen: l.iddetalle_origen,
    idcatalogo: l.idcatalogo ? String(l.idcatalogo) : '',
    idprod: l.idprod ? String(l.idprod) : '',
    referencia_proveedor: l.referencia_proveedor || '',
    referencia_oem: l.producto_oe || '',
    descripcion: l.descripcion || '',
    cantidad: String(Number(l.cantidad)),
    costo_unitario: String(Number(l.costo_unitario)),
    descuento_porcentaje: String(Number(l.descuento_porcentaje || 0)),
    condicion_iva: l.condicion_iva,
    numero_documento_rel: l.numero_documento_rel || '',
    iva_incluido: false,
  };
}

function Resumen({ etiqueta, valor, pendiente = false, title }: { etiqueta: string; valor: string; pendiente?: boolean; title?: string }) {
  return (
    <label className={`flex flex-col gap-0.5 ${pendiente ? UI.densePending : ''}`} title={title}>
      <span className={UI.denseLabel}>{etiqueta}</span>
      <input
        readOnly
        disabled={pendiente}
        className={`${UI.denseInput} ${UI.denseMono} w-20 text-right bg-muted/40`}
        value={valor}
      />
    </label>
  );
}

interface Props {
  ctx: CompraCtx;
  editandoId: number;
  existencia: number | null;
  onEditar: (l: Linea) => void;
}

export function GrillaDetalle({ ctx, editandoId, existencia, onEditar }: Props) {
  const { lineas, esBorrador } = ctx;
  const [imagen, setImagen] = useState<{ url: string; titulo: string } | null>(null);
  const [historial, setHistorial] = useState<number | null>(null);
  const [arrastre, setArrastre] = useState<{ desde: number; sobre: number } | null>(null);

  const soltar = (hasta: number) => {
    if (arrastre) ctx.reordenarLinea(arrastre.desde, hasta);
    setArrastre(null);
  };

  const articulos = lineas.reduce((s, l) => s + (Number(l.cantidad) || 0), 0);
  const subtotal = lineas.reduce((s, l) => s + (Number(l.subtotal_sin_iva) || 0), 0);
  const hayCif = lineas.some((l) => l.imp_subtotal_cif != null);
  const cifTotal = hayCif
    ? lineas.reduce((s, l) => s + (Number(l.imp_subtotal_cif) || 0), 0)
    : subtotal;
  const subtotalDivisa = ctx.esImportacion
    ? lineas.reduce((s, l) => s + (Number(l.costo_unitario) || 0) * (Number(l.cantidad) || 0), 0)
    : null;

  return (
    <div className={`${UI.densePanel} flex flex-col flex-1 min-h-0`}>
      <div className="flex flex-wrap items-end gap-x-3 gap-y-2 px-2.5 py-1.5 border-b border-border">
        <div className="flex flex-col gap-1 mr-auto">
          <span className={`${UI.densePanelTitle} border-0 p-0`}>Detalles de compra</span>
          <span className="flex flex-wrap gap-x-3 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
            <span>[ F2 Finalizar documento ]</span>
            <span>[ F3 Catálogo de proveedores ]</span>
            <span>[ F4 Anular documento ]</span>
          </span>
        </div>
        <Resumen
          etiqueta="CIF total"
          valor={fmt2(cifTotal)}
          title={hayCif ? 'Suma del CIF calculado en el retaceo' : 'Aún sin retaceo: se muestra el subtotal sin IVA'}
        />
        <Resumen etiqueta="Existencia" valor={existencia == null ? '—' : String(existencia)} />
        <Resumen etiqueta="Artículos" valor={String(articulos)} />
        <Resumen etiqueta="Subtotal $" valor={fmt2(subtotal)} />
        <Resumen
          etiqueta="Subtotal €"
          valor={subtotalDivisa == null ? '—' : fmt2(subtotalDivisa)}
          title={subtotalDivisa == null ? 'Solo en importaciones: suma del costo en la moneda del documento' : 'Suma del costo unitario por la cantidad, en la moneda del documento'}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <table className={UI.denseTable}>
          <thead>
            <tr>
              <th className={`${UI.denseTh} text-right`}>No.</th>
              <th className={UI.denseTh}>Orden / Tipo</th>
              <th className={UI.denseTh}>Código</th>
              <th className={UI.denseTh}>Referencia</th>
              <th className={`${UI.denseTh} min-w-[14rem]`}>Descripción</th>
              <th className={`${UI.denseTh} text-right`}>Cant.</th>
              <th className={`${UI.denseTh} text-right`}>Costo</th>
              <th className={`${UI.denseTh} text-right`}>Subt. s/IVA</th>
              <th className={`${UI.denseTh} text-right`} title="IVA por unidad">IVA u.</th>
              <th className={`${UI.denseTh} text-right`}>Subt. c/IVA</th>
              <th className={`${UI.denseTh} text-right`} title="Exento por unidad">Exento u.</th>
              <th className={`${UI.denseTh} text-right`} title="No sujeto por unidad">No sujeto u.</th>
              <th className={`${UI.denseTh} text-right`}>Desc.%</th>
              <th className={UI.denseTh}>Afectación</th>
              <th className={`${UI.denseTh} text-center`}>Imagen</th>
              {COLUMNAS_IMPORTACION.map((c) => (
                <th key={c.titulo} className={`${UI.denseTh} text-right`} title="Se calcula en el proceso de ingreso (DUCA y retaceo)">
                  {c.titulo}
                </th>
              ))}
              <th className={`${UI.denseTh} sticky right-0`} />
            </tr>
          </thead>
          <tbody>
            {lineas.map((l, i) => {
              const cant = Number(l.cantidad) || 0;
              const subt = Number(l.subtotal_sin_iva) || 0;
              const exento = Number(l.exento_unitario) || 0;
              const noSujeto = Number(l.no_sujeto_unitario) || 0;
              const iva = Number(l.iva_unitario) || 0;
              const activa = editandoId === l.iddetalle;
              const afectacion = CONDICIONES_IVA_UI.find((c) => c.valor === l.condicion_iva)?.etiqueta || l.condicion_iva;
              const destinoArrastre =
                arrastre && arrastre.sobre === i && arrastre.desde !== i
                  ? arrastre.desde < i
                    ? 'shadow-[inset_0_-2px_0_var(--color-primary)]'
                    : 'shadow-[inset_0_2px_0_var(--color-primary)]'
                  : '';
              return (
                <tr
                  key={l.iddetalle}
                  className={`${activa ? UI.denseRowActive : esBorrador ? UI.denseRow : ''} ${destinoArrastre} ${arrastre?.desde === i ? 'opacity-40' : ''}`}
                  onClick={() => esBorrador && onEditar(l)}
                  draggable={esBorrador}
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'move';
                    setArrastre({ desde: i, sobre: i });
                  }}
                  onDragOver={(e) => {
                    if (!arrastre) return;
                    e.preventDefault();
                    if (arrastre.sobre !== i) setArrastre({ ...arrastre, sobre: i });
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    soltar(i);
                  }}
                  onDragEnd={() => setArrastre(null)}
                >
                  <td className={`${UI.denseTd} ${UI.denseMono} text-right text-muted-foreground`}>
                    <span className="inline-flex items-center gap-0.5">
                      {esBorrador && <GripVertical className="w-3 h-3 cursor-grab opacity-50" aria-hidden />}
                      {l.numero_linea}
                    </span>
                  </td>
                  <td className={UI.denseTd}>
                    <span className="flex items-baseline gap-1.5">
                      <span className={`${UI.denseMono} text-muted-foreground`} title={l.numero_orden ? 'Orden de trabajo' : undefined}>
                        {l.numero_orden || '—'}
                      </span>
                      {l.destino ? (
                        <span className={`font-semibold uppercase text-[10px] ${ESTILO_DESTINO[l.destino ?? ''] || ''}`}>
                          {DESTINOS_UI.find((d) => d.valor === l.destino)?.etiqueta || l.destino}
                        </span>
                      ) : (
                        <span
                          className="px-1 rounded bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300 text-[10px] font-semibold"
                          title="Clasifique la línea como express o gasto antes de registrar"
                        >
                          SIN TIPO
                        </span>
                      )}
                      {l.iddetalle_origen && (
                        <span
                          className="px-1 rounded bg-muted text-muted-foreground text-[10px]"
                          title={Number(l.ajuste_precio) ? 'Rebaja de precio: no devuelve producto' : 'Devolución de la factura original'}
                        >
                          {Number(l.ajuste_precio) ? 'rebaja' : 'devol.'}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className={`${UI.denseTd} ${UI.denseMono}`} title={l.codigo_express ? 'Código express' : undefined}>
                    <span className="inline-flex items-center gap-1">
                      {l.codigo_express || l.idprod || '—'}
                      {l.idprod ? (
                        <button
                          type="button"
                          className="text-primary hover:underline"
                          title="Historial del producto"
                          onClick={(e) => {
                            e.stopPropagation();
                            setHistorial(l.idprod);
                          }}
                        >
                          <History className="h-3 w-3" />
                        </button>
                      ) : null}
                    </span>
                  </td>
                  <td className={`${UI.denseTd} ${UI.denseMono} max-w-[8rem] truncate`} title={l.referencia_proveedor || ''}>
                    {l.referencia_proveedor || '—'}
                  </td>
                  <td className={`${UI.denseTd} max-w-[22rem] truncate`} title={l.descripcion}>
                    {l.descripcion}
                    {l.catalogo_nombre && <span className="text-muted-foreground"> · {l.catalogo_nombre}</span>}
                  </td>
                  <td className={`${UI.denseTd} ${UI.denseMono} text-right`}>{cant}</td>
                  <td className={`${UI.denseTd} ${UI.denseMono} text-right`}>{fmt4(l.costo_unitario)}</td>
                  <td className={`${UI.denseTd} ${UI.denseMono} text-right`}>{fmt2(subt)}</td>
                  <td className={`${UI.denseTd} ${UI.denseMono} text-right`}>{iva ? fmt2(iva) : ''}</td>
                  <td className={`${UI.denseTd} ${UI.denseMono} text-right font-semibold`}>{fmt2(l.subtotal_con_iva)}</td>
                  <td className={`${UI.denseTd} ${UI.denseMono} text-right`}>{exento ? fmt2(exento) : ''}</td>
                  <td className={`${UI.denseTd} ${UI.denseMono} text-right`}>{noSujeto ? fmt2(noSujeto) : ''}</td>
                  <td className={`${UI.denseTd} ${UI.denseMono} text-right`}>
                    {Number(l.descuento_porcentaje) ? fmt2(l.descuento_porcentaje) : ''}
                  </td>
                  <td className={UI.denseTd}>
                    {l.condicion_iva === 'XCOMPROBAR' ? (
                      <span className="px-1 rounded bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300 text-[10px] font-semibold">
                        X COMPROBAR
                      </span>
                    ) : (
                      afectacion
                    )}
                  </td>
                  <td className={`${UI.denseTd} text-center`} onClick={(e) => e.stopPropagation()}>
                    {l.imagen_url ? (
                      <button
                        type="button"
                        className="inline-block h-6 w-6 rounded overflow-hidden border border-border hover:ring-1 hover:ring-primary"
                        onClick={() => setImagen({ url: l.imagen_url as string, titulo: l.descripcion })}
                        aria-label="Ver imagen"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={l.imagen_url} alt="" className="h-full w-full object-cover" />
                      </button>
                    ) : (
                      <ImageOff className="w-3.5 h-3.5 inline text-muted-foreground/50" />
                    )}
                  </td>
                  {COLUMNAS_IMPORTACION.map((c) => {
                    const valor = c.valor(l);
                    return (
                      <td key={c.titulo} className={`${UI.denseTd} text-right ${valor ? UI.denseMono : 'text-muted-foreground/60'}`}>
                        {valor ?? '—'}
                      </td>
                    );
                  })}
                  <td className={`${UI.denseTd} text-right sticky right-0 bg-card`} onClick={(e) => e.stopPropagation()}>
                    {esBorrador && (
                      <div className="inline-flex items-center gap-0.5 text-muted-foreground">
                        <button type="button" className="p-0.5 rounded hover:bg-muted hover:text-foreground disabled:opacity-30" disabled={i === 0} onClick={() => ctx.moverLinea(i, -1)} title="Subir">
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" className="p-0.5 rounded hover:bg-muted hover:text-foreground disabled:opacity-30" disabled={i === lineas.length - 1} onClick={() => ctx.moverLinea(i, 1)} title="Bajar">
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" className="p-0.5 rounded hover:bg-muted hover:text-foreground" onClick={() => onEditar(l)} title="Editar">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" className="p-0.5 rounded hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10" onClick={() => ctx.eliminarLinea(l.iddetalle)} title="Eliminar">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {lineas.length === 0 && (
              <tr>
                <td colSpan={16 + COLUMNAS_IMPORTACION.length} className="px-3 py-6 text-[11px] text-muted-foreground">
                  <span className="sticky left-3">
                    {ctx.compra ? 'Sin líneas. Busque en inventario o escriba una descripción y presione Enter.' : 'Cree o abra una compra para comenzar.'}
                  </span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <DialogoHistorial idprod={historial} onCerrar={() => setHistorial(null)} />
      {imagen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 cursor-zoom-out"
          onClick={() => setImagen(null)}
          role="dialog"
          aria-label={imagen.titulo}
        >
          <div className={`${UI.densePanel} max-w-3xl p-2 relative`}>
            <button
              type="button"
              className="absolute top-1 right-1 p-1 rounded bg-card/80 text-muted-foreground hover:text-foreground"
              aria-label="Cerrar imagen"
            >
              <X className="w-4 h-4" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagen.url} alt={imagen.titulo} className="max-h-[75vh] max-w-full object-contain rounded" />
            <p className="mt-1 text-xs text-muted-foreground truncate">{imagen.titulo}</p>
          </div>
        </div>
      )}
    </div>
  );
}
