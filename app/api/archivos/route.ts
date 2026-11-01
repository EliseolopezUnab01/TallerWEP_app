import { NextRequest, NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2/promise';
import { connectDB } from '@/lib/db';
import { CARPETAS_ARCHIVOS, eliminarArchivos, guardarArchivo, type CarpetaArchivo } from '@/lib/archivos';

// GET ?nodocto= | ?entidad=&identidad=
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const nodocto = Number(searchParams.get('nodocto')) || 0;
  const entidad = searchParams.get('entidad');
  const identidad = Number(searchParams.get('identidad')) || 0;
  if (!nodocto && !(entidad && identidad)) {
    return NextResponse.json({ error: 'Indique nodocto o entidad e identidad' }, { status: 400 });
  }
  const connection = await connectDB();
  try {
    const [rows] = nodocto
      ? await connection.execute<RowDataPacket[]>(
          'SELECT * FROM ruta_archivos WHERE nodocto = ? ORDER BY idarchivo',
          [nodocto]
        )
      : await connection.execute<RowDataPacket[]>(
          'SELECT * FROM ruta_archivos WHERE entidad = ? AND identidad = ? ORDER BY idarchivo',
          [entidad, identidad]
        );
    return NextResponse.json({ success: true, archivos: rows });
  } catch (error) {
    console.error('Error al listar archivos:', error);
    return NextResponse.json({ error: 'Error al listar archivos' }, { status: 500 });
  } finally {
    await connection.end();
  }
}

// POST multipart: archivo, carpeta, nodocto | entidad + identidad, tipo_archivo?, descripcion?
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const archivo = form.get('archivo');
  const carpeta = String(form.get('carpeta') || '') as CarpetaArchivo;
  if (!(archivo instanceof File)) return NextResponse.json({ error: 'Falta el archivo' }, { status: 400 });
  if (!CARPETAS_ARCHIVOS.includes(carpeta)) return NextResponse.json({ error: 'Carpeta no válida' }, { status: 400 });

  const nodocto = Number(form.get('nodocto')) || null;
  const entidad = form.get('entidad') ? String(form.get('entidad')) : null;
  const identidad = Number(form.get('identidad')) || null;
  if (!nodocto && !(entidad && identidad)) {
    return NextResponse.json({ error: 'Indique nodocto o entidad e identidad' }, { status: 400 });
  }

  const connection = await connectDB();
  try {
    const guardado = await guardarArchivo(connection, archivo, {
      carpeta,
      nodocto,
      entidad,
      identidad,
      tipo_archivo: form.get('tipo_archivo') ? String(form.get('tipo_archivo')) : null,
      descripcion: form.get('descripcion') ? String(form.get('descripcion')) : null,
    });
    return NextResponse.json({ success: true, ...guardado });
  } catch (error) {
    console.error('Error al guardar archivo:', error);
    return NextResponse.json({ error: (error as Error).message || 'Error al guardar archivo' }, { status: 400 });
  } finally {
    await connection.end();
  }
}

// DELETE ?id=
export async function DELETE(request: NextRequest) {
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
  const connection = await connectDB();
  try {
    const borrados = await eliminarArchivos(connection, { idarchivo: id });
    if (!borrados) return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar archivo:', error);
    return NextResponse.json({ error: 'Error al eliminar archivo' }, { status: 500 });
  } finally {
    await connection.end();
  }
}
