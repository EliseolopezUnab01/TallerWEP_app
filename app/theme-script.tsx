'use client';

import { useEffect } from 'react';

// Este componente se encargará de cargar el tema inicial para evitar el flash de contenido
export function ThemeScript() {
  useEffect(() => {
    // Esta lógica se ejecuta en el cliente
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const savedTheme = localStorage.getItem('theme');
    
    const handleChange = () => {
      // Si el usuario ha elegido un tema, respetarlo
      if (savedTheme) {
        document.documentElement.classList.toggle('dark', savedTheme === 'dark');
      } else {
        // Si no, usar la preferencia del sistema
        document.documentElement.classList.toggle('dark', darkModeMediaQuery.matches);
      }
    };
    
    // Establecer el tema inicial
    handleChange();
    
    // Escuchar cambios en la preferencia del sistema
    darkModeMediaQuery.addEventListener('change', handleChange);
    
    return () => {
      darkModeMediaQuery.removeEventListener('change', handleChange);
    };
  }, []);
  
  return null;
}
