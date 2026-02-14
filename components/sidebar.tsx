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
  Moon,
  Sun,
  Settings
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { ThemeToggle } from './theme-toggle';

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [inventarioOpen, setInventarioOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [hovered, setHovered] = useState(false);

  const isExpanded = !collapsed || hovered;

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/');
  };

  const toggleInventario = () => {
    setInventarioOpen(!inventarioOpen);
  };

  useEffect(() => {
    // Restaurar estado colapsado
    const saved = localStorage.getItem('sidebar_collapsed');
    if (saved === 'true') setCollapsed(true);
  }, []);

  useEffect(() => {
    // Abrir inventario si estamos en una ruta del inventario
    if (pathname?.startsWith('/dashboard/inventario')) {
      setInventarioOpen(true);
    }
  }, [pathname]);

  const persistCollapsed = (next: boolean) => {
    setCollapsed(next);
    localStorage.setItem('sidebar_collapsed', String(next));
  };

  const menuItems = [
    { 
      icon: LayoutDashboard, 
      label: 'Dashboard', 
      href: '/dashboard',
      type: 'link'
    },
    { 
      icon: Package, 
      label: 'Inventario', 
      href: '#',
      type: 'dropdown',
      isOpen: inventarioOpen,
      toggle: toggleInventario,
      children: [
        { icon: Plus, label: 'Nuevo Producto', href: '/dashboard/inventario/nuevo' },
        { icon: List, label: 'Administrar Producto', href: '/dashboard/inventario/administrar' },
        { icon: Edit, label: 'Editar Producto', href: '/dashboard/inventario/editar-producto' },
        { icon: Settings, label: 'Ajuste de Precios', href: '/dashboard/inventario/ajuste-precios' },
        { icon: FileText, label: 'Perfil del Producto', href: '/dashboard/inventario/perfil' },
      ]
    },
  ];

  return (
    <div
      className={`bg-[#09101c] dark:bg-[#09101c] border-r border-[#0e88c9]/30 shadow-xl sticky top-0 h-screen flex flex-col transition-[width] duration-200 ease-out ${
        isExpanded ? 'w-64' : 'w-16'
      }`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className={`border-b border-[#0e88c9]/30 ${isExpanded ? 'p-6' : 'p-4'}`}>
        <div className="flex items-center justify-between">
          <div className={`min-w-0 ${isExpanded ? 'block' : 'hidden'}`}>
            <h1 className="text-xl font-bold text-cyan-400 tracking-tight">Taller Web</h1>
            <p className="text-sm text-slate-400">Sistema de Inventario</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-slate-300 hover:text-[#0e88c9] hover:bg-[#141e2e]"
            onClick={() => persistCollapsed(!collapsed)}
            title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          >
            <ChevronRight className={`h-4 w-4 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
          </Button>
        </div>
      </div>
      
      <nav className={isExpanded ? 'flex-1 p-4' : 'flex-1 p-2'}>
        <ul className="space-y-1">
          {menuItems.map((item) => (
            <li key={item.href}>
              {item.type === 'link' ? (
                <Link href={item.href}>
                  <Button
                    variant="ghost"
                    className={`w-full hover:bg-[#141e2e] text-slate-300 hover:text-[#0e88c9] ${
                      isExpanded ? 'justify-start gap-3' : 'justify-center'
                    }`}
                    title={!isExpanded ? item.label : undefined}
                  >
                    <item.icon className="h-4 w-4" />
                    {isExpanded && item.label}
                  </Button>
                </Link>
              ) : (
                <div>
                  <Button
                    variant="ghost"
                    className={`w-full hover:bg-[#141e2e] text-slate-300 hover:text-[#0e88c9] ${
                      isExpanded ? 'justify-between gap-3' : 'justify-center'
                    }`}
                    onClick={item.toggle}
                    title={!isExpanded ? item.label : undefined}
                  >
                    <div className={`flex items-center ${isExpanded ? 'gap-3' : ''}`}>
                      <item.icon className="h-4 w-4" />
                      {isExpanded && item.label}
                    </div>
                    {isExpanded && (
                      item.isOpen ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )
                    )}
                  </Button>
                  
                  {isExpanded && item.isOpen && item.children && (
                    <div className="ml-6 mt-1 space-y-1">
                      {item.children.map((child) => (
                        <Link key={child.href} href={child.href}>
                          <Button
                            variant="ghost"
                            className="w-full justify-start gap-3 text-sm hover:bg-[#141e2e] text-slate-400 hover:text-[#0e88c9]"
                            size="sm"
                            onClick={() => persistCollapsed(true)}
                          >
                            <child.icon className="h-3 w-3" />
                            {child.label}
                          </Button>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </nav>

      <div className={`border-t border-[#0e88c9]/30 ${isExpanded ? 'p-4' : 'p-2'}`}>
        <div className={`flex items-center mb-4 ${isExpanded ? 'justify-between' : 'justify-center'}`}>
          {isExpanded && <span className="text-xs text-slate-400">Cambiar tema</span>}
          <ThemeToggle />
        </div>
        <Button
          variant="outline"
          className={`w-full gap-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 border-red-500/40 ${
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
  );
}