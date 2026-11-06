// Catálogo de permisos y qué rutas protege cada uno. Lo usan el proxy, las API y el sidebar.

export interface PermisoDef {
  clave: string;
  modulo: string;
  etiqueta: string;
}

export const MODULOS_PERMISO = [
  'Compras',
  'Inventario',
  'Precios',
  'Costos',
  'Taller',
  'Catálogos',
  'Usuarios',
  'Configuración',
] as const;

export const PERMISOS: PermisoDef[] = [
  { clave: 'compras.ver', modulo: 'Compras', etiqueta: 'Ver compras, procesos y documentos' },
  { clave: 'compras.editar', modulo: 'Compras', etiqueta: 'Crear y editar borradores' },
  { clave: 'compras.registrar', modulo: 'Compras', etiqueta: 'Registrar compras y aplicar retaceo' },
  { clave: 'compras.reabrir', modulo: 'Compras', etiqueta: 'Reabrir retaceo aplicado' },
  { clave: 'hacienda.emitir', modulo: 'Compras', etiqueta: 'Emitir e invalidar facturas de sujeto excluido' },
  { clave: 'inventario.ver', modulo: 'Inventario', etiqueta: 'Ver productos' },
  { clave: 'inventario.editar', modulo: 'Inventario', etiqueta: 'Crear, editar e importar productos' },
  { clave: 'precios.ver', modulo: 'Precios', etiqueta: 'Ver precios e historial' },
  { clave: 'precios.editar', modulo: 'Precios', etiqueta: 'Ajustar precios' },
  { clave: 'costos.ver', modulo: 'Costos', etiqueta: 'Ver costos' },
  { clave: 'costos.editar', modulo: 'Costos', etiqueta: 'Editar e importar costos' },
  { clave: 'taller.ver', modulo: 'Taller', etiqueta: 'Ver vehículos' },
  { clave: 'taller.editar', modulo: 'Taller', etiqueta: 'Editar vehículos, partes y recordatorios' },
  { clave: 'catalogos.ver', modulo: 'Catálogos', etiqueta: 'Ver proveedores, clientes, empleados y catálogo contable' },
  { clave: 'catalogos.editar', modulo: 'Catálogos', etiqueta: 'Editar catálogos' },
  { clave: 'usuarios.ver', modulo: 'Usuarios', etiqueta: 'Ver usuarios y roles' },
  { clave: 'usuarios.editar', modulo: 'Usuarios', etiqueta: 'Crear usuarios y editar roles' },
  { clave: 'configuracion.ver', modulo: 'Configuración', etiqueta: 'Ver datos de la empresa' },
  { clave: 'configuracion.editar', modulo: 'Configuración', etiqueta: 'Editar datos de la empresa y Hacienda' },
];

export const CLAVES_PERMISO = new Set(PERMISOS.map((p) => p.clave));

interface Regla {
  prefijo: string;
  /** Permiso para GET; null = basta con tener sesión. */
  ver: string | null;
  /** Permiso para POST, PUT, PATCH y DELETE. */
  editar: string;
}

// El primer prefijo que coincide gana: los más específicos van antes.
const REGLAS_API: Regla[] = [
  { prefijo: '/api/usuarios', ver: 'usuarios.ver', editar: 'usuarios.editar' },
  { prefijo: '/api/roles', ver: 'usuarios.ver', editar: 'usuarios.editar' },
  { prefijo: '/api/empresa', ver: null, editar: 'configuracion.editar' },
  { prefijo: '/api/configuracion-sistema', ver: null, editar: 'configuracion.editar' },
  { prefijo: '/api/costos', ver: 'costos.ver', editar: 'costos.editar' },
  { prefijo: '/api/importar-costos', ver: 'costos.ver', editar: 'costos.editar' },
  { prefijo: '/api/ajuste-precios', ver: 'precios.ver', editar: 'precios.editar' },
  { prefijo: '/api/ajustes-inventario', ver: 'inventario.ver', editar: 'inventario.editar' },
  { prefijo: '/api/productos/edicion-masiva', ver: null, editar: 'inventario.editar' },
  { prefijo: '/api/productos', ver: null, editar: 'inventario.editar' },
  { prefijo: '/api/categorias-jerarquia', ver: null, editar: 'inventario.editar' },
  { prefijo: '/api/importar-productos', ver: 'inventario.editar', editar: 'inventario.editar' },
  { prefijo: '/api/exportar-productos', ver: 'inventario.ver', editar: 'inventario.ver' },
  { prefijo: '/api/historial-producto', ver: null, editar: 'inventario.editar' },
  { prefijo: '/api/sujeto-excluido', ver: 'compras.ver', editar: 'hacienda.emitir' },
  { prefijo: '/api/libro-compras', ver: 'compras.ver', editar: 'compras.editar' },
  { prefijo: '/api/compras', ver: 'compras.ver', editar: 'compras.editar' },
  { prefijo: '/api/compras-detalle', ver: 'compras.ver', editar: 'compras.editar' },
  { prefijo: '/api/compras-documentos-rel', ver: 'compras.ver', editar: 'compras.editar' },
  { prefijo: '/api/compras-nota', ver: 'compras.ver', editar: 'compras.editar' },
  { prefijo: '/api/compras-pagos', ver: 'compras.ver', editar: 'compras.editar' },
  { prefijo: '/api/documentos-compras', ver: 'compras.ver', editar: 'compras.editar' },
  { prefijo: '/api/procesos', ver: 'compras.ver', editar: 'compras.editar' },
  { prefijo: '/api/productos-temporales', ver: null, editar: 'compras.editar' },
  { prefijo: '/api/proveedores', ver: null, editar: 'catalogos.editar' },
  { prefijo: '/api/catalogo-contable', ver: null, editar: 'catalogos.editar' },
  { prefijo: '/api/clientes', ver: null, editar: 'catalogos.editar' },
  { prefijo: '/api/empleados', ver: null, editar: 'catalogos.editar' },
  { prefijo: '/api/vehiculos', ver: 'taller.ver', editar: 'taller.editar' },
  { prefijo: '/api/vehiculo-partes', ver: 'taller.ver', editar: 'taller.editar' },
  { prefijo: '/api/estado-partes', ver: null, editar: 'taller.editar' },
  { prefijo: '/api/recordatorios', ver: 'taller.ver', editar: 'taller.editar' },
  { prefijo: '/api/sistemas-vehiculo', ver: null, editar: 'taller.editar' },
  { prefijo: '/api/ordenes-trabajo', ver: 'taller.ver', editar: 'taller.editar' },
];

const REGLAS_PAGINA: { prefijo: string; permiso: string }[] = [
  { prefijo: '/dashboard/configuracion/usuarios', permiso: 'usuarios.ver' },
  { prefijo: '/dashboard/configuracion/empresa', permiso: 'configuracion.ver' },
  { prefijo: '/dashboard/configuracion/sistema', permiso: 'configuracion.ver' },
  { prefijo: '/dashboard/compras/proveedores', permiso: 'catalogos.ver' },
  { prefijo: '/dashboard/compras/catalogo-contable', permiso: 'catalogos.ver' },
  { prefijo: '/dashboard/compras', permiso: 'compras.ver' },
  { prefijo: '/dashboard/inventario/ajuste-precios', permiso: 'precios.ver' },
  { prefijo: '/dashboard/inventario/costos', permiso: 'costos.ver' },
  { prefijo: '/dashboard/inventario/importar-costos', permiso: 'costos.editar' },
  { prefijo: '/dashboard/inventario/importar', permiso: 'inventario.editar' },
  { prefijo: '/dashboard/inventario/ajuste-stock', permiso: 'inventario.editar' },
  { prefijo: '/dashboard/inventario/nuevo', permiso: 'inventario.editar' },
  { prefijo: '/dashboard/inventario/editar-producto', permiso: 'inventario.editar' },
  { prefijo: '/dashboard/inventario', permiso: 'inventario.ver' },
  { prefijo: '/dashboard/taller/clientes', permiso: 'catalogos.ver' },
  { prefijo: '/dashboard/taller/empleados', permiso: 'catalogos.ver' },
  { prefijo: '/dashboard/taller', permiso: 'taller.ver' },
];

function coincide(ruta: string, prefijo: string) {
  return ruta === prefijo || ruta.startsWith(`${prefijo}/`) || ruta.startsWith(`${prefijo}?`);
}

/** Permiso que exige una llamada a la API; null si basta con la sesión. */
export function permisoApi(ruta: string, metodo: string): string | null {
  const regla = REGLAS_API.find((r) => coincide(ruta, r.prefijo));
  if (!regla) return null;
  return metodo === 'GET' || metodo === 'HEAD' ? regla.ver : regla.editar;
}

/** Permiso que exige una pantalla del dashboard; null si basta con la sesión. */
export function permisoPagina(ruta: string): string | null {
  return REGLAS_PAGINA.find((r) => coincide(ruta, r.prefijo))?.permiso ?? null;
}

export function tienePermiso(permisos: readonly string[] | Set<string>, clave: string, esAdmin = false) {
  if (esAdmin) return true;
  return permisos instanceof Set ? permisos.has(clave) : permisos.includes(clave);
}
