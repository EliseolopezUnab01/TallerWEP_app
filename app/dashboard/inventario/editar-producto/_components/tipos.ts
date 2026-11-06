import type { Dispatch, SetStateAction } from 'react';

export type CategoriaOpcion = { idcategoria: number; nombre: string };
export type GrupoOpcion = { id_grupo: number; codigo: string; nombre: string; idcategoria: number };
export type SubgrupoOpcion = { id_subgrupo: number; codigo: string; nombre: string; id_grupo: number };

export const UNIDADES_MEDIDA = ['UNIDAD', 'PAR', 'JUEGO', 'KIT', 'LITRO', 'GALON', 'METRO'];
export const LADOS = ['IZQUIERDO', 'DERECHO', 'AMBOS', 'NO APLICA'];

export const EDICION_MASIVA_VACIA = {
  marca: '',
  idcategoria_nuevo: '',
  id_grupo: '',
  id_subgrupo: '',
  unimedida: '',
  lado: '',
  exento: '' as '' | 'true' | 'false',
};

export type DatosEdicionMasiva = typeof EDICION_MASIVA_VACIA;
export type Setter<T> = Dispatch<SetStateAction<T>>;
