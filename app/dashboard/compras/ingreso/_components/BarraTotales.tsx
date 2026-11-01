'use client';

import { UI } from '@/lib/ui';
import { r8 } from '@/lib/decimales';
import { signoDocumento } from '@/lib/compras-constantes';
import type { CompraCtx } from './useCompra';
import { fmt2 } from './tipos';

function Dato({ etiqueta, valor, aviso = false, title }: { etiqueta: string; valor: string; aviso?: boolean; title?: string }) {
  return (
    <div className="flex flex-col items-end min-w-[3.5rem]" title={title}>
      <span className={UI.denseLabel}>{etiqueta}</span>
      <span className={`${UI.denseMono} text-xs leading-5 ${aviso ? 'text-amber-700 dark:text-amber-400' : 'text-foreground'}`}>
        {valor}
      </span>
    </div>
  );
}

function Retencion({ etiqueta, valor, disabled, onChange }: { etiqueta: string; valor: number; disabled: boolean; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col items-end">
      <span className={UI.denseLabel}>{etiqueta}</span>
      <input
        type="number"
        step="0.01"
        min={0}
        className={`${UI.denseInput} ${UI.denseMono} h-6 w-20 text-right`}
        disabled={disabled}
        value={Number(valor) || ''}
        placeholder="0.00"
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </label>
  );
}

/** Totalizador con el orden del sistema del cliente: sumas, descuento, subtotal, IVA, retenciones, cuenta ajena, no sujetas, exentas. */
export function BarraTotales({ ctx }: { ctx: CompraCtx }) {
  const { compra, resumen, esBorrador } = ctx;
  const r = resumen;
  const bloqueado = !compra || !esBorrador;
  const descuento = r?.total_descuento ?? 0;
  const subtotal = r ? r8(r.total_gravado - r.descuento_global_gravado) : 0;
  const sumas = r8(subtotal + descuento);
  const cuentaAjena = r8((r?.total_xcomprobar ?? 0) + (r?.total_cargos_no_afectos ?? 0));
  const compraTotal = r?.total_pagar ?? 0;
  const ivaRecuperable = compra?.tipo_dte === '03' ? (r?.iva ?? 0) : 0;
  const inversion = r8(compraTotal - ivaRecuperable - (r?.iva_percibido ?? 0) + (r?.iva_retenido ?? 0) + (r?.retencion_renta ?? 0));

  return (
    <div className={`${UI.densePanel} px-3 py-1.5 shadow-[0_-6px_16px_rgba(15,23,42,0.08)] dark:shadow-[0_-8px_20px_rgba(0,0,0,0.45)]`}>
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0 flex flex-wrap items-end gap-x-3 gap-y-1">
          <Dato etiqueta="Sumas" valor={fmt2(sumas)} title="Gravado antes del descuento" />
          <Dato etiqueta="Descuento" valor={fmt2(descuento)} />
          <label
            className="flex flex-col items-start"
            title="Informativo: el costo que entra a inventario es el de antes del descuento. Baja el costo: entra el neto. Los totales fiscales siempre restan el descuento."
          >
            <span className={UI.denseLabel}>El descuento</span>
            <select
              className={`${UI.denseSelect} h-6 text-xs`}
              disabled={bloqueado}
              value={Number(compra?.descuento_afecta_costo) ? '1' : '0'}
              onChange={(e) => ctx.patch({ descuento_afecta_costo: Number(e.target.value) })}
            >
              <option value="0">Es informativo</option>
              <option value="1">Baja el costo</option>
            </select>
          </label>
          <Dato etiqueta="Subtotal" valor={fmt2(subtotal)} />
          <Dato etiqueta="IVA 13%" valor={fmt2(r?.iva)} />
          {(r?.otros_tributos ?? 0) > 0 && (
            <Dato etiqueta="Otros tributos" valor={fmt2(r?.otros_tributos)} title="Tributos del DTE distintos del IVA (FOVIAL, COTRANS...)" />
          )}

          <div className="h-8 w-px bg-border self-center hidden xl:block" />

          <button
            type="button"
            className={`${UI.denseBtn} h-6 self-end text-[11px]`}
            disabled={bloqueado}
            onClick={ctx.sugerirRetenciones}
            title="Calcula las retenciones según la categoría de la empresa y del proveedor (Configuración > Empresa)"
          >
            Sugerir
          </button>

          <Retencion
            etiqueta="IVA percibido"
            valor={Number(compra?.iva_percibido) || 0}
            disabled={bloqueado}
            onChange={(v) => ctx.patch({ iva_percibido: v })}
          />
          <Retencion
            etiqueta="IVA retenido"
            valor={Number(compra?.iva_retenido) || 0}
            disabled={bloqueado}
            onChange={(v) => ctx.patch({ iva_retenido: v })}
          />
          <Retencion
            etiqueta="Renta retenida"
            valor={Number(compra?.retencion_renta) || 0}
            disabled={bloqueado}
            onChange={(v) => ctx.patch({ retencion_renta: v })}
          />

          <div className="h-8 w-px bg-border self-center hidden xl:block" />

          <Dato etiqueta="Cuenta ajena" valor={fmt2(cuentaAjena)} aviso={cuentaAjena > 0} title="X comprobar más cargos que no afectan la base" />
          <Dato etiqueta="No sujetas" valor={fmt2(r?.total_no_sujeto)} />
          <Dato etiqueta="Exentas" valor={fmt2(r?.total_exento)} />
        </div>

        <div className="shrink-0 flex items-end gap-2">
          {ctx.esNcNd && (
            <span
              className={`self-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                signoDocumento(compra?.tipo_dte) < 0
                  ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'
                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
              }`}
              title="Efecto sobre el saldo con el proveedor"
            >
              {signoDocumento(compra?.tipo_dte) < 0 ? 'Resta al saldo' : 'Suma al saldo'}
            </span>
          )}
          <div
            className="flex flex-col items-end rounded-md border border-border px-2.5 py-0.5"
            title={compra?.tipo_dte === '03' ? 'Compra total sin el IVA acreditable ni las retenciones' : 'Compra total sin retenciones (el IVA no es acreditable)'}
          >
            <span className={UI.denseLabel}>Total inversión</span>
            <span className={`${UI.denseMono} text-sm font-semibold`}>${fmt2(inversion)}</span>
          </div>
          <div className="flex flex-col items-end rounded-md border border-primary/40 bg-primary/10 px-2.5 py-0.5">
            <span className={`${UI.denseLabel} text-primary`}>Compra total</span>
            <span className={`${UI.denseMono} text-base font-bold text-primary`}>${fmt2(compraTotal)}</span>
          </div>
        </div>
      </div>

      <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-muted-foreground [@media(max-height:560px)]:hidden">
        <span className="truncate italic">{r?.valor_en_letras || '—'}</span>
        <span className="shrink-0">
          <kbd className="px-1 rounded border border-border bg-muted font-mono">Ctrl+S</kbd> Guardar
        </span>
      </div>
    </div>
  );
}
