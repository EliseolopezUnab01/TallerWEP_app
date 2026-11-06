'use client';

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { AlEnviar, CategoriaNueva, FormGrupo, Setter } from './tipos';

interface Props {
  grupoForm: FormGrupo;
  setGrupoForm: Setter<FormGrupo>;
  setShowModalGrupo: (abierto: boolean) => void;
  categoriasNuevas: CategoriaNueva[];
  getSiguienteCodigoGrupo: (idcategoria: number) => string;
  handleCrearGrupo: AlEnviar;
  loadingGrupo: boolean;
}

export function ModalGrupo({
  grupoForm,
  setGrupoForm,
  setShowModalGrupo,
  categoriasNuevas,
  getSiguienteCodigoGrupo,
  handleCrearGrupo,
  loadingGrupo,
}: Props) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-slate-950/95 border border-green-700/40 rounded-xl max-w-md w-full shadow-xl">
        <div className="flex items-center justify-between p-6 border-b border-slate-800/30">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Nuevo Grupo</h3>
          <Button variant="ghost" size="icon" onClick={() => setShowModalGrupo(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleCrearGrupo} className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-200">Categoría *</label>
            <select
              value={grupoForm.idcategoria || ''}
              onChange={(e) => {
                const idcat = Number(e.target.value);
                const siguienteCodigo = idcat ? getSiguienteCodigoGrupo(idcat) : '';
                setGrupoForm(prev => ({ ...prev, idcategoria: idcat, codigo: siguienteCodigo }));
              }}
              required
              className="w-full bg-slate-950/80 border border-slate-300 dark:border-slate-700/40 rounded-md px-3 py-2 text-slate-100"
            >
              <option value="">Seleccione una categoría</option>
              {categoriasNuevas.map(c => (
                <option key={c.idcategoria} value={c.idcategoria}>{c.idcategoria} - {c.nombre}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-200">Código del Grupo (auto-generado)</label>
            <Input
              placeholder="Se genera automáticamente"
              value={grupoForm.codigo}
              onChange={(e) => setGrupoForm(prev => ({ ...prev, codigo: e.target.value.replace(/\D/g, '').slice(0, 3) }))}
              maxLength={3}
              className="bg-white dark:bg-slate-950/80 border-slate-300 dark:border-slate-700/40 text-slate-800 dark:text-slate-100"
              readOnly
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">El código se genera automáticamente al seleccionar la categoría</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-200">Nombre del Grupo *</label>
            <Input
              placeholder="Ej: Bomba de Inyección"
              value={grupoForm.nombre}
              onChange={(e) => setGrupoForm(prev => ({ ...prev, nombre: e.target.value }))}
              required
              className="bg-white dark:bg-slate-950/80 border-slate-300 dark:border-slate-700/40 text-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" className="border-green-500/60 text-green-400" onClick={() => setShowModalGrupo(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loadingGrupo} className="bg-green-500/10 text-green-400 border-green-500/60 rounded-full">
              {loadingGrupo ? 'Creando...' : 'Crear Grupo'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
