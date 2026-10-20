'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from './sidebar';
import { useNotifications } from '@/contexts/notification-context';
import { CheckCircle, AlertTriangle, Clock, X, Menu } from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

interface TimeToast {
  type: 'success' | 'warning' | 'error';
  title: string;
  message: string;
  details?: string;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<TimeToast | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const timeChecked = useRef(false);
  const router = useRouter();
  const { addNotification } = useNotifications();

  useEffect(() => {
    const token = localStorage.getItem('token');
    
    if (!token) {
      router.push('/');
      return;
    }

    setIsAuthenticated(true);
    setLoading(false);
  }, [router]);

  // Verificar hora solo UNA vez por sesión (no en cada cambio de módulo)
  useEffect(() => {
    if (!isAuthenticated) return;
    
    // Si ya se verificó en esta sesión, no volver a verificar
    const alreadyChecked = sessionStorage.getItem('time_verified');
    if (alreadyChecked || timeChecked.current) return;
    timeChecked.current = true;
    sessionStorage.setItem('time_verified', 'true');

    const verifyTime = async () => {
      try {
        const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const response = await fetch(`/api/server-time?timezone=${encodeURIComponent(userTimezone)}`);
        const data = await response.json();

        if (!data.success) {
          throw new Error('No se pudo verificar la hora');
        }

        const clientNow = new Date();
        const diffMs = Math.abs(clientNow.getTime() - data.serverTime.timestamp);
        const diffMinutes = Math.round(diffMs / 60000);

        if (diffMinutes <= data.maxToleranceMinutes) {
          // Hora correcta - toast verde que desaparece + notificación
          setToast({
            type: 'success',
            title: 'Hora verificada',
            message: `Zona horaria: ${userTimezone.replace(/_/g, ' ')}`,
            details: data.serverTime.formatted
          });
          addNotification({
            type: 'success',
            title: 'Verificación de hora',
            message: `Hora del sistema verificada correctamente (${userTimezone.replace(/_/g, ' ')})`
          });
        } else {
          // Hora incorrecta - toast amarillo que NO desaparece + notificación
          setToast({
            type: 'warning',
            title: 'Hora desincronizada',
            message: `Diferencia de ${diffMinutes} minutos detectada`,
            details: `Hora oficial: ${data.serverTime.formatted}`
          });
          addNotification({
            type: 'warning',
            title: 'Hora desincronizada',
            message: `La hora de su equipo difiere ${diffMinutes} minutos de la hora oficial. Sincronice su reloj.`
          });
        }
      } catch {
        setToast({
          type: 'error',
          title: 'Error de verificación',
          message: 'No se pudo verificar la hora del sistema'
        });
        addNotification({
          type: 'error',
          title: 'Error de verificación',
          message: 'No se pudo verificar la hora. Verifique su conexión a internet.'
        });
      }

      // Mostrar toast con animación
      setTimeout(() => setToastVisible(true), 100);
    };

    verifyTime();
  }, [isAuthenticated, addNotification]);

  // Auto-ocultar toast después de 4 segundos solo si es éxito
  useEffect(() => {
    if (toast && toastVisible && toast.type === 'success') {
      const timer = setTimeout(() => {
        setToastVisible(false);
        setTimeout(() => setToast(null), 300);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast, toastVisible]);

  const dismissToast = () => {
    setToastVisible(false);
    setTimeout(() => setToast(null), 300);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-primary">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <main className="flex-1 overflow-x-hidden min-w-0">
        <div className="lg:hidden sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-card/95 backdrop-blur px-4 py-3">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-primary"
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold text-primary">Taller Web</span>
        </div>
        <div className="p-6 space-y-6 min-h-full">
          {children}
        </div>
      </main>

      {/* Toast de verificación de hora */}
      {toast && (
        <div 
          className={`fixed top-4 right-4 z-50 transition-all duration-300 ease-out ${
            toastVisible 
              ? 'translate-x-0 opacity-100' 
              : 'translate-x-full opacity-0'
          }`}
        >
          <div className={`
            min-w-[300px] max-w-[380px] rounded-xl border shadow-2xl backdrop-blur-xl p-4
            ${toast.type === 'success' 
              ? 'bg-emerald-50/95 dark:bg-emerald-950/90 border-emerald-200 dark:border-emerald-500/30 shadow-emerald-500/10' 
              : toast.type === 'warning'
              ? 'bg-amber-50/95 dark:bg-yellow-950/90 border-amber-200 dark:border-yellow-500/30 shadow-yellow-500/10'
              : 'bg-red-50/95 dark:bg-red-950/90 border-red-200 dark:border-red-500/30 shadow-red-500/10'
            }
          `}>
            <div className="flex items-start gap-3">
              {/* Icono */}
              <div className={`
                flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center
                ${toast.type === 'success' 
                  ? 'bg-emerald-500/20' 
                  : toast.type === 'warning'
                  ? 'bg-yellow-500/20'
                  : 'bg-red-500/20'
                }
              `}>
                {toast.type === 'success' ? (
                  <CheckCircle className="h-5 w-5 text-emerald-400" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-yellow-400" />
                )}
              </div>

              {/* Contenido */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  <span className={`text-sm font-semibold ${
                    toast.type === 'success' ? 'text-emerald-700 dark:text-emerald-300' 
                    : toast.type === 'warning' ? 'text-amber-700 dark:text-yellow-300'
                    : 'text-red-700 dark:text-red-300'
                  }`}>
                    {toast.title}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{toast.message}</p>
                {toast.details && (
                  <p className="text-xs font-mono text-muted-foreground mt-1">{toast.details}</p>
                )}
              </div>

              {/* Botón cerrar */}
              <button 
                onClick={dismissToast}
                className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Barra de progreso solo para success */}
            {toast.type === 'success' && toastVisible && (
              <div className="mt-3 h-0.5 bg-emerald-900/50 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-400/60 rounded-full animate-[shrink_4s_linear_forwards]" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}