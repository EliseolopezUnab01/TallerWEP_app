import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';

function limpiar(valor: unknown) {
  if (valor === undefined || valor === null) return null;
  const texto = String(valor).trim();
  return texto === '' ? null : texto;
}

function aNumero(valor: unknown, defecto = 0): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : defecto;
}

async function validarBorrador(
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
      error: 'Solo se pueden editar pagos de compras en estado BORRADOR',
      status: 400,
    };
  }
  return { ok: true as const };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const idcompra = searchParams.get('idcompra');

  if (!idcompra) {
    return NextResponse.json({ error: 'Falta idcompra' }, { status: 400 });
  }

  let connection;
  try {
    connection = await connectDB();
    const [rows]: any = await connection.execute(
      `SELECT p.*, f.nombre AS forma_pago_nombre
       FROM compras_pagos p
       LEFT JOIN cat_formas_pago f ON f.codigo = p.codigo_forma_pago
       WHERE p.idcompra = ?
       ORDER BY p.idpago ASC`,
      [idcompra]
    );
    await connection.end();
    return NextResponse.json({ success: true, pagos: rows });
  } catch (error: any) {
    if (connection) await connection.end();
    console.error('Error al obtener pagos:', error);
    return NextResponse.json(
      { error: 'Error al obtener pagos', detalle: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  let connection;
  try {
    const body = await request.json();
    if (!body.idcompra) {
      return NextResponse.json({ error: 'Falta idcompra' }, { status: 400 });
    }
    if (!body.codigo_forma_pago) {
      return NextResponse.json({ error: 'Falta codigo_forma_pago' }, { status: 400 });
    }

    connection = await connectDB();
    const ok = await validarBorrador(connection, Number(body.idcompra));
    if (!ok.ok) {
      await connection.end();
      return NextResponse.json({ error: ok.error }, { status: ok.status });
    }

    const [forma]: any = await connection.execute(
      'SELECT codigo FROM cat_formas_pago WHERE codigo = ?',
      [String(body.codigo_forma_pago)]
    );
    if (forma.length === 0) {
      await connection.end();
      return NextResponse.json({ error: 'Forma de pago no válida' }, { status: 400 });
    }

    const [resultado]: any = await connection.execute(
      `INSERT INTO compras_pagos
        (idcompra, codigo_forma_pago, monto, referencia, plazo_tipo, plazo_periodo)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        Number(body.idcompra),
        String(body.codigo_forma_pago),
        aNumero(body.monto),
        limpiar(body.referencia),
        limpiar(body.plazo_tipo),
        body.plazo_periodo ? Number(body.plazo_periodo) : null,
      ]
    );

    await connection.end();
    return NextResponse.json({
      success: true,
      idpago: resultado.insertId,
      mensaje: 'Forma de pago agregada',
    });
  } catch (error: any) {
    if (connection) await connection.end();
    console.error('Error al crear pago:', error);
    return NextResponse.json(
      { error: 'Error al crear pago', detalle: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  let connection;
  try {
    const body = await request.json();
    if (!body.idpago) {
      return NextResponse.json({ error: 'Falta idpago' }, { status: 400 });
    }

    connection = await connectDB();
    const [actual]: any = await connection.execute(
      'SELECT * FROM compras_pagos WHERE idpago = ?',
      [body.idpago]
    );
    if (actual.length === 0) {
      await connection.end();
      return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 });
    }

    const ok = await validarBorrador(connection, actual[0].idcompra);
    if (!ok.ok) {
      await connection.end();
      return NextResponse.json({ error: ok.error }, { status: ok.status });
    }

    if (body.codigo_forma_pago) {
      const [forma]: any = await connection.execute(
        'SELECT codigo FROM cat_formas_pago WHERE codigo = ?',
        [String(body.codigo_forma_pago)]
      );
      if (forma.length === 0) {
        await connection.end();
        return NextResponse.json({ error: 'Forma de pago no válida' }, { status: 400 });
      }
    }

    await connection.execute(
      `UPDATE compras_pagos SET
         codigo_forma_pago = ?,
         monto = ?,
         referencia = ?,
         plazo_tipo = ?,
         plazo_periodo = ?
       WHERE idpago = ?`,
      [
        body.codigo_forma_pago ?? actual[0].codigo_forma_pago,
        body.monto !== undefined ? aNumero(body.monto) : actual[0].monto,
        body.referencia !== undefined ? limpiar(body.referencia) : actual[0].referencia,
        body.plazo_tipo !== undefined ? limpiar(body.plazo_tipo) : actual[0].plazo_tipo,
        body.plazo_periodo !== undefined
          ? body.plazo_periodo
            ? Number(body.plazo_periodo)
            : null
          : actual[0].plazo_periodo,
        body.idpago,
      ]
    );

    await connection.end();
    return NextResponse.json({ success: true, mensaje: 'Pago actualizado' });
  } catch (error: any) {
    if (connection) await connection.end();
    console.error('Error al actualizar pago:', error);
    return NextResponse.json(
      { error: 'Error al actualizar pago', detalle: error.message },
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
    const [actual]: any = await connection.execute(
      'SELECT idpago, idcompra FROM compras_pagos WHERE idpago = ?',
      [id]
    );
    if (actual.length === 0) {
      await connection.end();
      return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 });
    }

    const ok = await validarBorrador(connection, actual[0].idcompra);
    if (!ok.ok) {
      await connection.end();
      return NextResponse.json({ error: ok.error }, { status: ok.status });
    }

    await connection.execute('DELETE FROM compras_pagos WHERE idpago = ?', [id]);
    await connection.end();
    return NextResponse.json({ success: true, mensaje: 'Pago eliminado' });
  } catch (error: any) {
    if (connection) await connection.end();
    console.error('Error al eliminar pago:', error);
    return NextResponse.json(
      { error: 'Error al eliminar pago', detalle: error.message },
      { status: 500 }
    );
  }
}
