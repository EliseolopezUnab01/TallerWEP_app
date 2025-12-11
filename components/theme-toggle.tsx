'use client';

import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/app/theme-provider';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  
  // Función para cambiar el tema
  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  };

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggleTheme}
      className="border-[#0e88c9]/30 bg-transparent text-slate-300 hover:text-[#0e88c9]"
      title={theme === 'dark' ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
    >
      {theme === 'dark' ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </Button>
  );
}
