import { NextRequest, NextResponse } from 'next/server';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { connectDB } from '@/lib/db';
import { fechaLocalISO, horaLocal } from '@/lib/fechas';
import { leerEmpresa, soloDigitos } from '@/lib/empresa';
import { usuarioDeRequest } from '@/lib/sesion';
import { nuevoNodocto, siguienteCorrelativo } from '@/lib/correlativos';
import { insertarLinea, normalizarLinea, persistirTotales, type Conexion } from '@/lib/compras-detalle-db';
import { aplicarStockAlRegistrar, revertirStockAlAnular } from '@/lib/compras-stock';
import {
  armarFse,
  compraDeLinea,
  emitirFse,
  faltantesEmpresa,
  invalidarFse,
  nuevoCodigoGeneracion,
  numeroControlFse,
  sugerirRenta,
  urlConsulta,
  type LineaFse,
} from '@/lib/dte-emision';

const TIPOS_DOC = ['13', '36', '02', '03', '37'];
const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

function texto(valor: unknown, largo: number): string | null {
  const t = String(valor ?? '').trim();
  return t ? t.slice(0, largo) : null;
}

function lineasDe(body: Record<string, unknown>): LineaGuardada[] {
  const crudas = Array.isArray(body.lineas) ? body.lineas : [];
  return crudas.map((item, i) => {
    const l = item as Record<string, unknown>;
    const cantidad = Number(l.cantidad) || 0;
    const precio = Number(l.precio_uni) || 0;
    const descuento = Math.max(0, Number(l.monto_descu) || 0);
    const tipo = [1, 2, 3].includes(Number(l.tipo_item)) ? Number(l.tipo_item) : 1;
    return {
      num_item: i + 1,
      tipo_item: tipo,
      codigo: texto(l.codigo, 25),
      descripcion: texto(l.descripcion, 250) || `Ítem ${i + 1}`,
      cantidad,
      uni_medida: Number(l.uni_medida) || 59,
      precio_uni: precio,
      monto_descu: descuento,
      idprod: l.idprod ? Number(l.idprod) : null,
      compra: compraDeLinea(cantidad, precio, descuento),
    };
  });
}

type LineaGuardada = LineaFse & { idprod: number | null; compra: number };

function validar(sujeto: Record<string, unknown>, lineas: LineaGuardada[]): string[] {
  const errores: string[] = [];
  if (!TIPOS_DOC.includes(String(sujeto.tipo_documento))) errores.push('tipo de documento del vendedor');
  if (!texto(sujeto.num_documento, 25)) errores.push('número de documento del vendedor');
  if (!texto(sujeto.nombre, 250)) errores.push('nombre del vendedor');
  if (!/^\d{2}$/.test(String(sujeto.departamento ?? ''))) errores.push('departamento');
  if (!/^\d{2}$/.test(String(sujeto.municipio ?? ''))) errores.push('municipio');
  if (!texto(sujeto.direccion, 200)) errores.push('dirección del vendedor');
  if (lineas.length === 0) errores.push('al menos un ítem');
  lineas.forEach((l) => {
    if (l.cantidad <= 0) errores.push(`cantidad del ítem ${l.num_item}`);
    if (!l.descripcion) errores.push(`descripción del ítem ${l.num_item}`);
  });
  return [...new Set(errores)];
}

async function leer(connection: Conexion, idfse: number) {
  const [docs] = await connection.execute<RowDataPacket[]>(
    'SELECT * FROM facturas_sujeto_excluido WHERE idfse = ?',
    [idfse]
  );
  if (!docs[0]) return null;
  const [lineas] = await connection.execute<RowDataPacket[]>(
    'SELECT * FROM facturas_sujeto_excluido_detalle WHERE idfse = ? ORDER BY num_item',
    [idfse]
  );
  return { documento: docs[0], lineas };
}

async function guardarLineas(connection: Conexion, idfse: number, lineas: LineaGuardada[]) {
  await connection.execute('DELETE FROM facturas_sujeto_excluido_detalle WHERE idfse = ?', [idfse]);
  for (const l of lineas) {
    await connection.execute(
      `INSERT INTO facturas_sujeto_excluido_detalle
        (idfse, num_item, tipo_item, idprod, codigo, descripcion, cantidad, uni_medida, precio_uni, monto_descu, compra)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [idfse, l.num_item, l.tipo_item, l.idprod, l.codigo, l.descripcion, l.cantidad, l.uni_medida, l.precio_uni, l.monto_descu, l.compra]
    );
  }
}

/** Crea la compra tipo 14. La registra (y suma stock) solo si cada línea tiene ficha de producto. */
async function crearCompra(connection: Conexion, documento: RowDataPacket, lineas: RowDataPacket[]) {
  const empresa = await leerEmpresa(connection);
  const doc = soloDigitos(documento.num_documento) || '-';
  const [existentes] = await connection.execute<RowDataPacket[]>(
    `SELECT idproveedor FROM proveedores
     WHERE REPLACE(REPLACE(COALESCE(nit, ''), '-', ''), ' ', '') = ? LIMIT 1`,
    [doc]
  );
  let idproveedor = existentes[0] ? Number(existentes[0].idproveedor) : 0;
  if (!idproveedor) {
    const codigo = (await siguienteCorrelativo(connection, 'SE')).codigo;
    const [alta] = await connection.execute<ResultSetHeader>(
      `INSERT INTO proveedores (codigo, nombre_legal, nit, telefono, email, direccion, categoria_contribuyente, que_provee)
       VALUES (?, ?, ?, ?, ?, ?, 'OTRO', 'PRODUCTO')`,
      [codigo, documento.nombre, documento.num_documento, documento.telefono, documento.correo, documento.direccion]
    );
    idproveedor = alta.insertId;
  }

  await connection.beginTransaction();
  const nodocto = await nuevoNodocto(connection);
  const numero = (await siguienteCorrelativo(connection, 'CP')).codigo;
  const todasConFicha = lineas.every((l) => l.idprod);
  const [compra] = await connection.execute<ResultSetHeader>(
    `INSERT INTO compras (
       estado, nodocto, numero_interno, clase_documento, categoria_operacion, tipo_dte, idproveedor,
       numero_control, codigo_generacion, sello_recepcion, numero_factura, fecha_emision, fecha_registro,
       condicion_operacion, retencion_renta, descuento_afecta_costo, notas, dte_ambiente, dte_version
     ) VALUES (
       'BORRADOR', ?, ?, 'DTE', ?, '14', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1
     )`,
    [
      nodocto,
      numero,
      todasConFicha ? 'CONTABLE' : 'OTRO',
      idproveedor,
      documento.numero_control,
      documento.codigo_generacion,
      documento.sello_recepcion,
      documento.numero_control,
      documento.fecha_emision,
      fechaLocalISO(),
      documento.condicion_operacion,
      documento.retencion_renta,
      empresa.descuento_modo === 'COSTO' ? 1 : 0,
      documento.observaciones,
      documento.ambiente,
    ]
  );
  const idcompra = compra.insertId;
  let n = 1;
  for (const l of lineas) {
    const conFicha = Boolean(l.idprod);
    await insertarLinea(
      connection,
      normalizarLinea(
        {
          idcompra,
          numero_linea: n++,
          destino: conFicha ? 'INVENTARIO' : null,
          idprod: conFicha ? Number(l.idprod) : null,
          referencia_proveedor: l.codigo,
          descripcion: l.descripcion,
          cantidad: l.cantidad,
          uni_medida: l.uni_medida,
          tipo_item: l.tipo_item,
          costo_unitario: l.precio_uni,
          condicion_iva: 'NO_SUJETO',
          subtotal_sin_iva: l.compra,
          iva_unitario: 0,
          exento_unitario: 0,
          no_sujeto_unitario: Number(l.precio_uni),
          subtotal_con_iva: l.compra,
        },
        false
      )
    );
  }
  await persistirTotales(connection, idcompra);
  let productos = 0;
  if (todasConFicha) {
    await connection.execute("UPDATE compras SET estado = 'REGISTRADA' WHERE idcompra = ? AND estado = 'BORRADOR'", [idcompra]);
    productos = await aplicarStockAlRegistrar(connection, idcompra);
  }
  await connection.execute('UPDATE facturas_sujeto_excluido SET idcompra = ? WHERE idfse = ?', [idcompra, documento.idfse]);
  await connection.commit();
  return { idcompra, numero, registrada: todasConFicha, productos };
}

export async function GET(request: NextRequest) {
  const id = Number(new URL(request.url).searchParams.get('id')) || 0;
  const connection = await connectDB();
  try {
    if (!id) {
      const [rows] = await connection.execute<RowDataPacket[]>(
        `SELECT idfse, estado, numero_control, codigo_generacion, fecha_emision, nombre, total_pagar, sello_recepcion, idcompra
         FROM facturas_sujeto_excluido ORDER BY idfse DESC LIMIT 100`
      );
      return json({ success: true, documentos: rows });
    }
    const doc = await leer(connection, id);
    if (!doc) return json({ error: 'Documento no encontrado' }, 404);
    const renta = sugerirRenta(doc.lineas.map((l) => ({ tipo_item: Number(l.tipo_item), compra: Number(l.compra) })));
    return json({
      success: true,
      ...doc,
      renta_sugerida: renta,
      consulta: doc.documento.sello_recepcion
        ? urlConsulta(doc.documento.ambiente, doc.documento.codigo_generacion, String(doc.documento.fecha_emision).slice(0, 10))
        : null,
    });
  } finally {
    await connection.end();
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Record<string, unknown>;
  const accion = String(body.accion || 'guardar');
  const connection = await connectDB();
  try {
    if (accion === 'guardar') {
      const lineas = lineasDe(body);
      const errores = validar(body, lineas);
      if (errores.length) return json({ error: `Faltan datos: ${errores.join(', ')}` }, 400);
      const renta = body.retencion_renta == null ? sugerirRenta(lineas) : Math.max(0, Number(body.retencion_renta) || 0);
      const totalCompra = lineas.reduce((s, l) => s + l.compra, 0);
      const totalDescu = lineas.reduce((s, l) => s + l.monto_descu, 0);
      const campos = [
        texto(body.tipo_documento, 2),
        texto(body.num_documento, 25),
        texto(body.nombre, 250),
        texto(body.cod_actividad, 6),
        texto(body.desc_actividad, 150),
        texto(body.departamento, 2),
        texto(body.municipio, 2),
        texto(body.direccion, 200),
        texto(body.telefono, 30),
        texto(body.correo, 100),
        [1, 2, 3].includes(Number(body.condicion_operacion)) ? Number(body.condicion_operacion) : 1,
        texto(body.codigo_forma_pago, 2) || '01',
        renta,
        texto(body.observaciones, 250),
        totalCompra,
        totalDescu,
        totalCompra,
        Math.max(0, totalCompra - renta),
      ];
      const id = Number(body.idfse) || 0;
      if (id) {
        const actual = await leer(connection, id);
        if (!actual) return json({ error: 'Documento no encontrado' }, 404);
        if (actual.documento.estado === 'ACEPTADO' || actual.documento.estado === 'INVALIDADO') {
          return json({ error: 'Este documento ya fue aceptado o invalidado' }, 400);
        }
        await connection.execute(
          `UPDATE facturas_sujeto_excluido SET
             tipo_documento=?, num_documento=?, nombre=?, cod_actividad=?, desc_actividad=?, departamento=?, municipio=?,
             direccion=?, telefono=?, correo=?, condicion_operacion=?, codigo_forma_pago=?, retencion_renta=?, observaciones=?,
             total_compra=?, total_descuento=?, subtotal=?, total_pagar=?
           WHERE idfse=?`,
          [...campos, id]
        );
        await guardarLineas(connection, id, lineas);
        return json({ success: true, idfse: id, mensaje: 'Borrador actualizado' });
      }
      const empresa = await leerEmpresa(connection);
      const correlativo = (await siguienteCorrelativo(connection, 'DTE14')).codigo;
      const control = numeroControlFse(empresa.prefijo_control || 'M001P001', correlativo);
      const [alta] = await connection.execute<ResultSetHeader>(
        `INSERT INTO facturas_sujeto_excluido (
           estado, ambiente, numero_control, codigo_generacion, fecha_emision, hora_emision,
           tipo_documento, num_documento, nombre, cod_actividad, desc_actividad, departamento, municipio,
           direccion, telefono, correo, condicion_operacion, codigo_forma_pago, retencion_renta, observaciones,
           total_compra, total_descuento, subtotal, total_pagar, idusuario
         ) VALUES ('BORRADOR', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          empresa.dte_ambiente,
          control,
          nuevoCodigoGeneracion(),
          fechaLocalISO(),
          horaLocal(),
          ...campos,
          await usuarioDeRequest(request),
        ]
      );
      await guardarLineas(connection, alta.insertId, lineas);
      return json({ success: true, idfse: alta.insertId, numero_control: control, mensaje: 'Borrador creado' });
    }

    const idfse = Number(body.idfse) || 0;
    const actual = await leer(connection, idfse);
    if (!actual) return json({ error: 'Documento no encontrado' }, 404);
    const { documento, lineas } = actual;

    if (accion === 'emitir') {
      if (documento.estado === 'ACEPTADO' || documento.estado === 'INVALIDADO') {
        return json({ error: 'Este documento ya no se puede emitir' }, 400);
      }
      const empresa = await leerEmpresa(connection);
      const falta = faltantesEmpresa(empresa);
      if (falta.length) return json({ error: `Complete en Configuración > Empresa: ${falta.join(', ')}` }, 400);
      const armado = armarFse(
        empresa,
        {
          numero_control: documento.numero_control,
          codigo_generacion: documento.codigo_generacion,
          fecha_emision: String(documento.fecha_emision).slice(0, 10),
          hora_emision: String(documento.hora_emision).slice(0, 8),
          condicion_operacion: Number(documento.condicion_operacion) || 1,
          codigo_forma_pago: documento.codigo_forma_pago || '01',
          retencion_renta: Number(documento.retencion_renta) || 0,
          observaciones: documento.observaciones,
        },
        documento as never,
        lineas as never
      );
      await connection.execute('UPDATE facturas_sujeto_excluido SET dte_json = ? WHERE idfse = ?', [
        JSON.stringify(armado.dte),
        idfse,
      ]);
      const { firmado, respuesta } = await emitirFse(empresa, armado.dte);
      const aceptado = respuesta.estado === 'PROCESADO' && Boolean(respuesta.sello);
      await connection.execute(
        `UPDATE facturas_sujeto_excluido
         SET documento_firmado = ?, respuesta_mh = ?, estado = ?, sello_recepcion = ?, ambiente = ?
         WHERE idfse = ?`,
        [
          firmado,
          JSON.stringify(respuesta.crudo),
          aceptado ? 'ACEPTADO' : 'RECHAZADO',
          respuesta.sello,
          empresa.dte_ambiente,
          idfse,
        ]
      );
      if (!aceptado) {
        const detalle = [respuesta.descripcion, ...respuesta.observaciones].filter(Boolean).join(' · ');
        return json({ success: false, error: detalle || 'Hacienda rechazó el documento', respuesta }, 422);
      }
      let compra = null;
      try {
        const fresco = await leer(connection, idfse);
        compra = await crearCompra(connection, fresco!.documento, fresco!.lineas);
      } catch (error) {
        try { await connection.rollback(); } catch { /* la aceptación ya quedó guardada */ }
        return json({
          success: true,
          mensaje: `Hacienda aceptó el DTE (sello ${respuesta.sello}) pero no se pudo crear la compra: ${(error as Error).message}`,
          sello: respuesta.sello,
        });
      }
      const aviso = compra.registrada
        ? `Aceptada. Compra ${compra.numero} registrada${compra.productos ? `; se sumó el stock de ${compra.productos} producto(s)` : ''}`
        : `Aceptada. La compra ${compra.numero} quedó en borrador: hay ítems sin ficha, clasifíquelos en Ingreso de compras`;
      return json({ success: true, mensaje: aviso, sello: respuesta.sello, ...compra, consulta: urlConsulta(empresa.dte_ambiente, documento.codigo_generacion, String(documento.fecha_emision).slice(0, 10)) });
    }

    if (accion === 'invalidar') {
      const motivo = texto(body.motivo, 250);
      if (documento.estado !== 'ACEPTADO') return json({ error: 'Solo se invalida un DTE aceptado por Hacienda' }, 400);
      if (!motivo) return json({ error: 'Indique el motivo de la invalidación' }, 400);
      const empresa = await leerEmpresa(connection);
      const falta = faltantesEmpresa(empresa);
      if (falta.length) return json({ error: `Complete en Configuración > Empresa: ${falta.join(', ')}` }, 400);
      const { respuesta } = await invalidarFse(empresa, {
        codigoGeneracion: documento.codigo_generacion,
        sello: documento.sello_recepcion,
        numeroControl: documento.numero_control,
        fechaEmision: String(documento.fecha_emision).slice(0, 10),
        tipoDocumento: documento.tipo_documento,
        numDocumento: documento.num_documento,
        nombre: documento.nombre,
        motivo,
      });
      if (respuesta.estado !== 'PROCESADO') {
        return json({ success: false, error: [respuesta.descripcion, ...respuesta.observaciones].filter(Boolean).join(' · ') }, 422);
      }
      await connection.beginTransaction();
      await connection.execute(
        `UPDATE facturas_sujeto_excluido SET estado = 'INVALIDADO', motivo_invalidacion = ? WHERE idfse = ?`,
        [motivo, idfse]
      );
      if (documento.idcompra) {
        await connection.execute(
          `UPDATE compras SET estado = 'INVALIDADO', motivo_invalidacion = ?, fecha_invalidacion = ?
           WHERE idcompra = ? AND estado IN ('BORRADOR','REGISTRADA')`,
          [motivo, fechaLocalISO(), documento.idcompra]
        );
        await revertirStockAlAnular(connection, Number(documento.idcompra));
      }
      await connection.commit();
      return json({ success: true, mensaje: 'Hacienda invalidó el DTE' });
    }

    return json({ error: 'Acción no válida' }, 400);
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      /* sin transacción */
    }
    console.error('Error en sujeto excluido:', error);
    return json({ error: (error as Error).message || 'Error al procesar el documento' }, 500);
  } finally {
    await connection.end();
  }
}
