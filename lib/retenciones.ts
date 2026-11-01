// Retenciones y percepciones sugeridas según quién compra (empresa) y a quién (proveedor).
// Por ahora es la "mecha": devuelve las reglas generales del Art. 162 y 163 del Código Tributario
// solo si la empresa está marcada como agente de retención. Una empresa con categoría OTRO
// (como el taller del cliente) no retiene nada y el usuario puede digitar el valor a mano.

import { IVA_TASA } from '@/lib/compras-detalle';
import { r8 } from '@/lib/decimales';
import type { CategoriaContribuyente, Empresa } from '@/lib/empresa';

export const TASA_RETENCION_IVA = 0.01;
/** Monto mínimo (sin IVA) desde el que aplica la retención del 1 %. */
export const MINIMO_RETENCION_IVA = 100;

export interface MontosRetencion {
  /** Total gravado sin IVA. */
  gravado: number;
}

export interface Retenciones {
  iva_retenido: number;
  iva_percibido: number;
  retencion_renta: number;
  /** Explicación corta de por qué se sugiere (o no) cada valor. */
  motivo: string;
}

const RANGO: Record<CategoriaContribuyente, number> = { GRAN_CONTRIBUYENTE: 3, CONTRIBUYENTE: 2, PEQUENO: 1, OTRO: 0 };

export function sugerirRetenciones(
  empresa: Pick<Empresa, 'categoria_contribuyente' | 'agente_retencion'>,
  proveedor: { categoria_contribuyente?: CategoriaContribuyente | null } | null,
  montos: MontosRetencion
): Retenciones {
  const ninguna = (motivo: string): Retenciones => ({ iva_retenido: 0, iva_percibido: 0, retencion_renta: 0, motivo });
  if (!Number(empresa.agente_retencion)) return ninguna('La empresa no está designada como agente de retención');
  const catProveedor = proveedor?.categoria_contribuyente ?? 'CONTRIBUYENTE';
  if (RANGO[catProveedor] >= RANGO[empresa.categoria_contribuyente]) {
    return ninguna('El proveedor es de igual o mayor categoría: no se le retiene');
  }
  if (montos.gravado < MINIMO_RETENCION_IVA) return ninguna(`Gravado menor a $${MINIMO_RETENCION_IVA}`);
  return {
    iva_retenido: r8(montos.gravado * TASA_RETENCION_IVA),
    iva_percibido: 0,
    retencion_renta: 0,
    motivo: `1 % sobre $${montos.gravado.toFixed(2)} gravado (IVA ${IVA_TASA * 100} % no incluido)`,
  };
}
