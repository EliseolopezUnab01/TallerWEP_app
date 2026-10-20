import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { tipoDteRequiereRelacionados } from '@/lib/compras-constantes';

async function validarBorradorNcNd(
  connection: Awaited<ReturnType<typeof connectDB>>,
  idcompra: number
) {
  const [rows]: any = await connection.execute(
    'SELECT idcompra, estado, tipo_dte FROM compras WHERE idcompra = ?',
    [idcompra]
  );
  if (rows.length === 0) return { ok: false as const, error: 'Compra no encontrada', status: 404 };
  if (rows[0].estado !== 'BORRADOR') {
    return {
      ok: false as const,
      error: 'Solo se pueden editar documentos relacionados de compras en estado BORRADOR',
      status: 400,
    };
  }
  if (!tipoDteRequiereRelacionados(rows[0].tipo_dte)) {
    return {
      ok: false as const,
      error: 'Los documentos relacionados solo aplican a Nota de Crédito o Nota de Débito',
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
      `SELECT r.*, t.abreviatura, t.nombre AS tipo_nombre
       FROM compras_documentos_rel r
       LEFT JOIN cat_tipos_dte t ON t.codigo = r.tipo_dte_relacionado
       WHERE r.idcompra = ?
       ORDER BY r.idrelacion ASC`,
      [idcompra]
    );
    await connection.end();
    return NextResponse.json({ success: true, documentos: rows });
  } catch (error: any) {
    if (connection) await connection.end();
    console.error('Error al obtener documentos relacionados:', error);
    return NextResponse.json(
      { error: 'Error al obtener documentos relacionados', detalle: error.message },
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
    if (!body.tipo_dte_relacionado || !body.numero_documento || !body.fecha_generacion) {
      return NextResponse.json(
        { error: 'Faltan tipo_dte_relacionado, numero_documento o fecha_generacion' },
        { status: 400 }
      );
    }

    connection = await connectDB();
    const ok = await validarBorradorNcNd(connection, Number(body.idcompra));
    if (!ok.ok) {
      await connection.end();
      return NextResponse.json({ error: ok.error }, { status: ok.status });
    }

    const [count]: any = await connection.execute(
      'SELECT COUNT(*) AS total FROM compras_documentos_rel WHERE idcompra = ?',
      [body.idcompra]
    );
    if (Number(count[0].total) >= 50) {
      await connection.end();
      return NextResponse.json(
        { error: 'Máximo 50 documentos relacionados por DTE' },
        { status: 400 }
      );
    }

    const tipoGeneracion = Number(body.tipo_generacion) === 1 ? 1 : 2;

    const [resultado]: any = await connection.execute(
      `INSERT INTO compras_documentos_rel
        (idcompra, tipo_dte_relacionado, tipo_generacion, numero_documento, fecha_generacion)
       VALUES (?, ?, ?, ?, ?)`,
      [
        Number(body.idcompra),
        String(body.tipo_dte_relacionado),
        tipoGeneracion,
        String(body.numero_documento).trim(),
        body.fecha_generacion,
      ]
    );

    await connection.end();
    return NextResponse.json({
      success: true,
      idrelacion: resultado.insertId,
      mensaje: 'Documento relacionado agregado',
    });
  } catch (error: any) {
    if (connection) await connection.end();
    console.error('Error al crear documento relacionado:', error);
    return NextResponse.json(
      { error: 'Error al crear documento relacionado', detalle: error.message },
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
      'SELECT idrelacion, idcompra FROM compras_documentos_rel WHERE idrelacion = ?',
      [id]
    );
    if (actual.length === 0) {
      await connection.end();
      return NextResponse.json({ error: 'Documento relacionado no encontrado' }, { status: 404 });
    }

    const ok = await validarBorradorNcNd(connection, actual[0].idcompra);
    if (!ok.ok) {
      await connection.end();
      return NextResponse.json({ error: ok.error }, { status: ok.status });
    }

    await connection.execute('DELETE FROM compras_documentos_rel WHERE idrelacion = ?', [id]);
    await connection.end();
    return NextResponse.json({ success: true, mensaje: 'Documento relacionado eliminado' });
  } catch (error: any) {
    if (connection) await connection.end();
    console.error('Error al eliminar documento relacionado:', error);
    return NextResponse.json(
      { error: 'Error al eliminar documento relacionado', detalle: error.message },
      { status: 500 }
    );
  }
}
