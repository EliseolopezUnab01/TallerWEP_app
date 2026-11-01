'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Eraser, FileUp, Plus, Save, Search, X } from 'lucide-react';
import { UI } from '@/lib/ui';
import { IVA_TASA, calcularLinea, requiereCatalogo, tipoCatalogoEsperado, type CondicionIva } from '@/lib/compras-detalle';
import { AVISOS_COMPRA, CATEGORIAS_OPERACION, destinoPermitido, destinosDeCategoria } from '@/lib/compras-constantes';
import { r8 } from '@/lib/decimales';
import { GloboStock, useDisponibilidad } from '@/components/ui/globo-stock';
import type { CompraCtx } from './useCompra';
import {
  CONDICIONES_IVA_UI,
  DESTINOS_UI,
  fmt2,
  fmt4,
  formLineaVacia,
  type FormLinea,
  type ProductoHit,
} from './tipos';

/** Con el check "IVA incluido" el valor digitado trae IVA; se guarda sin IVA. */
export function costoSinIva(form: Pick<FormLinea, 'costo_unitario' | 'iva_incluido' | 'condicion_iva'>): number {
  const valor = Number(form.costo_unitario) || 0;
  if (!form.iva_incluido || form.condicion_iva !== 'GRAVADA') return valor;
  return r8(valor / (1 + IVA_TASA));
}

const METODOS = [
  { valor: 'referencia', etiqueta: 'Referencia', filtros: 'referencia' },
  { valor: 'codigo', etiqueta: 'Código', filtros: 'idprod,codigo' },
  { valor: 'oem', etiqueta: 'OEM', filtros: 'oem' },
  { valor: 'alias', etiqueta: 'Alias / descripción', filtros: 'nombre,descripcion,etiquetas' },
  { valor: 'todo', etiqueta: 'Todos', filtros: '' },
];

interface Props {
  ctx: CompraCtx;
  form: FormLinea;
  setForm: (f: FormLinea) => void;
  ivaDefault: string;
  setIvaDefault: (v: string) => void;
  onExistencia: (stock: number | null) => void;
  onImportar: () => void;
}

export function PanelInventario({ ctx, form, setForm, ivaDefault, setIvaDefault, onExistencia, onImportar }: Props) {
  const { compra, esBorrador, esImportacion, rubros } = ctx;
  const bloqueado = !compra || !esBorrador;
  const categoria = compra?.categoria_operacion;

  const [filtro, setFiltro] = useState('');
  const [metodo, setMetodo] = useState('referencia');
  const [resultados, setResultados] = useState<ProductoHit[]>([]);
  const [cargando, setCargando] = useState(false);
  const [seleccionado, setSeleccionado] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [imagen, setImagen] = useState<{ url: string; titulo: string } | null>(null);
  const refCantidad = useRef<HTMLInputElement>(null);
  const refFiltro = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = filtro.trim();
    if (q.length < 2) return;
    const filtros = METODOS.find((m) => m.valor === metodo)?.filtros || '';
    let vigente = true;
    const t = setTimeout(async () => {
      setCargando(true);
      try {
        const params = new URLSearchParams({ search: q, limit: '40', con_proveedor: '1' });
        if (filtros) params.set('filters', filtros);
        const res = await fetch(`/api/productos?${params}`);
        const data = await res.json();
        if (vigente) setResultados(data.products || []);
      } catch {
        if (vigente) setResultados([]);
      } finally {
        if (vigente) setCargando(false);
      }
    }, 250);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [filtro, metodo]);

  const rubrosDestino = useMemo(() => {
    const tipo = tipoCatalogoEsperado(form.destino);
    return tipo ? rubros.filter((r) => r.tipo === tipo) : [];
  }, [rubros, form.destino]);

  const costoNeto = costoSinIva(form);
  const calculo = useMemo(
    () =>
      calcularLinea({
        cantidad: Number(form.cantidad) || 0,
        costo_unitario: costoNeto,
        descuento_porcentaje: Number(form.descuento_porcentaje) || 0,
        condicion_iva: form.condicion_iva as CondicionIva,
      }),
    [form.cantidad, costoNeto, form.descuento_porcentaje, form.condicion_iva]
  );

  const nombreCategoria = CATEGORIAS_OPERACION.find((c) => c.valor === categoria)?.etiqueta || categoria;
  const permitido = (destino: string) => destinoPermitido(categoria, destino) && !(esImportacion && destino === 'EXPRESS');
  const destinoInicial = destinosDeCategoria(categoria).find(permitido) || 'INVENTARIO';

  // Solo la línea nueva toma el destino de la categoría; las guardadas no se mueven solas.
  useEffect(() => {
    if (!bloqueado && form.iddetalle === 0 && !form.idprod && form.destino && !permitido(form.destino)) {
      setForm({ ...form, destino: destinoInicial, numero_orden: '', idcatalogo: '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoria, esImportacion]);

  // Destino con que se guardó la línea en edición: una de inventario no puede pasar a express.
  const [destinoGuardado, setDestinoGuardado] = useState('');
  useEffect(() => {
    setDestinoGuardado(form.iddetalle ? form.destino : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.iddetalle]);
  const bloqueaExpress = (destino: string) => destinoGuardado === 'INVENTARIO' && destino === 'EXPRESS';

  const tomarProducto = (p: ProductoHit, enfocar: boolean) => {
    setSeleccionado(p.idprod);
    onExistencia(p.stock_contable == null ? null : Number(p.stock_contable));
    if (bloqueado) return;
    if (form.iddetalle_origen) {
      ctx.notificar('error', 'Esta línea viene de la factura original; solo se cambia la cantidad o el costo');
      return;
    }
    if (!permitido('INVENTARIO')) {
      ctx.notificar('error', `Un documento ${nombreCategoria} no admite productos de inventario`);
      return;
    }
    setForm({
      ...form,
      idprod: String(p.idprod),
      descripcion: p.nombre,
      referencia_proveedor: p.idprodprov || '',
      referencia_oem: p.OE || '',
      costo_unitario: Number(p.costo) > 0 ? String(Number(p.costo)) : form.costo_unitario,
      iva_incluido: Number(p.costo) > 0 ? false : form.iva_incluido,
      destino: 'INVENTARIO',
      idcatalogo: '',
      numero_orden: '',
    });
    if (enfocar) setTimeout(() => refCantidad.current?.select(), 0);
  };

  const limpiar = () => {
    setForm(formLineaVacia(ivaDefault, destinoInicial));
    setSeleccionado(null);
    onExistencia(null);
  };

  const enviar = async () => {
    if (bloqueado || guardando) return;
    if (!form.destino) {
      ctx.notificar('error', AVISOS_COMPRA.tipoProducto);
      return;
    }
    if (!permitido(form.destino)) {
      ctx.notificar(
        'error',
        esImportacion && form.destino === 'EXPRESS'
          ? 'Una importación no admite productos express'
          : `Un documento ${nombreCategoria} no admite esa línea`
      );
      return;
    }
    if (form.destino === 'INVENTARIO' && !form.idprod) {
      ctx.notificar('error', 'Los productos de inventario se eligen desde el buscador');
      return;
    }
    if (requiereCatalogo(form.destino) && !form.idcatalogo) {
      ctx.notificar('error', `Seleccione el rubro contable para ${form.destino === 'GASTOS' ? 'gasto' : 'activo'}`);
      return;
    }
    if (form.iddetalle && !confirm(AVISOS_COMPRA.confirmarCambios)) return;
    setGuardando(true);
    const ok = await ctx.guardarLinea({ ...form, costo_unitario: String(costoNeto), iva_incluido: false });
    setGuardando(false);
    if (ok) {
      limpiar();
      refFiltro.current?.focus();
    }
  };

  const alEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
      e.preventDefault();
      enviar();
    }
    if (e.key === 'Escape') limpiar();
  };

  const set = (parcial: Partial<FormLinea>) => setForm({ ...form, ...parcial });

  const cambiarDestino = (destino: string) => {
    if (bloqueaExpress(destino)) {
      ctx.notificar('error', 'Una línea de inventario no puede pasar a express; bórrela y agréguela de nuevo');
      return;
    }
    if (destino === 'INVENTARIO' && !form.idprod) {
      ctx.notificar('error', 'Para inventario elija el producto en el buscador');
      refFiltro.current?.focus();
    }
    set({
      destino,
      idcatalogo: requiereCatalogo(destino) ? form.idcatalogo : '',
      numero_orden: destino === 'EXPRESS' || destino === 'GASTOS' ? form.numero_orden : '',
      ...(destino === 'INVENTARIO' ? {} : { idprod: '' }),
      ...(destino === 'EXPRESS' || destino === 'GASTOS' || destino === 'INVENTARIO' ? {} : { referencia_oem: '' }),
    });
  };
  const ordenHabilitada = (form.destino === 'EXPRESS' || form.destino === 'GASTOS') && !esImportacion;
  const ordenObligatoria = form.destino === 'EXPRESS';
  const esInventario = form.destino === 'INVENTARIO';

  const productos = filtro.trim().length >= 2 ? resultados : [];
  const disponibilidad = useDisponibilidad(productos.map((p) => p.idprod));
  const editando = form.iddetalle !== 0;
  const conRubro = requiereCatalogo(form.destino);

  return (
    <div className={`${UI.densePanel} flex flex-col min-w-0`}>
      {/* 15–19 */}
      <div className="flex flex-wrap items-center gap-2 px-2.5 py-1.5 border-b border-border">
        <span className={`${UI.densePanelTitle} border-0 p-0`}>Producto</span>
        <button
          type="button"
          disabled={bloqueado}
          className={UI.denseBtn}
          onClick={onImportar}
          title="Importar líneas desde Excel o JSON DTE"
        >
          <FileUp className="w-3.5 h-3.5" /> Importar
        </button>
        <label className="flex items-center gap-1.5 flex-1 min-w-[10rem]">
          <span className={UI.denseLabel}>Ir a</span>
          <span className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              ref={refFiltro}
              className={`${UI.denseInput} w-full pl-7`}
              placeholder="Mín. 2 caracteres"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && productos[0]) {
                  e.preventDefault();
                  tomarProducto(productos[0], true);
                }
              }}
            />
          </span>
        </label>
        <select
          aria-label="Método de filtrado"
          className={`${UI.denseSelect} w-32`}
          value={metodo}
          onChange={(e) => setMetodo(e.target.value)}
          title="Método de filtrado"
        >
          {METODOS.map((m) => (
            <option key={m.valor} value={m.valor}>{m.etiqueta}</option>
          ))}
        </select>
        <select
          aria-label="Condición IVA por defecto"
          className={`${UI.denseSelect} w-28`}
          value={ivaDefault}
          onChange={(e) => {
            setIvaDefault(e.target.value);
            if (!editando) set({ condicion_iva: e.target.value });
          }}
          title="Condición IVA por defecto"
        >
          {CONDICIONES_IVA_UI.map((c) => (
            <option key={c.valor} value={c.valor}>{c.etiqueta}</option>
          ))}
        </select>
      </div>

      {/* 20 */}
      <div className="basis-56 grow overflow-auto">
        <table className={UI.denseTable}>
          <thead>
            <tr>
              <th className={UI.denseTh}>Código</th>
              <th className={UI.denseTh}>Referencia</th>
              <th className={UI.denseTh}>OEM</th>
              <th className={`${UI.denseTh} w-full`}>Descripción</th>
              <th className={`${UI.denseTh} text-right`}>Costo</th>
              <th className={`${UI.denseTh} text-right`}>Stock</th>
              <th className={UI.denseTh} title="Proveedor de la última compra registrada">
                Proveedor
              </th>
              <th className={`${UI.denseTh} text-center`}>Imagen</th>
              <th className={`${UI.denseTh} text-right`} title="% DAI de la ficha del producto">DAI</th>
              <th className={UI.denseTh} title="Partida arancelaria de la ficha">Cód. aranc.</th>
            </tr>
          </thead>
          <tbody>
            {productos.map((p) => (
              <tr
                key={p.idprod}
                className={seleccionado === p.idprod ? UI.denseRowActive : UI.denseRow}
                onClick={() => tomarProducto(p, false)}
                onDoubleClick={() => tomarProducto(p, true)}
              >
                <td className={`${UI.denseTd} ${UI.denseMono}`}>{p.idprod}</td>
                <td className={`${UI.denseTd} ${UI.denseMono}`}>{p.idprodprov || '—'}</td>
                <td className={`${UI.denseTd} ${UI.denseMono} max-w-[8rem] truncate`} title={p.OE || ''}>{p.OE || '—'}</td>
                <td className={`${UI.denseTd} max-w-0 truncate`} title={p.nombre}>{p.nombre}</td>
                <td className={`${UI.denseTd} ${UI.denseMono} text-right`}>{fmt2(p.costo)}</td>
                <td className={`${UI.denseTd} ${UI.denseMono} text-right`}>
                  <span className="inline-flex items-center gap-1">
                    <GloboStock idprod={p.idprod} datos={disponibilidad[p.idprod]} />
                    {Number(p.stock_contable || 0)}
                  </span>
                </td>
                <td className={`${UI.denseTd} max-w-[7rem] truncate`} title={p.marca ? `Marca: ${p.marca}` : undefined}>
                  {p.proveedor_nombre || '—'}
                </td>
                <td className={`${UI.denseTd} text-center`} onClick={(e) => e.stopPropagation()}>
                  {p.imagen_principal ? (
                    <button
                      type="button"
                      className="inline-block h-7 w-7 overflow-hidden rounded border border-border"
                      onClick={() => setImagen({ url: p.imagen_principal as string, titulo: p.nombre })}
                      aria-label="Ver imagen"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.imagen_principal} alt="" className="h-full w-full object-cover" />
                    </button>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className={`${UI.denseTd} ${UI.denseMono} text-right text-muted-foreground`}>
                  {p.porcentaje_dai == null ? '—' : `${Number(p.porcentaje_dai)} %`}
                </td>
                <td className={`${UI.denseTd} ${UI.denseMono} text-muted-foreground`}>{p.codarancel || '—'}</td>
              </tr>
            ))}
            {productos.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center text-[11px] text-muted-foreground">
                  {cargando
                    ? 'Buscando…'
                    : filtro.trim().length < 2
                      ? 'Escriba en "Ir a" para buscar. Clic carga el producto en la línea; doble clic o Enter salta a cantidad.'
                      : 'Sin resultados'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 21–29 */}
      <fieldset
        disabled={bloqueado}
        onKeyDown={alEnter}
        className={`border-t border-border px-2.5 py-2 ${editando ? 'bg-amber-50 dark:bg-amber-500/5' : 'bg-muted/40'}`}
      >
        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_10.5rem]">
          <div className="grid grid-cols-12 gap-1 items-end">
            <Celda
              etiqueta={ordenObligatoria ? 'Orden de trabajo *' : 'Orden de trabajo'}
              className="col-span-3"
              title="Express: obligatoria para registrar. Gasto: opcional. No aplica a inventario ni a importaciones."
            >
              <input
                className={`${UI.denseInput} w-full ${ordenObligatoria && !form.numero_orden ? 'border-amber-400 dark:border-amber-500/60' : ''}`}
                disabled={!ordenHabilitada}
                placeholder={ordenHabilitada ? (ordenObligatoria ? 'OT obligatoria' : 'OT (opcional)') : esImportacion ? 'Solo nacional' : 'No aplica'}
                value={form.numero_orden}
                onChange={(e) => set({ numero_orden: e.target.value })}
              />
            </Celda>
            <Celda etiqueta="Rf. proveedor" className="col-span-4">
              <input
                className={`${UI.denseInput} ${UI.denseMono} w-full`}
                value={form.referencia_proveedor}
                onChange={(e) => set({ referencia_proveedor: e.target.value })}
              />
            </Celda>
            <Celda etiqueta="Rf. OEM" className="col-span-5">
              <input
                className={`${UI.denseInput} ${UI.denseMono} w-full`}
                disabled={bloqueado || (form.destino !== 'EXPRESS' && form.destino !== 'GASTOS')}
                placeholder={form.destino === 'EXPRESS' || form.destino === 'GASTOS' ? 'Referencia OEM' : 'De la ficha'}
                value={form.referencia_oem}
                onChange={(e) => set({ referencia_oem: e.target.value })}
              />
            </Celda>

            <Celda etiqueta={form.destino === 'EXPRESS' ? 'Cód. express' : 'Código'} className="col-span-2">
              <input
                className={`${UI.denseInput} ${UI.denseMono} w-full`}
                disabled
                value={form.destino === 'EXPRESS' ? form.codigo_express || '' : form.idprod}
                placeholder={form.destino === 'EXPRESS' ? 'Al agregar' : '—'}
              />
            </Celda>
            <Celda etiqueta="Descripción" className="col-span-10">
              <input
                className={`${UI.denseInput} w-full`}
                value={form.descripcion}
                readOnly={esInventario}
                title={esInventario ? 'Los productos de inventario se eligen desde el buscador' : undefined}
                placeholder={
                  esInventario
                    ? 'Elija el producto en el buscador'
                    : conRubro
                      ? 'Concepto del gasto o activo'
                      : 'Descripción del producto express'
                }
                onChange={(e) => set({ descripcion: e.target.value })}
              />
            </Celda>

            <Celda etiqueta="Cantidad" className="col-span-2">
              <input
                ref={refCantidad}
                type="number"
                step="any"
                min={0}
                className={`${UI.denseInput} ${UI.denseMono} w-full text-right`}
                value={form.cantidad}
                onChange={(e) => set({ cantidad: e.target.value })}
              />
            </Celda>
            <Celda
              etiqueta={form.iva_incluido ? 'Costo c/IVA' : 'Costo s/IVA'}
              className="col-span-4"
              title={form.iva_incluido && form.condicion_iva === 'GRAVADA' ? `Se guardará sin IVA: ${fmt4(costoNeto)}` : undefined}
            >
              <input
                type="number"
                step="any"
                min={0}
                className={`${UI.denseInput} ${UI.denseMono} w-full text-right`}
                value={form.costo_unitario}
                placeholder="0.0000"
                onChange={(e) => set({ costo_unitario: e.target.value })}
              />
            </Celda>
            <label
              className="col-span-2 flex items-center gap-1 text-[11px] h-7 cursor-pointer select-none"
              title="Marque si el precio digitado ya trae el 13% de IVA"
            >
              <input
                type="checkbox"
                className="accent-primary"
                checked={form.iva_incluido}
                onChange={(e) => set({ iva_incluido: e.target.checked })}
              />
              IVA incl.
            </label>
            <Celda etiqueta="Desc. %" className="col-span-2">
              <input
                type="number"
                step="any"
                min={0}
                max={100}
                className={`${UI.denseInput} ${UI.denseMono} w-full text-right`}
                value={form.descuento_porcentaje}
                title="Se resta del subtotal antes de calcular el IVA"
                onChange={(e) => set({ descuento_porcentaje: e.target.value })}
              />
            </Celda>
            <Celda etiqueta="IVA" className="col-span-2">
              <select className={`${UI.denseSelect} w-full`} value={form.condicion_iva} onChange={(e) => set({ condicion_iva: e.target.value })}>
                {CONDICIONES_IVA_UI.map((c) => (
                  <option key={c.valor} value={c.valor}>{c.etiqueta}</option>
                ))}
              </select>
            </Celda>
          </div>

          <div className="flex flex-col gap-1">
            <span className={UI.denseLabel}>Destino</span>
            <div role="radiogroup" aria-label="Destino" className="grid grid-cols-2 md:grid-cols-1 gap-0.5 rounded-md border border-border bg-card px-2 py-1">
              {DESTINOS_UI.map((d) => {
                const habilitado = permitido(d.valor) && !form.iddetalle_origen && !bloqueaExpress(d.valor);
                return (
                  <label
                    key={d.valor}
                    className={`flex items-center gap-1.5 text-xs ${habilitado ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}
                    title={
                      habilitado
                        ? undefined
                        : bloqueaExpress(d.valor)
                          ? 'Una línea de inventario no puede pasar a express'
                          : esImportacion && d.valor === 'EXPRESS'
                            ? 'Una importación no admite productos express'
                            : `Un documento ${nombreCategoria} no admite esta línea`
                    }
                  >
                    <input
                      type="radio"
                      name="destino-linea"
                      className="accent-primary"
                      disabled={!habilitado}
                      checked={form.destino === d.valor}
                      onChange={() => cambiarDestino(d.valor)}
                    />
                    {d.etiqueta}
                  </label>
                );
              })}
            </div>
            <select
              aria-label="Rubro contable"
              className={`${UI.denseSelect} w-full`}
              disabled={!conRubro}
              value={form.idcatalogo}
              onChange={(e) => {
                const rubro = rubrosDestino.find((r) => String(r.idcatalogo) === e.target.value);
                set({
                  idcatalogo: e.target.value,
                  ...(rubro?.condicion_iva_sugerida ? { condicion_iva: rubro.condicion_iva_sugerida } : {}),
                });
              }}
              title="Rubro contable (29.1)"
            >
              <option value="">{conRubro ? 'Rubro contable…' : 'Rubro: no aplica'}</option>
              {rubrosDestino.map((r) => (
                <option key={r.idcatalogo} value={r.idcatalogo}>{r.codigo} · {r.nombre}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-2">
          <span className={UI.denseLabel}>
            {editando ? 'Editando línea — Enter guarda, Esc cancela' : 'Enter agrega · Esc limpia'}
          </span>
          <span className={`text-[11px] ${UI.denseMono} text-muted-foreground ml-auto`}>
            {Number(form.descuento_porcentaje) > 0 && <>Desc. {fmt2(r8(Number(form.cantidad || 0) * costoNeto - calculo.subtotal_sin_iva))} · </>}
            Subtotal {fmt2(calculo.subtotal_sin_iva)} · IVA {fmt2(calculo.iva_unitario * (Number(form.cantidad) || 0))} · Total {fmt2(calculo.subtotal_con_iva)}
          </span>
          <button type="button" className={UI.denseBtn} onClick={limpiar} title="Limpiar (Esc)" aria-label="Limpiar">
            <Eraser className="w-3.5 h-3.5" />
          </button>
          <button type="button" className={`${UI.denseBtnPrimary} min-w-[6.5rem] justify-center`} onClick={enviar} disabled={guardando}>
            {editando ? <Save className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {editando ? 'Actualizar' : 'Agregar'}
          </button>
        </div>
      </fieldset>
      {imagen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 cursor-zoom-out"
          onClick={() => setImagen(null)}
          role="dialog"
          aria-label={imagen.titulo}
        >
          <div className={`${UI.densePanel} max-w-3xl p-2 relative`}>
            <button type="button" className="absolute top-1 right-1 p-1 rounded bg-card/80 text-muted-foreground" aria-label="Cerrar imagen">
              <X className="w-4 h-4" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagen.url} alt={imagen.titulo} className="max-h-[75vh] max-w-full object-contain rounded" />
            <p className="mt-1 text-xs text-muted-foreground truncate">{imagen.titulo}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Celda({
  etiqueta,
  children,
  className = '',
  title,
}: {
  etiqueta: string;
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <label className={`flex flex-col gap-0.5 min-w-0 ${className}`} title={title}>
      <span className={UI.denseLabel}>{etiqueta}</span>
      {children}
    </label>
  );
}
