import { NextRequest, NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2/promise';
import { connectDB } from '@/lib/db';
import {
  AVISOS_COMPRA,
  esCategoriaOperacion,
  esTipoDteCompra,
  tipoDteRequiereRelacionados,
} from '@/lib/compras-constantes';
import { calcularFechaVencimiento, calcularResumen, type LineaResumen } from '@/lib/compras-resumen';
import { nuevoNodocto, siguienteCorrelativo } from '@/lib/correlativos';
import { errorDestinoLinea, type CompraReglas } from '@/lib/compras-detalle-db';
import { aplicarStockAlRegistrar, revertirStockAlAnular } from '@/lib/compras-stock';
import { erroresTopeNota } from '@/lib/compras-nota';

const CLASES_DOCUMENTO = ['DTE', 'IMPORTACION'] as const;

/** Errores de las líneas contra la categoría y la clase del documento (máx. 3 mensajes distintos). */
async function erroresDeLineas(
  connection: Awaited<ReturnType<typeof connectDB>>,
  idcompra: number,
  reglas: CompraReglas
) {
  const [lineas] = await connection.execute<RowDataPacket[]>(
    'SELECT numero_linea, destino, idprod FROM compras_detalle WHERE idcompra = ? ORDER BY numero_linea',
    [idcompra]
  );
  const porMensaje = new Map<string, number[]>();
  for (const l of lineas) {
    const error = errorDestinoLinea(reglas, { destino: l.destino, idprod: l.idprod ? Number(l.idprod) : null });
    if (error) porMensaje.set(error, [...(porMensaje.get(error) || []), Number(l.numero_linea)]);
  }
  return [...porMensaje.entries()].slice(0, 3).map(([m, nums]) => `${m} (línea ${nums.join(', ')})`);
}

function limpiar(valor: unknown) {
  if (valor === undefined || valor === null) return null;
  const texto = String(valor).trim();
  return texto === '' ? null : texto;
}

function aNumero(valor: unknown, defecto = 0): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : defecto;
}

const CAMPOS_ENCABEZADO = [
  'idproveedor',
  'clase_documento',
  'categoria_operacion',
  'notas',
  'tipo_dte',
  'numero_control',
  'codigo_generacion',
  'sello_recepcion',
  'numero_factura',
  'referencia_contable',
  'fecha_emision',
  'fecha_recepcion',
  'fecha_registro',
  'descuento_global_gravado',
  'descuento_global_exento',
  'descuento_global_no_sujeto',
  'porcentaje_descuento',
  'iva_retenido',
  'iva_percibido',
  'retencion_renta',
  'condicion_operacion',
  'plazo_tipo',
  'plazo_periodo',
  'fecha_vencimiento_pago',
] as const;

async function recalcularTotales(
  connection: Awaited<ReturnType<typeof connectDB>>,
  idcompra: number,
  extras: {
    descuento_global_gravado?: number;
    descuento_global_exento?: number;
    descuento_global_no_sujeto?: number;
    porcentaje_descuento?: number;
    iva_retenido?: number;
    iva_percibido?: number;
    retencion_renta?: number;
  } = {}
) {
  const [lineas] = await connection.execute<RowDataPacket[]>(
    `SELECT condicion_iva, subtotal_sin_iva, iva_unitario, cantidad, costo_unitario,
            descuento_porcentaje, cargos_no_afectos
     FROM compras_detalle WHERE idcompra = ?`,
    [idcompra]
  );

  const [encabezado]: any = await connection.execute(
    `SELECT descuento_global_gravado, descuento_global_exento, descuento_global_no_sujeto,
            porcentaje_descuento, iva_retenido, iva_percibido, retencion_renta
     FROM compras WHERE idcompra = ?`,
    [idcompra]
  );

  const base = encabezado[0] || {};
  const resumen = calcularResumen({
    lineas: lineas as LineaResumen[],
    descuento_global_gravado: extras.descuento_global_gravado ?? aNumero(base.descuento_global_gravado),
    descuento_global_exento: extras.descuento_global_exento ?? aNumero(base.descuento_global_exento),
    descuento_global_no_sujeto: extras.descuento_global_no_sujeto ?? aNumero(base.descuento_global_no_sujeto),
    porcentaje_descuento: extras.porcentaje_descuento ?? aNumero(base.porcentaje_descuento),
    iva_retenido: extras.iva_retenido ?? aNumero(base.iva_retenido),
    iva_percibido: extras.iva_percibido ?? aNumero(base.iva_percibido),
    retencion_renta: extras.retencion_renta ?? aNumero(base.retencion_renta),
  });

  await connection.execute(
    `UPDATE compras SET
       total_gravado = ?, total_exento = ?, total_no_sujeto = ?, total_xcomprobar = ?,
       suma_operaciones = ?, total_descuento = ?, sub_total = ?, iva = ?,
       monto_total_operacion = ?, total_cargos_no_afectos = ?, total_pagar = ?,
       valor_en_letras = ?
     WHERE idcompra = ?`,
    [
      resumen.total_gravado,
      resumen.total_exento,
      resumen.total_no_sujeto,
      resumen.total_xcomprobar,
      resumen.suma_operaciones,
      resumen.total_descuento,
      resumen.sub_total,
      resumen.iva,
      resumen.monto_total_operacion,
      resumen.total_cargos_no_afectos,
      resumen.total_pagar,
      resumen.valor_en_letras,
      idcompra,
    ]
  );

  return resumen;
}

function extraerEncabezado(body: Record<string, unknown>) {
  const datos: Record<string, unknown> = {};

  if (body.idproveedor !== undefined) {
    datos.idproveedor =
      body.idproveedor === null || body.idproveedor === '' ? null : Number(body.idproveedor);
  }
  if (body.clase_documento !== undefined) {
    const clase = String(body.clase_documento);
    datos.clase_documento = (CLASES_DOCUMENTO as readonly string[]).includes(clase) ? clase : 'DTE';
  }
  if (body.categoria_operacion !== undefined) {
    const categoria = String(body.categoria_operacion);
    datos.categoria_operacion = esCategoriaOperacion(categoria) ? categoria : 'CONTABLE';
  }
  if (body.notas !== undefined) datos.notas = limpiar(body.notas);
  if (body.tipo_dte !== undefined) datos.tipo_dte = limpiar(body.tipo_dte);
  if (body.numero_control !== undefined) datos.numero_control = limpiar(body.numero_control);
  if (body.codigo_generacion !== undefined) datos.codigo_generacion = limpiar(body.codigo_generacion);
  if (body.sello_recepcion !== undefined) datos.sello_recepcion = limpiar(body.sello_recepcion);
  if (body.numero_factura !== undefined) datos.numero_factura = limpiar(body.numero_factura);
  if (body.referencia_contable !== undefined) {
    datos.referencia_contable = limpiar(body.referencia_contable);
  }
  if (body.fecha_emision !== undefined) datos.fecha_emision = limpiar(body.fecha_emision);
  if (body.fecha_recepcion !== undefined) datos.fecha_recepcion = limpiar(body.fecha_recepcion);
  if (body.fecha_registro !== undefined) datos.fecha_registro = limpiar(body.fecha_registro);

  const numericos = [
    'descuento_global_gravado',
    'descuento_global_exento',
    'descuento_global_no_sujeto',
    'porcentaje_descuento',
    'iva_retenido',
    'iva_percibido',
    'retencion_renta',
  ] as const;
  for (const campo of numericos) {
    if (body[campo] !== undefined) datos[campo] = aNumero(body[campo]);
  }

  if (body.condicion_operacion !== undefined) {
    const c = body.condicion_operacion === null || body.condicion_operacion === '' ? 0 : Number(body.condicion_operacion);
    datos.condicion_operacion = [1, 2, 3].includes(c) ? c : null;
  }
  if (body.plazo_tipo !== undefined) datos.plazo_tipo = limpiar(body.plazo_tipo);
  if (body.plazo_periodo !== undefined) {
    datos.plazo_periodo = body.plazo_periodo === null || body.plazo_periodo === ''
      ? null
      : Number(body.plazo_periodo);
  }
  if (body.fecha_vencimiento_pago !== undefined) {
    datos.fecha_vencimiento_pago = limpiar(body.fecha_vencimiento_pago);
  }

  if (datos.clase_documento === 'IMPORTACION') {
    datos.tipo_dte = null;
    datos.numero_control = null;
    datos.sello_recepcion = null;
  }

  return datos;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const estado = searchParams.get('estado');
  const tipo_dte = searchParams.get('tipo_dte');
  const q = searchParams.get('q');

  let connection;
  try {
    connection = await connectDB();

    if (id) {
      const [rows]: any = await connection.execute(
        `SELECT c.*, p.codigo AS proveedor_codigo, p.nombre_legal AS proveedor_nombre,
                p.nrc AS proveedor_nrc, p.nit AS proveedor_nit,
                t.nombre AS tipo_dte_nombre, t.abreviatura AS tipo_dte_abrev,
                pi.codigo AS proceso_codigo,
                COALESCE(o.numero_factura, o.numero_interno) AS origen_numero
         FROM compras c
         LEFT JOIN proveedores p ON p.idproveedor = c.idproveedor
         LEFT JOIN cat_tipos_dte t ON t.codigo = c.tipo_dte
         LEFT JOIN proceso_ingreso pi ON pi.idproceso = c.idproceso
         LEFT JOIN compras o ON o.idcompra = c.idcompra_origen
         WHERE c.idcompra = ?`,
        [id]
      );
      await connection.end();

      if (rows.length === 0) {
        return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 });
      }
      return NextResponse.json({ success: true, compra: rows[0] });
    }

    const filtros: string[] = [];
    const valores: unknown[] = [];

    if (estado) {
      filtros.push('c.estado = ?');
      valores.push(estado);
    }
    if (tipo_dte) {
      filtros.push('c.tipo_dte = ?');
      valores.push(tipo_dte);
    }
    if (q) {
      filtros.push(
        `(c.numero_factura LIKE ? OR c.codigo_generacion LIKE ? OR p.nombre_legal LIKE ?
          OR p.codigo LIKE ? OR c.numero_interno LIKE ? OR c.nodocto LIKE ?)`
      );
      const like = `%${q}%`;
      valores.push(like, like, like, like, like, like);
    }

    const where = filtros.length > 0 ? `WHERE ${filtros.join(' AND ')}` : '';

    const [rows]: any = await connection.execute(
      `SELECT c.idcompra, c.nodocto, c.numero_interno, c.clase_documento, c.categoria_operacion,
              c.estado, c.tipo_dte, c.idproveedor, c.notas,
              c.numero_factura, c.fecha_emision, c.total_pagar, c.total_gravado,
              c.created_at, c.updated_at,
              p.codigo AS proveedor_codigo, p.nombre_legal AS proveedor_nombre,
              t.abreviatura AS tipo_dte_abrev,
              (SELECT COUNT(*) FROM compras_detalle d WHERE d.idcompra = c.idcompra) AS total_lineas
       FROM compras c
       LEFT JOIN proveedores p ON p.idproveedor = c.idproveedor
       LEFT JOIN cat_tipos_dte t ON t.codigo = c.tipo_dte
       ${where}
       ORDER BY c.updated_at DESC
       LIMIT 200`,
      valores
    );

    await connection.end();
    return NextResponse.json({ success: true, compras: rows });
  } catch (error: any) {
    if (connection) await connection.end();
    console.error('Error al obtener compras:', error);
    return NextResponse.json(
      { error: 'Error al obtener compras', detalle: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  let connection;
  try {
    const body = await request.json();
    connection = await connectDB();

    const datos = extraerEncabezado(body);

    if (datos.tipo_dte && !esTipoDteCompra(datos.tipo_dte)) {
      await connection.end();
      return NextResponse.json({ error: 'Tipo de DTE no válido para compras nacionales' }, { status: 400 });
    }

    if (datos.idproveedor) {
      const [prov]: any = await connection.execute(
        'SELECT idproveedor FROM proveedores WHERE idproveedor = ?',
        [datos.idproveedor]
      );
      if (prov.length === 0) {
        await connection.end();
        return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });
      }
    }

    if (
      !datos.fecha_vencimiento_pago &&
      Number(datos.condicion_operacion) === 2 &&
      datos.fecha_emision
    ) {
      datos.fecha_vencimiento_pago = calcularFechaVencimiento(
        String(datos.fecha_emision),
        datos.plazo_tipo as string | null,
        datos.plazo_periodo as number | null
      );
    }

    datos.nodocto = await nuevoNodocto(connection);
    datos.numero_interno = (
      await siguienteCorrelativo(connection, datos.clase_documento === 'IMPORTACION' ? 'CI' : 'CP')
    ).codigo;

    const columnas = [
      'estado',
      'nodocto',
      'numero_interno',
      ...CAMPOS_ENCABEZADO.filter((c) => datos[c] !== undefined),
    ];
    const valores = columnas.map((c) => (c === 'estado' ? 'BORRADOR' : datos[c]));

    const [resultado]: any = await connection.execute(
      `INSERT INTO compras (${columnas.join(', ')}) VALUES (${columnas.map(() => '?').join(', ')})`,
      valores
    );

    await connection.end();
    return NextResponse.json({
      success: true,
      idcompra: resultado.insertId,
      nodocto: datos.nodocto,
      numero_interno: datos.numero_interno,
      mensaje: 'Borrador de compra creado',
    });
  } catch (error: any) {
    if (connection) await connection.end();
    console.error('Error al crear compra:', error);
    return NextResponse.json(
      { error: 'Error al crear compra', detalle: error.message },
      { status: 500 }
    );
  }
}

/** Un borrador que cambia entre nacional e importación toma un número de la serie correcta (CP / CI). */
async function ajustarNumeroInterno(
  connection: Awaited<ReturnType<typeof connectDB>>,
  compra: { clase_documento?: string; numero_interno?: string | null; fecha_emision?: string | Date | null },
  datos: Record<string, unknown>
) {
  const clase = (datos.clase_documento as string | undefined) ?? compra.clase_documento ?? 'DTE';
  const serie = clase === 'IMPORTACION' ? 'CI' : 'CP';
  if (compra.numero_interno?.startsWith(serie)) return;
  const fecha = datos.fecha_emision || compra.fecha_emision;
  const { codigo } = await siguienteCorrelativo(connection, serie, fecha ? new Date(fecha as string) : new Date());
  datos.numero_interno = codigo;
}

export async function PUT(request: NextRequest) {
  let connection;
  try {
    const body = await request.json();

    if (!body.idcompra) {
      return NextResponse.json({ error: 'Falta idcompra' }, { status: 400 });
    }

    const accion = body.accion ? String(body.accion) : 'actualizar';
    connection = await connectDB();

    const [existente]: any = await connection.execute(
      'SELECT * FROM compras WHERE idcompra = ?',
      [body.idcompra]
    );

    if (existente.length === 0) {
      await connection.end();
      return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 });
    }

    const compra = existente[0];

    if (accion === 'recalcular') {
      const resumen = await recalcularTotales(connection, Number(body.idcompra));
      await connection.end();
      return NextResponse.json({ success: true, resumen, mensaje: 'Totales recalculados' });
    }

    if (accion === 'anular') {
      if (compra.estado !== 'REGISTRADA') {
        await connection.end();
        return NextResponse.json(
          { error: 'Solo se pueden anular compras en estado REGISTRADA' },
          { status: 400 }
        );
      }
      if (compra.idproceso) {
        const [proc] = await connection.execute<RowDataPacket[]>(
          'SELECT codigo, estado_documento FROM proceso_ingreso WHERE idproceso = ?',
          [compra.idproceso]
        );
        if (proc[0]?.estado_documento === 'FINALIZADO') {
          await connection.end();
          return NextResponse.json(
            { error: `La factura es parte del proceso ${proc[0].codigo} con retaceo aplicado; reabra el retaceo primero` },
            { status: 400 }
          );
        }
      }
      const [notas] = await connection.execute<RowDataPacket[]>(
        "SELECT COALESCE(numero_factura, numero_interno) AS numero FROM compras WHERE idcompra_origen = ? AND estado = 'REGISTRADA'",
        [body.idcompra]
      );
      if (notas.length > 0) {
        await connection.end();
        return NextResponse.json(
          { error: `Tiene notas registradas sobre esta factura (${notas.map((n) => n.numero).join(', ')}); anúlelas primero` },
          { status: 400 }
        );
      }
      await connection.beginTransaction();
      const productos = await revertirStockAlAnular(connection, Number(body.idcompra));
      await connection.execute(
        "UPDATE compras SET estado = 'ANULADA' WHERE idcompra = ?",
        [body.idcompra]
      );
      await connection.commit();
      await connection.end();
      return NextResponse.json({
        success: true,
        mensaje: productos ? `Compra anulada; se revirtió el stock de ${productos} producto(s)` : 'Compra anulada',
      });
    }

    if (compra.estado !== 'BORRADOR') {
      await connection.end();
      return NextResponse.json(
        { error: 'Solo se pueden editar compras en estado BORRADOR' },
        { status: 400 }
      );
    }

    if (accion === 'registrar') {
      const errores: string[] = [];
      const claseFinal = body.clase_documento ?? compra.clase_documento ?? 'DTE';
      const categoriaFinal = body.categoria_operacion ?? compra.categoria_operacion ?? 'CONTABLE';
      const tipoDteFinal = claseFinal === 'IMPORTACION' ? null : body.tipo_dte ?? compra.tipo_dte;

      const condicionElegida =
        body.condicion_operacion !== undefined ? body.condicion_operacion : compra.condicion_operacion;
      if (![1, 2, 3].includes(Number(condicionElegida))) {
        await connection.end();
        return NextResponse.json({ error: AVISOS_COMPRA.condicion }, { status: 400 });
      }
      const [sinTipo] = await connection.execute<RowDataPacket[]>(
        'SELECT numero_linea FROM compras_detalle WHERE idcompra = ? AND destino IS NULL ORDER BY numero_linea',
        [body.idcompra]
      );
      if (sinTipo.length > 0) {
        await connection.end();
        return NextResponse.json(
          {
            error: `${AVISOS_COMPRA.tipoProducto} (línea ${sinTipo.map((l) => l.numero_linea).join(', ')})`,
          },
          { status: 400 }
        );
      }

      if (claseFinal === 'DTE' && !tipoDteFinal) errores.push('Tipo de DTE');
      if (claseFinal === 'IMPORTACION' && !compra.numero_factura && !body.numero_factura) {
        errores.push('Número de factura del proveedor');
      }
      errores.push(
        ...(await erroresDeLineas(connection, Number(body.idcompra), {
          categoria_operacion: categoriaFinal,
          clase_documento: claseFinal,
          tipo_dte: tipoDteFinal,
        }))
      );
      const [incompletas] = await connection.execute<RowDataPacket[]>(
        `SELECT
           GROUP_CONCAT(IF(destino = 'EXPRESS' AND (numero_orden IS NULL OR numero_orden = ''), numero_linea, NULL)) AS sin_orden,
           GROUP_CONCAT(IF(destino IN ('GASTOS','ACTIVOS') AND idcatalogo IS NULL, numero_linea, NULL)) AS sin_rubro
         FROM compras_detalle WHERE idcompra = ?`,
        [body.idcompra]
      );
      if (incompletas[0]?.sin_orden) errores.push(`Orden de trabajo en las líneas express (línea ${incompletas[0].sin_orden})`);
      if (incompletas[0]?.sin_rubro) errores.push(`Rubro contable en los gastos o activos (línea ${incompletas[0].sin_rubro})`);
      if (tipoDteFinal === '05' || tipoDteFinal === '06') {
        if (!compra.idcompra_origen) errores.push('Factura original de la nota');
        if (tipoDteFinal === '05') errores.push(...(await erroresTopeNota(connection, Number(body.idcompra))));
      }
      if (!compra.idproveedor && !body.idproveedor) errores.push('Proveedor');
      if (!compra.fecha_emision && !body.fecha_emision) errores.push('Fecha de emisión');

      const [lineas] = await connection.execute<RowDataPacket[]>(
        'SELECT COUNT(*) AS total FROM compras_detalle WHERE idcompra = ?',
        [body.idcompra]
      );
      if (Number(lineas[0].total) === 0) errores.push('Al menos una línea');

      const tipoFinal = body.tipo_dte || compra.tipo_dte;
      if (tipoDteRequiereRelacionados(tipoFinal)) {
        const [rels]: any = await connection.execute(
          'SELECT COUNT(*) AS total FROM compras_documentos_rel WHERE idcompra = ?',
          [body.idcompra]
        );
        if (Number(rels[0].total) === 0) {
          errores.push('Documento relacionado (obligatorio para NC/ND)');
        }
      }

      const condicion = Number(condicionElegida);
      if (condicion === 2) {
        const plazoTipo = body.plazo_tipo ?? compra.plazo_tipo;
        const plazoPeriodo = body.plazo_periodo ?? compra.plazo_periodo;
        if (!plazoTipo || !plazoPeriodo) errores.push('Plazo de crédito');
      }

      if (errores.length > 0) {
        await connection.end();
        return NextResponse.json(
          { error: `Faltan datos para registrar: ${errores.join(', ')}` },
          { status: 400 }
        );
      }

      const datos = extraerEncabezado(body);
      if (datos.tipo_dte && !esTipoDteCompra(datos.tipo_dte)) {
        await connection.end();
        return NextResponse.json({ error: 'Tipo de DTE no válido' }, { status: 400 });
      }
      await ajustarNumeroInterno(connection, compra, datos);

      if (!datos.fecha_registro) {
        datos.fecha_registro = new Date().toISOString().slice(0, 10);
      }

      const fechaEmision = (datos.fecha_emision as string) || compra.fecha_emision;
      const plazoTipo = (datos.plazo_tipo as string) || compra.plazo_tipo;
      const plazoPeriodo = (datos.plazo_periodo as number) || compra.plazo_periodo;
      if (condicion === 2 && !datos.fecha_vencimiento_pago) {
        datos.fecha_vencimiento_pago = calcularFechaVencimiento(fechaEmision, plazoTipo, plazoPeriodo);
      }

      const campos = Object.keys(datos);
      if (campos.length > 0) {
        await connection.execute(
          `UPDATE compras SET ${campos.map((c) => `${c} = ?`).join(', ')} WHERE idcompra = ?`,
          [...campos.map((c) => datos[c]), body.idcompra]
        );
      }

      await recalcularTotales(connection, Number(body.idcompra), {
        descuento_global_gravado: datos.descuento_global_gravado as number | undefined,
        descuento_global_exento: datos.descuento_global_exento as number | undefined,
        descuento_global_no_sujeto: datos.descuento_global_no_sujeto as number | undefined,
        porcentaje_descuento: datos.porcentaje_descuento as number | undefined,
        iva_retenido: datos.iva_retenido as number | undefined,
        iva_percibido: datos.iva_percibido as number | undefined,
        retencion_renta: datos.retencion_renta as number | undefined,
      });

      await connection.beginTransaction();
      await connection.execute(
        "UPDATE compras SET estado = 'REGISTRADA' WHERE idcompra = ?",
        [body.idcompra]
      );
      const productos = await aplicarStockAlRegistrar(connection, Number(body.idcompra));
      await connection.commit();

      await connection.end();
      const efecto = tipoDteFinal === '05' ? 'se restó del' : 'se sumó al';
      return NextResponse.json({
        success: true,
        mensaje: productos ? `Compra registrada; ${efecto} stock de ${productos} producto(s)` : 'Compra registrada',
      });
    }

    const datos = extraerEncabezado(body);
    if (datos.tipo_dte && !esTipoDteCompra(datos.tipo_dte)) {
      await connection.end();
      return NextResponse.json({ error: 'Tipo de DTE no válido para compras nacionales' }, { status: 400 });
    }
    const cambiaCategoria =
      (datos.categoria_operacion !== undefined && datos.categoria_operacion !== compra.categoria_operacion) ||
      (datos.clase_documento !== undefined && datos.clase_documento !== compra.clase_documento);
    if (cambiaCategoria) {
      const errores = await erroresDeLineas(connection, Number(body.idcompra), {
        categoria_operacion: String(datos.categoria_operacion ?? compra.categoria_operacion),
        clase_documento: String(datos.clase_documento ?? compra.clase_documento),
      });
      if (errores.length > 0) {
        await connection.end();
        return NextResponse.json(
          { error: `No se puede cambiar: ${errores.join('; ')}. Cambie o elimine esas líneas primero.` },
          { status: 400 }
        );
      }
    }
    const cambiaProveedor =
      compra.idcompra_origen && datos.idproveedor !== undefined && Number(datos.idproveedor) !== Number(compra.idproveedor);
    const dejaDeSerNota =
      datos.tipo_dte !== undefined && !tipoDteRequiereRelacionados(datos.tipo_dte as string | null) && compra.idcompra_origen;
    if (cambiaProveedor || dejaDeSerNota) {
      const [deOrigen] = await connection.execute<RowDataPacket[]>(
        'SELECT COUNT(*) AS total FROM compras_detalle WHERE idcompra = ? AND iddetalle_origen IS NOT NULL',
        [body.idcompra]
      );
      if (Number(deOrigen[0].total) > 0) {
        await connection.end();
        return NextResponse.json(
          { error: 'La nota tiene líneas cargadas de la factura original; elimínelas antes de cambiar el proveedor o el tipo' },
          { status: 400 }
        );
      }
      datos.idcompra_origen = null;
    }
    await ajustarNumeroInterno(connection, compra, datos);

    if (datos.idproveedor) {
      const [prov]: any = await connection.execute(
        'SELECT idproveedor FROM proveedores WHERE idproveedor = ?',
        [datos.idproveedor]
      );
      if (prov.length === 0) {
        await connection.end();
        return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });
      }
    }

    const condicion = Number(datos.condicion_operacion ?? compra.condicion_operacion ?? 1);
    const fechaEmision = (datos.fecha_emision as string) || compra.fecha_emision;
    const plazoTipo = (datos.plazo_tipo as string) || compra.plazo_tipo;
    const plazoPeriodo = (datos.plazo_periodo as number) || compra.plazo_periodo;
    if (condicion === 2 && datos.fecha_vencimiento_pago === undefined) {
      datos.fecha_vencimiento_pago = calcularFechaVencimiento(fechaEmision, plazoTipo, plazoPeriodo);
    }

    const campos = Object.keys(datos);
    if (campos.length === 0) {
      const resumen = await recalcularTotales(connection, Number(body.idcompra));
      await connection.end();
      return NextResponse.json({ success: true, resumen, mensaje: 'Totales recalculados' });
    }

    await connection.execute(
      `UPDATE compras SET ${campos.map((c) => `${c} = ?`).join(', ')} WHERE idcompra = ?`,
      [...campos.map((c) => datos[c]), body.idcompra]
    );

    const resumen = await recalcularTotales(connection, Number(body.idcompra), {
      descuento_global_gravado: datos.descuento_global_gravado as number | undefined,
      descuento_global_exento: datos.descuento_global_exento as number | undefined,
      descuento_global_no_sujeto: datos.descuento_global_no_sujeto as number | undefined,
      porcentaje_descuento: datos.porcentaje_descuento as number | undefined,
      iva_retenido: datos.iva_retenido as number | undefined,
      iva_percibido: datos.iva_percibido as number | undefined,
      retencion_renta: datos.retencion_renta as number | undefined,
    });

    await connection.end();
    return NextResponse.json({ success: true, resumen, mensaje: 'Compra actualizada' });
  } catch (error: any) {
    if (connection) await connection.end();
    console.error('Error al actualizar compra:', error);
    return NextResponse.json(
      { error: 'Error al actualizar compra', detalle: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
  }

  let connection;
  try {
    connection = await connectDB();

    const [existente]: any = await connection.execute(
      'SELECT estado, nodocto FROM compras WHERE idcompra = ?',
      [id]
    );

    if (existente.length === 0) {
      await connection.end();
      return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 });
    }

    if (existente[0].estado !== 'BORRADOR') {
      await connection.end();
      return NextResponse.json(
        { error: 'Solo se pueden eliminar compras en estado BORRADOR' },
        { status: 400 }
      );
    }

    await connection.execute('DELETE FROM compras WHERE idcompra = ?', [id]);
    if (existente[0].nodocto) {
      await connection.execute('DELETE FROM esquemas_dte WHERE nodocto = ?', [existente[0].nodocto]);
      await connection.execute('DELETE FROM ruta_archivos WHERE nodocto = ?', [existente[0].nodocto]);
    }
    await connection.end();

    return NextResponse.json({ success: true, mensaje: 'Borrador eliminado' });
  } catch (error: any) {
    if (connection) await connection.end();
    console.error('Error al eliminar compra:', error);
    return NextResponse.json(
      { error: 'Error al eliminar compra', detalle: error.message },
      { status: 500 }
    );
  }
}
