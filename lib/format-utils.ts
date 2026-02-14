/**
 * Utilidades de formateo para el sistema de catálogo
 */

/**
 * Formatea el código jerárquico para mostrar en UI
 * Convierte: 10000000 -> 10-000-000 (Categoría-Grupo-Subgrupo)
 * @param codigo - El código jerárquico del producto
 * @returns Código formateado o '-' si no existe
 */
export function formatCodigoJerarquico(codigo: string | number | null | undefined): string {
  if (!codigo) return '-';
  const str = String(codigo).padStart(8, '0');
  // Formato: XX-XXX-XXX (Categoría-Grupo-Subgrupo)
  return `${str.slice(0, 2)}-${str.slice(2, 5)}-${str.slice(5, 8)}`;
}

/**
 * Obtiene el código de catálogo completo para mostrar al usuario
 * Formato: XXXXXXXXXXN (CategoríaGrupoSubgrupoConsecutivo) - sin guiones ni ceros extra
 * @param producto - Objeto producto con codigo_jerarquico, idprod y opcionalmente consecutivo_catalogo
 * @returns Código de catálogo formateado
 */
export function getCodigoCatalogo(producto: { 
  codigo_jerarquico?: string | number | null; 
  idprod?: number | string;
  consecutivo_catalogo?: number | null;
}): string {
  if (producto.codigo_jerarquico) {
    const str = String(producto.codigo_jerarquico).padStart(8, '0');
    // Formato compacto sin guiones: CategoríaGrupoSubgrupoConsecutivo
    const categoria = str.slice(0, 2);
    const grupo = str.slice(2, 5);
    const subgrupo = str.slice(5, 8);
    // Usar idprod directamente como consecutivo (ignorar consecutivo_catalogo por ahora)
    const idprodNum = typeof producto.idprod === 'string' ? parseInt(producto.idprod, 10) : (producto.idprod || 0);
    return `${categoria}${grupo}${subgrupo}${idprodNum}`;
  }
  return producto.idprod ? `#${producto.idprod}` : '-';
}
