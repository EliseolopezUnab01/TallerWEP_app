export interface ProcesoEnCamino {
  idproceso: number;
  codigo: string;
  estado: string;
  cantidad: number;
  fecha: string | null;
}

export interface UltimaCompra {
  idcompra: number;
  fecha: string | null;
  factura: string | null;
  proveedor: string | null;
  cantidad: number;
  costo: number;
}

/** Respuesta de `/api/productos/disponibilidad` por producto. */
export interface Disponibilidad {
  contable: number;
  fisico: number;
  en_camino: number;
  fecha_estimada: string | null;
  procesos: ProcesoEnCamino[];
  ultima_compra: UltimaCompra | null;
}
