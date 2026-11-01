import { NextRequest, NextResponse } from 'next/server';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { connectDB } from '@/lib/db';
import { CLAVES_PERMISO } from '@/lib/permisos-constantes';
import { olvidarSesiones } from '@/lib/sesion';

const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
type Conexion = Awaited<ReturnType<typeof connectDB>>;

function permisosValidos(valor: unknown): string[] {
  if (!Array.isArray(valor)) return [];
  return [...new Set(valor.map(String).filter((p) => CLAVES_PERMISO.has(p)))];
}

async function guardarPermisos(connection: Conexion, idrol: number, permisos: string[]) {
  await connection.execute('DELETE FROM rol_permisos WHERE idrol = ?', [idrol]);
  for (const p of permisos) {
    await connection.execute('INSERT INTO rol_permisos (idrol, permiso) VALUES (?, ?)', [idrol, p]);
  }
}

export async function GET() {
  const connection = await connectDB();
  try {
    const [roles] = await connection.execute<RowDataPacket[]>(
      `SELECT r.idrol, r.nombre, r.descripcion, r.es_admin,
              (SELECT COUNT(*) FROM usuarios u WHERE u.idrol = r.idrol) AS usuarios
       FROM roles r ORDER BY r.es_admin DESC, r.nombre`
    );
    const [perms] = await connection.execute<RowDataPacket[]>('SELECT idrol, permiso FROM rol_permisos');
    const porRol = new Map<number, string[]>();
    for (const p of perms) {
      const lista = porRol.get(Number(p.idrol)) ?? [];
      lista.push(String(p.permiso));
      porRol.set(Number(p.idrol), lista);
    }
    return json({
      success: true,
      roles: roles.map((r) => ({
        ...r,
        es_admin: Number(r.es_admin) === 1,
        usuarios: Number(r.usuarios),
        permisos: porRol.get(Number(r.idrol)) ?? [],
      })),
    });
  } finally {
    await connection.end();
  }
}

// POST { nombre, descripcion?, permisos[] }
export async function POST(request: NextRequest) {
  const body = await request.json();
  const nombre = String(body.nombre || '').trim();
  if (!nombre) return json({ error: 'Indique el nombre del rol' }, 400);
  const connection = await connectDB();
  try {
    const [dup] = await connection.execute<RowDataPacket[]>('SELECT idrol FROM roles WHERE nombre = ?', [nombre]);
    if (dup[0]) return json({ error: 'Ya existe un rol con ese nombre' }, 400);
    await connection.beginTransaction();
    const [res] = await connection.execute<ResultSetHeader>(
      'INSERT INTO roles (nombre, descripcion, es_admin) VALUES (?, ?, 0)',
      [nombre, String(body.descripcion || '').trim() || null]
    );
    await guardarPermisos(connection, res.insertId, permisosValidos(body.permisos));
    await connection.commit();
    return json({ success: true, idrol: res.insertId, mensaje: `Rol ${nombre} creado` });
  } finally {
    await connection.end();
  }
}

// PUT { idrol, nombre?, descripcion?, permisos? }
export async function PUT(request: NextRequest) {
  const body = await request.json();
  const idrol = Number(body.idrol);
  if (!idrol) return json({ error: 'Falta el rol' }, 400);
  const connection = await connectDB();
  try {
    const [rows] = await connection.execute<RowDataPacket[]>('SELECT es_admin FROM roles WHERE idrol = ?', [idrol]);
    if (!rows[0]) return json({ error: 'Rol no encontrado' }, 404);
    if (Number(rows[0].es_admin) === 1) return json({ error: 'El rol Administrador no se edita: tiene todos los permisos' }, 400);

    await connection.beginTransaction();
    if (body.nombre !== undefined) {
      const nombre = String(body.nombre).trim();
      if (!nombre) {
        await connection.rollback();
        return json({ error: 'Indique el nombre del rol' }, 400);
      }
      const [dup] = await connection.execute<RowDataPacket[]>('SELECT idrol FROM roles WHERE nombre = ? AND idrol <> ?', [nombre, idrol]);
      if (dup[0]) {
        await connection.rollback();
        return json({ error: 'Ya existe un rol con ese nombre' }, 400);
      }
      await connection.execute('UPDATE roles SET nombre = ?, descripcion = ? WHERE idrol = ?', [
        nombre,
        String(body.descripcion ?? '').trim() || null,
        idrol,
      ]);
    }
    if (body.permisos !== undefined) await guardarPermisos(connection, idrol, permisosValidos(body.permisos));
    await connection.commit();
    olvidarSesiones();
    return json({ success: true, mensaje: 'Rol actualizado' });
  } finally {
    await connection.end();
  }
}

// DELETE ?id=
export async function DELETE(request: NextRequest) {
  const idrol = Number(new URL(request.url).searchParams.get('id'));
  if (!idrol) return json({ error: 'Falta el rol' }, 400);
  const connection = await connectDB();
  try {
    const [rows] = await connection.execute<RowDataPacket[]>(
      'SELECT es_admin, (SELECT COUNT(*) FROM usuarios WHERE idrol = ?) AS usuarios FROM roles WHERE idrol = ?',
      [idrol, idrol]
    );
    if (!rows[0]) return json({ error: 'Rol no encontrado' }, 404);
    if (Number(rows[0].es_admin) === 1) return json({ error: 'El rol Administrador no se puede borrar' }, 400);
    if (Number(rows[0].usuarios) > 0) return json({ error: 'Hay usuarios con este rol; asígneles otro primero' }, 400);
    await connection.execute('DELETE FROM roles WHERE idrol = ?', [idrol]);
    return json({ success: true, mensaje: 'Rol eliminado' });
  } finally {
    await connection.end();
  }
}
