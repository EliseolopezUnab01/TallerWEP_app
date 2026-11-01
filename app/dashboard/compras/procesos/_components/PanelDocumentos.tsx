'use client';
import { confirmar } from '@/components/ui/avisos';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Eye, FilePlus2, Link2, Trash2, X } from 'lucide-react';
import { UI } from '@/lib/ui';
import { RAZONES_VINCULO } from '@/lib/procesos-constantes';
import { InputBlur, fmt, num, pedir, type DetalleProceso, type Fila } from './comun';
import { Adjuntos } from './Adjuntos';
import { DialogoFactura } from './DialogoFactura';

/** Ventana con las líneas del documento vinculado y sus archivos. */
function DialogoDocumento({ relacion, onCerrar }: { relacion: Fila; onCerrar: () => void }) {
  const esCompra = Boolean(relacion.idcompra);
  const conLineas = esCompra || Boolean(relacion.iddocumento);
  const [lineas, setLineas] = useState<Fila[] | null>(conLineas ? null : []);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!conLineas) return;
    let vigente = true;
    const url = esCompra ? `/api/compras-detalle?idcompra=${relacion.idcompra}` : `/api/documentos-compras?id=${relacion.iddocumento}`;
    pedir(url)
      .then((data) => vigente && setLineas(data.lineas ?? []))
      .catch((e: Error) => vigente && setError(e.message));
    return () => {
      vigente = false;
    };
  }, [conLineas, esCompra, relacion.idcompra, relacion.iddocumento]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCerrar}>
      <div className={`${UI.densePanel} flex max-h-[85vh] w-full max-w-4xl flex-col`} onClick={(e) => e.stopPropagation()}>
        <div className={`${UI.densePanelTitle} flex items-center justify-between`}>
          <span>
            {String(relacion.numero_sistema ?? relacion.ref_documento ?? '')} · {String(relacion.razon_vinculo)} · {fmt(relacion.total_usd)} USD
          </span>
          <button type="button" className="p-1 text-muted-foreground hover:text-foreground" aria-label="Cerrar" onClick={onCerrar}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-auto">
          {error ? (
            <p className="p-4 text-xs text-red-600 dark:text-red-400">{error}</p>
          ) : !lineas ? (
            <p className="p-4 text-xs text-muted-foreground">Cargando…</p>
          ) : (
            <table className={UI.denseTable}>
              <thead>
                <tr>
                  <th className={UI.denseTh}>#</th>
                  <th className={UI.denseTh}>Código</th>
                  <th className={UI.denseTh}>Descripción</th>
                  {esCompra && <th className={UI.denseTh}>Tipo</th>}
                  <th className={`${UI.denseTh} text-right`}>Cant.</th>
                  <th className={`${UI.denseTh} text-right`}>{esCompra ? 'Costo' : 'Precio'}</th>
                  <th className={`${UI.denseTh} text-right`}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {lineas.map((l, i) => {
                  const precio = num(esCompra ? l.costo_unitario : l.precio_moneda);
                  return (
                    <tr key={String(l.iddetalle ?? i)}>
                      <td className={UI.denseTd}>{String(l.numero_linea ?? l.linea_visual ?? i + 1)}</td>
                      <td className={`${UI.denseTd} ${UI.denseMono}`}>{String(l.producto_codigo ?? l.referencia_proveedor ?? l.idprod ?? '')}</td>
                      <td className={`${UI.denseTd} max-w-[22rem] truncate`} title={String(l.descripcion ?? l.descripcion_articulo ?? '')}>
                        {String(l.descripcion ?? l.descripcion_articulo ?? '')}
                      </td>
                      {esCompra && <td className={UI.denseTd}>{String(l.destino ?? '—')}</td>}
                      <td className={`${UI.denseTd} ${UI.denseMono} text-right`}>{fmt(l.cantidad, 2)}</td>
                      <td className={`${UI.denseTd} ${UI.denseMono} text-right`}>{fmt(precio, 4)}</td>
                      <td className={`${UI.denseTd} ${UI.denseMono} text-right`}>{fmt(precio * num(l.cantidad))}</td>
                    </tr>
                  );
                })}
                {lineas.length === 0 && (
                  <tr>
                    <td colSpan={7} className={`${UI.denseTd} py-4 text-center text-muted-foreground`}>
                      Documento sin líneas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
        {relacion.nodocto ? (
          <div className="border-t border-border p-2">
            <Adjuntos compacto titulo="Archivos del documento" destino={{ nodocto: Number(relacion.nodocto) }} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

interface Props {
  detalle: DetalleProceso;
  editable: boolean;
  accion: (cuerpo: Record<string, unknown>) => Promise<boolean>;
  actualizarRelacion: (idrelacion: number, cambios: Record<string, unknown>) => void;
  onError: (texto: string) => void;
}

const vacio = { nodocto: '', ref_documento: '', razon_vinculo: 'FACTURA', total_usd: '', comentarios: '' };

export function PanelDocumentos({ detalle, editable, accion, actualizarRelacion, onError }: Props) {
  const [form, setForm] = useState(vacio);
  const [viendo, setViendo] = useState<Fila | null>(null);
  const [facturando, setFacturando] = useState(false);
  const { relaciones, facturas, documentos, proceso } = detalle;
  const hayProforma = documentos.some(
    (d) => (d.tipo_documento === 'PROFORMA' || d.tipo_documento === 'ORDEN') && d.estado_documento !== 'ANULADO'
  );

  const vincular = async () => {
    const ok = await accion({
      accion: 'vincular',
      nodocto: form.nodocto.trim() || undefined,
      ref_documento: form.ref_documento.trim() || undefined,
      razon_vinculo: form.razon_vinculo,
      total_usd: form.total_usd === '' ? undefined : form.total_usd,
      comentarios: form.comentarios,
    });
    if (ok) setForm({ ...vacio, razon_vinculo: form.razon_vinculo });
  };

  return (
    <div className="flex flex-col gap-2">
      {editable && (
        <div className={`${UI.densePanel} flex flex-wrap items-end gap-2 p-3`}>
          <label className="flex flex-col gap-1">
            <span className={UI.denseLabel}>ID del documento</span>
            <input
              className={`${UI.denseInput} w-32 ${UI.denseMono}`}
              placeholder="26000012"
              value={form.nodocto}
              onChange={(e) => setForm({ ...form, nodocto: e.target.value.replace(/\D/g, '') })}
            />
          </label>
          <span className="pb-1.5 text-xs text-muted-foreground">o</span>
          <label className="flex flex-col gap-1">
            <span className={UI.denseLabel}>Referencia externa</span>
            <input
              className={`${UI.denseInput} w-40`}
              placeholder="BL, voucher, recibo…"
              value={form.ref_documento}
              onChange={(e) => setForm({ ...form, ref_documento: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={UI.denseLabel}>Categoría</span>
            <input
              list="razones-vinculo"
              maxLength={40}
              className={`${UI.denseInput} w-36 uppercase`}
              value={form.razon_vinculo}
              onChange={(e) => setForm({ ...form, razon_vinculo: e.target.value.toUpperCase() })}
            />
            <datalist id="razones-vinculo">
              {RAZONES_VINCULO.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </label>
          <label className="flex flex-col gap-1">
            <span className={UI.denseLabel}>Monto USD</span>
            <input
              type="number"
              step="any"
              className={`${UI.denseInput} w-28 text-right`}
              placeholder="Fiscal del doc."
              value={form.total_usd}
              onChange={(e) => setForm({ ...form, total_usd: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1 flex-1 min-w-[10rem]">
            <span className={UI.denseLabel}>Comentarios</span>
            <input className={UI.denseInput} value={form.comentarios} onChange={(e) => setForm({ ...form, comentarios: e.target.value })} />
          </label>
          <button
            type="button"
            className={UI.denseBtnPrimary}
            disabled={(!form.nodocto && !form.ref_documento.trim()) || !form.razon_vinculo.trim()}
            onClick={vincular}
          >
            <Link2 className="h-3.5 w-3.5" /> Vincular
          </button>
          <p className="basis-full text-[11px] text-muted-foreground">
            Con el ID de una compra ya ingresada, el monto se toma solo de lo fiscal sin IVA (sin cuenta ajena). Categoría FACTURA mete sus
            productos de inventario al retaceo (express no entra); las demás (seguro, flete, forwarder…) se proponen para repartir. Puede
            escribir una categoría nueva.
          </p>
        </div>
      )}

      <Adjuntos titulo="Archivos del proceso" destino={{ nodocto: Number(proceso.nodocto) }} />

      <div className={`${UI.densePanel} overflow-auto`}>
        <div className={UI.densePanelTitle}>Documentos vinculados ({relaciones.length})</div>
        <table className={UI.denseTable}>
          <thead>
            <tr>
              <th className={UI.denseTh}>Documento</th>
              <th className={UI.denseTh}>Razón</th>
              <th className={`${UI.denseTh} text-right`}>Monto USD</th>
              <th className={`${UI.denseTh} text-center`}>Retacear</th>
              <th className={UI.denseTh}>Comentarios</th>
              <th className={UI.denseTh} />
            </tr>
          </thead>
          <tbody>
            {relaciones.length === 0 ? (
              <tr>
                <td colSpan={6} className={`${UI.denseTd} py-6 text-center text-muted-foreground`}>
                  Sin documentos vinculados.
                </td>
              </tr>
            ) : (
              relaciones.map((r) => (
                <tr key={String(r.idrelacion)}>
                  <td className={UI.denseTd}>
                    {r.idcompra ? (
                      <Link href={`/dashboard/compras/ingreso?id=${r.idcompra}`} className="text-primary hover:underline">
                        {String(r.numero_sistema)}
                      </Link>
                    ) : r.iddocumento ? (
                      <Link href={`/dashboard/compras/documentos?id=${r.iddocumento}`} className="text-primary hover:underline">
                        {String(r.numero_sistema)}
                      </Link>
                    ) : (
                      String(r.ref_documento ?? '')
                    )}
                    {r.nodocto ? <span className={`${UI.denseMono} ml-1 text-muted-foreground`}>#{String(r.nodocto)}</span> : null}
                    {Number(r.total_xcomprobar) > 0 && (
                      <span className="ml-1 text-[10px] text-amber-600 dark:text-amber-400" title="Cuenta ajena excluida del monto">
                        (cta. ajena {fmt(r.total_xcomprobar)})
                      </span>
                    )}
                  </td>
                  <td className={UI.denseTd}>
                    <span className="inline-flex items-center gap-1">
                      {String(r.razon_vinculo)}
                      {Boolean(r.idcompra || r.iddocumento || r.nodocto) && (
                        <button type="button" className="p-0.5 text-muted-foreground hover:text-primary" aria-label="Ver documento" onClick={() => setViendo(r)}>
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </span>
                  </td>
                  <td className={UI.denseTd}>
                    <InputBlur
                      tipo="number"
                      valor={r.total_usd}
                      disabled={!editable}
                      className="w-28"
                      onGuardar={(v) => actualizarRelacion(Number(r.idrelacion), { total_usd: v })}
                    />
                  </td>
                  <td className={`${UI.denseTd} text-center`}>
                    <input
                      type="checkbox"
                      checked={Number(r.incluir_retaceo) === 1}
                      disabled={!editable}
                      onChange={(e) => actualizarRelacion(Number(r.idrelacion), { incluir_retaceo: e.target.checked })}
                    />
                  </td>
                  <td className={UI.denseTd}>
                    <InputBlur
                      valor={r.comentarios}
                      disabled={!editable}
                      className="w-56"
                      onGuardar={(v) => actualizarRelacion(Number(r.idrelacion), { comentarios: v })}
                    />
                  </td>
                  <td className={UI.denseTd}>
                    {editable && (
                      <button
                        type="button"
                        className="p-1 text-muted-foreground hover:text-red-600"
                        aria-label="Desvincular"
                        onClick={async () => (await confirmar('¿Quitar este vínculo?')) && accion({ accion: 'desvincular', idrelacion: r.idrelacion })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="grid gap-2 xl:grid-cols-2">
        <div className={`${UI.densePanel} overflow-auto`}>
          <div className={`${UI.densePanelTitle} flex items-center justify-between`}>
            <span>Facturas del proceso ({facturas.length})</span>
            {editable && (
              <button
                type="button"
                className={UI.denseBtn}
                disabled={!hayProforma}
                title={hayProforma ? 'Crear la factura desde la proforma' : 'El proceso no tiene proforma ni orden de compra'}
                onClick={() => setFacturando(true)}
              >
                <FilePlus2 className="h-3.5 w-3.5" /> Ingresar factura
              </button>
            )}
          </div>
          <table className={UI.denseTable}>
            <thead>
              <tr>
                <th className={UI.denseTh}>Número</th>
                <th className={UI.denseTh}>Proveedor</th>
                <th className={UI.denseTh}>Estado</th>
                <th className={`${UI.denseTh} text-right`}>Líneas</th>
                <th className={`${UI.denseTh} text-right`}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {facturas.map((f) => (
                <tr key={String(f.idcompra)}>
                  <td className={UI.denseTd}>
                    <Link href={`/dashboard/compras/ingreso?id=${f.idcompra}`} className="text-primary hover:underline">
                      {String(f.numero_factura || f.numero_interno || f.idcompra)}
                    </Link>
                  </td>
                  <td className={`${UI.denseTd} max-w-[12rem] truncate`}>{String(f.proveedor_nombre ?? '—')}</td>
                  <td className={UI.denseTd}>{String(f.estado)}</td>
                  <td className={`${UI.denseTd} text-right`}>{String(f.total_lineas)}</td>
                  <td className={`${UI.denseTd} ${UI.denseMono} text-right`}>{fmt(f.sub_total)}</td>
                </tr>
              ))}
              {facturas.length === 0 && (
                <tr>
                  <td colSpan={5} className={`${UI.denseTd} py-4 text-center text-muted-foreground`}>
                    Vincule la factura de importación con razón FACTURA.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className={`${UI.densePanel} overflow-auto`}>
          <div className={UI.densePanelTitle}>Solicitudes, cotizaciones, órdenes y proformas ({documentos.length})</div>
          <table className={UI.denseTable}>
            <thead>
              <tr>
                <th className={UI.denseTh}>Número</th>
                <th className={UI.denseTh}>Estado</th>
                <th className={`${UI.denseTh} text-right`}>Total</th>
                <th className={`${UI.denseTh} text-right`}>USD</th>
              </tr>
            </thead>
            <tbody>
              {documentos.map((d) => (
                <tr key={String(d.iddocumento)}>
                  <td className={UI.denseTd}>
                    <Link href={`/dashboard/compras/documentos?id=${d.iddocumento}`} className="text-primary hover:underline">
                      {String(d.id_documento)}
                    </Link>
                  </td>
                  <td className={UI.denseTd}>{String(d.estado_documento)}</td>
                  <td className={`${UI.denseTd} ${UI.denseMono} text-right`}>
                    {String(d.moneda_documento)} {fmt(d.total_moneda)}
                  </td>
                  <td className={`${UI.denseTd} ${UI.denseMono} text-right`}>{fmt(d.total_usd)}</td>
                </tr>
              ))}
              {documentos.length === 0 && (
                <tr>
                  <td colSpan={4} className={`${UI.denseTd} py-4 text-center text-muted-foreground`}>
                    Al vincular una cotización u orden, entra toda su cadena.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {viendo && <DialogoDocumento relacion={viendo} onCerrar={() => setViendo(null)} />}
      {facturando && <DialogoFactura detalle={detalle} onCerrar={() => setFacturando(false)} onError={onError} />}
    </div>
  );
}
