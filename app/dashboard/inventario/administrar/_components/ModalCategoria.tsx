'use client';

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { AlEnviar, FormCategoria, Setter } from './tipos';

interface Props {
  categoriaForm: FormCategoria;
  setCategoriaForm: Setter<FormCategoria>;
  setShowModalCategoria: (abierto: boolean) => void;
  getSiguienteCodigoCategoria: () => string;
  handleCrearCategoria: AlEnviar;
  loadingCategoria: boolean;
}

export function ModalCategoria({
  categoriaForm,
  setCategoriaForm,
  setShowModalCategoria,
  getSiguienteCodigoCategoria,
  handleCrearCategoria,
  loadingCategoria,
}: Props) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-slate-950/95 border border-cyan-700/40 rounded-xl max-w-md w-full shadow-xl">
        <div className="flex items-center justify-between p-6 border-b border-slate-800/30">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Nueva Categoría</h3>
          <Button variant="ghost" size="icon" onClick={() => {
            setShowModalCategoria(false);
            setCategoriaForm({ idcategoria: '', nombre: '', descripcion: '' });
          }}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleCrearCategoria} className="p-6 space-y-4">
          <div className="space-y-2">
            <label htmlFor="idcategoria" className="text-sm font-medium text-slate-200">Código de Categoría (auto-generado)</label>
            <Input
              id="idcategoria"
              value={categoriaForm.idcategoria || getSiguienteCodigoCategoria()}
              readOnly
              className="bg-white dark:bg-slate-950/80 border-slate-300 dark:border-slate-700/40 text-slate-800 dark:text-slate-100"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {getSiguienteCodigoCategoria() 
                ? `Siguiente código disponible: ${getSiguienteCodigoCategoria()}` 
                : '⚠️ No hay códigos disponibles (10-99 agotados)'}
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="nombre" className="text-sm font-medium text-slate-200">Nombre de la Categoría *</label>
            <Input
              id="nombre"
              placeholder="Ej: Sistema de Frenos"
              value={categoriaForm.nombre}
              onChange={(e) => setCategoriaForm(prev => ({ ...prev, nombre: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="descripcion" className="text-sm font-medium text-slate-200">Descripción</label>
            <textarea
              id="descripcion"
              placeholder="Descripción opcional..."
              value={categoriaForm.descripcion}
              onChange={(e) => setCategoriaForm(prev => ({ ...prev, descripcion: e.target.value }))}
              className="w-full h-20 px-3 py-2 border border-slate-300 dark:border-slate-700/40 rounded-md bg-white dark:bg-slate-950/80 text-slate-800 dark:text-slate-100 text-sm resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" className="border-primary/60 text-primary" onClick={() => setShowModalCategoria(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loadingCategoria} className="bg-primary/10 text-primary border-primary/60 rounded-full">
              {loadingCategoria ? 'Creando...' : 'Crear Categoría'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
