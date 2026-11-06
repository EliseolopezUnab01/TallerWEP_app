'use client';

import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { BarraPantalla } from '@/components/barra-pantalla';
import { Toast, pedir, useAviso } from '@/app/dashboard/taller/_components/comun';
import { cargarConfiguracion, fijarConfiguracion } from '@/lib/configuracion-cliente';
import type { ConfiguracionSistema } from '@/lib/configuracion';
import { useSesion } from '@/lib/sesion-cliente';
import { UI } from '@/lib/ui';

export default function SistemaPage() {
  const { aviso, notificar } = useAviso();
  const { puede } = useSesion();
  const editable = puede('configuracion.editar');
  const [valores, setValores] = useState<ConfiguracionSistema | null>(null);

  useEffect(() => {
    cargarConfiguracion(true).then(setValores);
  }, []);

  const guardar = async () => {
    if (!valores) return;
    try {
      const d = await pedir('/api/configuracion-sistema', 'PUT', valores);
      setValores(d.configuracion);
      fijarConfiguracion(d.configuracion);
      notificar('ok', d.mensaje);
    } catch (e) {
      notificar('error', (e as Error).message);
    }
  };

  const decimales = valores?.cantidades_decimales === '1';

  return (
    <>
      <div className={`${UI.canvas} flex flex-col gap-2`}>
        <BarraPantalla modulo="Configuración" titulo="Sistema">
          {editable && (
            <button type="button" className={UI.denseBtnPrimary} onClick={guardar} disabled={!valores}>
              <Save className="h-3.5 w-3.5" /> Guardar
            </button>
          )}
        </BarraPantalla>

        <div className={`${UI.densePanel} p-4 space-y-4`}>
          <p className={`text-xs ${UI.textMuted}`}>
            Opciones que adaptan el sistema a la forma de trabajar de cada empresa.
          </p>
          {!valores ? (
            <p className={`text-xs ${UI.textMuted}`}>Cargando…</p>
          ) : (
            <label className="flex items-start gap-3 max-w-2xl">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-primary"
                disabled={!editable}
                checked={decimales}
                onChange={(e) => setValores({ ...valores, cantidades_decimales: e.target.checked ? '1' : '0' })}
              />
              <span className="text-sm">
                <span className="font-medium">Trabajar con cantidades decimales</span>
                <span className={`block text-xs ${UI.textMuted}`}>
                  Apagado, las líneas de compra que entran a inventario y los ajustes de inventario solo aceptan unidades
                  enteras. Encendido, se aceptan fracciones (por ejemplo 2.5 galones de aceite o 3.75 metros de manguera).
                  Las líneas express y de gastos aceptan decimales siempre.
                </span>
              </span>
            </label>
          )}
        </div>
      </div>
      <Toast aviso={aviso} />
    </>
  );
}
