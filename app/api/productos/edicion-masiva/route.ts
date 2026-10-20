import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';

// PUT: Actualizar múltiples productos a la vez
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { ids, campos } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'No se proporcionaron IDs de productos' },
        { status: 400 }
      );
    }

    if (!campos || Object.keys(campos).length === 0) {
      return NextResponse.json(
        { error: 'No se proporcionaron campos para actualizar' },
        { status: 400 }
      );
    }

    // Campos permitidos para edición masiva (campos comunes, no únicos)
    const camposPermitidos = [
      'marca',
      'idcategoria_nuevo',
      'id_grupo',
      'id_subgrupo',
      'unimedida',
      'lado',
      'exento',
      'modelo',
      'clase',
      'estilo',
      'giro',
    ];

    // Filtrar solo campos permitidos
    const camposValidos: Record<string, any> = {};
    for (const [key, value] of Object.entries(campos)) {
      if (camposPermitidos.includes(key)) {
        camposValidos[key] = value;
      }
    }

    if (Object.keys(camposValidos).length === 0) {
      return NextResponse.json(
        { error: 'Ninguno de los campos proporcionados es válido para edición masiva' },
        { status: 400 }
      );
    }

    const connection = await connectDB();

    // Construir la consulta UPDATE
    const setClauses: string[] = [];
    const params: any[] = [];

    for (const [key, value] of Object.entries(camposValidos)) {
      setClauses.push(`${key} = ?`);
      params.push(value);
    }

    // Agregar los IDs al final de los parámetros
    const placeholders = ids.map(() => '?').join(',');
    params.push(...ids);

    const query = `
      UPDATE productos 
      SET ${setClauses.join(', ')}, updated_at = NOW()
      WHERE idprod IN (${placeholders})
    `;

    console.log('📝 Edición masiva:', { query, params, ids: ids.length });

    const [result]: any = await connection.execute(query, params);

    await connection.end();

    return NextResponse.json({
      success: true,
      actualizados: result.affectedRows,
      campos: Object.keys(camposValidos),
      message: `Se actualizaron ${result.affectedRows} productos`
    });

  } catch (error: any) {
    console.error('Error en edición masiva:', error);
    return NextResponse.json(
      { error: error.message || 'Error al realizar la edición masiva' },
      { status: 500 }
    );
  }
}
