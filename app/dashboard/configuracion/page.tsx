'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BarraPantalla } from '@/components/barra-pantalla';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Save, Loader2, AlertCircle, CheckCircle2, Lock, User,
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
    <>
      <div className={`${UI.canvas} flex flex-col gap-3`}>
        <BarraPantalla modulo="Configuración" titulo="Mi contraseña" />
        <div className="space-y-4 max-w-2xl">

          {aviso && (
            <div className={`px-4 py-3 flex items-center gap-2 text-sm ${
              aviso.tipo === 'ok' ? UI.avisoOk : UI.avisoError
            }`}>
              {aviso.tipo === 'ok' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              {aviso.texto}
            </div>
          )}

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
    </>
  );
}
