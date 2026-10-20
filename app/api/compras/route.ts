import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import {
  esTipoDteCompra,
  tipoDteRequiereRelacionados,
} from '@/lib/compras-constantes';
import { calcularFechaVencimiento, calcularResumen } from '@/lib/compras-resumen';

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
  const [lineas]: any = await connection.execute(
    `SELECT condicion_iva, subtotal_sin_iva, iva_unitario, cantidad,
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
    lineas,
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
    const c = Number(body.condicion_operacion);
    datos.condicion_operacion = [1, 2, 3].includes(c) ? c : 1;
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
                t.nombre AS tipo_dte_nombre, t.abreviatura AS tipo_dte_abrev
         FROM compras c
         LEFT JOIN proveedores p ON p.idproveedor = c.idproveedor
         LEFT JOIN cat_tipos_dte t ON t.codigo = c.tipo_dte
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
        '(c.numero_factura LIKE ? OR c.codigo_generacion LIKE ? OR p.nombre_legal LIKE ? OR p.codigo LIKE ?)'
      );
      const like = `%${q}%`;
      valores.push(like, like, like, like);
    }

    const where = filtros.length > 0 ? `WHERE ${filtros.join(' AND ')}` : '';

    const [rows]: any = await connection.execute(
      `SELECT c.idcompra, c.estado, c.tipo_dte, c.idproveedor, c.notas,
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

    const columnas = ['estado', ...CAMPOS_ENCABEZADO.filter((c) => datos[c] !== undefined)];
    const valores = columnas.map((c) => (c === 'estado' ? 'BORRADOR' : datos[c]));

    const [resultado]: any = await connection.execute(
      `INSERT INTO compras (${columnas.join(', ')}) VALUES (${columnas.map(() => '?').join(', ')})`,
      valores
    );

    await connection.end();
    return NextResponse.json({
      success: true,
      idcompra: resultado.insertId,
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
      await connection.execute(
        "UPDATE compras SET estado = 'ANULADA' WHERE idcompra = ?",
        [body.idcompra]
      );
      await connection.end();
      return NextResponse.json({ success: true, mensaje: 'Compra anulada' });
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
      if (!compra.tipo_dte && !body.tipo_dte) errores.push('Tipo de DTE');
      if (!compra.idproveedor && !body.idproveedor) errores.push('Proveedor');
      if (!compra.fecha_emision && !body.fecha_emision) errores.push('Fecha de emisión');

      const [lineas]: any = await connection.execute(
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

      const condicion = Number(body.condicion_operacion ?? compra.condicion_operacion ?? 1);
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

      await connection.execute(
        "UPDATE compras SET estado = 'REGISTRADA' WHERE idcompra = ?",
        [body.idcompra]
      );

      await connection.end();
      return NextResponse.json({ success: true, mensaje: 'Compra registrada' });
    }

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
      'SELECT estado FROM compras WHERE idcompra = ?',
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
