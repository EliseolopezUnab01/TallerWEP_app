import { IVA_TASA, type CondicionIva } from '@/lib/compras-detalle';
import { esTipoDteCompra } from '@/lib/compras-constantes';
import { r8 } from '@/lib/decimales';

export interface LineaDte {
  numItem: number;
  cantidad: number;
  codigo: string | null;
  descripcion: string;
  costo_unitario: number;
  condicion_iva: CondicionIva;
  total: number;
}

export interface ApendiceDte {
  campo: string;
  etiqueta: string;
  valor: string;
  monto: number | null;
}

export interface DteParseado {
  tipo_dte: string;
  version: number | null;
  numero_control: string | null;
  codigo_generacion: string | null;
  sello_recepcion: string | null;
  fecha_emision: string | null;
  emisor: { nit: string | null; nrc: string | null; nombre: string };
  receptor: { nit: string | null; nrc: string | null; nombre: string };
  /** Null si el JSON no la trae: el usuario debe elegirla antes de registrar. */
  condicion_operacion: number | null;
  iva_retenido: number;
  iva_percibido: number;
  retencion_renta: number;
  lineas: LineaDte[];
  pagos: { codigo: string; monto: number; referencia: string | null; plazo: string | null; periodo: number | null }[];
  documentos_rel: { tipo: string; generacion: number; numero: string; fecha: string }[];
  apendice: ApendiceDte[];
  observaciones: string | null;
  total_pagar: number;
  monto_total_operacion: number;
  total_no_gravado: number;
}

type Obj = Record<string, unknown>;

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const txt = (v: unknown) => {
  if (v === undefined || v === null) return null;
  const t = String(v).trim();
  return t === '' ? null : t;
};
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});
const arr = (v: unknown): Obj[] => (Array.isArray(v) ? v.map(obj) : []);
/** Solo dígitos: el NIT/NRC llega con o sin guiones según el emisor. */
export const soloDigitos = (v: string | null | undefined) => (v ? v.replace(/\D/g, '') : '');

/** Monto en un texto libre del apéndice ("86.43", "$ 1,250.00"); null si no hay número. */
export function montoDeTexto(valor: string): number | null {
  const m = valor.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

/**
 * Convierte el JSON de un DTE de compra (esquemas MH 01, 03, 05, 06, 14) a los
 * datos que usa el ingreso de compras. Lanza Error con un mensaje para el usuario.
 */
export function parsearDte(entrada: unknown): DteParseado {
  const raiz = obj(entrada);
  const ident = obj(raiz.identificacion);
  const tipo = txt(ident.tipoDte);
  if (!tipo) throw new Error('El archivo no parece un DTE: falta identificacion.tipoDte');
  if (!esTipoDteCompra(tipo)) throw new Error(`El tipo de DTE ${tipo} no corresponde a una compra`);

  const esSujetoExcluido = tipo === '14';
  const emisorJson = obj(esSujetoExcluido ? raiz.sujetoExcluido : raiz.emisor);
  const receptorJson = obj(esSujetoExcluido ? raiz.emisor : raiz.receptor);
  const resumen = obj(raiz.resumen);

  const lineas: LineaDte[] = [];
  for (const item of arr(raiz.cuerpoDocumento)) {
    const cantidad = num(item.cantidad) || 1;
    const descripcion = txt(item.descripcion) || `Ítem ${num(item.numItem)}`;
    const codigo = txt(item.codigo);
    const base = { numItem: num(item.numItem), cantidad, codigo, descripcion };

    const tramos: [CondicionIva, number][] = esSujetoExcluido
      ? [['NO_SUJETO', num(item.compra)]]
      : [
          ['GRAVADA', num(item.ventaGravada)],
          ['EXENTO', num(item.ventaExenta)],
          ['NO_SUJETO', num(item.ventaNoSuj)],
        ];
    let agregado = false;
    for (const [condicion, monto] of tramos) {
      if (!monto) continue;
      // En la factura (01) el precio gravado ya incluye IVA.
      const neto = tipo === '01' && condicion === 'GRAVADA' ? monto / (1 + IVA_TASA) : monto;
      lineas.push({ ...base, condicion_iva: condicion, costo_unitario: r8(neto / cantidad), total: monto });
      agregado = true;
    }
    const noGravado = num(item.noGravado);
    if (noGravado) {
      lineas.push({
        ...base,
        cantidad: 1,
        descripcion: `${descripcion} (cuenta ajena)`,
        condicion_iva: 'XCOMPROBAR',
        costo_unitario: r8(noGravado),
        total: noGravado,
      });
      agregado = true;
    }
    if (!agregado) {
      lineas.push({ ...base, condicion_iva: 'GRAVADA', costo_unitario: r8(num(item.precioUni)), total: 0 });
    }
  }

  const pagos = arr(resumen.pagos).map((p) => ({
    codigo: txt(p.codigo) || '01',
    monto: num(p.montoPago),
    referencia: txt(p.referencia),
    plazo: txt(p.plazo),
    periodo: p.periodo == null ? null : num(p.periodo),
  }));

  const documentos_rel = arr(raiz.documentoRelacionado).map((d) => ({
    tipo: txt(d.tipoDocumento) || '03',
    generacion: num(d.tipoGeneracion) || 2,
    numero: txt(d.numeroDocumento) || '',
    fecha: txt(d.fechaEmision) || txt(ident.fecEmi) || '',
  }));

  const apendice = arr(raiz.apendice).map((a) => {
    const valor = txt(a.valor) || '';
    return { campo: txt(a.campo) || '', etiqueta: txt(a.etiqueta) || '', valor, monto: montoDeTexto(valor) };
  });

  return {
    tipo_dte: tipo,
    version: ident.version == null ? null : num(ident.version),
    numero_control: txt(ident.numeroControl),
    codigo_generacion: txt(ident.codigoGeneracion),
    sello_recepcion: txt(raiz.selloRecepcion) || txt(raiz.selloRecibido) || txt(obj(raiz.responseMH).selloRecibido),
    fecha_emision: txt(ident.fecEmi),
    emisor: {
      nit: txt(emisorJson.nit) || txt(emisorJson.numDocumento),
      nrc: txt(emisorJson.nrc),
      nombre: txt(emisorJson.nombre) || '',
    },
    receptor: { nit: txt(receptorJson.nit), nrc: txt(receptorJson.nrc), nombre: txt(receptorJson.nombre) || '' },
    condicion_operacion: [1, 2, 3].includes(num(resumen.condicionOperacion)) ? num(resumen.condicionOperacion) : null,
    iva_retenido: num(resumen.ivaRete1 ?? resumen.ivaRete),
    iva_percibido: num(resumen.ivaPerci1 ?? resumen.ivaPerci),
    retencion_renta: num(resumen.reteRenta),
    lineas,
    pagos,
    documentos_rel,
    apendice,
    observaciones: txt(resumen.observaciones) || txt(obj(raiz.extension).observaciones),
    total_pagar: num(resumen.totalPagar),
    monto_total_operacion: num(resumen.montoTotalOperacion ?? resumen.totalCompra),
    total_no_gravado: num(resumen.totalNoGravado),
  };
}
