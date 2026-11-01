'use client';

import { forwardRef, useEffect, useState } from 'react';
import Link from 'next/link';
import { Link2, Plus, Search, X } from 'lucide-react';
import { UI } from '@/lib/ui';
import { CONDICIONES_OPERACION, PLAZOS, TIPOS_DTE_COMPRAS } from '@/lib/compras-constantes';
import type { CompraCtx } from './useCompra';
import { fechaInput, fmt2 } from './tipos';
import { PanelNota } from './PanelNota';

interface ProveedorHit {
  idproveedor: number;
  codigo: string;
  nombre_legal: string;
  alias: string | null;
  nit: string | null;
  nrc: string | null;
}

function Titulo({ texto, extra }: { texto: string; extra?: React.ReactNode }) {
  return (
    <div className={`${UI.densePanelTitle} flex items-center gap-2`}>
      <span>{texto}</span>
      {extra && <span className="ml-auto flex items-center gap-1 normal-case tracking-normal">{extra}</span>}
    </div>
  );
}

export const PanelProveedor = forwardRef<HTMLInputElement, { ctx: CompraCtx }>(function PanelProveedor(
  { ctx },
  refBusqueda
) {
  const { compra, esBorrador, esImportacion, esNcNd, docsRel, pagos, formasPago } = ctx;
  const bloqueado = !compra || !esBorrador;

  const [busqueda, setBusqueda] = useState('');
  const [hits, setHits] = useState<ProveedorHit[]>([]);
  const [editando, setEditando] = useState(false);
  const [formRel, setFormRel] = useState({
    tipo_dte_relacionado: '03',
    tipo_generacion: '2',
    numero_documento: '',
    fecha_generacion: '',
  });
  const [formPago, setFormPago] = useState({ codigo: '01', monto: '', referencia: '' });

  useEffect(() => {
    const q = busqueda.trim();
    if (q.length < 2) return;
    let vigente = true;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/proveedores?q=${encodeURIComponent(q)}&activo=true`);
        const data = await res.json();
        if (vigente && data.success) setHits((data.proveedores || []).slice(0, 10));
      } catch {
        if (vigente) setHits([]);
      }
    }, 250);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [busqueda]);

  const elegir = (p: ProveedorHit) => {
    ctx.patch({
      idproveedor: p.idproveedor,
      proveedor_codigo: p.codigo,
      proveedor_nombre: p.nombre_legal,
      proveedor_nrc: p.nrc,
      proveedor_nit: p.nit,
    });
    setBusqueda('');
    setEditando(false);
  };

  const cambiarCondicion = (valor: number) => {
    if (!compra) return;
    if (valor === 2) {
      ctx.patch({
        condicion_operacion: 2,
        plazo_tipo: compra.plazo_tipo || '01',
        plazo_periodo: compra.plazo_periodo || 30,
      });
    } else {
      ctx.patch({ condicion_operacion: valor, plazo_tipo: null, plazo_periodo: null });
    }
  };

  const agregarRel = async () => {
    const ok = await ctx.agregarDocRel({
      tipo_dte_relacionado: formRel.tipo_dte_relacionado,
      tipo_generacion: Number(formRel.tipo_generacion),
      numero_documento: formRel.numero_documento.trim(),
      fecha_generacion: formRel.fecha_generacion,
    });
    if (ok) setFormRel({ ...formRel, numero_documento: '', fecha_generacion: '' });
  };

  const agregarPago = async () => {
    const monto = Number(formPago.monto);
    if (!monto || monto <= 0) {
      ctx.notificar('error', 'Monto de pago inválido');
      return;
    }
    const ok = await ctx.agregarPago(formPago.codigo, monto, formPago.referencia.trim());
    if (ok) setFormPago({ ...formPago, monto: '', referencia: '' });
  };

  const hitsVisibles = editando && busqueda.trim().length >= 2 ? hits : [];
  const esCredito = Number(compra?.condicion_operacion) === 2;
  const faltanDocs = esNcNd && docsRel.length === 0;
  const textoProveedor = compra?.idproveedor ? `${compra.proveedor_codigo} · ${compra.proveedor_nombre}` : '';
  const totalPagos = pagos.reduce((s, p) => s + Number(p.monto || 0), 0);

  return (
    <div className="grid gap-2 content-start min-w-0 md:max-[1299px]:grid-cols-2">
      {/* 8–12: proveedor y condiciones */}
      <div className={UI.densePanel}>
        <Titulo texto="Proveedor y condiciones" />
        <div className="p-2.5 flex flex-col gap-1.5">
          <div className="grid grid-cols-[1fr_1fr] gap-2">
            <label className="flex items-center gap-1.5 min-w-0">
              <span className={UI.denseLabel}>Factura</span>
              <input
                className={`${UI.denseInput} ${UI.denseMono} flex-1 min-w-0`}
                disabled={bloqueado}
                maxLength={100}
                value={compra?.numero_factura || ''}
                onChange={(e) => ctx.patch({ numero_factura: e.target.value })}
              />
            </label>
            <label className="flex items-center gap-1.5 min-w-0">
              <span className={UI.denseLabel}>Contab.</span>
              <input
                className={`${UI.denseInput} ${UI.denseMono} flex-1 min-w-0`}
                disabled={bloqueado}
                maxLength={30}
                value={compra?.referencia_contable || ''}
                onChange={(e) => ctx.patch({ referencia_contable: e.target.value })}
              />
            </label>
          </div>

          <div className="grid grid-cols-[6rem_1fr] gap-2">
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className={UI.denseLabel}>Registro (NRC)</span>
              <div className={`${UI.denseInput} ${UI.denseMono} flex items-center bg-muted/40 truncate`} title={compra?.proveedor_nit ? `NIT ${compra.proveedor_nit}` : undefined}>
                {compra?.proveedor_nrc || '—'}
              </div>
            </div>
            <label className="flex flex-col gap-0.5 min-w-0">
              <span className={UI.denseLabel}>Nombre</span>
              <span className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input
                  ref={refBusqueda}
                  className={`${UI.denseInput} w-full pl-7`}
                  disabled={bloqueado}
                  placeholder="Alias, nombre, NIT, NRC o ID (F3)"
                  value={editando ? busqueda : textoProveedor}
                  title={textoProveedor || undefined}
                  onFocus={() => {
                    setBusqueda('');
                    setEditando(true);
                  }}
                  onBlur={() => setEditando(false)}
                  onChange={(e) => setBusqueda(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && hitsVisibles[0]) {
                      e.preventDefault();
                      elegir(hitsVisibles[0]);
                    }
                    if (e.key === 'Escape') e.currentTarget.blur();
                  }}
                />
                {hitsVisibles.length > 0 && (
                  <span className={`absolute z-30 mt-1 left-0 w-[min(28rem,90vw)] max-h-64 overflow-auto block ${UI.dropdown}`}>
                    {hitsVisibles.map((p) => (
                      <button
                        key={p.idproveedor}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => elegir(p)}
                        className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-muted flex gap-2 items-baseline"
                      >
                        <span className={`${UI.denseMono} text-primary w-14 shrink-0`}>{p.codigo}</span>
                        <span className="truncate flex-1">
                          {p.nombre_legal}
                          {p.alias && <span className="text-muted-foreground"> · {p.alias}</span>}
                        </span>
                        <span className={`${UI.denseMono} text-muted-foreground shrink-0`}>{p.nrc || p.nit || ''}</span>
                      </button>
                    ))}
                  </span>
                )}
              </span>
            </label>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1fr)] gap-2">
            <label className="flex flex-col gap-0.5 min-w-0">
              <span className={UI.denseLabel}>Condición</span>
              <select
                className={`${UI.denseSelect} w-full ${compra && !compra.condicion_operacion && !bloqueado ? 'border-amber-400 dark:border-amber-500/60' : ''}`}
                disabled={bloqueado}
                value={compra?.condicion_operacion ?? ''}
                title={compra && !compra.condicion_operacion ? 'Debe elegir la condición de compra' : undefined}
                onChange={(e) => cambiarCondicion(Number(e.target.value))}
              >
                <option value="" disabled>Elegir…</option>
                {CONDICIONES_OPERACION.map((c) => (
                  <option key={c.codigo} value={c.codigo}>{c.nombre}</option>
                ))}
              </select>
            </label>
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className={UI.denseLabel}>Plazo</span>
              <div className="flex gap-1">
                <input
                  type="number"
                  min={1}
                  aria-label="Plazo"
                  className={`${UI.denseInput} ${UI.denseMono} w-12 px-1.5`}
                  disabled={bloqueado || !esCredito}
                  value={esCredito ? compra?.plazo_periodo ?? '' : ''}
                  onChange={(e) => ctx.patch({ plazo_periodo: e.target.value ? Number(e.target.value) : null })}
                />
                <select
                  aria-label="Unidad de plazo"
                  className={`${UI.denseSelect} flex-1 min-w-0`}
                  disabled={bloqueado || !esCredito}
                  value={esCredito ? compra?.plazo_tipo || '01' : '01'}
                  onChange={(e) => ctx.patch({ plazo_tipo: e.target.value })}
                >
                  {PLAZOS.map((p) => (
                    <option key={p.codigo} value={p.codigo}>{p.nombre}</option>
                  ))}
                </select>
              </div>
            </div>
            <label className="flex flex-col gap-0.5 min-w-0">
              <span className={UI.denseLabel}>Fecha límite</span>
              <input
                className={`${UI.denseInput} ${UI.denseMono} w-full`}
                disabled
                value={esCredito ? fechaInput(compra?.fecha_vencimiento_pago) : ''}
                placeholder={esCredito ? '' : 'Contado'}
              />
            </label>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2">
            <label className="flex flex-col gap-0.5 min-w-0">
              <span className={UI.denseLabel}>Recepción</span>
              <input
                type="date"
                className={`${UI.denseInput} w-full`}
                disabled={bloqueado}
                value={fechaInput(compra?.fecha_recepcion)}
                onChange={(e) => ctx.patch({ fecha_recepcion: e.target.value || null })}
              />
            </label>
            <label className="flex flex-col gap-0.5 min-w-0">
              <span className={UI.denseLabel}>Notas</span>
              <input
                className={`${UI.denseInput} w-full`}
                disabled={bloqueado}
                placeholder="Observaciones internas"
                value={compra?.notas || ''}
                onChange={(e) => ctx.patch({ notas: e.target.value })}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Formas de pago del DTE (resumen.pagos) */}
      <div className={UI.densePanel}>
        <Titulo
          texto="Pagos del documento"
          extra={pagos.length > 0 ? <span className={`${UI.denseMono} text-[10px]`}>{fmt2(totalPagos)}</span> : null}
        />
        <div className="p-2 flex flex-col gap-1">
          {pagos.map((pago) => (
            <div key={pago.idpago} className="grid grid-cols-[1fr_5.5rem_auto] items-center gap-1">
              <span className="truncate text-xs" title={pago.referencia || undefined}>
                {pago.codigo_forma_pago} · {pago.forma_pago_nombre}
                {pago.referencia && <span className="text-muted-foreground"> · {pago.referencia}</span>}
              </span>
              <span className={`${UI.denseMono} text-xs text-right`}>{fmt2(pago.monto)}</span>
              <button
                type="button"
                disabled={!esBorrador}
                onClick={() => ctx.eliminarPago(pago.idpago)}
                className="w-5 text-muted-foreground hover:text-red-500 disabled:invisible"
                aria-label="Quitar pago"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {esBorrador && (
            <div className="grid grid-cols-[minmax(0,1.2fr)_5.5rem_minmax(0,0.8fr)_auto] items-center gap-1">
              <select
                aria-label="Forma de pago"
                className={`${UI.denseSelect} min-w-0`}
                value={formPago.codigo}
                onChange={(e) => setFormPago({ ...formPago, codigo: e.target.value })}
              >
                {formasPago.map((f) => (
                  <option key={f.codigo} value={f.codigo}>{f.codigo} · {f.nombre}</option>
                ))}
              </select>
              <input
                type="number"
                step="0.01"
                min={0}
                aria-label="Monto del pago"
                className={`${UI.denseInput} ${UI.denseMono} text-right min-w-0`}
                placeholder="0.00"
                value={formPago.monto}
                onChange={(e) => setFormPago({ ...formPago, monto: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    agregarPago();
                  }
                }}
              />
              <input
                aria-label="Referencia del pago"
                className={`${UI.denseInput} min-w-0`}
                placeholder="Ref."
                value={formPago.referencia}
                onChange={(e) => setFormPago({ ...formPago, referencia: e.target.value })}
              />
              <button type="button" onClick={agregarPago} className="w-5 text-muted-foreground hover:text-primary" aria-label="Agregar pago">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {!esBorrador && pagos.length === 0 && (
            <span className="text-[11px] text-muted-foreground">Sin formas de pago registradas.</span>
          )}
        </div>
      </div>

      {esImportacion ? (
        <div className={UI.densePanel}>
          <Titulo texto="Proceso de ingreso" />
          <div className="p-2.5 flex flex-col gap-1.5 text-xs">
            {compra?.idproceso ? (
              <Link href={`/dashboard/compras/procesos?id=${compra.idproceso}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                <Link2 className="w-3.5 h-3.5" />
                {compra.proceso_codigo || `Proceso #${compra.idproceso}`}
              </Link>
            ) : (
              <span className="text-muted-foreground">
                Esta factura aún no está en un proceso. BL, seguro, DUCA, gastos y retaceo se registran en{' '}
                <Link href="/dashboard/compras/procesos" className="text-primary hover:underline">Procesos de ingreso</Link>.
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className={UI.densePanel}>
          <Titulo
            texto="Documentos relacionados"
            extra={
              faltanDocs ? (
                <span className="text-[10px] font-medium text-amber-700 dark:text-amber-400">Falta documento relacionado</span>
              ) : null
            }
          />
          {esNcNd && <PanelNota ctx={ctx} />}
          <div className="p-2">
            <div className="rounded-md border border-border overflow-hidden">
              <div className="max-h-32 overflow-auto">
                <table className={UI.denseTable}>
                  <thead>
                    <tr>
                      <th className={UI.denseTh}>Ref. docum.{esNcNd && <span className="text-amber-600"> *</span>}</th>
                      <th className={UI.denseTh}>Fecha</th>
                      <th className={UI.denseTh}>Tipo</th>
                      <th className={UI.denseTh} />
                    </tr>
                  </thead>
                  <tbody>
                    {docsRel.map((d) => (
                      <tr key={d.idrelacion}>
                        <td className={`${UI.denseTd} ${UI.denseMono} max-w-[10rem] truncate`} title={d.numero_documento}>
                          {d.numero_documento}
                        </td>
                        <td className={UI.denseTd}>{fechaInput(d.fecha_generacion)}</td>
                        <td className={UI.denseTd}>
                          {d.abreviatura || d.tipo_dte_relacionado} · {Number(d.tipo_generacion) === 1 ? 'Fís.' : 'Elec.'}
                        </td>
                        <td className={`${UI.denseTd} text-right`}>
                          {esBorrador && (
                            <button
                              type="button"
                              onClick={() => ctx.eliminarDocRel(d.idrelacion)}
                              className="text-muted-foreground hover:text-red-500"
                              aria-label="Quitar documento"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {docsRel.length === 0 && (
                      <tr>
                        <td colSpan={4} className={`${UI.denseTd} text-center text-[11px] text-muted-foreground py-2`}>
                          {esNcNd ? 'Obligatorio: documento que modifica esta nota.' : 'Solo obligatorio para notas de crédito / débito.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {esBorrador && (
                <div className="grid grid-cols-[minmax(0,1fr)_7.5rem_4rem_4rem_auto] gap-1 p-1 border-t border-border bg-muted/30">
                  <input
                    aria-label="Número de documento relacionado"
                    className={`${UI.denseInput} ${UI.denseMono} min-w-0`}
                    placeholder="Código gen. / número"
                    value={formRel.numero_documento}
                    onChange={(e) => setFormRel({ ...formRel, numero_documento: e.target.value.toUpperCase() })}
                  />
                  <input
                    type="date"
                    aria-label="Fecha del documento relacionado"
                    className={UI.denseInput}
                    value={formRel.fecha_generacion}
                    onChange={(e) => setFormRel({ ...formRel, fecha_generacion: e.target.value })}
                  />
                  <select
                    aria-label="Tipo de documento relacionado"
                    className={UI.denseSelect}
                    value={formRel.tipo_dte_relacionado}
                    onChange={(e) => setFormRel({ ...formRel, tipo_dte_relacionado: e.target.value })}
                  >
                    {TIPOS_DTE_COMPRAS.map((t) => (
                      <option key={t.codigo} value={t.codigo}>{t.abrev}</option>
                    ))}
                  </select>
                  <select
                    aria-label="Tipo de generación"
                    className={UI.denseSelect}
                    value={formRel.tipo_generacion}
                    onChange={(e) => setFormRel({ ...formRel, tipo_generacion: e.target.value })}
                  >
                    <option value="2">Elec.</option>
                    <option value="1">Fís.</option>
                  </select>
                  <button type="button" className={`${UI.denseBtn} px-1.5`} onClick={agregarRel} aria-label="Agregar documento">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

