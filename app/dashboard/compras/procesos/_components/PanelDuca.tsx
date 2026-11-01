'use client';
import { confirmar } from '@/components/ui/avisos';

import { useState } from 'react';
import { Calculator, CheckCheck, History, Lock, RotateCcw, Save } from 'lucide-react';
import { UI } from '@/lib/ui';
import { INCOTERMS } from '@/lib/documentos-compras-constantes';
import { Dato, InputBlur, fecha, fmt, num, type DetalleProceso, type Fila } from './comun';
import { Adjuntos } from './Adjuntos';

interface Props {
  detalle: DetalleProceso;
  editable: boolean;
  accion: (cuerpo: Record<string, unknown>) => Promise<boolean>;
  onHistorial: (idprod: number) => void;
}

/** `aduana`: se bloquea después del primer retaceo aplicado. */
const CAMPOS: { campo: string; etiqueta: string; tipo?: 'text' | 'date' | 'select'; aduana?: boolean }[] = [
  { campo: 'numero_duca', etiqueta: 'Número DUCA', tipo: 'text', aduana: true },
  { campo: 'fecha_duca', etiqueta: 'Fecha', tipo: 'date', aduana: true },
  { campo: 'mandamiento_pago', etiqueta: 'Mandamiento (NPE)', tipo: 'text', aduana: true },
  { campo: 'incoterm_duca', etiqueta: 'Incoterm', tipo: 'select', aduana: true },
  { campo: 'tipo_cambio_duca', etiqueta: 'Tipo de cambio Aduana', aduana: true },
  { campo: 'total_productos_duca', etiqueta: 'Total productos (FOB)', aduana: true },
  { campo: 'seguro_declarado', etiqueta: 'Seguro declarado', aduana: true },
  { campo: 'flete_declarado', etiqueta: 'Flete declarado', aduana: true },
  { campo: 'gastos_declarados', etiqueta: 'Otros gastos declarados', aduana: true },
  { campo: 'valor_cif_duca', etiqueta: 'Valor CIF', aduana: true },
  { campo: 'dai_pagado', etiqueta: 'DAI pagado', aduana: true },
  { campo: 'iva_pagado', etiqueta: 'IVA pagado', aduana: true },
  { campo: 'vts_pagado', etiqueta: 'VTS pagado', aduana: true },
  { campo: 'its_pagado', etiqueta: 'ITS pagado', aduana: true },
  { campo: 'otros_cargos_pagados', etiqueta: 'Otros cargos', aduana: true },
  { campo: 'total_pagado_duca', etiqueta: 'Total pagado DUCA', aduana: true },
  { campo: 'gastos_no_declarados', etiqueta: 'Gastos no declarados' },
  { campo: 'total_costos_operativos', etiqueta: 'Total costos operativos' },
  { campo: 'gasto_total_inversion', etiqueta: 'Gasto total inversión' },
  { campo: 'peso_carga', etiqueta: 'Peso', tipo: 'text' },
  { campo: 'volumen_carga', etiqueta: 'Volumen', tipo: 'text' },
];

function formDuca(duca: Fila | null) {
  return Object.fromEntries(
    [...CAMPOS.map((c) => c.campo), 'comentarios'].map((c) => {
      const v = duca?.[c];
      const tipo = CAMPOS.find((x) => x.campo === c)?.tipo;
      if (tipo === 'date') return [c, fecha(v)];
      if (tipo || c === 'comentarios') return [c, v == null ? '' : String(v)];
      return [c, v == null ? (c === 'tipo_cambio_duca' ? '1' : '0') : String(num(v))];
    })
  ) as Record<string, string>;
}

const diferencia = (a: number | null, b: number | null) => (a == null || b == null ? null : a - b);

function Diferencia({ valor }: { valor: number | null }) {
  if (valor == null) return <span className="text-muted-foreground">—</span>;
  const color = Math.abs(valor) < 0.01 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400';
  return <span className={color}>{fmt(valor)}</span>;
}

export function PanelDuca({ detalle, editable, accion, onHistorial }: Props) {
  const { duca, lineas, simulacion, proceso, inversion, impuestos, aduana_bloqueada } = detalle;
  const [form, setForm] = useState(() => formDuca(duca));
  const [base, setBase] = useState(duca);
  const [clave, setClave] = useState<string | null>(null);
  const [imagen, setImagen] = useState<{ url: string; titulo: string } | null>(null);
  if (duca !== base) {
    setBase(duca);
    setForm(formDuca(duca));
  }
  const calculo = new Map((simulacion?.lineas ?? []).map((l) => [Number(l.iddetalle), l]));
  const totalCif = num(simulacion?.total_grupo_cif);
  const cifPorPartida = new Map<string, number>();
  for (const l of lineas) {
    const partida = String(l.codigo_arancelario || '').trim() || `#${l.iddetalle}`;
    cifPorPartida.set(partida, (cifPorPartida.get(partida) || 0) + num(calculo.get(Number(l.iddetalle))?.subtotal_cif));
  }
  const cerrado = proceso.estado_documento === 'FINALIZADO';
  const tcAduana = num(duca?.tipo_cambio_duca) || num(proceso.tipo_cambio_pagado) || 1;

  const reabrir = async () => {
    if (!clave) return;
    if (await accion({ accion: 'reabrir', password: clave })) setClave(null);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className={UI.densePanel}>
        <div className={`${UI.densePanelTitle} flex items-center justify-between`}>
          <span className="flex items-center gap-1.5">
            Datos del DUCA {duca ? '' : '(sin capturar)'}
            {aduana_bloqueada && (
              <span className="inline-flex items-center gap-1 text-[10px] font-normal text-muted-foreground">
                <Lock className="h-3 w-3" /> lo de aduana quedó fijo con el primer retaceo
              </span>
            )}
          </span>
          {editable && (
            <button type="button" className={UI.denseBtn} onClick={() => accion({ accion: 'duca', ...form })}>
              <Save className="h-3.5 w-3.5" /> Guardar DUCA
            </button>
          )}
        </div>
        <div className="grid gap-2 p-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
          {CAMPOS.map(({ campo, etiqueta, tipo, aduana }) => {
            const bloqueado = !editable || (aduana && aduana_bloqueada);
            return (
              <label key={campo} className="flex flex-col gap-1">
                <span className={UI.denseLabel}>{etiqueta}</span>
                {tipo === 'select' ? (
                  <select className={UI.denseSelect} disabled={bloqueado} value={form[campo]} onChange={(e) => setForm({ ...form, [campo]: e.target.value })}>
                    <option value="">—</option>
                    {INCOTERMS.map((i) => (
                      <option key={i}>{i}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={tipo === 'date' ? 'date' : tipo === 'text' ? 'text' : 'number'}
                    step="any"
                    className={`${UI.denseInput} ${tipo ? '' : `text-right ${UI.denseMono}`}`}
                    disabled={bloqueado}
                    value={form[campo]}
                    onChange={(e) => setForm({ ...form, [campo]: e.target.value })}
                  />
                )}
              </label>
            );
          })}
          <label className="flex flex-col gap-1 col-span-2 sm:col-span-3 lg:col-span-4 2xl:col-span-6">
            <span className={UI.denseLabel}>Comentarios</span>
            <input className={UI.denseInput} disabled={!editable} value={form.comentarios} onChange={(e) => setForm({ ...form, comentarios: e.target.value })} />
          </label>
        </div>
        {duca?.nodocto ? (
          <div className="px-3 pb-2">
            <Adjuntos compacto titulo="Archivos del DUCA" destino={{ nodocto: Number(duca.nodocto) }} />
          </div>
        ) : null}
      </div>

      <div className="grid gap-2 xl:grid-cols-2">
        <div className={`${UI.densePanel} overflow-auto`}>
          <div className={UI.densePanelTitle}>Inversión real contra base de Hacienda</div>
          <table className={UI.denseTable}>
            <thead>
              <tr>
                <th className={UI.denseTh}>Concepto</th>
                <th className={`${UI.denseTh} text-right`}>Real (pagado)</th>
                <th className={`${UI.denseTh} text-right`}>Hacienda (DUCA)</th>
                <th className={`${UI.denseTh} text-right`}>Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {inversion.conceptos.map((c) => (
                <tr key={c.concepto}>
                  <td className={UI.denseTd}>
                    {c.concepto}
                    {c.categorias.length > 0 && c.concepto !== 'Mercadería (FOB)' && (
                      <span className="ml-1 text-[10px] text-muted-foreground">{c.categorias.join(', ')}</span>
                    )}
                  </td>
                  <td className={`${UI.denseTd} ${UI.denseMono} text-right`}>{fmt(c.real)}</td>
                  <td className={`${UI.denseTd} ${UI.denseMono} text-right`}>{c.hacienda == null ? '—' : fmt(c.hacienda)}</td>
                  <td className={`${UI.denseTd} ${UI.denseMono} text-right`}>
                    <Diferencia valor={diferencia(c.real, c.hacienda)} />
                  </td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className={UI.denseTd}>Total</td>
                <td className={`${UI.denseTd} ${UI.denseMono} text-right`}>{fmt(inversion.conceptos.reduce((s, c) => s + c.real, 0))}</td>
                <td className={`${UI.denseTd} ${UI.denseMono} text-right`}>{fmt(inversion.conceptos.reduce((s, c) => s + (c.hacienda ?? 0), 0))}</td>
                <td className={UI.denseTd} />
              </tr>
            </tbody>
          </table>
          <p className="px-3 py-1.5 text-[11px] text-muted-foreground">
            El costo del producto sale de lo real; los impuestos de Aduana, de la base de Hacienda. FOB real = facturas × TC banco.
          </p>
        </div>
        <div className={`${UI.densePanel} overflow-auto`}>
          <div className={UI.densePanelTitle}>Impuestos: calculado contra DUCA</div>
          <table className={UI.denseTable}>
            <thead>
              <tr>
                <th className={UI.denseTh}>Impuesto</th>
                <th className={`${UI.denseTh} text-right`}>Calculado</th>
                <th className={`${UI.denseTh} text-right`}>DUCA</th>
                <th className={`${UI.denseTh} text-right`}>Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {impuestos.map((i) => (
                <tr key={i.impuesto}>
                  <td className={UI.denseTd}>
                    {i.impuesto}
                    {i.calculado == null && <span className="ml-1 text-[10px] text-muted-foreground">informativo</span>}
                  </td>
                  <td className={`${UI.denseTd} ${UI.denseMono} text-right`}>{i.calculado == null ? '—' : fmt(i.calculado)}</td>
                  <td className={`${UI.denseTd} ${UI.denseMono} text-right`}>{i.duca == null ? '—' : fmt(i.duca)}</td>
                  <td className={`${UI.denseTd} ${UI.denseMono} text-right`}>
                    <Diferencia valor={i.duca ? diferencia(i.calculado, i.duca) : null} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-wrap gap-x-6 gap-y-1 px-3 py-1.5">
            <Dato etiqueta="TC Aduana" valor={fmt(tcAduana, 4)} />
            <Dato etiqueta="TC banco (pagado)" valor={fmt(proceso.tipo_cambio_pagado, 4)} />
          </div>
        </div>
      </div>

      <div className={`${UI.densePanel} flex flex-wrap items-end gap-x-6 gap-y-2 px-3 py-2`}>
        <Dato etiqueta="Total contable (Aduana)" valor={fmt(simulacion?.total_contable)} />
        <Dato etiqueta="CIF del grupo" valor={fmt(simulacion?.total_grupo_cif)} />
        <Dato etiqueta="DAI aplicado" valor={fmt(simulacion?.dai_aplicado)} />
        <Dato etiqueta="Gastos repartidos" valor={fmt(simulacion?.gastos_aplicados)} />
        <Dato etiqueta="Costo destino total" valor={fmt(simulacion?.total_destino)} fuerte />
        <div className="ml-auto flex gap-1.5">
          {editable && (
            <>
              <button type="button" className={UI.denseBtn} disabled={lineas.length === 0} onClick={() => accion({ accion: 'calcular' })}>
                <Calculator className="h-3.5 w-3.5" /> Guardar cálculo DUCA
              </button>
              <button
                type="button"
                className={UI.denseBtnPrimary}
                disabled={lineas.length === 0}
                onClick={async () => {
                  const resumen = proceso.fecha_retaceo
                    ? `¿Volver a aplicar el retaceo de ${proceso.codigo}? Se recalcula el costo sin duplicar el stock ya ingresado; solo entran las líneas nuevas.`
                    : `¿Aplicar el retaceo de ${proceso.codigo}? Entra al stock lo de ${new Set(lineas.map((l) => l.idprod)).size} producto(s), se actualizan sus costos y el proceso queda cerrado.`;
                  const nota = window.prompt('Comentario del retaceo (puede quedar vacío). Cancelar aborta.', '');
                  if (nota === null || !(await confirmar(resumen))) return;
                  accion({ accion: 'finalizar', comentario: nota.trim() });
                }}
              >
                <CheckCheck className="h-3.5 w-3.5" /> {proceso.fecha_retaceo ? 'Volver a aplicar' : 'Aplicar retaceo'}
              </button>
            </>
          )}
          {cerrado && (
            <button type="button" className={UI.denseBtn} onClick={() => setClave('')}>
              <RotateCcw className="h-3.5 w-3.5" /> Reabrir retaceo
            </button>
          )}
        </div>
      </div>

      <div className={`${UI.densePanel} overflow-auto`}>
        <div className={UI.densePanelTitle}>
          Productos de inventario de las facturas ({lineas.length}) · costo en {proceso.moneda_factura}
        </div>
        <table className={UI.denseTable}>
          <thead>
            <tr>
              <th className={UI.denseTh}>Factura / proveedor</th>
              <th className={UI.denseTh} />
              <th className={UI.denseTh}>Código</th>
              <th className={UI.denseTh}>Descripción</th>
              <th className={`${UI.denseTh} text-right`}>Cant.</th>
              <th className={`${UI.denseTh} text-right`}>Costo {proceso.moneda_factura}</th>
              <th className={UI.denseTh}>Partida</th>
              <th className={`${UI.denseTh} text-right`}>% DAI</th>
              <th className={`${UI.denseTh} text-center`} title="Tratado de libre comercio">
                TLC
              </th>
              <th className={`${UI.denseTh} text-right`}>CIF unit.</th>
              <th className={`${UI.denseTh} text-right`} title="Suma del CIF de las líneas con la misma partida">CIF grupo</th>
              <th className={`${UI.denseTh} text-right`}>DAI unit.</th>
              <th className={`${UI.denseTh} text-right`}>IVA unit.</th>
              <th className={`${UI.denseTh} text-right`}>Gastos unit.</th>
              <th className={`${UI.denseTh} text-right`}>Costo banco</th>
              <th className={`${UI.denseTh} text-right`} title="Reemplaza el costo pagado solo en casos raros">Corregido</th>
              <th className={`${UI.denseTh} text-right`}>Costo destino</th>
              <th className={`${UI.denseTh} text-right`}>Promedio</th>
            </tr>
          </thead>
          <tbody>
            {lineas.length === 0 ? (
              <tr>
                <td colSpan={18} className={`${UI.denseTd} py-6 text-center text-muted-foreground`}>
                  Vincule una factura (razón FACTURA) con productos de Inventario. Express no entra en un DUCA.
                </td>
              </tr>
            ) : (
              lineas.map((l) => {
                const c = calculo.get(Number(l.iddetalle));
                const aplicada = Number(l.stock_aplicado) === 1;
                const lineaEditable = editable && !aplicada;
                const guardarLinea = (cambios: Record<string, unknown>) =>
                  accion({
                    accion: 'linea_duca',
                    iddetalle: l.iddetalle,
                    codigo_arancelario: l.codigo_arancelario,
                    valor_dai: l.valor_dai,
                    dai_preferente: Number(l.dai_preferente) === 1,
                    ...cambios,
                  });
                return (
                  <tr key={String(l.iddetalle)} className="hover:bg-muted/40">
                    <td className={UI.denseTd}>
                      <div>{String(l.numero_factura || l.numero_interno || '')}</div>
                      <div className="max-w-[10rem] truncate text-[10px] text-muted-foreground" title={String(l.proveedor_nombre ?? '')}>
                        {String(l.proveedor_nombre ?? '')}
                      </div>
                    </td>
                    <td className={UI.denseTd}>
                      {l.imagen_url ? (
                        <button
                          type="button"
                          onClick={() => setImagen({ url: String(l.imagen_url), titulo: String(l.descripcion) })}
                          aria-label="Ver imagen"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={String(l.imagen_url)} alt="" className="h-7 w-7 rounded object-cover" />
                        </button>
                      ) : null}
                    </td>
                    <td className={UI.denseTd}>
                      {l.idprod ? (
                        <button type="button" className="inline-flex items-center gap-1 text-primary hover:underline" onClick={() => onHistorial(Number(l.idprod))}>
                          <History className="h-3 w-3" />
                          <span className={UI.denseMono}>{String(l.idprod)}</span>
                        </button>
                      ) : (
                        <span className="text-red-600 dark:text-red-400" title="Sin producto de inventario">
                          —
                        </span>
                      )}
                      {aplicada && <div className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">EN STOCK</div>}
                    </td>
                    <td className={`${UI.denseTd} max-w-[16rem] truncate`} title={String(l.descripcion)}>
                      {String(l.descripcion)}
                    </td>
                    <td className={`${UI.denseTd} ${UI.denseMono} text-right`}>{fmt(l.cantidad, 0)}</td>
                    <td className={`${UI.denseTd} ${UI.denseMono} text-right`}>{fmt(l.costo_divisa, 4)}</td>
                    <td className={UI.denseTd}>
                      <InputBlur
                        valor={l.codigo_arancelario}
                        disabled={!lineaEditable}
                        className="w-24"
                        placeholder="Partida"
                        onGuardar={(v) => guardarLinea({ codigo_arancelario: v })}
                      />
                    </td>
                    <td className={UI.denseTd}>
                      <div className="flex items-center gap-1">
                        <InputBlur tipo="number" valor={l.valor_dai} disabled={!lineaEditable} className="w-16" onGuardar={(v) => guardarLinea({ valor_dai: v })} />
                        {Number(l.dai_de_ficha) === 1 && (
                          <span className="text-[9px] text-muted-foreground" title="Tomado de la ficha del producto">
                            ficha
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={`${UI.denseTd} text-center`}>
                      <input
                        type="checkbox"
                        disabled={!lineaEditable}
                        checked={Number(l.dai_preferente) === 1}
                        onChange={(e) => guardarLinea({ dai_preferente: e.target.checked, ...(e.target.checked ? { valor_dai: 0 } : {}) })}
                      />
                    </td>
                    <td className={`${UI.denseTd} ${UI.denseMono} text-right`}>{fmt(c?.costo_cif, 4)}</td>
                    <td
                      className={`${UI.denseTd} ${UI.denseMono} text-right`}
                      title={totalCif ? `${fmt((num(c?.subtotal_cif) / totalCif) * 100)} % del embarque` : ''}
                    >
                      {fmt(cifPorPartida.get(String(l.codigo_arancelario || '').trim() || `#${l.iddetalle}`))}
                    </td>
                    <td className={`${UI.denseTd} ${UI.denseMono} text-right`}>{fmt(c?.dai_unitario, 4)}</td>
                    <td className={`${UI.denseTd} ${UI.denseMono} text-right`}>{fmt(c?.iva_unitario, 4)}</td>
                    <td className={`${UI.denseTd} ${UI.denseMono} text-right`}>{fmt(c?.gastos_unitario, 4)}</td>
                    <td className={`${UI.denseTd} ${UI.denseMono} text-right`}>{fmt(c?.costo_pagado_usd, 4)}</td>
                    <td className={UI.denseTd}>
                      <InputBlur
                        tipo="number"
                        valor={l.costo_corregido}
                        disabled={!lineaEditable}
                        className="w-24"
                        placeholder="Raro"
                        onGuardar={(v) => accion({ accion: 'linea_duca', iddetalle: l.iddetalle, costo_corregido: v })}
                      />
                    </td>
                    <td className={`${UI.denseTd} ${UI.denseMono} text-right font-semibold`}>{fmt(c?.costo_destino, 4)}</td>
                    <td className={`${UI.denseTd} ${UI.denseMono} text-right text-muted-foreground`}>
                      {l.costo_destino_prom == null ? '—' : fmt(l.costo_destino_prom, 4)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground px-1">
        CIF = costo a TC de Aduana + seguro, flete y otros gastos declarados repartidos por valor. Partida y % DAI salen de la ficha del producto hasta que se
        cambien aquí; con TLC el DAI baja a 0 (o al % del tratado). Si el DUCA trae el DAI pagado, ese total se reparte con el mismo peso. El IVA
        es crédito fiscal y no entra al costo. Costo destino = costo banco + (gastos + DAI) por unidad.
      </p>

      {clave !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setClave(null)}>
          <div className={`${UI.densePanel} w-full max-w-sm`} onClick={(e) => e.stopPropagation()}>
            <div className={UI.densePanelTitle}>Reabrir retaceo de {proceso.codigo}</div>
            <div className="flex flex-col gap-2 p-3">
              <p className="text-xs text-muted-foreground">
                Sirve para agregar un gasto o documento olvidado. Lo de aduana queda fijo; al volver a aplicar se recalcula el costo sin sumar de
                nuevo el stock.
              </p>
              <label className="flex flex-col gap-1">
                <span className={UI.denseLabel}>Su contraseña</span>
                <input
                  type="password"
                  autoFocus
                  className={UI.denseInput}
                  value={clave}
                  onChange={(e) => setClave(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && reabrir()}
                />
              </label>
              <div className="flex justify-end gap-1.5">
                <button type="button" className={UI.denseBtn} onClick={() => setClave(null)}>
                  Cancelar
                </button>
                <button type="button" className={UI.denseBtnPrimary} disabled={!clave} onClick={reabrir}>
                  <RotateCcw className="h-3.5 w-3.5" /> Reabrir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {imagen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 cursor-zoom-out"
          onClick={() => setImagen(null)}
          role="dialog"
          aria-label={imagen.titulo}
        >
          <div className={`${UI.densePanel} max-w-3xl p-2`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagen.url} alt={imagen.titulo} className="max-h-[75vh] max-w-full object-contain rounded" />
            <p className="mt-1 text-xs text-muted-foreground truncate">{imagen.titulo}</p>
          </div>
        </div>
      )}
    </div>
  );
}
