import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { usuarioDeRequest } from '@/lib/sesion';
import { IVA_TASA } from '@/lib/compras-detalle';
import { r8 } from '@/lib/decimales';
import { CLAVES_NIVEL, NIVELES_PRECIO, nivelPorClave, sqlPreciosCompleto } from '@/lib/precios-niveles';

/** Estimación de renta que usaba el sistema FoxPro para la ganancia neta. */
const FACTOR_RENTA = 0.2;

interface CalculoPrecio {
  precio: number;
  porcentaje: number;
  ganancia: number;
  iva: number;
}

interface DatosCosto {
  costoLocal: number;
  ivaPagado: number;
}

// Fórmulas del sistema FoxPro. El precio de venta incluye IVA.
const factorIvaPrecio = 1 - 1 / (1 + IVA_TASA);

function desdePrecio({ costoLocal, ivaPagado }: DatosCosto, precio: number): CalculoPrecio {
  const iva = precio * factorIvaPrecio - ivaPagado;
  return {
    precio: r8(precio),
    porcentaje: r8(costoLocal > 0 ? (precio / costoLocal - 1) * 100 : 0),
    ganancia: r8((precio - iva) * (1 - FACTOR_RENTA) - costoLocal),
    iva: r8(iva),
  };
}

function desdePorcentaje(datos: DatosCosto, porcentaje: number): CalculoPrecio {
  return { ...desdePrecio(datos, datos.costoLocal * (1 + porcentaje / 100)), porcentaje: r8(porcentaje) };
}

function desdeGanancia(datos: DatosCosto, ganancia: number): CalculoPrecio {
  const precio = ((ganancia + datos.costoLocal) / (1 - FACTOR_RENTA) - datos.ivaPagado) / (1 - factorIvaPrecio);
  return { ...desdePrecio(datos, precio), ganancia: r8(ganancia) };
}

async function leerCosto(connection: Awaited<ReturnType<typeof connectDB>>, idprod: number): Promise<DatosCosto | null> {
  const [rows]: any = await connection.execute(
    `SELECT p.idprod, c.costo, c.costo_local, c.iva_pagado
     FROM productos p LEFT JOIN costos c ON c.idprod = p.idprod WHERE p.idprod = ?`,
    [idprod]
  );
  if (rows.length === 0) return null;
  const costoLocal = Number(rows[0].costo_local) || Number(rows[0].costo) || 0;
  return { costoLocal, ivaPagado: Number(rows[0].iva_pagado) || 0 };
}

const factores = { iva: IVA_TASA, renta: FACTOR_RENTA };

// POST: calcula un nivel a partir de porcentaje, precio o ganancia (no guarda)
export async function POST(request: Request) {
  let connection: Awaited<ReturnType<typeof connectDB>> | undefined;
  try {
    const { idprod, modo, tipoPrecio, valor } = await request.json();
    if (!idprod || !modo || !tipoPrecio || valor === undefined) {
      return NextResponse.json({ error: 'Se requieren idprod, modo, tipoPrecio y valor' }, { status: 400 });
    }
    if (!nivelPorClave(tipoPrecio)) {
      return NextResponse.json({ error: `Nivel de precio inválido. Use: ${CLAVES_NIVEL.join(', ')}` }, { status: 400 });
    }
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return NextResponse.json({ error: 'El valor debe ser numérico' }, { status: 400 });

    connection = await connectDB();
    const datos = await leerCosto(connection, Number(idprod));
    if (!datos) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });

    const calculos = { porcentaje: desdePorcentaje, precio: desdePrecio, ganancia: desdeGanancia } as const;
    const calcular = calculos[modo as keyof typeof calculos];
    if (!calcular) {
      return NextResponse.json({ error: 'Modo inválido. Debe ser: porcentaje, precio o ganancia' }, { status: 400 });
    }
    return NextResponse.json({ success: true, datos, resultado: calcular(datos, numero), factores });
  } catch (error: any) {
    console.error('Error en cálculo de precios:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  } finally {
    if (connection) await connection.end();
  }
}

// PUT: guarda los niveles enviados y deja una fila de historial con los 7 niveles antes y después
export async function PUT(request: Request) {
  let connection: Awaited<ReturnType<typeof connectDB>> | undefined;
  try {
    const { idprod, precios, razon } = await request.json();
    if (!idprod || !Array.isArray(precios)) {
      return NextResponse.json({ error: 'Se requieren idprod y precios (array)' }, { status: 400 });
    }
    if (!String(razon || '').trim()) {
      return NextResponse.json({ error: 'Indique la razón del ajuste' }, { status: 400 });
    }
    const cambios = precios.filter((p: any) => nivelPorClave(p?.tipoPrecio));
    for (const p of cambios) {
      for (const campo of ['precio', 'porcentaje', 'ganancia']) {
        if (!Number.isFinite(Number(p[campo] ?? 0))) {
          return NextResponse.json({ error: `Valor inválido en ${campo} de ${p.tipoPrecio}` }, { status: 400 });
        }
      }
      if (Number(p.precio) < 0) return NextResponse.json({ error: 'Un precio no puede ser negativo' }, { status: 400 });
    }
    if (cambios.length === 0) return NextResponse.json({ error: 'No hay niveles de precio para guardar' }, { status: 400 });

    connection = await connectDB();
    const datos = await leerCosto(connection, Number(idprod));
    if (!datos) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });

    await connection.beginTransaction();
    await connection.execute('INSERT IGNORE INTO precios (idprod) VALUES (?)', [idprod]);
    const [actuales]: any = await connection.execute('SELECT * FROM precios WHERE idprod = ? FOR UPDATE', [idprod]);
    const antes = actuales[0] ?? {};

    const asignaciones: string[] = [];
    const valores: number[] = [];
    const nuevos = new Map<string, number>();
    for (const p of cambios) {
      const clave = p.tipoPrecio as string;
      asignaciones.push(`precio_${clave} = ?`, `porcentaje_${clave} = ?`, `ganancia_${clave} = ?`);
      valores.push(r8(Number(p.precio) || 0), r8(Number(p.porcentaje) || 0), r8(Number(p.ganancia) || 0));
      nuevos.set(clave, r8(Number(p.precio) || 0));
    }
    await connection.execute(`UPDATE precios SET ${asignaciones.join(', ')} WHERE idprod = ?`, [...valores, idprod]);

    const anteriores = NIVELES_PRECIO.map((n) => r8(Number(antes[`precio_${n.clave}`]) || 0));
    const despues = NIVELES_PRECIO.map((n, i) => nuevos.get(n.clave) ?? anteriores[i]);
    await connection.execute(
      `INSERT INTO ajuste_precios
         (idprod, idusuario, razon_justificacion, costo_referencia,
          ${NIVELES_PRECIO.map((n) => `precio${n.numero}_anterior`).join(', ')},
          ${NIVELES_PRECIO.map((n) => `precio${n.numero}_nuevo`).join(', ')})
       VALUES (?, ?, ?, ?, ${NIVELES_PRECIO.map(() => '?').join(', ')}, ${NIVELES_PRECIO.map(() => '?').join(', ')})`,
      [idprod, await usuarioDeRequest(request), String(razon).trim(), datos.costoLocal, ...anteriores, ...despues]
    );
    await connection.commit();
    return NextResponse.json({ success: true, message: 'Precios actualizados correctamente' });
  } catch (error: any) {
    if (connection) await connection.rollback().catch(() => {});
    console.error('Error guardando precios:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  } finally {
    if (connection) await connection.end();
  }
}

// GET: producto con su costo y los 7 niveles (precio_<clave>, porcentaje_<clave>, ganancia_<clave>)
export async function GET(request: Request) {
  let connection: Awaited<ReturnType<typeof connectDB>> | undefined;
  try {
    const idprod = new URL(request.url).searchParams.get('idprod');
    if (!idprod) return NextResponse.json({ error: 'Se requiere idprod' }, { status: 400 });

    connection = await connectDB();
    const columnasNivel = NIVELES_PRECIO.flatMap((n) => [
      `COALESCE(pr.precio_${n.clave}, 0) AS precio_${n.clave}`,
      `COALESCE(pr.porcentaje_${n.clave}, 0) AS porcentaje_${n.clave}`,
      `COALESCE(pr.ganancia_${n.clave}, 0) AS ganancia_${n.clave}`,
    ]).join(',\n        ');
    const [data]: any = await connection.execute(
      `SELECT
        p.idprod, p.nombre, p.codigo_barras,
        (SELECT imagen_url FROM producto_imagenes WHERE idprod = p.idprod ORDER BY es_principal DESC, orden ASC LIMIT 1) AS imagen_principal,
        c.costo,
        COALESCE(NULLIF(c.costo_local, 0), c.costo) AS costo_local,
        COALESCE(c.iva_pagado, 0) AS iva_pagado,
        COALESCE(p.stock_contable, 0) AS stock_contable,
        COALESCE(p.stock_fisico, 0) AS stock_fisico,
        p.OE, p.marca, p.idprodprov, p.codigo_jerarquico,
        cn.nombre AS categoria_nueva_nombre,
        ${sqlPreciosCompleto('pr')},
        ${columnasNivel}
      FROM productos p
      LEFT JOIN costos c ON p.idprod = c.idprod
      LEFT JOIN precios pr ON p.idprod = pr.idprod
      LEFT JOIN categorias_nuevo cn ON p.idcategoria_nuevo = cn.idcategoria
      WHERE p.idprod = ?`,
      [idprod]
    );
    if (data.length === 0) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    return NextResponse.json({ success: true, producto: data[0], niveles: NIVELES_PRECIO, factores });
  } catch (error: any) {
    console.error('Error obteniendo precios:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  } finally {
    if (connection) await connection.end();
  }
}
