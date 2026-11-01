import { NextRequest, NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2/promise';
import { connectDB } from '@/lib/db';
import { esOrigenNota, tipoDteRequiereRelacionados } from '@/lib/compras-constantes';
import {
  aNumero,
  insertarLinea,
  normalizarLinea,
  persistirTotales,
  siguienteNumeroLinea,
  type Conexion,
} from '@/lib/compras-detalle-db';
import { lineasOrigen, topeDevolucion } from '@/lib/compras-nota';

const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

async function leerNota(connection: Conexion, idcompra: number) {
  const [rows] = await connection.execute<RowDataPacket[]>(
    'SELECT idcompra, estado, tipo_dte, clase_documento, idproveedor, idcompra_origen FROM compras WHERE idcompra = ?',
    [idcompra]
  );
  return rows[0];
}

// GET ?idcompra=NC → factura origen y sus líneas con lo disponible; &facturas=1 → facturas registradas del proveedor
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const idcompra = Number(searchParams.get('idcompra')) || 0;
  if (!idcompra) return json({ error: 'Falta idcompra' }, 400);
  const connection = await connectDB();
  try {
    const nota = await leerNota(connection, idcompra);
    if (!nota) return json({ error: 'Compra no encontrada' }, 404);

    if (searchParams.get('facturas')) {
      if (!nota.idproveedor) return json({ success: true, facturas: [] });
      const q = searchParams.get('q')?.trim();
      const [facturas] = await connection.execute<RowDataPacket[]>(
        `SELECT idcompra, numero_interno, numero_factura, codigo_generacion, tipo_dte, fecha_emision, total_pagar
         FROM compras
         WHERE idproveedor = ? AND estado = 'REGISTRADA' AND clase_documento = 'DTE'
           AND tipo_dte IN ('03','07') AND idcompra <> ?
           ${q ? 'AND (numero_factura LIKE ? OR numero_interno LIKE ? OR codigo_generacion LIKE ?)' : ''}
         ORDER BY fecha_emision DESC, idcompra DESC LIMIT 50`,
        q ? [nota.idproveedor, idcompra, `%${q}%`, `%${q}%`, `%${q}%`] : [nota.idproveedor, idcompra]
      );
      return json({ success: true, facturas });
    }

    if (!nota.idcompra_origen) return json({ success: true, origen: null, lineas: [] });
    const [origen] = await connection.execute<RowDataPacket[]>(
      `SELECT idcompra, numero_interno, numero_factura, codigo_generacion, tipo_dte, fecha_emision, total_pagar, categoria_operacion
       FROM compras WHERE idcompra = ?`,
      [nota.idcompra_origen]
    );
    const lineas = await lineasOrigen(connection, idcompra, Number(nota.idcompra_origen));
    return json({ success: true, origen: origen[0] ?? null, lineas });
  } catch (error) {
    console.error('Error en nota de crédito:', error);
    return json({ error: 'Error al leer la nota', detalle: (error as Error).message }, 500);
  } finally {
    await connection.end();
  }
}

// POST { idcompra, accion: 'origen', idcompra_origen } | { idcompra, accion: 'cargar', lineas: [...] }
export async function POST(request: NextRequest) {
  const body = (await request.json()) as Record<string, unknown>;
  const idcompra = Number(body.idcompra) || 0;
  const connection = await connectDB();
  try {
    const nota = await leerNota(connection, idcompra);
    if (!nota) return json({ error: 'Compra no encontrada' }, 404);
    if (nota.estado !== 'BORRADOR') return json({ error: 'La nota ya no está en borrador' }, 400);
    if (!tipoDteRequiereRelacionados(nota.tipo_dte)) return json({ error: 'Solo aplica a nota de crédito o de débito' }, 400);

    if (body.accion === 'origen') {
      const idorigen = Number(body.idcompra_origen) || 0;
      const [rows] = await connection.execute<RowDataPacket[]>(
        `SELECT idcompra, estado, tipo_dte, clase_documento, idproveedor, categoria_operacion, numero_factura,
                numero_interno, codigo_generacion, fecha_emision
         FROM compras WHERE idcompra = ?`,
        [idorigen]
      );
      const origen = rows[0];
      if (!origen) return json({ error: 'Factura original no encontrada' }, 404);
      if (origen.estado !== 'REGISTRADA') return json({ error: 'La factura original debe estar registrada' }, 400);
      if (origen.clase_documento !== 'DTE' || !esOrigenNota(origen.tipo_dte)) {
        return json(
          { error: 'Una nota solo se emite sobre un comprobante de crédito fiscal (03) o de retención (07)' },
          400
        );
      }
      if (nota.idproveedor && Number(nota.idproveedor) !== Number(origen.idproveedor)) {
        return json({ error: 'La factura original es de otro proveedor' }, 400);
      }
      const [cargadas] = await connection.execute<RowDataPacket[]>(
        `SELECT COUNT(*) AS total FROM compras_detalle n JOIN compras_detalle d ON d.iddetalle = n.iddetalle_origen
         WHERE n.idcompra = ? AND d.idcompra <> ?`,
        [idcompra, idorigen]
      );
      if (Number(cargadas[0].total) > 0) {
        return json({ error: 'Quite primero las líneas cargadas de la otra factura' }, 400);
      }

      await connection.beginTransaction();
      await connection.execute(
        'UPDATE compras SET idcompra_origen = ?, idproveedor = ?, categoria_operacion = ? WHERE idcompra = ?',
        [idorigen, origen.idproveedor, origen.categoria_operacion, idcompra]
      );
      const numero = String(origen.codigo_generacion || origen.numero_factura || origen.numero_interno || origen.idcompra);
      const [rel] = await connection.execute<RowDataPacket[]>(
        'SELECT idrelacion FROM compras_documentos_rel WHERE idcompra = ? AND numero_documento = ?',
        [idcompra, numero]
      );
      if (!rel[0] && origen.fecha_emision) {
        await connection.execute(
          `INSERT INTO compras_documentos_rel (idcompra, tipo_dte_relacionado, tipo_generacion, numero_documento, fecha_generacion)
           VALUES (?, ?, ?, ?, ?)`,
          [idcompra, origen.tipo_dte, origen.codigo_generacion ? 2 : 1, numero, origen.fecha_emision]
        );
      }
      await connection.commit();
      return json({ success: true, mensaje: `Factura original ${origen.numero_factura || origen.numero_interno} asignada` });
    }

    if (body.accion === 'cargar') {
      if (!nota.idcompra_origen) return json({ error: 'Elija primero la factura original' }, 400);
      const pedidas = Array.isArray(body.lineas) ? (body.lineas as Record<string, unknown>[]) : [];
      if (!pedidas.length) return json({ error: 'Indique al menos una línea' }, 400);
      const esDebito = nota.tipo_dte === '06';
      const origen = await lineasOrigen(connection, idcompra, Number(nota.idcompra_origen));

      await connection.beginTransaction();
      let agregadas = 0;
      for (const p of pedidas) {
        const o = origen.find((x) => x.iddetalle === Number(p.iddetalle_origen));
        if (!o) throw new Error('Una de las líneas no pertenece a la factura original');
        const cantidad = aNumero(p.cantidad);
        const ajuste = esDebito || Boolean(p.ajuste_precio);
        if (!(cantidad > 0)) continue;
        if (ajuste) {
          if (cantidad > o.comprado + 1e-8) throw new Error(`Línea ${o.numero_linea}: la cantidad pasa de lo comprado (${o.comprado})`);
          if (!(aNumero(p.costo_unitario) > 0)) throw new Error(`Línea ${o.numero_linea}: indique el monto unitario del ajuste`);
        } else {
          const tope = await topeDevolucion(connection, idcompra, o.iddetalle);
          if (tope && cantidad > tope.maximo + 1e-8) {
            throw new Error(`Línea ${o.numero_linea}: solo quedan ${tope.maximo} por devolver`);
          }
        }
        const linea = normalizarLinea({
          idcompra,
          destino: o.destino,
          idprod: o.idprod,
          idcatalogo: o.idcatalogo,
          descripcion: ajuste ? `${esDebito ? 'Ajuste' : 'Rebaja'} de precio: ${o.descripcion}` : o.descripcion,
          referencia_proveedor: o.referencia_proveedor,
          numero_orden: o.numero_orden,
          codigo_express: o.codigo_express,
          condicion_iva: o.condicion_iva,
          cantidad,
          costo_unitario: ajuste ? aNumero(p.costo_unitario) : aNumero(p.costo_unitario, o.costo_unitario) || o.costo_unitario,
          descuento_porcentaje: ajuste ? 0 : o.descuento_porcentaje,
          iddetalle_origen: o.iddetalle,
          ajuste_precio: ajuste ? 1 : 0,
        });
        linea.numero_linea = await siguienteNumeroLinea(connection, idcompra);
        await insertarLinea(connection, linea);
        agregadas++;
      }
      await persistirTotales(connection, idcompra);
      await connection.commit();
      return json({ success: true, mensaje: `${agregadas} línea(s) cargada(s) de la factura original` });
    }

    return json({ error: 'Acción no válida' }, 400);
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      /* sin transacción */
    }
    console.error('Error en nota de crédito:', error);
    return json({ error: (error as Error).message || 'Error en la nota' }, 500);
  } finally {
    await connection.end();
  }
}
