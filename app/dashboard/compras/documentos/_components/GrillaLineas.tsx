'use client';

import { useState } from 'react';
import { GripVertical, ImageIcon, PackagePlus, Plus, Trash2 } from 'lucide-react';
import { UI } from '@/lib/ui';
import { ESTATUS_ARTICULO } from '@/lib/documentos-compras-constantes';
import { BuscadorProducto } from './BuscadorProducto';
import { fechaInput, fmtMoneda, type Documento, type LineaDocumento } from './tipos';
import type { ProductoHit } from '../../ingreso/_components/tipos';

interface Props {
  documento: Documento;
  lineas: LineaDocumento[];
  editable: boolean;
  onAgregar: (cuerpo: Record<string, unknown>) => Promise<boolean>;
  onActualizar: (iddetalle: number, cambios: Record<string, unknown>) => void;
  onReordenar: (orden: number[]) => void;
  onEliminar: (l: LineaDocumento) => void;
  onTemporal: (idtemporal: number) => void;
}

const manualVacio = { descripcion_articulo: '', referencia_proveedor: '', oems: '', marca: '' };

export function GrillaLineas({ documento, lineas, editable, onAgregar, onActualizar, onReordenar, onEliminar, onTemporal }: Props) {
  const [modo, setModo] = useState<'inventario' | 'manual'>('inventario');
  const [arrastrando, setArrastrando] = useState<number | null>(null);
  const [sobre, setSobre] = useState<number | null>(null);
  const conObjetivo = documento.tipo_documento === 'ORDEN' || documento.tipo_documento === 'PROFORMA';

  const soltar = (destino: number) => {
    if (arrastrando == null || arrastrando === destino) return;
    const ids = lineas.map((l) => l.iddetalle).filter((id) => id !== arrastrando);
    ids.splice(ids.indexOf(destino), 0, arrastrando);
    onReordenar(ids);
  };
  const [producto, setProducto] = useState<ProductoHit | null>(null);
  const [manual, setManual] = useState(manualVacio);
  const [cantidad, setCantidad] = useState('1');
  const [precio, setPrecio] = useState('');
  const [guardando, setGuardando] = useState(false);
  const moneda = documento.moneda_documento;
  const enUsd = moneda === 'USD';

  const agregar = async () => {
    if (guardando) return;
    const base = { iddocumento: documento.iddocumento, cantidad: Number(cantidad) || 1, precio_moneda: Number(precio) || 0 };
    const cuerpo = modo === 'inventario' ? (producto ? { ...base, idprod: producto.idprod } : null) : { ...base, ...manual };
    if (!cuerpo) return;
    setGuardando(true);
    const ok = await onAgregar(cuerpo);
    setGuardando(false);
    if (ok) {
      setProducto(null);
      setManual(manualVacio);
      setCantidad('1');
      setPrecio('');
    }
  };

  const celda = (l: LineaDocumento, campo: keyof LineaDocumento, tipo: 'text' | 'number' | 'date', ancho: string) => {
    const valor = tipo === 'date' ? fechaInput(l[campo] as string | null) : String(l[campo] ?? '');
    return (
      <input
        key={`${l.iddetalle}-${campo}-${l.updated_at}`}
        type={tipo}
        step={tipo === 'number' ? 'any' : undefined}
        defaultValue={tipo === 'number' ? String(Number(valor)) : valor}
        disabled={!editable}
        className={`${UI.denseInput} ${ancho} ${tipo === 'number' ? `text-right ${UI.denseMono}` : ''}`}
        onBlur={(e) => {
          const nuevo = e.target.value;
          const actual = tipo === 'number' ? String(Number(valor)) : valor;
          if (nuevo !== actual) onActualizar(l.iddetalle, { [campo]: nuevo });
        }}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
    );
  };

  return (
    <div className={`${UI.densePanel} flex flex-col min-h-0 flex-1`}>
      <div className={`${UI.densePanelTitle} flex items-center justify-between`}>
        <span>Productos ({lineas.length})</span>
        <span className="normal-case tracking-normal font-normal">
          Precio en {moneda}
          {!enUsd && ` · TC ${Number(documento.tipo_cambio)}`}
        </span>
      </div>

      {editable && (
        <div className="flex flex-wrap items-end gap-2 px-3 py-2 border-b border-border">
          <div className="flex rounded-md border border-border overflow-hidden shrink-0">
            {(['inventario', 'manual'] as const).map((m) => (
              <button
                key={m}
                type="button"
                className={`h-7 px-2.5 text-xs ${modo === m ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-muted'}`}
                onClick={() => setModo(m)}
              >
                {m === 'inventario' ? 'Inventario' : 'A mano (temporal)'}
              </button>
            ))}
          </div>
          {modo === 'inventario' ? (
            <div className="flex flex-1 min-w-[16rem] items-center gap-2">
              <BuscadorProducto onElegir={setProducto} />
              {producto && (
                <span className="text-xs truncate max-w-[16rem]" title={producto.nombre}>
                  <span className={UI.denseMono}>{producto.idprod}</span> {producto.nombre}
                </span>
              )}
            </div>
          ) : (
            <div className="flex flex-1 min-w-[16rem] flex-wrap gap-2">
              <input
                className={`${UI.denseInput} flex-[2] min-w-[12rem]`}
                placeholder="Descripción *"
                value={manual.descripcion_articulo}
                onChange={(e) => setManual({ ...manual, descripcion_articulo: e.target.value })}
              />
              <input
                className={`${UI.denseInput} flex-1 min-w-[7rem]`}
                placeholder="Ref. proveedor"
                value={manual.referencia_proveedor}
                onChange={(e) => setManual({ ...manual, referencia_proveedor: e.target.value })}
              />
              <input
                className={`${UI.denseInput} flex-1 min-w-[7rem]`}
                placeholder="OEM"
                value={manual.oems}
                onChange={(e) => setManual({ ...manual, oems: e.target.value })}
              />
              <input
                className={`${UI.denseInput} w-24`}
                placeholder="Marca"
                value={manual.marca}
                onChange={(e) => setManual({ ...manual, marca: e.target.value })}
              />
            </div>
          )}
          <label className="flex flex-col gap-0.5">
            <span className={UI.denseLabel}>Cant.</span>
            <input
              type="number"
              min="0"
              step="any"
              className={`${UI.denseInput} w-16 text-right`}
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className={UI.denseLabel}>Precio {moneda}</span>
            <input
              type="number"
              min="0"
              step="any"
              className={`${UI.denseInput} w-24 text-right`}
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && agregar()}
            />
          </label>
          <button
            type="button"
            className={UI.denseBtnPrimary}
            disabled={guardando || (modo === 'inventario' ? !producto : !manual.descripcion_articulo.trim())}
            onClick={agregar}
          >
            {modo === 'inventario' ? <Plus className="h-3.5 w-3.5" /> : <PackagePlus className="h-3.5 w-3.5" />} Agregar
          </button>
        </div>
      )}

      <div className="overflow-auto flex-1 min-h-[12rem]">
        <table className={UI.denseTable}>
          <thead>
            <tr>
              <th className={UI.denseTh}>#</th>
              <th className={UI.denseTh}>Código</th>
              <th className={UI.denseTh}>Ref. prov.</th>
              <th className={UI.denseTh}>Descripción</th>
              <th className={`${UI.denseTh} text-right`}>Cant.</th>
              <th className={`${UI.denseTh} text-right`}>Precio {moneda}</th>
              {!enUsd && <th className={`${UI.denseTh} text-right`}>Precio USD</th>}
              <th className={`${UI.denseTh} text-right`}>Subtotal USD</th>
              {conObjetivo && (
                <th className={`${UI.denseTh} text-right`} title="Precio al que se quiere comprar">
                  Precio objetivo
                </th>
              )}
              <th className={UI.denseTh}>Estatus</th>
              <th className={UI.denseTh}>Entrega est.</th>
              <th className={UI.denseTh}>Comentario proveedor</th>
              <th className={UI.denseTh} />
            </tr>
          </thead>
          <tbody>
            {lineas.length === 0 ? (
              <tr>
                <td colSpan={12} className={`${UI.denseTd} py-8 text-center text-muted-foreground`}>
                  {editable ? 'Agregue productos del inventario o escríbalos a mano.' : 'Sin productos.'}
                </td>
              </tr>
            ) : (
              lineas.map((l) => (
                <tr
                  key={l.iddetalle}
                  className={`hover:bg-muted/40 ${arrastrando === l.iddetalle ? 'opacity-40' : ''} ${
                    sobre === l.iddetalle && arrastrando !== l.iddetalle ? 'border-t-2 border-t-primary' : ''
                  }`}
                  onDragOver={(e) => {
                    if (arrastrando == null) return;
                    e.preventDefault();
                    setSobre(l.iddetalle);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    soltar(l.iddetalle);
                    setArrastrando(null);
                    setSobre(null);
                  }}
                >
                  <td className={`${UI.denseTd} ${UI.denseMono} text-muted-foreground`}>
                    <span className="inline-flex items-center gap-0.5">
                      {editable && lineas.length > 1 && (
                        <span
                          draggable
                          className="cursor-grab text-muted-foreground/60 hover:text-foreground"
                          title="Arrastrar para reordenar"
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = 'move';
                            setArrastrando(l.iddetalle);
                          }}
                          onDragEnd={() => {
                            setArrastrando(null);
                            setSobre(null);
                          }}
                        >
                          <GripVertical className="h-3.5 w-3.5" />
                        </span>
                      )}
                      {l.linea_visual}
                    </span>
                  </td>
                  <td className={UI.denseTd}>
                    {l.idtemporal ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded px-1.5 text-[10px] font-semibold bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300 hover:underline"
                        onClick={() => onTemporal(l.idtemporal!)}
                        title="Producto temporal: ver ficha, imágenes y enlazar"
                      >
                        {l.temporal_codigo}
                        {Number(l.temporal_imagenes) > 0 && <ImageIcon className="h-3 w-3" />}
                      </button>
                    ) : (
                      <span className={UI.denseMono}>{l.idprod}</span>
                    )}
                  </td>
                  <td className={UI.denseTd}>{celda(l, 'referencia_proveedor', 'text', 'w-24')}</td>
                  <td className={UI.denseTd}>{celda(l, 'descripcion_articulo', 'text', 'w-56')}</td>
                  <td className={UI.denseTd}>{celda(l, 'cantidad', 'number', 'w-16')}</td>
                  <td className={UI.denseTd}>{celda(l, 'precio_moneda', 'number', 'w-24')}</td>
                  {!enUsd && <td className={`${UI.denseTd} ${UI.denseMono} text-right`}>{fmtMoneda(l.precio_usd, 4)}</td>}
                  <td className={`${UI.denseTd} ${UI.denseMono} text-right`}>{fmtMoneda(Number(l.cantidad) * Number(l.precio_usd))}</td>
                  {conObjetivo && (
                    <td className={UI.denseTd}>
                      {documento.tipo_documento === 'ORDEN' ? (
                        celda(l, 'precio_objetivo', 'number', 'w-24')
                      ) : (
                        <span className={`${UI.denseMono} block text-right text-muted-foreground`}>
                          {l.precio_objetivo == null ? '—' : fmtMoneda(l.precio_objetivo, 4)}
                        </span>
                      )}
                    </td>
                  )}
                  <td className={UI.denseTd}>
                    <select
                      className={`${UI.denseSelect} w-32`}
                      value={l.estatus_articulo}
                      disabled={!editable}
                      onChange={(e) => onActualizar(l.iddetalle, { estatus_articulo: e.target.value })}
                    >
                      {ESTATUS_ARTICULO.map((e) => (
                        <option key={e} value={e}>
                          {e}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className={UI.denseTd}>{celda(l, 'fecha_est_entrega', 'date', 'w-32')}</td>
                  <td className={UI.denseTd}>{celda(l, 'comentario_proveedor', 'text', 'w-48')}</td>
                  <td className={UI.denseTd}>
                    {editable && (
                      <button type="button" className="p-1 text-muted-foreground hover:text-red-600" onClick={() => onEliminar(l)} aria-label="Eliminar línea">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {lineas.length > 0 && (
            <tfoot>
              <tr className="font-semibold">
                <td colSpan={5} className={`${UI.denseTd} text-right`}>
                  Total
                </td>
                <td className={`${UI.denseTd} ${UI.denseMono} text-right`}>
                  {moneda} {fmtMoneda(documento.total_moneda)}
                </td>
                {!enUsd && <td className={UI.denseTd} />}
                <td className={`${UI.denseTd} ${UI.denseMono} text-right`}>USD {fmtMoneda(documento.total_usd)}</td>
                <td colSpan={conObjetivo ? 5 : 4} className={UI.denseTd} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
