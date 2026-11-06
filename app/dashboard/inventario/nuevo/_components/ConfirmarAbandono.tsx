'use client';

import { AlertTriangle, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  pendingNavigation: string | null;
  setPendingNavigation: (ruta: string | null) => void;
  setShowConfirmLeave: (abierto: boolean) => void;
  router: { push: (ruta: string) => void };
}

export function ConfirmarAbandono({ pendingNavigation, setPendingNavigation, setShowConfirmLeave, router }: Props) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gradient-to-br from-white to-slate-50 dark:from-card dark:to-background border border-sky-200/70 dark:border-primary/30 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-amber-500/20 rounded-lg">
            <AlertTriangle className="h-6 w-6 text-amber-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Cambios sin guardar</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Tiene información sin guardar</p>
          </div>
        </div>
        <p className="mt-4 text-slate-600 dark:text-slate-300">
          ¿Está seguro que desea abandonar la página? Los cambios no guardados se perderán.
        </p>
        <div className="flex justify-end gap-3 mt-6">
          <Button
            variant="outline"
            onClick={() => {
              setShowConfirmLeave(false);
              setPendingNavigation(null);
            }}
            className="border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full px-6"
          >
            Cancelar
          </Button>
          <Button
            onClick={() => {
              setShowConfirmLeave(false);
              if (pendingNavigation) {
                router.push(pendingNavigation);
              }
            }}
            className="bg-primary text-white hover:bg-primary/80 rounded-full px-6"
          >
            <Save className="h-4 w-4 mr-2" />
            Sí, Abandonar
          </Button>
        </div>
      </div>
    </div>
  );
}
