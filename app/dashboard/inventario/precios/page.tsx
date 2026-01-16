'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Save, Package } from 'lucide-react';
import Image from 'next/image';
import { NotificationDropdown } from '@/components/notification-dropdown';
import { UserDropdown } from '@/components/user-dropdown';

interface Producto {
  idprod: number;
  nombre: string;
  codigo_barras: string;
  // Costo
  costo: number;
  // 7 tipos de precios
  precio1: number; // GENERAL, ALTO
  precio2: number; // MAYORISTA (con contrato)
  precio3: number; // CLIENTE
  precio4: number; // MECANICO o MINORISTA
  precio5: number; // MAYORISTA
  precio6: number; // INVERSOR
  precio7: number; // ESPECIAL
  imagen_principal?: string;
}

export default function EditarPreciosPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [productosFiltrados, setProductosFiltrados] = useState<Producto[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [preciosAutomaticos, setPreciosAutomaticos] = useState<{[key: string]: boolean}>({});
  const [porcentajeGanancia, setPorcentajeGanancia] = useState<{[key: string]: number}>({});
  const [preciosBloqueados, setPreciosBloqueados] = useState<{[key: number]: boolean}>({});

  useEffect(() => {
    fetchProductos();
  }, []);

  useEffect(() => {
    filterProductos();
  }, [searchTerm, productos]);

  const fetchProductos = async () => {
    try {
      console.log('🔄 Cargando productos...');
      const response = await fetch('/api/productos');
      console.log('Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Data recibida:', data);
        
        // La API devuelve { products: [...] }, extraer el array
        const productosArray = Array.isArray(data.products) ? data.products : [];
        console.log('✅ Productos cargados:', productosArray.length);
        
        // Bloquear automáticamente los productos que ya tienen precios guardados
        const bloqueados: {[key: number]: boolean} = {};
        productosArray.forEach(producto => {
          // Si el producto tiene al menos un precio diferente de 0, está bloqueado
          const tienePreciosGuardados = 
            (producto.precio1 && producto.precio1 > 0) ||
            (producto.precio2 && producto.precio2 > 0) ||
            (producto.precio3 && producto.precio3 > 0) ||
            (producto.precio4 && producto.precio4 > 0) ||
            (producto.precio5 && producto.precio5 > 0) ||
            (producto.precio6 && producto.precio6 > 0) ||
            (producto.precio7 && producto.precio7 > 0);
          
          if (tienePreciosGuardados) {
            bloqueados[producto.idprod] = true;
            console.log(`🔒 Producto ${producto.idprod} bloqueado (tiene precios guardados)`);
          }
        });
        
        setPreciosBloqueados(bloqueados);
        
        if (productosArray.length > 0) {
          console.log('📦 Ejemplo de producto:', productosArray[0]);
          console.log('Precios del primer producto:', {
            precio1: productosArray[0].precio1,
            precio2: productosArray[0].precio2,
            precio3: productosArray[0].precio3,
            precio4: productosArray[0].precio4,
            precio5: productosArray[0].precio5,
            precio6: productosArray[0].precio6,
            precio7: productosArray[0].precio7,
          });
        }
        
        setProductos(productosArray);
        setProductosFiltrados(productosArray);
      } else {
        console.error('❌ Error en response:', response.status);
      }
    } catch (error) {
      console.error('❌ Error al cargar productos:', error);
      setProductos([]);
      setProductosFiltrados([]);
    } finally {
      setLoading(false);
    }
  };

  const filterProductos = () => {
    // Asegurarse de que productos sea un array
    if (!Array.isArray(productos)) {
      setProductosFiltrados([]);
      return;
    }

    let filtered = productos;

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(p => 
        p.nombre?.toLowerCase().includes(searchLower) ||
        String(p.idprod || '').toLowerCase().includes(searchLower) ||
        p.codigo_barras?.toLowerCase().includes(searchLower)
      );
    }

    setProductosFiltrados(filtered);
  };

  const handlePrecioChange = (idprod: number, field: keyof Producto, value: any) => {
    setProductos(prev => prev.map(p => 
      p.idprod === idprod ? { ...p, [field]: value } : p
    ));
  };

  const togglePreciosAutomaticos = (idprod: number) => {
    const nuevoEstado = !preciosAutomaticos[idprod];
    setPreciosAutomaticos(prev => ({
      ...prev,
      [idprod]: nuevoEstado
    }));

    // Si cambia a automático, calcular precios con porcentaje por defecto (30%)
    if (nuevoEstado) {
      const porcentaje = porcentajeGanancia[idprod] || 30;
      calcularPreciosAutomaticos(idprod, porcentaje);
    }
  };

  const isPreciosAutomaticos = (idprod: number) => {
    return preciosAutomaticos[idprod] === true; // Por defecto es manual (false)
  };

  const handlePorcentajeChange = (idprod: number, porcentaje: number) => {
    setPorcentajeGanancia(prev => ({
      ...prev,
      [idprod]: porcentaje
    }));

    // Si está en modo automático, recalcular precios
    if (isPreciosAutomaticos(idprod)) {
      calcularPreciosAutomaticos(idprod, porcentaje);
    }
  };

  const calcularPreciosAutomaticos = (idprod: number, porcentaje: number) => {
    const producto = productos.find(p => p.idprod === idprod);
    if (!producto || !producto.costo) return;

    const costo = producto.costo;
    const factor = 1 + (porcentaje / 100);

    // Calcular precios con diferentes márgenes
    const preciosCalculados = {
      precio1: costo * factor * 1.5,  // GENERAL - 50% más
      precio2: costo * factor * 1.4,  // MAYORISTA (contrato) - 40% más
      precio3: costo * factor * 1.35, // CLIENTE - 35% más
      precio4: costo * factor * 1.3,  // MECÁNICO - 30% más
      precio5: costo * factor * 1.25, // MAYORISTA - 25% más
      precio6: costo * factor * 1.2,  // INVERSOR - 20% más
      precio7: costo * factor,        // ESPECIAL - base
    };

    // Actualizar todos los precios
    setProductos(prev => prev.map(p => 
      p.idprod === idprod ? { ...p, ...preciosCalculados } : p
    ));
  };

  const handleSaveProducto = async (producto: Producto) => {
    try {
      console.log('Guardando producto:', producto.idprod);
      console.log('Datos a enviar:', {
        costo: producto.costo,
        precio1: producto.precio1,
        precio2: producto.precio2,
        precio3: producto.precio3,
        precio4: producto.precio4,
        precio5: producto.precio5,
        precio6: producto.precio6,
        precio7: producto.precio7,
      });

      const response = await fetch(`/api/productos/${producto.idprod}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          costo: producto.costo,
          precio1: producto.precio1,
          precio2: producto.precio2,
          precio3: producto.precio3,
          precio4: producto.precio4,
          precio5: producto.precio5,
          precio6: producto.precio6,
          precio7: producto.precio7,
        }),
      });

      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('Response data:', data);

      if (response.ok) {
        // Bloquear los precios de este producto
        setPreciosBloqueados(prev => ({
          ...prev,
          [producto.idprod]: true
        }));
        
        alert('✅ Precios guardados y bloqueados exitosamente\n\nPara modificarlos nuevamente, usa la sección "Ajuste de Precios"');
        
        // Recargar productos para ver los cambios
        await fetchProductos();
      } else {
        alert(`❌ Error: ${data.error || 'No se pudo guardar'}`);
      }
    } catch (error) {
      console.error('Error al guardar:', error);
      alert('❌ Error al conectar con el servidor');
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-slate-700 dark:text-slate-200">Cargando productos...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-[#0a0f1a] p-6">
        {/* Navbar superior tipo Figma */}
        <div className="rounded-xl border border-[#0e88c9]/30 bg-[#0d1523] px-5 py-3 flex items-center justify-between gap-4 shadow-[0_0_25px_rgba(15,23,42,0.9)] mb-6">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Inventario</span>
            <span className="h-6 w-px bg-slate-700" />
            <span className="text-sm tracking-[0.18em] uppercase text-slate-200">Editar Precio</span>
          </div>
          <div className="flex items-center gap-3">
            <NotificationDropdown />
            <UserDropdown />
          </div>
        </div>

        {/* Título y descripción */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-50 tracking-tight">Editar Precios</h1>
          <p className="text-sm text-slate-400">Gestiona y configura los precios de los productos del inventario</p>
        </div>

        {/* Barra de búsqueda */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 max-w-2xl relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input
              placeholder="Buscar por nombre, código o código de barras..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-[#0d1523] border-[#1e2a3b] text-slate-200 placeholder:text-slate-500 h-12 text-base"
            />
          </div>
        </div>

        {/* Lista de productos */}
        <div className="space-y-2">
          {productosFiltrados.map((producto) => (
            <div key={producto.idprod} className="bg-[#0d1523] border border-[#1e2a3b] rounded-lg overflow-hidden hover:border-[#0e88c9]/30 transition-colors">
              <div className="px-6 py-4">
                {/* Encabezado del producto */}
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#1e2a3b]">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-slate-100 mb-1">{producto.nombre}</h3>
                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">Código:</span>
                        <span className="font-mono text-slate-300">{producto.idprod}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">Código de barras:</span>
                        <span className="font-mono text-slate-300">{producto.codigo_barras || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Indicador de Precios Bloqueados */}
                {preciosBloqueados[producto.idprod] && (
                  <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-yellow-500">🔒</span>
                      <p className="text-xs text-yellow-500 font-medium">
                        Precios bloqueados. Para modificarlos, usa la sección "Ajuste de Precios"
                      </p>
                    </div>
                  </div>
                )}

                {/* Costo del Producto */}
                <div className="mb-4">
                  <div className="mb-3">
                    <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-2">Costo</h4>
                    <div className="max-w-xs">
                      <label className="text-xs font-medium text-slate-400 block mb-2">Costo del Producto</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={producto.costo || 0}
                        disabled={true}
                        className="h-10 text-sm border-[#1e2a3b] text-slate-200 font-mono bg-[#1e2a3b]/50 cursor-not-allowed opacity-60"
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        Costo fijo establecido en Nuevo Producto
                      </p>
                    </div>
                  </div>

                  {/* Toggle Manual/Automático para Precios */}
                  <div className="flex items-center justify-between mb-3 pb-3 border-b border-[#1e2a3b]">
                    <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Cálculo de Precios</h4>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium" style={{ color: !isPreciosAutomaticos(producto.idprod) ? '#0e88c9' : '#64748b' }}>MANUAL</span>
                      <label className={`relative inline-flex items-center ${preciosBloqueados[producto.idprod] ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                        <input
                          type="checkbox"
                          checked={isPreciosAutomaticos(producto.idprod)}
                          onChange={() => togglePreciosAutomaticos(producto.idprod)}
                          disabled={preciosBloqueados[producto.idprod]}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-[#1e2a3b] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#0e88c9] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0e88c9]"></div>
                      </label>
                      <span className="text-xs font-medium" style={{ color: isPreciosAutomaticos(producto.idprod) ? '#0e88c9' : '#64748b' }}>AUTOMÁTICO</span>
                    </div>
                  </div>

                  {/* Campo de Porcentaje (solo visible en modo automático) */}
                  {isPreciosAutomaticos(producto.idprod) && (
                    <div className="mb-4 p-4 bg-[#0e88c9]/10 border border-[#0e88c9]/30 rounded-lg">
                      <label className="text-xs font-medium text-[#0e88c9] block mb-2">Porcentaje de Ganancia Base (%)</label>
                      <Input
                        type="number"
                        step="1"
                        value={porcentajeGanancia[producto.idprod] || 30}
                        onChange={(e) => handlePorcentajeChange(producto.idprod, parseFloat(e.target.value))}
                        className="h-10 text-sm bg-[#141e2e] border-[#0e88c9]/50 text-slate-200 font-mono max-w-xs"
                      />
                      <p className="text-xs text-slate-400 mt-2">
                        Los precios se calcularán automáticamente basados en el costo + este porcentaje
                      </p>
                    </div>
                  )}
                </div>

                {/* Sección de 7 Tipos de Precios */}
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-[#ff6b35] mb-3 uppercase tracking-wide">Tipos de Precios</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Precio 1 - GENERAL, ALTO */}
                    <div>
                      <label className="text-xs font-medium text-slate-400 block mb-2">
                        Precio 1 - GENERAL
                        <span className="block text-[10px] text-slate-500 mt-0.5">Precio más alto</span>
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        value={producto.precio1 || 0}
                        onChange={(e) => handlePrecioChange(producto.idprod, 'precio1', parseFloat(e.target.value))}
                        disabled={isPreciosAutomaticos(producto.idprod) || preciosBloqueados[producto.idprod]}
                        className={`h-9 text-sm border-[#1e2a3b] text-slate-200 font-mono ${
                          (isPreciosAutomaticos(producto.idprod) || preciosBloqueados[producto.idprod]) ? 'bg-[#1e2a3b]/50 cursor-not-allowed' : 'bg-[#141e2e]'
                        }`}
                      />
                    </div>

                    {/* Precio 2 - MAYORISTA (con contrato) */}
                    <div>
                      <label className="text-xs font-medium text-slate-400 block mb-2">
                        Precio 2 - MAYORISTA
                        <span className="block text-[10px] text-slate-500 mt-0.5">Con contrato sin repuesto</span>
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        value={producto.precio2 || 0}
                        onChange={(e) => handlePrecioChange(producto.idprod, 'precio2', parseFloat(e.target.value))}
                        disabled={isPreciosAutomaticos(producto.idprod) || preciosBloqueados[producto.idprod]}
                        className={`h-9 text-sm border-[#1e2a3b] text-slate-200 font-mono ${
                          (isPreciosAutomaticos(producto.idprod) || preciosBloqueados[producto.idprod]) ? 'bg-[#1e2a3b]/50 cursor-not-allowed' : 'bg-[#141e2e]'
                        }`}
                      />
                    </div>

                    {/* Precio 3 - CLIENTE */}
                    <div>
                      <label className="text-xs font-medium text-slate-400 block mb-2">
                        Precio 3 - CLIENTE
                        <span className="block text-[10px] text-slate-500 mt-0.5">Cliente preferente</span>
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        value={producto.precio3 || 0}
                        onChange={(e) => handlePrecioChange(producto.idprod, 'precio3', parseFloat(e.target.value))}
                        disabled={isPreciosAutomaticos(producto.idprod) || preciosBloqueados[producto.idprod]}
                        className={`h-9 text-sm border-[#1e2a3b] text-slate-200 font-mono ${
                          (isPreciosAutomaticos(producto.idprod) || preciosBloqueados[producto.idprod]) ? 'bg-[#1e2a3b]/50 cursor-not-allowed' : 'bg-[#141e2e]'
                        }`}
                      />
                    </div>

                    {/* Precio 4 - MECANICO o MINORISTA */}
                    <div>
                      <label className="text-xs font-medium text-slate-400 block mb-2">
                        Precio 4 - MECÁNICO
                        <span className="block text-[10px] text-slate-500 mt-0.5">Compras menores</span>
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        value={producto.precio4 || 0}
                        onChange={(e) => handlePrecioChange(producto.idprod, 'precio4', parseFloat(e.target.value))}
                        disabled={isPreciosAutomaticos(producto.idprod) || preciosBloqueados[producto.idprod]}
                        className={`h-9 text-sm border-[#1e2a3b] text-slate-200 font-mono ${
                          (isPreciosAutomaticos(producto.idprod) || preciosBloqueados[producto.idprod]) ? 'bg-[#1e2a3b]/50 cursor-not-allowed' : 'bg-[#141e2e]'
                        }`}
                      />
                    </div>

                    {/* Precio 5 - MAYORISTA */}
                    <div>
                      <label className="text-xs font-medium text-slate-400 block mb-2">
                        Precio 5 - MAYORISTA
                        <span className="block text-[10px] text-slate-500 mt-0.5">Montos considerables</span>
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        value={producto.precio5 || 0}
                        onChange={(e) => handlePrecioChange(producto.idprod, 'precio5', parseFloat(e.target.value))}
                        disabled={isPreciosAutomaticos(producto.idprod) || preciosBloqueados[producto.idprod]}
                        className={`h-9 text-sm border-[#1e2a3b] text-slate-200 font-mono ${
                          (isPreciosAutomaticos(producto.idprod) || preciosBloqueados[producto.idprod]) ? 'bg-[#1e2a3b]/50 cursor-not-allowed' : 'bg-[#141e2e]'
                        }`}
                      />
                    </div>

                    {/* Precio 6 - INVERSOR */}
                    <div>
                      <label className="text-xs font-medium text-slate-400 block mb-2">
                        Precio 6 - INVERSOR
                        <span className="block text-[10px] text-slate-500 mt-0.5">Montos mayores a $5000</span>
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        value={producto.precio6 || 0}
                        onChange={(e) => handlePrecioChange(producto.idprod, 'precio6', parseFloat(e.target.value))}
                        disabled={isPreciosAutomaticos(producto.idprod) || preciosBloqueados[producto.idprod]}
                        className={`h-9 text-sm border-[#1e2a3b] text-slate-200 font-mono ${
                          (isPreciosAutomaticos(producto.idprod) || preciosBloqueados[producto.idprod]) ? 'bg-[#1e2a3b]/50 cursor-not-allowed' : 'bg-[#141e2e]'
                        }`}
                      />
                    </div>

                    {/* Precio 7 - ESPECIAL */}
                    <div>
                      <label className="text-xs font-medium text-slate-400 block mb-2">
                        Precio 7 - ESPECIAL
                        <span className="block text-[10px] text-slate-500 mt-0.5">Precio mínimo de venta</span>
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        value={producto.precio7 || 0}
                        onChange={(e) => handlePrecioChange(producto.idprod, 'precio7', parseFloat(e.target.value))}
                        disabled={isPreciosAutomaticos(producto.idprod)}
                        className={`h-9 text-sm border-[#1e2a3b] text-slate-200 font-mono ${
                          isPreciosAutomaticos(producto.idprod) 
                            ? 'bg-[#1e2a3b]/50 cursor-not-allowed' 
                            : 'bg-[#141e2e]'
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {/* Botón Guardar */}
                <div className="flex justify-end pt-3 border-t border-[#1e2a3b]">
                  <Button
                    onClick={() => handleSaveProducto(producto)}
                    disabled={preciosBloqueados[producto.idprod]}
                    className={`h-9 px-6 ${
                      preciosBloqueados[producto.idprod]
                        ? 'bg-slate-600 cursor-not-allowed opacity-50'
                        : 'bg-[#0e88c9] hover:bg-[#0e88c9]/90 text-white'
                    }`}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {preciosBloqueados[producto.idprod] ? 'Precios Bloqueados' : 'Guardar Cambios'}
                  </Button>
                </div>
              </div>
            </div>
          ))}

          {productosFiltrados.length === 0 && (
            <div className="bg-[#0d1523] border border-[#1e2a3b] rounded-lg p-8 text-center">
              <Package className="mx-auto h-12 w-12 text-slate-400" />
              <h3 className="mt-2 text-sm font-medium text-slate-200">No hay productos</h3>
              <p className="mt-1 text-sm text-slate-400">
                No se encontraron productos con los filtros aplicados.
              </p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
