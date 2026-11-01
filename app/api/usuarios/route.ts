import { NextRequest, NextResponse } from 'next/server';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { connectDB } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { olvidarSesiones, requierePermiso } from '@/lib/sesion';

const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function adminsActivos(connection: Awaited<ReturnType<typeof connectDB>>, excepto: number) {
  const [rows] = await connection.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM usuarios u JOIN roles r ON r.idrol = u.idrol
     WHERE r.es_admin = 1 AND u.activo = 1 AND u.id <> ?`,
    [excepto]
  );
  return Number(rows[0].total);
}

export async function GET() {
  const connection = await connectDB();
  try {
    const [usuarios] = await connection.execute<RowDataPacket[]>(
      `SELECT u.id, u.nombre, u.email, u.idrol, u.activo, u.ultimo_acceso, u.created_at, r.nombre AS rol
       FROM usuarios u LEFT JOIN roles r ON r.idrol = u.idrol ORDER BY u.activo DESC, u.nombre`
    );
    return json({ success: true, usuarios });
  } finally {
    await connection.end();
  }
}

// POST { nombre, email, password, idrol }
export async function POST(request: NextRequest) {
  const body = await request.json();
  const nombre = String(body.nombre || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const idrol = Number(body.idrol) || null;
  if (!nombre || !EMAIL.test(email)) return json({ error: 'Indique nombre y un correo válido' }, 400);
  if (password.length < 6) return json({ error: 'La contraseña debe tener al menos 6 caracteres' }, 400);
  if (!idrol) return json({ error: 'Asigne un rol' }, 400);

  const connection = await connectDB();
  try {
    const [dup] = await connection.execute<RowDataPacket[]>('SELECT id FROM usuarios WHERE email = ?', [email]);
    if (dup[0]) return json({ error: 'Ya existe un usuario con ese correo' }, 400);
    const [res] = await connection.execute<ResultSetHeader>(
      'INSERT INTO usuarios (nombre, email, password, idrol, activo) VALUES (?, ?, ?, ?, 1)',
      [nombre, email, await hashPassword(password), idrol]
    );
    return json({ success: true, id: res.insertId, mensaje: `Usuario ${nombre} creado` });
  } finally {
    await connection.end();
  }
}

// PUT { id, nombre?, email?, idrol?, activo?, password? }
export async function PUT(request: NextRequest) {
  const auth = await requierePermiso(request, 'usuarios.editar');
  if (auth instanceof NextResponse) return auth;
  const body = await request.json();
  const id = Number(body.id);
  if (!id) return json({ error: 'Falta el id' }, 400);

  const connection = await connectDB();
  try {
    const [rows] = await connection.execute<RowDataPacket[]>(
      'SELECT u.id, u.idrol, u.activo, COALESCE(r.es_admin, 0) AS es_admin FROM usuarios u LEFT JOIN roles r ON r.idrol = u.idrol WHERE u.id = ?',
      [id]
    );
    const actual = rows[0];
    if (!actual) return json({ error: 'Usuario no encontrado' }, 404);

    const campos: string[] = [];
    const valores: (string | number | null)[] = [];
    if (body.nombre !== undefined) {
      const nombre = String(body.nombre).trim();
      if (!nombre) return json({ error: 'El nombre es obligatorio' }, 400);
      campos.push('nombre = ?');
      valores.push(nombre);
    }
    if (body.email !== undefined) {
      const email = String(body.email).trim().toLowerCase();
      if (!EMAIL.test(email)) return json({ error: 'Correo no válido' }, 400);
      const [dup] = await connection.execute<RowDataPacket[]>('SELECT id FROM usuarios WHERE email = ? AND id <> ?', [email, id]);
      if (dup[0]) return json({ error: 'Ya existe un usuario con ese correo' }, 400);
      campos.push('email = ?');
      valores.push(email);
    }

    let quedaAdmin = Number(actual.es_admin) === 1;
    let quedaActivo = Number(actual.activo) === 1;
    if (body.idrol !== undefined) {
      const idrol = Number(body.idrol) || null;
      if (!idrol) return json({ error: 'Asigne un rol' }, 400);
      const [rol] = await connection.execute<RowDataPacket[]>('SELECT es_admin FROM roles WHERE idrol = ?', [idrol]);
      if (!rol[0]) return json({ error: 'Rol no encontrado' }, 400);
      quedaAdmin = Number(rol[0].es_admin) === 1;
      campos.push('idrol = ?');
      valores.push(idrol);
    }
    if (body.activo !== undefined) {
      quedaActivo = Boolean(body.activo);
      if (!quedaActivo && id === auth.id) return json({ error: 'No puede desactivar su propio usuario' }, 400);
      campos.push('activo = ?');
      valores.push(quedaActivo ? 1 : 0);
    }
    if (Number(actual.es_admin) === 1 && (!quedaAdmin || !quedaActivo) && (await adminsActivos(connection, id)) === 0) {
      return json({ error: 'Debe quedar al menos un administrador activo' }, 400);
    }
    if (body.password) {
      const password = String(body.password);
      if (password.length < 6) return json({ error: 'La contraseña debe tener al menos 6 caracteres' }, 400);
      campos.push('password = ?');
      valores.push(await hashPassword(password));
    }
    if (campos.length === 0) return json({ success: true, mensaje: 'Sin cambios' });

    await connection.execute(`UPDATE usuarios SET ${campos.join(', ')} WHERE id = ?`, [...valores, id]);
    olvidarSesiones();
    return json({ success: true, mensaje: 'Usuario actualizado' });
  } finally {
    await connection.end();
  }
}
