import type { Connection, RowDataPacket } from 'mysql2/promise';
import { limpiar } from '@/lib/compras-detalle-db';
import { ESTADOS_TEXTO, MOMENTOS_ESTADO } from '@/lib/taller-constantes';

export * from '@/lib/taller-constantes';

type TipoCampo = 'texto' | 'mayus' | 'entero' | 'decimal' | 'fecha' | 'bool' | readonly string[];
export type DefinicionCampos = Record<string, TipoCampo>;

export const CAMPOS_CLIENTE: DefinicionCampos = {
  codigo: 'mayus',
  nombre: 'texto',
  tipo: ['PERSONA', 'EMPRESA'],
  dui: 'texto',
  nit: 'texto',
  nrc: 'texto',
  giro: 'texto',
  telefono: 'texto',
  telefono2: 'texto',
  email: 'texto',
  direccion: 'texto',
  municipio: 'texto',
  departamento: 'texto',
  limite_credito: 'decimal',
  dias_credito: 'entero',
  descuento_general: 'decimal',
  activo: 'bool',
  notas: 'texto',
};

export const CAMPOS_EMPLEADO: DefinicionCampos = {
  codigo: 'mayus',
  nombre: 'texto',
  apellido: 'texto',
  fecha_nacimiento: 'fecha',
  dui: 'texto',
  nit: 'texto',
  isss: 'texto',
  afp: 'texto',
  nup: 'texto',
  telefono: 'texto',
  telefono2: 'texto',
  email: 'texto',
  direccion: 'texto',
  municipio: 'texto',
  departamento_residencia: 'texto',
  puesto: 'texto',
  departamento: 'texto',
  fecha_ingreso: 'fecha',
  fecha_baja: 'fecha',
  salario: 'decimal',
  tipo_contrato: ['PLANTA', 'TEMPORAL', 'HONORARIOS'],
  activo: 'bool',
  notas: 'texto',
};

export const CAMPOS_VEHICULO: DefinicionCampos = {
  cliente_id: 'entero',
  placa: 'mayus',
  anio_placa: 'entero',
  vin: 'mayus',
  marca: 'mayus',
  modelo: 'mayus',
  anio_modelo: 'entero',
  tipo: 'mayus',
  clase: 'mayus',
  ejes: 'entero',
  tara: 'decimal',
  unidad_capacidad: 'mayus',
  capacidad_carga: 'decimal',
  capacidad_maxima: 'decimal',
  traccion: 'mayus',
  dominio: 'mayus',
  en_calidad: 'mayus',
  propietario_nombre: 'mayus',
  propietario_dui: 'texto',
  propietario_domicilio: 'texto',
  tarjeta_emision: 'fecha',
  tarjeta_vencimiento: 'fecha',
  numero_tarjeta: 'mayus',
  color: 'mayus',
  numero_motor: 'mayus',
  numero_chasis: 'mayus',
  codigo_serie: 'mayus',
  odometro_actual: 'entero',
  unidad_odometro: ['KM', 'MILLAS'],
  activo: 'bool',
  notas: 'texto',
};

export const CAMPOS_PARTE: DefinicionCampos = {
  idsistema: 'entero',
  nombre_parte: 'mayus',
  posicion: 'mayus',
  idprod: 'entero',
  marca: 'mayus',
  referencia: 'mayus',
  numero_serie: 'mayus',
  fecha_instalacion: 'fecha',
  km_instalacion: 'entero',
  comentario: 'texto',
};

export const CAMPOS_ESTADO: DefinicionCampos = {
  idorden: 'entero',
  idempleado: 'entero',
  momento: MOMENTOS_ESTADO,
  estado_visual: 'entero',
  estado_texto: ESTADOS_TEXTO,
  kilometraje: 'entero',
  fecha: 'fecha',
  comentario: 'texto',
};

export const CAMPOS_RECORDATORIO: DefinicionCampos = {
  idparte: 'entero',
  idsistema: 'entero',
  descripcion: 'texto',
  intervalo_dias: 'entero',
  intervalo_km: 'entero',
  ultimo_fecha: 'fecha',
  ultimo_km: 'entero',
  activo: 'bool',
  comentario: 'texto',
};

function normalizar(valor: unknown, tipo: TipoCampo): string | number | null {
  if (Array.isArray(tipo)) {
    const texto = limpiar(valor)?.toUpperCase() ?? null;
    return texto && tipo.includes(texto) ? texto : null;
  }
  if (tipo === 'bool') return valor === true || valor === 1 || valor === '1' || valor === 'true' ? 1 : 0;
  const texto = limpiar(valor);
  if (texto === null) return null;
  switch (tipo) {
    case 'mayus':
      return texto.toUpperCase();
    case 'entero': {
      const n = Math.trunc(Number(texto));
      return Number.isFinite(n) ? n : null;
    }
    case 'decimal': {
      const n = Number(texto);
      return Number.isFinite(n) ? n : null;
    }
    case 'fecha':
      return /^\d{4}-\d{2}-\d{2}/.test(texto) ? texto.slice(0, 10) : null;
    default:
      return texto;
  }
}

/** Toma del body solo los campos conocidos que vienen definidos, ya normalizados. */
export function extraerCampos(body: Record<string, unknown>, definicion: DefinicionCampos) {
  const datos: Record<string, string | number | null> = {};
  for (const [campo, tipo] of Object.entries(definicion)) {
    if (body[campo] !== undefined) datos[campo] = normalizar(body[campo], tipo);
  }
  return datos;
}

export async function insertarFila(
  connection: Connection,
  tabla: string,
  datos: Record<string, string | number | null>
) {
  const campos = Object.keys(datos);
  const [r] = await connection.execute(
    `INSERT INTO ${tabla} (${campos.join(', ')}) VALUES (${campos.map(() => '?').join(', ')})`,
    campos.map((c) => datos[c])
  );
  return (r as { insertId: number }).insertId;
}

export async function actualizarFila(
  connection: Connection,
  tabla: string,
  llave: string,
  id: number,
  datos: Record<string, string | number | null>
) {
  const campos = Object.keys(datos);
  if (campos.length === 0) return;
  await connection.execute(
    `UPDATE ${tabla} SET ${campos.map((c) => `${c} = ?`).join(', ')} WHERE ${llave} = ?`,
    [...campos.map((c) => datos[c]), id]
  );
}

/** Código simple por prefijo (CLI-00001, EMP-00001) para clientes y empleados. */
export async function codigoSiguiente(connection: Connection, tabla: 'clientes' | 'empleados', prefijo: string) {
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT MAX(CAST(SUBSTRING(codigo, ?) AS UNSIGNED)) AS n FROM ${tabla} WHERE codigo REGEXP ?`,
    [prefijo.length + 2, `^${prefijo}-[0-9]+$`]
  );
  return `${prefijo}-${String(Number(rows[0].n ?? 0) + 1).padStart(5, '0')}`;
}

/** El odómetro del vehículo solo avanza: un registro con más km lo actualiza. */
export async function avanzarOdometro(connection: Connection, idvehiculo: number, km: number | null | undefined) {
  if (!km || km <= 0) return;
  await connection.execute(
    'UPDATE vehiculos SET odometro_actual = ? WHERE id = ? AND (odometro_actual IS NULL OR odometro_actual < ?)',
    [km, idvehiculo, km]
  );
}

export function errorDuplicado(error: unknown) {
  return (error as { code?: string }).code === 'ER_DUP_ENTRY';
}
