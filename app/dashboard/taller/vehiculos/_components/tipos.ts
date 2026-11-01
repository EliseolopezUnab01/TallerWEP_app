import type { Fila } from '../../_components/comun';

export interface Parte extends Fila {
  idparte: number;
  idsistema: number;
  sistema_nombre: string;
  nombre_parte: string;
  posicion: string | null;
  idprod: number | null;
  producto_nombre: string | null;
  marca: string | null;
  referencia: string | null;
  numero_serie: string | null;
  estado_instalacion: 'INSTALADA' | 'RETIRADA';
  fecha_instalacion: string | null;
  km_instalacion: number | null;
  fecha_retiro: string | null;
  km_retiro: number | null;
  reemplaza_a: number | null;
  reemplaza_nombre: string | null;
  reemplazada_por: number | null;
  ultimo_estado: string | null;
  ultimo_visual: number | null;
  ultima_revision: string | null;
  comentario: string | null;
}

export interface Recordatorio extends Fila {
  idrecordatorio: number;
  idparte: number | null;
  idsistema: number | null;
  sistema_nombre: string | null;
  nombre_parte: string | null;
  descripcion: string;
  intervalo_dias: number | null;
  intervalo_km: number | null;
  ultimo_fecha: string | null;
  ultimo_km: number | null;
  proximo_fecha: string | null;
  proximo_km: number | null;
  activo: number;
}

export interface DetalleVehiculo {
  vehiculo: Fila & { id: number; codigo: string; placa: string | null; odometro_actual: number | null; cliente_nombre: string };
  partes: Parte[];
  estados: Fila[];
  recordatorios: Recordatorio[];
  ordenes: Fila[];
  archivos: Fila[];
}

export interface Sistema extends Fila {
  idsistema: number;
  nombre: string;
  activo: number;
}

export type Accion = (url: string, metodo: string, cuerpo?: unknown) => Promise<boolean>;

export const COLOR_ESTADO: Record<string, string> = {
  EXCELENTE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  'BUEN ESTADO': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  REGULAR: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  DAÑADO: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
  PELIGRO: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  INSERVIBLE: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  DESACTIVADO: 'bg-muted text-muted-foreground',
  'SIN VERIFICAR': 'bg-muted text-muted-foreground',
  OTRO: 'bg-muted text-muted-foreground',
};
