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
  ChevronRight
} from 'lucide-react';
import { useState } from 'react';

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
      children: [
        { icon: Plus, label: 'Nuevo Producto', href: '/dashboard/inventario/nuevo' },
        { icon: List, label: 'Administrar Producto', href: '/dashboard/inventario/administrar' },
        { icon: Edit, label: 'Editar Precio', href: '/dashboard/inventario/precios' },
        { icon: FileText, label: 'Perfil del Producto', href: '/dashboard/inventario/perfil' },
      ]
    },
  ];

  return (
    <div className="w-64 bg-white shadow-lg h-screen flex flex-col">
      <div className="p-6 border-b">
        <h1 className="text-xl font-bold text-gray-800">Taller Web</h1>
        <p className="text-sm text-gray-600">Sistema de Inventario</p>
      </div>
      
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {menuItems.map((item) => (
            <li key={item.href}>
              {item.type === 'link' ? (
                <Link href={item.href}>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 hover:bg-gray-100"
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              ) : (
                <div>
                  <Button
                    variant="ghost"
                    className="w-full justify-between gap-3 hover:bg-gray-100"
                    onClick={toggleInventario}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </div>
                    {inventarioOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                  
                  {inventarioOpen && item.children && (
                    <div className="ml-6 mt-1 space-y-1">
                      {item.children.map((child) => (
                        <Link key={child.href} href={child.href}>
                          <Button
                            variant="ghost"
                            className="w-full justify-start gap-3 text-sm hover:bg-gray-50"
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

      <div className="p-4 border-t">
        <Button
          variant="outline"
          className="w-full justify-start gap-3 text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Cerrar Sesión
        </Button>
      </div>
    </div>
  );
}