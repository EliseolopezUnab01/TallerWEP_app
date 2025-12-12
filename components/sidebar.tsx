'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  const [inventarioOpen, setInventarioOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/');
  };

  const toggleInventario = () => {
    setInventarioOpen(!inventarioOpen);
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
        { icon: Edit, label: 'Editar Precio', href: '/dashboard/inventario/precios' },
        { icon: Settings, label: 'Ajuste de Precios', href: '/dashboard/inventario/ajuste-precios' },
        { icon: FileText, label: 'Perfil del Producto', href: '/dashboard/inventario/perfil' },
      ]
    },
  ];

  return (
    <div className="w-64 bg-[#09101c] dark:bg-[#09101c] border-r border-[#0e88c9]/30 shadow-xl h-screen flex flex-col">
      <div className="p-6 border-b border-[#0e88c9]/30">
        <h1 className="text-xl font-bold text-cyan-400 tracking-tight">Taller Web</h1>
        <p className="text-sm text-slate-400">Sistema de Inventario</p>
      </div>
      
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {menuItems.map((item) => (
            <li key={item.href}>
              {item.type === 'link' ? (
                <Link href={item.href}>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 hover:bg-[#141e2e] text-slate-300 hover:text-[#0e88c9]"
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              ) : (
                <div>
                  <Button
                    variant="ghost"
                    className="w-full justify-between gap-3 hover:bg-[#141e2e] text-slate-300 hover:text-[#0e88c9]"
                    onClick={item.toggle}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </div>
                    {item.isOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                  
                  {item.isOpen && item.children && (
                    <div className="ml-6 mt-1 space-y-1">
                      {item.children.map((child) => (
                        <Link key={child.href} href={child.href}>
                          <Button
                            variant="ghost"
                            className="w-full justify-start gap-3 text-sm hover:bg-[#141e2e] text-slate-400 hover:text-[#0e88c9]"
                            size="sm"
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

      <div className="p-4 border-t border-[#0e88c9]/30">
        <div className="flex justify-between items-center mb-4">
          <span className="text-xs text-slate-400">Cambiar tema</span>
          <ThemeToggle />
        </div>
        <Button
          variant="outline"
          className="w-full justify-start gap-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 border-red-500/40"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Cerrar Sesión
        </Button>
      </div>
    </div>
  );
}