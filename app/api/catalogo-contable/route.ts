import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';

// Catálogo contable del control 29.1: rubros de gastos y activos.
const CAMPOS_CATALOGO = [
  'tipo',
  'codigo',
  'nombre',
  'descripcion',
  'cuenta_contable',
  'condicion_iva_sugerida',
  'activo',
] as const;

const TIPOS_VALIDOS = ['GASTO', 'ACTIVO'];
const CONDICIONES_IVA = ['GRAVADA', 'EXENTO', 'NO_SUJETO', 'XCOMPROBAR'];

function limpiar(valor: unknown) {
  if (valor === undefined || valor === null) return null;
  const texto = String(valor).trim();
  return texto === '' ? null : texto;
}

function normalizarValor(campo: string, valor: unknown) {
  if (campo === 'activo') {
    return valor === undefined || valor === null || valor === '' ? 1 : valor ? 1 : 0;
  }
  if (campo === 'tipo') {
    return TIPOS_VALIDOS.includes(String(valor)) ? String(valor) : 'GASTO';
  }
  if (campo === 'condicion_iva_sugerida') {
    const texto = limpiar(valor);
    return texto && CONDICIONES_IVA.includes(texto) ? texto : null;
  }
  return limpiar(valor);
}

// Genera el siguiente código disponible con prefijo G (gasto) o A (activo)
async function siguienteCodigo(
  connection: Awaited<ReturnType<typeof connectDB>>,
  tipo: string
) {
  const prefijo = tipo === 'ACTIVO' ? 'A' : 'G';
  const [rows]: any = await connection.execute(
    `SELECT codigo FROM catalogo_contable
     WHERE codigo REGEXP ?
     ORDER BY CAST(SUBSTRING(codigo, 2) AS UNSIGNED) DESC
     LIMIT 1`,
    [`^${prefijo}[0-9]+$`]
  );

  const ultimo = rows.length > 0 ? parseInt(rows[0].codigo.substring(1), 10) : 0;
  return `${prefijo}${String(ultimo + 1).padStart(3, '0')}`;
}

// GET - Listar, filtrar por tipo, buscar, obtener uno, o sugerir código
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const tipo = searchParams.get('tipo');
  const q = searchParams.get('q');
  const soloActivos = searchParams.get('activo');
  const sugerirCodigo = searchParams.get('sugerir_codigo');

  let connection;
  try {
    connection = await connectDB();

    if (sugerirCodigo) {
      const codigo = await siguienteCodigo(connection, sugerirCodigo);
      await connection.end();
      return NextResponse.json({ success: true, codigo });
    }

    if (id) {
      const [rows]: any = await connection.execute(
        'SELECT * FROM catalogo_contable WHERE idcatalogo = ?',
        [id]
      );
      await connection.end();

      if (rows.length === 0) {
        return NextResponse.json({ error: 'Rubro no encontrado' }, { status: 404 });
      }
      return NextResponse.json({ success: true, rubro: rows[0] });
    }

    const condiciones: string[] = [];
    const valores: any[] = [];

    if (tipo && TIPOS_VALIDOS.includes(tipo)) {
      condiciones.push('tipo = ?');
      valores.push(tipo);
    }

    if (q) {
      condiciones.push('(codigo LIKE ? OR nombre LIKE ? OR descripcion LIKE ?)');
      const like = `%${q}%`;
      valores.push(like, like, like);
    }

    if (soloActivos === 'true') {
      condiciones.push('activo = TRUE');
    }

    const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

    const [rows]: any = await connection.execute(
      `SELECT * FROM catalogo_contable
       ${where}
       ORDER BY tipo ASC, codigo ASC`,
      valores
    );

    await connection.end();
    return NextResponse.json({ success: true, rubros: rows });
  } catch (error: any) {
    if (connection) await connection.end();
    console.error('Error al obtener el catálogo contable:', error);
    return NextResponse.json(
      { error: 'Error al obtener el catálogo contable', detalle: error.message },
      { status: 500 }
    );
  }
}

// POST - Crear rubro
export async function POST(request: NextRequest) {
  let connection;
  try {
    const body = await request.json();

    if (!body.nombre || String(body.nombre).trim() === '') {
      return NextResponse.json(
        { error: 'El nombre del rubro es obligatorio' },
        { status: 400 }
      );
    }
    if (!TIPOS_VALIDOS.includes(String(body.tipo))) {
      return NextResponse.json(
        { error: 'El tipo debe ser GASTO o ACTIVO' },
        { status: 400 }
      );
    }

    connection = await connectDB();

    const codigo = body.codigo && String(body.codigo).trim() !== ''
      ? String(body.codigo).trim()
      : await siguienteCodigo(connection, body.tipo);

    const datos = { ...body, codigo };
    const valores = CAMPOS_CATALOGO.map((c) => normalizarValor(c, datos[c]));
    const placeholders = CAMPOS_CATALOGO.map(() => '?').join(', ');

    const [resultado]: any = await connection.execute(
      `INSERT INTO catalogo_contable (${CAMPOS_CATALOGO.join(', ')})
       VALUES (${placeholders})`,
      valores
    );

    await connection.end();
    return NextResponse.json({
      success: true,
      idcatalogo: resultado.insertId,
      codigo,
      mensaje: 'Rubro agregado al catálogo',
    });
  } catch (error: any) {
    if (connection) await connection.end();
    console.error('Error al crear el rubro contable:', error);

    if (error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json(
        { error: 'Ya existe un rubro con ese código o con ese nombre dentro del mismo tipo' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Error al crear el rubro contable', detalle: error.message },
      { status: 500 }
    );
  }
}

// PUT - Actualizar rubro
export async function PUT(request: NextRequest) {
  let connection;
  try {
    const body = await request.json();

    if (!body.idcatalogo) {
      return NextResponse.json({ error: 'Falta el idcatalogo' }, { status: 400 });
    }
    if (!body.nombre || String(body.nombre).trim() === '') {
      return NextResponse.json(
        { error: 'El nombre del rubro es obligatorio' },
        { status: 400 }
      );
    }
    if (!TIPOS_VALIDOS.includes(String(body.tipo))) {
      return NextResponse.json(
        { error: 'El tipo debe ser GASTO o ACTIVO' },
        { status: 400 }
      );
    }

    connection = await connectDB();

    const asignaciones = CAMPOS_CATALOGO.map((c) => `${c} = ?`).join(', ');
    const valores = CAMPOS_CATALOGO.map((c) => normalizarValor(c, body[c]));

    await connection.execute(
      `UPDATE catalogo_contable SET ${asignaciones} WHERE idcatalogo = ?`,
      [...valores, body.idcatalogo]
    );

    await connection.end();
    return NextResponse.json({
      success: true,
      mensaje: 'Rubro actualizado',
    });
  } catch (error: any) {
    if (connection) await connection.end();
    console.error('Error al actualizar el rubro contable:', error);

    if (error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json(
        { error: 'Ya existe un rubro con ese código o con ese nombre dentro del mismo tipo' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Error al actualizar el rubro contable', detalle: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Desactivar rubro. Con ?permanente=true lo elimina.
// Por defecto es baja lógica: los rubros quedarán referenciados por compras
// históricas, así que no conviene borrarlos de verdad.
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const permanente = searchParams.get('permanente') === 'true';

  if (!id) {
    return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
  }

  let connection;
  try {
    connection = await connectDB();

    if (permanente) {
      await connection.execute('DELETE FROM catalogo_contable WHERE idcatalogo = ?', [id]);
    } else {
      await connection.execute(
        'UPDATE catalogo_contable SET activo = FALSE WHERE idcatalogo = ?',
        [id]
      );
    }

    await connection.end();
    return NextResponse.json({
      success: true,
      mensaje: permanente ? 'Rubro eliminado' : 'Rubro desactivado',
    });
  } catch (error: any) {
    if (connection) await connection.end();
    console.error('Error al eliminar el rubro contable:', error);
    return NextResponse.json(
      { error: 'Error al eliminar el rubro contable', detalle: error.message },
      { status: 500 }
    );
  }
}
