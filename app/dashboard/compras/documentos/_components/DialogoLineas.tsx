'use client';

import { useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { UI } from '@/lib/ui';
import { fmtMoneda, type LineaDocumento } from './tipos';

export type Seleccion = { iddetalle: number; cantidad: number }[];

interface Props {
  titulo: string;
  lineas: LineaDocumento[];
  textoConfirmar: string;
  encabezado?: ReactNode;
  onConfirmar: (seleccion: Seleccion) => void;
  onCerrar: () => void;
}

/** Elegir qué líneas pasan al siguiente documento y con qué cantidad. */
export function DialogoLineas({ titulo, lineas, textoConfirmar, encabezado, onConfirmar, onCerrar }: Props) {
  const [marcadas, setMarcadas] = useState<Record<number, string | false>>(() =>
    Object.fromEntries(lineas.map((l) => [l.iddetalle, String(Number(l.cantidad))]))
  );
  const [base, setBase] = useState(lineas);
  if (base !== lineas) {
    setBase(lineas);
    setMarcadas(Object.fromEntries(lineas.map((l) => [l.iddetalle, String(Number(l.cantidad))])));
  }

  const seleccion: Seleccion = lineas
    .filter((l) => marcadas[l.iddetalle] !== false && Number(marcadas[l.iddetalle]) > 0)
    .map((l) => ({ iddetalle: l.iddetalle, cantidad: Number(marcadas[l.iddetalle]) }));
  const todas = lineas.length > 0 && lineas.every((l) => marcadas[l.iddetalle] !== false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCerrar}>
      <div className={`${UI.densePanel} flex max-h-[85vh] w-full max-w-3xl flex-col`} onClick={(e) => e.stopPropagation()}>
        <div className={`${UI.densePanelTitle} flex items-center justify-between`}>
          <span>{titulo}</span>
          <button type="button" className="p-1 text-muted-foreground hover:text-foreground" aria-label="Cerrar" onClick={onCerrar}>
            <X className="h-4 w-4" />
          </button>
        </div>
        {encabezado && <div className="border-b border-border p-3">{encabezado}</div>}
        <div className="overflow-auto">
          <table className={UI.denseTable}>
            <thead>
              <tr>
                <th className={`${UI.denseTh} w-8`}>
                  <input
                    type="checkbox"
                    checked={todas}
                    onChange={(e) =>
                      setMarcadas(Object.fromEntries(lineas.map((l) => [l.iddetalle, e.target.checked ? String(Number(l.cantidad)) : false])))
                    }
                    aria-label="Marcar todas"
                  />
                </th>
                <th className={UI.denseTh}>#</th>
                <th className={UI.denseTh}>Descripción</th>
                <th className={`${UI.denseTh} text-right`}>En el documento</th>
                <th className={`${UI.denseTh} text-right`}>Precio</th>
                <th className={`${UI.denseTh} text-right`}>Cantidad a pasar</th>
              </tr>
            </thead>
            <tbody>
              {lineas.map((l) => {
                const valor = marcadas[l.iddetalle];
                return (
                  <tr key={l.iddetalle} className={valor === false ? 'opacity-50' : ''}>
                    <td className={UI.denseTd}>
                      <input
                        type="checkbox"
                        checked={valor !== false}
                        onChange={(e) => setMarcadas({ ...marcadas, [l.iddetalle]: e.target.checked ? String(Number(l.cantidad)) : false })}
                      />
                    </td>
                    <td className={`${UI.denseTd} ${UI.denseMono}`}>{l.linea_visual}</td>
                    <td className={`${UI.denseTd} max-w-[20rem] truncate`} title={l.descripcion_articulo}>
                      {l.descripcion_articulo}
                    </td>
                    <td className={`${UI.denseTd} ${UI.denseMono} text-right`}>{fmtMoneda(l.cantidad)}</td>
                    <td className={`${UI.denseTd} ${UI.denseMono} text-right`}>{fmtMoneda(l.precio_moneda, 4)}</td>
                    <td className={UI.denseTd}>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        disabled={valor === false}
                        className={`${UI.denseInput} ml-auto block w-24 text-right ${UI.denseMono}`}
                        value={valor === false ? '' : valor}
                        onChange={(e) => setMarcadas({ ...marcadas, [l.iddetalle]: e.target.value })}
                      />
                    </td>
                  </tr>
                );
              })}
              {lineas.length === 0 && (
                <tr>
                  <td colSpan={6} className={`${UI.denseTd} py-6 text-center text-muted-foreground`}>
                    Sin líneas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-border p-2">
          <span className="text-[11px] text-muted-foreground">
            {seleccion.length} de {lineas.length} línea(s)
          </span>
          <div className="flex gap-1.5">
            <button type="button" className={UI.denseBtn} onClick={onCerrar}>
              Cancelar
            </button>
            <button type="button" className={UI.denseBtnPrimary} disabled={seleccion.length === 0} onClick={() => onConfirmar(seleccion)}>
              {textoConfirmar}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
