'use client';

import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Save, Package, Calculator, Percent, DollarSign, TrendingUp, RefreshCw, ArrowLeft, ExternalLink } from 'lucide-react';
import { NotificationDropdown } from '@/components/notification-dropdown';
import { UserDropdown } from '@/components/user-dropdown';
import { useFloatingWindows } from '@/contexts/floating-windows-context';
import Image from 'next/image';
import { SearchFilters, filterProductos, SingleFilterType } from '@/components/search-filters';

// Tipos de precio según el sistema FoxPro (6 tipos)
const TIPOS_PRECIO = [
  { key: 'general', label: 'GENERAL', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  { key: 'cliente', label: 'CLIENTE', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  { key: 'mecanico', label: 'MECÁNICO', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  { key: 'minorista', label: 'MINORISTA', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  { key: 'mayorista', label: 'MAYORISTA', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  { key: 'especial', label: 'ESPECIAL', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
];

type ModoCalculo = 'porcentaje' | 'precio' | 'ganancia';

interface PrecioRow {
  tipoPrecio: string;
  label: string;
  modo: ModoCalculo;
  porcentaje: number;
  precio: number;
  ganancia: number;
  color: string;
}

interface ProductoSeleccionado {
  idprod: number;
  nombre: string;
  codigo_barras?: string;
  costo: number;
  costo_local: number;
  iva_pagado: number;
  imagen_principal?: string;
  // Datos adicionales para ventana flotante
  stock_contable?: number;
  stock_fisico?: number;
  OE?: string;
  marca?: string;
  categoria_nueva_nombre?: string;
  idprodprov?: string;
  codigo_jerarquico?: string | number;
}

interface ProductoLista {
  idprod: number;
  nombre: string;
  codigo_barras?: string;
  costo: number;
  imagen_principal?: string;
  descripcion?: string;
  OE?: string;
  etiquetas?: string;
  aplicacion_marcas?: string;
  marca?: string;
}

interface HistorialItem {
  idajuste: number;
  fecha: string;
  razon_justificacion: string;
  usuario_nombre?: string;
  precio1_anterior?: number;
  precio2_anterior?: number;
  precio3_anterior?: number;
  precio4_anterior?: number;
  precio5_anterior?: number;
  precio6_anterior?: number;
  precio7_anterior?: number;
  precio1_nuevo?: number;
  precio2_nuevo?: number;
  precio3_nuevo?: number;
  precio4_nuevo?: number;
  precio5_nuevo?: number;
  precio6_nuevo?: number;
  precio7_nuevo?: number;
}

export default function AjustePreciosV2Page() {
  const [productos, setProductos] = useState<ProductoLista[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilters, setSelectedFilters] = useState<SingleFilterType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Ventanas flotantes
  const { openFloatingWindow } = useFloatingWindows();
  
  // Producto seleccionado para ajustar precios
  const [productoSeleccionado, setProductoSeleccionado] = useState<ProductoSeleccionado | null>(null);
  
  // Estado de los 6 precios
  const [precios, setPrecios] = useState<PrecioRow[]>([]);
  
  // Justificación del ajuste
  const [razon, setRazon] = useState('');
  
  // Factores de impuestos
  const [factores, setFactores] = useState({ iva: 0.13, renta: 0.20 });
  
  // Historial de ajustes
  const [historial, setHistorial] = useState<HistorialItem[]>([]);

  // Cargar productos al iniciar
  useEffect(() => {
    fetchProductos();
  }, []);

  const fetchProductos = async () => {
    try {
      const response = await fetch('/api/productos');
      if (response.ok) {
        const data = await response.json();
        setProductos(data.products || []);
      }
    } catch (error) {
      console.error('Error al cargar productos:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar productos usando el componente SearchFilters
  const productosFiltrados = filterProductos(productos, searchTerm, selectedFilters);

  // Seleccionar producto para ajustar precios
  const seleccionarProducto = async (idprod: number) => {
    try {
      const response = await fetch(`/api/ajuste-precios?idprod=${idprod}`);
      if (response.ok) {
        const data = await response.json();
        const prod = data.producto;
        
        setProductoSeleccionado({
          idprod: prod.idprod,
          nombre: prod.nombre,
          codigo_barras: prod.codigo_barras,
          costo: parseFloat(prod.costo) || 0,
          costo_local: parseFloat(prod.costo_local) || parseFloat(prod.costo) || 0,
          iva_pagado: parseFloat(prod.iva_pagado) || 0,
          imagen_principal: prod.imagen_principal,
          // Datos adicionales para ventana flotante
          stock_contable: parseInt(prod.stock_contable) || 0,
          stock_fisico: parseInt(prod.stock_fisico) || 0,
          OE: prod.OE || '',
          marca: prod.marca || '',
          categoria_nueva_nombre: prod.categoria_nueva_nombre || '',
          idprodprov: prod.idprodprov || '',
          codigo_jerarquico: prod.codigo_jerarquico || ''
        });
        
        setFactores(data.factores);
        
        // Inicializar los 6 precios con los valores actuales
        const preciosIniciales: PrecioRow[] = TIPOS_PRECIO.map(tipo => ({
          tipoPrecio: tipo.key,
          label: tipo.label,
          modo: 'porcentaje' as ModoCalculo,
          porcentaje: parseFloat(prod[`porcentaje_${tipo.key}`]) || 0,
          precio: parseFloat(prod[`precio_${tipo.key}`]) || 0,
          ganancia: parseFloat(prod[`ganancia_${tipo.key}`]) || 0,
          color: tipo.color
        }));
        
        setPrecios(preciosIniciales);
        setRazon('');
        
        // Cargar historial de ajustes
        fetchHistorial(idprod);
      }
    } catch (error) {
      console.error('Error al cargar producto:', error);
    }
  };
  
  // Cargar historial de ajustes del producto
  const fetchHistorial = async (idprod: number) => {
    console.log('📜 Cargando historial para producto:', idprod);
    try {
      const response = await fetch(`/api/ajuste-precios/historial?idprod=${idprod}`);
      const data = await response.json();
      console.log('📜 Respuesta historial:', data);
      if (response.ok) {
        setHistorial(data.historial || []);
      } else {
        console.error('❌ Error en respuesta historial:', data);
        setHistorial([]);
      }
    } catch (error) {
      console.error('❌ Error al cargar historial:', error);
      setHistorial([]);
    }
  };

  // Calcular precio según el modo seleccionado
  const calcularPrecio = async (index: number, modo: ModoCalculo, valor: number) => {
    if (!productoSeleccionado) {
      console.log('❌ No hay producto seleccionado');
      return;
    }
    
    console.log('📊 Calculando precio:', { index, modo, valor, tipoPrecio: precios[index]?.tipoPrecio });
    
    try {
      const response = await fetch('/api/ajuste-precios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idprod: productoSeleccionado.idprod,
          modo,
          tipoPrecio: precios[index].tipoPrecio,
          valor
        })
      });
      
      const data = await response.json();
      console.log('📥 Respuesta API:', data);
      
      if (response.ok && data.resultado) {
        const resultado = data.resultado;
        console.log('✅ Resultado calculado:', resultado);
        
        setPrecios(prev => {
          const newPrecios = prev.map((p, i) => 
            i === index ? {
              ...p,
              modo,
              porcentaje: resultado.porcentaje,
              precio: resultado.precio,
              ganancia: resultado.ganancia
            } : p
          );
          console.log('📝 Nuevos precios:', newPrecios[index]);
          return newPrecios;
        });
      } else {
        console.error('❌ Error en respuesta:', data.error);
      }
    } catch (error) {
      console.error('❌ Error al calcular precio:', error);
    }
  };

  // Manejar cambio de modo de cálculo
  const handleModoChange = (index: number, modo: ModoCalculo) => {
    setPrecios(prev => prev.map((p, i) => 
      i === index ? { ...p, modo } : p
    ));
  };

  // Manejar cambio de valor según el modo
  const handleValorChange = (index: number, valor: number) => {
    const precio = precios[index];
    
    // Actualizar el valor local primero
    setPrecios(prev => prev.map((p, i) => {
      if (i !== index) return p;
      switch (precio.modo) {
        case 'porcentaje': return { ...p, porcentaje: valor };
        case 'precio': return { ...p, precio: valor };
        case 'ganancia': return { ...p, ganancia: valor };
        default: return p;
      }
    }));
  };

  // Calcular al perder foco o presionar Enter
  const handleValorBlur = (index: number) => {
    const precio = precios[index];
    if (!precio) {
      console.log('❌ No se encontró precio en index:', index);
      return;
    }
    
    let valor: number;
    
    switch (precio.modo) {
      case 'porcentaje': valor = precio.porcentaje; break;
      case 'precio': valor = precio.precio; break;
      case 'ganancia': valor = precio.ganancia; break;
      default: 
        console.log('❌ Modo no reconocido:', precio.modo);
        return;
    }
    
    console.log('🔄 handleValorBlur llamado:', { index, modo: precio.modo, valor });
    calcularPrecio(index, precio.modo, valor);
  };

  // Guardar todos los precios
  const guardarPrecios = async () => {
    if (!productoSeleccionado) return;
    
    if (!razon.trim()) {
      alert('⚠️ Debes proporcionar una razón/justificación para el ajuste');
      return;
    }
    
    setSaving(true);
    
    try {
      const response = await fetch('/api/ajuste-precios', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idprod: productoSeleccionado.idprod,
          precios: precios.map(p => ({
            tipoPrecio: p.tipoPrecio,
            modo: p.modo.toUpperCase(),
            precio: p.precio,
            porcentaje: p.porcentaje,
            ganancia: p.ganancia
          })),
          razon
        })
      });
      
      if (response.ok) {
        alert('✅ Precios guardados correctamente');
        setRazon('');
        // Recargar datos del producto
        seleccionarProducto(productoSeleccionado.idprod);
      } else {
        const data = await response.json();
        alert(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error al guardar:', error);
      alert('❌ Error al conectar con el servidor');
    } finally {
      setSaving(false);
    }
  };

  // Volver a la lista
  const volverALista = () => {
    setProductoSeleccionado(null);
    setPrecios([]);
    setRazon('');
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-surface-deep">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-white dark:from-surface-deep dark:via-surface-deep dark:to-surface-deep p-4">
        {/* Navbar */}
        <div className="rounded-xl border border-sky-200 dark:border-primary/30 bg-gradient-to-r from-white to-sky-50/50 dark:from-background dark:to-background px-5 py-3 flex items-center justify-between gap-4 shadow-[0_8px_24px_rgba(14,136,201,0.08)] dark:shadow-[0_0_25px_rgba(15,23,42,0.9)] mb-4">
          <div className="flex items-center gap-3">
            {productoSeleccionado && (
              <Button variant="ghost" size="icon" onClick={volverALista} className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Inventario</span>
            <span className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
            <span className="text-sm tracking-[0.18em] uppercase text-slate-700 dark:text-slate-200">
              {productoSeleccionado ? 'Ajuste de Precios' : 'Seleccionar Producto'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <NotificationDropdown />
            <UserDropdown />
          </div>
        </div>

        {!productoSeleccionado ? (
          /* VISTA: Lista de productos */
          <div className="space-y-4">
            {/* Buscador con filtros */}
            <SearchFilters
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              selectedFilters={selectedFilters}
              onFiltersChange={setSelectedFilters}
            />

            {/* Lista de productos */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {productosFiltrados.slice(0, 50).map(producto => (
                <Card 
                  key={producto.idprod}
                  className="bg-gradient-to-br from-white to-slate-50 dark:from-background dark:to-background border border-sky-200/80 dark:border-secondary shadow-[0_8px_24px_rgba(14,136,201,0.08)] dark:shadow-none hover:border-primary/60 hover:shadow-[0_12px_28px_rgba(14,136,201,0.14)] cursor-pointer transition-all"
                  onClick={() => seleccionarProducto(producto.idprod)}
                >
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="h-16 w-16 rounded-xl bg-slate-100 dark:bg-slate-900 flex-shrink-0 overflow-hidden border border-slate-200 dark:border-transparent">
                      {producto.imagen_principal ? (
                        <Image src={producto.imagen_principal} alt="" width={64} height={64} className="object-cover h-full w-full" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-8 w-8 text-slate-400 dark:text-slate-600" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 dark:text-slate-200 truncate">{producto.nombre}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">ID: {producto.idprod}</p>
                      <p className="text-sm text-emerald-600 dark:text-emerald-400 font-mono">Costo: ${Number(producto.costo || 0).toFixed(2)}</p>
                    </div>
                    <Calculator className="h-5 w-5 text-primary" />
                  </CardContent>
                </Card>
              ))}
            </div>

            {productosFiltrados.length === 0 && (
              <div className="text-center py-12">
                <Package className="mx-auto h-12 w-12 text-slate-400 dark:text-slate-600" />
                <p className="mt-2 text-slate-500 dark:text-slate-400">No se encontraron productos</p>
              </div>
            )}
          </div>
        ) : (
          /* VISTA: Formulario de ajuste de precios */
          <>
          {/* Buscador rápido para cambiar de producto sin salir */}
          <div className="mb-4 space-y-3">
            <SearchFilters
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              selectedFilters={selectedFilters}
              onFiltersChange={setSelectedFilters}
              compact
            />

            {/* Resultados de búsqueda rápida */}
            {searchTerm && productosFiltrados.length > 0 && (
              <div className="bg-white dark:bg-background border border-slate-200 dark:border-secondary rounded-lg max-h-48 overflow-y-auto">
                {productosFiltrados.slice(0, 10).map(producto => (
                  <div
                    key={producto.idprod}
                    onClick={() => {
                      seleccionarProducto(producto.idprod);
                      setSearchTerm('');
                    }}
                    className={`flex items-center gap-3 p-2 cursor-pointer hover:bg-sky-50 dark:hover:bg-secondary transition-colors ${
                      producto.idprod === productoSeleccionado?.idprod ? 'bg-primary/10 dark:bg-primary/20 border-l-2 border-primary' : ''
                    }`}
                  >
                    <div className="h-10 w-10 rounded bg-slate-100 dark:bg-slate-900 flex-shrink-0 overflow-hidden">
                      {producto.imagen_principal ? (
                        <Image src={producto.imagen_principal} alt="" width={40} height={40} className="object-cover h-full w-full" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-5 w-5 text-slate-400 dark:text-slate-600" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{producto.nombre}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">ID: {producto.idprod} | Costo: ${parseFloat(String(producto.costo) || '0').toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Info del producto */}
            <div className="lg:col-span-4">
              <Card className="bg-gradient-to-br from-white to-slate-50 dark:from-background dark:to-background border border-sky-200/80 dark:border-secondary shadow-[0_8px_24px_rgba(14,136,201,0.08)] dark:shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg text-slate-800 dark:text-slate-200">Información del Producto</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="h-20 w-20 rounded bg-slate-100 dark:bg-slate-900 overflow-hidden flex-shrink-0 border border-slate-200 dark:border-transparent">
                      {productoSeleccionado.imagen_principal ? (
                        <Image src={productoSeleccionado.imagen_principal} alt="" width={80} height={80} className="object-cover h-full w-full" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-10 w-10 text-slate-400 dark:text-slate-600" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 dark:text-slate-200">{productoSeleccionado.nombre}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">ID: {productoSeleccionado.idprod}</p>
                    </div>
                    {/* Botón ventana flotante */}
                    <Button 
                      size="sm" 
                      onClick={() => openFloatingWindow({ 
                        idprod: productoSeleccionado.idprod, 
                        nombre: productoSeleccionado.nombre,
                        imagen_principal: productoSeleccionado.imagen_principal,
                        costo: productoSeleccionado.costo,
                        codigo_barras: productoSeleccionado.codigo_barras,
                        stock_contable: productoSeleccionado.stock_contable,
                        stock_fisico: productoSeleccionado.stock_fisico,
                        OE: productoSeleccionado.OE,
                        marca: productoSeleccionado.marca,
                        categoria_nueva_nombre: productoSeleccionado.categoria_nueva_nombre,
                        idprodprov: productoSeleccionado.idprodprov,
                        codigo_jerarquico: productoSeleccionado.codigo_jerarquico,
                        precio1: precios[0]?.precio || 0,
                        precio2: precios[1]?.precio || 0,
                        precio3: precios[2]?.precio || 0,
                        precio4: precios[3]?.precio || 0,
                        precio5: precios[4]?.precio || 0,
                        precio6: precios[5]?.precio || 0
                      })}
                      className="h-8 px-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/20"
                      title="Abrir en ventana flotante"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <div>
                      <Label className="text-xs text-slate-500 dark:text-slate-400">Costo Base</Label>
                      <p className="text-lg font-mono text-slate-700 dark:text-slate-300">${productoSeleccionado.costo.toFixed(2)}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500 dark:text-slate-400">Costo Local</Label>
                      <p className="text-lg font-mono text-emerald-600 dark:text-emerald-400">${productoSeleccionado.costo_local.toFixed(2)}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500 dark:text-slate-400">IVA Pagado</Label>
                      <p className="text-lg font-mono text-slate-700 dark:text-slate-300">${productoSeleccionado.iva_pagado.toFixed(2)}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500 dark:text-slate-400">Factor IVA</Label>
                      <p className="text-lg font-mono text-slate-700 dark:text-slate-300">{(factores.iva * 100).toFixed(0)}%</p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                    <Label className="text-xs text-slate-500 dark:text-slate-400 mb-2 block">Factor Renta (Estimación)</Label>
                    <p className="text-lg font-mono text-amber-600 dark:text-yellow-400">{(factores.renta * 100).toFixed(0)}%</p>
                  </div>
                </CardContent>
              </Card>

              {/* Justificación */}
              <Card className="bg-gradient-to-br from-white to-slate-50 dark:from-background dark:to-background border border-sky-200/80 dark:border-secondary shadow-[0_8px_24px_rgba(14,136,201,0.08)] dark:shadow-none mt-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg text-slate-800 dark:text-slate-200">Justificación del Ajuste *</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="Explica el motivo del ajuste de precios..."
                    value={razon}
                    onChange={(e) => setRazon(e.target.value)}
                    className="bg-white dark:bg-card border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 min-h-[100px]"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Esta justificación se guardará en el historial</p>
                </CardContent>
              </Card>

              {/* Botón guardar */}
              <Button
                onClick={guardarPrecios}
                disabled={saving}
                className="w-full mt-4 h-12 bg-primary hover:bg-primary/90 text-white"
              >
                <Save className="h-5 w-5 mr-2" />
                {saving ? 'Guardando...' : 'Guardar Todos los Precios'}
              </Button>
            </div>

            {/* Tabla de precios */}
            <div className="lg:col-span-8">
              <Card className="bg-gradient-to-br from-white to-slate-50 dark:from-background dark:to-background border border-sky-200/80 dark:border-secondary shadow-[0_8px_24px_rgba(14,136,201,0.08)] dark:shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-primary" />
                    Ajuste de Precios - Fórmula FoxPro
                  </CardTitle>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Selecciona el modo de cálculo para cada tipo de precio: Porcentaje, Precio o Ganancia
                  </p>
                </CardHeader>
                <CardContent>
                  {/* Encabezados */}
                  <div className="grid grid-cols-12 gap-2 mb-2 px-2 text-xs font-medium text-slate-800 dark:text-slate-500 uppercase">
                    <div className="col-span-2">Tipo</div>
                    <div className="col-span-3 text-center">Modo</div>
                    <div className="col-span-2 text-center">% Porcentaje</div>
                    <div className="col-span-2 text-center">$ Precio</div>
                    <div className="col-span-2 text-center">$ Ganancia</div>
                    <div className="col-span-1"></div>
                  </div>

                  {/* Filas de precios */}
                  <div className="space-y-2">
                    {precios.map((precio, index) => (
                      <div 
                        key={precio.tipoPrecio}
                        className={`grid grid-cols-12 gap-2 items-center p-3 rounded-lg border ${precio.color}`}
                      >
                        {/* Tipo de precio */}
                        <div className="col-span-2">
                          <span className="font-semibold text-sm">{precio.label}</span>
                        </div>

                        {/* Selector de modo */}
                        <div className="col-span-3 flex gap-1">
                          <button
                            type="button"
                            onClick={() => handleModoChange(index, 'porcentaje')}
                            className={`px-2 py-1 text-xs rounded transition-colors ${
                              precio.modo === 'porcentaje' 
                                ? 'bg-primary text-white' 
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700'
                            }`}
                          >
                            <Percent className="h-3 w-3 inline mr-1" />%
                          </button>
                          <button
                            type="button"
                            onClick={() => handleModoChange(index, 'precio')}
                            className={`px-2 py-1 text-xs rounded transition-colors ${
                              precio.modo === 'precio' 
                                ? 'bg-primary text-white' 
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700'
                            }`}
                          >
                            <DollarSign className="h-3 w-3 inline mr-1" />$
                          </button>
                          <button
                            type="button"
                            onClick={() => handleModoChange(index, 'ganancia')}
                            className={`px-2 py-1 text-xs rounded transition-colors ${
                              precio.modo === 'ganancia' 
                                ? 'bg-primary text-white' 
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700'
                            }`}
                          >
                            <TrendingUp className="h-3 w-3 inline mr-1" />G
                          </button>
                        </div>

                        {/* Porcentaje */}
                        <div className="col-span-2">
                          <Input
                            type="number"
                            step="0.01"
                            value={precio.porcentaje || ''}
                            onChange={(e) => handleValorChange(index, e.target.value === '' ? 0 : parseFloat(e.target.value))}
                            onBlur={() => precio.modo === 'porcentaje' && handleValorBlur(index)}
                            onKeyDown={(e) => e.key === 'Enter' && precio.modo === 'porcentaje' && handleValorBlur(index)}
                            disabled={precio.modo !== 'porcentaje'}
                            className={`h-8 text-sm font-mono text-center ${
                              precio.modo === 'porcentaje' 
                                ? 'bg-sky-50 dark:bg-card border-primary text-slate-800 dark:text-white' 
                                : 'bg-slate-100 dark:bg-slate-900/50 border-slate-700 text-slate-800 dark:text-slate-500'
                            }`}
                          />
                        </div>

                        {/* Precio */}
                        <div className="col-span-2">
                          <Input
                            type="number"
                            step="0.01"
                            value={precio.precio || ''}
                            onChange={(e) => handleValorChange(index, e.target.value === '' ? 0 : parseFloat(e.target.value))}
                            onBlur={() => precio.modo === 'precio' && handleValorBlur(index)}
                            onKeyDown={(e) => e.key === 'Enter' && precio.modo === 'precio' && handleValorBlur(index)}
                            disabled={precio.modo !== 'precio'}
                            className={`h-8 text-sm font-mono text-center ${
                              precio.modo === 'precio' 
                                ? 'bg-sky-50 dark:bg-card border-primary text-slate-800 dark:text-white' 
                                : 'bg-slate-100 dark:bg-slate-900/50 border-slate-700 text-slate-800 dark:text-slate-500'
                            }`}
                          />
                        </div>

                        {/* Ganancia */}
                        <div className="col-span-2">
                          <Input
                            type="number"
                            step="0.01"
                            value={precio.ganancia || ''}
                            onChange={(e) => handleValorChange(index, e.target.value === '' ? 0 : parseFloat(e.target.value))}
                            onBlur={() => precio.modo === 'ganancia' && handleValorBlur(index)}
                            onKeyDown={(e) => e.key === 'Enter' && precio.modo === 'ganancia' && handleValorBlur(index)}
                            disabled={precio.modo !== 'ganancia'}
                            className={`h-8 text-sm font-mono text-center ${
                              precio.modo === 'ganancia' 
                                ? 'bg-sky-50 dark:bg-card border-primary text-slate-800 dark:text-white' 
                                : 'bg-slate-100 dark:bg-slate-900/50 border-slate-700 text-slate-800 dark:text-slate-500'
                            }`}
                          />
                        </div>

                        {/* Botón recalcular */}
                        <div className="col-span-1 flex justify-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleValorBlur(index)}
                            className="h-8 w-8 text-slate-400 hover:text-primary"
                            title="Recalcular"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Leyenda */}
                  <div className="mt-4 p-3 bg-slate-100 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-transparent">
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-2 font-medium">Fórmulas (Lógica FoxPro - El Salvador):</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <div>
                        <span className="text-primary">Por %:</span> Precio = CostoLocal × (1 + %/100)
                      </div>
                      <div>
                        <span className="text-primary">Por $:</span> % = ((Precio / CostoLocal) - 1) × 100
                      </div>
                      <div>
                        <span className="text-primary">Por G:</span> Precio = ((G + Costo) / 0.8 - IVA) / 0.87
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                      Ganancia = (Precio - IVA) × (1 - {(factores.renta * 100).toFixed(0)}%) - CostoLocal
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Historial de Ajustes - Ancho completo */}
          <Card className="bg-gradient-to-br from-white to-slate-50 dark:from-background dark:to-background border border-sky-200/80 dark:border-secondary shadow-[0_8px_24px_rgba(14,136,201,0.08)] dark:shadow-none mt-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-slate-800 dark:text-slate-200">Historial de Ajustes</CardTitle>
            </CardHeader>
            <CardContent>
              {historial.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-500 text-center py-4">No hay ajustes previos para este producto</p>
              ) : (
                <div className="space-y-4">
                  {historial.map((item) => (
                    <div key={item.idajuste} className="bg-slate-50 dark:bg-card border border-slate-200 dark:border-secondary rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span>📅</span>
                          <span>
                            {new Date(item.fecha).toLocaleDateString('es-SV', { 
                              day: '2-digit', month: 'long', year: 'numeric', 
                              hour: '2-digit', minute: '2-digit' 
                            })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span>👤</span>
                          <span>{item.usuario_nombre || 'Usuario'}</span>
                        </div>
                      </div>
                      
                      {/* Tabla de cambios de precios */}
                      <div className="mb-3 overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-secondary">
                              <th className="text-left py-2 px-3 text-slate-600 dark:text-slate-500 font-medium">Precio</th>
                              <th className="text-right py-2 px-3 text-red-500 dark:text-red-400 font-medium">Anterior</th>
                              <th className="text-center py-2 px-3 text-slate-500">→</th>
                              <th className="text-right py-2 px-3 text-emerald-600 dark:text-green-400 font-medium">Nuevo</th>
                              <th className="text-right py-2 px-3 text-slate-600 dark:text-slate-500 font-medium">Diferencia</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[
                              { nombre: 'General', anterior: item.precio1_anterior, nuevo: item.precio1_nuevo },
                              { nombre: 'Cliente', anterior: item.precio2_anterior, nuevo: item.precio2_nuevo },
                              { nombre: 'Mecánico', anterior: item.precio3_anterior, nuevo: item.precio3_nuevo },
                              { nombre: 'Minorista', anterior: item.precio4_anterior, nuevo: item.precio4_nuevo },
                              { nombre: 'Mayorista', anterior: item.precio5_anterior, nuevo: item.precio5_nuevo },
                              { nombre: 'Especial', anterior: item.precio6_anterior, nuevo: item.precio6_nuevo },
                            ].map((precio, idx) => {
                              const anteriorNum = Number(precio.anterior) || 0;
                              const nuevoNum = Number(precio.nuevo) || 0;
                              const diff = nuevoNum - anteriorNum;
                              const cambio = diff !== 0;
                              return (
                                <tr key={idx} className={`border-b border-slate-100 dark:border-secondary/50 ${cambio ? 'bg-sky-50 dark:bg-primary/5' : ''}`}>
                                  <td className="py-2 px-3 text-slate-700 dark:text-slate-300">{precio.nombre}</td>
                                  <td className="py-2 px-3 text-right font-mono text-red-400/80">
                                    ${anteriorNum.toFixed(2)}
                                  </td>
                                  <td className="py-2 px-3 text-center text-slate-600">→</td>
                                  <td className="py-2 px-3 text-right font-mono text-green-400">
                                    ${nuevoNum.toFixed(2)}
                                  </td>
                                  <td className={`py-2 px-3 text-right font-mono ${diff > 0 ? 'text-green-400' : diff < 0 ? 'text-red-400' : 'text-slate-800 dark:text-slate-500'}`}>
                                    {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      <div className="text-sm text-slate-700 dark:text-slate-300 pt-2 border-t border-slate-200 dark:border-secondary">
                        <span className="font-medium text-primary">Razón:</span>
                        <p className="mt-1 text-slate-500 dark:text-slate-400">{item.razon_justificacion || 'Sin justificación'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
