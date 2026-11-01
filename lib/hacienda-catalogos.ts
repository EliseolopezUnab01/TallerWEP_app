// Catálogos del Sistema de Transmisión DTE (Ministerio de Hacienda) que usa el sistema.

export const DEPARTAMENTOS: { codigo: string; nombre: string }[] = [
  { codigo: '01', nombre: 'Ahuachapán' },
  { codigo: '02', nombre: 'Santa Ana' },
  { codigo: '03', nombre: 'Sonsonate' },
  { codigo: '04', nombre: 'Chalatenango' },
  { codigo: '05', nombre: 'La Libertad' },
  { codigo: '06', nombre: 'San Salvador' },
  { codigo: '07', nombre: 'Cuscatlán' },
  { codigo: '08', nombre: 'La Paz' },
  { codigo: '09', nombre: 'Cabañas' },
  { codigo: '10', nombre: 'San Vicente' },
  { codigo: '11', nombre: 'Usulután' },
  { codigo: '12', nombre: 'San Miguel' },
  { codigo: '13', nombre: 'Morazán' },
  { codigo: '14', nombre: 'La Unión' },
];

/** CAT-022 Tipo de documento de identificación del receptor. */
export const TIPOS_DOCUMENTO_ID: { codigo: string; nombre: string }[] = [
  { codigo: '13', nombre: 'DUI' },
  { codigo: '36', nombre: 'NIT' },
  { codigo: '03', nombre: 'Pasaporte' },
  { codigo: '02', nombre: 'Carnet de residente' },
  { codigo: '37', nombre: 'Otro' },
];

/** CAT-009 Tipo de establecimiento. */
export const TIPOS_ESTABLECIMIENTO: { codigo: string; nombre: string }[] = [
  { codigo: '02', nombre: 'Casa matriz' },
  { codigo: '01', nombre: 'Sucursal / agencia' },
  { codigo: '04', nombre: 'Bodega' },
  { codigo: '07', nombre: 'Predio y/o patio' },
  { codigo: '20', nombre: 'Otro' },
];

/** CAT-011 Tipo de ítem. */
export const TIPOS_ITEM: { codigo: number; nombre: string }[] = [
  { codigo: 1, nombre: 'Bienes' },
  { codigo: 2, nombre: 'Servicios' },
  { codigo: 3, nombre: 'Bienes y servicios' },
];

/** CAT-014 Unidad de medida (las de uso común en el taller). */
export const UNIDADES_MEDIDA: { codigo: number; nombre: string }[] = [
  { codigo: 59, nombre: 'Unidad' },
  { codigo: 58, nombre: 'Par' },
  { codigo: 55, nombre: 'Docena' },
  { codigo: 23, nombre: 'Litro' },
  { codigo: 22, nombre: 'Galón' },
  { codigo: 36, nombre: 'Libra' },
  { codigo: 34, nombre: 'Kilogramo' },
  { codigo: 1, nombre: 'Metro' },
  { codigo: 99, nombre: 'Otra' },
];

/**
 * CAT-017 Forma de pago (catálogo oficial vigente).
 * Se usa para corregir la tabla cat_formas_pago (migración 021).
 */
export const FORMAS_PAGO: { codigo: string; nombre: string }[] = [
  { codigo: '01', nombre: 'Billetes y monedas' },
  { codigo: '02', nombre: 'Tarjeta débito' },
  { codigo: '03', nombre: 'Tarjeta crédito' },
  { codigo: '04', nombre: 'Cheque' },
  { codigo: '05', nombre: 'Transferencia / depósito bancario' },
  { codigo: '08', nombre: 'Dinero electrónico' },
  { codigo: '09', nombre: 'Monedero electrónico' },
  { codigo: '11', nombre: 'Bitcoin' },
  { codigo: '12', nombre: 'Otras criptomonedas' },
  { codigo: '13', nombre: 'Cuentas por pagar del receptor' },
  { codigo: '14', nombre: 'Giro bancario' },
  { codigo: '99', nombre: 'Otros (indicar el medio de pago)' },
];

/** CAT-024 Tipo de invalidación. */
export const TIPOS_INVALIDACION: { codigo: number; nombre: string }[] = [
  { codigo: 1, nombre: 'Error en la información del DTE (requiere documento que lo reemplace)' },
  { codigo: 2, nombre: 'Rescindir la operación realizada' },
  { codigo: 3, nombre: 'Otro' },
];

export const AMBIENTES = { '00': 'Pruebas', '01': 'Producción' } as const;

/** URL base de la API de Hacienda según el ambiente. */
export function urlApiHacienda(ambiente: string) {
  return ambiente === '01' ? 'https://api.dtes.mh.gob.sv' : 'https://apitest.dtes.mh.gob.sv';
}

/** Enlace de consulta pública del DTE (va en el QR de la representación gráfica). */
export function urlConsultaPublica(ambiente: string, codigoGeneracion: string, fechaEmision: string) {
  return `https://admin.factura.gob.sv/consultaPublica?ambiente=${ambiente}&codGen=${codigoGeneracion}&fechaEmi=${fechaEmision}`;
}
