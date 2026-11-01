import { NextRequest, NextResponse } from 'next/server';
import type { Connection, RowDataPacket } from 'mysql2/promise';
import { connectDB } from '@/lib/db';
import { limpiar } from '@/lib/compras-detalle-db';
import { CAMPOS_PARTE, actualizarFila, avanzarOdometro, extraerCampos, insertarFila } from '@/lib/taller';

function hoy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function validarReferencias(connection: Connection, datos: Record<string, string | number | null>) {
  if (datos.idsistema) {
    const [s] = await connection.execute<RowDataPacket[]>('SELECT idsistema FROM cat_sistemas_vehiculo WHERE idsistema = ?', [datos.idsistema]);
    if (!s[0]) return 'El sistema no existe';
  }
  if (datos.idprod) {
    const [p] = await connection.execute<RowDataPacket[]>('SELECT idprod FROM productos WHERE idprod = ?', [datos.idprod]);
    if (!p[0]) return 'El producto de inventario no existe';
  }
  return null;
}

async function obtenerParte(connection: Connection, idparte: number) {
  const [rows] = await connection.execute<RowDataPacket[]>('SELECT * FROM vehiculo_partes WHERE idparte = ?', [idparte]);
  return rows[0];
}

// POST: { idvehiculo, ...campos } agrega una parte instalada
//       { accion: 'reemplazar', idparte, fecha?, km?, ...campos de la pieza nueva }
//       { accion: 'retirar', idparte, fecha?, km?, comentario? }
export async function POST(request: NextRequest) {
  const body = (await request.json()) as Record<string, unknown>;
  const connection = await connectDB();
  try {
    if (body.accion === 'reemplazar' || body.accion === 'retirar') {
      const vieja = await obtenerParte(connection, Number(body.idparte));
      if (!vieja) return NextResponse.json({ error: 'Parte no encontrada' }, { status: 404 });
      if (vieja.estado_instalacion !== 'INSTALADA') {
        return NextResponse.json({ error: 'La parte ya está retirada' }, { status: 400 });
      }
      const fecha = limpiar(body.fecha)?.slice(0, 10) || hoy();
      const km = Number(body.km) || null;

      if (body.accion === 'retirar') {
        await connection.execute(
          `UPDATE vehiculo_partes SET estado_instalacion = 'RETIRADA', fecha_retiro = ?, km_retiro = ?,
             comentario = COALESCE(?, comentario) WHERE idparte = ?`,
          [fecha, km, limpiar(body.comentario), vieja.idparte]
        );
        await avanzarOdometro(connection, vieja.idvehiculo, km);
        return NextResponse.json({ success: true, mensaje: `${vieja.nombre_parte} retirada` });
      }

      const datos = extraerCampos(body, CAMPOS_PARTE);
      const error = await validarReferencias(connection, datos);
      if (error) return NextResponse.json({ error }, { status: 400 });
      await connection.beginTransaction();
      await connection.execute(
        "UPDATE vehiculo_partes SET estado_instalacion = 'RETIRADA', fecha_retiro = ?, km_retiro = ? WHERE idparte = ?",
        [fecha, km, vieja.idparte]
      );
      const idparte = await insertarFila(connection, 'vehiculo_partes', {
        idvehiculo: vieja.idvehiculo,
        idsistema: datos.idsistema ?? vieja.idsistema,
        nombre_parte: datos.nombre_parte ?? vieja.nombre_parte,
        posicion: datos.posicion !== undefined ? datos.posicion : vieja.posicion,
        idprod: datos.idprod ?? null,
        marca: datos.marca ?? null,
        referencia: datos.referencia ?? null,
        numero_serie: datos.numero_serie ?? null,
        comentario: datos.comentario ?? null,
        estado_instalacion: 'INSTALADA',
        fecha_instalacion: fecha,
        km_instalacion: km,
        reemplaza_a: vieja.idparte,
      });
      // El reemplazo cuenta como el cambio hecho: los recordatorios de la pieza vieja pasan a la nueva.
      await connection.execute(
        `UPDATE recordatorios_mantenimiento SET idparte = ?, ultimo_fecha = ?, ultimo_km = COALESCE(?, ultimo_km)
         WHERE idparte = ?`,
        [idparte, fecha, km, vieja.idparte]
      );
      await avanzarOdometro(connection, vieja.idvehiculo, km);
      await connection.commit();
      return NextResponse.json({ success: true, idparte, mensaje: `${vieja.nombre_parte} reemplazada` });
    }

    const idvehiculo = Number(body.idvehiculo);
    const datos = extraerCampos(body, CAMPOS_PARTE);
    if (!idvehiculo || !datos.idsistema || !datos.nombre_parte) {
      return NextResponse.json({ error: 'Indique vehículo, sistema y nombre de la parte' }, { status: 400 });
    }
    const [v] = await connection.execute<RowDataPacket[]>('SELECT id FROM vehiculos WHERE id = ?', [idvehiculo]);
    if (!v[0]) return NextResponse.json({ error: 'El vehículo no existe' }, { status: 400 });
    const error = await validarReferencias(connection, datos);
    if (error) return NextResponse.json({ error }, { status: 400 });
    const idparte = await insertarFila(connection, 'vehiculo_partes', { ...datos, idvehiculo, estado_instalacion: 'INSTALADA' });
    await avanzarOdometro(connection, idvehiculo, Number(datos.km_instalacion) || null);
    return NextResponse.json({ success: true, idparte, mensaje: 'Parte agregada' });
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      /* sin transacción */
    }
    console.error('Error en partes del vehículo:', error);
    return NextResponse.json({ error: 'Error al guardar la parte', detalle: (error as Error).message }, { status: 500 });
  } finally {
    await connection.end();
  }
}

export async function PUT(request: NextRequest) {
  const body = (await request.json()) as Record<string, unknown>;
  const idparte = Number(body.idparte);
  if (!idparte) return NextResponse.json({ error: 'Falta idparte' }, { status: 400 });
  const datos = extraerCampos(body, CAMPOS_PARTE);
  if ('nombre_parte' in datos && !datos.nombre_parte) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
  if ('idsistema' in datos && !datos.idsistema) return NextResponse.json({ error: 'El sistema es obligatorio' }, { status: 400 });
  const connection = await connectDB();
  try {
    const error = await validarReferencias(connection, datos);
    if (error) return NextResponse.json({ error }, { status: 400 });
    await actualizarFila(connection, 'vehiculo_partes', 'idparte', idparte, datos);
    return NextResponse.json({ success: true, mensaje: 'Parte guardada' });
  } catch (error) {
    console.error('Error al actualizar parte:', error);
    return NextResponse.json({ error: 'Error al actualizar parte', detalle: (error as Error).message }, { status: 500 });
  } finally {
    await connection.end();
  }
}

// DELETE ?id=: solo para corregir errores de captura. Si era un reemplazo, la pieza vieja vuelve a quedar instalada.
export async function DELETE(request: NextRequest) {
  const idparte = Number(new URL(request.url).searchParams.get('id'));
  if (!idparte) return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
  const connection = await connectDB();
  try {
    const parte = await obtenerParte(connection, idparte);
    if (!parte) return NextResponse.json({ error: 'Parte no encontrada' }, { status: 404 });
    const [uso] = await connection.execute<RowDataPacket[]>(
      `SELECT (SELECT COUNT(*) FROM estado_partes WHERE idparte = ?) AS estados,
              (SELECT COUNT(*) FROM vehiculo_partes WHERE reemplaza_a = ?) AS reemplazos`,
      [idparte, idparte]
    );
    if (Number(uso[0].estados) > 0) {
      return NextResponse.json({ error: 'La parte tiene revisiones registradas; retírela en lugar de eliminarla' }, { status: 400 });
    }
    if (Number(uso[0].reemplazos) > 0) {
      return NextResponse.json({ error: 'Otra pieza reemplazó a esta; elimine primero la pieza nueva' }, { status: 400 });
    }
    await connection.beginTransaction();
    if (parte.reemplaza_a) {
      await connection.execute(
        "UPDATE vehiculo_partes SET estado_instalacion = 'INSTALADA', fecha_retiro = NULL, km_retiro = NULL WHERE idparte = ?",
        [parte.reemplaza_a]
      );
      await connection.execute('UPDATE recordatorios_mantenimiento SET idparte = ? WHERE idparte = ?', [parte.reemplaza_a, idparte]);
    }
    await connection.execute('DELETE FROM vehiculo_partes WHERE idparte = ?', [idparte]);
    await connection.commit();
    return NextResponse.json({ success: true, mensaje: 'Parte eliminada' });
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      /* sin transacción */
    }
    console.error('Error al eliminar parte:', error);
    return NextResponse.json({ error: 'Error al eliminar parte', detalle: (error as Error).message }, { status: 500 });
  } finally {
    await connection.end();
  }
}
