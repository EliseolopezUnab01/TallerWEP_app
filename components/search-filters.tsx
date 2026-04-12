'use client';

import React from 'react';
import { Search, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';

// Tipos de filtro individuales
export type SingleFilterType = 'nombre' | 'descripcion' | 'codigo' | 'oem' | 'etiquetas' | 'aplicacion';

// Para compatibilidad con código existente
export type SearchFilterType = 'todos' | SingleFilterType;

interface SearchFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  // Props para selección múltiple
  selectedFilters?: SingleFilterType[];
  onFiltersChange?: (filters: SingleFilterType[]) => void;
  compact?: boolean;
  className?: string;
  // Props legacy para compatibilidad (se ignoran si se usan selectedFilters)
  searchFilter?: SearchFilterType;
  onFilterChange?: (filter: SearchFilterType) => void;
}

const FILTER_OPTIONS: { value: SingleFilterType; label: string }[] = [
  { value: 'nombre', label: 'Nombre' },
  { value: 'descripcion', label: 'Descripción' },
  { value: 'codigo', label: 'Código' },
  { value: 'oem', label: 'OEM' },
  { value: 'etiquetas', label: 'Etiquetas' },
  { value: 'aplicacion', label: 'Aplicación' },
];

// Todos los filtros para cuando no hay ninguno seleccionado (busca en todo)
export const ALL_FILTERS: SingleFilterType[] = ['nombre', 'descripcion', 'codigo', 'oem', 'etiquetas', 'aplicacion'];

export function SearchFilters({
  searchTerm,
  onSearchChange,
  selectedFilters = [],
  onFiltersChange,
  compact = false,
  className = '',
}: SearchFiltersProps) {
  // Si no hay filtros seleccionados, se busca en todos
  const activeFilters = selectedFilters.length === 0 ? ALL_FILTERS : selectedFilters;
  const isAllSelected = selectedFilters.length === 0;

  const toggleFilter = (filter: SingleFilterType) => {
    if (!onFiltersChange) return;
    
    if (selectedFilters.includes(filter)) {
      // Quitar filtro
      onFiltersChange(selectedFilters.filter(f => f !== filter));
    } else {
      // Agregar filtro
      onFiltersChange([...selectedFilters, filter]);
    }
  };

  const selectAll = () => {
    if (!onFiltersChange) return;
    onFiltersChange([]); // Array vacío = buscar en todos
  };

  // Generar placeholder dinámico
  const getPlaceholder = () => {
    if (isAllSelected) return 'Buscar en todos los campos...';
    const labels = selectedFilters.map(f => FILTER_OPTIONS.find(o => o.value === f)?.label || f);
    if (labels.length === 1) return `Buscar por ${labels[0].toLowerCase()}...`;
    return `Buscar por ${labels.slice(0, -1).join(', ')} y ${labels[labels.length - 1]}...`;
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Input de búsqueda */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
        <Input
          placeholder={getPlaceholder()}
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 bg-slate-950/80 border-slate-700/40 text-slate-100 placeholder:text-slate-500"
        />
      </div>

      {/* Filtros de búsqueda - selección múltiple */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-slate-500 mr-1">Filtrar por:</span>
        
        {/* Botón Todos */}
        <button
          onClick={selectAll}
          className={`px-3 ${compact ? 'py-1' : 'py-1.5'} text-xs rounded-full transition-colors flex items-center gap-1 ${
            isAllSelected
              ? 'bg-[#0e88c9] text-white'
              : 'bg-[#1e2a3b] text-slate-400 hover:bg-[#2a3a4b]'
          }`}
        >
          {isAllSelected && <Check className="h-3 w-3" />}
          Todos
        </button>

        {/* Filtros individuales */}
        {FILTER_OPTIONS.map((option) => {
          const isSelected = selectedFilters.includes(option.value);
          return (
            <button
              key={option.value}
              onClick={() => toggleFilter(option.value)}
              className={`px-3 ${compact ? 'py-1' : 'py-1.5'} text-xs rounded-full transition-colors flex items-center gap-1 ${
                isSelected
                  ? 'bg-[#0e88c9] text-white'
                  : 'bg-[#1e2a3b] text-slate-400 hover:bg-[#2a3a4b]'
              }`}
            >
              {isSelected && <Check className="h-3 w-3" />}
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Función helper para filtrar productos (para uso local, el servidor ya filtra)
// Búsqueda flexible: cada palabra debe encontrarse en algún campo, sin importar el orden
// Ejemplo: "hi crem" encuentra "Cremallera Toyota Hilux" porque "hi" está en Hilux y "crem" en Cremallera
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
  idprodpaquete?: string;
  idprodfisico?: string;
}>(
  productos: T[],
  searchTerm: string,
  filters: SingleFilterType[] = ALL_FILTERS
): T[] {
  if (!searchTerm.trim()) return productos;
  
  // Dividir en palabras individuales
  const words = searchTerm.toLowerCase().trim().split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return productos;
  
  const activeFilters = filters.length === 0 ? ALL_FILTERS : filters;

  return productos.filter((p) => {
    // Construir texto combinado de todos los campos activos
    const getFieldText = (filter: SingleFilterType): string => {
      switch (filter) {
        case 'nombre':
          return p.nombre || '';
        case 'descripcion':
          return p.descripcion || '';
        case 'codigo':
          return [p.codigo_barras, String(p.idprod || ''), p.idprodprov, p.idprodpaquete, p.idprodfisico].filter(Boolean).join(' ');
        case 'oem':
          return p.OE || '';
        case 'etiquetas':
          return p.etiquetas || '';
        case 'aplicacion':
          return [p.aplicacion_marcas, p.marca].filter(Boolean).join(' ');
        default:
          return '';
      }
    };
    
    // Combinar todos los campos activos en un solo texto
    const combinedText = activeFilters.map(f => getFieldText(f)).join(' ').toLowerCase();
    
    // CADA palabra debe encontrarse en el texto combinado
    return words.every(word => combinedText.includes(word));
  });
}
