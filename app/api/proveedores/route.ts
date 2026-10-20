import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';

// Campos editables de la ficha del proveedor.
// El orden se reutiliza para INSERT y UPDATE.
const CAMPOS_PROVEEDOR = [
  'codigo',
  'tipo_proveedor',
  'nombre_legal',
  'nombre_comercial',
  'alias',
  'direccion',
  'ciudad',
  'direccion2',
  'ciudad2',
  'pais',
  'telefono',
  'telefono2',
  'fax',
  'email',
  'sitio_web',
  'nit',
  'nrc',
  'giro',
  'categoria_contribuyente',
  'que_provee',
  'incluir_en_catalogo',
  'limite_credito_usd',
  'dias_credito',
  'moneda',
  'terminos_comentarios',
  'activo',
] as const;

// saldo_actual y saldo_vencido NO se aceptan desde el cliente:
// los alimentará el módulo de Cuentas por Pagar cuando exista.

type Contacto = {
  orden?: number;
  nombre?: string | null;
  puesto_cargo?: string | null;
  telefono?: string | null;
  movil?: string | null;
  email?: string | null;
};

// Columnas NOT NULL con DEFAULT en la BD. Enviarles NULL explícito falla
// (ER_BAD_NULL_ERROR), así que cuando llegan vacías se usa el valor por defecto.
const VALORES_POR_DEFECTO: Record<string, any> = {
  tipo_proveedor: 'LOCAL',
  que_provee: 'PRODUCTO',
  categoria_contribuyente: 'CONTRIBUYENTE',
  incluir_en_catalogo: 0,
  limite_credito_usd: 0,
  dias_credito: 30,
  moneda: 'USD',
  activo: 1,
};

const CAMPOS_BOOLEANOS = ['incluir_en_catalogo', 'activo'];

function normalizarValor(campo: string, valor: unknown) {
  const vacio = valor === undefined || valor === null || valor === '';

  if (CAMPOS_BOOLEANOS.includes(campo)) {
    return vacio ? VALORES_POR_DEFECTO[campo] : valor ? 1 : 0;
  }

  if (vacio) {
    // Con default definido se usa ese; el resto de columnas admite NULL
    return campo in VALORES_POR_DEFECTO ? VALORES_POR_DEFECTO[campo] : null;
  }

  return valor;
}

// Genera el siguiente código disponible con prefijo PL (local) o PE (extranjero)
async function siguienteCodigo(
  connection: Awaited<ReturnType<typeof connectDB>>,
  tipo: string
) {
  const prefijo = tipo === 'EXTRANJERO' ? 'PE' : 'PL';
  const [rows]: any = await connection.execute(
    `SELECT codigo FROM proveedores
     WHERE codigo REGEXP ?
     ORDER BY CAST(SUBSTRING(codigo, 3) AS UNSIGNED) DESC
     LIMIT 1`,
    [`^${prefijo}[0-9]+$`]
  );

  const ultimo = rows.length > 0 ? parseInt(rows[0].codigo.substring(2), 10) : 0;
  return `${prefijo}${String(ultimo + 1).padStart(4, '0')}`;
}

// GET - Listar, buscar, obtener uno, o sugerir código
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const q = searchParams.get('q');
  const tipo = searchParams.get('tipo');
  const soloActivos = searchParams.get('activo');
  const sugerirCodigo = searchParams.get('sugerir_codigo');

  let connection;
  try {
    connection = await connectDB();

    // Sugerir el siguiente código para un tipo de proveedor
    if (sugerirCodigo) {
      const codigo = await siguienteCodigo(connection, sugerirCodigo);
      await connection.end();
      return NextResponse.json({ success: true, codigo });
    }

    // Ficha completa de un proveedor
    if (id) {
      const [provRows]: any = await connection.execute(
        'SELECT * FROM proveedores WHERE idproveedor = ?',
        [id]
      );

      if (provRows.length === 0) {
        await connection.end();
        return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });
      }

      const [contactos]: any = await connection.execute(
        'SELECT * FROM proveedor_contactos WHERE idproveedor = ? ORDER BY orden ASC',
        [id]
      );

      const [cuentas]: any = await connection.execute(
        `SELECT * FROM cuentas_bancarias
         WHERE idproveedor = ? AND activo = TRUE
         ORDER BY idcuenta ASC`,
        [id]
      );

      await connection.end();
      return NextResponse.json({
        success: true,
        proveedor: provRows[0],
        contactos,
        cuentas,
      });
    }

    // Listado con filtros
    const condiciones: string[] = [];
    const valores: any[] = [];

    if (q) {
      // Control 10.1: buscar por alias y por ID de proveedor, además del nombre
      condiciones.push(`(
        codigo LIKE ?
        OR alias LIKE ?
        OR nombre_legal LIKE ?
        OR nombre_comercial LIKE ?
        OR nit LIKE ?
      )`);
      const like = `%${q}%`;
      valores.push(like, like, like, like, like);
    }

    if (tipo) {
      condiciones.push('tipo_proveedor = ?');
      valores.push(tipo);
    }

    if (soloActivos === 'true') {
      condiciones.push('activo = TRUE');
    }

    const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

    const [rows]: any = await connection.execute(
      `SELECT * FROM v_proveedores_resumen
       ${where}
       ORDER BY nombre_legal ASC
       LIMIT 500`,
      valores
    );

    await connection.end();
    return NextResponse.json({ success: true, proveedores: rows });
  } catch (error: any) {
    if (connection) await connection.end();
    console.error('Error al obtener proveedores:', error);
    return NextResponse.json(
      { error: 'Error al obtener proveedores', detalle: error.message },
      { status: 500 }
    );
  }
}

// POST - Crear proveedor (con sus contactos)
export async function POST(request: NextRequest) {
  let connection;
  try {
    const body = await request.json();

    if (!body.nombre_legal || String(body.nombre_legal).trim() === '') {
      return NextResponse.json(
        { error: 'El nombre legal es obligatorio' },
        { status: 400 }
      );
    }

    connection = await connectDB();
    await connection.beginTransaction();

    // Si no envían código, se autogenera según el tipo
    let codigo = body.codigo && String(body.codigo).trim() !== ''
      ? String(body.codigo).trim()
      : await siguienteCodigo(connection, body.tipo_proveedor || 'LOCAL');

    const datos = { ...body, codigo };
    const valores = CAMPOS_PROVEEDOR.map((c) => normalizarValor(c, datos[c]));
    const placeholders = CAMPOS_PROVEEDOR.map(() => '?').join(', ');

    const [resultado]: any = await connection.execute(
      `INSERT INTO proveedores (${CAMPOS_PROVEEDOR.join(', ')})
       VALUES (${placeholders})`,
      valores
    );

    const idproveedor = resultado.insertId;

    // Contactos
    const contactos: Contacto[] = Array.isArray(body.contactos) ? body.contactos : [];
    for (let i = 0; i < contactos.length; i++) {
      const c = contactos[i];
      // Se omiten los bloques vacíos
      if (!c.nombre && !c.telefono && !c.movil && !c.email && !c.puesto_cargo) continue;

      await connection.execute(
        `INSERT INTO proveedor_contactos
          (idproveedor, orden, nombre, puesto_cargo, telefono, movil, email)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          idproveedor,
          c.orden ?? i + 1,
          c.nombre || null,
          c.puesto_cargo || null,
          c.telefono || null,
          c.movil || null,
          c.email || null,
        ]
      );
    }

    await connection.commit();
    await connection.end();

    return NextResponse.json({
      success: true,
      idproveedor,
      codigo,
      mensaje: 'Proveedor creado correctamente',
    });
  } catch (error: any) {
    if (connection) {
      await connection.rollback();
      await connection.end();
    }
    console.error('Error al crear proveedor:', error);

    if (error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json(
        { error: 'Ya existe un proveedor con ese código' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Error al crear proveedor', detalle: error.message },
      { status: 500 }
    );
  }
}

// PUT - Actualizar proveedor (reemplaza sus contactos)
export async function PUT(request: NextRequest) {
  let connection;
  try {
    const body = await request.json();
    const id = body.idproveedor;

    if (!id) {
      return NextResponse.json(
        { error: 'Falta el idproveedor' },
        { status: 400 }
      );
    }

    if (!body.nombre_legal || String(body.nombre_legal).trim() === '') {
      return NextResponse.json(
        { error: 'El nombre legal es obligatorio' },
        { status: 400 }
      );
    }

    connection = await connectDB();
    await connection.beginTransaction();

    const asignaciones = CAMPOS_PROVEEDOR.map((c) => `${c} = ?`).join(', ');
    const valores = CAMPOS_PROVEEDOR.map((c) => normalizarValor(c, body[c]));

    await connection.execute(
      `UPDATE proveedores SET ${asignaciones} WHERE idproveedor = ?`,
      [...valores, id]
    );

    // Los contactos se reemplazan completos
    if (Array.isArray(body.contactos)) {
      await connection.execute(
        'DELETE FROM proveedor_contactos WHERE idproveedor = ?',
        [id]
      );

      for (let i = 0; i < body.contactos.length; i++) {
        const c: Contacto = body.contactos[i];
        if (!c.nombre && !c.telefono && !c.movil && !c.email && !c.puesto_cargo) continue;

        await connection.execute(
          `INSERT INTO proveedor_contactos
            (idproveedor, orden, nombre, puesto_cargo, telefono, movil, email)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            c.orden ?? i + 1,
            c.nombre || null,
            c.puesto_cargo || null,
            c.telefono || null,
            c.movil || null,
            c.email || null,
          ]
        );
      }
    }

    await connection.commit();
    await connection.end();

    return NextResponse.json({
      success: true,
      mensaje: 'Proveedor actualizado correctamente',
    });
  } catch (error: any) {
    if (connection) {
      await connection.rollback();
      await connection.end();
    }
    console.error('Error al actualizar proveedor:', error);

    if (error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json(
        { error: 'Ya existe un proveedor con ese código' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Error al actualizar proveedor', detalle: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Desactivar proveedor. Con ?permanente=true lo elimina de verdad.
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
      // Los contactos y cuentas caen por ON DELETE CASCADE
      await connection.execute('DELETE FROM proveedores WHERE idproveedor = ?', [id]);
      await connection.end();
      return NextResponse.json({
        success: true,
        mensaje: 'Proveedor eliminado permanentemente',
      });
    }

    await connection.execute(
      'UPDATE proveedores SET activo = FALSE WHERE idproveedor = ?',
      [id]
    );
    await connection.end();

    return NextResponse.json({
      success: true,
      mensaje: 'Proveedor desactivado',
    });
  } catch (error: any) {
    if (connection) await connection.end();
    console.error('Error al eliminar proveedor:', error);
    return NextResponse.json(
      { error: 'Error al eliminar proveedor', detalle: error.message },
      { status: 500 }
    );
  }
}
