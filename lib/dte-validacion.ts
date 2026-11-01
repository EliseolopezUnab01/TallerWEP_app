// Validaciones de un DTE recibido (compras). Formatos del esquema MH: identificacion.numeroControl,
// codigoGeneracion y selloRecibido. Devuelven textos para el usuario.

import { soloDigitos } from '@/lib/empresa';

/** DTE-<tipo>-<8 alfanuméricos: código de establecimiento y punto de venta>-<15 dígitos>. */
export const PATRON_NUMERO_CONTROL = /^DTE-(\d{2})-[A-Z0-9]{8}-\d{15}$/;
/** UUID v4 en mayúsculas, como lo genera el emisor. */
export const PATRON_CODIGO_GENERACION = /^[A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12}$/;
/** El sello de recepción de Hacienda tiene 40 caracteres alfanuméricos. */
export const PATRON_SELLO = /^[A-Za-z0-9]{40}$/;

export interface IdentificacionDte {
  tipo_dte: string | null;
  numero_control: string | null;
  codigo_generacion: string | null;
  sello_recepcion: string | null;
}

export interface ResultadoValidacion {
  errores: string[];
  avisos: string[];
}

/** Errores bloquean el registro; el sello solo avisa (un DTE en contingencia puede no traerlo aún). */
export function validarFormatoDte(d: IdentificacionDte): ResultadoValidacion {
  const errores: string[] = [];
  const avisos: string[] = [];
  if (d.numero_control) {
    const m = d.numero_control.match(PATRON_NUMERO_CONTROL);
    if (!m) errores.push('El número de control no tiene el formato DTE-00-XXXXXXXX-000000000000000');
    else if (d.tipo_dte && m[1] !== d.tipo_dte) {
      errores.push(`El número de control es de un DTE ${m[1]} y el documento es ${d.tipo_dte}`);
    }
  }
  if (d.codigo_generacion && !PATRON_CODIGO_GENERACION.test(d.codigo_generacion)) {
    errores.push('El código de generación debe ser un UUID en mayúsculas (36 caracteres)');
  }
  if (d.sello_recepcion && !PATRON_SELLO.test(d.sello_recepcion)) {
    avisos.push('El sello de recepción no tiene los 40 caracteres de Hacienda; revíselo');
  } else if (!d.sello_recepcion && d.codigo_generacion) {
    avisos.push('El DTE no trae sello de recepción de Hacienda');
  }
  return { errores, avisos };
}

/**
 * El receptor del DTE debe ser la empresa. Con los datos de la empresa configurados es un error;
 * sin ellos solo se avisa para no frenar la operación mientras se llenan.
 */
export function validarReceptor(
  empresa: { nit: string | null; nrc: string | null; nombre?: string } | null,
  receptor: { nit: string | null; nrc: string | null; nombre?: string }
): ResultadoValidacion {
  const nitEmpresa = soloDigitos(empresa?.nit);
  const nrcEmpresa = soloDigitos(empresa?.nrc);
  const nitDte = soloDigitos(receptor.nit);
  const nrcDte = soloDigitos(receptor.nrc);
  if (!nitEmpresa && !nrcEmpresa) {
    return {
      errores: [],
      avisos: ['Configure el NIT y NRC de la empresa para validar que el DTE fue emitido a su nombre'],
    };
  }
  if (!nitDte && !nrcDte) {
    return { errores: [], avisos: ['El DTE no identifica al receptor (NIT o NRC)'] };
  }
  const coincide = (nitEmpresa && nitDte === nitEmpresa) || (nrcEmpresa && nrcDte === nrcEmpresa);
  if (coincide) return { errores: [], avisos: [] };
  return {
    errores: [
      `El DTE fue emitido a ${receptor.nombre || 'otro receptor'} (NIT ${receptor.nit || '—'}, NRC ${receptor.nrc || '—'}), no a la empresa`,
    ],
    avisos: [],
  };
}
