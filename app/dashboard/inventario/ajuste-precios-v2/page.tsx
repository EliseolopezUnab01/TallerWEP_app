'use client';

import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Save, Package, Calculator, Percent, DollarSign, TrendingUp, RefreshCw, ArrowLeft } from 'lucide-react';
import { NotificationDropdown } from '@/components/notification-dropdown';
import { UserDropdown } from '@/components/user-dropdown';
import Image from 'next/image';

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
}

interface ProductoLista {
  idprod: number;
  nombre: string;
  codigo_barras?: string;
  costo: number;
  imagen_principal?: string;
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
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

  // Filtrar productos por búsqueda
  const productosFiltrados = productos.filter(p => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      p.nombre?.toLowerCase().includes(search) ||
      String(p.idprod).includes(search) ||
      p.codigo_barras?.toLowerCase().includes(search)
    );
  });

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
          imagen_principal: prod.imagen_principal
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
        <div className="flex items-center justify-center h-screen bg-[#0a0f1a]">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-[#0e88c9]"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-[#0a0f1a] p-4">
        {/* Navbar */}
        <div className="rounded-xl border border-[#0e88c9]/30 bg-[#0d1523] px-5 py-3 flex items-center justify-between gap-4 shadow-[0_0_25px_rgba(15,23,42,0.9)] mb-4">
          <div className="flex items-center gap-3">
            {productoSeleccionado && (
              <Button variant="ghost" size="icon" onClick={volverALista} className="text-slate-400 hover:text-slate-200">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Inventario</span>
            <span className="h-6 w-px bg-slate-700" />
            <span className="text-sm tracking-[0.18em] uppercase text-slate-200">
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
            {/* Buscador */}
            <div className="relative max-w-xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
              <Input
                placeholder="Buscar producto por nombre, código o código de barras..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-12 bg-[#0d1523] border-[#1e2a3b] text-slate-200"
              />
            </div>

            {/* Lista de productos */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {productosFiltrados.slice(0, 50).map(producto => (
                <Card 
                  key={producto.idprod}
                  className="bg-[#0d1523] border-[#1e2a3b] hover:border-[#0e88c9]/50 cursor-pointer transition-colors"
                  onClick={() => seleccionarProducto(producto.idprod)}
                >
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="h-16 w-16 rounded bg-slate-900 flex-shrink-0 overflow-hidden">
                      {producto.imagen_principal ? (
                        <Image src={producto.imagen_principal} alt="" width={64} height={64} className="object-cover h-full w-full" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-8 w-8 text-slate-600" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-200 truncate">{producto.nombre}</p>
                      <p className="text-xs text-slate-500">ID: {producto.idprod}</p>
                      <p className="text-sm text-emerald-400 font-mono">Costo: ${parseFloat(producto.costo || 0).toFixed(2)}</p>
                    </div>
                    <Calculator className="h-5 w-5 text-[#0e88c9]" />
                  </CardContent>
                </Card>
              ))}
            </div>

            {productosFiltrados.length === 0 && (
              <div className="text-center py-12">
                <Package className="mx-auto h-12 w-12 text-slate-600" />
                <p className="mt-2 text-slate-400">No se encontraron productos</p>
              </div>
            )}
          </div>
        ) : (
          /* VISTA: Formulario de ajuste de precios */
          <>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Info del producto */}
            <div className="lg:col-span-4">
              <Card className="bg-[#0d1523] border-[#1e2a3b]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg text-slate-200">Información del Producto</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="h-20 w-20 rounded bg-slate-900 overflow-hidden">
                      {productoSeleccionado.imagen_principal ? (
                        <Image src={productoSeleccionado.imagen_principal} alt="" width={80} height={80} className="object-cover h-full w-full" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-10 w-10 text-slate-600" />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-200">{productoSeleccionado.nombre}</p>
                      <p className="text-xs text-slate-500">ID: {productoSeleccionado.idprod}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-700">
                    <div>
                      <Label className="text-xs text-slate-500">Costo Base</Label>
                      <p className="text-lg font-mono text-slate-300">${productoSeleccionado.costo.toFixed(2)}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Costo Local</Label>
                      <p className="text-lg font-mono text-emerald-400">${productoSeleccionado.costo_local.toFixed(2)}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">IVA Pagado</Label>
                      <p className="text-lg font-mono text-slate-300">${productoSeleccionado.iva_pagado.toFixed(2)}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Factor IVA</Label>
                      <p className="text-lg font-mono text-slate-300">{(factores.iva * 100).toFixed(0)}%</p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-700">
                    <Label className="text-xs text-slate-500 mb-2 block">Factor Renta (Estimación)</Label>
                    <p className="text-lg font-mono text-yellow-400">{(factores.renta * 100).toFixed(0)}%</p>
                  </div>
                </CardContent>
              </Card>

              {/* Justificación */}
              <Card className="bg-[#0d1523] border-[#1e2a3b] mt-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg text-slate-200">Justificación del Ajuste *</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="Explica el motivo del ajuste de precios..."
                    value={razon}
                    onChange={(e) => setRazon(e.target.value)}
                    className="bg-[#141e2e] border-slate-700 text-slate-200 min-h-[100px]"
                  />
                  <p className="text-xs text-slate-500 mt-2">Esta justificación se guardará en el historial</p>
                </CardContent>
              </Card>

              {/* Botón guardar */}
              <Button
                onClick={guardarPrecios}
                disabled={saving}
                className="w-full mt-4 h-12 bg-[#0e88c9] hover:bg-[#0e88c9]/90 text-white"
              >
                <Save className="h-5 w-5 mr-2" />
                {saving ? 'Guardando...' : 'Guardar Todos los Precios'}
              </Button>
            </div>

            {/* Tabla de precios */}
            <div className="lg:col-span-8">
              <Card className="bg-[#0d1523] border-[#1e2a3b]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg text-slate-200 flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-[#0e88c9]" />
                    Ajuste de Precios - Fórmula FoxPro
                  </CardTitle>
                  <p className="text-xs text-slate-500">
                    Selecciona el modo de cálculo para cada tipo de precio: Porcentaje, Precio o Ganancia
                  </p>
                </CardHeader>
                <CardContent>
                  {/* Encabezados */}
                  <div className="grid grid-cols-12 gap-2 mb-2 px-2 text-xs font-medium text-slate-500 uppercase">
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
                                ? 'bg-[#0e88c9] text-white' 
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                            }`}
                          >
                            <Percent className="h-3 w-3 inline mr-1" />%
                          </button>
                          <button
                            type="button"
                            onClick={() => handleModoChange(index, 'precio')}
                            className={`px-2 py-1 text-xs rounded transition-colors ${
                              precio.modo === 'precio' 
                                ? 'bg-[#0e88c9] text-white' 
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                            }`}
                          >
                            <DollarSign className="h-3 w-3 inline mr-1" />$
                          </button>
                          <button
                            type="button"
                            onClick={() => handleModoChange(index, 'ganancia')}
                            className={`px-2 py-1 text-xs rounded transition-colors ${
                              precio.modo === 'ganancia' 
                                ? 'bg-[#0e88c9] text-white' 
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
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
                                ? 'bg-[#141e2e] border-[#0e88c9] text-white' 
                                : 'bg-slate-900/50 border-slate-700 text-slate-500'
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
                                ? 'bg-[#141e2e] border-[#0e88c9] text-white' 
                                : 'bg-slate-900/50 border-slate-700 text-slate-500'
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
                                ? 'bg-[#141e2e] border-[#0e88c9] text-white' 
                                : 'bg-slate-900/50 border-slate-700 text-slate-500'
                            }`}
                          />
                        </div>

                        {/* Botón recalcular */}
                        <div className="col-span-1 flex justify-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleValorBlur(index)}
                            className="h-8 w-8 text-slate-400 hover:text-[#0e88c9]"
                            title="Recalcular"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Leyenda */}
                  <div className="mt-4 p-3 bg-slate-900/50 rounded-lg">
                    <p className="text-xs text-slate-400 mb-2 font-medium">Fórmulas (Lógica FoxPro - El Salvador):</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-slate-500">
                      <div>
                        <span className="text-[#0e88c9]">Por %:</span> Precio = CostoLocal × (1 + %/100)
                      </div>
                      <div>
                        <span className="text-[#0e88c9]">Por $:</span> % = ((Precio / CostoLocal) - 1) × 100
                      </div>
                      <div>
                        <span className="text-[#0e88c9]">Por G:</span> Precio = ((G + Costo) / 0.8 - IVA) / 0.87
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      Ganancia = (Precio - IVA) × (1 - {(factores.renta * 100).toFixed(0)}%) - CostoLocal
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Historial de Ajustes - Ancho completo */}
          <Card className="bg-[#0d1523] border-[#1e2a3b] mt-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-slate-200">Historial de Ajustes</CardTitle>
            </CardHeader>
            <CardContent>
              {historial.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">No hay ajustes previos para este producto</p>
              ) : (
                <div className="space-y-4">
                  {historial.map((item) => (
                    <div key={item.idajuste} className="bg-[#141e2e] border border-[#1e2a3b] rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span>📅</span>
                          <span>
                            {new Date(item.fecha).toLocaleDateString('es-SV', { 
                              day: '2-digit', month: 'long', year: 'numeric', 
                              hour: '2-digit', minute: '2-digit' 
                            })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span>👤</span>
                          <span>{item.usuario_nombre || 'Usuario'}</span>
                        </div>
                      </div>
                      
                      {/* Tabla de cambios de precios */}
                      <div className="mb-3 overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-[#1e2a3b]">
                              <th className="text-left py-2 px-3 text-slate-500 font-medium">Precio</th>
                              <th className="text-right py-2 px-3 text-red-400 font-medium">Anterior</th>
                              <th className="text-center py-2 px-3 text-slate-500">→</th>
                              <th className="text-right py-2 px-3 text-green-400 font-medium">Nuevo</th>
                              <th className="text-right py-2 px-3 text-slate-500 font-medium">Diferencia</th>
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
                                <tr key={idx} className={`border-b border-[#1e2a3b]/50 ${cambio ? 'bg-[#0e88c9]/5' : ''}`}>
                                  <td className="py-2 px-3 text-slate-300">{precio.nombre}</td>
                                  <td className="py-2 px-3 text-right font-mono text-red-400/80">
                                    ${anteriorNum.toFixed(2)}
                                  </td>
                                  <td className="py-2 px-3 text-center text-slate-600">→</td>
                                  <td className="py-2 px-3 text-right font-mono text-green-400">
                                    ${nuevoNum.toFixed(2)}
                                  </td>
                                  <td className={`py-2 px-3 text-right font-mono ${diff > 0 ? 'text-green-400' : diff < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                                    {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      <div className="text-sm text-slate-300 pt-2 border-t border-[#1e2a3b]">
                        <span className="font-medium text-[#0e88c9]">Razón:</span>
                        <p className="mt-1 text-slate-400">{item.razon_justificacion || 'Sin justificación'}</p>
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
