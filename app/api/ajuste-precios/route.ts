import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';

// Constantes de impuestos (El Salvador)
const FACTOR_IVA = 0.13; // 13% IVA
const FACTOR_RENTA = 0.20; // 20% estimación de renta

// Tipos de precio disponibles
const TIPOS_PRECIO = ['general', 'cliente', 'mecanico', 'minorista', 'mayorista', 'especial'];

interface CalculoPrecio {
  precio: number;
  porcentaje: number;
  ganancia: number;
  iva: number;
}

interface DatosProducto {
  costoLocal: number;
  costo: number;
  ivaPagado: number;
}

/**
 * CASO 1: Calcular precio y ganancia a partir de porcentaje
 * Fórmula del código FoxPro original
 */
function calcularDesdePorcentaje(datos: DatosProducto, porcentaje: number): CalculoPrecio {
  const { costoLocal, ivaPagado } = datos;
  
  // Precio = CostoLocal × (1 + Porcentaje/100)
  const precio = costoLocal * (1 + porcentaje / 100);
  
  // IVA = Precio - (Precio / 1.13) - IvaPagado
  const ivaDelPrecio = precio - (precio / (1 + FACTOR_IVA));
  const iva = ivaDelPrecio - ivaPagado;
  
  // Ganancia = (Precio - IVA) × (1 - FactorRenta) - CostoLocal
  const ganancia = (precio - iva) * (1 - FACTOR_RENTA) - costoLocal;
  
  return {
    precio: Math.round(precio * 100) / 100,
    porcentaje: Math.round(porcentaje * 100) / 100,
    ganancia: Math.round(ganancia * 100) / 100,
    iva: Math.round(iva * 100) / 100
  };
}

/**
 * CASO 2: Calcular porcentaje y ganancia a partir de precio
 * Fórmula del código FoxPro original
 */
function calcularDesdePrecio(datos: DatosProducto, precio: number): CalculoPrecio {
  const { costoLocal, ivaPagado } = datos;
  
  // Porcentaje = ((Precio / CostoLocal) - 1) × 100
  const porcentaje = costoLocal > 0 ? ((precio / costoLocal) - 1) * 100 : 0;
  
  // IVA = Precio × (1 - 1/1.13) - IvaPagado
  const factorIVA = 1 - (1 / (1 + FACTOR_IVA));
  const iva = (precio * factorIVA) - ivaPagado;
  
  // Ganancia = (Precio - IVA) × (1 - FactorRenta) - CostoLocal
  const ganancia = (precio - iva) * (1 - FACTOR_RENTA) - costoLocal;
  
  return {
    precio: Math.round(precio * 100) / 100,
    porcentaje: Math.round(porcentaje * 100) / 100,
    ganancia: Math.round(ganancia * 100) / 100,
    iva: Math.round(iva * 100) / 100
  };
}

/**
 * CASO 3: Calcular precio y porcentaje a partir de ganancia
 * Fórmula del código FoxPro original (inversa)
 */
function calcularDesdeGanancia(datos: DatosProducto, ganancia: number): CalculoPrecio {
  const { costoLocal, ivaPagado } = datos;
  
  // Factor de IVA sobre el precio
  const factorIVA = 1 - (1 / (1 + FACTOR_IVA));
  
  // Fórmula inversa:
  // Precio = ((Ganancia + CostoLocal) / (1 - FactorRenta) - IvaPagado) / (1 - factorIVA)
  const precio = ((ganancia + costoLocal) / (1 - FACTOR_RENTA) - ivaPagado) / (1 - factorIVA);
  
  // Porcentaje = ((Precio / CostoLocal) - 1) × 100
  const porcentaje = costoLocal > 0 ? ((precio / costoLocal) - 1) * 100 : 0;
  
  // IVA calculado
  const iva = (precio * factorIVA) - ivaPagado;
  
  return {
    precio: Math.round(precio * 100) / 100,
    porcentaje: Math.round(porcentaje * 100) / 100,
    ganancia: Math.round(ganancia * 100) / 100,
    iva: Math.round(iva * 100) / 100
  };
}

// POST: Calcular precios según el modo seleccionado
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      idprod, 
      modo, // 'porcentaje' | 'precio' | 'ganancia'
      tipoPrecio, // 'general' | 'cliente' | 'mecanico' | 'minorista' | 'mayorista' | 'especial'
      valor // El valor ingresado según el modo
    } = body;

    if (!idprod || !modo || !tipoPrecio || valor === undefined) {
      return NextResponse.json({ 
        error: 'Se requieren idprod, modo, tipoPrecio y valor' 
      }, { status: 400 });
    }

    if (!TIPOS_PRECIO.includes(tipoPrecio)) {
      return NextResponse.json({ 
        error: `Tipo de precio inválido. Debe ser uno de: ${TIPOS_PRECIO.join(', ')}` 
      }, { status: 400 });
    }

    const connection = await connectDB();

    // Obtener datos del producto desde la tabla costos
    const [productData]: any = await connection.execute(`
      SELECT 
        c.costo,
        COALESCE(c.costo_local, c.costo) as costo_local,
        COALESCE(c.iva_pagado, 0) as iva_pagado
      FROM costos c
      WHERE c.idprod = ?
    `, [idprod]);

    if (productData.length === 0) {
      await connection.end();
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    const costo = parseFloat(productData[0].costo) || 0;
    const costoLocalDB = parseFloat(productData[0].costo_local) || 0;
    
    // Si costo_local es 0 o no existe, usar el costo normal
    const datos: DatosProducto = {
      costoLocal: costoLocalDB > 0 ? costoLocalDB : costo,
      costo: costo,
      ivaPagado: parseFloat(productData[0].iva_pagado) || 0
    };
    
    console.log('📊 Datos del producto:', datos);

    let resultado: CalculoPrecio;

    switch (modo) {
      case 'porcentaje':
        resultado = calcularDesdePorcentaje(datos, parseFloat(valor));
        break;
      case 'precio':
        resultado = calcularDesdePrecio(datos, parseFloat(valor));
        break;
      case 'ganancia':
        resultado = calcularDesdeGanancia(datos, parseFloat(valor));
        break;
      default:
        await connection.end();
        return NextResponse.json({ 
          error: 'Modo inválido. Debe ser: porcentaje, precio o ganancia' 
        }, { status: 400 });
    }

    await connection.end();

    return NextResponse.json({
      success: true,
      datos: {
        costoLocal: datos.costoLocal,
        costo: datos.costo,
        ivaPagado: datos.ivaPagado
      },
      resultado,
      factores: {
        iva: FACTOR_IVA,
        renta: FACTOR_RENTA
      }
    });

  } catch (error: any) {
    console.error('Error en cálculo de precios:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// PUT: Guardar los precios calculados
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { 
      idprod, 
      precios, // Array de { tipoPrecio, precio, porcentaje, ganancia }
      razon // Razón del ajuste
    } = body;

    if (!idprod || !precios || !Array.isArray(precios)) {
      return NextResponse.json({ 
        error: 'Se requieren idprod y precios (array)' 
      }, { status: 400 });
    }

    const connection = await connectDB();

    // Verificar que el producto existe
    const [productExists]: any = await connection.execute(
      'SELECT idprod FROM productos WHERE idprod = ?',
      [idprod]
    );

    if (productExists.length === 0) {
      await connection.end();
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    // Obtener precios actuales para el historial
    const [preciosActuales]: any = await connection.execute(
      'SELECT * FROM precios WHERE idprod = ?',
      [idprod]
    );

    // Construir la consulta de actualización
    const updateFields: string[] = [];
    const updateValues: any[] = [];

    // Mapeo de tipos de precio a números (para los campos precio1, precio2, etc.)
    const tipoToNum: Record<string, number> = {
      'general': 1,
      'cliente': 2,
      'mecanico': 3,
      'minorista': 4,
      'mayorista': 5,
      'especial': 6
    };

    // Preparar datos para el historial (UN solo registro con todos los precios)
    console.log('📊 Precios actuales de BD:', preciosActuales[0]);
    
    const historialData: Record<string, any> = {
      precio1_anterior: parseFloat(preciosActuales[0]?.precio_general) || 0,
      precio2_anterior: parseFloat(preciosActuales[0]?.precio_cliente) || 0,
      precio3_anterior: parseFloat(preciosActuales[0]?.precio_mecanico) || 0,
      precio4_anterior: parseFloat(preciosActuales[0]?.precio_minorista) || 0,
      precio5_anterior: parseFloat(preciosActuales[0]?.precio_mayorista) || 0,
      precio6_anterior: parseFloat(preciosActuales[0]?.precio_especial) || 0,
      precio1_nuevo: 0,
      precio2_nuevo: 0,
      precio3_nuevo: 0,
      precio4_nuevo: 0,
      precio5_nuevo: 0,
      precio6_nuevo: 0
    };

    console.log('📊 Precios recibidos para guardar:', precios);

    for (const p of precios) {
      if (!TIPOS_PRECIO.includes(p.tipoPrecio)) continue;

      const precioNum = parseFloat(p.precio) || 0;
      const porcentajeNum = parseFloat(p.porcentaje) || 0;
      const gananciaNum = parseFloat(p.ganancia) || 0;

      // Precio
      updateFields.push(`precio_${p.tipoPrecio} = ?`);
      updateValues.push(precioNum);

      // Porcentaje
      updateFields.push(`porcentaje_${p.tipoPrecio} = ?`);
      updateValues.push(porcentajeNum);

      // Ganancia
      updateFields.push(`ganancia_${p.tipoPrecio} = ?`);
      updateValues.push(gananciaNum);

      // Guardar precio nuevo para el historial
      const num = tipoToNum[p.tipoPrecio];
      if (num) {
        historialData[`precio${num}_nuevo`] = precioNum;
      }
    }
    
    console.log('📊 Datos para historial:', historialData);

    // Insertar UN solo registro en el historial con todos los precios
    await connection.execute(`
      INSERT INTO ajuste_precios 
      (idprod, idusuario, razon_justificacion, 
       precio1_anterior, precio2_anterior, precio3_anterior, precio4_anterior, precio5_anterior, precio6_anterior,
       precio1_nuevo, precio2_nuevo, precio3_nuevo, precio4_nuevo, precio5_nuevo, precio6_nuevo)
      VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      idprod,
      razon || null,
      historialData.precio1_anterior,
      historialData.precio2_anterior,
      historialData.precio3_anterior,
      historialData.precio4_anterior,
      historialData.precio5_anterior,
      historialData.precio6_anterior,
      historialData.precio1_nuevo,
      historialData.precio2_nuevo,
      historialData.precio3_nuevo,
      historialData.precio4_nuevo,
      historialData.precio5_nuevo,
      historialData.precio6_nuevo
    ]);

    if (updateFields.length > 0) {
      updateValues.push(idprod);

      // Verificar si existe registro en precios
      if (preciosActuales.length === 0) {
        // Insertar nuevo registro
        await connection.execute(
          `INSERT INTO precios (idprod) VALUES (?)`,
          [idprod]
        );
      }

      // Actualizar precios
      await connection.execute(
        `UPDATE precios SET ${updateFields.join(', ')} WHERE idprod = ?`,
        updateValues
      );
    }

    await connection.end();

    return NextResponse.json({
      success: true,
      message: 'Precios actualizados correctamente'
    });

  } catch (error: any) {
    console.error('Error guardando precios:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// GET: Obtener precios y datos de un producto
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const idprod = searchParams.get('idprod');

    if (!idprod) {
      return NextResponse.json({ error: 'Se requiere idprod' }, { status: 400 });
    }

    const connection = await connectDB();

    // Primero verificar si existe la columna imagen_principal
    const [cols]: any = await connection.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'productos' AND TABLE_SCHEMA = DATABASE()
      AND COLUMN_NAME IN ('imagen_principal', 'codigo_barras')
    `);
    const colNames = cols.map((c: any) => c.COLUMN_NAME);
    const hasImagen = colNames.includes('imagen_principal');
    const hasCodigoBarras = colNames.includes('codigo_barras');

    const [data]: any = await connection.execute(`
      SELECT 
        p.idprod,
        p.nombre,
        ${hasCodigoBarras ? 'p.codigo_barras,' : "'' as codigo_barras,"}
        (SELECT imagen_url FROM producto_imagenes WHERE idprod = p.idprod ORDER BY es_principal DESC, orden ASC LIMIT 1) as imagen_principal,
        c.costo,
        COALESCE(c.costo_local, c.costo) as costo_local,
        COALESCE(c.iva_pagado, 0) as iva_pagado,
        COALESCE(p.stock_contable, 0) as stock_contable,
        COALESCE(p.stock_fisico, 0) as stock_fisico,
        p.OE,
        p.marca,
        p.idprodprov,
        p.codigo_jerarquico,
        cn.nombre as categoria_nueva_nombre,
        pr.precio_general,
        pr.precio_cliente,
        pr.precio_mecanico,
        pr.precio_minorista,
        pr.precio_mayorista,
        pr.precio_especial,
        COALESCE(pr.porcentaje_general, 0) as porcentaje_general,
        COALESCE(pr.porcentaje_cliente, 0) as porcentaje_cliente,
        COALESCE(pr.porcentaje_mecanico, 0) as porcentaje_mecanico,
        COALESCE(pr.porcentaje_minorista, 0) as porcentaje_minorista,
        COALESCE(pr.porcentaje_mayorista, 0) as porcentaje_mayorista,
        COALESCE(pr.porcentaje_especial, 0) as porcentaje_especial,
        COALESCE(pr.ganancia_general, 0) as ganancia_general,
        COALESCE(pr.ganancia_cliente, 0) as ganancia_cliente,
        COALESCE(pr.ganancia_mecanico, 0) as ganancia_mecanico,
        COALESCE(pr.ganancia_minorista, 0) as ganancia_minorista,
        COALESCE(pr.ganancia_mayorista, 0) as ganancia_mayorista,
        COALESCE(pr.ganancia_especial, 0) as ganancia_especial
      FROM productos p
      LEFT JOIN costos c ON p.idprod = c.idprod
      LEFT JOIN precios pr ON p.idprod = pr.idprod
      LEFT JOIN categorias_nuevo cn ON p.idcategoria_nuevo = cn.idcategoria
      WHERE p.idprod = ?
    `, [idprod]);

    await connection.end();

    if (data.length === 0) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      producto: data[0],
      factores: {
        iva: FACTOR_IVA,
        renta: FACTOR_RENTA
      }
    });

  } catch (error: any) {
    console.error('Error obteniendo precios:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
