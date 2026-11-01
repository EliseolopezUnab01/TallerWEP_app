import { NextResponse } from 'next/server';
import path from 'path';
import { readFile } from 'fs/promises';
import { EXTENSIONES_IMAGEN, TIPOS_ARCHIVO, extensionDe } from '@/lib/archivos';

// Sirve public/uploads cuando el archivo se subió después del build (next start no los ve).
// La sesión la exige el proxy, que cubre /uploads/*.
export async function GET(_request: Request, context: { params: Promise<{ ruta: string[] }> }) {
  const { ruta } = await context.params;
  const base = path.join(process.cwd(), 'public', 'uploads');
  const archivo = path.normalize(path.join(base, ...ruta));
  if (!archivo.startsWith(base + path.sep)) return NextResponse.json({ error: 'Ruta no válida' }, { status: 400 });

  const ext = extensionDe(archivo);
  const tipo = TIPOS_ARCHIVO[ext];
  if (!tipo) return NextResponse.json({ error: 'Tipo no permitido' }, { status: 403 });

  try {
    const datos = await readFile(archivo);
    const enLinea = EXTENSIONES_IMAGEN.includes(ext) || ext === 'pdf';
    return new NextResponse(new Uint8Array(datos), {
      headers: {
        'Content-Type': tipo,
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': `${enLinea ? 'inline' : 'attachment'}; filename="${path.basename(archivo)}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
  }
}
