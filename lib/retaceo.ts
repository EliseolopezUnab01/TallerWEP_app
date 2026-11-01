import type { RowDataPacket } from 'mysql2/promise';
import type { Conexion } from '@/lib/compras-detalle-db';
import { IVA_TASA } from '@/lib/compras-detalle';
import { r8 } from '@/lib/decimales';
import { sincronizarPendientes } from '@/lib/procesos';
import { promedioActual, promedioPonderado, registrarCosto } from '@/lib/costos';

/**
 * Retaceo de un proceso de ingreso.
 *
 * - Base de reparto: CIF de cada línea = costo en dólares de Aduana + parte de seguro y flete declarados.
 * - DAI: % de cada línea sobre su CIF. Si el DUCA trae el DAI pagado, se reparte ese total con el mismo peso.
 * - IVA: 13% sobre CIF + DAI, ajustado al IVA pagado del DUCA. Es crédito fiscal: no entra al costo.
 * - Gastos (total a retacear del proceso): proporcionales al CIF.
 * - Costo destino = costo pagado (o corregido) + (gastos + DAI) por unidad.
 */

export interface LineaRetaceo {
  iddetalle: number;
  idprod: number | null;
  cantidad: number;
  costo_divisa: number;
  valor_dai: number;
  costo_corregido?: number | null;
}

export interface ParametrosRetaceo {
  tipo_cambio_duca: number;
  tipo_cambio_pagado: number;
  seguro: number;
  flete: number;
  /** DAI pagado según el DUCA; 0 = usar el calculado. */
  dai_total: number;
  /** IVA pagado según el DUCA; 0 = usar el calculado. */
  iva_total: number;
  /** Total de gastos que el usuario decidió repartir. */
  gastos: number;
}

export interface ResultadoLinea {
  iddetalle: number;
  idprod: number | null;
  cantidad: number;
  costo_divisa: number;
  costo_contable_usd: number;
  subtotal_contable: number;
  subtotal_cif: number;
  costo_cif: number;
  valor_dai: number;
  dai_linea: number;
  dai_unitario: number;
  iva_linea: number;
  iva_unitario: number;
  gastos_linea: number;
  gastos_unitario: number;
  costo_pagado_usd: number;
  costo_corregido: number | null;
  gastos_totales: number;
  costo_destino: number;
}

export interface ResultadoRetaceo {
  lineas: ResultadoLinea[];
  total_contable: number;
  total_grupo_cif: number;
  dai_calculado: number;
  iva_calculado: number;
  dai_aplicado: number;
  iva_aplicado: number;
  gastos_aplicados: number;
  total_destino: number;
}

/** Reparte `total` según `pesos`; el residuo de redondeo va a la línea de mayor peso. */
export function repartir(total: number, pesos: number[]): number[] {
  const suma = pesos.reduce((a, b) => a + b, 0);
  if (pesos.length === 0) return [];
  const base = suma > 0 ? pesos : pesos.map(() => 1);
  const sumaBase = suma > 0 ? suma : pesos.length;
  const partes = base.map((p) => r8((total * p) / sumaBase));
  const residuo = r8(total - partes.reduce((a, b) => a + b, 0));
  if (residuo !== 0) {
    const mayor = base.indexOf(Math.max(...base));
    partes[mayor] = r8(partes[mayor] + residuo);
  }
  return partes;
}

export function calcularRetaceo(lineas: LineaRetaceo[], p: ParametrosRetaceo): ResultadoRetaceo {
  const tcDuca = p.tipo_cambio_duca > 0 ? p.tipo_cambio_duca : 1;
  const tcPagado = p.tipo_cambio_pagado > 0 ? p.tipo_cambio_pagado : tcDuca;

  const contables = lineas.map((l) => r8(l.costo_divisa * tcDuca));
  const subtotales = lineas.map((l, i) => r8(contables[i] * l.cantidad));
  const seguroFlete = repartir(r8(p.seguro + p.flete), subtotales);
  const cif = subtotales.map((s, i) => r8(s + seguroFlete[i]));
  const totalCif = r8(cif.reduce((a, b) => a + b, 0));

  const daiCalc = cif.map((c, i) => r8((c * (Number(lineas[i].valor_dai) || 0)) / 100));
  const daiCalculado = r8(daiCalc.reduce((a, b) => a + b, 0));
  const dai = p.dai_total > 0 ? repartir(p.dai_total, daiCalculado > 0 ? daiCalc : cif) : daiCalc;

  const ivaCalc = cif.map((c, i) => r8((c + dai[i]) * IVA_TASA));
  const ivaCalculado = r8(ivaCalc.reduce((a, b) => a + b, 0));
  const iva = p.iva_total > 0 ? repartir(p.iva_total, ivaCalc) : ivaCalc;

  const gastos = repartir(r8(p.gastos), cif);

  const resultado = lineas.map((l, i): ResultadoLinea => {
    const cant = l.cantidad > 0 ? l.cantidad : 1;
    const pagado = r8(l.costo_divisa * tcPagado);
    const corregido = l.costo_corregido != null && l.costo_corregido > 0 ? r8(l.costo_corregido) : null;
    const gastosTotales = r8((gastos[i] + dai[i]) / cant);
    return {
      iddetalle: l.iddetalle,
      idprod: l.idprod,
      cantidad: l.cantidad,
      costo_divisa: r8(l.costo_divisa),
      costo_contable_usd: contables[i],
      subtotal_contable: subtotales[i],
      subtotal_cif: cif[i],
      costo_cif: r8(cif[i] / cant),
      valor_dai: Number(l.valor_dai) || 0,
      dai_linea: dai[i],
      dai_unitario: r8(dai[i] / cant),
      iva_linea: iva[i],
      iva_unitario: r8(iva[i] / cant),
      gastos_linea: gastos[i],
      gastos_unitario: r8(gastos[i] / cant),
      costo_pagado_usd: pagado,
      costo_corregido: corregido,
      gastos_totales: gastosTotales,
      costo_destino: r8((corregido ?? pagado) + gastosTotales),
    };
  });

  return {
    lineas: resultado,
    total_contable: r8(subtotales.reduce((a, b) => a + b, 0)),
    total_grupo_cif: totalCif,
    dai_calculado: daiCalculado,
    iva_calculado: ivaCalculado,
    dai_aplicado: r8(dai.reduce((a, b) => a + b, 0)),
    iva_aplicado: r8(iva.reduce((a, b) => a + b, 0)),
    gastos_aplicados: r8(gastos.reduce((a, b) => a + b, 0)),
    total_destino: r8(resultado.reduce((a, l) => a + l.costo_destino * l.cantidad, 0)),
  };
}

/**
 * Líneas de inventario de las facturas del proceso, con lo capturado del DUCA.
 * Express no entra a un DUCA. Partida y %DAI salen de la ficha mientras la línea no tenga los suyos.
 */
export async function lineasDelProceso(connection: Conexion, idproceso: number) {
  const [rows] = await connection.execute<RowDataPacket[]>(
    `SELECT d.iddetalle, d.idcompra, d.numero_linea, d.idprod, d.referencia_proveedor, d.descripcion, d.destino,
            d.cantidad,
            IF(c.descuento_afecta_costo = 1 AND d.cantidad > 0, d.subtotal_sin_iva / d.cantidad, d.costo_unitario) AS costo_divisa,
            d.imagen_url,
            c.numero_interno, c.numero_factura, c.fecha_emision, c.estado AS estado_compra,
            pr.nombre_legal AS proveedor_nombre,
            COALESCE(dd.codigo_arancelario, p.codarancel) AS codigo_arancelario,
            COALESCE(dd.dai_preferente, 0) AS dai_preferente,
            COALESCE(dd.valor_dai, p.porcentaje_dai, 0) AS valor_dai,
            dd.iddetalle IS NULL AS dai_de_ficha,
            dd.costo_contable_usd, dd.costo_cif, dd.subtotal_cif, dd.total_grupo_cif, dd.dai_pagado, dd.iva_pagado, dd.gastos_aduana,
            cp.costo_corregido, cp.costo_pagado_usd, cp.gastos_totales, cp.costo_destino, cp.costo_destino_prom,
            cp.stock_aplicado
     FROM compras c
     JOIN compras_detalle d ON d.idcompra = c.idcompra
     LEFT JOIN proveedores pr ON pr.idproveedor = c.idproveedor
     LEFT JOIN productos p ON p.idprod = d.idprod
     LEFT JOIN duca_detalles dd ON dd.iddetalle = d.iddetalle
     LEFT JOIN costos_productos cp ON cp.iddetalle = d.iddetalle
     WHERE c.idproceso = ? AND c.estado <> 'ANULADA' AND d.destino = 'INVENTARIO'
     ORDER BY c.idcompra, d.numero_linea`,
    [idproceso]
  );
  return rows;
}

export async function parametrosDelProceso(connection: Conexion, idproceso: number): Promise<ParametrosRetaceo | null> {
  const [rows] = await connection.execute<RowDataPacket[]>(
    `SELECT p.tipo_cambio_pagado, p.total_retaceo, d.tipo_cambio_duca, d.seguro_declarado, d.flete_declarado,
            d.dai_pagado, d.iva_pagado
     FROM proceso_ingreso p LEFT JOIN datos_duca d ON d.idproceso = p.idproceso
     WHERE p.idproceso = ?`,
    [idproceso]
  );
  const r = rows[0];
  if (!r) return null;
  return {
    tipo_cambio_duca: Number(r.tipo_cambio_duca) || Number(r.tipo_cambio_pagado) || 1,
    tipo_cambio_pagado: Number(r.tipo_cambio_pagado) || 1,
    seguro: Number(r.seguro_declarado) || 0,
    flete: Number(r.flete_declarado) || 0,
    dai_total: Number(r.dai_pagado) || 0,
    iva_total: Number(r.iva_pagado) || 0,
    gastos: Number(r.total_retaceo) || 0,
  };
}

/** Calcula y guarda el detalle DUCA de cada línea (sin tocar costos). */
export async function guardarCalculoDuca(connection: Conexion, idproceso: number) {
  const parametros = await parametrosDelProceso(connection, idproceso);
  if (!parametros) throw new Error('Proceso no encontrado');
  const filas = await lineasDelProceso(connection, idproceso);
  const calculo = calcularRetaceo(
    filas.map((f) => ({
      iddetalle: Number(f.iddetalle),
      idprod: f.idprod ? Number(f.idprod) : null,
      cantidad: Number(f.cantidad),
      costo_divisa: Number(f.costo_divisa),
      valor_dai: Number(f.valor_dai),
      costo_corregido: f.costo_corregido == null ? null : Number(f.costo_corregido),
    })),
    parametros
  );
  const [duca] = await connection.execute<RowDataPacket[]>('SELECT numero_duca FROM datos_duca WHERE idproceso = ?', [idproceso]);
  const numeroDuca = duca[0]?.numero_duca ?? null;
  for (const l of calculo.lineas) {
    const f = filas.find((x) => Number(x.iddetalle) === l.iddetalle)!;
    await connection.execute(
      `INSERT INTO duca_detalles
         (idproceso, iddetalle, idprod, numero_duca, cantidad, costo_divisa, costo_contable_usd, costo_cif,
          codigo_arancelario, dai_preferente, valor_dai, dai_pagado, iva_pagado, gastos_aduana,
          subtotal_contable, subtotal_cif, total_grupo_cif, tipo_cambio_duca)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         idproceso = VALUES(idproceso), idprod = VALUES(idprod), numero_duca = VALUES(numero_duca),
         cantidad = VALUES(cantidad), costo_divisa = VALUES(costo_divisa), costo_contable_usd = VALUES(costo_contable_usd),
         costo_cif = VALUES(costo_cif), valor_dai = VALUES(valor_dai), dai_pagado = VALUES(dai_pagado),
         iva_pagado = VALUES(iva_pagado), gastos_aduana = VALUES(gastos_aduana), subtotal_contable = VALUES(subtotal_contable),
         subtotal_cif = VALUES(subtotal_cif), total_grupo_cif = VALUES(total_grupo_cif), tipo_cambio_duca = VALUES(tipo_cambio_duca)`,
      [
        idproceso,
        l.iddetalle,
        l.idprod,
        numeroDuca,
        l.cantidad,
        l.costo_divisa,
        l.costo_contable_usd,
        l.costo_cif,
        f.codigo_arancelario ?? null,
        f.dai_preferente ? 1 : 0,
        l.valor_dai,
        l.dai_unitario,
        l.iva_unitario,
        l.gastos_unitario,
        l.subtotal_contable,
        l.subtotal_cif,
        calculo.total_grupo_cif,
        parametros.tipo_cambio_duca,
      ]
    );
  }
  const vigentes = calculo.lineas.length ? calculo.lineas.map((l) => l.iddetalle) : [0];
  await connection.execute(
    `DELETE FROM duca_detalles WHERE idproceso = ? AND iddetalle NOT IN (${vigentes.map(() => '?').join(',')})`,
    [idproceso, ...vigentes]
  );
  return calculo;
}

/**
 * Aplica el retaceo y deja el proceso FINALIZADO (mercadería en bodega).
 * - Primera vez por línea: suma la cantidad a stock_contable, guarda el promedio y el stock previos
 *   en costos_productos y rota los respaldos de `costos`. Las facturas nacionales que ya sumaron
 *   stock al registrarse solo recalculan el costo.
 * - Al volver a aplicar tras reabrir: actualiza las mismas filas con el promedio guardado,
 *   sin rotar respaldos ni sumar otra vez el stock.
 */
export async function finalizarRetaceo(connection: Conexion, idproceso: number) {
  const [procs] = await connection.execute<RowDataPacket[]>(
    // FOR UPDATE: un segundo clic espera aquí y luego ve FINALIZADO, así el stock no se suma dos veces.
    'SELECT idproceso, nodocto, estado_documento, factura_compra, tipo_cambio_pagado FROM proceso_ingreso WHERE idproceso = ? FOR UPDATE',
    [idproceso]
  );
  const proceso = procs[0];
  if (!proceso) throw new Error('Proceso no encontrado');
  if (proceso.estado_documento === 'FINALIZADO') throw new Error('El retaceo ya fue aplicado; reábralo para volver a aplicarlo');

  const calculo = await guardarCalculoDuca(connection, idproceso);
  if (calculo.lineas.length === 0) throw new Error('El proceso no tiene facturas con productos de inventario');
  const sinProducto = calculo.lineas.filter((l) => !l.idprod);
  if (sinProducto.length > 0) throw new Error(`Hay ${sinProducto.length} línea(s) sin producto de inventario`);

  const [facturas] = await connection.execute<RowDataPacket[]>(
    `SELECT GROUP_CONCAT(DISTINCT COALESCE(numero_factura, numero_interno) SEPARATOR ', ') AS facturas, MAX(fecha_emision) AS fecha
     FROM compras WHERE idproceso = ? AND estado <> 'ANULADA'`,
    [idproceso]
  );
  const facturaTexto = String(proceso.factura_compra || facturas[0]?.facturas || '').slice(0, 100) || null;
  const fechaCompra = facturas[0]?.fecha ?? null;

  const [previos] = await connection.execute<RowDataPacket[]>(
    'SELECT iddetalle, idprod, costo_prom_anterior, stock_anterior, stock_aplicado FROM costos_productos WHERE idproceso = ?',
    [idproceso]
  );
  const aplicada = new Map(previos.filter((p) => Number(p.stock_aplicado)).map((p) => [Number(p.iddetalle), p]));
  // Facturas nacionales registradas antes de vincularse: su cantidad ya está en stock_contable.
  const [registradas] = await connection.execute<RowDataPacket[]>(
    `SELECT d.iddetalle FROM compras_detalle d JOIN compras c ON c.idcompra = d.idcompra
     WHERE c.idproceso = ? AND c.stock_aplicado = 1`,
    [idproceso]
  );
  const yaEnStock = new Set(registradas.map((r) => Number(r.iddetalle)));

  type Acumulado = { cantidad: number; nueva: number; previa: number; total: number; divisa: number; iva: number; pagado: number };
  const porProducto = new Map<number, Acumulado>();
  for (const l of calculo.lineas) {
    const acc = porProducto.get(l.idprod!) ?? { cantidad: 0, nueva: 0, previa: 0, total: 0, divisa: 0, iva: 0, pagado: 0 };
    acc.cantidad += l.cantidad;
    if (!aplicada.has(l.iddetalle)) {
      if (yaEnStock.has(l.iddetalle)) acc.previa += l.cantidad;
      else acc.nueva += l.cantidad;
    }
    acc.total += l.costo_destino * l.cantidad;
    acc.divisa += l.costo_divisa * l.cantidad;
    acc.iva += l.iva_linea;
    acc.pagado += (l.costo_corregido ?? l.costo_pagado_usd) * l.cantidad;
    porProducto.set(l.idprod!, acc);
  }

  const promedios = new Map<number, number>();
  const anteriores = new Map<number, { promedio: number; stock: number }>();
  for (const [idprod, acc] of porProducto) {
    const [datos] = await connection.execute<RowDataPacket[]>(
      'SELECT stock_contable FROM productos WHERE idprod = ?',
      [idprod]
    );
    const guardado = [...aplicada.values()].find((p) => Number(p.idprod) === idprod);
    const reaplicacion = Boolean(guardado);
    const stockPrevio = reaplicacion
      ? Number(guardado!.stock_anterior) || 0
      : Math.max((Number(datos[0]?.stock_contable) || 0) - acc.previa, 0);
    const promPrevio = reaplicacion
      ? Number(guardado!.costo_prom_anterior) || 0
      : await promedioActual(connection, idprod);
    anteriores.set(idprod, { promedio: promPrevio, stock: stockPrevio });

    const promedio = promedioPonderado(stockPrevio, promPrevio, acc.cantidad, acc.total);
    promedios.set(idprod, promedio);

    if (acc.nueva > 0) {
      await connection.execute('UPDATE productos SET stock_contable = stock_contable + ? WHERE idprod = ?', [acc.nueva, idprod]);
    }

    await registrarCosto(connection, {
      idprod,
      costoFactura: acc.divisa / acc.cantidad,
      costoLocal: acc.total / acc.cantidad,
      promedio,
      costoProveedor: acc.pagado / acc.cantidad,
      ivaUnitario: acc.iva / acc.cantidad,
      nofactura: facturaTexto,
      nodocto: proceso.nodocto,
      dtCompra: fechaCompra,
      rotar: !reaplicacion,
    });
  }

  const tcPagado = Number(proceso.tipo_cambio_pagado) || 1;
  for (const l of calculo.lineas) {
    const ant = anteriores.get(l.idprod!)!;
    // costo_prom_anterior y stock_anterior solo se escriben la primera vez (stock_aplicado se asigna al final).
    await connection.execute(
      `INSERT INTO costos_productos
         (idproceso, iddetalle, idprod, factura_compra, cantidad, costo_divisa, costo_contable_usd, costo_pagado_usd,
          iva_pagado, gastos_totales, costo_corregido, costo_cif, costo_destino, costo_destino_prom, tipo_cambio_pagado,
          costo_prom_anterior, stock_anterior, stock_aplicado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE
         idproceso = VALUES(idproceso), idprod = VALUES(idprod), factura_compra = VALUES(factura_compra),
         cantidad = VALUES(cantidad), costo_divisa = VALUES(costo_divisa), costo_contable_usd = VALUES(costo_contable_usd),
         costo_pagado_usd = VALUES(costo_pagado_usd), iva_pagado = VALUES(iva_pagado), gastos_totales = VALUES(gastos_totales),
         costo_corregido = VALUES(costo_corregido), costo_cif = VALUES(costo_cif), costo_destino = VALUES(costo_destino),
         costo_destino_prom = VALUES(costo_destino_prom), tipo_cambio_pagado = VALUES(tipo_cambio_pagado),
         costo_prom_anterior = IF(stock_aplicado = 1, costo_prom_anterior, VALUES(costo_prom_anterior)),
         stock_anterior = IF(stock_aplicado = 1, stock_anterior, VALUES(stock_anterior)),
         stock_aplicado = 1`,
      [
        idproceso,
        l.iddetalle,
        l.idprod,
        facturaTexto,
        l.cantidad,
        l.costo_divisa,
        l.costo_contable_usd,
        l.costo_pagado_usd,
        l.iva_unitario,
        l.gastos_totales,
        l.costo_corregido,
        l.costo_cif,
        l.costo_destino,
        promedios.get(l.idprod!) ?? l.costo_destino,
        tcPagado,
        ant.promedio,
        ant.stock,
      ]
    );
  }

  await connection.execute(
    "UPDATE proceso_ingreso SET estado_documento = 'FINALIZADO', fecha_retaceo = NOW(), estado_proceso = 'BODEGA' WHERE idproceso = ?",
    [idproceso]
  );
  await sincronizarPendientes(connection, idproceso);
  return calculo;
}

/** Reabre un retaceo aplicado para agregar documentos o gastos olvidados. Los datos de aduana quedan bloqueados. */
export async function reabrirRetaceo(connection: Conexion, idproceso: number, idusuario: number) {
  const [procs] = await connection.execute<RowDataPacket[]>(
    'SELECT estado_documento FROM proceso_ingreso WHERE idproceso = ?',
    [idproceso]
  );
  if (!procs[0]) throw new Error('Proceso no encontrado');
  if (procs[0].estado_documento !== 'FINALIZADO') throw new Error('El retaceo no está aplicado');
  await connection.execute(
    "UPDATE proceso_ingreso SET estado_documento = 'BORRADOR', fecha_reapertura = NOW(), idusuario_reapertura = ? WHERE idproceso = ?",
    [idusuario, idproceso]
  );
}
