import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import {
  calcularLinea,
  CONDICIONES_IVA,
  DESTINOS,
  requiereCatalogo,
  tipoCatalogoEsperado,
  type CondicionIva,
} from '@/lib/compras-detalle';
import { calcularResumen } from '@/lib/compras-resumen';

const CAMPOS_LINEA = [
  'idcompra',
  'numero_linea',
  'numero_orden',
  'destino',
  'idcatalogo',
  'idprod',
  'referencia_proveedor',
  'descripcion',
  'cantidad',
  'costo_unitario',
  'descuento_porcentaje',
  'subtotal_sin_iva',
  'iva_unitario',
  'subtotal_con_iva',
  'exento_unitario',
  'no_sujeto_unitario',
  'condicion_iva',
  'numero_documento_rel',
  'codigo_tributo',
  'cargos_no_afectos',
  'imagen_url',
] as const;

function limpiar(valor: unknown) {
  if (valor === undefined || valor === null) return null;
  const texto = String(valor).trim();
  return texto === '' ? null : texto;
}

function aNumero(valor: unknown, defecto = 0): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : defecto;
}

async function validarCompraBorrador(
  connection: Awaited<ReturnType<typeof connectDB>>,
  idcompra: number
) {
  const [rows]: any = await connection.execute(
    'SELECT idcompra, estado FROM compras WHERE idcompra = ?',
    [idcompra]
  );
  if (rows.length === 0) return { ok: false as const, error: 'Compra no encontrada', status: 404 };
  if (rows[0].estado !== 'BORRADOR') {
    return {
      ok: false as const,
      error: 'Solo se pueden editar líneas de compras en estado BORRADOR',
      status: 400,
    };
  }
  return { ok: true as const };
}

async function validarCatalogo(
  connection: Awaited<ReturnType<typeof connectDB>>,
  destino: string,
  idcatalogo: number | null
) {
  if (!requiereCatalogo(destino)) return { ok: true as const };

  if (!idcatalogo) {
    return {
      ok: false as const,
      error: 'El rubro contable es obligatorio cuando el destino es GASTOS o ACTIVOS',
      status: 400,
    };
  }

  const tipoEsperado = tipoCatalogoEsperado(destino);
  const [rows]: any = await connection.execute(
    'SELECT idcatalogo, tipo, activo FROM catalogo_contable WHERE idcatalogo = ?',
    [idcatalogo]
  );

  if (rows.length === 0) {
    return { ok: false as const, error: 'Rubro contable no encontrado', status: 404 };
  }

  if (tipoEsperado && rows[0].tipo !== tipoEsperado) {
    return {
      ok: false as const,
      error: `El rubro debe ser de tipo ${tipoEsperado} para destino ${destino}`,
      status: 400,
    };
  }

  return { ok: true as const, rubro: rows[0] };
}

async function persistirTotales(
  connection: Awaited<ReturnType<typeof connectDB>>,
  idcompra: number
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
    descuento_global_gravado: Number(base.descuento_global_gravado) || 0,
    descuento_global_exento: Number(base.descuento_global_exento) || 0,
    descuento_global_no_sujeto: Number(base.descuento_global_no_sujeto) || 0,
    porcentaje_descuento: Number(base.porcentaje_descuento) || 0,
    iva_retenido: Number(base.iva_retenido) || 0,
    iva_percibido: Number(base.iva_percibido) || 0,
    retencion_renta: Number(base.retencion_renta) || 0,
  });

  await connection.execute(
    `UPDATE compras SET
       total_gravado = ?, total_exento = ?, total_no_sujeto = ?, total_xcomprobar = ?,
       suma_operaciones = ?, total_descuento = ?, sub_total = ?, iva = ?,
       monto_total_operacion = ?, total_cargos_no_afectos = ?, total_pagar = ?,
       valor_en_letras = ?, updated_at = CURRENT_TIMESTAMP
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
}

async function siguienteNumeroLinea(
  connection: Awaited<ReturnType<typeof connectDB>>,
  idcompra: number
) {
  const [rows]: any = await connection.execute(
    'SELECT COALESCE(MAX(numero_linea), 0) + 1 AS siguiente FROM compras_detalle WHERE idcompra = ?',
    [idcompra]
  );
  return Number(rows[0].siguiente);
}

function normalizarLinea(body: Record<string, unknown>, calcular = true) {
  const destino = DESTINOS.includes(String(body.destino) as any)
    ? String(body.destino)
    : 'INVENTARIO';

  const condicion_iva = CONDICIONES_IVA.includes(String(body.condicion_iva) as CondicionIva)
    ? (String(body.condicion_iva) as CondicionIva)
    : 'GRAVADA';

  const cantidad = aNumero(body.cantidad, 1);
  const costo_unitario = aNumero(body.costo_unitario, 0);
  const descuento_porcentaje = aNumero(body.descuento_porcentaje, 0);

  const calculados = calcular
    ? calcularLinea({ cantidad, costo_unitario, descuento_porcentaje, condicion_iva })
    : {
        subtotal_sin_iva: aNumero(body.subtotal_sin_iva),
        iva_unitario: aNumero(body.iva_unitario),
        exento_unitario: aNumero(body.exento_unitario),
        no_sujeto_unitario: aNumero(body.no_sujeto_unitario),
        subtotal_con_iva: aNumero(body.subtotal_con_iva),
      };

  return {
    idcompra: Number(body.idcompra),
    numero_linea: body.numero_linea ? Number(body.numero_linea) : null,
    numero_orden: limpiar(body.numero_orden),
    destino,
    idcatalogo: body.idcatalogo ? Number(body.idcatalogo) : null,
    idprod: body.idprod ? Number(body.idprod) : null,
    referencia_proveedor: limpiar(body.referencia_proveedor),
    descripcion: String(body.descripcion || '').trim(),
    cantidad,
    costo_unitario,
    descuento_porcentaje,
    ...calculados,
    condicion_iva,
    numero_documento_rel: limpiar(body.numero_documento_rel),
    codigo_tributo: limpiar(body.codigo_tributo) || (condicion_iva === 'GRAVADA' ? '20' : null),
    cargos_no_afectos: aNumero(body.cargos_no_afectos, 0),
    imagen_url: limpiar(body.imagen_url),
  };
}

async function enriquecerDescripcion(
  connection: Awaited<ReturnType<typeof connectDB>>,
  linea: ReturnType<typeof normalizarLinea>
) {
  if (linea.descripcion) return linea;

  if (linea.idprod) {
    const [prod]: any = await connection.execute(
      `SELECT p.nombre,
              (SELECT imagen_url FROM producto_imagenes
               WHERE idprod = p.idprod
               ORDER BY es_principal DESC, orden ASC LIMIT 1) AS imagen
       FROM productos p WHERE p.idprod = ?`,
      [linea.idprod]
    );
    if (prod.length > 0) {
      linea.descripcion = prod[0].nombre;
      if (!linea.imagen_url && prod[0].imagen) {
        linea.imagen_url = prod[0].imagen;
      }
    }
  } else if (linea.idcatalogo) {
    const [rubro]: any = await connection.execute(
      'SELECT nombre FROM catalogo_contable WHERE idcatalogo = ?',
      [linea.idcatalogo]
    );
    if (rubro.length > 0) {
      linea.descripcion = rubro[0].nombre;
    }
  }

  return linea;
}

// GET - Listar líneas por idcompra o una línea por iddetalle
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const iddetalle = searchParams.get('id');
  const idcompra = searchParams.get('idcompra');

  let connection;
  try {
    connection = await connectDB();

    if (iddetalle) {
      const [rows]: any = await connection.execute(
        'SELECT * FROM v_compras_detalle WHERE iddetalle = ?',
        [iddetalle]
      );
      await connection.end();

      if (rows.length === 0) {
        return NextResponse.json({ error: 'Línea no encontrada' }, { status: 404 });
      }
      return NextResponse.json({ success: true, linea: rows[0] });
    }

    if (!idcompra) {
      await connection.end();
      return NextResponse.json({ error: 'Falta idcompra o id' }, { status: 400 });
    }

    const [rows]: any = await connection.execute(
      'SELECT * FROM v_compras_detalle WHERE idcompra = ? ORDER BY numero_linea ASC',
      [idcompra]
    );

    await connection.end();
    return NextResponse.json({ success: true, lineas: rows });
  } catch (error: any) {
    if (connection) await connection.end();
    console.error('Error al obtener líneas de compra:', error);
    return NextResponse.json(
      { error: 'Error al obtener líneas de compra', detalle: error.message },
      { status: 500 }
    );
  }
}

// POST - Crear línea
export async function POST(request: NextRequest) {
  let connection;
  try {
    const body = await request.json();

    if (!body.idcompra) {
      return NextResponse.json({ error: 'Falta idcompra' }, { status: 400 });
    }

    connection = await connectDB();

    const compraOk = await validarCompraBorrador(connection, Number(body.idcompra));
    if (!compraOk.ok) {
      await connection.end();
      return NextResponse.json({ error: compraOk.error }, { status: compraOk.status });
    }

    let linea = normalizarLinea(body);
    linea = await enriquecerDescripcion(connection, linea);

    if (!linea.descripcion) {
      await connection.end();
      return NextResponse.json(
        { error: 'La descripción es obligatoria (o indique idprod / idcatalogo)' },
        { status: 400 }
      );
    }

    const catalogoOk = await validarCatalogo(connection, linea.destino, linea.idcatalogo);
    if (!catalogoOk.ok) {
      await connection.end();
      return NextResponse.json({ error: catalogoOk.error }, { status: catalogoOk.status });
    }

    if (linea.idprod) {
      const [prod]: any = await connection.execute(
        'SELECT idprod FROM productos WHERE idprod = ?',
        [linea.idprod]
      );
      if (prod.length === 0) {
        await connection.end();
        return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
      }
    }

    if (!linea.numero_linea) {
      linea.numero_linea = await siguienteNumeroLinea(connection, linea.idcompra);
    }

    const valores = CAMPOS_LINEA.map((c) => (linea as any)[c]);

    const [resultado]: any = await connection.execute(
      `INSERT INTO compras_detalle (${CAMPOS_LINEA.join(', ')})
       VALUES (${CAMPOS_LINEA.map(() => '?').join(', ')})`,
      valores
    );

    await persistirTotales(connection, linea.idcompra);

    await connection.end();
    return NextResponse.json({
      success: true,
      iddetalle: resultado.insertId,
      numero_linea: linea.numero_linea,
      mensaje: 'Línea agregada',
    });
  } catch (error: any) {
    if (connection) await connection.end();
    console.error('Error al crear línea de compra:', error);

    if (error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json(
        { error: 'Ya existe una línea con ese número en la compra' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Error al crear línea de compra', detalle: error.message },
      { status: 500 }
    );
  }
}

// PUT - Actualizar línea
export async function PUT(request: NextRequest) {
  let connection;
  try {
    const body = await request.json();

    if (!body.iddetalle) {
      return NextResponse.json({ error: 'Falta iddetalle' }, { status: 400 });
    }

    connection = await connectDB();

    const [actual]: any = await connection.execute(
      'SELECT * FROM compras_detalle WHERE iddetalle = ?',
      [body.iddetalle]
    );

    if (actual.length === 0) {
      await connection.end();
      return NextResponse.json({ error: 'Línea no encontrada' }, { status: 404 });
    }

    const compraOk = await validarCompraBorrador(connection, actual[0].idcompra);
    if (!compraOk.ok) {
      await connection.end();
      return NextResponse.json({ error: compraOk.error }, { status: compraOk.status });
    }

    const merged = { ...actual[0], ...body };
    let linea = normalizarLinea(merged);
    linea.idcompra = actual[0].idcompra;
    linea = await enriquecerDescripcion(connection, linea);

    if (!linea.descripcion) {
      await connection.end();
      return NextResponse.json({ error: 'La descripción es obligatoria' }, { status: 400 });
    }

    const catalogoOk = await validarCatalogo(connection, linea.destino, linea.idcatalogo);
    if (!catalogoOk.ok) {
      await connection.end();
      return NextResponse.json({ error: catalogoOk.error }, { status: catalogoOk.status });
    }

    const camposUpdate = CAMPOS_LINEA.filter((c) => c !== 'idcompra');
    const asignaciones = camposUpdate.map((c) => `${c} = ?`).join(', ');
    const valores = camposUpdate.map((c) => (linea as any)[c]);

    await connection.execute(
      `UPDATE compras_detalle SET ${asignaciones} WHERE iddetalle = ?`,
      [...valores, body.iddetalle]
    );

    await persistirTotales(connection, linea.idcompra);

    await connection.end();
    return NextResponse.json({ success: true, mensaje: 'Línea actualizada' });
  } catch (error: any) {
    if (connection) await connection.end();
    console.error('Error al actualizar línea de compra:', error);

    if (error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json(
        { error: 'Ya existe una línea con ese número en la compra' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Error al actualizar línea de compra', detalle: error.message },
      { status: 500 }
    );
  }
}

// PATCH - Reordenar líneas: body { idcompra, orden: [iddetalle, ...] }
export async function PATCH(request: NextRequest) {
  let connection;
  try {
    const body = await request.json();

    if (!body.idcompra || !Array.isArray(body.orden)) {
      return NextResponse.json(
        { error: 'Se requiere idcompra y orden (array de iddetalle)' },
        { status: 400 }
      );
    }

    connection = await connectDB();

    const compraOk = await validarCompraBorrador(connection, Number(body.idcompra));
    if (!compraOk.ok) {
      await connection.end();
      return NextResponse.json({ error: compraOk.error }, { status: compraOk.status });
    }

    const idcompra = Number(body.idcompra);
    const orden: number[] = body.orden.map(Number);

    await connection.beginTransaction();

    // Paso 1: números temporales negativos para evitar colisión UNIQUE
    for (let i = 0; i < orden.length; i++) {
      await connection.execute(
        'UPDATE compras_detalle SET numero_linea = ? WHERE iddetalle = ? AND idcompra = ?',
        [-(i + 1), orden[i], idcompra]
      );
    }

    // Paso 2: numeración final 1..n
    for (let i = 0; i < orden.length; i++) {
      await connection.execute(
        'UPDATE compras_detalle SET numero_linea = ? WHERE iddetalle = ? AND idcompra = ?',
        [i + 1, orden[i], idcompra]
      );
    }

    await persistirTotales(connection, idcompra);

    await connection.commit();
    await connection.end();

    return NextResponse.json({ success: true, mensaje: 'Líneas reordenadas' });
  } catch (error: any) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {
        /* ignore */
      }
      await connection.end();
    }
    console.error('Error al reordenar líneas:', error);
    return NextResponse.json(
      { error: 'Error al reordenar líneas', detalle: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar línea
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
  }

  let connection;
  try {
    connection = await connectDB();

    const [actual]: any = await connection.execute(
      'SELECT iddetalle, idcompra, numero_linea FROM compras_detalle WHERE iddetalle = ?',
      [id]
    );

    if (actual.length === 0) {
      await connection.end();
      return NextResponse.json({ error: 'Línea no encontrada' }, { status: 404 });
    }

    const compraOk = await validarCompraBorrador(connection, actual[0].idcompra);
    if (!compraOk.ok) {
      await connection.end();
      return NextResponse.json({ error: compraOk.error }, { status: compraOk.status });
    }

    const { idcompra, numero_linea } = actual[0];

    await connection.beginTransaction();
    await connection.execute('DELETE FROM compras_detalle WHERE iddetalle = ?', [id]);

    // Renumerar líneas posteriores
    await connection.execute(
      `UPDATE compras_detalle
       SET numero_linea = numero_linea - 1
       WHERE idcompra = ? AND numero_linea > ?`,
      [idcompra, numero_linea]
    );

    await persistirTotales(connection, idcompra);

    await connection.commit();
    await connection.end();

    return NextResponse.json({ success: true, mensaje: 'Línea eliminada' });
  } catch (error: any) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {
        /* ignore */
      }
      await connection.end();
    }
    console.error('Error al eliminar línea:', error);
    return NextResponse.json(
      { error: 'Error al eliminar línea', detalle: error.message },
      { status: 500 }
    );
  }
}
