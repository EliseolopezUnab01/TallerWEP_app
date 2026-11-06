import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { requierePermiso, usuarioDeRequest } from '@/lib/sesion';
import { OPCIONES_SISTEMA, leerConfiguracion, olvidarConfiguracion, type ClaveConfiguracion } from '@/lib/configuracion';

export async function GET() {
  const connection = await connectDB();
  try {
    return NextResponse.json({ success: true, configuracion: await leerConfiguracion(connection) });
  } catch (error) {
    console.error('Error al leer la configuración:', error);
    return NextResponse.json({ error: 'Error al leer la configuración' }, { status: 500 });
  } finally {
    await connection.end();
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requierePermiso(request, 'configuracion.editar');
  if (auth instanceof NextResponse) return auth;
  const body = await request.json().catch(() => ({}));
  const cambios = Object.entries(body).filter(([clave]) => clave in OPCIONES_SISTEMA) as [ClaveConfiguracion, unknown][];
  if (cambios.length === 0) return NextResponse.json({ error: 'Nada que guardar' }, { status: 400 });

  const connection = await connectDB();
  try {
    const idusuario = await usuarioDeRequest(request);
    for (const [clave, valor] of cambios) {
      const texto = typeof valor === 'boolean' ? (valor ? '1' : '0') : String(valor ?? '').slice(0, 255);
      await connection.execute(
        `INSERT INTO configuracion_sistema (clave, valor, actualizado_por) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE valor = VALUES(valor), actualizado_por = VALUES(actualizado_por)`,
        [clave, texto, idusuario]
      );
    }
    olvidarConfiguracion();
    return NextResponse.json({ success: true, configuracion: await leerConfiguracion(connection), mensaje: 'Configuración guardada' });
  } catch (error) {
    console.error('Error al guardar la configuración:', error);
    return NextResponse.json({ error: 'Error al guardar la configuración' }, { status: 500 });
  } finally {
    await connection.end();
  }
}
