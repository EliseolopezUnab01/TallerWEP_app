'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { 
  LayoutDashboard, 
  Package,
  Plus,
  List,
  Edit,
  FileText,
  LogOut,
  ChevronDown,
  ChevronRight,
  Upload,
  ShoppingCart,
  Truck,
  BookOpen,
  FileInput,
  ClipboardList,
  Ship,
  Wrench,
  Users,
  Car,
  HardHat,
  Tags,
  Calculator,
  FileSpreadsheet,
  Library,
  Settings,
  UserCog,
  Building2,
  FileSignature,
  BookMarked,
  KeyRound,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { ThemeToggle } from './theme-toggle';
import { permisoPagina } from '@/lib/permisos-constantes';
import { cerrarSesion, useSesion } from '@/lib/sesion-cliente';

const RUTAS_CATALOGOS = [
  '/dashboard/compras/proveedores',
  '/dashboard/compras/catalogo-contable',
  '/dashboard/taller/clientes',
  '/dashboard/taller/empleados',
];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [inventarioOpen, setInventarioOpen] = useState(false);
  const [comprasOpen, setComprasOpen] = useState(false);
  const [tallerOpen, setTallerOpen] = useState(false);
  const [catalogosOpen, setCatalogosOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const { puede } = useSesion();

  const isExpanded = !collapsed || hovered || mobileOpen;

  const handleLogout = async () => {
    await cerrarSesion();
    router.push('/');
  };

  useEffect(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    if (saved === 'true') setCollapsed(true);
  }, []);

  useEffect(() => {
    const catalogo = RUTAS_CATALOGOS.some((r) => pathname?.startsWith(r));
    if (catalogo) setCatalogosOpen(true);
    else if (pathname?.startsWith('/dashboard/configuracion')) setConfigOpen(true);
    else if (pathname?.startsWith('/dashboard/inventario')) setInventarioOpen(true);
    else if (pathname?.startsWith('/dashboard/compras')) setComprasOpen(true);
    else if (pathname?.startsWith('/dashboard/taller')) setTallerOpen(true);
  }, [pathname]);

  const persistCollapsed = (next: boolean) => {
    setCollapsed(next);
    localStorage.setItem('sidebar_collapsed', String(next));
  };

  const isActive = (href: string) => {
    if (href === '/dashboard' || href === '/dashboard/configuracion') return pathname === href;
    return pathname === href || pathname?.startsWith(`${href}/`);
  };

  const closeMobile = () => onMobileClose?.();

  const menuCompleto = [
    { 
      icon: LayoutDashboard, 
      label: 'Dashboard', 
      href: '/dashboard',
      type: 'link' as const
    },
    {
      icon: ShoppingCart,
      label: 'Compras',
      href: '#compras',
      type: 'dropdown' as const,
      isOpen: comprasOpen,
      toggle: () => setComprasOpen(!comprasOpen),
      children: [
        { icon: FileInput, label: 'Ingreso de Compras', href: '/dashboard/compras/ingreso' },
        { icon: ClipboardList, label: 'Cotizaciones y Órdenes', href: '/dashboard/compras/documentos' },
        { icon: Ship, label: 'Procesos de Ingreso', href: '/dashboard/compras/procesos' },
        { icon: FileSignature, label: 'Sujeto Excluido', href: '/dashboard/compras/sujeto-excluido', grupo: 'Hacienda' },
        { icon: BookMarked, label: 'Libro de Compras', href: '/dashboard/compras/libro' },
      ]
    },
    {
      icon: Package,
      label: 'Inventario',
      href: '#inventario',
      type: 'dropdown' as const,
      isOpen: inventarioOpen,
      toggle: () => setInventarioOpen(!inventarioOpen),
      children: [
        { icon: List, label: 'Productos', href: '/dashboard/inventario/administrar' },
        { icon: Plus, label: 'Nuevo Producto', href: '/dashboard/inventario/nuevo' },
        { icon: Edit, label: 'Editar Producto', href: '/dashboard/inventario/editar-producto' },
        { icon: ClipboardList, label: 'Ajuste de inventario', href: '/dashboard/inventario/ajuste-stock' },
        { icon: FileText, label: 'Perfil del Producto', href: '/dashboard/inventario/perfil' },
        { icon: Tags, label: 'Ajuste de Precios', href: '/dashboard/inventario/ajuste-precios', grupo: 'Precios y costos' },
        { icon: Calculator, label: 'Gestión de Costos', href: '/dashboard/inventario/costos' },
        { icon: Upload, label: 'Importar Productos', href: '/dashboard/inventario/importar', grupo: 'Importar desde Excel' },
        { icon: FileSpreadsheet, label: 'Importar Costos', href: '/dashboard/inventario/importar-costos' },
      ]
    },
    {
      icon: Wrench,
      label: 'Taller',
      href: '#taller',
      type: 'dropdown' as const,
      isOpen: tallerOpen,
      toggle: () => setTallerOpen(!tallerOpen),
      children: [
        { icon: Car, label: 'Vehículos', href: '/dashboard/taller/vehiculos' },
        { icon: ClipboardList, label: 'Órdenes de trabajo', href: '/dashboard/taller/ordenes' },
      ]
    },
    {
      icon: Library,
      label: 'Catálogos',
      href: '#catalogos',
      type: 'dropdown' as const,
      isOpen: catalogosOpen,
      toggle: () => setCatalogosOpen(!catalogosOpen),
      children: [
        { icon: Truck, label: 'Proveedores', href: '/dashboard/compras/proveedores' },
        { icon: Users, label: 'Clientes', href: '/dashboard/taller/clientes' },
        { icon: HardHat, label: 'Empleados', href: '/dashboard/taller/empleados' },
        { icon: BookOpen, label: 'Catálogo Contable', href: '/dashboard/compras/catalogo-contable' },
      ]
    },
    {
      icon: Settings,
      label: 'Configuración',
      href: '#configuracion',
      type: 'dropdown' as const,
      isOpen: configOpen,
      toggle: () => setConfigOpen(!configOpen),
      children: [
        { icon: Building2, label: 'Empresa', href: '/dashboard/configuracion/empresa' },
        { icon: UserCog, label: 'Usuarios y Roles', href: '/dashboard/configuracion/usuarios' },
        { icon: KeyRound, label: 'Mi Contraseña', href: '/dashboard/configuracion' },
      ]
    },
  ];

  const menuItems = menuCompleto
    .map((item) =>
      item.type === 'dropdown'
        ? { ...item, children: item.children.filter((c) => puede(permisoPagina(c.href))) }
        : item
    )
    .filter((item) => item.type === 'link' || item.children.length > 0);

  const itemBtn =
    'w-full text-muted-foreground hover:text-primary hover:bg-muted';
  const itemActive =
    'bg-primary/10 text-primary shadow-[inset_3px_0_0_var(--primary)] hover:text-primary hover:bg-primary/15';
  const childBtn =
    'w-full justify-start gap-3 text-sm text-muted-foreground hover:text-primary hover:bg-muted';
  const childActive =
    'bg-primary/10 text-primary font-medium hover:text-primary hover:bg-primary/15';

  const sectionActive = (item: (typeof menuItems)[number]) =>
    item.type === 'dropdown' && item.children?.some((c) => isActive(c.href));

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Cerrar menú"
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={closeMobile}
        />
      )}

      <div
        className={`bg-sidebar text-sidebar-foreground border-r border-sidebar-border shadow-[4px_0_24px_rgba(15,23,42,0.06)] dark:shadow-xl flex flex-col transition-[width,transform] duration-200 ease-out
          fixed inset-y-0 left-0 z-50 lg:sticky lg:top-0 lg:z-auto h-screen
          ${isExpanded ? 'w-64' : 'w-16'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className={`border-b border-sidebar-border ${isExpanded ? 'p-6' : 'p-4'}`}>
          <div className="flex items-center justify-between">
            <div className={`min-w-0 ${isExpanded ? 'block' : 'hidden'}`}>
              <h1 className="text-xl font-bold text-primary tracking-tight">Taller Web</h1>
              <p className="text-sm text-muted-foreground">Sistema de Inventario</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="hidden lg:inline-flex text-muted-foreground hover:text-primary hover:bg-muted"
              onClick={() => persistCollapsed(!collapsed)}
              title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
            >
              <ChevronRight className={`h-4 w-4 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
            </Button>
          </div>
        </div>
        
        <nav className={isExpanded ? 'flex-1 p-4 overflow-y-auto' : 'flex-1 p-2 overflow-y-auto'}>
          <ul className="space-y-1">
            {menuItems.map((item) => {
              const active = item.type === 'link' && isActive(item.href);
              const groupActive = sectionActive(item);
              return (
                <li key={item.label}>
                  {item.type === 'link' ? (
                    <Link href={item.href} onClick={closeMobile}>
                      <Button
                        variant="ghost"
                        className={`${itemBtn} ${active ? itemActive : ''} ${isExpanded ? 'justify-start gap-3' : 'justify-center'} relative`}
                        title={!isExpanded ? item.label : undefined}
                      >
                        <item.icon className={`h-4 w-4 ${active ? 'text-primary' : ''}`} />
                        {isExpanded && item.label}
                        {!isExpanded && active && (
                          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                        )}
                      </Button>
                    </Link>
                  ) : (
                    <div>
                      <Button
                        variant="ghost"
                        className={`${itemBtn} ${groupActive ? 'text-primary' : ''} ${isExpanded ? 'justify-between gap-3' : 'justify-center'} relative`}
                        onClick={item.toggle}
                        title={!isExpanded ? item.label : undefined}
                      >
                        <div className={`flex items-center ${isExpanded ? 'gap-3' : ''}`}>
                          <item.icon className={`h-4 w-4 ${groupActive ? 'text-primary' : ''}`} />
                          {isExpanded && item.label}
                        </div>
                        {isExpanded && (
                          item.isOpen ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )
                        )}
                        {!isExpanded && groupActive && (
                          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                        )}
                      </Button>
                      
                      {isExpanded && item.isOpen && item.children && (
                        <div className="ml-6 mt-1 space-y-1">
                          {item.children.map((child) => {
                            const childIsActive = isActive(child.href);
                            const grupo = 'grupo' in child ? child.grupo : undefined;
                            return (
                              <div key={child.href}>
                                {grupo && (
                                  <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                                    {grupo}
                                  </p>
                                )}
                                <Link href={child.href} onClick={closeMobile}>
                                  <Button
                                    variant="ghost"
                                    className={`${childBtn} ${childIsActive ? childActive : ''}`}
                                    size="sm"
                                  >
                                    <child.icon className="h-3 w-3" />
                                    {child.label}
                                  </Button>
                                </Link>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        <div className={`border-t border-sidebar-border ${isExpanded ? 'p-4' : 'p-2'}`}>
          <div className={`flex items-center mb-4 ${isExpanded ? 'justify-between' : 'justify-center'}`}>
            {isExpanded && <span className="text-xs text-muted-foreground">Cambiar tema</span>}
            <ThemeToggle />
          </div>
          <Button
            variant="outline"
            className={`w-full gap-3 text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/10 border-red-300 dark:border-red-500/40 ${
              isExpanded ? 'justify-start' : 'justify-center'
            }`}
            onClick={handleLogout}
            title={!isExpanded ? 'Cerrar Sesión' : undefined}
          >
            <LogOut className="h-4 w-4" />
            {isExpanded && 'Cerrar Sesión'}
          </Button>
        </div>
      </div>
    </>
  );
}
