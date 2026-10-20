'use client';

import React from 'react';
import { Search, Check, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

export type SingleFilterType = 'nombre' | 'descripcion' | 'codigo' | 'oem' | 'etiquetas' | 'aplicacion';
export type SearchFilterType = 'todos' | SingleFilterType;

interface SearchFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedFilters?: SingleFilterType[];
  onFiltersChange?: (filters: SingleFilterType[]) => void;
  compact?: boolean;
  className?: string;
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

export const ALL_FILTERS: SingleFilterType[] = ['nombre', 'descripcion', 'codigo', 'oem', 'etiquetas', 'aplicacion'];

export function SearchFilters({
  searchTerm,
  onSearchChange,
  selectedFilters = [],
  onFiltersChange,
  compact = false,
  className = '',
}: SearchFiltersProps) {
  const isAllSelected = selectedFilters.length === 0;

  const toggleFilter = (filter: SingleFilterType) => {
    if (!onFiltersChange) return;
    if (selectedFilters.includes(filter)) {
      onFiltersChange(selectedFilters.filter((f) => f !== filter));
    } else {
      onFiltersChange([...selectedFilters, filter]);
    }
  };

  const selectAll = () => {
    if (!onFiltersChange) return;
    onFiltersChange([]);
  };

  const getPlaceholder = () => {
    if (isAllSelected) return 'Buscar en todos los campos...';
    const labels = selectedFilters.map((f) => FILTER_OPTIONS.find((o) => o.value === f)?.label || f);
    if (labels.length === 1) return `Buscar por ${labels[0].toLowerCase()}...`;
    return `Buscar por ${labels.slice(0, -1).join(', ')} y ${labels[labels.length - 1]}...`;
  };

  const chipBase = `px-3 ${compact ? 'py-1' : 'py-1.5'} text-xs rounded-full transition-colors flex items-center gap-1 shadow-sm`;
  const chipActive = 'bg-primary text-primary-foreground shadow-[0_4px_14px_rgba(14,136,201,0.35)]';
  const chipIdle =
    'bg-card dark:bg-secondary text-muted-foreground hover:bg-muted border border-border dark:border-transparent shadow-sm dark:shadow-none';

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-slate-500" />
        <Input
          placeholder={getPlaceholder()}
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 pr-10 bg-white dark:bg-slate-950/80 border-slate-300 dark:border-slate-700/40 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-sm dark:shadow-none"
        />
        {searchTerm && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            title="Limpiar búsqueda"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-slate-500 dark:text-slate-400 mr-1">Filtrar por:</span>

        <button
          onClick={selectAll}
          className={`${chipBase} ${isAllSelected ? chipActive : chipIdle}`}
        >
          {isAllSelected && <Check className="h-3 w-3" />}
          Todos
        </button>

        {FILTER_OPTIONS.map((option) => {
          const isSelected = selectedFilters.includes(option.value);
          return (
            <button
              key={option.value}
              onClick={() => toggleFilter(option.value)}
              className={`${chipBase} ${isSelected ? chipActive : chipIdle}`}
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

  const words = searchTerm.toLowerCase().trim().split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return productos;

  const activeFilters = filters.length === 0 ? ALL_FILTERS : filters;

  return productos.filter((p) => {
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

    const combinedText = activeFilters.map((f) => getFieldText(f)).join(' ').toLowerCase();
    return words.every((word) => combinedText.includes(word));
  });
}
