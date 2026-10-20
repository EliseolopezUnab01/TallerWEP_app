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
  Settings,
  DollarSign,
  Upload,
  ShoppingCart,
  Truck,
  BookOpen,
  ListOrdered,
  FileInput,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { ThemeToggle } from './theme-toggle';

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [inventarioOpen, setInventarioOpen] = useState(false);
  const [comprasOpen, setComprasOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [hovered, setHovered] = useState(false);

  const isExpanded = !collapsed || hovered || mobileOpen;

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/');
  };

  useEffect(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    if (saved === 'true') setCollapsed(true);
  }, []);

  useEffect(() => {
    if (pathname?.startsWith('/dashboard/inventario')) setInventarioOpen(true);
    if (pathname?.startsWith('/dashboard/compras')) setComprasOpen(true);
  }, [pathname]);

  const persistCollapsed = (next: boolean) => {
    setCollapsed(next);
    localStorage.setItem('sidebar_collapsed', String(next));
  };

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname === href || pathname?.startsWith(`${href}/`);
  };

  const closeMobile = () => onMobileClose?.();

  const menuItems = [
    { 
      icon: LayoutDashboard, 
      label: 'Dashboard', 
      href: '/dashboard',
      type: 'link' as const
    },
    { 
      icon: Package, 
      label: 'Inventario', 
      href: '#',
      type: 'dropdown' as const,
      isOpen: inventarioOpen,
      toggle: () => setInventarioOpen(!inventarioOpen),
      children: [
        { icon: Plus, label: 'Nuevo Producto', href: '/dashboard/inventario/nuevo' },
        { icon: Upload, label: 'Importar Productos', href: '/dashboard/inventario/importar' },
        { icon: List, label: 'Administrar Producto', href: '/dashboard/inventario/administrar' },
        { icon: Edit, label: 'Editar Producto', href: '/dashboard/inventario/editar-producto' },
        { icon: Settings, label: 'Ajuste de Precios', href: '/dashboard/inventario/ajuste-precios' },
        { icon: DollarSign, label: 'Gestión de Costos', href: '/dashboard/inventario/costos' },
        { icon: DollarSign, label: 'Importar Costos', href: '/dashboard/inventario/importar-costos' },
        { icon: FileText, label: 'Perfil del Producto', href: '/dashboard/inventario/perfil' },
      ]
    },
    {
      icon: ShoppingCart,
      label: 'Compras',
      href: '#compras',
      type: 'dropdown' as const,
      isOpen: comprasOpen,
      toggle: () => setComprasOpen(!comprasOpen),
      children: [
        { icon: FileInput, label: 'Ingreso de Compra', href: '/dashboard/compras/ingreso' },
        { icon: Truck, label: 'Proveedores', href: '/dashboard/compras/proveedores' },
        { icon: BookOpen, label: 'Catálogo Contable', href: '/dashboard/compras/catalogo-contable' },
        { icon: ListOrdered, label: 'Líneas de Compra', href: '/dashboard/compras/lineas' },
      ]
    },
  ];

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
                            return (
                              <Link key={child.href} href={child.href} onClick={closeMobile}>
                                <Button
                                  variant="ghost"
                                  className={`${childBtn} ${childIsActive ? childActive : ''}`}
                                  size="sm"
                                >
                                  <child.icon className="h-3 w-3" />
                                  {child.label}
                                </Button>
                              </Link>
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
