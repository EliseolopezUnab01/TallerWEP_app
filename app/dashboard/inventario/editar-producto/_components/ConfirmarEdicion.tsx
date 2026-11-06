'use client';

import { AlertTriangle, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  producto: { nombre: string } | null;
  setShowConfirmDialog: (abierto: boolean) => void;
  handleConfirmSave: () => void;
}

export function ConfirmarEdicion({ producto, setShowConfirmDialog, handleConfirmSave }: Props) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gradient-to-br from-white to-slate-50 dark:from-card dark:to-background border border-sky-200/70 dark:border-primary/30 rounded-xl p-6 max-w-md w-full mx-4 shadow-[0_0_30px_rgba(14,136,201,0.3)]">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-12 w-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-yellow-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Confirmar Edición</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Esta acción modificará el producto</p>
          </div>
        </div>
        <p className="text-slate-300 mb-6">
          ¿Está seguro que desea guardar los cambios realizados al producto <span className="font-semibold text-primary">“{producto?.nombre}”</span>?
        </p>
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => setShowConfirmDialog(false)}
            className="border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmSave}
            className="bg-primary hover:bg-primary/90 text-white"
          >
            <Save className="h-4 w-4 mr-2" />
            Sí, Guardar Cambios
          </Button>
        </div>
      </div>
    </div>
  );
}
