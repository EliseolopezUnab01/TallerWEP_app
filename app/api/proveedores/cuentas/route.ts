import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';

// Un proveedor puede tener varias cuentas bancarias (regla del cliente).
const CAMPOS_CUENTA = [
  'numero_cuenta',
  'beneficiario',
  'direccion_beneficiario',
  'banco',
  'direccion_banco',
  'codigo_aba',
  'codigo_swift',
  'codigo_iban',
  'moneda',
  'comentarios',
] as const;

function limpiar(valor: unknown) {
  if (valor === undefined || valor === null) return null;
  const texto = String(valor).trim();
  return texto === '' ? null : texto;
}

// GET - Cuentas de un proveedor, o una cuenta puntual
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const idproveedor = searchParams.get('idproveedor');
  const idcuenta = searchParams.get('idcuenta');

  if (!idproveedor && !idcuenta) {
    return NextResponse.json(
      { error: 'Se requiere idproveedor o idcuenta' },
      { status: 400 }
    );
  }

  let connection;
  try {
    connection = await connectDB();

    if (idcuenta) {
      const [rows]: any = await connection.execute(
        'SELECT * FROM cuentas_bancarias WHERE idcuenta = ?',
        [idcuenta]
      );
      await connection.end();

      if (rows.length === 0) {
        return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 });
      }
      return NextResponse.json({ success: true, cuenta: rows[0] });
    }

    const [rows]: any = await connection.execute(
      `SELECT * FROM cuentas_bancarias
       WHERE idproveedor = ? AND activo = TRUE
       ORDER BY idcuenta ASC`,
      [idproveedor]
    );

    await connection.end();
    return NextResponse.json({ success: true, cuentas: rows });
  } catch (error: any) {
    if (connection) await connection.end();
    console.error('Error al obtener cuentas bancarias:', error);
    return NextResponse.json(
      { error: 'Error al obtener cuentas bancarias', detalle: error.message },
      { status: 500 }
    );
  }
}

// POST - Agregar cuenta a un proveedor
export async function POST(request: NextRequest) {
  let connection;
  try {
    const body = await request.json();

    if (!body.idproveedor) {
      return NextResponse.json(
        { error: 'Falta el idproveedor' },
        { status: 400 }
      );
    }
    if (!body.numero_cuenta || String(body.numero_cuenta).trim() === '') {
      return NextResponse.json(
        { error: 'El número de cuenta es obligatorio' },
        { status: 400 }
      );
    }

    connection = await connectDB();

    const valores = CAMPOS_CUENTA.map((c) => limpiar(body[c]));
    const placeholders = CAMPOS_CUENTA.map(() => '?').join(', ');

    const [resultado]: any = await connection.execute(
      `INSERT INTO cuentas_bancarias (idproveedor, ${CAMPOS_CUENTA.join(', ')})
       VALUES (?, ${placeholders})`,
      [body.idproveedor, ...valores]
    );

    await connection.end();
    return NextResponse.json({
      success: true,
      idcuenta: resultado.insertId,
      mensaje: 'Cuenta bancaria agregada',
    });
  } catch (error: any) {
    if (connection) await connection.end();
    console.error('Error al crear cuenta bancaria:', error);
    return NextResponse.json(
      { error: 'Error al crear cuenta bancaria', detalle: error.message },
      { status: 500 }
    );
  }
}

// PUT - Actualizar una cuenta
export async function PUT(request: NextRequest) {
  let connection;
  try {
    const body = await request.json();

    if (!body.idcuenta) {
      return NextResponse.json({ error: 'Falta el idcuenta' }, { status: 400 });
    }
    if (!body.numero_cuenta || String(body.numero_cuenta).trim() === '') {
      return NextResponse.json(
        { error: 'El número de cuenta es obligatorio' },
        { status: 400 }
      );
    }

    connection = await connectDB();

    const asignaciones = CAMPOS_CUENTA.map((c) => `${c} = ?`).join(', ');
    const valores = CAMPOS_CUENTA.map((c) => limpiar(body[c]));

    await connection.execute(
      `UPDATE cuentas_bancarias SET ${asignaciones} WHERE idcuenta = ?`,
      [...valores, body.idcuenta]
    );

    await connection.end();
    return NextResponse.json({
      success: true,
      mensaje: 'Cuenta bancaria actualizada',
    });
  } catch (error: any) {
    if (connection) await connection.end();
    console.error('Error al actualizar cuenta bancaria:', error);
    return NextResponse.json(
      { error: 'Error al actualizar cuenta bancaria', detalle: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Desactivar cuenta. Con ?permanente=true la borra.
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const idcuenta = searchParams.get('idcuenta');
  const permanente = searchParams.get('permanente') === 'true';

  if (!idcuenta) {
    return NextResponse.json({ error: 'Falta el idcuenta' }, { status: 400 });
  }

  let connection;
  try {
    connection = await connectDB();

    if (permanente) {
      await connection.execute('DELETE FROM cuentas_bancarias WHERE idcuenta = ?', [
        idcuenta,
      ]);
    } else {
      await connection.execute(
        'UPDATE cuentas_bancarias SET activo = FALSE WHERE idcuenta = ?',
        [idcuenta]
      );
    }

    await connection.end();
    return NextResponse.json({
      success: true,
      mensaje: permanente ? 'Cuenta eliminada' : 'Cuenta desactivada',
    });
  } catch (error: any) {
    if (connection) await connection.end();
    console.error('Error al eliminar cuenta bancaria:', error);
    return NextResponse.json(
      { error: 'Error al eliminar cuenta bancaria', detalle: error.message },
      { status: 500 }
    );
  }
}
