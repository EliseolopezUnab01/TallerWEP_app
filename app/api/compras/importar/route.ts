import { NextRequest, NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2/promise';
import { connectDB } from '@/lib/db';
import { CONDICIONES_IVA, type CondicionIva } from '@/lib/compras-detalle';
import { calcularFechaVencimiento } from '@/lib/compras-resumen';
import {
  aNumero,
  insertarLinea,
  limpiar,
  normalizarLinea,
  persistirTotales,
  siguienteNumeroLinea,
  type Conexion,
} from '@/lib/compras-detalle-db';
import { parsearDte, soloDigitos } from '@/lib/importar-dte';
import { destinoPermitido, nombreTipoDte, tipoDteRequiereRelacionados, esOrigenNota } from '@/lib/compras-constantes';
import { validarFormatoDte, validarReceptor } from '@/lib/dte-validacion';
import { leerEmpresa } from '@/lib/empresa';

interface FilaExcel {
  fila: number;
  cantidad: number;
  referencia: string;
  descripcion: string;
  precio: number;
}

interface ProductoRef {
  idprod: number;
  idprodprov: string;
  nombre: string;
  imagen: string | null;
}

/** Coincidencia exacta por referencia del proveedor (sin espacios al inicio o al final). */
async function buscarPorReferencia(connection: Conexion, referencias: string[]) {
  const unicas = [...new Set(referencias.map((r) => r.trim()).filter(Boolean))];
  const mapa = new Map<string, ProductoRef[]>();
  for (let i = 0; i < unicas.length; i += 200) {
    const lote = unicas.slice(i, i + 200);
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT p.idprod, p.idprodprov, p.nombre,
              (SELECT imagen_url FROM producto_imagenes
               WHERE idprod = p.idprod ORDER BY es_principal DESC, orden ASC LIMIT 1) AS imagen
       FROM productos p WHERE p.idprodprov IN (?)`,
      [lote]
    );
    for (const r of rows as ProductoRef[]) {
      const clave = String(r.idprodprov).trim();
      if (!lote.includes(clave)) continue;
      mapa.set(clave, [...(mapa.get(clave) || []), r]);
    }
  }
  return mapa;
}

async function leerCompra(connection: Conexion, idcompra: number) {
  const [rows] = await connection.execute<RowDataPacket[]>(
    'SELECT idcompra, estado, nodocto, clase_documento, categoria_operacion, tipo_dte, notas FROM compras WHERE idcompra = ?',
    [idcompra]
  );
  return rows[0];
}

async function importarExcel(connection: Conexion, idcompra: number, body: Record<string, unknown>) {
  const filas = (Array.isArray(body.lineas) ? body.lineas : []) as FilaExcel[];
  if (filas.length === 0) return { status: 400, data: { error: 'El archivo no trae líneas' } };

  const condicion = CONDICIONES_IVA.includes(String(body.condicion_iva) as CondicionIva)
    ? String(body.condicion_iva)
    : 'GRAVADA';

  const productos = await buscarPorReferencia(connection, filas.map((f) => String(f.referencia ?? '')));
  const noEncontradas: (FilaExcel & { motivo: string })[] = [];
  let numero = await siguienteNumeroLinea(connection, idcompra);
  let insertadas = 0;
  let totalEnviado = 0;

  await connection.beginTransaction();
  for (const f of filas) {
    const referencia = String(f.referencia ?? '').trim();
    const cantidad = aNumero(f.cantidad);
    const precio = aNumero(f.precio);
    const candidatos = productos.get(referencia) || [];
    if (!referencia || candidatos.length !== 1 || cantidad <= 0) {
      noEncontradas.push({
        ...f,
        motivo: !referencia
          ? 'Sin referencia'
          : cantidad <= 0
            ? 'Cantidad inválida'
            : candidatos.length > 1
              ? `Referencia repetida en ${candidatos.length} productos`
              : 'Referencia no encontrada',
      });
      continue;
    }
    const p = candidatos[0];
    const linea = normalizarLinea({
      idcompra,
      numero_linea: numero++,
      destino: 'INVENTARIO',
      idprod: p.idprod,
      referencia_proveedor: referencia,
      descripcion: p.nombre || f.descripcion,
      cantidad,
      costo_unitario: precio,
      condicion_iva: condicion,
      imagen_url: p.imagen,
    });
    await insertarLinea(connection, linea);
    insertadas++;
    totalEnviado += cantidad * precio;
  }
  const resumen = await persistirTotales(connection, idcompra);
  await connection.commit();

  return {
    status: 200,
    data: {
      success: true,
      insertadas,
      total_enviado: Math.round(totalEnviado * 100) / 100,
      no_encontradas: noEncontradas,
      resumen,
    },
  };
}

async function importarJson(
  connection: Conexion,
  compra: RowDataPacket,
  body: Record<string, unknown>,
  textoJson: string
) {
  const idcompra = Number(compra.idcompra);
  if (compra.clase_documento === 'IMPORTACION') {
    return { status: 400, data: { error: 'Una factura de importación no es un DTE; cambie el documento antes de importar el JSON' } };
  }

  let dte;
  try {
    dte = parsearDte(body.dte);
  } catch (e) {
    return { status: 400, data: { error: (e as Error).message } };
  }
  if (!compra.tipo_dte) {
    return { status: 400, data: { error: 'Elija y guarde el tipo de documento antes de importar el JSON' } };
  }
  if (dte.tipo_dte !== compra.tipo_dte) {
    return {
      status: 400,
      data: {
        error: `El JSON es ${nombreTipoDte(dte.tipo_dte)} y el documento elegido es ${nombreTipoDte(compra.tipo_dte)}; cambie el tipo antes de importar`,
      },
    };
  }
  const inventarioPermitido = destinoPermitido(compra.categoria_operacion, 'INVENTARIO');

  const [existentes] = await connection.execute<RowDataPacket[]>(
    'SELECT COUNT(*) AS total FROM compras_detalle WHERE idcompra = ?',
    [idcompra]
  );
  if (Number(existentes[0].total) > 0 && !body.reemplazar) {
    return {
      status: 409,
      data: { error: 'La compra ya tiene líneas', requiere_confirmacion: true, lineas: Number(existentes[0].total) },
    };
  }

  if (dte.codigo_generacion) {
    const [duplicada] = await connection.execute<RowDataPacket[]>(
      `SELECT idcompra, numero_interno FROM compras
       WHERE codigo_generacion = ? AND idcompra <> ? AND estado NOT IN ('ANULADA', 'INVALIDADO') LIMIT 1`,
      [dte.codigo_generacion, idcompra]
    );
    if (duplicada.length > 0) {
      return {
        status: 409,
        data: { error: `Este DTE ya está ingresado en ${duplicada[0].numero_interno || `la compra #${duplicada[0].idcompra}`}` },
      };
    }
  }

  const formato = validarFormatoDte(dte);
  const receptor =
    dte.tipo_dte === '14'
      ? { errores: [], avisos: [] }
      : validarReceptor(await leerEmpresa(connection).catch(() => null), dte.receptor);
  const errores = [...formato.errores, ...receptor.errores];
  if (errores.length > 0) {
    return { status: 400, data: { error: errores.join('. ') } };
  }
  const avisos = [...formato.avisos, ...receptor.avisos];
  if (dte.ambiente === '00') avisos.push('El DTE es del ambiente de pruebas de Hacienda, no tiene validez fiscal');
  if (dte.tipo_operacion === 2) avisos.push('El DTE se emitió en contingencia');

  const nit = soloDigitos(dte.emisor.nit) || '-';
  const nrc = soloDigitos(dte.emisor.nrc) || '-';
  const [provs] = await connection.execute<RowDataPacket[]>(
    `SELECT idproveedor, codigo, nombre_legal, nit, nrc FROM proveedores
     WHERE REPLACE(REPLACE(COALESCE(nit, ''), '-', ''), ' ', '') = ?
        OR REPLACE(REPLACE(COALESCE(nrc, ''), '-', ''), ' ', '') = ?
     ORDER BY activo DESC LIMIT 1`,
    [nit, nrc]
  );
  const proveedor = provs[0] || null;

  if (proveedor && dte.numero_control) {
    const [mismoControl] = await connection.execute<RowDataPacket[]>(
      `SELECT idcompra, numero_interno FROM compras
       WHERE numero_control = ? AND idproveedor = ? AND idcompra <> ? AND estado NOT IN ('ANULADA', 'INVALIDADO') LIMIT 1`,
      [dte.numero_control, proveedor.idproveedor, idcompra]
    );
    if (mismoControl.length > 0) {
      avisos.push(
        `El proveedor ya tiene el número de control ${dte.numero_control} en ${mismoControl[0].numero_interno || `la compra #${mismoControl[0].idcompra}`}`
      );
    }
  }

  const productos = await buscarPorReferencia(
    connection,
    dte.lineas.map((l) => l.codigo || '')
  );

  await connection.beginTransaction();
  if (body.reemplazar) {
    await connection.execute('DELETE FROM compras_detalle WHERE idcompra = ?', [idcompra]);
    await connection.execute('DELETE FROM compras_pagos WHERE idcompra = ?', [idcompra]);
    await connection.execute('DELETE FROM compras_documentos_rel WHERE idcompra = ?', [idcompra]);
  }
  await connection.execute('DELETE FROM compras_tributos WHERE idcompra = ?', [idcompra]);
  const totalOtrosTributos = dte.otros_tributos.reduce((s, t) => s + t.valor, 0);

  const esCredito = dte.condicion_operacion === 2;
  const plazo = dte.pagos.find((p) => p.plazo && p.periodo);
  const encabezado: Record<string, unknown> = {
    clase_documento: 'DTE',
    numero_control: dte.numero_control,
    codigo_generacion: dte.codigo_generacion,
    sello_recepcion: dte.sello_recepcion,
    fecha_emision: dte.fecha_emision,
    condicion_operacion: dte.condicion_operacion,
    plazo_tipo: esCredito ? plazo?.plazo || '01' : null,
    plazo_periodo: esCredito ? plazo?.periodo || null : null,
    fecha_vencimiento_pago: esCredito
      ? calcularFechaVencimiento(dte.fecha_emision, plazo?.plazo || '01', plazo?.periodo || null)
      : null,
    iva_retenido: dte.iva_retenido,
    iva_percibido: dte.iva_percibido,
    retencion_renta: dte.retencion_renta,
    descuento_global_gravado: dte.descuento_global_gravado,
    descuento_global_exento: dte.descuento_global_exento,
    descuento_global_no_sujeto: dte.descuento_global_no_sujeto,
    porcentaje_descuento: dte.porcentaje_descuento,
    total_otros_tributos: totalOtrosTributos,
    dte_ambiente: dte.ambiente,
    dte_version: dte.version,
    dte_tipo_modelo: dte.tipo_modelo,
    dte_tipo_operacion: dte.tipo_operacion,
    dte_tipo_contingencia: dte.tipo_contingencia,
    dte_motivo_contingencia: dte.motivo_contingencia?.slice(0, 500) ?? null,
    emisor_cod_actividad: dte.emisor.cod_actividad,
    emisor_desc_actividad: dte.emisor.desc_actividad?.slice(0, 150) ?? null,
    emisor_departamento: dte.emisor.departamento,
    emisor_municipio: dte.emisor.municipio,
  };
  if (proveedor) encabezado.idproveedor = proveedor.idproveedor;
  if (dte.observaciones && !limpiar(compra.notas)) encabezado.notas = dte.observaciones.slice(0, 500);
  const campos = Object.keys(encabezado);
  await connection.execute(
    `UPDATE compras SET ${campos.map((c) => `${c} = ?`).join(', ')} WHERE idcompra = ?`,
    [...campos.map((c) => encabezado[c] ?? null), idcompra]
  );

  // Con ficha y categoría que admite inventario: INVENTARIO. Lo demás entra sin destino hasta que el usuario lo clasifique.
  let numero = await siguienteNumeroLinea(connection, idcompra);
  let conProducto = 0;
  let sinClasificar = 0;
  for (const l of dte.lineas) {
    const candidatos = l.codigo ? productos.get(l.codigo.trim()) || [] : [];
    const p = candidatos.length === 1 && inventarioPermitido ? candidatos[0] : null;
    if (p) conProducto++;
    else sinClasificar++;
    await insertarLinea(
      connection,
      normalizarLinea({
        idcompra,
        numero_linea: numero++,
        destino: p ? 'INVENTARIO' : null,
        idprod: p?.idprod ?? null,
        referencia_proveedor: l.codigo,
        descripcion: l.descripcion,
        cantidad: l.cantidad,
        uni_medida: l.uni_medida,
        tipo_item: l.tipo_item,
        costo_unitario: l.costo_unitario,
        condicion_iva: l.condicion_iva,
        imagen_url: p?.imagen ?? null,
      })
    );
  }

  for (const t of dte.otros_tributos) {
    await connection.execute(
      'INSERT INTO compras_tributos (idcompra, codigo, descripcion, valor) VALUES (?, ?, ?, ?)',
      [idcompra, t.codigo.slice(0, 4), t.descripcion?.slice(0, 150) ?? null, t.valor]
    );
  }

  const [formas] = await connection.query<RowDataPacket[]>('SELECT codigo FROM cat_formas_pago');
  const formasValidas = new Set(formas.map((f) => String(f.codigo)));
  for (const p of dte.pagos) {
    await connection.execute(
      `INSERT INTO compras_pagos (idcompra, codigo_forma_pago, monto, referencia, plazo_tipo, plazo_periodo)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [idcompra, formasValidas.has(p.codigo) ? p.codigo : '99', p.monto, p.referencia, p.plazo, p.periodo]
    );
  }

  for (const d of dte.documentos_rel) {
    if (!d.numero || !d.fecha) continue;
    if (tipoDteRequiereRelacionados(dte.tipo_dte) && !esOrigenNota(d.tipo)) {
      avisos.push(`El documento relacionado ${d.numero} es tipo ${d.tipo}; una nota solo puede relacionar un CCF (03) o un comprobante de retención (07)`);
    }
    await connection.execute(
      `INSERT INTO compras_documentos_rel (idcompra, tipo_dte_relacionado, tipo_generacion, numero_documento, fecha_generacion)
       VALUES (?, ?, ?, ?, ?)`,
      [idcompra, d.tipo, d.generacion, d.numero, d.fecha]
    );
  }

  if (compra.nodocto) {
    await connection.execute(
      `INSERT INTO esquemas_dte (nodocto, codigo_generacion, tipo_dte, tipo_movimiento, version, esquema_json)
       VALUES (?, ?, ?, 'COMPRA', ?, ?)
       ON DUPLICATE KEY UPDATE codigo_generacion = VALUES(codigo_generacion), tipo_dte = VALUES(tipo_dte),
         version = VALUES(version), esquema_json = VALUES(esquema_json)`,
      [compra.nodocto, dte.codigo_generacion, dte.tipo_dte, dte.version, textoJson]
    );
  }

  const resumen = await persistirTotales(connection, idcompra);
  await connection.commit();

  return {
    status: 200,
    data: {
      success: true,
      lineas_insertadas: dte.lineas.length,
      lineas_con_producto: conProducto,
      lineas_sin_clasificar: sinClasificar,
      condicion_en_json: dte.condicion_operacion !== null,
      proveedor: proveedor
        ? { encontrado: true, idproveedor: proveedor.idproveedor, nombre: proveedor.nombre_legal, codigo: proveedor.codigo }
        : { encontrado: false, nombre: dte.emisor.nombre, nit: dte.emisor.nit, nrc: dte.emisor.nrc },
      receptor: dte.receptor,
      apendice: dte.apendice,
      total_json: dte.total_pagar,
      total_no_gravado_json: dte.total_no_gravado,
      total_compra: resumen.total_pagar,
      otros_tributos: dte.otros_tributos,
      observaciones: dte.observaciones,
      avisos,
    },
  };
}

// POST - Importa líneas a una compra en borrador: { idcompra, tipo: 'excel' | 'json', ... }
export async function POST(request: NextRequest) {
  let connection: Conexion | undefined;
  try {
    const textoCuerpo = await request.text();
    const body = JSON.parse(textoCuerpo) as Record<string, unknown>;
    const idcompra = Number(body.idcompra);
    if (!idcompra) return NextResponse.json({ error: 'Falta idcompra' }, { status: 400 });

    connection = await connectDB();
    const compra = await leerCompra(connection, idcompra);
    if (!compra) {
      await connection.end();
      return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 });
    }
    if (compra.estado !== 'BORRADOR') {
      await connection.end();
      return NextResponse.json({ error: 'Solo se importa en compras en estado BORRADOR' }, { status: 400 });
    }

    let resultado;
    if (body.tipo === 'excel') {
      if (!destinoPermitido(compra.categoria_operacion, 'INVENTARIO')) {
        await connection.end();
        return NextResponse.json(
          { error: 'Esta categoría no admite productos de inventario; el Excel solo carga inventario' },
          { status: 400 }
        );
      }
      resultado = await importarExcel(connection, idcompra, body);
    } else if (body.tipo === 'json') {
      resultado = await importarJson(connection, compra, body, JSON.stringify(body.dte));
    } else {
      await connection.end();
      return NextResponse.json({ error: 'Tipo de importación no válido' }, { status: 400 });
    }

    await connection.end();
    return NextResponse.json(resultado.data, { status: resultado.status });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {
        /* sin transacción abierta */
      }
      await connection.end();
    }
    console.error('Error al importar en compra:', error);
    return NextResponse.json(
      { error: 'Error al importar', detalle: (error as Error).message },
      { status: 500 }
    );
  } finally {
    if (connection) await connection.end();
  }
}
