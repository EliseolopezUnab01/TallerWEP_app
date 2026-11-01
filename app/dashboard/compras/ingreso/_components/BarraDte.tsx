'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Ban, CheckCircle2, FilePlus2, FolderOpen, Save, Trash2, XCircle } from 'lucide-react';
import { UI } from '@/lib/ui';
import { AVISOS_COMPRA, CATEGORIAS_OPERACION, destinoPermitido, type CategoriaOperacion } from '@/lib/compras-constantes';
import type { CompraCtx } from './useCompra';
import { CODIGO_IMPORTACION, DOCUMENTOS_CLIENTE, codigoDocumento, documentoCliente, fechaInput } from './tipos';

/** Control 3: avisa si el reloj de esta PC no coincide con la hora de referencia. */
function useDesfaseReloj() {
  const [desfase, setDesfase] = useState<{ minutos: number; referencia: string } | null>(null);
  useEffect(() => {
    let vigente = true;
    const zona = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/El_Salvador';
    fetch(`/api/server-time?timezone=${encodeURIComponent(zona)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!vigente || !data.success) return;
        const minutos = Math.round((Date.now() - Number(data.serverTime.timestamp)) / 60000);
        if (Math.abs(minutos) > Number(data.maxToleranceMinutes || 5)) {
          setDesfase({ minutos, referencia: data.serverTime.formatted });
        }
      })
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, []);
  return desfase;
}

const ESTILO_ESTADO: Record<string, string> = {
  BORRADOR: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
  REGISTRADA: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
  ANULADA: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30',
  INVALIDADO: 'bg-slate-200 text-slate-700 border-slate-400 dark:bg-slate-500/20 dark:text-slate-300 dark:border-slate-500/40 line-through',
};

const btnIcono =
  'h-8 w-8 inline-flex items-center justify-center rounded-md border transition-colors disabled:opacity-40 disabled:pointer-events-none';

function Campo({ etiqueta, children, className = '' }: { etiqueta: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`flex items-center gap-2 min-w-0 ${className}`}>
      <span className={UI.denseLabel}>{etiqueta}</span>
      {children}
    </label>
  );
}

export function BarraDte({ ctx, onAbrir }: { ctx: CompraCtx; onAbrir: () => void }) {
  const { compra, esBorrador, esImportacion, ocupado, sucio } = ctx;
  const bloqueado = !compra || !esBorrador;
  const doc = documentoCliente(codigoDocumento(compra));
  const desfase = useDesfaseReloj();

  /** Líneas que la nueva combinación no admite; el cambio se rechaza en lugar de mover las líneas. */
  const lineasEnConflicto = (categoria: string, importacion: boolean) =>
    ctx.lineas.filter(
      (l) => l.destino && (!destinoPermitido(categoria, l.destino) || (importacion && l.destino === 'EXPRESS'))
    );

  const avisarConflicto = (conflicto: { numero_linea: number }[], que: string) => {
    ctx.notificar(
      'error',
      `${que} no admite la(s) línea(s) ${conflicto.map((l) => l.numero_linea).join(', ')}. Cámbielas o elimínelas primero.`
    );
  };

  const cambiarCategoria = (categoria: CategoriaOperacion) => {
    const conflicto = lineasEnConflicto(categoria, esImportacion);
    if (conflicto.length) {
      avisarConflicto(conflicto, `La categoría ${CATEGORIAS_OPERACION.find((c) => c.valor === categoria)?.etiqueta}`);
      return;
    }
    if (ctx.lineas.length && !confirm(AVISOS_COMPRA.confirmarCambios)) return;
    ctx.patch({ categoria_operacion: categoria });
  };

  const cambiarDocumento = (valor: string) => {
    if (valor === CODIGO_IMPORTACION) {
      const conflicto = lineasEnConflicto(compra?.categoria_operacion || 'CONTABLE', true);
      if (conflicto.length) {
        avisarConflicto(conflicto, 'Una importación');
        return;
      }
      ctx.patch({ clase_documento: 'IMPORTACION', tipo_dte: null, numero_control: null, sello_recepcion: null });
    } else {
      ctx.patch({ clase_documento: 'DTE', tipo_dte: valor });
    }
  };

  return (
    <div className={`${UI.densePanel} px-3 py-2 space-y-2`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={UI.denseLabel}>Documento</span>
          <span className={`text-base font-bold uppercase tracking-wide whitespace-nowrap ${doc?.color || 'text-muted-foreground'}`}>
            {doc?.nombre || 'Sin tipo'}
          </span>
          <select
            aria-label="Tipo de documento"
            className={`${UI.denseSelect} w-40`}
            disabled={bloqueado}
            value={codigoDocumento(compra)}
            onChange={(e) => cambiarDocumento(e.target.value)}
          >
            {DOCUMENTOS_CLIENTE.map((d) =>
              d.codigo ? (
                <option key={d.nombre} value={d.codigo}>
                  {d.nombre} · {d.codigo === CODIGO_IMPORTACION ? d.abrev : `${d.codigo} ${d.abrev}`}
                </option>
              ) : (
                <option key={d.nombre} value={`pendiente-${d.nombre}`} disabled>
                  {d.nombre} (pendiente)
                </option>
              )
            )}
          </select>
        </div>

        <Campo etiqueta="Categoría">
          <select
            aria-label="Categoría del documento"
            className={`${UI.denseSelect} w-28`}
            disabled={bloqueado}
            value={compra?.categoria_operacion || 'CONTABLE'}
            title={CATEGORIAS_OPERACION.find((c) => c.valor === compra?.categoria_operacion)?.ayuda}
            onChange={(e) => cambiarCategoria(e.target.value as CategoriaOperacion)}
          >
            {CATEGORIAS_OPERACION.map((c) => (
              <option key={c.valor} value={c.valor} title={c.ayuda}>{c.etiqueta}</option>
            ))}
          </select>
        </Campo>

        <Campo etiqueta="Fecha">
          <input
            type="date"
            className={`${UI.denseInput} w-32`}
            disabled={bloqueado}
            value={fechaInput(compra?.fecha_emision)}
            onChange={(e) => ctx.patch({ fecha_emision: e.target.value || null })}
          />
        </Campo>

        <Campo etiqueta="Cargar a cuenta" className={UI.densePending}>
          <select
            className={`${UI.denseSelect} w-32`}
            disabled
            title="Bancos / cajas chicas: pendiente de definición con el cliente (B9)"
          >
            <option>Pendiente</option>
          </select>
        </Campo>

        {desfase && (
          <span
            role="alert"
            className="h-7 px-2 inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300 text-[11px]"
            title={`Hora de referencia: ${desfase.referencia}`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Revise la fecha de esta PC ({desfase.minutos > 0 ? '+' : ''}{desfase.minutos} min)
          </span>
        )}

        <div className="flex items-center gap-2">
          <span className={UI.denseLabel} title={compra?.nodocto ? `Nodocto ${compra.nodocto}` : undefined}>
            {compra ? compra.numero_interno || `Compra #${compra.idcompra}` : 'Sin compra'}
          </span>
          <span
            className={`h-7 px-2 inline-flex items-center rounded-md border text-[11px] font-semibold tracking-wide ${
              compra ? ESTILO_ESTADO[compra.estado] || '' : 'border-border text-muted-foreground'
            }`}
          >
            {compra?.estado || '—'}
            {sucio && <span className="ml-1 text-[10px] font-normal opacity-80">· sin guardar</span>}
          </span>
        </div>

        <div className="flex items-center gap-1 ml-auto">
          <button
            type="button"
            className={`${btnIcono} border-border bg-card text-foreground hover:bg-muted`}
            onClick={ctx.crear}
            title="Nueva compra"
            aria-label="Nueva compra"
          >
            <FilePlus2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            className={`${btnIcono} border-border bg-card text-foreground hover:bg-muted`}
            onClick={onAbrir}
            title="Abrir compra existente"
            aria-label="Abrir compra"
          >
            <FolderOpen className="w-4 h-4" />
          </button>
          <button
            type="button"
            className={`${btnIcono} border-border bg-card text-foreground hover:bg-muted`}
            disabled={bloqueado || ocupado}
            onClick={ctx.guardar}
            title="Guardar encabezado (Ctrl+S)"
            aria-label="Guardar"
          >
            <Save className="w-4 h-4" />
          </button>
          <button
            type="button"
            className={`${btnIcono} border-emerald-400 dark:border-emerald-500/50 bg-emerald-500 text-white hover:bg-emerald-600`}
            disabled={bloqueado || ocupado}
            onClick={() => {
              if (confirm('¿Registrar esta compra? Ya no se podrá editar.')) ctx.registrar();
            }}
            title="Finalizar / registrar documento (F2)"
            aria-label="Registrar"
          >
            <CheckCircle2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            className={`${btnIcono} border-red-300 dark:border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10`}
            disabled={compra?.estado !== 'REGISTRADA' || ocupado}
            onClick={() => {
              if (confirm('¿Anular esta compra registrada?')) ctx.anular();
            }}
            title="Anular documento (F4)"
            aria-label="Anular"
          >
            <XCircle className="w-4 h-4" />
          </button>
          <button
            type="button"
            className={`${btnIcono} border-slate-300 dark:border-slate-500/40 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-500/10`}
            disabled={
              !compra ||
              esImportacion ||
              !compra.codigo_generacion ||
              !['BORRADOR', 'REGISTRADA'].includes(compra.estado) ||
              ocupado
            }
            onClick={() => {
              const motivo = prompt('El proveedor invalidó este DTE ante Hacienda. Motivo de la invalidación:');
              if (motivo && motivo.trim()) ctx.invalidar(motivo.trim());
            }}
            title={
              compra?.estado === 'INVALIDADO'
                ? `Invalidado por el emisor${compra.motivo_invalidacion ? `: ${compra.motivo_invalidacion}` : ''}`
                : 'Marcar como invalidado por el emisor (no cuenta para stock ni libros)'
            }
            aria-label="Marcar invalidado"
          >
            <Ban className="w-4 h-4" />
          </button>
          <button
            type="button"
            className={`${btnIcono} border-red-300 dark:border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10`}
            disabled={!esBorrador || ocupado}
            onClick={ctx.eliminarBorrador}
            title="Eliminar borrador"
            aria-label="Eliminar borrador"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid gap-x-4 gap-y-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.2fr)]">
        <Campo etiqueta="No. de control">
          <input
            className={`${UI.denseInput} ${UI.denseMono} flex-1 min-w-0`}
            disabled={bloqueado || esImportacion}
            title={esImportacion ? 'La factura de importación no es un DTE' : undefined}
            maxLength={31}
            placeholder="DTE-03-XXXXXXXX-000000000000001"
            value={compra?.numero_control || ''}
            onChange={(e) => ctx.patch({ numero_control: e.target.value.toUpperCase() })}
          />
        </Campo>
        <Campo etiqueta="Código de generación">
          <input
            className={`${UI.denseInput} ${UI.denseMono} flex-1 min-w-0`}
            disabled={bloqueado || esImportacion}
            maxLength={36}
            placeholder="UUID"
            value={compra?.codigo_generacion || ''}
            onChange={(e) => ctx.patch({ codigo_generacion: e.target.value.toUpperCase() })}
          />
        </Campo>
        <Campo etiqueta="Sello de recepción">
          <input
            className={`${UI.denseInput} ${UI.denseMono} flex-1 min-w-0`}
            disabled={bloqueado || esImportacion}
            maxLength={40}
            value={compra?.sello_recepcion || ''}
            onChange={(e) => ctx.patch({ sello_recepcion: e.target.value.toUpperCase() })}
          />
        </Campo>
      </div>
    </div>
  );
}
