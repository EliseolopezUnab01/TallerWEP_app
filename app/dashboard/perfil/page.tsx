'use client';

import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { NotificationDropdown } from '@/components/notification-dropdown';
import { UserDropdown } from '@/components/user-dropdown';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { User, Save, Loader2, AlertCircle, CheckCircle2, Mail } from 'lucide-react';
import { UI } from '@/lib/ui';

function authHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export default function PerfilPage() {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const notificar = (tipo: 'ok' | 'error', texto: string) => {
    setAviso({ tipo, texto });
    setTimeout(() => setAviso(null), 4000);
  };

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await fetch('/api/auth/me', { headers: authHeaders() });
      const data = await res.json();
      if (data.success) {
        setNombre(data.user.nombre || '');
        setEmail(data.user.email || '');
        localStorage.setItem('user', JSON.stringify(data.user));
      } else {
        notificar('error', data.error || 'No se pudo cargar el perfil');
      }
    } catch {
      notificar('error', 'Error de conexión');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const guardar = async () => {
    if (!nombre.trim()) {
      notificar('error', 'El nombre es obligatorio');
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ nombre: nombre.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('user', JSON.stringify(data.user));
        notificar('ok', 'Perfil actualizado');
      } else {
        notificar('error', data.error || 'No se pudo guardar');
      }
    } catch {
      notificar('error', 'Error de conexión');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <DashboardLayout>
      <div className={UI.page}>
        <div className={`${UI.stack} max-w-2xl mx-auto`}>
          <div className={UI.navbar}>
            <div className="flex items-center gap-3">
              <span className={UI.navLabel}>Cuenta</span>
              <span className={UI.navDivider} />
              <span className={UI.navTitle}>Mi Perfil</span>
            </div>
            <div className="flex items-center gap-3">
              <NotificationDropdown />
              <UserDropdown />
            </div>
          </div>

          {aviso && (
            <div className={`px-4 py-3 flex items-center gap-2 text-sm ${
              aviso.tipo === 'ok' ? UI.avisoOk : UI.avisoError
            }`}>
              {aviso.tipo === 'ok' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              {aviso.texto}
            </div>
          )}

          <div>
            <h1 className={UI.heading}>Mi perfil</h1>
            <p className={`${UI.subheading} mt-1`}>Datos de su cuenta en Taller Web</p>
          </div>

          <Card className={UI.card}>
            <CardContent className="p-6">
              {cargando ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="flex items-center gap-4 pb-5 border-b border-slate-200 dark:border-slate-700/60">
                    <div className="h-16 w-16 rounded-full bg-sky-100 dark:bg-primary/20 flex items-center justify-center">
                      <User className="h-8 w-8 text-primary dark:text-primary" />
                    </div>
                    <div>
                      <p className={`text-lg font-semibold ${UI.textPrimary}`}>{nombre || 'Usuario'}</p>
                      <p className={`text-sm ${UI.textMuted}`}>{email}</p>
                    </div>
                  </div>

                  <div>
                    <Label className={UI.label}>Nombre completo</Label>
                    <Input
                      className={`${UI.input} mt-1.5`}
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      placeholder="Su nombre"
                    />
                  </div>

                  <div>
                    <Label className={UI.label}>Correo electrónico</Label>
                    <div className="relative mt-1.5">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        className={`${UI.input} pl-9 opacity-80`}
                        value={email}
                        readOnly
                        title="El correo no se puede cambiar desde aquí"
                      />
                    </div>
                    <p className={`text-xs mt-1 ${UI.textFaint}`}>
                      Solo lectura. Contacte al administrador para cambiarlo.
                    </p>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      onClick={guardar}
                      disabled={guardando}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-6"
                    >
                      {guardando ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                      Guardar cambios
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
