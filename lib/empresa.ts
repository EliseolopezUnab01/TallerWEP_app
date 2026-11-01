import type { RowDataPacket } from 'mysql2/promise';
import type { Conexion } from '@/lib/compras-detalle-db';

export type CategoriaContribuyente = 'GRAN_CONTRIBUYENTE' | 'CONTRIBUYENTE' | 'PEQUENO' | 'OTRO';

export interface Empresa {
  idempresa: number;
  nombre: string;
  nombre_comercial: string | null;
  nit: string | null;
  nrc: string | null;
  cod_actividad: string | null;
  desc_actividad: string | null;
  departamento: string | null;
  municipio: string | null;
  direccion: string | null;
  telefono: string | null;
  correo: string | null;
  categoria_contribuyente: CategoriaContribuyente;
  agente_retencion: number;
  descuento_modo: 'INFORMATIVO' | 'COSTO';
  dte_ambiente: '00' | '01';
  dte_usuario_api: string | null;
  tipo_establecimiento: string;
  cod_estable_mh: string | null;
  cod_estable: string | null;
  cod_punto_venta_mh: string | null;
  cod_punto_venta: string | null;
  prefijo_control: string;
  responsable_nombre: string | null;
  responsable_tipo_doc: string | null;
  responsable_num_doc: string | null;
}

/** Campos que se pueden editar desde Configuración > Empresa. */
export const CAMPOS_EMPRESA = [
  'nombre', 'nombre_comercial', 'nit', 'nrc', 'cod_actividad', 'desc_actividad', 'departamento', 'municipio',
  'direccion', 'telefono', 'correo', 'categoria_contribuyente', 'agente_retencion', 'descuento_modo',
  'dte_ambiente', 'dte_usuario_api', 'tipo_establecimiento', 'cod_estable_mh', 'cod_estable',
  'cod_punto_venta_mh', 'cod_punto_venta', 'prefijo_control', 'responsable_nombre', 'responsable_tipo_doc',
  'responsable_num_doc',
] as const;

/** Datos de la empresa activa (los documentos impresos y Hacienda los toman de aquí). */
export async function leerEmpresa(connection: Conexion): Promise<Empresa> {
  const [rows] = await connection.execute<RowDataPacket[]>('SELECT * FROM empresa WHERE activo = 1 ORDER BY idempresa LIMIT 1');
  if (!rows[0]) throw new Error('Configure los datos de la empresa en Configuración > Empresa');
  return rows[0] as Empresa;
}

/** Quita guiones y espacios de NIT, NRC o DUI para comparar o enviar a Hacienda. */
export function soloDigitos(valor: unknown): string {
  return String(valor ?? '').replace(/\D/g, '');
}
