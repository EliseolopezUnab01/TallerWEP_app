'use client';
import { confirmar } from '@/components/ui/avisos';

import { useState } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { UI } from '@/lib/ui';
import { fmt2 } from './tipos';
import type { FilaImportada } from './ImportarDialog';

interface Props {
  filas: FilaImportada[];
  usadas: Set<number>;
  onCargar: (fila: FilaImportada) => void;
  onCerrar: () => void;
}

/** Ventana flotante con las líneas del Excel que no coincidieron con un producto. */
export function PendientesImportacion({ filas, usadas, onCargar, onCerrar }: Props) {
  const [abierta, setAbierta] = useState(true);
  const restantes = filas.filter((f) => !usadas.has(f.fila));
  const totalRestante = restantes.reduce((s, f) => s + f.cantidad * f.precio, 0);

  return (
    <div className={`${UI.densePanel} fixed right-4 bottom-28 z-40 w-[min(30rem,92vw)] shadow-xl flex flex-col`}>
      <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-border">
        <span className="text-xs font-semibold">Sin coincidencia</span>
        <span className="text-[11px] text-muted-foreground">
          {restantes.length} de {filas.length} · ${fmt2(totalRestante)}
        </span>
        <button
          type="button"
          className="ml-auto p-0.5 rounded text-muted-foreground hover:bg-muted"
          onClick={() => setAbierta(!abierta)}
          title={abierta ? 'Minimizar' : 'Expandir'}
        >
          {abierta ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
        <button
          type="button"
          className="p-0.5 rounded text-muted-foreground hover:bg-muted"
          onClick={async () => {
            if (restantes.length === 0 || (await confirmar('¿Cerrar la lista? Las líneas pendientes no se agregarán.'))) onCerrar();
          }}
          title="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      {abierta && (
        <div className="max-h-56 overflow-y-auto overflow-x-hidden">
          <table className={UI.denseTable}>
            <tbody>
              {filas.map((f) => {
                const usada = usadas.has(f.fila);
                return (
                  <tr key={f.fila} className={usada ? 'opacity-45' : UI.denseRow} onClick={() => !usada && onCargar(f)}>
                    <td className={`${UI.denseTd} ${UI.denseMono} text-right`}>{f.cantidad}</td>
                    <td className={`${UI.denseTd} ${UI.denseMono} ${usada ? 'line-through' : ''}`}>{f.referencia || '—'}</td>
                    <td className={`${UI.denseTd} w-full max-w-0 truncate`} title={f.descripcion}>{f.descripcion}</td>
                    <td className={`${UI.denseTd} ${UI.denseMono} text-right`}>{fmt2(f.precio)}</td>
                    <td className={`${UI.denseTd} text-right`}>
                      {!usada && (
                        <button type="button" className={`${UI.denseBtn} h-6`} onClick={() => onCargar(f)}>
                          Cargar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
