'use client';

import { useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/dashboard-layout';
import { NotificationDropdown } from '@/components/notification-dropdown';
import { UserDropdown } from '@/components/user-dropdown';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Save, Loader2, AlertCircle, CheckCircle2, Lock, User, Moon,
} from 'lucide-react';
import { UI } from '@/lib/ui';

function authHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export default function ConfiguracionPage() {
  const [passwordActual, setPasswordActual] = useState('');
  const [passwordNueva, setPasswordNueva] = useState('');
  const [passwordConfirmar, setPasswordConfirmar] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const notificar = (tipo: 'ok' | 'error', texto: string) => {
    setAviso({ tipo, texto });
    setTimeout(() => setAviso(null), 4000);
  };

  const cambiarPassword = async () => {
    setGuardando(true);
    try {
      const res = await fetch('/api/auth/password', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          password_actual: passwordActual,
          password_nueva: passwordNueva,
          password_confirmar: passwordConfirmar,
        }),
      });
      const data = await res.json();
      if (data.success) {
        notificar('ok', 'Contraseña actualizada correctamente');
        setPasswordActual('');
        setPasswordNueva('');
        setPasswordConfirmar('');
      } else {
        notificar('error', data.error || 'No se pudo cambiar la contraseña');
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
              <span className={UI.navTitle}>Configuración</span>
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
            <h1 className={UI.heading}>Configuración</h1>
            <p className={`${UI.subheading} mt-1`}>Preferencias de cuenta y seguridad</p>
          </div>

          <Card className={UI.card}>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Moon className="h-4 w-4 text-primary" />
                <h2 className={`text-sm font-semibold uppercase tracking-wider ${UI.textPrimary}`}>
                  Apariencia
                </h2>
              </div>
              <div className={`${UI.panel} flex items-center justify-between px-4 py-3`}>
                <div>
                  <p className={`text-sm ${UI.textPrimary}`}>Tema claro / oscuro</p>
                  <p className={`text-xs ${UI.textFaint}`}>Alternar entre modos de visualización</p>
                </div>
                <ThemeToggle />
              </div>
            </CardContent>
          </Card>

          <Card className={UI.card}>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <User className="h-4 w-4 text-primary" />
                <h2 className={`text-sm font-semibold uppercase tracking-wider ${UI.textPrimary}`}>
                  Cuenta
                </h2>
              </div>
              <Link
                href="/dashboard/perfil"
                className={`block ${UI.panel} px-4 py-3 text-sm text-primary dark:text-primary hover:border-primary/40 transition-colors`}
              >
                Editar nombre y ver datos del perfil →
              </Link>
            </CardContent>
          </Card>

          <Card className={UI.card}>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary" />
                <h2 className={`text-sm font-semibold uppercase tracking-wider ${UI.textPrimary}`}>
                  Seguridad
                </h2>
              </div>
              <p className={`text-xs ${UI.textFaint}`}>Cambie su contraseña de acceso al sistema</p>

              <div>
                <Label className={UI.label}>Contraseña actual</Label>
                <Input
                  type="password"
                  className={`${UI.input} mt-1.5`}
                  value={passwordActual}
                  onChange={(e) => setPasswordActual(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <div>
                <Label className={UI.label}>Nueva contraseña</Label>
                <Input
                  type="password"
                  className={`${UI.input} mt-1.5`}
                  value={passwordNueva}
                  onChange={(e) => setPasswordNueva(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <Label className={UI.label}>Confirmar nueva contraseña</Label>
                <Input
                  type="password"
                  className={`${UI.input} mt-1.5`}
                  value={passwordConfirmar}
                  onChange={(e) => setPasswordConfirmar(e.target.value)}
                  autoComplete="new-password"
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={cambiarPassword}
                  disabled={guardando || !passwordActual || !passwordNueva}
                  className="bg-primary hover:bg-primary/80 text-white rounded-full px-6"
                >
                  {guardando ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                  Cambiar contraseña
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
