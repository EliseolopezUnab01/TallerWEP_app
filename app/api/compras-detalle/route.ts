import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { requiereCatalogo, tipoCatalogoEsperado } from '@/lib/compras-detalle';
import {
  CAMPOS_LINEA,
  asignarCodigoExpress,
  errorDestinoLinea,
  insertarLinea,
  ligarOrden,
  normalizarLinea,
  persistirTotales,
  siguienteNumeroLinea,
  type CompraReglas,
  type Conexion,
  type LineaNormalizada,
} from '@/lib/compras-detalle-db';
import { topeDevolucion } from '@/lib/compras-nota';

async function validarCompraBorrador(
  connection: Awaited<ReturnType<typeof connectDB>>,
  idcompra: number
) {
  const [rows]: any = await connection.execute(
    'SELECT idcompra, estado, categoria_operacion, clase_documento, tipo_dte FROM compras WHERE idcompra = ?',
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
  return { ok: true as const, compra: rows[0] as CompraReglas };
}

async function validarCatalogo(
  connection: Awaited<ReturnType<typeof connectDB>>,
  destino: string | null,
  idcatalogo: number | null
) {
  if (!destino || !requiereCatalogo(destino)) return { ok: true as const };

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

async function enriquecerDescripcion(
  connection: Conexion,
  linea: LineaNormalizada
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
      `SELECT v.*, dd.dai_pagado AS imp_dai_unitario, dd.gastos_aduana AS imp_gastos_unitario,
              dd.costo_cif AS imp_costo_cif, dd.subtotal_cif AS imp_subtotal_cif,
              dd.codigo_arancelario AS imp_partida, cp.costo_destino AS imp_costo_local
       FROM v_compras_detalle v
       LEFT JOIN duca_detalles dd ON dd.iddetalle = v.iddetalle
       LEFT JOIN costos_productos cp ON cp.iddetalle = v.iddetalle
       WHERE v.idcompra = ? ORDER BY v.numero_linea ASC`,
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
  } finally {
    if (connection) await connection.end();
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

    let linea = normalizarLinea({ ...body, iddetalle_origen: null, ajuste_precio: 0 });
    linea = await enriquecerDescripcion(connection, linea);

    if (!linea.descripcion) {
      await connection.end();
      return NextResponse.json(
        { error: 'La descripción es obligatoria (o indique idprod / idcatalogo)' },
        { status: 400 }
      );
    }

    const errorDestino = errorDestinoLinea(compraOk.compra, linea);
    if (errorDestino) {
      await connection.end();
      return NextResponse.json({ error: errorDestino }, { status: 400 });
    }

    const catalogoOk = await validarCatalogo(connection, linea.destino, linea.idcatalogo);
    if (!catalogoOk.ok) {
      await connection.end();
      return NextResponse.json({ error: catalogoOk.error }, { status: catalogoOk.status });
    }
    await asignarCodigoExpress(connection, linea);
    const errorOrden = await ligarOrden(connection, linea, true);
    if (errorOrden) {
      await connection.end();
      return NextResponse.json({ error: errorOrden }, { status: 400 });
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

    const iddetalle = await insertarLinea(connection, linea);

    await persistirTotales(connection, linea.idcompra);

    await connection.end();
    return NextResponse.json({
      success: true,
      iddetalle,
      numero_linea: linea.numero_linea,
      codigo_express: linea.codigo_express,
      mensaje: linea.codigo_express ? `Línea express ${linea.codigo_express} agregada` : 'Línea agregada',
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
    if (String(error.message || '').startsWith('La orden')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Error al crear línea de compra', detalle: error.message },
      { status: 500 }
    );
  } finally {
    if (connection) await connection.end();
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
    if (actual[0].destino === 'INVENTARIO' && merged.destino === 'EXPRESS') {
      await connection.end();
      return NextResponse.json(
        { error: 'Una línea de inventario no puede pasar a express; bórrela y agréguela de nuevo como express' },
        { status: 400 }
      );
    }
    if (actual[0].iddetalle_origen) {
      // Línea de nota: conserva la clasificación de la factura original.
      for (const campo of ['destino', 'idprod', 'idcatalogo', 'numero_orden', 'codigo_express', 'iddetalle_origen', 'ajuste_precio']) {
        merged[campo] = actual[0][campo];
      }
      if (!actual[0].ajuste_precio) {
        const tope = await topeDevolucion(connection, actual[0].idcompra, actual[0].iddetalle_origen, actual[0].iddetalle);
        if (tope && Number(merged.cantidad) > tope.maximo + 1e-8) {
          await connection.end();
          return NextResponse.json(
            { error: `Solo quedan ${tope.maximo} por devolver de esa línea (compradas ${tope.comprado})` },
            { status: 400 }
          );
        }
      }
    }
    let linea = normalizarLinea(merged);
    linea.idcompra = actual[0].idcompra;
    linea = await enriquecerDescripcion(connection, linea);

    if (!linea.descripcion) {
      await connection.end();
      return NextResponse.json({ error: 'La descripción es obligatoria' }, { status: 400 });
    }

    const errorDestino = errorDestinoLinea(compraOk.compra, linea);
    if (errorDestino) {
      await connection.end();
      return NextResponse.json({ error: errorDestino }, { status: 400 });
    }

    const catalogoOk = await validarCatalogo(connection, linea.destino, linea.idcatalogo);
    if (!catalogoOk.ok) {
      await connection.end();
      return NextResponse.json({ error: catalogoOk.error }, { status: catalogoOk.status });
    }
    await asignarCodigoExpress(connection, linea);
    const errorOrden = await ligarOrden(connection, linea, !linea.iddetalle_origen);
    if (errorOrden) {
      await connection.end();
      return NextResponse.json({ error: errorOrden }, { status: 400 });
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
    if (String(error.message || '').startsWith('La orden')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Error al actualizar línea de compra', detalle: error.message },
      { status: 500 }
    );
  } finally {
    if (connection) await connection.end();
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
  } finally {
    if (connection) await connection.end();
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
  } finally {
    if (connection) await connection.end();
  }
}
