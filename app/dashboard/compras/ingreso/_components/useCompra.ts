'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { calcularFechaVencimiento, calcularResumen, type LineaResumen } from '@/lib/compras-resumen';
import { AVISOS_COMPRA, tipoDteRequiereRelacionados } from '@/lib/compras-constantes';
import type { Compra, DocRel, FormaPago, FormLinea, Linea, Pago, Rubro } from './tipos';

type Aviso = { tipo: 'ok' | 'error'; texto: string } | null;

async function pedir(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new Error(data.error || 'Error de conexión');
  }
  return data;
}

function mensajeError(e: unknown) {
  return e instanceof Error ? e.message : 'Error de conexión';
}

function json(method: string, body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

export function useCompra() {
  const [cargandoInicial, setCargandoInicial] = useState(true);
  const [cargando, setCargando] = useState(false);
  const [compra, setCompra] = useState<Compra | null>(null);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [docsRel, setDocsRel] = useState<DocRel[]>([]);
  const [rubros, setRubros] = useState<Rubro[]>([]);
  const [formasPago, setFormasPago] = useState<FormaPago[]>([]);
  const [sucio, setSucio] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);
  const timerAviso = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notificar = useCallback((tipo: 'ok' | 'error', texto: string) => {
    setAviso({ tipo, texto });
    if (timerAviso.current) clearTimeout(timerAviso.current);
    timerAviso.current = setTimeout(() => setAviso(null), 4500);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch('/api/catalogos-dte').then((r) => r.json()),
      fetch('/api/catalogo-contable?activo=true').then((r) => r.json()),
    ])
      .then(([cat, rub]) => {
        if (cat.success) setFormasPago(cat.formas_pago || []);
        if (rub.success) setRubros(rub.rubros || []);
      })
      .catch(() => {});
  }, []);

  const cargarLineas = useCallback(async (id: number) => {
    const data = await pedir(`/api/compras-detalle?idcompra=${id}`);
    setLineas(data.lineas || []);
  }, []);

  const cargarPagos = useCallback(async (id: number) => {
    const data = await pedir(`/api/compras-pagos?idcompra=${id}`);
    setPagos(data.pagos || []);
  }, []);

  const cargarDocsRel = useCallback(async (id: number) => {
    const data = await pedir(`/api/compras-documentos-rel?idcompra=${id}`);
    setDocsRel(data.documentos || []);
  }, []);

  const cargarTodo = useCallback(
    async (id: number) => {
      try {
        const [c] = await Promise.all([
          pedir(`/api/compras?id=${id}`),
          cargarLineas(id),
          cargarPagos(id),
          cargarDocsRel(id),
        ]);
        setCompra(c.compra);
        setSucio(false);
      } catch (e) {
        notificar('error', mensajeError(e));
      }
    },
    [cargarLineas, cargarPagos, cargarDocsRel, notificar]
  );

  const cerrar = useCallback(() => {
    setCompra(null);
    setLineas([]);
    setPagos([]);
    setDocsRel([]);
    setSucio(false);
  }, []);

  const abrir = useCallback(
    async (id: number) => {
      if (sucio && !confirm('Hay cambios sin guardar en el encabezado. ¿Descartarlos?')) return;
      setCargando(true);
      await cargarTodo(id);
      setCargando(false);
    },
    [sucio, cargarTodo]
  );

  useEffect(() => {
    let vigente = true;
    (async () => {
      try {
        let id = Number(new URLSearchParams(window.location.search).get('id')) || 0;
        if (!id) {
          const data = await pedir('/api/compras?estado=BORRADOR');
          id = data.compras?.[0]?.idcompra || 0;
        }
        if (id && vigente) await cargarTodo(id);
      } catch (e) {
        if (vigente) notificar('error', mensajeError(e));
      } finally {
        if (vigente) setCargandoInicial(false);
      }
    })();
    return () => {
      vigente = false;
    };
  }, [cargarTodo, notificar]);

  const patch = useCallback((parcial: Partial<Compra>) => {
    setCompra((prev) => {
      if (!prev) return prev;
      const siguiente = { ...prev, ...parcial };
      if (Number(siguiente.condicion_operacion) === 2) {
        siguiente.fecha_vencimiento_pago = calcularFechaVencimiento(
          siguiente.fecha_emision,
          siguiente.plazo_tipo || '01',
          Number(siguiente.plazo_periodo) || 0
        );
      } else {
        siguiente.fecha_vencimiento_pago = null;
      }
      return siguiente;
    });
    setSucio(true);
  }, []);

  const crear = useCallback(async () => {
    if (sucio && !confirm('Hay cambios sin guardar en el encabezado. ¿Descartarlos?')) return;
    try {
      const ahora = new Date();
      const hoy = new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
      const data = await pedir(
        '/api/compras',
        json('POST', { tipo_dte: '03', fecha_emision: hoy })
      );
      setSucio(false);
      setCargando(true);
      await cargarTodo(data.idcompra);
      setCargando(false);
      notificar('ok', `Borrador #${data.idcompra} creado`);
    } catch (e) {
      notificar('error', mensajeError(e));
    }
  }, [sucio, cargarTodo, notificar]);

  const cuerpoEncabezado = (c: Compra) => ({
    idcompra: c.idcompra,
    clase_documento: c.clase_documento,
    categoria_operacion: c.categoria_operacion,
    tipo_dte: c.tipo_dte,
    idproveedor: c.idproveedor,
    notas: c.notas,
    numero_control: c.numero_control,
    codigo_generacion: c.codigo_generacion,
    sello_recepcion: c.sello_recepcion,
    numero_factura: c.numero_factura,
    referencia_contable: c.referencia_contable,
    fecha_emision: c.fecha_emision ? String(c.fecha_emision).slice(0, 10) : null,
    fecha_recepcion: c.fecha_recepcion ? String(c.fecha_recepcion).slice(0, 10) : null,
    descuento_global_gravado: c.descuento_global_gravado,
    descuento_global_exento: c.descuento_global_exento,
    descuento_global_no_sujeto: c.descuento_global_no_sujeto,
    porcentaje_descuento: c.porcentaje_descuento,
    descuento_afecta_costo: Number(c.descuento_afecta_costo) ? 1 : 0,
    iva_retenido: c.iva_retenido,
    iva_percibido: c.iva_percibido,
    retencion_renta: c.retencion_renta,
    condicion_operacion: c.condicion_operacion,
    plazo_tipo: Number(c.condicion_operacion) === 2 ? c.plazo_tipo || '01' : null,
    plazo_periodo: Number(c.condicion_operacion) === 2 ? c.plazo_periodo : null,
    fecha_vencimiento_pago: c.fecha_vencimiento_pago ? String(c.fecha_vencimiento_pago).slice(0, 10) : null,
  });

  const accionEncabezado = useCallback(
    async (accion: 'actualizar' | 'registrar' | 'anular') => {
      if (!compra) return false;
      setOcupado(true);
      try {
        const cuerpo = accion === 'anular'
          ? { idcompra: compra.idcompra, accion }
          : { ...cuerpoEncabezado(compra), accion };
        const data = await pedir('/api/compras', json('PUT', cuerpo));
        notificar('ok', data.mensaje || 'Guardado');
        await cargarTodo(compra.idcompra);
        return true;
      } catch (e) {
        notificar('error', mensajeError(e));
        return false;
      } finally {
        setOcupado(false);
      }
    },
    [compra, cargarTodo, notificar]
  );

  const eliminarBorrador = useCallback(async () => {
    if (!compra || compra.estado !== 'BORRADOR') return;
    if (!confirm(`¿Eliminar el borrador #${compra.idcompra}?`)) return;
    try {
      await pedir(`/api/compras?id=${compra.idcompra}`, { method: 'DELETE' });
      cerrar();
      notificar('ok', 'Borrador eliminado');
    } catch (e) {
      notificar('error', mensajeError(e));
    }
  }, [compra, cerrar, notificar]);

  const guardarLinea = useCallback(
    async (form: FormLinea) => {
      if (!compra) return false;
      if (!form.descripcion.trim() && !form.idprod) {
        notificar('error', 'Seleccione un producto o escriba una descripción');
        return false;
      }
      if (Number(form.cantidad) <= 0) {
        notificar('error', 'La cantidad debe ser mayor que cero');
        return false;
      }
      const payload = {
        idcompra: compra.idcompra,
        numero_orden: form.numero_orden || null,
        destino: form.destino || null,
        iddetalle_origen: form.iddetalle_origen ?? null,
        idcatalogo: form.idcatalogo ? Number(form.idcatalogo) : null,
        idprod: form.idprod ? Number(form.idprod) : null,
        referencia_proveedor: form.referencia_proveedor || null,
        descripcion: form.descripcion,
        cantidad: Number(form.cantidad),
        costo_unitario: Number(form.costo_unitario) || 0,
        descuento_porcentaje: Number(form.descuento_porcentaje) || 0,
        condicion_iva: form.condicion_iva,
        numero_documento_rel: form.numero_documento_rel || null,
      };
      const nuevo = form.iddetalle === 0;
      try {
        await pedir(
          '/api/compras-detalle',
          json(nuevo ? 'POST' : 'PUT', nuevo ? payload : { ...payload, iddetalle: form.iddetalle })
        );
        await cargarLineas(compra.idcompra);
        return true;
      } catch (e) {
        notificar('error', mensajeError(e));
        return false;
      }
    },
    [compra, cargarLineas, notificar]
  );

  const eliminarLinea = useCallback(
    async (iddetalle: number) => {
      if (!compra || !confirm(AVISOS_COMPRA.eliminarItem)) return;
      try {
        await pedir(`/api/compras-detalle?id=${iddetalle}`, { method: 'DELETE' });
        await cargarLineas(compra.idcompra);
      } catch (e) {
        notificar('error', mensajeError(e));
      }
    },
    [compra, cargarLineas, notificar]
  );

  const reordenarLinea = useCallback(
    async (desde: number, hasta: number) => {
      if (!compra || desde === hasta) return;
      if (desde < 0 || hasta < 0 || desde >= lineas.length || hasta >= lineas.length) return;
      const orden = [...lineas];
      const [movida] = orden.splice(desde, 1);
      orden.splice(hasta, 0, movida);
      setLineas(orden.map((l, i) => ({ ...l, numero_linea: i + 1 })));
      try {
        await pedir(
          '/api/compras-detalle',
          json('PATCH', { idcompra: compra.idcompra, orden: orden.map((l) => l.iddetalle) })
        );
      } catch (e) {
        notificar('error', mensajeError(e));
      } finally {
        await cargarLineas(compra.idcompra);
      }
    },
    [compra, lineas, cargarLineas, notificar]
  );

  const agregarPago = useCallback(
    async (codigo: string, monto: number, referencia: string) => {
      if (!compra) return false;
      try {
        await pedir(
          '/api/compras-pagos',
          json('POST', {
            idcompra: compra.idcompra,
            codigo_forma_pago: codigo,
            monto,
            referencia: referencia || null,
          })
        );
        await cargarPagos(compra.idcompra);
        return true;
      } catch (e) {
        notificar('error', mensajeError(e));
        return false;
      }
    },
    [compra, cargarPagos, notificar]
  );

  const eliminarPago = useCallback(
    async (idpago: number) => {
      if (!compra) return;
      try {
        await pedir(`/api/compras-pagos?id=${idpago}`, { method: 'DELETE' });
        await cargarPagos(compra.idcompra);
      } catch (e) {
        notificar('error', mensajeError(e));
      }
    },
    [compra, cargarPagos, notificar]
  );

  const agregarDocRel = useCallback(
    async (doc: { tipo_dte_relacionado: string; tipo_generacion: number; numero_documento: string; fecha_generacion: string }) => {
      if (!compra) return false;
      if (!doc.numero_documento.trim() || !doc.fecha_generacion) {
        notificar('error', 'Indique número y fecha del documento relacionado');
        return false;
      }
      // El API valida el tipo guardado en BD: si cambió a NC/ND sin guardar, se guarda primero.
      if (sucio && !(await accionEncabezado('actualizar'))) return false;
      try {
        await pedir('/api/compras-documentos-rel', json('POST', { idcompra: compra.idcompra, ...doc }));
        await cargarDocsRel(compra.idcompra);
        return true;
      } catch (e) {
        notificar('error', mensajeError(e));
        return false;
      }
    },
    [compra, sucio, accionEncabezado, cargarDocsRel, notificar]
  );

  const eliminarDocRel = useCallback(
    async (idrelacion: number) => {
      if (!compra) return;
      try {
        await pedir(`/api/compras-documentos-rel?id=${idrelacion}`, { method: 'DELETE' });
        await cargarDocsRel(compra.idcompra);
      } catch (e) {
        notificar('error', mensajeError(e));
      }
    },
    [compra, cargarDocsRel, notificar]
  );

  const resumen = useMemo(() => {
    if (!compra) return null;
    return calcularResumen({
      lineas: lineas as LineaResumen[],
      descuento_global_gravado: Number(compra.descuento_global_gravado) || 0,
      descuento_global_exento: Number(compra.descuento_global_exento) || 0,
      descuento_global_no_sujeto: Number(compra.descuento_global_no_sujeto) || 0,
      porcentaje_descuento: Number(compra.porcentaje_descuento) || 0,
      iva_retenido: Number(compra.iva_retenido) || 0,
      iva_percibido: Number(compra.iva_percibido) || 0,
      retencion_renta: Number(compra.retencion_renta) || 0,
    });
  }, [compra, lineas]);

  const esBorrador = compra?.estado === 'BORRADOR';
  const esImportacion = compra?.clase_documento === 'IMPORTACION';
  const esNcNd = !esImportacion && tipoDteRequiereRelacionados(compra?.tipo_dte);

  return {
    cargandoInicial,
    cargando,
    compra,
    lineas,
    pagos,
    docsRel,
    rubros,
    formasPago,
    resumen,
    sucio,
    ocupado,
    aviso,
    esBorrador,
    esImportacion,
    esNcNd,
    notificar,
    recargar: () => (compra ? cargarTodo(compra.idcompra) : Promise.resolve()),
    recargarLineas: () => (compra ? cargarLineas(compra.idcompra) : Promise.resolve()),
    abrir,
    crear,
    patch,
    guardar: () => accionEncabezado('actualizar'),
    registrar: () => accionEncabezado('registrar'),
    anular: () => accionEncabezado('anular'),
    eliminarBorrador,
    guardarLinea,
    eliminarLinea,
    reordenarLinea,
    moverLinea: (index: number, direccion: -1 | 1) => reordenarLinea(index, index + direccion),
    agregarPago,
    eliminarPago,
    agregarDocRel,
    eliminarDocRel,
  };
}

export type CompraCtx = ReturnType<typeof useCompra>;
