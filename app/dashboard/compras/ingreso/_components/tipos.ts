export interface CompraLista {
  idcompra: number;
  nodocto: number | null;
  numero_interno: string | null;
  clase_documento: string;
  estado: string;
  tipo_dte: string | null;
  tipo_dte_abrev: string | null;
  idproveedor: number | null;
  proveedor_codigo: string | null;
  proveedor_nombre: string | null;
  numero_factura: string | null;
  fecha_emision: string | null;
  total_pagar: number;
  total_lineas: number;
  updated_at: string;
}

import type { CategoriaOperacion } from '@/lib/compras-constantes';

export interface Compra {
  idcompra: number;
  nodocto: number | null;
  numero_interno: string | null;
  estado: string;
  clase_documento: 'DTE' | 'IMPORTACION';
  categoria_operacion: CategoriaOperacion;
  idproceso: number | null;
  idcompra_origen: number | null;
  origen_numero?: string | null;
  stock_aplicado?: number;
  proceso_codigo?: string | null;
  tipo_dte: string | null;
  idproveedor: number | null;
  proveedor_codigo: string | null;
  proveedor_nombre: string | null;
  proveedor_nrc: string | null;
  proveedor_nit: string | null;
  notas: string | null;
  numero_control: string | null;
  codigo_generacion: string | null;
  sello_recepcion: string | null;
  numero_factura: string | null;
  referencia_contable: string | null;
  fecha_emision: string | null;
  fecha_recepcion: string | null;
  fecha_registro: string | null;
  descuento_global_gravado: number;
  descuento_global_exento: number;
  descuento_global_no_sujeto: number;
  porcentaje_descuento: number;
  /** 0: el descuento solo se informa; 1: baja el costo que va a inventario. */
  descuento_afecta_costo: number;
  iva_retenido: number;
  iva_percibido: number;
  retencion_renta: number;
  /** Tributos del DTE distintos del IVA, tal como vinieron en el JSON. */
  total_otros_tributos?: number;
  dte_ambiente?: string | null;
  dte_tipo_operacion?: number | null;
  motivo_invalidacion?: string | null;
  fecha_invalidacion?: string | null;
  condicion_operacion: number | null;
  plazo_tipo: string | null;
  plazo_periodo: number | null;
  fecha_vencimiento_pago: string | null;
  total_pagar: number;
  valor_en_letras: string | null;
}

export interface Linea {
  iddetalle: number;
  numero_linea: number;
  numero_orden: string | null;
  codigo_express: string | null;
  destino: string | null;
  idcatalogo: number | null;
  catalogo_nombre: string | null;
  idprod: number | null;
  producto_oe: string | null;
  producto_codigo?: string | null;
  iddetalle_origen: number | null;
  ajuste_precio?: number;
  referencia_proveedor: string | null;
  descripcion: string;
  cantidad: number;
  costo_unitario: number;
  descuento_porcentaje: number;
  subtotal_sin_iva: number;
  iva_unitario: number;
  subtotal_con_iva: number;
  exento_unitario: number;
  no_sujeto_unitario: number;
  condicion_iva: string;
  numero_documento_rel: string | null;
  codigo_tributo: string | null;
  cargos_no_afectos: number;
  imagen_url: string | null;
  imp_dai_unitario?: number | null;
  imp_gastos_unitario?: number | null;
  imp_costo_cif?: number | null;
  imp_subtotal_cif?: number | null;
  imp_partida?: string | null;
  imp_costo_local?: number | null;
}

export interface Pago {
  idpago: number;
  codigo_forma_pago: string;
  forma_pago_nombre: string;
  monto: number;
  referencia: string | null;
}

export interface DocRel {
  idrelacion: number;
  tipo_dte_relacionado: string;
  tipo_generacion: number;
  numero_documento: string;
  fecha_generacion: string;
  abreviatura: string | null;
}

export interface Rubro {
  idcatalogo: number;
  tipo: string;
  codigo: string;
  nombre: string;
}

export interface FormaPago {
  codigo: string;
  nombre: string;
}

export interface ProductoHit {
  idprod: number;
  nombre: string;
  OE: string | null;
  idprodprov: string | null;
  codigo_barras: string | null;
  marca: string | null;
  costo: number | null;
  stock_contable: number | null;
  porcentaje_dai?: number | null;
  codarancel?: number | string | null;
}

export interface FormLinea {
  iddetalle: number;
  numero_orden: string;
  destino: string;
  idcatalogo: string;
  idprod: string;
  referencia_proveedor: string;
  referencia_oem: string;
  descripcion: string;
  cantidad: string;
  costo_unitario: string;
  descuento_porcentaje: string;
  condicion_iva: string;
  numero_documento_rel: string;
  iva_incluido: boolean;
  codigo_express?: string;
  iddetalle_origen?: number | null;
}

export const formLineaVacia = (condicionIva = 'GRAVADA', destino = 'INVENTARIO'): FormLinea => ({
  iddetalle: 0,
  numero_orden: '',
  destino,
  idcatalogo: '',
  idprod: '',
  referencia_proveedor: '',
  referencia_oem: '',
  descripcion: '',
  cantidad: '1',
  costo_unitario: '',
  descuento_porcentaje: '0',
  condicion_iva: condicionIva,
  numero_documento_rel: '',
  iva_incluido: false,
});

/** Valor del combo 1 para la importación: no es un código DTE de Hacienda. */
export const CODIGO_IMPORTACION = 'IMP';

/** Control 1 del Word, con los nombres que usa el cliente. Sin código = aún no definido. */
export const DOCUMENTOS_CLIENTE: { codigo: string; nombre: string; abrev: string; color: string }[] = [
  { codigo: '03', nombre: 'Crédito Fiscal', abrev: 'CCFE', color: 'text-amber-600 dark:text-amber-400' },
  { codigo: '01', nombre: 'Consumidor Final', abrev: 'FE', color: 'text-sky-600 dark:text-sky-400' },
  { codigo: CODIGO_IMPORTACION, nombre: 'Importación', abrev: 'Sin DTE', color: 'text-orange-600 dark:text-orange-400' },
  { codigo: '05', nombre: 'Nota de Crédito', abrev: 'NCE', color: 'text-emerald-600 dark:text-emerald-400' },
  { codigo: '06', nombre: 'Nota de Débito', abrev: 'NDE', color: 'text-rose-600 dark:text-rose-400' },
  { codigo: '14', nombre: 'Sujeto Excluido', abrev: 'FSEE', color: 'text-violet-600 dark:text-violet-400' },
];

export function codigoDocumento(compra: Pick<Compra, 'clase_documento' | 'tipo_dte'> | null | undefined) {
  if (!compra) return '';
  return compra.clase_documento === 'IMPORTACION' ? CODIGO_IMPORTACION : compra.tipo_dte || '';
}

export function documentoCliente(codigo: string | null | undefined) {
  return DOCUMENTOS_CLIENTE.find((d) => d.codigo && d.codigo === codigo);
}

export const DESTINOS_UI = [
  { valor: 'INVENTARIO', etiqueta: 'Inventario' },
  { valor: 'EXPRESS', etiqueta: 'Express' },
  { valor: 'GASTOS', etiqueta: 'Gasto' },
  { valor: 'ACTIVOS', etiqueta: 'Activo' },
];

export const CONDICIONES_IVA_UI = [
  { valor: 'GRAVADA', etiqueta: 'Afectas' },
  { valor: 'EXENTO', etiqueta: 'Exentas' },
  { valor: 'NO_SUJETO', etiqueta: 'No sujetas' },
  { valor: 'XCOMPROBAR', etiqueta: 'X comprobar' },
];

export function fmt2(n: number | string | null | undefined) {
  return Number(n || 0).toFixed(2);
}

export function fmt4(n: number | string | null | undefined) {
  return Number(n || 0).toFixed(4);
}

export function fechaInput(valor: string | null | undefined) {
  if (!valor) return '';
  return String(valor).slice(0, 10);
}
