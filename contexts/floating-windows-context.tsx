'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

// Interfaz del producto (simplificada para las ventanas flotantes)
interface ProductoFloating {
  idprod: number;
  nombre: string;
  descripcion?: string;
  imagen_principal?: string;
  stock_contable: number;
  costo?: number;
  OE?: string;
  marca?: string;
  categoria_nombre?: string;
  idcategoria?: number;
  idprodprov?: string;
  idprodpaquete?: string;
  codigo_barras?: string;
  precio1?: number;
  precio2?: number;
  precio3?: number;
  precio4?: number;
  precio5?: number;
  precio6?: number;
  precio7?: number;
}

interface FloatingWindow {
  id: number;
  producto: ProductoFloating;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
}

interface FloatingWindowsContextType {
  floatingWindows: FloatingWindow[];
  openFloatingWindow: (producto: ProductoFloating) => void;
  closeFloatingWindow: (id: number) => void;
  bringToFront: (id: number) => void;
  updateWindowPosition: (id: number, position: { x: number; y: number }) => void;
  updateWindowSize: (id: number, size: { width: number; height: number }) => void;
  closeAllWindows: () => void;
}

const FloatingWindowsContext = createContext<FloatingWindowsContextType | undefined>(undefined);

// Tamaño fijo para todas las ventanas (como "frenos pastillas")
const FIXED_WINDOW_SIZE = { width: 420, height: 520 };
const BASE_Z_INDEX = 100;

export function FloatingWindowsProvider({ children }: { children: React.ReactNode }) {
  const [floatingWindows, setFloatingWindows] = useState<FloatingWindow[]>([]);
  const [maxZIndex, setMaxZIndex] = useState(BASE_Z_INDEX);

  const openFloatingWindow = useCallback((producto: ProductoFloating) => {
    setFloatingWindows(prev => {
      // Verificar si ya existe
      const existing = prev.find(w => w.id === producto.idprod);
      if (existing) {
        // Si ya existe, traerla al frente
        const newMaxZ = maxZIndex + 1;
        setMaxZIndex(newMaxZ);
        return prev.map(w => 
          w.id === producto.idprod ? { ...w, zIndex: newMaxZ } : w
        );
      }

      // Calcular posición escalonada para nuevas ventanas
      const offset = (prev.length % 5) * 30;
      const newMaxZ = maxZIndex + 1;
      setMaxZIndex(newMaxZ);

      const newWindow: FloatingWindow = {
        id: producto.idprod,
        producto,
        position: { x: 100 + offset, y: 100 + offset },
        size: FIXED_WINDOW_SIZE,
        zIndex: newMaxZ
      };

      return [...prev, newWindow];
    });
  }, [maxZIndex]);

  const closeFloatingWindow = useCallback((id: number) => {
    setFloatingWindows(prev => prev.filter(w => w.id !== id));
  }, []);

  const bringToFront = useCallback((id: number) => {
    setFloatingWindows(prev => {
      const window = prev.find(w => w.id === id);
      if (!window) return prev;

      const newMaxZ = maxZIndex + 1;
      setMaxZIndex(newMaxZ);

      return prev.map(w => 
        w.id === id ? { ...w, zIndex: newMaxZ } : w
      );
    });
  }, [maxZIndex]);

  const updateWindowPosition = useCallback((id: number, position: { x: number; y: number }) => {
    setFloatingWindows(prev => 
      prev.map(w => w.id === id ? { ...w, position } : w)
    );
  }, []);

  const updateWindowSize = useCallback((id: number, size: { width: number; height: number }) => {
    setFloatingWindows(prev => 
      prev.map(w => w.id === id ? { ...w, size } : w)
    );
  }, []);

  const closeAllWindows = useCallback(() => {
    setFloatingWindows([]);
  }, []);

  return (
    <FloatingWindowsContext.Provider value={{
      floatingWindows,
      openFloatingWindow,
      closeFloatingWindow,
      bringToFront,
      updateWindowPosition,
      updateWindowSize,
      closeAllWindows
    }}>
      {children}
    </FloatingWindowsContext.Provider>
  );
}

export function useFloatingWindows() {
  const context = useContext(FloatingWindowsContext);
  if (context === undefined) {
    throw new Error('useFloatingWindows must be used within a FloatingWindowsProvider');
  }
  return context;
}
