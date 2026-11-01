'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileJson, FileSpreadsheet, Upload, X } from 'lucide-react';
import { confirmar } from '@/components/ui/avisos';
import { UI } from '@/lib/ui';
import { CATEGORIAS_OPERACION, nombreTipoDte } from '@/lib/compras-constantes';
import { parsearDte, type ApendiceDte, type DteParseado } from '@/lib/importar-dte';
import type { CompraCtx } from './useCompra';
import { CONDICIONES_IVA_UI, fmt2 } from './tipos';

export interface FilaImportada {
  fila: number;
  cantidad: number;
  referencia: string;
  descripcion: string;
  precio: number;
  motivo?: string;
}

type Vista =
  | { tipo: 'inicio' }
  | { tipo: 'excel'; archivo: string; filas: FilaImportada[]; total: number }
  | { tipo: 'json'; archivo: string; dte: DteParseado; crudo: unknown };

interface ResultadoExcel {
  insertadas: number;
  total_enviado: number;
  total_excel: number;
  no_encontradas: FilaImportada[];
}

interface ResultadoJson {
  lineas_insertadas: number;
  lineas_con_producto: number;
  lineas_sin_clasificar: number;
  condicion_en_json: boolean;
  proveedor: { encontrado: boolean; nombre: string; codigo?: string; nit?: string | null; nrc?: string | null };
  apendice: ApendiceDte[];
  total_json: number;
  total_compra: number;
  otros_tributos?: { codigo: string; descripcion: string | null; valor: number }[];
  avisos?: string[];
}

interface Props {
  abierto: boolean;
  archivoInicial: File | null;
  ctx: CompraCtx;
  onCerrar: () => void;
  onPendientes: (filas: FilaImportada[]) => void;
  onApendice: (item: ApendiceDte) => void;
}

const esJson = (nombre: string) => /\.json$/i.test(nombre);
const esExcel = (nombre: string) => /\.(xlsx|xls|xlsm|csv)$/i.test(nombre);
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Columnas A–D por posición desde la fila 2 hasta la primera fila vacía (formato del cliente). */
async function leerExcel(archivo: File): Promise<FilaImportada[]> {
  const XLSX = await import('xlsx');
  const libro = XLSX.read(await archivo.arrayBuffer(), { type: 'array' });
  const hoja = libro.Sheets[libro.SheetNames[0]];
  const valores = XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1, raw: true, defval: null });
  const textos = XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1, raw: false, defval: '' });
  const filas: FilaImportada[] = [];
  for (let i = 1; i < valores.length; i++) {
    const v = valores[i] || [];
    const t = textos[i] || [];
    // La referencia se toma como texto formateado: "078.065" no debe convertirse en 78.065.
    const referencia = String(t[1] ?? '').trim();
    const vacia = (v[0] == null || v[0] === '') && !referencia;
    if (vacia) break;
    filas.push({
      fila: i + 1,
      cantidad: Number(v[0]) || 0,
      referencia,
      descripcion: String(t[2] ?? '').trim(),
      precio: Number(v[3]) || 0,
    });
  }
  return filas;
}

export function ImportarDialog({ abierto, archivoInicial, ctx, onCerrar, onPendientes, onApendice }: Props) {
  const { compra, esImportacion, sucio } = ctx;
  const categoria = CATEGORIAS_OPERACION.find((c) => c.valor === compra?.categoria_operacion)?.etiqueta;
  const [vista, setVista] = useState<Vista>({ tipo: 'inicio' });
  const [condicion, setCondicion] = useState('GRAVADA');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [sobre, setSobre] = useState(false);
  const [resExcel, setResExcel] = useState<ResultadoExcel | null>(null);
  const [resJson, setResJson] = useState<ResultadoJson | null>(null);
  const refExcel = useRef<HTMLInputElement>(null);
  const refJson = useRef<HTMLInputElement>(null);

  const reiniciar = useCallback(() => {
    setVista({ tipo: 'inicio' });
    setError('');
    setResExcel(null);
    setResJson(null);
  }, []);

  const cargarArchivo = useCallback(
    async (archivo: File) => {
      reiniciar();
      try {
        if (esJson(archivo.name)) {
          if (esImportacion) throw new Error('Una factura de importación no lleva DTE; para el JSON use un documento Crédito Fiscal o Factura');
          if (sucio) throw new Error('Guarde primero el encabezado: el JSON se acepta con el tipo de documento y la categoría ya elegidos');
          const crudo = JSON.parse(await archivo.text());
          const dte = parsearDte(crudo);
          if (dte.tipo_dte !== compra?.tipo_dte) {
            throw new Error(
              `El JSON es ${nombreTipoDte(dte.tipo_dte)} y el documento elegido es ${nombreTipoDte(compra?.tipo_dte)}; cambie el tipo y guarde antes de importar`
            );
          }
          setVista({ tipo: 'json', archivo: archivo.name, dte, crudo });
        } else if (esExcel(archivo.name)) {
          const filas = await leerExcel(archivo);
          if (filas.length === 0) throw new Error('No hay líneas desde la fila 2 (columnas A a D)');
          const total = r2(filas.reduce((s, f) => s + f.cantidad * f.precio, 0));
          setVista({ tipo: 'excel', archivo: archivo.name, filas, total });
        } else {
          throw new Error('Use un archivo Excel (.xlsx) o el JSON del DTE');
        }
      } catch (e) {
        setError((e as Error).message || 'No se pudo leer el archivo');
      }
    },
    [reiniciar, esImportacion, sucio, compra?.tipo_dte]
  );

  useEffect(() => {
    if (!abierto) return;
    setCondicion(esImportacion ? 'NO_SUJETO' : 'GRAVADA');
    if (archivoInicial) cargarArchivo(archivoInicial);
    else reiniciar();
  }, [abierto, archivoInicial, esImportacion, cargarArchivo, reiniciar]);

  useEffect(() => {
    if (!abierto) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [abierto, onCerrar]);

  const enviar = async (cuerpo: Record<string, unknown>) => {
    const res = await fetch('/api/compras/importar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idcompra: compra?.idcompra, ...cuerpo }),
    });
    return { status: res.status, data: await res.json() };
  };

  const importarExcel = async () => {
    if (vista.tipo !== 'excel' || enviando) return;
    setEnviando(true);
    setError('');
    try {
      const { status, data } = await enviar({ tipo: 'excel', condicion_iva: condicion, lineas: vista.filas });
      if (status !== 200) throw new Error(data.error || 'No se pudo importar');
      setResExcel({ ...data, total_excel: vista.total });
      await ctx.recargar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  const importarJson = async (reemplazar = false) => {
    if (vista.tipo !== 'json' || enviando) return;
    setEnviando(true);
    setError('');
    try {
      const { status, data } = await enviar({ tipo: 'json', dte: vista.crudo, reemplazar });
      if (status === 409 && data.requiere_confirmacion) {
        setEnviando(false);
        if (await confirmar(`La compra ya tiene ${data.lineas} línea(s). ¿Reemplazarlas con las del DTE?`)) {
          await importarJson(true);
        }
        return;
      }
      if (status !== 200) throw new Error(data.error || 'No se pudo importar');
      setResJson(data);
      await ctx.recargar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  const alSoltar = (e: React.DragEvent) => {
    e.preventDefault();
    setSobre(false);
    const archivo = e.dataTransfer.files?.[0];
    if (archivo) cargarArchivo(archivo);
  };

  if (!abierto) return null;

  const terminado = Boolean(resExcel || resJson);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh] bg-slate-900/40 dark:bg-black/60 backdrop-blur-[1px]" onMouseDown={onCerrar}>
      <div
        className={`${UI.densePanel} w-[min(52rem,94vw)] max-h-[84vh] flex flex-col shadow-xl`}
        onMouseDown={(e) => e.stopPropagation()}
        onDragOver={(e) => {
          e.preventDefault();
          setSobre(true);
        }}
        onDragLeave={() => setSobre(false)}
        onDrop={alSoltar}
      >
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
          <span className="text-sm font-semibold">Importar líneas</span>
          {vista.tipo !== 'inicio' && <span className="text-xs text-muted-foreground truncate">{vista.archivo}</span>}
          <button type="button" className="ml-auto p-1 rounded text-muted-foreground hover:bg-muted" onClick={onCerrar} title="Cerrar (Esc)">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-3 flex flex-col gap-3">
          <div
            className={`rounded-lg border-2 border-dashed px-4 py-4 flex flex-wrap items-center justify-center gap-3 text-xs ${
              sobre ? 'border-primary bg-primary/5' : 'border-border'
            }`}
          >
            <Upload className="w-5 h-5 text-muted-foreground" />
            <span className="text-muted-foreground">Arrastre aquí el Excel o el JSON del DTE, o elija:</span>
            <button type="button" className={UI.denseBtn} onClick={() => refExcel.current?.click()}>
              <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
            </button>
            <button type="button" className={UI.denseBtn} onClick={() => refJson.current?.click()} disabled={esImportacion}>
              <FileJson className="w-3.5 h-3.5" /> JSON DTE
            </button>
            <input
              ref={refExcel}
              type="file"
              accept=".xlsx,.xls,.xlsm,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) cargarArchivo(f);
                e.target.value = '';
              }}
            />
            <input
              ref={refJson}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) cargarArchivo(f);
                e.target.value = '';
              }}
            />
          </div>

          {error && (
            <div className={`${UI.avisoError} px-3 py-2 text-xs flex items-center gap-2`}>
              <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          {vista.tipo === 'inicio' && !error && (
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              <b>Excel:</b> columna A cantidad, B referencia del proveedor, C descripción y D precio, desde la fila 2 hasta la
              primera fila vacía. Solo se agregan las referencias que coinciden exactamente con un producto; las demás quedan en
              una lista para cargarlas a mano.
              <br />
              <b>JSON DTE:</b> llena encabezado, proveedor (por NIT o NRC), líneas, pagos y retenciones, y guarda el JSON original.
              Se acepta con el tipo y la categoría ya guardados (ahora: {nombreTipoDte(compra?.tipo_dte)} · {categoria}). Las líneas
              sin ficha entran sin tipo y se clasifican como express (con OT) o gasto antes de registrar.
            </p>
          )}

          {vista.tipo === 'excel' && !resExcel && (
            <>
              <div className="flex flex-wrap items-end gap-4 text-xs">
                <Dato etiqueta="Líneas" valor={String(vista.filas.length)} />
                <Dato etiqueta="Total Excel (A × D)" valor={`$${fmt2(vista.total)}`} fuerte />
                <label className="flex flex-col gap-0.5">
                  <span className={UI.denseLabel}>Condición IVA</span>
                  <select className={`${UI.denseSelect} w-32`} value={condicion} onChange={(e) => setCondicion(e.target.value)}>
                    {CONDICIONES_IVA_UI.map((c) => (
                      <option key={c.valor} value={c.valor}>{c.etiqueta}</option>
                    ))}
                  </select>
                </label>
                <button type="button" className={`${UI.denseBtnPrimary} ml-auto`} onClick={importarExcel} disabled={enviando}>
                  {enviando ? 'Importando…' : `Importar ${vista.filas.length} líneas`}
                </button>
              </div>
              <TablaFilas filas={vista.filas} />
            </>
          )}

          {resExcel && (
            <>
              <div className={`${UI.avisoOk} px-3 py-2 text-xs flex items-center gap-2`}>
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                Se agregaron {resExcel.insertadas} líneas. {resExcel.no_encontradas.length} sin coincidencia.
              </div>
              <div className="flex flex-wrap gap-4 text-xs">
                <Dato etiqueta="Total Excel" valor={`$${fmt2(resExcel.total_excel)}`} />
                <Dato etiqueta="Total enviado" valor={`$${fmt2(resExcel.total_enviado)}`} fuerte />
                <Dato
                  etiqueta="Diferencia (pendiente)"
                  valor={`$${fmt2(r2(resExcel.total_excel - resExcel.total_enviado))}`}
                  aviso={Math.abs(resExcel.total_excel - resExcel.total_enviado) > 0.005}
                />
              </div>
              {resExcel.no_encontradas.length > 0 && <TablaFilas filas={resExcel.no_encontradas} conMotivo />}
            </>
          )}

          {vista.tipo === 'json' && !resJson && (
            <>
              <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2 text-xs">
                <Dato etiqueta="Documento" valor={`${vista.dte.tipo_dte} · ${nombreTipoDte(vista.dte.tipo_dte)}`} />
                <Dato etiqueta="Fecha" valor={vista.dte.fecha_emision || '—'} />
                <Dato etiqueta="Emisor" valor={`${vista.dte.emisor.nombre} · NIT ${vista.dte.emisor.nit || '—'} · NRC ${vista.dte.emisor.nrc || '—'}`} />
                <Dato etiqueta="Receptor" valor={vista.dte.receptor.nombre || '—'} />
                <Dato etiqueta="No. de control" valor={vista.dte.numero_control || '—'} mono />
                <Dato etiqueta="Sello" valor={vista.dte.sello_recepcion || 'Sin sello'} mono aviso={!vista.dte.sello_recepcion} />
              </div>
              <div className="flex flex-wrap items-end gap-4 text-xs">
                <Dato etiqueta="Líneas" valor={String(vista.dte.lineas.length)} />
                <Dato etiqueta="Total a pagar (DTE)" valor={`$${fmt2(vista.dte.total_pagar)}`} fuerte />
                {vista.dte.total_no_gravado > 0 && <Dato etiqueta="No gravado" valor={`$${fmt2(vista.dte.total_no_gravado)}`} />}
                <button type="button" className={`${UI.denseBtnPrimary} ml-auto`} onClick={() => importarJson()} disabled={enviando}>
                  {enviando ? 'Importando…' : 'Importar DTE'}
                </button>
              </div>
              <TablaDte dte={vista.dte} />
              {vista.dte.apendice.length > 0 && <Apendice items={vista.dte.apendice} />}
            </>
          )}

          {resJson && (
            <>
              <div className={`${UI.avisoOk} px-3 py-2 text-xs flex items-center gap-2`}>
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                DTE importado: {resJson.lineas_insertadas} líneas ({resJson.lineas_con_producto} de inventario).
              </div>
              {resJson.avisos?.map((aviso) => (
                <div key={aviso} className={`${UI.avisoError} px-3 py-2 text-xs flex items-center gap-2`}>
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {aviso}
                </div>
              ))}
              {resJson.otros_tributos && resJson.otros_tributos.length > 0 && (
                <div className="text-xs text-muted-foreground px-1">
                  Otros tributos del DTE (suman al monto de la operación):{' '}
                  {resJson.otros_tributos.map((t) => `${t.descripcion || t.codigo} $${fmt2(t.valor)}`).join(' · ')}
                </div>
              )}
              {resJson.lineas_sin_clasificar > 0 && (
                <div className={`${UI.avisoError} px-3 py-2 text-xs flex items-center gap-2`}>
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {resJson.lineas_sin_clasificar} línea(s) sin ficha quedaron SIN TIPO. Clasifíquelas como express (con OT) o gasto
                  antes de registrar.
                </div>
              )}
              {!resJson.condicion_en_json && (
                <div className={`${UI.avisoError} px-3 py-2 text-xs flex items-center gap-2`}>
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  El JSON no trae la condición de pago: elíjala en el encabezado.
                </div>
              )}
              {!resJson.proveedor.encontrado && (
                <div className={`${UI.avisoError} px-3 py-2 text-xs flex items-center gap-2`}>
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  Proveedor no registrado: {resJson.proveedor.nombre} (NIT {resJson.proveedor.nit || '—'}, NRC {resJson.proveedor.nrc || '—'}).
                  Regístrelo en Proveedores y selecciónelo en la compra.
                </div>
              )}
              <div className="flex flex-wrap gap-4 text-xs">
                <Dato etiqueta="Total DTE" valor={`$${fmt2(resJson.total_json)}`} />
                <Dato etiqueta="Total en la compra" valor={`$${fmt2(resJson.total_compra)}`} fuerte />
                <Dato
                  etiqueta="Diferencia"
                  valor={`$${fmt2(r2(resJson.total_json - resJson.total_compra))}`}
                  aviso={Math.abs(resJson.total_json - resJson.total_compra) > 0.005}
                />
              </div>
              {resJson.apendice.length > 0 && (
                <Apendice
                  items={resJson.apendice}
                  onAgregar={(item) => {
                    onApendice(item);
                    onCerrar();
                  }}
                />
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-2 px-3 py-2 border-t border-border">
          {vista.tipo !== 'inicio' && (
            <button type="button" className={UI.denseBtn} onClick={reiniciar} disabled={enviando}>
              Otro archivo
            </button>
          )}
          <span className="ml-auto" />
          {resExcel && resExcel.no_encontradas.length > 0 ? (
            <button
              type="button"
              className={UI.denseBtnPrimary}
              onClick={() => {
                onPendientes(resExcel.no_encontradas);
                onCerrar();
              }}
            >
              Cargar pendientes a mano
            </button>
          ) : (
            <button type="button" className={terminado ? UI.denseBtnPrimary : UI.denseBtn} onClick={onCerrar}>
              {terminado ? 'Listo' : 'Cancelar'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Dato({
  etiqueta,
  valor,
  fuerte = false,
  aviso = false,
  mono = false,
}: {
  etiqueta: string;
  valor: string;
  fuerte?: boolean;
  aviso?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className={UI.denseLabel}>{etiqueta}</span>
      <span
        className={`truncate ${mono || fuerte ? UI.denseMono : ''} ${fuerte ? 'text-sm font-semibold' : ''} ${
          aviso ? 'text-amber-700 dark:text-amber-400' : ''
        }`}
        title={valor}
      >
        {valor}
      </span>
    </div>
  );
}

function TablaFilas({ filas, conMotivo = false }: { filas: FilaImportada[]; conMotivo?: boolean }) {
  return (
    <div className="rounded-md border border-border max-h-64 overflow-auto">
      <table className={UI.denseTable}>
        <thead>
          <tr>
            <th className={`${UI.denseTh} text-right`}>Fila</th>
            <th className={`${UI.denseTh} text-right`}>Cant.</th>
            <th className={UI.denseTh}>Referencia</th>
            <th className={`${UI.denseTh} w-full`}>Descripción</th>
            <th className={`${UI.denseTh} text-right`}>Precio</th>
            <th className={`${UI.denseTh} text-right`}>Total</th>
            {conMotivo && <th className={UI.denseTh}>Motivo</th>}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.fila}>
              <td className={`${UI.denseTd} ${UI.denseMono} text-right text-muted-foreground`}>{f.fila}</td>
              <td className={`${UI.denseTd} ${UI.denseMono} text-right`}>{f.cantidad}</td>
              <td className={`${UI.denseTd} ${UI.denseMono}`}>{f.referencia || '—'}</td>
              <td className={`${UI.denseTd} max-w-0 truncate`} title={f.descripcion}>{f.descripcion}</td>
              <td className={`${UI.denseTd} ${UI.denseMono} text-right`}>{fmt2(f.precio)}</td>
              <td className={`${UI.denseTd} ${UI.denseMono} text-right`}>{fmt2(f.cantidad * f.precio)}</td>
              {conMotivo && <td className={`${UI.denseTd} text-amber-700 dark:text-amber-400 whitespace-nowrap`}>{f.motivo}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TablaDte({ dte }: { dte: DteParseado }) {
  return (
    <div className="rounded-md border border-border max-h-48 overflow-auto">
      <table className={UI.denseTable}>
        <thead>
          <tr>
            <th className={`${UI.denseTh} text-right`}>#</th>
            <th className={UI.denseTh}>Código</th>
            <th className={`${UI.denseTh} w-full`}>Descripción</th>
            <th className={`${UI.denseTh} text-right`}>Cant.</th>
            <th className={`${UI.denseTh} text-right`}>Costo s/IVA</th>
            <th className={UI.denseTh}>Afectación</th>
          </tr>
        </thead>
        <tbody>
          {dte.lineas.map((l, i) => (
            <tr key={i}>
              <td className={`${UI.denseTd} ${UI.denseMono} text-right text-muted-foreground`}>{l.numItem}</td>
              <td className={`${UI.denseTd} ${UI.denseMono}`}>{l.codigo || '—'}</td>
              <td className={`${UI.denseTd} max-w-0 truncate`} title={l.descripcion}>{l.descripcion}</td>
              <td className={`${UI.denseTd} ${UI.denseMono} text-right`}>{l.cantidad}</td>
              <td className={`${UI.denseTd} ${UI.denseMono} text-right`}>{fmt2(l.costo_unitario)}</td>
              <td className={UI.denseTd}>{CONDICIONES_IVA_UI.find((c) => c.valor === l.condicion_iva)?.etiqueta || l.condicion_iva}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Apendice({ items, onAgregar }: { items: ApendiceDte[]; onAgregar?: (item: ApendiceDte) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <span className={UI.denseLabel}>
        Apéndice del emisor{onAgregar ? ' — los montos de cuenta ajena se agregan a mano como X comprobar' : ''}
      </span>
      <div className="rounded-md border border-border overflow-hidden">
        <table className={UI.denseTable}>
          <tbody>
            {items.map((a, i) => (
              <tr key={i}>
                <td className={`${UI.denseTd} ${UI.denseMono} text-muted-foreground whitespace-nowrap`}>{a.campo}</td>
                <td className={`${UI.denseTd} w-full`}>{a.etiqueta}</td>
                <td className={`${UI.denseTd} ${UI.denseMono} text-right whitespace-nowrap ${a.monto != null ? 'font-semibold' : 'text-muted-foreground'}`}>
                  {a.valor}
                </td>
                {onAgregar && (
                  <td className={`${UI.denseTd} text-right`}>
                    {a.monto != null && (
                      <button type="button" className={`${UI.denseBtn} h-6 whitespace-nowrap`} onClick={() => onAgregar(a)}>
                        X comprobar
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
