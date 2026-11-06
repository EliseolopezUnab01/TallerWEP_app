import type { ChangeEvent, Dispatch, SetStateAction } from 'react';

export interface Contacto {
  orden: number;
  nombre: string;
  puesto_cargo: string;
  telefono: string;
  movil: string;
  email: string;
}

export interface Cuenta {
  idcuenta?: number;
  numero_cuenta: string;
  beneficiario: string;
  direccion_beneficiario: string;
  banco: string;
  direccion_banco: string;
  codigo_aba: string;
  codigo_swift: string;
  codigo_iban: string;
  moneda: string;
  comentarios: string;
}

export const CONTACTO_VACIO = (orden: number): Contacto => ({
  orden, nombre: '', puesto_cargo: '', telefono: '', movil: '', email: '',
});

export const CUENTA_VACIA = (): Cuenta => ({
  numero_cuenta: '', beneficiario: '', direccion_beneficiario: '', banco: '',
  direccion_banco: '', codigo_aba: '', codigo_swift: '', codigo_iban: '',
  moneda: '', comentarios: '',
});

export const INPUT_CLS = 'bg-white dark:bg-surface-deep border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus-visible:ring-primary';
export const SELECT_CLS = 'w-full h-9 rounded-md bg-white dark:bg-surface-deep border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-sm px-3 focus:outline-none focus:ring-2 focus:ring-primary';
export const LABEL_CLS = 'text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400';

export type Setter<T> = Dispatch<SetStateAction<T>>;
export type AlCambiarTexto = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
export type ModoFicha = 'vacio' | 'nuevo' | 'editar';
