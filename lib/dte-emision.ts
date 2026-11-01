// Emisión del DTE tipo 14 (factura de sujeto excluido) según el esquema fe-fse-v1.
// La empresa es el emisor (quien compra). El vendedor va en sujetoExcluido. No lleva IVA.
// Firma con el firmador oficial en local y envía a la API de Hacienda del ambiente de la empresa.

import { randomUUID } from 'crypto';
import { numeroALetras, redondear2 } from '@/lib/compras-resumen';
import { r8 } from '@/lib/decimales';
import { soloDigitos, type Empresa } from '@/lib/empresa';

export const TASA_RENTA_FSE = 0.1;

export interface LineaFse {
  num_item: number;
  tipo_item: number;
  codigo: string | null;
  descripcion: string;
  cantidad: number;
  uni_medida: number;
  precio_uni: number;
  monto_descu: number;
}

export interface SujetoFse {
  tipo_documento: string;
  num_documento: string;
  nombre: string;
  cod_actividad: string | null;
  desc_actividad: string | null;
  departamento: string;
  municipio: string;
  direccion: string;
  telefono: string | null;
  correo: string | null;
}

export interface EncabezadoFse {
  numero_control: string;
  codigo_generacion: string;
  fecha_emision: string;
  hora_emision: string;
  condicion_operacion: number;
  codigo_forma_pago: string;
  retencion_renta: number;
  observaciones: string | null;
}

const URLS = {
  '00': {
    auth: 'https://apitest.dtes.mh.gob.sv/seguridad/auth',
    recepcion: 'https://apitest.dtes.mh.gob.sv/fesv/recepciondte',
    anulacion: 'https://apitest.dtes.mh.gob.sv/fesv/anulardte',
  },
  '01': {
    auth: 'https://api.dtes.mh.gob.sv/seguridad/auth',
    recepcion: 'https://api.dtes.mh.gob.sv/fesv/recepciondte',
    anulacion: 'https://api.dtes.mh.gob.sv/fesv/anulardte',
  },
} as const;

export type AmbienteDte = keyof typeof URLS;

/** 10 % del subtotal si algún ítem es un servicio; 0 si todo es mercadería. El usuario puede cambiarlo. */
export function sugerirRenta(lineas: { tipo_item: number; compra: number }[]): number {
  if (!lineas.some((l) => Number(l.tipo_item) === 2)) return 0;
  const base = lineas.reduce((s, l) => s + Number(l.compra), 0);
  return redondear2(base * TASA_RENTA_FSE);
}

export function compraDeLinea(cantidad: number, precio: number, descuento: number): number {
  return r8(Math.max(0, cantidad * precio - descuento));
}

function nulo(valor: string | null | undefined): string | null {
  const t = valor?.trim();
  return t ? t : null;
}

function codigoMh(valor: string | null | undefined, largo: number): string | null {
  const t = valor?.trim().toUpperCase() ?? '';
  return new RegExp(`^[A-Z0-9]{${largo}}$`).test(t) ? t : null;
}

/** Lo que le falta a la empresa para poder firmar y transmitir. */
export function faltantesEmpresa(empresa: Empresa): string[] {
  const falta: string[] = [];
  if (soloDigitos(empresa.nit).length !== 14) falta.push('NIT de 14 dígitos');
  if (!soloDigitos(empresa.nrc)) falta.push('NRC');
  if (!empresa.nombre) falta.push('nombre');
  if (!/^\d{5,6}$/.test(empresa.cod_actividad ?? '')) falta.push('código de actividad (5 o 6 dígitos)');
  if (!empresa.desc_actividad) falta.push('descripción de la actividad');
  if (!/^\d{2}$/.test(empresa.departamento ?? '')) falta.push('departamento');
  if (!/^\d{2}$/.test(empresa.municipio ?? '')) falta.push('municipio');
  if (!empresa.direccion) falta.push('dirección');
  if (!empresa.telefono) falta.push('teléfono');
  if (!empresa.correo) falta.push('correo');
  if (!/^[A-Z0-9]{8}$/.test(empresa.prefijo_control ?? '')) falta.push('prefijo del número de control (8 caracteres)');
  if (!empresa.dte_usuario_api) falta.push('usuario de la API de Hacienda');
  if (!process.env.DTE_API_CLAVE) falta.push('DTE_API_CLAVE en .env.local');
  if (!process.env.DTE_CERT_CLAVE) falta.push('DTE_CERT_CLAVE en .env.local');
  return falta;
}

export function armarFse(empresa: Empresa, encabezado: EncabezadoFse, sujeto: SujetoFse, lineas: LineaFse[]) {
  const detalle = lineas.map((l) => {
    const cantidad = Number(l.cantidad) || 0;
    const precio = Number(l.precio_uni) || 0;
    const descuento = Number(l.monto_descu) || 0;
    const compra = redondear2(compraDeLinea(cantidad, precio, descuento));
    return {
      numItem: Number(l.num_item),
      tipoItem: Number(l.tipo_item) || 1,
      cantidad: r8(cantidad),
      codigo: nulo(l.codigo),
      uniMedida: Number(l.uni_medida) || 59,
      descripcion: l.descripcion.slice(0, 1000),
      precioUni: r8(precio),
      montoDescu: r8(descuento),
      compra,
    };
  });
  const totalCompra = redondear2(detalle.reduce((s, l) => s + l.compra, 0));
  const totalDescu = redondear2(detalle.reduce((s, l) => s + Number(l.montoDescu), 0));
  const reteRenta = redondear2(encabezado.retencion_renta);
  const totalPagar = redondear2(Math.max(0, totalCompra - reteRenta));
  const nit = soloDigitos(empresa.nit);
  const docSujeto = sujeto.tipo_documento === '13' ? sujeto.num_documento.trim() : soloDigitos(sujeto.num_documento) || sujeto.num_documento.trim();

  const dte = {
    identificacion: {
      version: 1,
      ambiente: empresa.dte_ambiente,
      tipoDte: '14',
      numeroControl: encabezado.numero_control,
      codigoGeneracion: encabezado.codigo_generacion,
      tipoModelo: 1,
      tipoOperacion: 1,
      tipoContingencia: null,
      motivoContin: null,
      fecEmi: encabezado.fecha_emision,
      horEmi: encabezado.hora_emision,
      tipoMoneda: 'USD',
    },
    emisor: {
      nit,
      nrc: soloDigitos(empresa.nrc),
      nombre: empresa.nombre.slice(0, 250),
      codActividad: empresa.cod_actividad,
      descActividad: (empresa.desc_actividad ?? '').slice(0, 150),
      direccion: {
        departamento: empresa.departamento,
        municipio: empresa.municipio,
        complemento: (empresa.direccion ?? '').slice(0, 200),
      },
      telefono: (empresa.telefono ?? '').slice(0, 30),
      correo: empresa.correo,
      codEstableMH: codigoMh(empresa.cod_estable_mh, 4),
      codEstable: nulo(empresa.cod_estable),
      codPuntoVentaMH: codigoMh(empresa.cod_punto_venta_mh, 4),
      codPuntoVenta: nulo(empresa.cod_punto_venta),
    },
    sujetoExcluido: {
      tipoDocumento: sujeto.tipo_documento,
      numDocumento: docSujeto.slice(0, 20),
      nombre: sujeto.nombre.slice(0, 250),
      codActividad: nulo(sujeto.cod_actividad),
      descActividad: nulo(sujeto.desc_actividad)?.slice(0, 150) ?? null,
      direccion: {
        departamento: sujeto.departamento,
        municipio: sujeto.municipio,
        complemento: sujeto.direccion.slice(0, 200),
      },
      telefono: nulo(sujeto.telefono),
      correo: nulo(sujeto.correo),
    },
    cuerpoDocumento: detalle,
    resumen: {
      totalCompra,
      descu: 0,
      totalDescu,
      subTotal: totalCompra,
      ivaRete1: 0,
      reteRenta,
      totalPagar,
      totalLetras: numeroALetras(totalPagar).slice(0, 200),
      condicionOperacion: encabezado.condicion_operacion,
      pagos: [
        {
          codigo: encabezado.codigo_forma_pago,
          montoPago: totalPagar,
          referencia: null,
          plazo: null,
          periodo: null,
        },
      ],
      observaciones: nulo(encabezado.observaciones)?.slice(0, 3000) ?? null,
    },
    apendice: null,
  };
  return { dte, totalCompra, totalDescu, subTotal: totalCompra, totalPagar };
}

export function urlConsulta(ambiente: string, codigoGeneracion: string, fechaEmision: string) {
  const q = new URLSearchParams({ ambiente, codGen: codigoGeneracion, fechaEmi: fechaEmision });
  return `https://admin.factura.gob.sv/consultaPublica?${q}`;
}

export function nuevoCodigoGeneracion() {
  return randomUUID().toUpperCase();
}

export function numeroControlFse(prefijo: string, correlativo15: string) {
  return `DTE-14-${prefijo}-${correlativo15}`;
}

interface CacheToken {
  ambiente: string;
  usuario: string;
  token: string;
  vence: number;
}

let cacheToken: CacheToken | null = null;
const VIDA_TOKEN_MS = 12 * 60 * 60 * 1000;

export async function tokenHacienda(ambiente: AmbienteDte, usuario: string, clave: string): Promise<string> {
  if (cacheToken && cacheToken.ambiente === ambiente && cacheToken.usuario === usuario && cacheToken.vence > Date.now()) {
    return cacheToken.token;
  }
  const res = await fetch(URLS[ambiente].auth, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'TallerWeb' },
    body: new URLSearchParams({ user: usuario, pwd: clave }),
  });
  const data = (await res.json().catch(() => ({}))) as { status?: string; body?: { token?: string }; error?: string };
  const token = data.body?.token;
  if (!res.ok || !token) {
    cacheToken = null;
    throw new Error(data.error || `Hacienda no entregó token (${res.status})`);
  }
  cacheToken = { ambiente, usuario, token, vence: Date.now() + VIDA_TOKEN_MS };
  return token;
}

export function olvidarToken() {
  cacheToken = null;
}

async function firmar(nit: string, dte: unknown): Promise<string> {
  const url = process.env.DTE_FIRMADOR_URL || 'http://localhost:8113/firmardocumento/';
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nit, activo: true, passwordPri: process.env.DTE_CERT_CLAVE, dteJson: dte }),
    });
  } catch {
    throw new Error(`No hay firmador en ${url}. Arranque svfe-api-firmador antes de emitir.`);
  }
  const data = (await res.json().catch(() => ({}))) as { status?: string; body?: unknown; message?: string };
  const firmado = typeof data.body === 'string' ? data.body : null;
  if (!res.ok || !firmado) {
    throw new Error(data.message || `El firmador rechazó el documento (${res.status})`);
  }
  return firmado;
}

export interface RespuestaMh {
  estado: string;
  sello: string | null;
  descripcion: string;
  observaciones: string[];
  crudo: unknown;
}

function leerRespuesta(data: Record<string, unknown>, http: number): RespuestaMh {
  const estado = String(data.estado || '');
  const observaciones = Array.isArray(data.observaciones) ? data.observaciones.map(String) : [];
  return {
    estado,
    sello: data.selloRecibido ? String(data.selloRecibido) : null,
    descripcion: String(data.descripcionMsg || data.mensaje || `Respuesta ${http}`),
    observaciones,
    crudo: data,
  };
}

async function transmitir(url: string, token: string, cuerpo: unknown): Promise<RespuestaMh> {
  const authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authorization, 'User-Agent': 'TallerWeb' },
    body: JSON.stringify(cuerpo),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (res.status === 401) olvidarToken();
  return leerRespuesta(data, res.status);
}

export async function emitirFse(empresa: Empresa, dte: { identificacion: { codigoGeneracion: string } }) {
  const ambiente = empresa.dte_ambiente;
  const token = await tokenHacienda(ambiente, empresa.dte_usuario_api || '', process.env.DTE_API_CLAVE || '');
  const firmado = await firmar(soloDigitos(empresa.nit), dte);
  const respuesta = await transmitir(URLS[ambiente].recepcion, token, {
    ambiente,
    idEnvio: Date.now() % 1_000_000_000,
    version: 1,
    tipoDte: '14',
    documento: firmado,
  });
  return { firmado, respuesta };
}

export interface DatosInvalidacion {
  codigoGeneracion: string;
  sello: string;
  numeroControl: string;
  fechaEmision: string;
  tipoDocumento: string;
  numDocumento: string;
  nombre: string;
  motivo: string;
}

/** Evento de invalidación (esquema v2) firmado y enviado a anulardte. */
export async function invalidarFse(empresa: Empresa, datos: DatosInvalidacion) {
  const ambiente = empresa.dte_ambiente;
  const ahora = new Date();
  const fecha = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/El_Salvador' }).format(ahora);
  const hora = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/El_Salvador', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(ahora);
  const evento = {
    identificacion: {
      version: 2,
      ambiente,
      codigoGeneracion: nuevoCodigoGeneracion(),
      fecAnula: fecha,
      horAnula: hora,
    },
    emisor: {
      nit: soloDigitos(empresa.nit),
      nombre: empresa.nombre.slice(0, 250),
      tipoEstablecimiento: empresa.tipo_establecimiento || '02',
      nomEstablecimiento: (empresa.nombre_comercial || empresa.nombre).slice(0, 150),
      codEstableMH: codigoMh(empresa.cod_estable_mh, 4),
      codEstable: nulo(empresa.cod_estable),
      codPuntoVentaMH: codigoMh(empresa.cod_punto_venta_mh, 4),
      codPuntoVenta: nulo(empresa.cod_punto_venta),
      telefono: (empresa.telefono ?? '').slice(0, 30),
      correo: empresa.correo,
    },
    documento: {
      tipoDte: '14',
      codigoGeneracion: datos.codigoGeneracion,
      selloRecibido: datos.sello,
      numeroControl: datos.numeroControl,
      fecEmi: datos.fechaEmision,
      montoIva: 0,
      codigoGeneracionR: null,
      tipoDocumento: datos.tipoDocumento,
      numDocumento: datos.numDocumento,
      nombre: datos.nombre,
    },
    motivo: {
      tipoAnulacion: 2,
      motivoAnulacion: datos.motivo.slice(0, 250),
      nombreResponsable: (empresa.responsable_nombre || empresa.nombre).slice(0, 100),
      tipDocResponsable: empresa.responsable_tipo_doc || '13',
      numDocResponsable: (empresa.responsable_num_doc || soloDigitos(empresa.nit)).slice(0, 20),
      nombreSolicita: datos.nombre.slice(0, 100),
      tipDocSolicita: datos.tipoDocumento,
      numDocSolicita: datos.numDocumento.slice(0, 20),
    },
  };
  const token = await tokenHacienda(ambiente, empresa.dte_usuario_api || '', process.env.DTE_API_CLAVE || '');
  const firmado = await firmar(soloDigitos(empresa.nit), evento);
  const respuesta = await transmitir(URLS[ambiente].anulacion, token, {
    ambiente,
    idEnvio: Date.now() % 1_000_000_000,
    version: 2,
    tipoDte: '14',
    documento: firmado,
  });
  return { evento, firmado, respuesta };
}
