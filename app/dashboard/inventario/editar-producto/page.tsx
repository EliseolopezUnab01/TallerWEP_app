'use client';

import { useState, useEffect, Suspense, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Search, Bell, UserCircle2, ChevronLeft, ChevronRight, X, Package, Save, Trash2, ArrowLeft, Upload, Edit, Eye, Lock, Unlock, History, Calendar, User
} from 'lucide-react';
import Image from 'next/image';

interface Producto {
  idprod: number;
  tipo: string;
  idprodprov: string;
  idprodpaquete: string;
  idprodfisico: string;
  OE: string;
  nombre: string;
  descripcion: string;
  etiquetas: string;
  marca: string;
  peso: string;
  codarancel: string;
  lado: string;
  modelo: string;
  clase: string;
  estilo: string;
  giro: string;
  capacidad: string;
  unimedida: string;
  idcategoria: string;
  categoria_nombre?: string;
  codigo_barras: string;
  info_reservada: string;
  info_publica: string;
  info_referencias_directas: string;
  info_referencias_indirectas: string;
  exento: number;
  stock_contable: number;
  stock_fisico: number;
  costo: string;
  imagen_principal?: string;
  imagenes?: string[];
}

interface Precios {
  precio1: number;
  precio2: number;
  precio3: number;
  precio4: number;
  precio5: number;
  precio6: number;
  precio7: number;
}

interface HistorialAjuste {
  idajuste: number;
  idusuario: number;
  fecha: string;
  razon_justificacion: string;
  created_at: string;
  nombre_usuario: string;
  precio1_anterior: number | null;
  precio2_anterior: number | null;
  precio3_anterior: number | null;
  precio4_anterior: number | null;
  precio5_anterior: number | null;
  precio6_anterior: number | null;
  precio7_anterior: number | null;
  precio1_nuevo: number | null;
  precio2_nuevo: number | null;
  precio3_nuevo: number | null;
  precio4_nuevo: number | null;
  precio5_nuevo: number | null;
  precio6_nuevo: number | null;
  precio7_nuevo: number | null;
}

function EditarProductoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const idParam = searchParams?.get('id');
  const listRef = useRef<HTMLDivElement>(null);

  const [allProductos, setAllProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [producto, setProducto] = useState<Producto | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [newImages, setNewImages] = useState<File[]>([]);
  const [imagesToDelete, setImagesToDelete] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  
  // Estados para precios
  const [precios, setPrecios] = useState<Precios>({ precio1: 0, precio2: 0, precio3: 0, precio4: 0, precio5: 0, precio6: 0, precio7: 0 });
  const [preciosDesbloqueado, setPreciosDesbloqueado] = useState(false);
  const [justificacionPrecio, setJustificacionPrecio] = useState('');
  const [historialPrecios, setHistorialPrecios] = useState<HistorialAjuste[]>([]);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  const [savingPrecios, setSavingPrecios] = useState(false);

  const categorias = [
    { id: 'FRENOS', nombre: 'Sistema de Frenos' },
    { id: 'MOTOR', nombre: 'Motor y Componentes' },
    { id: 'SUSPEN', nombre: 'Suspensión' },
    { id: 'TRANSM', nombre: 'Transmisión' },
    { id: 'ELECTR', nombre: 'Sistema Eléctrico' },
    { id: 'LUBRIC', nombre: 'Lubricantes' },
    { id: 'FILTROS', nombre: 'Filtros' },
    { id: 'ESCAPE', nombre: 'Sistema de Escape' },
  ];

  const unidadesMedida = ['UNIDAD', 'PAR', 'JUEGO', 'KIT', 'LITRO', 'GALON', 'METRO'];
  const lados = ['IZQUIERDO', 'DERECHO', 'AMBOS', 'NO APLICA'];

  useEffect(() => {
    fetchAllProductos();
  }, []);

  useEffect(() => {
    if (idParam && allProductos.length > 0) {
      const found = allProductos.find(p => p.idprod === Number(idParam));
      if (found) {
        setProducto(found);
        setIsEditing(true);
        const idx = productosFiltrados.findIndex(p => p.idprod === Number(idParam));
        if (idx >= 0) setSelectedIndex(idx);
        fetchPrecios(Number(idParam));
        fetchHistorialPrecios(Number(idParam));
      }
    }
  }, [idParam, allProductos]);

  const fetchPrecios = (idprod: number) => {
    // Los precios vienen en el objeto producto desde /api/productos
    const prod = allProductos.find(p => p.idprod === idprod) as any;
    console.log('📊 Cargando precios para producto:', idprod, prod);
    if (prod) {
      const nuevosPrecios = {
        precio1: Number(prod.precio1) || 0,
        precio2: Number(prod.precio2) || 0,
        precio3: Number(prod.precio3) || 0,
        precio4: Number(prod.precio4) || 0,
        precio5: Number(prod.precio5) || 0,
        precio6: Number(prod.precio6) || 0,
        precio7: Number(prod.precio7) || 0,
      };
      console.log('📊 Precios cargados:', nuevosPrecios);
      setPrecios(nuevosPrecios);
    }
  };

  const fetchHistorialPrecios = async (idprod: number) => {
    try {
      const response = await fetch(`/api/productos/${idprod}/historial-precios`);
      if (response.ok) {
        const data = await response.json();
        setHistorialPrecios(data.historial || []);
      }
    } catch (error) {
      console.error('Error al cargar historial:', error);
    }
  };

  const fetchAllProductos = async () => {
    try {
      const response = await fetch('/api/productos');
      if (response.ok) {
        const data = await response.json();
        setAllProductos(data.products || []);
      }
    } catch (error) {
      console.error('Error al cargar productos:', error);
    } finally {
      setLoading(false);
    }
  };

  const productosFiltrados = allProductos.filter(p => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      p.nombre?.toLowerCase().includes(query) ||
      p.OE?.toLowerCase().includes(query) ||
      p.codigo_barras?.toLowerCase().includes(query) ||
      p.idprodprov?.toLowerCase().includes(query) ||
      p.marca?.toLowerCase().includes(query) ||
      p.idprod?.toString().includes(query)
    );
  });

  const productoPreview = productosFiltrados[selectedIndex] || null;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (isEditing) return;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, productosFiltrados.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && productoPreview) {
      e.preventDefault();
      handleEditProduct(productoPreview.idprod);
    }
  }, [productosFiltrados.length, productoPreview, isEditing]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (listRef.current) {
      const selectedEl = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  const handleEditProduct = (idprod: number) => {
    const prod = allProductos.find(p => p.idprod === idprod);
    if (prod) {
      setProducto(prod);
      setIsEditing(true);
      setCurrentImageIndex(0);
      setNewImages([]);
      setImagesToDelete([]);
      setPreciosDesbloqueado(false);
      setJustificacionPrecio('');
      setMostrarHistorial(false);
      fetchPrecios(idprod);
      fetchHistorialPrecios(idprod);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setProducto(null);
    setNewImages([]);
    setImagesToDelete([]);
    setPreciosDesbloqueado(false);
    setJustificacionPrecio('');
    setMostrarHistorial(false);
  };

  const updatePrecioField = (field: keyof Precios, value: number) => {
    setPrecios(prev => ({ ...prev, [field]: value }));
  };

  const handleGuardarPrecios = async () => {
    if (!producto) return;
    if (!justificacionPrecio.trim()) {
      alert('⚠️ Debes ingresar una justificación para el ajuste de precios');
      return;
    }

    setSavingPrecios(true);
    try {
      const response = await fetch(`/api/productos/${producto.idprod}/ajuste-precios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...precios,
          justificacion: justificacionPrecio
        }),
      });

      if (response.ok) {
        alert('✅ Precios actualizados correctamente');
        setPreciosDesbloqueado(false);
        setJustificacionPrecio('');
        await fetchHistorialPrecios(producto.idprod);
      } else {
        const data = await response.json();
        alert(`❌ Error: ${data.error || 'No se pudo guardar'}`);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('❌ Error al conectar con el servidor');
    } finally {
      setSavingPrecios(false);
    }
  };

  const formatFecha = (fecha: string) => {
    return new Date(fecha).toLocaleString('es-GT', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const updateProductField = (field: keyof Producto, value: any) => {
    if (producto) {
      setProducto({ ...producto, [field]: value });
    }
  };

  const allImages = producto?.imagenes?.filter(img => !imagesToDelete.includes(img)) || [];
  const previewImages = productoPreview?.imagenes || [];

  const nextImage = () => setCurrentImageIndex(prev => (prev + 1) % allImages.length);
  const prevImage = () => setCurrentImageIndex(prev => (prev - 1 + allImages.length) % allImages.length);

  const deleteCurrentImage = () => {
    if (allImages[currentImageIndex]) {
      setImagesToDelete(prev => [...prev, allImages[currentImageIndex]]);
      setCurrentImageIndex(prev => Math.max(0, prev - 1));
    }
  };

  const handleNewImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      const totalImages = allImages.length + newImages.length + files.length;
      if (totalImages > 10) {
        alert('Máximo 10 imágenes permitidas');
        return;
      }
      setNewImages(prev => [...prev, ...files]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!producto) return;
    setSaving(true);

    try {
      const formData = new FormData();
      Object.entries(producto).forEach(([key, value]) => {
        if (key !== 'imagenes' && key !== 'imagen_principal' && value !== null && value !== undefined) {
          formData.append(key, String(value));
        }
      });
      imagesToDelete.forEach(img => formData.append('imagesToDelete', img));
      newImages.forEach(file => formData.append('newImages', file));

      const response = await fetch(`/api/productos/${producto.idprod}`, {
        method: 'PUT',
        body: formData,
      });

      if (response.ok) {
        alert('✅ Producto actualizado correctamente');
        await fetchAllProductos();
        handleCancelEdit();
      } else {
        const data = await response.json();
        alert(`❌ Error: ${data.error || 'No se pudo actualizar'}`);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('❌ Error al conectar con el servidor');
    } finally {
      setSaving(false);
    }
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
            {isEditing && (
              <Button variant="ghost" size="icon" onClick={handleCancelEdit} className="text-slate-400 hover:text-slate-200">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Inventario</span>
            <span className="h-6 w-px bg-slate-700" />
            <span className="text-sm tracking-[0.18em] uppercase text-slate-200">
              {isEditing ? 'Editar Producto' : 'Seleccionar Producto'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {isEditing && (
              <>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleCancelEdit} 
                  className="h-9 px-4 border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  Cancelar
                </Button>
                <Button type="submit" form="product-form" disabled={saving} className="bg-[#0e88c9] hover:bg-[#0e88c9]/90 text-white h-9 px-4">
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Guardando...' : 'Guardar Cambios'}
                </Button>
              </>
            )}
            <Button variant="outline" size="icon" className="border-slate-700 bg-slate-950/60 text-slate-300 hover:text-slate-50 hover:bg-slate-800">
              <Bell className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="border-slate-700 bg-slate-950/60 text-slate-300 hover:text-slate-50 hover:bg-slate-800">
              <UserCircle2 className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Columna Izquierda: Lista de productos */}
          <div className="lg:col-span-4 space-y-4">
            <Card className="bg-[#141e2e] border border-[#0e88c9]/30 rounded-xl overflow-hidden">
              <CardHeader className="py-2 px-3 border-b border-slate-800">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Input
                    placeholder="Buscar producto..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setSelectedIndex(0); }}
                    className="pl-8 h-8 text-sm bg-slate-950/80 border-slate-700/40 text-slate-100"
                  />
                </div>
              </CardHeader>
              <div ref={listRef} className="h-[500px] overflow-y-auto divide-y divide-slate-800/50">
                {productosFiltrados.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500">
                    <Package className="h-8 w-8 mb-2" />
                    <p className="text-sm">No hay productos</p>
                  </div>
                ) : (
                  productosFiltrados.map((prod, idx) => (
                    <div
                      key={prod.idprod}
                      onClick={() => setSelectedIndex(idx)}
                      onDoubleClick={() => handleEditProduct(prod.idprod)}
                      onMouseEnter={() => !isEditing && setSelectedIndex(idx)}
                      className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${
                        idx === selectedIndex ? 'bg-[#0e88c9]/20 border-l-2 border-[#0e88c9]' : 'hover:bg-slate-800/50'
                      } ${isEditing && producto?.idprod === prod.idprod ? 'bg-emerald-500/10 border-l-2 border-emerald-500' : ''}`}
                    >
                      <div className="h-10 w-10 rounded bg-slate-900 flex-shrink-0 overflow-hidden">
                        {prod.imagen_principal ? (
                          <Image src={prod.imagen_principal} alt="" width={40} height={40} className="object-cover h-full w-full" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="h-4 w-4 text-slate-600" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-200 truncate">{prod.nombre}</p>
                        <p className="text-xs text-slate-500">OE: {prod.OE || '-'}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                            {prod.categoria_nombre || prod.idcategoria || '-'}
                          </Badge>
                          <span className={`text-[10px] font-medium ${prod.stock_contable > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            Stock: {prod.stock_contable}
                          </span>
                        </div>
                      </div>
                      {isEditing && producto?.idprod === prod.idprod && (
                        <Edit className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                      )}
                    </div>
                  ))
                )}
              </div>
            </Card>

            {/* Info del producto seleccionado (cuando NO está editando) */}
            {!isEditing && productoPreview && (
              <Card className="bg-[#141e2e] border border-[#0e88c9]/30 rounded-xl">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Producto Seleccionado</span>
                    <Button 
                      size="sm" 
                      onClick={() => handleEditProduct(productoPreview.idprod)}
                      className="h-7 text-xs bg-[#0e88c9]/10 text-[#0e88c9] border border-[#0e88c9]/40"
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Editar
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500">ID:</span>
                      <span className="text-slate-300 ml-1">{productoPreview.idprod}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Marca:</span>
                      <span className="text-slate-300 ml-1">{productoPreview.marca || '-'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Stock:</span>
                      <span className={`ml-1 ${productoPreview.stock_contable > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {productoPreview.stock_contable}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Costo:</span>
                      <span className="text-slate-300 ml-1">${productoPreview.costo || '0'}</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 italic">Doble click para editar</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Columna Central y Derecha: Formulario de Edición o Preview */}
          <div className="lg:col-span-8">
            {isEditing && producto ? (
              <form id="product-form" onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Columna Izquierda: Galería + Info Adicional */}
                <div className="space-y-4">
                  {/* Galería de Imágenes - Más compacta */}
                  <Card className="bg-[#141e2e] border border-[#0e88c9]/30 shadow-[0_0_20px_rgba(14,136,201,0.25)] rounded-xl overflow-hidden">
                    <CardHeader className="py-2 px-3 flex flex-row items-center justify-between">
                      <CardTitle className="text-sm text-slate-200 tracking-wide">IMAGE GALLERY</CardTitle>
                      <span className="text-xs text-emerald-400">{allImages.length + newImages.length}/10</span>
                    </CardHeader>
                    <CardContent className="p-3 space-y-3">
                      <div className="relative w-full h-[180px] bg-slate-900 rounded-xl overflow-hidden">
                      {allImages.length > 0 ? (
                        <>
                          <div className="relative h-full w-full">
                            <Image src={allImages[currentImageIndex]} alt="Producto" fill className="object-contain" />
                          </div>
                          <button type="button" onClick={prevImage} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full">
                            <ChevronLeft className="h-6 w-6" />
                          </button>
                          <button type="button" onClick={nextImage} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full">
                            <ChevronRight className="h-6 w-6" />
                          </button>
                          <button type="button" onClick={deleteCurrentImage} className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-600 text-white p-2 rounded-full">
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 px-3 py-1 rounded-full text-xs text-white">
                            {currentImageIndex + 1} / {allImages.length}
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center justify-center h-full w-full p-4">
                          <div className="rounded-xl border-2 border-dashed border-slate-700/40 bg-slate-950/60 p-4 w-full h-full flex flex-col items-center justify-center">
                            <Upload className="h-12 w-12 text-slate-500 mb-3" />
                            <label htmlFor="image-upload-main" className="cursor-pointer">
                              <div className="border border-[#0e88c9]/60 bg-[#0e88c9]/10 text-[#0e88c9] hover:bg-[#0e88c9]/20 px-4 py-2 rounded-lg text-sm font-medium">
                                Seleccionar Imágenes
                              </div>
                            </label>
                            <input id="image-upload-main" type="file" multiple accept="image/*" onChange={handleNewImagesChange} className="hidden" />
                            <p className="text-xs text-slate-500 mt-2 text-center">PNG, JPG, JPEG hasta 10MB</p>
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Miniaturas */}
                    <div className="flex flex-wrap gap-2 items-center justify-center">
                      {allImages.map((img, idx) => (
                        <button key={idx} type="button" onClick={() => setCurrentImageIndex(idx)}
                          className={`h-14 w-20 flex-shrink-0 rounded-md border overflow-hidden ${idx === currentImageIndex ? 'border-2 border-cyan-500' : 'border border-slate-700'}`}>
                          <div className="relative h-full w-full">
                            <Image src={img} alt="" fill className="object-cover" />
                          </div>
                        </button>
                      ))}
                      {newImages.map((img, idx) => (
                        <div key={`new-${idx}`} className="h-14 w-20 flex-shrink-0 rounded-md border-2 border-emerald-500 bg-slate-900 overflow-hidden">
                          <img src={URL.createObjectURL(img)} alt={`Nueva ${idx + 1}`} className="h-full w-full object-cover" />
                        </div>
                      ))}
                    </div>
                    {allImages.length > 0 && (
                      <div className="border-t border-slate-700/40 pt-3 text-center">
                        <label htmlFor="image-upload-add" className="cursor-pointer inline-flex items-center gap-2 border border-[#0e88c9]/60 bg-[#0e88c9]/10 text-[#0e88c9] hover:bg-[#0e88c9]/20 px-3 py-1.5 rounded-lg text-xs font-medium">
                          <Upload className="h-3 w-3" /> Agregar Nuevas Imágenes
                        </label>
                        <input id="image-upload-add" type="file" multiple accept="image/*" onChange={handleNewImagesChange} className="hidden" />
                      </div>
                    )}
                    </CardContent>
                  </Card>

                  {/* Información Adicional - debajo de galería */}
                  <Card className="bg-[#141e2e] border border-[#0e88c9]/30 rounded-xl">
                    <CardHeader className="py-2 px-3">
                      <CardTitle className="text-xs text-slate-200">INFORMACIÓN ADICIONAL</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 space-y-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Etiquetas de Búsqueda</Label>
                        <Input value={producto.etiquetas || ''} onChange={(e) => updateProductField('etiquetas', e.target.value)}
                          placeholder="frenos, disco, toyota..." className="h-7 text-xs bg-slate-950/80 border-slate-700/40 text-slate-100" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Referencias Directas (OE)</Label>
                        <Textarea value={producto.info_referencias_directas || ''} onChange={(e) => updateProductField('info_referencias_directas', e.target.value)}
                          rows={2} className="text-xs bg-slate-950/80 border-slate-700/40 text-slate-100 resize-none" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Referencias Indirectas</Label>
                        <Textarea value={producto.info_referencias_indirectas || ''} onChange={(e) => updateProductField('info_referencias_indirectas', e.target.value)}
                          rows={2} className="text-xs bg-slate-950/80 border-slate-700/40 text-slate-100 resize-none" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Columna Derecha: Info Producto + Clasificación + Precios */}
                <div className="space-y-4">
                  <Card className="bg-[#141e2e] border border-[#0e88c9]/30 rounded-xl">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm text-slate-100 tracking-wide">INFORMACIÓN DEL PRODUCTO</CardTitle>
                      <CardDescription className="text-xs text-slate-400">Ingrese los datos básicos y técnicos</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="nombre">Nombre del Producto *</Label>
                        <Input id="nombre" value={producto.nombre} onChange={(e) => updateProductField('nombre', e.target.value)}
                          className="bg-slate-950/80 border-slate-700/40 text-slate-100" required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="descripcion">Descripción</Label>
                        <Input id="descripcion" value={producto.descripcion || ''} onChange={(e) => updateProductField('descripcion', e.target.value)}
                          className="bg-slate-950/80 border-slate-700/40 text-slate-100" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="marca">Marca</Label>
                          <Input id="marca" value={producto.marca || ''} onChange={(e) => updateProductField('marca', e.target.value)}
                            className="bg-slate-950/80 border-slate-700/40 text-slate-100" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="OE">Referencia OE *</Label>
                          <Input id="OE" value={producto.OE || ''} onChange={(e) => updateProductField('OE', e.target.value)}
                            className="bg-slate-950/80 border-slate-700/40 text-slate-100" required />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="idprodprov">Código Proveedor</Label>
                          <Input id="idprodprov" value={producto.idprodprov || ''} onChange={(e) => updateProductField('idprodprov', e.target.value)}
                            className="bg-slate-950/80 border-slate-700/40 text-slate-100" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="idprodpaquete">Código Paquete</Label>
                          <Input id="idprodpaquete" value={producto.idprodpaquete || ''} onChange={(e) => updateProductField('idprodpaquete', e.target.value)}
                            className="bg-slate-950/80 border-slate-700/40 text-slate-100" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="idprodfisico">ID Producto Físico</Label>
                          <Input id="idprodfisico" value={producto.idprodfisico || ''} onChange={(e) => updateProductField('idprodfisico', e.target.value)}
                            className="bg-slate-950/80 border-slate-700/40 text-slate-100" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="codigo_barras">Código de Barras</Label>
                        <Input id="codigo_barras" value={producto.codigo_barras || ''} onChange={(e) => updateProductField('codigo_barras', e.target.value)}
                          className="bg-slate-950/80 border-slate-700/40 text-slate-100" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-[#141e2e] border border-[#0e88c9]/30 rounded-xl">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm text-slate-100 tracking-wide">CLASIFICACIÓN Y STOCK</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>Categoría *</Label>
                          <Select value={producto.idcategoria} onValueChange={(v) => updateProductField('idcategoria', v)}>
                            <SelectTrigger className="bg-slate-950/80 border-slate-700/40 text-slate-100">
                              <SelectValue placeholder="Seleccione" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-700">
                              {categorias.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Lado</Label>
                          <Select value={producto.lado} onValueChange={(v) => updateProductField('lado', v)}>
                            <SelectTrigger className="bg-slate-950/80 border-slate-700/40 text-slate-100">
                              <SelectValue placeholder="Seleccione" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-700">
                              {lados.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Unidad de Medida</Label>
                          <Select value={producto.unimedida} onValueChange={(v) => updateProductField('unimedida', v)}>
                            <SelectTrigger className="bg-slate-950/80 border-slate-700/40 text-slate-100">
                              <SelectValue placeholder="Seleccione" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-700">
                              {unidadesMedida.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-4">
                        <div className="space-y-2">
                          <Label>Stock Contable</Label>
                          <Input type="number" value={producto.stock_contable || 0} onChange={(e) => updateProductField('stock_contable', Number(e.target.value))}
                            className="bg-slate-950/80 border-slate-700/40 text-slate-100" />
                        </div>
                        <div className="space-y-2">
                          <Label>Stock Físico</Label>
                          <Input type="number" value={producto.stock_fisico || 0} onChange={(e) => updateProductField('stock_fisico', Number(e.target.value))}
                            className="bg-slate-950/80 border-slate-700/40 text-slate-100" />
                        </div>
                        <div className="space-y-2">
                          <Label>Costo</Label>
                          <Input type="number" step="0.01" value={producto.costo || ''} onChange={(e) => updateProductField('costo', e.target.value)}
                            className="bg-slate-950/80 border-slate-700/40 text-slate-100" />
                        </div>
                        <div className="space-y-2">
                          <Label>Peso (lb)</Label>
                          <Input type="number" step="0.001" value={producto.peso || ''} onChange={(e) => updateProductField('peso', e.target.value)}
                            className="bg-slate-950/80 border-slate-700/40 text-slate-100" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-2">
                        <input type="checkbox" id="exento" checked={producto.exento === 1} onChange={(e) => updateProductField('exento', e.target.checked ? 1 : 0)}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-950/80 text-[#0e88c9]" />
                        <Label htmlFor="exento" className="cursor-pointer">Exento de Impuestos</Label>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Sección de Precios con Bloqueo */}
                  <Card className="bg-[#141e2e] border border-[#ff6b35]/30 rounded-xl">
                    <CardHeader className="pb-3 flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-sm text-[#ff6b35] tracking-wide">AJUSTE DE PRECIOS</CardTitle>
                        <CardDescription className="text-xs text-slate-400">Modifica los precios con justificación</CardDescription>
                      </div>
                      <Button
                        type="button"
                        onClick={() => setPreciosDesbloqueado(!preciosDesbloqueado)}
                        className={`h-8 px-3 ${
                          preciosDesbloqueado
                            ? 'bg-green-600 hover:bg-green-700'
                            : 'bg-yellow-600 hover:bg-yellow-700'
                        }`}
                      >
                        {preciosDesbloqueado ? (
                          <><Unlock className="h-4 w-4 mr-1" /> Desbloqueado</>
                        ) : (
                          <><Lock className="h-4 w-4 mr-1" /> Desbloquear</>
                        )}
                      </Button>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {!preciosDesbloqueado && (
                        <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className="text-yellow-500">🔒</span>
                            <p className="text-xs text-yellow-500 font-medium">
                              Click en "Desbloquear" para modificar los precios
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          { key: 'precio1', label: 'General' },
                          { key: 'precio2', label: 'Mayorista' },
                          { key: 'precio3', label: 'Cliente' },
                          { key: 'precio4', label: 'Mecánico' },
                          { key: 'precio5', label: 'Minorista' },
                          { key: 'precio6', label: 'Inversor' },
                          { key: 'precio7', label: 'Especial' },
                        ].map(({ key, label }) => (
                          <div key={key} className="space-y-1">
                            <Label className="text-xs text-slate-400">{label}</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={precios[key as keyof Precios] || 0}
                              onChange={(e) => updatePrecioField(key as keyof Precios, parseFloat(e.target.value) || 0)}
                              disabled={!preciosDesbloqueado}
                              className={`h-8 text-sm font-mono ${
                                !preciosDesbloqueado ? 'bg-[#1e2a3b]/50 cursor-not-allowed opacity-60' : 'bg-slate-950/80'
                              } border-slate-700/40 text-slate-100`}
                            />
                          </div>
                        ))}
                      </div>

                      {preciosDesbloqueado && (
                        <div className="p-3 bg-[#0e88c9]/10 border border-[#0e88c9]/30 rounded-lg">
                          <Label className="text-xs font-medium text-[#0e88c9] block mb-2">
                            Justificación del Ajuste (Requerido) *
                          </Label>
                          <Textarea
                            placeholder="Explica el motivo del ajuste de precios..."
                            value={justificacionPrecio}
                            onChange={(e) => setJustificacionPrecio(e.target.value)}
                            className="bg-slate-950/80 border-[#0e88c9]/50 text-slate-200 min-h-[60px] text-sm"
                          />
                          <div className="flex justify-end gap-2 mt-3">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setPreciosDesbloqueado(false);
                                setJustificacionPrecio('');
                                if (producto) fetchPrecios(producto.idprod);
                              }}
                              className="h-8 px-4 border-slate-600 text-slate-300 hover:bg-slate-700"
                            >
                              Cancelar
                            </Button>
                            <Button
                              type="button"
                              onClick={handleGuardarPrecios}
                              disabled={savingPrecios || !justificacionPrecio.trim()}
                              className="bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white h-8 px-4"
                            >
                              <Save className="h-4 w-4 mr-1" />
                              {savingPrecios ? 'Guardando...' : 'Guardar Precios'}
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Historial de Ajustes */}
                      <div className="border-t border-slate-700/40 pt-3">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setMostrarHistorial(!mostrarHistorial)}
                          className="w-full justify-between text-slate-300 hover:text-[#0e88c9] hover:bg-[#1e2a3b] h-8"
                        >
                          <div className="flex items-center gap-2">
                            <History className="h-4 w-4" />
                            <span className="text-xs font-medium">Historial de Modificaciones</span>
                          </div>
                          <span className="text-xs text-slate-500">
                            {mostrarHistorial ? 'Ocultar' : 'Ver historial'}
                          </span>
                        </Button>

                        {mostrarHistorial && (
                          <div className="mt-3 space-y-2 max-h-[250px] overflow-y-auto">
                            {historialPrecios.length > 0 ? (
                              historialPrecios.map((ajuste) => (
                                <div key={ajuste.idajuste} className="bg-[#0d1523] border border-[#1e2a3b] rounded-lg p-3">
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
                                  
                                  {/* Tabla de cambios de precios */}
                                  <div className="mb-2 overflow-x-auto">
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="border-b border-[#1e2a3b]">
                                          <th className="text-left py-1 px-1 text-slate-500 font-medium">Precio</th>
                                          <th className="text-right py-1 px-1 text-red-400 font-medium">Anterior</th>
                                          <th className="text-center py-1 px-1 text-slate-500">→</th>
                                          <th className="text-right py-1 px-1 text-green-400 font-medium">Nuevo</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {[
                                          { nombre: 'General', anterior: ajuste.precio1_anterior, nuevo: ajuste.precio1_nuevo },
                                          { nombre: 'Mayorista', anterior: ajuste.precio2_anterior, nuevo: ajuste.precio2_nuevo },
                                          { nombre: 'Cliente', anterior: ajuste.precio3_anterior, nuevo: ajuste.precio3_nuevo },
                                          { nombre: 'Mecánico', anterior: ajuste.precio4_anterior, nuevo: ajuste.precio4_nuevo },
                                          { nombre: 'Minorista', anterior: ajuste.precio5_anterior, nuevo: ajuste.precio5_nuevo },
                                          { nombre: 'Inversor', anterior: ajuste.precio6_anterior, nuevo: ajuste.precio6_nuevo },
                                          { nombre: 'Especial', anterior: ajuste.precio7_anterior, nuevo: ajuste.precio7_nuevo },
                                        ].filter(p => p.anterior !== null || p.nuevo !== null).map((precio, idx) => {
                                          const anteriorNum = Number(precio.anterior) || 0;
                                          const nuevoNum = Number(precio.nuevo) || 0;
                                          const diff = nuevoNum - anteriorNum;
                                          return (
                                            <tr key={idx} className={`border-b border-[#1e2a3b]/50 ${diff !== 0 ? 'bg-[#0e88c9]/5' : ''}`}>
                                              <td className="py-1 px-1 text-slate-300">{precio.nombre}</td>
                                              <td className="py-1 px-1 text-right font-mono text-red-400/80">
                                                ${anteriorNum.toFixed(2)}
                                              </td>
                                              <td className="py-1 px-1 text-center text-slate-600">→</td>
                                              <td className="py-1 px-1 text-right font-mono text-green-400">
                                                ${nuevoNum.toFixed(2)}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>

                                  <div className="text-xs text-slate-300 pt-1 border-t border-[#1e2a3b]">
                                    <span className="font-medium text-[#0e88c9]">Razón:</span>
                                    <p className="mt-0.5 text-slate-400">{ajuste.razon_justificacion}</p>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="text-center py-4 text-xs text-slate-500">
                                No hay historial de modificaciones
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </form>
            ) : (
              /* Preview del Producto */
              <Card className="bg-[#141e2e] border border-[#0e88c9]/30 rounded-xl h-full">
                {productoPreview ? (
                  <>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg text-slate-200">{productoPreview.nombre}</CardTitle>
                        <Button onClick={() => handleEditProduct(productoPreview.idprod)} className="bg-[#0e88c9]/10 text-[#0e88c9] border border-[#0e88c9]/40">
                          <Edit className="h-4 w-4 mr-2" />
                          Editar Producto
                        </Button>
                      </div>
                      <CardDescription className="text-slate-400">{productoPreview.descripcion || 'Sin descripción'}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-slate-900 rounded-lg overflow-hidden aspect-square relative">
                          {previewImages.length > 0 ? (
                            <Image src={previewImages[0]} alt={productoPreview.nombre} fill className="object-contain" />
                          ) : (
                            <div className="flex items-center justify-center h-full">
                              <Package className="h-16 w-16 text-slate-600" />
                            </div>
                          )}
                        </div>
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-slate-900/50 rounded-lg p-3">
                              <p className="text-xs text-slate-500">ID Producto</p>
                              <p className="text-lg font-bold text-slate-200">{productoPreview.idprod}</p>
                            </div>
                            <div className="bg-slate-900/50 rounded-lg p-3">
                              <p className="text-xs text-slate-500">Stock</p>
                              <p className={`text-lg font-bold ${productoPreview.stock_contable > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {productoPreview.stock_contable}
                              </p>
                            </div>
                          </div>
                          <div className="bg-slate-900/50 rounded-lg p-3">
                            <p className="text-xs text-slate-500">Referencia OE</p>
                            <p className="text-sm font-medium text-slate-200">{productoPreview.OE || '-'}</p>
                          </div>
                          <div className="bg-slate-900/50 rounded-lg p-3">
                            <p className="text-xs text-slate-500">Marca</p>
                            <p className="text-sm font-medium text-slate-200">{productoPreview.marca || '-'}</p>
                          </div>
                          <div className="bg-slate-900/50 rounded-lg p-3">
                            <p className="text-xs text-slate-500">Categoría</p>
                            <Badge variant="outline">{productoPreview.categoria_nombre || productoPreview.idcategoria || '-'}</Badge>
                          </div>
                          <div className="bg-slate-900/50 rounded-lg p-3">
                            <p className="text-xs text-slate-500">Costo</p>
                            <p className="text-lg font-bold text-emerald-400">${productoPreview.costo || '0.00'}</p>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-800">
                        <div>
                          <p className="text-xs text-slate-500">Cód. Proveedor</p>
                          <p className="text-sm text-slate-300">{productoPreview.idprodprov || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Cód. Paquete</p>
                          <p className="text-sm text-slate-300">{productoPreview.idprodpaquete || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Código Barras</p>
                          <p className="text-sm text-slate-300">{productoPreview.codigo_barras || '-'}</p>
                        </div>
                      </div>
                    </CardContent>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
                    <Package className="h-16 w-16 text-slate-600 mb-4" />
                    <p className="text-slate-400">Selecciona un producto de la lista</p>
                    <p className="text-xs text-slate-500 mt-1">Usa las flechas ↑↓ o pasa el mouse</p>
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function EditarProductoPage() {
  return (
    <Suspense fallback={
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-[#0e88c9]"></div>
        </div>
      </DashboardLayout>
    }>
      <EditarProductoContent />
    </Suspense>
  );
}
