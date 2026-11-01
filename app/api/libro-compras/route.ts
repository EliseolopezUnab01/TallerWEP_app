import { NextRequest, NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2/promise';
import { connectDB } from '@/lib/db';
import { IVA_TASA } from '@/lib/compras-detalle';
import { r8 } from '@/lib/decimales';

/**
 * Libro de Compras (Art. 141 del Código Tributario) por fecha de emisión.
 * Lleva los documentos que dan o ajustan crédito fiscal: CCF (03), notas (05 resta, 06 suma),
 * sujeto excluido (14, sin crédito) y la DUCA de cada proceso de importación (IVA pagado en aduana).
 * Solo compras REGISTRADAS: las anuladas o invalidadas por el emisor no entran.
 */
export interface FilaLibro {
  correlativo: number;
  fecha: string;
  clase: string;
  tipo: string;
  numero: string;
  nrc: string | null;
  nit: string | null;
  proveedor: string;
  exentas_internas: number;
  importaciones_exentas: number;
  gravadas_internas: number;
  importaciones_gravadas: number;
  credito_fiscal: number;
  otros_tributos: number;
  total: number;
  iva_percibido: number;
  iva_retenido: number;
  renta_retenida: number;
  referencia: string | null;
  idcompra: number | null;
}

const esFecha = (v: string | null) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const desde = searchParams.get('desde');
  const hasta = searchParams.get('hasta');
  if (!esFecha(desde) || !esFecha(hasta)) {
    return NextResponse.json({ error: 'Indique desde y hasta (AAAA-MM-DD)' }, { status: 400 });
  }

  let connection: Awaited<ReturnType<typeof connectDB>> | undefined;
  try {
    connection = await connectDB();
    const [compras] = await connection.execute<RowDataPacket[]>(
      `SELECT c.idcompra, DATE_FORMAT(c.fecha_emision, '%Y-%m-%d') AS fecha, c.tipo_dte, c.numero_control,
              c.codigo_generacion, c.numero_factura, c.numero_interno,
              p.nombre_legal, p.nit, p.nrc,
              c.total_gravado - c.descuento_global_gravado AS gravado,
              (c.total_exento - c.descuento_global_exento) + (c.total_no_sujeto - c.descuento_global_no_sujeto) AS exento,
              c.iva, c.total_otros_tributos, c.iva_percibido, c.iva_retenido, c.retencion_renta
       FROM compras c
       LEFT JOIN proveedores p ON p.idproveedor = c.idproveedor
       WHERE c.estado = 'REGISTRADA' AND c.clase_documento = 'DTE' AND c.tipo_dte IN ('03', '05', '06', '14')
         AND c.fecha_emision BETWEEN ? AND ?
       ORDER BY c.fecha_emision, c.idcompra`,
      [desde, hasta]
    );
    const [ducas] = await connection.execute<RowDataPacket[]>(
      `SELECT d.idproceso, DATE_FORMAT(d.fecha_duca, '%Y-%m-%d') AS fecha, d.numero_duca, d.iva_pagado, pi.codigo,
              (SELECT pr.nombre_legal FROM compras c JOIN proveedores pr ON pr.idproveedor = c.idproveedor
               WHERE c.idproceso = d.idproceso AND c.clase_documento = 'IMPORTACION'
                 AND c.estado = 'REGISTRADA' ORDER BY c.idcompra LIMIT 1) AS proveedor
       FROM datos_duca d
       JOIN proceso_ingreso pi ON pi.idproceso = d.idproceso
       WHERE d.fecha_duca BETWEEN ? AND ? AND d.iva_pagado > 0
       ORDER BY d.fecha_duca, d.idproceso`,
      [desde, hasta]
    );

    const filas: Omit<FilaLibro, 'correlativo'>[] = [];
    for (const c of compras) {
      const signo = c.tipo_dte === '05' ? -1 : 1;
      const sujetoExcluido = c.tipo_dte === '14';
      const gravado = sujetoExcluido ? 0 : r8(signo * Number(c.gravado));
      const exento = r8(signo * Number(c.exento));
      const credito = sujetoExcluido ? 0 : r8(signo * Number(c.iva));
      const otros = r8(signo * Number(c.total_otros_tributos || 0));
      filas.push({
        fecha: c.fecha,
        clase: 'DTE',
        tipo: c.tipo_dte,
        numero: c.codigo_generacion || c.numero_control || c.numero_factura || c.numero_interno || '',
        nrc: c.nrc,
        nit: c.nit,
        proveedor: c.nombre_legal || '',
        exentas_internas: exento,
        importaciones_exentas: 0,
        gravadas_internas: gravado,
        importaciones_gravadas: 0,
        credito_fiscal: credito,
        otros_tributos: otros,
        total: r8(gravado + exento + credito + otros),
        iva_percibido: r8(signo * Number(c.iva_percibido)),
        iva_retenido: r8(signo * Number(c.iva_retenido)),
        renta_retenida: r8(signo * Number(c.retencion_renta)),
        referencia: c.numero_interno,
        idcompra: Number(c.idcompra),
      });
    }
    for (const d of ducas) {
      const iva = r8(Number(d.iva_pagado));
      const base = r8(iva / IVA_TASA);
      filas.push({
        fecha: d.fecha,
        clase: 'DUCA',
        tipo: '12',
        numero: d.numero_duca || d.codigo,
        nrc: null,
        nit: null,
        proveedor: d.proveedor || `Importación ${d.codigo}`,
        exentas_internas: 0,
        importaciones_exentas: 0,
        gravadas_internas: 0,
        importaciones_gravadas: base,
        credito_fiscal: iva,
        otros_tributos: 0,
        total: r8(base + iva),
        iva_percibido: 0,
        iva_retenido: 0,
        renta_retenida: 0,
        referencia: d.codigo,
        idcompra: null,
      });
    }
    filas.sort((a, b) => a.fecha.localeCompare(b.fecha));
    const numeradas: FilaLibro[] = filas.map((f, i) => ({ correlativo: i + 1, ...f }));

    const sumar = (campo: keyof FilaLibro) => r8(numeradas.reduce((s, f) => s + Number(f[campo] || 0), 0));
    const totales = {
      exentas_internas: sumar('exentas_internas'),
      importaciones_exentas: sumar('importaciones_exentas'),
      gravadas_internas: sumar('gravadas_internas'),
      importaciones_gravadas: sumar('importaciones_gravadas'),
      credito_fiscal: sumar('credito_fiscal'),
      otros_tributos: sumar('otros_tributos'),
      total: sumar('total'),
      iva_percibido: sumar('iva_percibido'),
      iva_retenido: sumar('iva_retenido'),
      renta_retenida: sumar('renta_retenida'),
    };
    return NextResponse.json({ success: true, desde, hasta, filas: numeradas, totales });
  } catch (error) {
    console.error('Error al generar el libro de compras:', error);
    return NextResponse.json(
      { error: 'Error al generar el libro de compras', detalle: (error as Error).message },
      { status: 500 }
    );
  } finally {
    if (connection) await connection.end();
  }
}
