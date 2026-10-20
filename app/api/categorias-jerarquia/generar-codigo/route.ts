import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';

// POST: Generar código jerárquico para un nuevo producto
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { idcategoria, id_grupo, id_subgrupo } = body;

    if (!idcategoria) {
      return NextResponse.json({ error: 'Se requiere idcategoria' }, { status: 400 });
    }

    const connection = await connectDB();

    // Obtener código del grupo
    let codigoGrupo = '000';
    if (id_grupo) {
      const [grupoData]: any = await connection.execute(
        'SELECT codigo FROM grupos WHERE id_grupo = ?',
        [id_grupo]
      );
      if (grupoData.length > 0) {
        codigoGrupo = grupoData[0].codigo;
      }
    }

    // Obtener código del subgrupo
    let codigoSubgrupo = '000';
    if (id_subgrupo) {
      const [subgrupoData]: any = await connection.execute(
        'SELECT codigo FROM subgrupos WHERE id_subgrupo = ?',
        [id_subgrupo]
      );
      if (subgrupoData.length > 0) {
        codigoSubgrupo = subgrupoData[0].codigo;
      }
    }

    // Formar código jerárquico: CC + GGG + SSS = 8 dígitos
    const codigoFinal = `${String(idcategoria).padStart(2, '0')}${codigoGrupo.padStart(3, '0')}${codigoSubgrupo.padStart(3, '0')}`;

    await connection.end();

    return NextResponse.json({
      success: true,
      codigo_jerarquico: codigoFinal,
      desglose: {
        categoria: String(idcategoria).padStart(2, '0'),
        grupo: codigoGrupo.padStart(3, '0'),
        subgrupo: codigoSubgrupo.padStart(3, '0')
      }
    });

  } catch (error: any) {
    console.error('Error generando código:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
