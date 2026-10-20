'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { UserCircle2, Settings, LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { UI } from '@/lib/ui';

interface UserInfo {
  id?: number;
  nombre: string;
  email: string;
}

function leerUserLocal(): UserInfo | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function UserDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const cargarUsuario = useCallback(async () => {
    const local = leerUserLocal();
    if (local) setUser(local);

    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setUser(data.user);
        localStorage.setItem('user', JSON.stringify(data.user));
      }
    } catch {
      /* mantener datos locales */
    }
  }, []);

  useEffect(() => {
    cargarUsuario();
  }, [cargarUsuario]);

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
    localStorage.removeItem('user');
    localStorage.removeItem('notifications');
    router.push('/');
  };

  const ir = (path: string) => {
    setIsOpen(false);
    router.push(path);
  };

  const nombre = user?.nombre || 'Administrador';
  const email = user?.email || 'admin@tallerweb.com';

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="outline"
        size="icon"
        className={UI.iconBtn}
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) cargarUsuario();
        }}
      >
        <UserCircle2 className="h-5 w-5" />
      </Button>

      {isOpen && (
        <div className={`absolute right-0 mt-2 w-56 ${UI.dropdown}`}>
          <div className={`px-4 py-3 border-b ${UI.dropdownBorder}`}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-sky-100 dark:bg-primary/20 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-medium truncate ${UI.textPrimary}`}>{nombre}</p>
                <p className={`text-xs truncate ${UI.textFaint}`}>{email}</p>
              </div>
            </div>
          </div>

          <div className="py-2">
            <button
              type="button"
              className={`w-full px-4 py-2 text-left text-sm flex items-center gap-3 transition-colors ${UI.textSecondary} hover:bg-sky-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100`}
              onClick={() => ir('/dashboard/perfil')}
            >
              <User className="h-4 w-4" />
              Mi Perfil
            </button>
            <button
              type="button"
              className={`w-full px-4 py-2 text-left text-sm flex items-center gap-3 transition-colors ${UI.textSecondary} hover:bg-sky-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100`}
              onClick={() => ir('/dashboard/configuracion')}
            >
              <Settings className="h-4 w-4" />
              Configuración
            </button>
          </div>

          <div className={`border-t ${UI.dropdownBorder} py-2`}>
            <button
              type="button"
              className="w-full px-4 py-2 text-left text-sm text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300 flex items-center gap-3 transition-colors"
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
