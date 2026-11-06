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

/** CAT-013 Municipio (división territorial de 2024), agrupado por código de departamento. */
export const MUNICIPIOS: Record<string, { codigo: string; nombre: string }[]> = {
  '01': [
    { codigo: '13', nombre: 'Ahuachapán Norte' },
    { codigo: '14', nombre: 'Ahuachapán Centro' },
    { codigo: '15', nombre: 'Ahuachapán Sur' },
  ],
  '02': [
    { codigo: '14', nombre: 'Santa Ana Norte' },
    { codigo: '15', nombre: 'Santa Ana Centro' },
    { codigo: '16', nombre: 'Santa Ana Este' },
    { codigo: '17', nombre: 'Santa Ana Oeste' },
  ],
  '03': [
    { codigo: '17', nombre: 'Sonsonate Norte' },
    { codigo: '18', nombre: 'Sonsonate Centro' },
    { codigo: '19', nombre: 'Sonsonate Este' },
    { codigo: '20', nombre: 'Sonsonate Oeste' },
  ],
  '04': [
    { codigo: '34', nombre: 'Chalatenango Norte' },
    { codigo: '35', nombre: 'Chalatenango Centro' },
    { codigo: '36', nombre: 'Chalatenango Sur' },
  ],
  '05': [
    { codigo: '23', nombre: 'La Libertad Norte' },
    { codigo: '24', nombre: 'La Libertad Centro' },
    { codigo: '25', nombre: 'La Libertad Oeste' },
    { codigo: '26', nombre: 'La Libertad Este' },
    { codigo: '27', nombre: 'La Libertad Costa' },
    { codigo: '28', nombre: 'La Libertad Sur' },
  ],
  '06': [
    { codigo: '20', nombre: 'San Salvador Norte' },
    { codigo: '21', nombre: 'San Salvador Oeste' },
    { codigo: '22', nombre: 'San Salvador Este' },
    { codigo: '23', nombre: 'San Salvador Centro' },
    { codigo: '24', nombre: 'San Salvador Sur' },
  ],
  '07': [
    { codigo: '17', nombre: 'Cuscatlán Norte' },
    { codigo: '18', nombre: 'Cuscatlán Sur' },
  ],
  '08': [
    { codigo: '23', nombre: 'La Paz Oeste' },
    { codigo: '24', nombre: 'La Paz Centro' },
    { codigo: '25', nombre: 'La Paz Este' },
  ],
  '09': [
    { codigo: '10', nombre: 'Cabañas Oeste' },
    { codigo: '11', nombre: 'Cabañas Este' },
  ],
  '10': [
    { codigo: '14', nombre: 'San Vicente Norte' },
    { codigo: '15', nombre: 'San Vicente Sur' },
  ],
  '11': [
    { codigo: '24', nombre: 'Usulután Norte' },
    { codigo: '25', nombre: 'Usulután Este' },
    { codigo: '26', nombre: 'Usulután Oeste' },
  ],
  '12': [
    { codigo: '21', nombre: 'San Miguel Norte' },
    { codigo: '22', nombre: 'San Miguel Centro' },
    { codigo: '23', nombre: 'San Miguel Oeste' },
  ],
  '13': [
    { codigo: '27', nombre: 'Morazán Norte' },
    { codigo: '28', nombre: 'Morazán Sur' },
  ],
  '14': [
    { codigo: '19', nombre: 'La Unión Norte' },
    { codigo: '20', nombre: 'La Unión Sur' },
  ],
};

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
