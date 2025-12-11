'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Search, Save, Package, Bell, UserCircle2, Lock, Unlock, History, Calendar, User } from 'lucide-react';

interface Producto {
  idprod: number;
  nombre: string;
  codigo_barras?: string;
  costo: number;
  precio1: number;
  precio2: number;
  precio3: number;
  precio4: number;
  precio5: number;
  precio6: number;
  precio7: number;
  imagen_principal?: string;
}

interface HistorialAjuste {
  idajuste: number;
  idusuario: number;
  fecha: string;
  razon_justificacion: string;
  created_at: string;
  nombre_usuario: string;
}

export default function AjustePreciosPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [productosFiltrados, setProductosFiltrados] = useState<Producto[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [justificaciones, setJustificaciones] = useState<{[key: number]: string}>({});
  const [productosDesbloqueados, setProductosDesbloqueados] = useState<{[key: number]: boolean}>({});
  const [historial, setHistorial] = useState<{[key: number]: HistorialAjuste[]}>({});
  const [mostrarHistorial, setMostrarHistorial] = useState<{[key: number]: boolean}>({});

  useEffect(() => {
    fetchProductos();
  }, []);

  useEffect(() => {
    filterProductos();
  }, [searchTerm, productos]);

  const fetchProductos = async () => {
    try {
      const response = await fetch('/api/productos');
      
      if (response.ok) {
        const data = await response.json();
        const productosArray = Array.isArray(data.products) ? data.products : [];
        
        const productosBloqueados = productosArray.filter(producto => {
          return (
            (producto.precio1 && producto.precio1 > 0) ||
            (producto.precio2 && producto.precio2 > 0) ||
            (producto.precio3 && producto.precio3 > 0) ||
            (producto.precio4 && producto.precio4 > 0) ||
            (producto.precio5 && producto.precio5 > 0) ||
            (producto.precio6 && producto.precio6 > 0) ||
            (producto.precio7 && producto.precio7 > 0)
          );
        });
        
        setProductos(productosBloqueados);
        setProductosFiltrados(productosBloqueados);
      }
    } catch (error) {
      console.error('Error al cargar productos:', error);
      setProductos([]);
      setProductosFiltrados([]);
    } finally {
      setLoading(false);
    }
  };

  const filterProductos = () => {
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

  const handleDesbloquear = (idprod: number) => {
    setProductosDesbloqueados(prev => ({
      ...prev,
      [idprod]: true
    }));
  };

  const handlePrecioChange = (idprod: number, field: keyof Producto, value: any) => {
    setProductos(prev => prev.map(p => 
      p.idprod === idprod ? { ...p, [field]: value } : p
    ));
  };

  const handleJustificacionChange = (idprod: number, value: string) => {
    setJustificaciones(prev => ({
      ...prev,
      [idprod]: value
    }));
  };

  const fetchHistorial = async (idprod: number) => {
    try {
      const response = await fetch(`/api/productos/${idprod}/historial-precios`);
      
      if (response.ok) {
        const data = await response.json();
        setHistorial(prev => ({
          ...prev,
          [idprod]: data.historial || []
        }));
      }
    } catch (error) {
      console.error('Error al cargar historial:', error);
    }
  };

  const toggleHistorial = (idprod: number) => {
    const nuevoEstado = !mostrarHistorial[idprod];
    setMostrarHistorial(prev => ({
      ...prev,
      [idprod]: nuevoEstado
    }));
    
    // Si se está abriendo y no hay historial cargado, cargarlo
    if (nuevoEstado && !historial[idprod]) {
      fetchHistorial(idprod);
    }
  };

  const formatFecha = (fecha: string) => {
    const date = new Date(fecha);
    return date.toLocaleString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleGuardarAjuste = async (producto: Producto) => {
    const justificacion = justificaciones[producto.idprod];
    
    if (!justificacion || justificacion.trim() === '') {
      alert('⚠️ Debes proporcionar una justificación para el ajuste de precios');
      return;
    }

    try {
      const response = await fetch(`/api/productos/${producto.idprod}/ajuste-precios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          precio1: producto.precio1,
          precio2: producto.precio2,
          precio3: producto.precio3,
          precio4: producto.precio4,
          precio5: producto.precio5,
          precio6: producto.precio6,
          precio7: producto.precio7,
          justificacion: justificacion
        }),
      });

      const data = await response.json();

      if (response.ok) {
        alert('✅ Ajuste de precios guardado exitosamente');
        
        setProductosDesbloqueados(prev => ({
          ...prev,
          [producto.idprod]: false
        }));
        
        setJustificaciones(prev => ({
          ...prev,
          [producto.idprod]: ''
        }));
        
        // Recargar historial para mostrar el nuevo ajuste
        await fetchHistorial(producto.idprod);
        
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
            <span className="text-sm tracking-[0.18em] uppercase text-slate-200">Ajuste de Precios</span>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="border-slate-700 bg-slate-950/60 text-slate-300 hover:text-slate-50 hover:bg-slate-800"
            >
              <Bell className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="border-slate-700 bg-slate-950/60 text-slate-300 hover:text-slate-50 hover:bg-slate-800"
            >
              <UserCircle2 className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Título y descripción */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-50 tracking-tight">Ajuste de Precios</h1>
          <p className="text-sm text-slate-400">Modifica precios bloqueados con justificación y mantén un historial de cambios</p>
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

        <div className="space-y-2">
          {productosFiltrados.map((producto) => (
            <div key={producto.idprod} className="bg-[#0d1523] border border-[#1e2a3b] rounded-lg overflow-hidden hover:border-[#0e88c9]/30 transition-colors">
              <div className="px-6 py-4">
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
                  <Button
                    onClick={() => handleDesbloquear(producto.idprod)}
                    disabled={productosDesbloqueados[producto.idprod]}
                    className={`h-9 px-4 ${
                      productosDesbloqueados[producto.idprod]
                        ? 'bg-green-600 hover:bg-green-700'
                        : 'bg-yellow-600 hover:bg-yellow-700'
                    }`}
                  >
                    {productosDesbloqueados[producto.idprod] ? (
                      <><Unlock className="h-4 w-4 mr-2" /> Desbloqueado</>
                    ) : (
                      <><Lock className="h-4 w-4 mr-2" /> Desbloquear</>
                    )}
                  </Button>
                </div>

                {!productosDesbloqueados[producto.idprod] && (
                  <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-yellow-500">🔒</span>
                      <p className="text-xs text-yellow-500 font-medium">
                        Click en "Desbloquear" para poder modificar los precios
                      </p>
                    </div>
                  </div>
                )}

                <div className="mb-4">
                  <div className="mb-3">
                    <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-2">Costo</h4>
                    <div className="max-w-xs">
                      <Input
                        type="number"
                        step="0.01"
                        value={producto.costo || 0}
                        disabled={true}
                        className="h-10 text-sm border-[#1e2a3b] text-slate-200 font-mono bg-[#1e2a3b]/50 cursor-not-allowed opacity-60"
                      />
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-[#ff6b35] mb-3 uppercase tracking-wide">Tipos de Precios</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="text-xs font-medium text-slate-400 block mb-2">
                        Precio 1 - GENERAL
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        value={producto.precio1 || 0}
                        onChange={(e) => handlePrecioChange(producto.idprod, 'precio1', parseFloat(e.target.value))}
                        disabled={!productosDesbloqueados[producto.idprod]}
                        className={`h-9 text-sm border-[#1e2a3b] text-slate-200 font-mono ${
                          !productosDesbloqueados[producto.idprod] ? 'bg-[#1e2a3b]/50 cursor-not-allowed' : 'bg-[#141e2e]'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-400 block mb-2">
                        Precio 2 - MAYORISTA
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        value={producto.precio2 || 0}
                        onChange={(e) => handlePrecioChange(producto.idprod, 'precio2', parseFloat(e.target.value))}
                        disabled={!productosDesbloqueados[producto.idprod]}
                        className={`h-9 text-sm border-[#1e2a3b] text-slate-200 font-mono ${
                          !productosDesbloqueados[producto.idprod] ? 'bg-[#1e2a3b]/50 cursor-not-allowed' : 'bg-[#141e2e]'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-400 block mb-2">
                        Precio 3 - CLIENTE
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        value={producto.precio3 || 0}
                        onChange={(e) => handlePrecioChange(producto.idprod, 'precio3', parseFloat(e.target.value))}
                        disabled={!productosDesbloqueados[producto.idprod]}
                        className={`h-9 text-sm border-[#1e2a3b] text-slate-200 font-mono ${
                          !productosDesbloqueados[producto.idprod] ? 'bg-[#1e2a3b]/50 cursor-not-allowed' : 'bg-[#141e2e]'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-400 block mb-2">
                        Precio 4 - MECÁNICO
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        value={producto.precio4 || 0}
                        onChange={(e) => handlePrecioChange(producto.idprod, 'precio4', parseFloat(e.target.value))}
                        disabled={!productosDesbloqueados[producto.idprod]}
                        className={`h-9 text-sm border-[#1e2a3b] text-slate-200 font-mono ${
                          !productosDesbloqueados[producto.idprod] ? 'bg-[#1e2a3b]/50 cursor-not-allowed' : 'bg-[#141e2e]'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-400 block mb-2">
                        Precio 5 - MAYORISTA
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        value={producto.precio5 || 0}
                        onChange={(e) => handlePrecioChange(producto.idprod, 'precio5', parseFloat(e.target.value))}
                        disabled={!productosDesbloqueados[producto.idprod]}
                        className={`h-9 text-sm border-[#1e2a3b] text-slate-200 font-mono ${
                          !productosDesbloqueados[producto.idprod] ? 'bg-[#1e2a3b]/50 cursor-not-allowed' : 'bg-[#141e2e]'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-400 block mb-2">
                        Precio 6 - INVERSOR
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        value={producto.precio6 || 0}
                        onChange={(e) => handlePrecioChange(producto.idprod, 'precio6', parseFloat(e.target.value))}
                        disabled={!productosDesbloqueados[producto.idprod]}
                        className={`h-9 text-sm border-[#1e2a3b] text-slate-200 font-mono ${
                          !productosDesbloqueados[producto.idprod] ? 'bg-[#1e2a3b]/50 cursor-not-allowed' : 'bg-[#141e2e]'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-400 block mb-2">
                        Precio 7 - ESPECIAL
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        value={producto.precio7 || 0}
                        onChange={(e) => handlePrecioChange(producto.idprod, 'precio7', parseFloat(e.target.value))}
                        disabled={!productosDesbloqueados[producto.idprod]}
                        className={`h-9 text-sm border-[#1e2a3b] text-slate-200 font-mono ${
                          !productosDesbloqueados[producto.idprod] ? 'bg-[#1e2a3b]/50 cursor-not-allowed' : 'bg-[#141e2e]'
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {productosDesbloqueados[producto.idprod] && (
                  <div className="mb-4 p-4 bg-[#0e88c9]/10 border border-[#0e88c9]/30 rounded-lg">
                    <label className="text-xs font-medium text-[#0e88c9] block mb-2">
                      Justificación del Ajuste (Requerido) *
                    </label>
                    <Textarea
                      placeholder="Explica el motivo del ajuste de precios..."
                      value={justificaciones[producto.idprod] || ''}
                      onChange={(e) => handleJustificacionChange(producto.idprod, e.target.value)}
                      className="bg-[#141e2e] border-[#0e88c9]/50 text-slate-200 min-h-[80px]"
                    />
                    <p className="text-xs text-slate-400 mt-2">
                      Esta justificación se guardará en el historial de ajustes
                    </p>
                  </div>
                )}

                {/* Historial de Ajustes */}
                <div className="mb-4 border-t border-[#1e2a3b] pt-4">
                  <Button
                    variant="ghost"
                    onClick={() => toggleHistorial(producto.idprod)}
                    className="w-full justify-between text-slate-300 hover:text-[#0e88c9] hover:bg-[#1e2a3b]"
                  >
                    <div className="flex items-center gap-2">
                      <History className="h-4 w-4" />
                      <span className="text-sm font-medium">Historial de Modificaciones</span>
                    </div>
                    <span className="text-xs text-slate-500">
                      {mostrarHistorial[producto.idprod] ? 'Ocultar' : 'Ver historial'}
                    </span>
                  </Button>

                  {mostrarHistorial[producto.idprod] && (
                    <div className="mt-3 space-y-2">
                      {historial[producto.idprod] && historial[producto.idprod].length > 0 ? (
                        historial[producto.idprod].map((ajuste) => (
                          <div key={ajuste.idajuste} className="bg-[#141e2e] border border-[#1e2a3b] rounded-lg p-3">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2 text-xs text-slate-400">
                                <Calendar className="h-3 w-3" />
                                <span>{formatFecha(ajuste.fecha)}</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-slate-400">
                                <User className="h-3 w-3" />
                                <span>{ajuste.nombre_usuario}</span>
                              </div>
                            </div>
                            <div className="text-sm text-slate-300">
                              <span className="font-medium text-[#0e88c9]">Razón:</span>
                              <p className="mt-1 text-slate-400">{ajuste.razon_justificacion}</p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-4 text-sm text-slate-500">
                          No hay historial de modificaciones para este producto
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-3 border-t border-[#1e2a3b]">
                  <Button
                    onClick={() => handleGuardarAjuste(producto)}
                    disabled={!productosDesbloqueados[producto.idprod]}
                    className={`h-9 px-6 ${
                      !productosDesbloqueados[producto.idprod]
                        ? 'bg-slate-600 cursor-not-allowed opacity-50'
                        : 'bg-[#0e88c9] hover:bg-[#0e88c9]/90 text-white'
                    }`}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Guardar Ajuste
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
                {searchTerm ? 'No se encontraron productos con los filtros aplicados.' : 'No hay productos con precios bloqueados.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
