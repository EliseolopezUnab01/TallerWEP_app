'use client';

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { AlEnviar, CategoriaNueva, FormSubgrupo, Grupo, Setter } from './tipos';

interface Props {
  subgrupoForm: FormSubgrupo;
  setSubgrupoForm: Setter<FormSubgrupo>;
  setShowModalSubgrupo: (abierto: boolean) => void;
  categoriasNuevas: CategoriaNueva[];
  gruposFiltradosPorCategoria: Grupo[];
  selectedCategoriaFilter: number | null;
  setSelectedCategoriaFilter: (idcategoria: number | null) => void;
  getSiguienteCodigoSubgrupo: (id_grupo: number) => string;
  handleCrearSubgrupo: AlEnviar;
  loadingSubgrupo: boolean;
}

export function ModalSubgrupo({
  subgrupoForm,
  setSubgrupoForm,
  setShowModalSubgrupo,
  categoriasNuevas,
  gruposFiltradosPorCategoria,
  selectedCategoriaFilter,
  setSelectedCategoriaFilter,
  getSiguienteCodigoSubgrupo,
  handleCrearSubgrupo,
  loadingSubgrupo,
}: Props) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-slate-950/95 border border-purple-700/40 rounded-xl max-w-md w-full shadow-xl">
        <div className="flex items-center justify-between p-6 border-b border-slate-800/30">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Nuevo Subgrupo</h3>
          <Button variant="ghost" size="icon" onClick={() => setShowModalSubgrupo(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleCrearSubgrupo} className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-200">Categoría</label>
            <select
              value={selectedCategoriaFilter || ''}
              onChange={(e) => {
                setSelectedCategoriaFilter(e.target.value ? Number(e.target.value) : null);
                setSubgrupoForm(prev => ({ ...prev, id_grupo: 0 }));
              }}
              className="w-full bg-slate-950/80 border border-slate-300 dark:border-slate-700/40 rounded-md px-3 py-2 text-slate-100"
            >
              <option value="">Seleccione una categoría</option>
              {categoriasNuevas.map(c => (
                <option key={c.idcategoria} value={c.idcategoria}>{c.idcategoria} - {c.nombre}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-200">Grupo *</label>
            <select
              value={subgrupoForm.id_grupo || ''}
              onChange={(e) => {
                const idGrupo = Number(e.target.value);
                const siguienteCodigo = idGrupo ? getSiguienteCodigoSubgrupo(idGrupo) : '';
                setSubgrupoForm(prev => ({ ...prev, id_grupo: idGrupo, codigo: siguienteCodigo }));
              }}
              required
              className="w-full bg-slate-950/80 border border-slate-300 dark:border-slate-700/40 rounded-md px-3 py-2 text-slate-100"
            >
              <option value="">Seleccione un grupo</option>
              {gruposFiltradosPorCategoria.map(g => (
                <option key={g.id_grupo} value={g.id_grupo}>{g.codigo} - {g.nombre}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-200">Código del Subgrupo (auto-generado)</label>
            <Input
              placeholder="Se genera automáticamente"
              value={subgrupoForm.codigo}
              onChange={(e) => setSubgrupoForm(prev => ({ ...prev, codigo: e.target.value.replace(/\D/g, '').slice(0, 3) }))}
              maxLength={3}
              className="bg-white dark:bg-slate-950/80 border-slate-300 dark:border-slate-700/40 text-slate-800 dark:text-slate-100"
              readOnly
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">El código se genera automáticamente al seleccionar el grupo</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-200">Nombre del Subgrupo *</label>
            <Input
              placeholder="Ej: Sellos"
              value={subgrupoForm.nombre}
              onChange={(e) => setSubgrupoForm(prev => ({ ...prev, nombre: e.target.value }))}
              required
              className="bg-white dark:bg-slate-950/80 border-slate-300 dark:border-slate-700/40 text-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" className="border-purple-500/60 text-purple-400" onClick={() => setShowModalSubgrupo(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loadingSubgrupo} className="bg-purple-500/10 text-purple-400 border-purple-500/60 rounded-full">
              {loadingSubgrupo ? 'Creando...' : 'Crear Subgrupo'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
