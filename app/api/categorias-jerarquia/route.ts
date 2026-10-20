import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';

// GET: Obtener todas las categorías con sus grupos y subgrupos
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo'); // 'categorias', 'grupos', 'subgrupos', 'jerarquia'
    const idcategoria = searchParams.get('idcategoria');
    const id_grupo = searchParams.get('id_grupo');

    const connection = await connectDB();

    let result;

    if (tipo === 'categorias') {
      // Solo categorías
      const [categorias] = await connection.execute(`
        SELECT idcategoria, nombre, descripcion, activo 
        FROM categorias_nuevo 
        WHERE activo = 1 
        ORDER BY idcategoria
      `);
      result = { categorias };

    } else if (tipo === 'grupos') {
      // Grupos filtrados por categoría
      if (idcategoria) {
        const [grupos] = await connection.execute(`
          SELECT g.id_grupo, g.codigo, g.nombre, g.descripcion, g.idcategoria, c.nombre as categoria_nombre
          FROM grupos g
          JOIN categorias_nuevo c ON g.idcategoria = c.idcategoria
          WHERE g.idcategoria = ? AND g.activo = 1
          ORDER BY g.codigo
        `, [idcategoria]);
        result = { grupos };
      } else {
        const [grupos] = await connection.execute(`
          SELECT g.id_grupo, g.codigo, g.nombre, g.descripcion, g.idcategoria, c.nombre as categoria_nombre
          FROM grupos g
          JOIN categorias_nuevo c ON g.idcategoria = c.idcategoria
          WHERE g.activo = 1
          ORDER BY g.idcategoria, g.codigo
        `);
        result = { grupos };
      }

    } else if (tipo === 'subgrupos') {
      // Subgrupos filtrados por grupo
      if (id_grupo) {
        const [subgrupos] = await connection.execute(`
          SELECT s.id_subgrupo, s.codigo, s.nombre, s.descripcion, s.id_grupo, g.nombre as grupo_nombre
          FROM subgrupos s
          JOIN grupos g ON s.id_grupo = g.id_grupo
          WHERE s.id_grupo = ? AND s.activo = 1
          ORDER BY s.codigo
        `, [id_grupo]);
        result = { subgrupos };
      } else {
        const [subgrupos] = await connection.execute(`
          SELECT s.id_subgrupo, s.codigo, s.nombre, s.descripcion, s.id_grupo, g.nombre as grupo_nombre
          FROM subgrupos s
          JOIN grupos g ON s.id_grupo = g.id_grupo
          WHERE s.activo = 1
          ORDER BY s.id_grupo, s.codigo
        `);
        result = { subgrupos };
      }

    } else {
      // Jerarquía completa
      const [categorias] = await connection.execute(`
        SELECT idcategoria, nombre, descripcion 
        FROM categorias_nuevo 
        WHERE activo = 1 
        ORDER BY idcategoria
      `);

      const [grupos] = await connection.execute(`
        SELECT id_grupo, codigo, nombre, descripcion, idcategoria 
        FROM grupos 
        WHERE activo = 1 
        ORDER BY idcategoria, codigo
      `);

      const [subgrupos] = await connection.execute(`
        SELECT s.id_subgrupo, s.codigo, s.nombre, s.descripcion, s.id_grupo, g.idcategoria
        FROM subgrupos s
        JOIN grupos g ON s.id_grupo = g.id_grupo
        WHERE s.activo = 1 
        ORDER BY g.idcategoria, g.codigo, s.codigo
      `);

      // Estructurar jerarquía
      const jerarquia = (categorias as any[]).map(cat => ({
        ...cat,
        grupos: (grupos as any[])
          .filter(g => g.idcategoria === cat.idcategoria)
          .map(grupo => ({
            ...grupo,
            subgrupos: (subgrupos as any[]).filter(s => s.id_grupo === grupo.id_grupo)
          }))
      }));

      result = { jerarquia, categorias, grupos, subgrupos };
    }

    await connection.end();
    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Error en GET categorias-jerarquia:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST: Crear nueva categoría, grupo o subgrupo
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tipo, ...data } = body;

    const connection = await connectDB();
    let result;

    if (tipo === 'categoria') {
      const { idcategoria, nombre, descripcion } = data;
      
      // Verificar si ya existe una categoría ACTIVA con ese código
      const [existing]: any = await connection.execute(
        'SELECT idcategoria, activo FROM categorias_nuevo WHERE idcategoria = ?',
        [idcategoria]
      );
      
      if (existing.length > 0) {
        if (existing[0].activo === 1) {
          await connection.end();
          return NextResponse.json({ error: `Ya existe una categoría con el código ${idcategoria}` }, { status: 400 });
        } else {
          // Reactivar la categoría desactivada
          await connection.execute(
            'UPDATE categorias_nuevo SET nombre = ?, descripcion = ?, activo = 1 WHERE idcategoria = ?',
            [nombre, descripcion || null, idcategoria]
          );
          await connection.end();
          return NextResponse.json({ success: true, message: 'Categoría reactivada', idcategoria });
        }
      }
      
      await connection.execute(
        'INSERT INTO categorias_nuevo (idcategoria, nombre, descripcion) VALUES (?, ?, ?)',
        [idcategoria, nombre, descripcion || null]
      );
      result = { success: true, message: 'Categoría creada', idcategoria };

    } else if (tipo === 'grupo') {
      const { codigo, nombre, descripcion, idcategoria } = data;
      
      // Verificar si ya existe un grupo con ese código en la misma categoría
      const [existing]: any = await connection.execute(
        'SELECT id_grupo, activo FROM grupos WHERE codigo = ? AND idcategoria = ?',
        [codigo, idcategoria]
      );
      
      if (existing.length > 0) {
        if (existing[0].activo === 1) {
          await connection.end();
          return NextResponse.json({ error: `Ya existe un grupo con el código ${codigo} en esta categoría` }, { status: 400 });
        } else {
          // Reactivar el grupo desactivado
          await connection.execute(
            'UPDATE grupos SET nombre = ?, descripcion = ?, activo = 1 WHERE id_grupo = ?',
            [nombre, descripcion || null, existing[0].id_grupo]
          );
          await connection.end();
          return NextResponse.json({ success: true, message: 'Grupo reactivado', id_grupo: existing[0].id_grupo });
        }
      }
      
      const [insertResult]: any = await connection.execute(
        'INSERT INTO grupos (codigo, nombre, descripcion, idcategoria) VALUES (?, ?, ?, ?)',
        [codigo, nombre, descripcion || null, idcategoria]
      );
      result = { success: true, message: 'Grupo creado', id_grupo: insertResult.insertId };

    } else if (tipo === 'subgrupo') {
      const { codigo, nombre, descripcion, id_grupo } = data;
      
      // Verificar si ya existe un subgrupo con ese código en el mismo grupo
      const [existing]: any = await connection.execute(
        'SELECT id_subgrupo, activo FROM subgrupos WHERE codigo = ? AND id_grupo = ?',
        [codigo, id_grupo]
      );
      
      if (existing.length > 0) {
        if (existing[0].activo === 1) {
          await connection.end();
          return NextResponse.json({ error: `Ya existe un subgrupo con el código ${codigo} en este grupo` }, { status: 400 });
        } else {
          // Reactivar el subgrupo desactivado
          await connection.execute(
            'UPDATE subgrupos SET nombre = ?, descripcion = ?, activo = 1 WHERE id_subgrupo = ?',
            [nombre, descripcion || null, existing[0].id_subgrupo]
          );
          await connection.end();
          return NextResponse.json({ success: true, message: 'Subgrupo reactivado', id_subgrupo: existing[0].id_subgrupo });
        }
      }
      
      const [insertResult]: any = await connection.execute(
        'INSERT INTO subgrupos (codigo, nombre, descripcion, id_grupo) VALUES (?, ?, ?, ?)',
        [codigo, nombre, descripcion || null, id_grupo]
      );
      result = { success: true, message: 'Subgrupo creado', id_subgrupo: insertResult.insertId };

    } else {
      await connection.end();
      return NextResponse.json({ error: 'Tipo no válido' }, { status: 400 });
    }

    await connection.end();
    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Error en POST categorias-jerarquia:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// PUT: Actualizar categoría, grupo o subgrupo
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { tipo, ...data } = body;

    const connection = await connectDB();

    if (tipo === 'categoria') {
      const { idcategoria, nombre, descripcion, activo } = data;
      await connection.execute(
        'UPDATE categorias_nuevo SET nombre = ?, descripcion = ?, activo = ? WHERE idcategoria = ?',
        [nombre, descripcion, activo ?? 1, idcategoria]
      );

    } else if (tipo === 'grupo') {
      const { id_grupo, codigo, nombre, descripcion, activo } = data;
      await connection.execute(
        'UPDATE grupos SET codigo = ?, nombre = ?, descripcion = ?, activo = ? WHERE id_grupo = ?',
        [codigo, nombre, descripcion, activo ?? 1, id_grupo]
      );

    } else if (tipo === 'subgrupo') {
      const { id_subgrupo, codigo, nombre, descripcion, activo } = data;
      await connection.execute(
        'UPDATE subgrupos SET codigo = ?, nombre = ?, descripcion = ?, activo = ? WHERE id_subgrupo = ?',
        [codigo, nombre, descripcion, activo ?? 1, id_subgrupo]
      );

    } else {
      await connection.end();
      return NextResponse.json({ error: 'Tipo no válido' }, { status: 400 });
    }

    await connection.end();
    return NextResponse.json({ success: true, message: 'Actualizado correctamente' });

  } catch (error: any) {
    console.error('Error en PUT categorias-jerarquia:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// DELETE: Eliminar (desactivar) categoría, grupo o subgrupo
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo');
    const id = searchParams.get('id');

    if (!tipo || !id) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    const connection = await connectDB();

    if (tipo === 'categoria') {
      await connection.execute('UPDATE categorias_nuevo SET activo = 0 WHERE idcategoria = ?', [id]);
    } else if (tipo === 'grupo') {
      await connection.execute('UPDATE grupos SET activo = 0 WHERE id_grupo = ?', [id]);
    } else if (tipo === 'subgrupo') {
      await connection.execute('UPDATE subgrupos SET activo = 0 WHERE id_subgrupo = ?', [id]);
    } else {
      await connection.end();
      return NextResponse.json({ error: 'Tipo no válido' }, { status: 400 });
    }

    await connection.end();
    return NextResponse.json({ success: true, message: 'Desactivado correctamente' });

  } catch (error: any) {
    console.error('Error en DELETE categorias-jerarquia:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
