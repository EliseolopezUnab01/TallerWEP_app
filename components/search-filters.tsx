'use client';

import React from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

export type SearchFilterType = 'todos' | 'descripcion' | 'referencia' | 'oem' | 'etiquetas' | 'aplicacion';

interface SearchFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  searchFilter: SearchFilterType;
  onFilterChange: (filter: SearchFilterType) => void;
  compact?: boolean;
  className?: string;
}

const FILTER_OPTIONS: { value: SearchFilterType; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'descripcion', label: 'Descripción' },
  { value: 'referencia', label: 'Referencia' },
  { value: 'oem', label: 'OEM' },
  { value: 'etiquetas', label: 'Etiquetas' },
  { value: 'aplicacion', label: 'Aplicación' },
];

const PLACEHOLDERS: Record<SearchFilterType, string> = {
  todos: 'Buscar en todos los campos...',
  descripcion: 'Buscar por descripción o nombre...',
  referencia: 'Buscar por código de barras o ID...',
  oem: 'Buscar por código OEM...',
  etiquetas: 'Buscar por etiquetas...',
  aplicacion: 'Buscar por aplicación o marca...',
};

export function SearchFilters({
  searchTerm,
  onSearchChange,
  searchFilter,
  onFilterChange,
  compact = false,
  className = '',
}: SearchFiltersProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      {/* Input de búsqueda */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
        <Input
          placeholder={PLACEHOLDERS[searchFilter]}
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 bg-slate-950/80 border-slate-700/40 text-slate-100 placeholder:text-slate-500"
        />
      </div>

      {/* Filtros de búsqueda - estilo básico como ajuste-precios-v2 */}
      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-slate-500 self-center mr-2">Filtrar por:</span>
        {FILTER_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => onFilterChange(option.value)}
            className={`px-3 ${compact ? 'py-1' : 'py-1.5'} text-xs rounded-full transition-colors ${
              searchFilter === option.value
                ? 'bg-[#0e88c9] text-white'
                : 'bg-[#1e2a3b] text-slate-400 hover:bg-[#2a3a4b]'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// Función helper para filtrar productos con los filtros estándar
export function filterProductos<T extends {
  nombre?: string;
  descripcion?: string;
  codigo_barras?: string;
  idprod?: number;
  OE?: string;
  etiquetas?: string;
  aplicacion_marcas?: string;
  marca?: string;
  idprodprov?: string;
}>(
  productos: T[],
  searchTerm: string,
  searchFilter: SearchFilterType
): T[] {
  if (!searchTerm) return productos;
  const search = searchTerm.toLowerCase();

  return productos.filter((p) => {
    switch (searchFilter) {
      case 'descripcion':
        return (
          p.descripcion?.toLowerCase().includes(search) ||
          p.nombre?.toLowerCase().includes(search)
        );
      case 'referencia':
        return (
          p.codigo_barras?.toLowerCase().includes(search) ||
          String(p.idprod).includes(search) ||
          p.idprodprov?.toLowerCase().includes(search)
        );
      case 'oem':
        return p.OE?.toLowerCase().includes(search);
      case 'etiquetas':
        return p.etiquetas?.toLowerCase().includes(search);
      case 'aplicacion':
        return (
          p.aplicacion_marcas?.toLowerCase().includes(search) ||
          p.marca?.toLowerCase().includes(search)
        );
      default: // 'todos'
        return (
          p.nombre?.toLowerCase().includes(search) ||
          String(p.idprod).includes(search) ||
          p.codigo_barras?.toLowerCase().includes(search) ||
          p.descripcion?.toLowerCase().includes(search) ||
          p.OE?.toLowerCase().includes(search) ||
          p.etiquetas?.toLowerCase().includes(search) ||
          p.aplicacion_marcas?.toLowerCase().includes(search) ||
          p.marca?.toLowerCase().includes(search) ||
          p.idprodprov?.toLowerCase().includes(search)
        );
    }
  });
}
