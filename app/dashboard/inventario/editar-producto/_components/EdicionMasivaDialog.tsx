'use client';

import { Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LADOS as lados, UNIDADES_MEDIDA as unidadesMedida } from './tipos';
import type { CategoriaOpcion, DatosEdicionMasiva, GrupoOpcion, Setter, SubgrupoOpcion } from './tipos';

interface Props {
  productosSeleccionados: Set<number>;
  edicionMasivaData: DatosEdicionMasiva;
  setEdicionMasivaData: Setter<DatosEdicionMasiva>;
  categoriasNuevo: CategoriaOpcion[];
  grupos: GrupoOpcion[];
  subgrupos: SubgrupoOpcion[];
  savingMasivo: boolean;
  setShowEdicionMasiva: (abierto: boolean) => void;
  handleGuardarEdicionMasiva: () => void;
}

export function EdicionMasivaDialog({
  productosSeleccionados,
  edicionMasivaData,
  setEdicionMasivaData,
  categoriasNuevo,
  grupos,
  subgrupos,
  savingMasivo,
  setShowEdicionMasiva,
  handleGuardarEdicionMasiva,
}: Props) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-white to-violet-50/40 dark:from-card dark:to-background border border-violet-300 dark:border-purple-500/30 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Edición Masiva</h3>
            <p className="text-sm text-purple-400">{productosSeleccionados.size} productos seleccionados</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowEdicionMasiva(false)}
            className="text-slate-400 hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-4 space-y-4">
          <p className="text-xs text-slate-400 bg-slate-800/50 p-2 rounded">
            Solo los campos que completes se actualizarán. Los campos vacíos no se modificarán.
          </p>

          {/* Marca */}
          <div className="space-y-1">
            <Label className="text-slate-600 dark:text-slate-300">Marca</Label>
            <Input
              placeholder="Dejar vacío para no modificar"
              value={edicionMasivaData.marca}
              onChange={(e) => setEdicionMasivaData(prev => ({ ...prev, marca: e.target.value }))}
              className="bg-slate-100 dark:bg-slate-900 border-slate-700 text-slate-200"
            />
          </div>

          {/* Categoría */}
          <div className="space-y-1">
            <Label className="text-slate-600 dark:text-slate-300">Categoría</Label>
            <Select
              value={edicionMasivaData.idcategoria_nuevo}
              onValueChange={(value) => setEdicionMasivaData(prev => ({ 
                ...prev, 
                idcategoria_nuevo: value,
                id_grupo: '',
                id_subgrupo: ''
              }))}
            >
              <SelectTrigger className="bg-slate-100 dark:bg-slate-900 border-slate-700 text-slate-200">
                <SelectValue placeholder="No modificar" />
              </SelectTrigger>
              <SelectContent className="bg-slate-100 dark:bg-slate-900 border-slate-700">
                {categoriasNuevo.map(cat => (
                  <SelectItem key={cat.idcategoria} value={String(cat.idcategoria)}>
                    {cat.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Grupo (si hay categoría seleccionada) */}
          {edicionMasivaData.idcategoria_nuevo && (
            <div className="space-y-1">
              <Label className="text-slate-600 dark:text-slate-300">Grupo</Label>
              <Select
                value={edicionMasivaData.id_grupo}
                onValueChange={(value) => setEdicionMasivaData(prev => ({ 
                  ...prev, 
                  id_grupo: value,
                  id_subgrupo: ''
                }))}
              >
                <SelectTrigger className="bg-slate-100 dark:bg-slate-900 border-slate-700 text-slate-200">
                  <SelectValue placeholder="No modificar" />
                </SelectTrigger>
                <SelectContent className="bg-slate-100 dark:bg-slate-900 border-slate-700">
                  {grupos
                    .filter(g => Number(g.idcategoria) === Number(edicionMasivaData.idcategoria_nuevo))
                    .map(grupo => (
                      <SelectItem key={grupo.id_grupo} value={String(grupo.id_grupo)}>
                        {grupo.codigo} - {grupo.nombre}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Subgrupo (si hay grupo seleccionado) */}
          {edicionMasivaData.id_grupo && (
            <div className="space-y-1">
              <Label className="text-slate-600 dark:text-slate-300">Subgrupo</Label>
              <Select
                value={edicionMasivaData.id_subgrupo}
                onValueChange={(value) => setEdicionMasivaData(prev => ({ ...prev, id_subgrupo: value }))}
              >
                <SelectTrigger className="bg-slate-100 dark:bg-slate-900 border-slate-700 text-slate-200">
                  <SelectValue placeholder="No modificar" />
                </SelectTrigger>
                <SelectContent className="bg-slate-100 dark:bg-slate-900 border-slate-700">
                  {subgrupos
                    .filter(s => Number(s.id_grupo) === Number(edicionMasivaData.id_grupo))
                    .map(sub => (
                      <SelectItem key={sub.id_subgrupo} value={String(sub.id_subgrupo)}>
                        {sub.codigo} - {sub.nombre}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Unidad de Medida */}
          <div className="space-y-1">
            <Label className="text-slate-600 dark:text-slate-300">Unidad de Medida</Label>
            <Select
              value={edicionMasivaData.unimedida}
              onValueChange={(value) => setEdicionMasivaData(prev => ({ ...prev, unimedida: value }))}
            >
              <SelectTrigger className="bg-slate-100 dark:bg-slate-900 border-slate-700 text-slate-200">
                <SelectValue placeholder="No modificar" />
              </SelectTrigger>
              <SelectContent className="bg-slate-100 dark:bg-slate-900 border-slate-700">
                {unidadesMedida.map(u => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Lado */}
          <div className="space-y-1">
            <Label className="text-slate-600 dark:text-slate-300">Lado</Label>
            <Select
              value={edicionMasivaData.lado}
              onValueChange={(value) => setEdicionMasivaData(prev => ({ ...prev, lado: value }))}
            >
              <SelectTrigger className="bg-slate-100 dark:bg-slate-900 border-slate-700 text-slate-200">
                <SelectValue placeholder="No modificar" />
              </SelectTrigger>
              <SelectContent className="bg-slate-100 dark:bg-slate-900 border-slate-700">
                {lados.map(l => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Exento de Impuestos */}
          <div className="space-y-1">
            <Label className="text-slate-600 dark:text-slate-300">Exento de Impuestos</Label>
            <Select
              value={edicionMasivaData.exento}
              onValueChange={(value) => setEdicionMasivaData(prev => ({ ...prev, exento: value as '' | 'true' | 'false' }))}
            >
              <SelectTrigger className="bg-slate-100 dark:bg-slate-900 border-slate-700 text-slate-200">
                <SelectValue placeholder="No modificar" />
              </SelectTrigger>
              <SelectContent className="bg-slate-100 dark:bg-slate-900 border-slate-700">
                <SelectItem value="true">Sí - Exento</SelectItem>
                <SelectItem value="false">No - Con impuestos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="p-4 border-t border-slate-700 flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => setShowEdicionMasiva(false)}
            className="border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleGuardarEdicionMasiva}
            disabled={savingMasivo}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {savingMasivo ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Aplicar a {productosSeleccionados.size} productos
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
