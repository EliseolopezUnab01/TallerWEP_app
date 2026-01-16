'use client';

import { useState, useRef, useEffect } from 'react';
import { UserCircle2, Settings, LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export function UserDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('notifications');
    router.push('/');
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="outline"
        size="icon"
        className="border-slate-700 bg-slate-950/60 text-slate-300 hover:text-slate-50 hover:bg-slate-800"
        onClick={() => setIsOpen(!isOpen)}
      >
        <UserCircle2 className="h-5 w-5" />
      </Button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl border border-[#0e88c9]/30 bg-[#0d1523] shadow-[0_0_25px_rgba(14,136,201,0.2)] z-50 overflow-hidden">
          {/* Header con info del usuario */}
          <div className="px-4 py-3 border-b border-[#0e88c9]/30">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[#0e88c9]/20 flex items-center justify-center">
                <User className="h-5 w-5 text-[#0e88c9]" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-200">Administrador</p>
                <p className="text-xs text-slate-500">admin@tallerweb.com</p>
              </div>
            </div>
          </div>

          {/* Opciones del menú */}
          <div className="py-2">
            <button
              className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-800/50 hover:text-slate-100 flex items-center gap-3 transition-colors"
              onClick={() => {
                setIsOpen(false);
                // Aquí puedes agregar navegación a perfil
              }}
            >
              <User className="h-4 w-4" />
              Mi Perfil
            </button>
            <button
              className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-800/50 hover:text-slate-100 flex items-center gap-3 transition-colors"
              onClick={() => {
                setIsOpen(false);
                // Aquí puedes agregar navegación a configuración
              }}
            >
              <Settings className="h-4 w-4" />
              Configuración
            </button>
          </div>

          {/* Cerrar sesión */}
          <div className="border-t border-[#0e88c9]/30 py-2">
            <button
              className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 flex items-center gap-3 transition-colors"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              Cerrar Sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
