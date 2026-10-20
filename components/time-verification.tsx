'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Clock, RefreshCw } from 'lucide-react';

interface TimeVerificationProps {
  onVerified?: (isValid: boolean) => void;
  showAlways?: boolean; // Si es true, siempre muestra el estado
}

interface ServerTimeResponse {
  success: boolean;
  serverTime: {
    iso: string;
    timestamp: number;
    timezone: string;
    formatted: string;
    date: string;
    time: string;
  };
  source: 'external' | 'server_fallback';
  maxToleranceMinutes: number;
}

export function TimeVerification({ onVerified, showAlways = false }: TimeVerificationProps) {
  const [status, setStatus] = useState<'checking' | 'valid' | 'warning' | 'error'>('checking');
  const [serverTime, setServerTime] = useState<string>('');
  const [clientTime, setClientTime] = useState<string>('');
  const [timeDiff, setTimeDiff] = useState<number>(0);
  const [message, setMessage] = useState<string>('Verificando fecha y hora...');
  const [isVerifying, setIsVerifying] = useState(false);

  const verifyTime = async () => {
    setIsVerifying(true);
    setStatus('checking');
    setMessage('Verificando fecha y hora del sistema...');

    try {
      // Detectar zona horaria del navegador del usuario
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      // Obtener hora oficial de internet para ESA zona horaria
      const response = await fetch(`/api/server-time?timezone=${encodeURIComponent(userTimezone)}`);
      const data: ServerTimeResponse = await response.json();

      if (!data.success) {
        throw new Error('No se pudo obtener la hora del servidor');
      }

      // Hora del cliente en la misma zona horaria
      const clientNow = new Date();
      const clientFormatter = new Intl.DateTimeFormat('es-GT', {
        timeZone: data.serverTime.timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      
      const clientParts = clientFormatter.formatToParts(clientNow);
      const getClientPart = (type: string) => clientParts.find(p => p.type === type)?.value || '';
      const clientFormatted = `${getClientPart('day')}/${getClientPart('month')}/${getClientPart('year')} ${getClientPart('hour')}:${getClientPart('minute')}:${getClientPart('second')}`;

      setServerTime(data.serverTime.formatted);
      setClientTime(clientFormatted);

      // Calcular diferencia en minutos
      const diffMs = Math.abs(clientNow.getTime() - data.serverTime.timestamp);
      const diffMinutes = Math.round(diffMs / 60000);
      setTimeDiff(diffMinutes);

      // Verificar si está dentro de la tolerancia
      if (diffMinutes <= data.maxToleranceMinutes) {
        setStatus('valid');
        const sourceText = data.source === 'external' ? '(verificado con internet)' : '(servidor local)';
        setMessage(`Fecha y hora verificadas correctamente ${sourceText}`);
        onVerified?.(true);
      } else {
        setStatus('warning');
        const sourceText = data.source === 'external' ? 'la hora oficial de internet' : 'el servidor';
        setMessage(`¡Advertencia! La hora de su computadora difiere ${diffMinutes} minutos de ${sourceText}. Por favor, sincronice la hora de su sistema.`);
        onVerified?.(false);
      }

    } catch (error) {
      console.error('Error verificando tiempo:', error);
      setStatus('error');
      setMessage('No se pudo verificar la hora. Verifique su conexión.');
      onVerified?.(false);
    } finally {
      setIsVerifying(false);
    }
  };

  useEffect(() => {
    verifyTime();
    
    // Re-verificar cada 5 minutos
    const interval = setInterval(verifyTime, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Si está verificado y no queremos mostrar siempre, no renderizar nada
  if (status === 'valid' && !showAlways) {
    return null;
  }

  const getStatusColor = () => {
    switch (status) {
      case 'checking': return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
      case 'valid': return 'bg-green-500/10 border-green-500/30 text-green-400';
      case 'warning': return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400';
      case 'error': return 'bg-red-500/10 border-red-500/30 text-red-400';
    }
  };

  const getIcon = () => {
    switch (status) {
      case 'checking': return <RefreshCw className="h-5 w-5 animate-spin" />;
      case 'valid': return <CheckCircle className="h-5 w-5" />;
      case 'warning': return <AlertTriangle className="h-5 w-5" />;
      case 'error': return <AlertTriangle className="h-5 w-5" />;
    }
  };

  return (
    <div className={`rounded-lg border p-3 ${getStatusColor()}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span className="font-medium text-sm">Verificación de Fecha/Hora</span>
          </div>
          <p className="text-sm mt-1 opacity-90">{message}</p>
          
          {(status === 'valid' || status === 'warning') && (
            <div className="mt-2 text-xs space-y-1 opacity-75">
              <div className="flex justify-between">
                <span>Hora oficial (internet):</span>
                <span className="font-mono">{serverTime}</span>
              </div>
              <div className="flex justify-between">
                <span>Hora de su equipo:</span>
                <span className="font-mono">{clientTime}</span>
              </div>
              {status === 'warning' && (
                <div className="flex justify-between text-yellow-300">
                  <span>Diferencia:</span>
                  <span className="font-bold">{timeDiff} minutos</span>
                </div>
              )}
            </div>
          )}

          {(status === 'warning' || status === 'error') && (
            <button
              onClick={verifyTime}
              disabled={isVerifying}
              className="mt-2 text-xs underline hover:no-underline flex items-center gap-1"
            >
              <RefreshCw className={`h-3 w-3 ${isVerifying ? 'animate-spin' : ''}`} />
              Verificar nuevamente
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Componente compacto para mostrar en el header/navbar
export function TimeVerificationBadge() {
  const [status, setStatus] = useState<'checking' | 'valid' | 'warning' | 'error'>('checking');
  const [timeDiff, setTimeDiff] = useState<number>(0);

  useEffect(() => {
    const verifyTime = async () => {
      try {
        // Detectar zona horaria del navegador del usuario
        const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        
        const response = await fetch(`/api/server-time?timezone=${encodeURIComponent(userTimezone)}`);
        const data = await response.json();

        if (!data.success) {
          setStatus('error');
          return;
        }

        const clientNow = new Date();
        const diffMs = Math.abs(clientNow.getTime() - data.serverTime.timestamp);
        const diffMinutes = Math.round(diffMs / 60000);
        setTimeDiff(diffMinutes);

        if (diffMinutes <= data.maxToleranceMinutes) {
          setStatus('valid');
        } else {
          setStatus('warning');
        }
      } catch {
        setStatus('error');
      }
    };

    verifyTime();
    const interval = setInterval(verifyTime, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (status === 'valid') {
    return (
      <div className="flex items-center gap-1 text-xs text-green-400" title="Hora sincronizada correctamente">
        <CheckCircle className="h-3 w-3" />
        <span className="hidden sm:inline">Hora OK</span>
      </div>
    );
  }

  if (status === 'warning') {
    return (
      <div className="flex items-center gap-1 text-xs text-yellow-400 animate-pulse" title={`Diferencia de ${timeDiff} minutos con el servidor`}>
        <AlertTriangle className="h-3 w-3" />
        <span>¡Hora desincronizada!</span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex items-center gap-1 text-xs text-red-400" title="No se pudo verificar la hora">
        <AlertTriangle className="h-3 w-3" />
        <span className="hidden sm:inline">Error hora</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 text-xs text-blue-400">
      <RefreshCw className="h-3 w-3 animate-spin" />
      <span className="hidden sm:inline">Verificando...</span>
    </div>
  );
}
