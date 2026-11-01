import { NextRequest, NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2/promise';
import { connectDB } from '@/lib/db';
import { siguienteCorrelativo } from '@/lib/correlativos';
import { eliminarArchivos } from '@/lib/archivos';
import { CAMPOS_VEHICULO, actualizarFila, errorDuplicado, extraerCampos, insertarFila } from '@/lib/taller';

const ENTIDAD = 'VEHICULO';

// GET: lista (?q=, ?cliente_id=) | ?id= (ficha, partes, historial de estados, recordatorios, tarjeta)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get('id')) || 0;
  const connection = await connectDB();
  try {
    if (id) {
      const [rows] = await connection.execute<RowDataPacket[]>(
        `SELECT v.*, c.codigo AS cliente_codigo, c.nombre AS cliente_nombre, c.dui AS cliente_dui
         FROM vehiculos v JOIN clientes c ON c.id = v.cliente_id WHERE v.id = ?`,
        [id]
      );
      if (!rows[0]) return NextResponse.json({ error: 'Vehículo no encontrado' }, { status: 404 });

      const [partes] = await connection.execute<RowDataPacket[]>(
        `SELECT p.*, s.nombre AS sistema_nombre, s.orden AS sistema_orden, pr.nombre AS producto_nombre,
                r.nombre_parte AS reemplaza_nombre,
                (SELECT n.idparte FROM vehiculo_partes n WHERE n.reemplaza_a = p.idparte LIMIT 1) AS reemplazada_por,
                e.estado_texto AS ultimo_estado, e.estado_visual AS ultimo_visual,
                DATE_FORMAT(e.fecha, '%Y-%m-%d') AS ultima_revision
         FROM vehiculo_partes p
         JOIN cat_sistemas_vehiculo s ON s.idsistema = p.idsistema
         LEFT JOIN productos pr ON pr.idprod = p.idprod
         LEFT JOIN vehiculo_partes r ON r.idparte = p.reemplaza_a
         LEFT JOIN estado_partes e ON e.idestado = (
           SELECT x.idestado FROM estado_partes x WHERE x.idparte = p.idparte ORDER BY x.fecha DESC, x.idestado DESC LIMIT 1)
         WHERE p.idvehiculo = ?
         ORDER BY s.orden, s.nombre, p.estado_instalacion, p.nombre_parte, p.idparte DESC`,
        [id]
      );
      const [estados] = await connection.execute<RowDataPacket[]>(
        `SELECT e.*, DATE_FORMAT(e.fecha, '%Y-%m-%d') AS fecha, p.nombre_parte, p.posicion, s.nombre AS sistema_nombre,
                CONCAT(em.nombre, ' ', em.apellido) AS empleado_nombre, o.numero_orden
         FROM estado_partes e
         JOIN vehiculo_partes p ON p.idparte = e.idparte
         JOIN cat_sistemas_vehiculo s ON s.idsistema = p.idsistema
         LEFT JOIN empleados em ON em.id = e.idempleado
         LEFT JOIN ordenes_trabajo o ON o.id = e.idorden
         WHERE p.idvehiculo = ?
         ORDER BY e.fecha DESC, e.idestado DESC LIMIT 500`,
        [id]
      );
      const [recordatorios] = await connection.execute<RowDataPacket[]>(
        `SELECT r.*, DATE_FORMAT(r.ultimo_fecha, '%Y-%m-%d') AS ultimo_fecha,
                DATE_FORMAT(r.proximo_fecha, '%Y-%m-%d') AS proximo_fecha, s.nombre AS sistema_nombre, p.nombre_parte
         FROM recordatorios_mantenimiento r
         LEFT JOIN cat_sistemas_vehiculo s ON s.idsistema = r.idsistema
         LEFT JOIN vehiculo_partes p ON p.idparte = r.idparte
         WHERE r.idvehiculo = ?
         ORDER BY r.activo DESC, COALESCE(r.proximo_fecha, '9999-12-31'), r.descripcion`,
        [id]
      );
      const [ordenes] = await connection.execute<RowDataPacket[]>(
        'SELECT id, numero_orden, estado, fecha_recepcion FROM ordenes_trabajo WHERE vehiculo_id = ? ORDER BY id DESC LIMIT 50',
        [id]
      );
      const [archivos] = await connection.execute<RowDataPacket[]>(
        'SELECT idarchivo, ruta, nombre_original, descripcion, created_at FROM ruta_archivos WHERE entidad = ? AND identidad = ? ORDER BY idarchivo DESC',
        [ENTIDAD, id]
      );
      return NextResponse.json({ success: true, vehiculo: rows[0], partes, estados, recordatorios, ordenes, archivos });
    }

    const filtros: string[] = [];
    const valores: (string | number)[] = [];
    const q = searchParams.get('q')?.trim();
    if (q) {
      filtros.push('(v.codigo LIKE ? OR v.placa LIKE ? OR v.marca LIKE ? OR v.modelo LIKE ? OR v.vin LIKE ? OR c.nombre LIKE ?)');
      const like = `%${q}%`;
      valores.push(like, like, like, like, like, like);
    }
    const clienteId = Number(searchParams.get('cliente_id')) || 0;
    if (clienteId) {
      filtros.push('v.cliente_id = ?');
      valores.push(clienteId);
    }
    const [vehiculos] = await connection.execute<RowDataPacket[]>(
      `SELECT v.id, v.codigo, v.cliente_id, v.placa, v.anio_placa, v.marca, v.modelo, v.anio_modelo, v.color, v.activo,
              v.tarjeta_vencimiento, v.odometro_actual, c.nombre AS cliente_nombre,
              (SELECT COUNT(*) FROM recordatorios_mantenimiento r
               WHERE r.idvehiculo = v.id AND r.activo = 1
                 AND (r.proximo_fecha < CURDATE() OR r.proximo_km < v.odometro_actual)) AS recordatorios_vencidos
       FROM vehiculos v JOIN clientes c ON c.id = v.cliente_id
       ${filtros.length ? `WHERE ${filtros.join(' AND ')}` : ''}
       ORDER BY v.placa, v.id LIMIT 300`,
      valores
    );
    return NextResponse.json({ success: true, vehiculos });
  } catch (error) {
    console.error('Error al obtener vehículos:', error);
    return NextResponse.json({ error: 'Error al obtener vehículos', detalle: (error as Error).message }, { status: 500 });
  } finally {
    await connection.end();
  }
}

function validar(datos: Record<string, string | number | null>, nuevo: boolean) {
  for (const [campo, nombre] of [
    ['cliente_id', 'el cliente'],
    ['marca', 'la marca'],
    ['modelo', 'el modelo'],
  ] as const) {
    if ((nuevo || campo in datos) && !datos[campo]) return `Indique ${nombre}`;
  }
  if (datos.ejes != null && (Number(datos.ejes) < 1 || Number(datos.ejes) > 10)) return 'Los ejes deben estar entre 1 y 10';
  return null;
}

function mensajeDuplicado(error: unknown) {
  const texto = (error as Error).message || '';
  return texto.includes('uq_vehiculos_placa') ? 'Ya existe un vehículo con esa placa' : 'Código de vehículo repetido';
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Record<string, unknown>;
  const datos = extraerCampos(body, CAMPOS_VEHICULO);
  const error = validar(datos, true);
  if (error) return NextResponse.json({ error }, { status: 400 });
  const connection = await connectDB();
  try {
    const [cliente] = await connection.execute<RowDataPacket[]>('SELECT id FROM clientes WHERE id = ?', [datos.cliente_id]);
    if (!cliente[0]) return NextResponse.json({ error: 'El cliente no existe' }, { status: 400 });
    if (datos.placa) {
      const [repetida] = await connection.execute<RowDataPacket[]>('SELECT id FROM vehiculos WHERE placa = ?', [datos.placa]);
      if (repetida[0]) return NextResponse.json({ error: 'Ya existe un vehículo con esa placa' }, { status: 400 });
    }
    datos.codigo = (await siguienteCorrelativo(connection, 'VH')).codigo;
    if (datos.activo === undefined) datos.activo = 1;
    const id = await insertarFila(connection, 'vehiculos', datos);
    return NextResponse.json({ success: true, id, codigo: datos.codigo, mensaje: `Vehículo ${datos.codigo} creado` });
  } catch (error) {
    if (errorDuplicado(error)) return NextResponse.json({ error: mensajeDuplicado(error) }, { status: 400 });
    console.error('Error al crear vehículo:', error);
    return NextResponse.json({ error: 'Error al crear vehículo', detalle: (error as Error).message }, { status: 500 });
  } finally {
    await connection.end();
  }
}

export async function PUT(request: NextRequest) {
  const body = (await request.json()) as Record<string, unknown>;
  const id = Number(body.id);
  if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
  const datos = extraerCampos(body, CAMPOS_VEHICULO);
  const error = validar(datos, false);
  if (error) return NextResponse.json({ error }, { status: 400 });
  const connection = await connectDB();
  try {
    await actualizarFila(connection, 'vehiculos', 'id', id, datos);
    return NextResponse.json({ success: true, mensaje: 'Vehículo guardado' });
  } catch (error) {
    if (errorDuplicado(error)) return NextResponse.json({ error: mensajeDuplicado(error) }, { status: 400 });
    console.error('Error al actualizar vehículo:', error);
    return NextResponse.json({ error: 'Error al actualizar vehículo', detalle: (error as Error).message }, { status: 500 });
  } finally {
    await connection.end();
  }
}

// DELETE ?id=: con órdenes de trabajo solo se desactiva; sin órdenes se borra con partes, estados y fotos.
export async function DELETE(request: NextRequest) {
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
  const connection = await connectDB();
  try {
    const [uso] = await connection.execute<RowDataPacket[]>('SELECT COUNT(*) AS n FROM ordenes_trabajo WHERE vehiculo_id = ?', [id]);
    if (Number(uso[0].n) > 0) {
      await connection.execute('UPDATE vehiculos SET activo = 0 WHERE id = ?', [id]);
      return NextResponse.json({ success: true, mensaje: 'El vehículo tiene órdenes de trabajo; quedó inactivo' });
    }
    await eliminarArchivos(connection, { entidad: ENTIDAD, identidad: id });
    await connection.execute('DELETE FROM vehiculos WHERE id = ?', [id]);
    return NextResponse.json({ success: true, mensaje: 'Vehículo eliminado' });
  } catch (error) {
    console.error('Error al eliminar vehículo:', error);
    return NextResponse.json({ error: 'Error al eliminar vehículo', detalle: (error as Error).message }, { status: 500 });
  } finally {
    await connection.end();
  }
}
