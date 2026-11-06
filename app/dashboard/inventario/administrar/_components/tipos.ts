import type { Dispatch, FormEvent, SetStateAction } from 'react';

export interface CategoriaNueva {
  idcategoria: number;
  nombre: string;
  descripcion?: string;
  activo?: number;
}

export interface Grupo {
  id_grupo: number;
  codigo: string;
  nombre: string;
  descripcion?: string;
  idcategoria: number;
  categoria_nombre?: string;
}

export interface Subgrupo {
  id_subgrupo: number;
  codigo: string;
  nombre: string;
  descripcion?: string;
  id_grupo: number;
  grupo_nombre?: string;
}

export const CATEGORIA_VACIA = { idcategoria: '', nombre: '', descripcion: '' };
export const GRUPO_VACIO = { codigo: '', nombre: '', descripcion: '', idcategoria: 0 };
export const SUBGRUPO_VACIO = { codigo: '', nombre: '', descripcion: '', id_grupo: 0 };

export type FormCategoria = typeof CATEGORIA_VACIA;
export type FormGrupo = typeof GRUPO_VACIO;
export type FormSubgrupo = typeof SUBGRUPO_VACIO;

export type Setter<T> = Dispatch<SetStateAction<T>>;
export type AlEnviar = (e: FormEvent) => void;
