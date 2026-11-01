import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { CAMPOS_EMPRESA, leerEmpresa, soloDigitos } from '@/lib/empresa';

const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

const ENUMS: Record<string, string[]> = {
  categoria_contribuyente: ['GRAN_CONTRIBUYENTE', 'CONTRIBUYENTE', 'PEQUENO', 'OTRO'],
  descuento_modo: ['INFORMATIVO', 'COSTO'],
  dte_ambiente: ['00', '01'],
  tipo_establecimiento: ['01', '02', '04', '07', '20'],
};

function credencialesHacienda() {
  return {
    api_clave: Boolean(process.env.DTE_API_CLAVE),
    cert_clave: Boolean(process.env.DTE_CERT_CLAVE),
    firmador_url: process.env.DTE_FIRMADOR_URL || 'http://localhost:8113/firmardocumento/',
  };
}

export async function GET() {
  const connection = await connectDB();
  try {
    return json({ success: true, empresa: await leerEmpresa(connection), hacienda: credencialesHacienda() });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  } finally {
    await connection.end();
  }
}

export async function PUT(request: NextRequest) {
  const body = (await request.json()) as Record<string, unknown>;
  const datos: Record<string, string | number | null> = {};
  for (const campo of CAMPOS_EMPRESA) {
    if (body[campo] === undefined) continue;
    const valor = body[campo];
    datos[campo] = valor === null || valor === '' ? null : typeof valor === 'boolean' ? (valor ? 1 : 0) : String(valor).trim();
  }

  if (datos.nombre !== undefined && !datos.nombre) return json({ error: 'La razón social es obligatoria' }, 400);
  for (const campo of ['nit', 'nrc', 'responsable_num_doc', 'dte_usuario_api'] as const) {
    if (datos[campo]) datos[campo] = soloDigitos(datos[campo]) || null;
  }
  if (datos.nit && ![9, 14].includes(String(datos.nit).length)) return json({ error: 'El NIT debe tener 14 dígitos (o 9 si es el DUI homologado)' }, 400);
  if (datos.nrc && String(datos.nrc).length > 8) return json({ error: 'El NRC tiene como máximo 8 dígitos' }, 400);
  for (const [campo, permitidos] of Object.entries(ENUMS)) {
    if (datos[campo] != null && !permitidos.includes(String(datos[campo]))) return json({ error: `Valor no válido en ${campo}` }, 400);
  }
  for (const campo of ['departamento', 'municipio'] as const) {
    if (datos[campo] && !/^\d{2}$/.test(String(datos[campo]))) return json({ error: `${campo} debe ser un código de 2 dígitos` }, 400);
  }
  if (datos.prefijo_control != null) {
    const p = String(datos.prefijo_control).toUpperCase();
    if (!/^[A-Z0-9]{8}$/.test(p)) return json({ error: 'El prefijo del número de control lleva 8 letras o números (p. ej. M001P001)' }, 400);
    datos.prefijo_control = p;
  }
  if (datos.agente_retencion != null) datos.agente_retencion = Number(datos.agente_retencion) ? 1 : 0;

  const campos = Object.keys(datos);
  if (campos.length === 0) return json({ success: true, mensaje: 'Sin cambios' });

  const connection = await connectDB();
  try {
    const actual = await leerEmpresa(connection);
    await connection.execute(`UPDATE empresa SET ${campos.map((c) => `${c} = ?`).join(', ')} WHERE idempresa = ?`, [
      ...campos.map((c) => datos[c]),
      actual.idempresa,
    ]);
    return json({ success: true, mensaje: 'Datos de la empresa guardados', empresa: await leerEmpresa(connection) });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  } finally {
    await connection.end();
  }
}
