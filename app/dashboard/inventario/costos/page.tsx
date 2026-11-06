'use client';
import { BarraPantalla } from '@/components/barra-pantalla';
import { avisar } from '@/components/ui/avisos';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, DollarSign, Package, Save, RefreshCw, History, TrendingUp, FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { SearchFilters, SingleFilterType } from '@/components/search-filters';
import { useBuscarProductos } from '@/lib/buscar-productos';
import { useSesion } from '@/lib/sesion-cliente';

interface Producto {
  idprod: number;
  nombre: string;
  descripcion: string;
  OE: string;
  marca: string;
  imagen_principal: string;
  stock_contable: number;
}

interface Costo {
  idcosto: number;
  idprod: number;
  nofactura: string | null;
  dt_compra: string | null;
  costo: string;
  costo_proveedor: string;
  costo_promedio: string;
  costo_local: string;
  iva_pagado: string;
  costo_previo1: string;
  costo_previo2: string;
  costop_previo1: string;
  costop_previo2: string;
  costolcl_previo1: string;
  costolcl_previo2: string;
  costo_local_promedio: string;
  producto_nombre?: string;
}

export default function CostosPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilters, setSelectedFilters] = useState<SingleFilterType[]>([]);
  const { puede } = useSesion();
  const { productos: productosFiltrados, total: totalProductos, inicial: loading } =
    useBuscarProductos<Producto>(searchTerm, selectedFilters);
  const [saving, setSaving] = useState(false);
  const [productoSeleccionado, setProductoSeleccionado] = useState<Producto | null>(null);
  const [costoData, setCostoData] = useState<Costo | null>(null);
  const [formData, setFormData] = useState({
    costo: '',
    costo_proveedor: '',
    costo_local: '',
    iva_pagado: '',
    nofactura: '',
    dt_compra: ''
  });

  const fetchCosto = async (idprod: number) => {
    try {
      const response = await fetch(`/api/costos?idprod=${idprod}`);
      if (response.ok) {
        const data = await response.json();
        setCostoData(data.costo);
        setFormData({
          costo: data.costo?.costo || '0',
          costo_proveedor: data.costo?.costo_proveedor || '0',
          costo_local: data.costo?.costo_local || '0',
          iva_pagado: data.costo?.iva_pagado || '0',
          nofactura: data.costo?.nofactura || '',
          dt_compra: data.costo?.dt_compra ? data.costo.dt_compra.split('T')[0] : ''
        });
      }
    } catch (error) {
      console.error('Error al cargar costo:', error);
    }
  };

  const handleSelectProducto = (producto: Producto) => {
    setProductoSeleccionado(producto);
    fetchCosto(producto.idprod);
  };

  const handleSave = async () => {
    if (!productoSeleccionado) return;
    
    setSaving(true);
    try {
      const response = await fetch('/api/costos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idprod: productoSeleccionado.idprod,
          costo: parseFloat(formData.costo) || 0,
          costo_local: parseFloat(formData.costo_local) || parseFloat(formData.costo) || 0,
          costo_proveedor: parseFloat(formData.costo_proveedor) || 0,
          iva_pagado: parseFloat(formData.iva_pagado) || 0,
          nofactura: formData.nofactura || null,
          dt_compra: formData.dt_compra || null
        })
      });

      if (response.ok) {
        avisar('Costo actualizado correctamente');
        fetchCosto(productoSeleccionado.idprod);
      } else {
        avisar('Error al guardar el costo');
      }
    } catch (error) {
      console.error('Error:', error);
      avisar('Error al guardar el costo');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-slate-200">Cargando...</div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-white dark:from-surface-deep dark:via-surface-deep dark:to-surface-deep p-6">
        <div className="space-y-6">
          {/* Navbar superior */}
          <BarraPantalla modulo="Inventario" titulo="Gestión de costos" />

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Gestión de Costos</h1>
              <p className="text-slate-400">Administra los costos de los productos</p>
            </div>
            <Badge variant="outline" className="text-primary border-primary/50">
              <DollarSign className="h-4 w-4 mr-1" />
              {totalProductos} productos
            </Badge>
          </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Panel izquierdo - Lista de productos */}
          <Card className="lg:col-span-1 bg-gradient-to-br from-white to-slate-50 dark:from-card dark:to-background border border-sky-200/70 dark:border-primary/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-primary">Seleccionar Producto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <SearchFilters
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                selectedFilters={selectedFilters}
                onFiltersChange={setSelectedFilters}
                compact={true}
              />
              
              <div className="max-h-[500px] overflow-y-auto space-y-2">
                {productosFiltrados.slice(0, 50).map(producto => (
                  <div
                    key={producto.idprod}
                    onClick={() => handleSelectProducto(producto)}
                    className={`p-3 rounded-lg cursor-pointer transition-all ${
                      productoSeleccionado?.idprod === producto.idprod
                        ? 'bg-primary/20 border border-primary/50'
                        : 'bg-slate-100 dark:bg-slate-900/50 hover:bg-slate-800/50 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-800 rounded-lg overflow-hidden flex-shrink-0">
                        {producto.imagen_principal ? (
                          <Image
                            src={producto.imagen_principal}
                            alt={producto.nombre}
                            width={40}
                            height={40}
                            className="object-cover w-full h-full"
                          />
                        ) : (
                          <Package className="w-full h-full p-2 text-slate-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-200 truncate">{producto.nombre}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">OE: {producto.OE}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Panel derecho - Formulario de costos */}
          <Card className="lg:col-span-2 bg-gradient-to-br from-white to-slate-50 dark:from-card dark:to-background border border-sky-200/70 dark:border-primary/30">
            <CardHeader>
              <CardTitle className="text-lg text-slate-100 flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-emerald-400" />
                {productoSeleccionado ? productoSeleccionado.nombre : 'Selecciona un producto'}
              </CardTitle>
              <CardDescription>
                {productoSeleccionado ? `OE: ${productoSeleccionado.OE} | Marca: ${productoSeleccionado.marca}` : 'Haz clic en un producto de la lista'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {productoSeleccionado ? (
                <div className="space-y-6">
                  {/* Costos principales */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-slate-400">Costo (Factura)</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400">$</span>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.costo}
                          onChange={(e) => setFormData({...formData, costo: e.target.value})}
                          className="pl-7 bg-white dark:bg-slate-950/80 border-slate-300 dark:border-slate-700/40 text-slate-800 dark:text-slate-100"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-400">Costo Proveedor</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400">$</span>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.costo_proveedor}
                          onChange={(e) => setFormData({...formData, costo_proveedor: e.target.value})}
                          className="pl-7 bg-white dark:bg-slate-950/80 border-slate-300 dark:border-slate-700/40 text-slate-800 dark:text-slate-100"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-400">Costo Local</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400">$</span>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.costo_local}
                          onChange={(e) => setFormData({...formData, costo_local: e.target.value})}
                          className="pl-7 bg-white dark:bg-slate-950/80 border-slate-300 dark:border-slate-700/40 text-slate-800 dark:text-slate-100"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-400">IVA Pagado</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400">$</span>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.iva_pagado}
                          onChange={(e) => setFormData({...formData, iva_pagado: e.target.value})}
                          className="pl-7 bg-white dark:bg-slate-950/80 border-slate-300 dark:border-slate-700/40 text-slate-800 dark:text-slate-100"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-400">No. Factura</Label>
                      <Input
                        type="text"
                        value={formData.nofactura}
                        onChange={(e) => setFormData({...formData, nofactura: e.target.value})}
                        placeholder="FAC-001"
                        className="bg-white dark:bg-slate-950/80 border-slate-300 dark:border-slate-700/40 text-slate-800 dark:text-slate-100"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-400">Fecha Compra</Label>
                      <Input
                        type="date"
                        value={formData.dt_compra}
                        onChange={(e) => setFormData({...formData, dt_compra: e.target.value})}
                        className="bg-white dark:bg-slate-950/80 border-slate-300 dark:border-slate-700/40 text-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </div>

                  {/* Información de respaldos */}
                  {costoData && (
                    <div className="p-4 bg-slate-100 dark:bg-slate-900/50 rounded-lg border border-slate-700/30">
                      <div className="flex items-center gap-2 mb-3">
                        <History className="h-4 w-4 text-amber-400" />
                        <span className="text-sm font-medium text-slate-300">Historial de Respaldos</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        {[
                          ['Costo promedio', costoData.costo_local_promedio || costoData.costo_promedio],
                          ['Costo previo 1', costoData.costo_previo1],
                          ['Costo previo 2', costoData.costo_previo2],
                          ['Promedio previo 1', costoData.costop_previo1],
                          ['Local previo 1', costoData.costolcl_previo1],
                          ['Local previo 2', costoData.costolcl_previo2],
                          ['Promedio previo 2', costoData.costop_previo2],
                        ].map(([etiqueta, valor]) => (
                          <div key={etiqueta}>
                            <span className="text-slate-800 dark:text-slate-500">{etiqueta}:</span>
                            <span className="text-slate-700 dark:text-slate-300 ml-2 font-mono">${parseFloat(valor || '0').toFixed(4)}</span>
                          </div>
                        ))}
                        <div>
                          <span className="text-slate-800 dark:text-slate-500">Última compra:</span>
                          <span className="text-slate-700 dark:text-slate-300 ml-2">{costoData.dt_compra ? new Date(costoData.dt_compra).toLocaleDateString() : '-'}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Botón guardar */}
                  <div className="flex items-center justify-end gap-3">
                    <span className="text-xs text-slate-500">
                      Las compras y el retaceo actualizan el costo solos. Corregir a mano deja el costo actual como respaldo.
                    </span>
                    <Button
                      onClick={handleSave}
                      disabled={saving || !puede('costos.editar')}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      {saving ? (
                        <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Guardando...</>
                      ) : (
                        <><Save className="h-4 w-4 mr-2" /> Corregir costo</>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-slate-800 dark:text-slate-500">
                  <Package className="h-16 w-16 mb-4 opacity-50" />
                  <p>Selecciona un producto de la lista para ver y editar sus costos</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        </div>
      </div>
    </>
  );
}
