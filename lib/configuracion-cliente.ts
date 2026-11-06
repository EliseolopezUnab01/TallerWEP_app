'use client';

import { useEffect, useState } from 'react';
import type { ConfiguracionSistema } from './configuracion';

let actual: ConfiguracionSistema | null = null;
let pendiente: Promise<ConfiguracionSistema | null> | null = null;

export function cargarConfiguracion(forzar = false): Promise<ConfiguracionSistema | null> {
  if (actual && !forzar) return Promise.resolve(actual);
  pendiente ??= fetch('/api/configuracion-sistema')
    .then((r) => r.json())
    .then((d) => (actual = d.success ? d.configuracion : null))
    .catch(() => null)
    .finally(() => {
      pendiente = null;
    });
  return pendiente;
}

export function fijarConfiguracion(valores: ConfiguracionSistema) {
  actual = valores;
}

/** Configuración del sistema para las pantallas; null mientras carga. */
export function useConfiguracion() {
  const [config, setConfig] = useState<ConfiguracionSistema | null>(actual);
  useEffect(() => {
    let vigente = true;
    cargarConfiguracion().then((c) => vigente && setConfig(c));
    return () => {
      vigente = false;
    };
  }, []);
  return config;
}
