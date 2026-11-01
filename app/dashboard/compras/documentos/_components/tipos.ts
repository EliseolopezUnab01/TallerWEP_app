export interface DocumentoLista {
  iddocumento: number;
  nodocto: number;
  id_documento: string;
  tipo_documento: string;
  estado_documento: 'BORRADOR' | 'FINALIZADO' | 'ANULADO';
  fecha_documento: string;
  moneda_documento: string;
  total_moneda: number;
  total_usd: number;
  idproceso: number | null;
  proveedor_codigo: string | null;
  proveedor_nombre: string | null;
  total_lineas: number;
}

export interface Documento extends DocumentoLista {
  nodocto_origen: number | null;
  origen_numero: string | null;
  origen_id: number | null;
  proceso_codigo: string | null;
  categoria_operacion: 'CONTABLE' | 'EXPRES' | 'GASTOS' | 'OTRO';
  ambito_operacion: 'NACIONAL' | 'INTERNACIONAL';
  idproveedor: number | null;
  tipo_proveedor: string | null;
  idcontacto: number | null;
  contacto_nombre: string | null;
  comentarios: string | null;
  tipo_cambio: number;
  incoterm: string | null;
  fecha_est_entrega: string | null;
  condicion_pago: 'CONTADO' | 'CREDITO';
  acuerdo_pago: string | null;
  subtotal_moneda: number;
  subtotal_usd: number;
}

export interface LineaDocumento {
  iddetalle: number;
  linea_visual: number;
  idprod: number | null;
  idtemporal: number | null;
  iddetalle_origen: number | null;
  referencia_proveedor: string | null;
  oems: string | null;
  descripcion_articulo: string;
  cantidad: number;
  estatus_articulo: string;
  precio_moneda: number;
  precio_usd: number;
  precio_objetivo: number | null;
  fecha_est_produccion: string | null;
  fecha_est_entrega: string | null;
  comentario_usuario: string | null;
  comentario_proveedor: string | null;
  origen_producto: string | null;
  updated_at: string;
  producto_nombre: string | null;
  temporal_codigo: string | null;
  temporal_estado: string | null;
  temporal_imagenes: number;
}

export interface Derivado {
  iddocumento: number;
  id_documento: string;
  tipo_documento: string;
  estado_documento: string;
}

export interface Contacto {
  idcontacto: number;
  nombre: string | null;
  puesto_cargo: string | null;
}

export interface ProveedorHit {
  idproveedor: number;
  codigo: string;
  nombre_legal: string;
  alias: string | null;
  tipo_proveedor: 'LOCAL' | 'EXTRANJERO';
}

export const fechaInput = (v: string | null | undefined) => (v ? String(v).slice(0, 10) : '');

export const fmtMoneda = (n: number | string | null | undefined, dec = 2) =>
  Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });

export const COLOR_ESTADO: Record<string, string> = {
  BORRADOR: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  FINALIZADO: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  ANULADO: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
};
