import { NextRequest, NextResponse } from 'next/server';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { connectDB } from '@/lib/db';
import { siguienteCorrelativo } from '@/lib/correlativos';
import { aNumero, limpiar } from '@/lib/compras-detalle-db';
import { requierePermiso, usuarioDeRequest } from '@/lib/sesion';

export async function GET() {
  const connection = await connectDB();
  try {
    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT a.idajuste, a.numero, a.fecha, a.motivo, a.created_at,
              (SELECT COUNT(*) FROM ajustes_inventario_detalle d WHERE d.idajuste = a.idajuste) AS lineas
       FROM ajustes_inventario a ORDER BY a.idajuste DESC LIMIT 40`
    );
    return NextResponse.json({ success: true, ajustes: rows });
  } catch (error) {
    console.error('Error al listar ajustes:', error);
    return NextResponse.json({ error: 'Error al listar ajustes' }, { status: 500 });
  } finally {
    await connection.end();
  }
}

export async function POST(request: NextRequest) {
  const auth = await requierePermiso(request, 'inventario.editar');
  if (auth instanceof NextResponse) return auth;
  const body = await request.json().catch(() => ({}));
  const motivo = limpiar(body.motivo);
  const lineas = Array.isArray(body.lineas) ? body.lineas : [];
  if (!motivo) return NextResponse.json({ error: 'Escriba el motivo del ajuste' }, { status: 400 });
  if (lineas.length === 0 || lineas.length > 100) {
    return NextResponse.json({ error: 'Agregue entre 1 y 100 productos' }, { status: 400 });
  }

  const connection = await connectDB();
  try {
    await connection.beginTransaction();
    const idusuario = await usuarioDeRequest(request);
    const { codigo } = await siguienteCorrelativo(connection, 'AJ');
    const fecha = limpiar(body.fecha) || new Date().toISOString().slice(0, 10);
    const [res] = await connection.execute<ResultSetHeader>(
      'INSERT INTO ajustes_inventario (numero, fecha, motivo, idusuario) VALUES (?, ?, ?, ?)',
      [codigo, fecha, motivo.slice(0, 200), idusuario]
    );
    const idajuste = res.insertId;
    for (const l of lineas as Record<string, unknown>[]) {
      const idprod = Number(l.idprod);
      const contable = aNumero(l.cantidad_contable);
      const fisico = aNumero(l.cantidad_fisico);
      if (!Number.isInteger(idprod) || idprod <= 0) throw new Error('Producto no válido');
      if (contable === 0 && fisico === 0) throw new Error(`El producto ${idprod} no tiene cantidad`);
      const [prod] = await connection.execute<RowDataPacket[]>(
        'SELECT stock_contable, stock_fisico, nombre FROM productos WHERE idprod = ? FOR UPDATE',
        [idprod]
      );
      if (!prod[0]) throw new Error(`No existe el producto ${idprod}`);
      const antesC = Number(prod[0].stock_contable) || 0;
      const antesF = Number(prod[0].stock_fisico) || 0;
      if (antesC + contable < -0.00005 || antesF + fisico < -0.00005) {
        throw new Error(`${prod[0].nombre}: el ajuste dejaría el stock en negativo`);
      }
      await connection.execute(
        'UPDATE productos SET stock_contable = stock_contable + ?, stock_fisico = stock_fisico + ? WHERE idprod = ?',
        [contable, fisico, idprod]
      );
      await connection.execute(
        `INSERT INTO ajustes_inventario_detalle
           (idajuste, idprod, cantidad_contable, cantidad_fisico, stock_contable_antes, stock_fisico_antes)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [idajuste, idprod, contable, fisico, antesC, antesF]
      );
    }
    await connection.commit();
    return NextResponse.json({ success: true, idajuste, numero: codigo });
  } catch (error) {
    await connection.rollback().catch(() => {});
    const mensaje = (error as Error).message || 'Error al guardar el ajuste';
    console.error('Error al guardar ajuste:', error);
    return NextResponse.json({ error: mensaje }, { status: 400 });
  } finally {
    await connection.end();
  }
}
