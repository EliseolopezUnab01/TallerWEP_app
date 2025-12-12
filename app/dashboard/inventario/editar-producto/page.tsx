'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ImageUpload } from '@/components/image-upload';
import { 
  Search, Bell, UserCircle2, ChevronLeft, ChevronRight, X, Package, Save, Trash2, ArrowLeft
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

function EditarProductoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const idParam = searchParams?.get('id');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [producto, setProducto] = useState<Producto | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Producto[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [newImages, setNewImages] = useState<File[]>([]);
  const [imagesToDelete, setImagesToDelete] = useState<string[]>([]);

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
    if (idParam) {
      setError('');
      fetchProducto();
    } else {
      setLoading(false);
      setError('');
    }
  }, [idParam]);

  const fetchProducto = async () => {
    try {
      const response = await fetch('/api/productos');
      if (response.ok) {
        const data = await response.json();
        const found = data.products?.find((p: any) => p.idprod === Number(idParam));
        if (found) {
          setProducto(found);
        } else {
          setError('Producto no encontrado');
        }
      } else {
        setError('Error al cargar productos');
      }
    } catch (error) {
      console.error('Error al cargar producto:', error);
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    try {
      const response = await fetch('/api/productos');
      if (response.ok) {
        const data = await response.json();
        const results = data.products?.filter((p: any) => {
          const searchLower = query.toLowerCase();
          return (
            p.codigo_barras?.toLowerCase().includes(searchLower) ||
            p.OE?.toLowerCase().includes(searchLower) ||
            p.idprodprov?.toLowerCase().includes(searchLower) ||
            p.nombre?.toLowerCase().includes(searchLower) ||
            p.idprod?.toString().includes(searchLower)
          );
        }) || [];
        setSearchResults(results);
        setShowSearchResults(true);
      }
    } catch (error) {
      console.error('Error al buscar:', error);
    }
  };

  const selectProduct = (productId: number) => {
    router.push(`/dashboard/inventario/editar-producto?id=${productId}`);
    setShowSearchResults(false);
    setSearchQuery('');
  };

  const updateProductField = (field: keyof Producto, value: any) => {
    if (!producto) return;
    setProducto({
      ...producto,
      [field]: value
    });
  };

  const handleNewImagesChange = (images: File[]) => {
    setNewImages(images);
  };

  const getAllImages = () => {
    if (!producto) return [];
    const images = [];
    if (producto.imagen_principal) images.push(producto.imagen_principal);
    if (producto.imagenes && producto.imagenes.length > 0) {
      images.push(...producto.imagenes);
    }
    return images.filter(img => !imagesToDelete.includes(img)).slice(0, 10);
  };

  const deleteCurrentImage = () => {
    const allImages = getAllImages();
    if (allImages.length > 0 && currentImageIndex < allImages.length) {
      const imageToDelete = allImages[currentImageIndex];
      setImagesToDelete([...imagesToDelete, imageToDelete]);
      if (currentImageIndex >= allImages.length - 1) {
        setCurrentImageIndex(Math.max(0, currentImageIndex - 1));
      }
    }
  };

  const nextImage = () => {
    const allImages = getAllImages();
    if (allImages.length === 0) return;
    if (currentImageIndex >= allImages.length - 1) {
      setCurrentImageIndex(0);
    } else {
      setCurrentImageIndex(currentImageIndex + 1);
    }
  };

  const prevImage = () => {
    const allImages = getAllImages();
    if (allImages.length === 0) return;
    if (currentImageIndex <= 0) {
      setCurrentImageIndex(allImages.length - 1);
    } else {
      setCurrentImageIndex(currentImageIndex - 1);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!producto) return;

    setSaving(true);
    try {
      const submitData = new FormData();
      
      Object.entries(producto).forEach(([key, value]) => {
        if (key !== 'imagenes' && key !== 'imagen_principal') {
          submitData.append(key, typeof value === 'boolean' ? String(value) : String(value || ''));
        }
      });

      newImages.forEach(image => {
        submitData.append('imagenes', image);
      });

      if (imagesToDelete.length > 0) {
        submitData.append('imagenes_eliminar', JSON.stringify(imagesToDelete));
      }

      const response = await fetch(`/api/productos/${producto.idprod}`, {
        method: 'PUT',
        body: submitData,
      });

      if (response.ok) {
        alert('✅ Producto actualizado exitosamente');
        setNewImages([]);
        setImagesToDelete([]);
        fetchProducto();
      } else {
        const data = await response.json();
        alert(`❌ Error al actualizar: ${data.error || 'Error desconocido'}`);
      }
    } catch (error) {
      console.error('Error al guardar:', error);
      alert('❌ Error al conectar con el servidor');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[80vh]">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-[#0e88c9] mb-4"></div>
          <div className="text-lg text-slate-200">Cargando producto...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (!idParam) {
    return (
      <DashboardLayout>
        <div className="space-y-6 max-w-6xl mx-auto">
          <div className="rounded-xl border border-[#0e88c9]/30 bg-[#0d1523] px-5 py-3 flex items-center justify-between gap-4 shadow-[0_0_25px_rgba(15,23,42,0.9)]">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Inventario</span>
              <span className="h-6 w-px bg-slate-700" />
              <span className="text-sm tracking-[0.18em] uppercase text-slate-200">Editar Producto</span>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon" className="border-slate-700 bg-slate-950/60 text-slate-300">
                <Bell className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="border-slate-700 bg-slate-950/60 text-slate-300">
                <UserCircle2 className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="text-slate-300 hover:text-slate-50" onClick={() => router.push('/dashboard/inventario/administrar')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-50 tracking-tight">Editar Producto</h1>
                <p className="text-sm text-slate-400">Busca un producto para editar su información</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 max-w-2xl relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                type="text"
                placeholder="Buscar por código, OEM, referencia, nombre..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10 bg-[#0d1523] border-[#1e2a3b] text-slate-200 h-12"
              />
              {showSearchResults && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-[#0d1523] border border-[#1e2a3b] rounded-lg shadow-xl max-h-96 overflow-y-auto z-50">
                  {searchResults.map((result) => (
                    <button
                      key={result.idprod}
                      onClick={() => selectProduct(result.idprod)}
                      className="w-full px-4 py-3 hover:bg-[#1e2a3b] transition-colors text-left border-b border-[#1e2a3b] last:border-b-0"
                    >
                      <div className="text-sm font-semibold text-slate-200">{result.nombre}</div>
                      <div className="text-xs text-slate-400 mt-1">ID: {result.idprod} | OEM: {result.OE}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button variant="outline" onClick={() => setShowSearchResults(false)} className="border-[#1e2a3b]">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-col items-center justify-center mt-20">
            <Package className="h-32 w-32 text-slate-600 mb-6" />
            <h2 className="text-xl font-semibold text-slate-300 mb-2">Busca un producto para editar</h2>
            <p className="text-sm text-slate-500 mb-6">Usa la barra de búsqueda para encontrar el producto</p>
            <Button onClick={() => router.push('/dashboard/inventario/administrar')} variant="outline" className="border-[#0e88c9]/60 text-[#0e88c9]">
              Ver todos los productos
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error && idParam) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[80vh]">
          <Package className="h-24 w-24 text-slate-600 mb-4" />
          <div className="text-lg text-slate-200 mb-2">{error}</div>
          <Button onClick={() => router.push('/dashboard/inventario/editar-producto')} className="bg-[#0e88c9]">
            Volver a buscar
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  if (!producto) return null;

  const allImages = getAllImages();

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl mx-auto pb-12">
        <div className="rounded-xl border border-[#0e88c9]/30 bg-[#0d1523] px-5 py-3 flex items-center justify-between gap-4 shadow-[0_0_25px_rgba(15,23,42,0.9)]">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Inventario</span>
            <span className="h-6 w-px bg-slate-700" />
            <span className="text-sm tracking-[0.18em] uppercase text-slate-200">Editar Producto</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" className="border-slate-700 bg-slate-950/60 text-slate-300">
              <Bell className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="border-slate-700 bg-slate-950/60 text-slate-300">
              <UserCircle2 className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="text-slate-300 hover:text-slate-50" onClick={() => router.push('/dashboard/inventario/administrar')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-50 tracking-tight">Editar Producto</h1>
              <p className="text-sm text-slate-400">Modifica la información del producto seleccionado</p>
            </div>
          </div>
          <Button 
            type="submit" 
            form="product-form"
            disabled={saving} 
            className="border-[#0e88c9]/60 bg-[#0e88c9]/10 text-[#0e88c9] hover:bg-[#0e88c9]/20 rounded-full px-5"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </div>

        <form id="product-form" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Columna 1: IMAGE GALLERY */}
            <div className="space-y-6 lg:order-1">
              <Card className="bg-[#141e2e] border border-[#0e88c9]/30 shadow-[0_0_20px_rgba(14,136,201,0.25)] rounded-xl overflow-hidden">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm text-slate-200 tracking-wide">IMAGE GALLERY</CardTitle>
                  <span className="text-xs text-emerald-400">{allImages.length + newImages.length}/10</span>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="relative w-full h-[250px] bg-slate-900 rounded-2xl overflow-hidden">
                    {allImages.length > 0 ? (
                      <>
                        <div className="relative h-full w-full">
                          <Image
                            src={allImages[currentImageIndex]}
                            alt="Producto"
                            fill
                            className="object-contain"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={prevImage}
                          className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full"
                        >
                          <ChevronLeft className="h-6 w-6" />
                        </button>
                        <button
                          type="button"
                          onClick={nextImage}
                          className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full"
                        >
                          <ChevronRight className="h-6 w-6" />
                        </button>
                        <button
                          type="button"
                          onClick={deleteCurrentImage}
                          className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-600 text-white p-2 rounded-full"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 px-3 py-1 rounded-full text-xs text-white">
                          {currentImageIndex + 1} / {allImages.length}
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-full w-full p-4">
                        <div className="rounded-xl border-2 border-dashed border-slate-700/40 bg-slate-950/60 p-4 w-full h-full flex flex-col items-center justify-center">
                          <ImageUpload onImagesChange={handleNewImagesChange} />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 items-center justify-center">
                    {allImages.map((img, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCurrentImageIndex(idx)}
                        className={`h-14 w-20 flex-shrink-0 rounded-md border overflow-hidden ${
                          idx === currentImageIndex ? 'border-2 border-cyan-700/50' : 'border border-cyan-700/50'
                        }`}
                      >
                        <div className="relative h-full w-full">
                          <Image src={img} alt="" fill className="object-cover" />
                        </div>
                      </button>
                    ))}
                    {newImages.map((img, idx) => (
                      <div key={`new-${idx}`} className="h-14 w-20 flex-shrink-0 rounded-md border-2 border-emerald-500 bg-slate-900 overflow-hidden">
                        <div className="relative h-full w-full">
                          <img 
                            src={URL.createObjectURL(img)} 
                            alt={`Nueva ${idx + 1}`} 
                            className="h-full w-full object-cover"
                          />
                        </div>
                      </div>
                    ))}
                    {allImages.length === 0 && newImages.length === 0 && (
                      <p className="text-xs text-slate-500 text-center">
                        Suba hasta 10 imágenes. Use fotos claras del producto y su empaque.
                      </p>
                    )}
                  </div>
                  {allImages.length > 0 && (
                    <div className="border-t border-slate-700/40 pt-4">
                      <Label className="text-xs text-slate-400 mb-2 block">Agregar Nuevas Imágenes</Label>
                      <ImageUpload onImagesChange={handleNewImagesChange} />
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-[#141e2e] border border-[#0e88c9]/30 shadow-lg rounded-xl">
                <CardContent className="p-6 space-y-2">
                  <Button 
                    type="submit" 
                    disabled={saving} 
                    className="w-full border border-[#0e88c9]/60 bg-[#0e88c9]/10 text-[#0e88c9] hover:bg-[#0e88c9]/20 rounded-xl transition-all"
                    size="lg"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? 'Guardando Cambios...' : 'Guardar Cambios'}
                  </Button>
                  <p className="text-xs text-slate-400 mt-1 text-center">
                    {newImages.length > 0 
                      ? `Se agregarán ${newImages.length} imagen(es) nueva(s)`
                      : 'Producto se actualizará con los cambios realizados'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Columna 2-3: INFORMACIÓN DEL PRODUCTO */}
            <div className="lg:col-span-2 space-y-6 lg:order-2">
              <Card className="bg-[#141e2e] border border-[#0e88c9]/30 shadow-lg rounded-xl">
                <CardHeader className="pb-3 flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm text-slate-100 tracking-wide">INFORMACIÓN DEL PRODUCTO</CardTitle>
                    <CardDescription className="text-xs text-slate-400">Ingrese los datos básicos y técnicos del producto</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="nombre">Nombre del Producto *</Label>
                      <Input 
                        id="nombre" 
                        placeholder="Ej: Buje de Suspensión Delantero" 
                        required 
                        value={producto.nombre}
                        onChange={(e) => updateProductField('nombre', e.target.value)}
                        className="bg-slate-950/80 border-slate-700/40 text-slate-100 placeholder:text-slate-500 focus:border-cyan-700/60 focus:ring-cyan-700/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="descripcion">Descripción</Label>
                      <Input 
                        id="descripcion" 
                        placeholder="Descripción breve del producto" 
                        value={producto.descripcion || ''}
                        onChange={(e) => updateProductField('descripcion', e.target.value)}
                        className="bg-slate-950/80 border-slate-700/40 text-slate-100 placeholder:text-slate-500 focus:border-cyan-700/60 focus:ring-cyan-700/20"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="marca">Marca</Label>
                      <Input 
                        id="marca" 
                        placeholder="Ej: MOOG, BOSCH, etc." 
                        value={producto.marca || ''}
                        onChange={(e) => updateProductField('marca', e.target.value)}
                        className="bg-slate-950/80 border-slate-700/40 text-slate-100 placeholder:text-slate-500 focus:border-cyan-700/60 focus:ring-cyan-700/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="OE">Referencia OE *</Label>
                      <Input 
                        id="OE" 
                        placeholder="Referencia del fabricante" 
                        required 
                        value={producto.OE || ''}
                        onChange={(e) => updateProductField('OE', e.target.value)}
                        className="bg-slate-950/80 border-slate-700/40 text-slate-100 placeholder:text-slate-500 focus:border-cyan-700/60 focus:ring-cyan-700/20"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="idprodprov">Código Proveedor</Label>
                      <Input 
                        id="idprodprov" 
                        placeholder="Código según factura" 
                        value={producto.idprodprov || ''}
                        onChange={(e) => updateProductField('idprodprov', e.target.value)}
                        className="bg-slate-950/80 border-slate-700/40 text-slate-100 placeholder:text-slate-500 focus:border-cyan-700/60 focus:ring-cyan-700/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="idprodpaquete">Código Paquete</Label>
                      <Input 
                        id="idprodpaquete" 
                        placeholder="Código del embalaje" 
                        value={producto.idprodpaquete || ''}
                        onChange={(e) => updateProductField('idprodpaquete', e.target.value)}
                        className="bg-slate-950/80 border-slate-700/40 text-slate-100 placeholder:text-slate-500 focus:border-cyan-700/60 focus:ring-cyan-700/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="idprodfisico">ID Producto Físico</Label>
                      <Input 
                        id="idprodfisico" 
                        placeholder="ID del producto físico" 
                        value={producto.idprodfisico || ''}
                        onChange={(e) => updateProductField('idprodfisico', e.target.value)}
                        className="bg-slate-950/80 border-slate-700/40 text-slate-100 placeholder:text-slate-500 focus:border-cyan-700/60 focus:ring-cyan-700/20"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="codigo_barras">Código de Barras</Label>
                    <Input 
                      id="codigo_barras" 
                      placeholder="Código QR o barras" 
                      value={producto.codigo_barras || ''}
                      onChange={(e) => updateProductField('codigo_barras', e.target.value)}
                      className="bg-slate-950/80 border-slate-700/40 text-slate-100 placeholder:text-slate-500 focus:border-cyan-700/60 focus:ring-cyan-700/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="exento" className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        id="exento"
                        checked={producto.exento === 1}
                        onChange={(e) => updateProductField('exento', e.target.checked ? 1 : 0)}
                        className="w-4 h-4 rounded border-slate-700 bg-slate-950/80 text-[#0e88c9] focus:ring-[#0e88c9] focus:ring-offset-0"
                      />
                      <span className="text-sm">Exento de Impuestos</span>
                    </Label>
                    <p className="text-xs text-slate-500">Marque si el producto está exento de IVA u otros impuestos</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="idcategoria">Categoría *</Label>
                      <Select value={producto.idcategoria} onValueChange={(value) => updateProductField('idcategoria', value)}>
                        <SelectTrigger className="bg-slate-950/80 border-slate-700/40 text-slate-100 focus:border-cyan-700/60 focus:ring-cyan-700/20">
                          <SelectValue placeholder="Seleccione categoría" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-700 text-slate-100">
                          {categorias.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lado">Lado</Label>
                      <Select value={producto.lado} onValueChange={(value) => updateProductField('lado', value)}>
                        <SelectTrigger className="bg-slate-950/80 border-slate-700/40 text-slate-100 focus:border-cyan-700/60 focus:ring-cyan-700/20">
                          <SelectValue placeholder="Seleccione lado" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-700 text-slate-100">
                          {lados.map((lado) => (
                            <SelectItem key={lado} value={lado}>
                              {lado}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="unimedida">Unidad de Medida</Label>
                      <Select 
                        value={producto.unimedida}
                        onValueChange={(value) => updateProductField('unimedida', value)}
                      >
                        <SelectTrigger className="bg-slate-950/80 border-slate-700/40 text-slate-100 focus:border-cyan-700/60 focus:ring-cyan-700/20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-700 text-slate-100">
                          {unidadesMedida.map((unidad) => (
                            <SelectItem key={unidad} value={unidad}>
                              {unidad}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                    <div className="space-y-2">
                      <Label htmlFor="peso">Peso (libras)</Label>
                      <Input 
                        id="peso" 
                        type="number" 
                        step="0.001" 
                        placeholder="0.000" 
                        value={producto.peso || ''}
                        onChange={(e) => updateProductField('peso', e.target.value)}
                        className="bg-slate-950/80 border-slate-700/40 text-slate-100 placeholder:text-slate-500 focus:border-cyan-700/60 focus:ring-cyan-700/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="codarancel">Código Arancelario</Label>
                      <Input 
                        id="codarancel" 
                        placeholder="8708990000" 
                        value={producto.codarancel || ''}
                        onChange={(e) => updateProductField('codarancel', e.target.value)}
                        className="bg-slate-950/80 border-slate-700/40 text-slate-100 placeholder:text-slate-500 focus:border-cyan-700/60 focus:ring-cyan-700/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="capacidad">Capacidad</Label>
                      <Input 
                        id="capacidad" 
                        placeholder="Ej: 1 litro, 5 galones" 
                        value={producto.capacidad || ''}
                        onChange={(e) => updateProductField('capacidad', e.target.value)}
                        className="bg-slate-950/80 border-slate-700/40 text-slate-100 placeholder:text-slate-500 focus:border-cyan-700/60 focus:ring-cyan-700/20"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="etiquetas">Etiquetas de Búsqueda</Label>
                    <Input 
                      id="etiquetas" 
                      placeholder="frenos, disco, delantero, toyota (separar con comas)" 
                      value={producto.etiquetas || ''}
                      onChange={(e) => updateProductField('etiquetas', e.target.value)}
                      className="bg-slate-950/80 border-slate-700/40 text-slate-100 placeholder:text-slate-500 focus:border-cyan-700/60 focus:ring-cyan-700/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="info_referencias_directas">Referencias Directas (OE, OEM)</Label>
                    <Textarea 
                      id="info_referencias_directas" 
                      placeholder="Lista de números originales del fabricante separados por comas..."
                      rows={2}
                      value={producto.info_referencias_directas || ''}
                      onChange={(e) => updateProductField('info_referencias_directas', e.target.value)}
                      className="bg-slate-950/80 border-slate-700/40 text-slate-100 placeholder:text-slate-500 focus:border-cyan-700/60 focus:ring-cyan-700/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="info_referencias_indirectas">Referencias Indirectas</Label>
                    <Textarea 
                      id="info_referencias_indirectas" 
                      placeholder="Referencias indirectas o cruzadas..."
                      rows={2}
                      value={producto.info_referencias_indirectas || ''}
                      onChange={(e) => updateProductField('info_referencias_indirectas', e.target.value)}
                      className="bg-slate-950/80 border-slate-700/40 text-slate-100 placeholder:text-slate-500 focus:border-cyan-700/60 focus:ring-cyan-700/20"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="info_publica">Información Pública</Label>
                      <Textarea 
                        id="info_publica" 
                        placeholder="Información para mostrar a clientes..."
                        rows={3}
                        value={producto.info_publica || ''}
                        onChange={(e) => updateProductField('info_publica', e.target.value)}
                        className="bg-slate-950/80 border-slate-700/40 text-slate-100 placeholder:text-slate-500 focus:border-cyan-700/60 focus:ring-cyan-700/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="info_reservada">Información Reservada</Label>
                      <Textarea 
                        id="info_reservada" 
                        placeholder="Información interna y confidencial..."
                        rows={3}
                        value={producto.info_reservada || ''}
                        onChange={(e) => updateProductField('info_reservada', e.target.value)}
                        className="bg-slate-950/80 border-slate-700/40 text-slate-100 placeholder:text-slate-500 focus:border-cyan-700/60 focus:ring-cyan-700/20"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="tipo">Tipo</Label>
                      <Input 
                        id="tipo" 
                        placeholder="Tipo de producto" 
                        value={producto.tipo || ''}
                        onChange={(e) => updateProductField('tipo', e.target.value)}
                        className="bg-slate-950/80 border-slate-700/40 text-slate-100 placeholder:text-slate-500 focus:border-cyan-700/60 focus:ring-cyan-700/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="modelo">Modelo</Label>
                      <Input 
                        id="modelo" 
                        placeholder="Modelo" 
                        value={producto.modelo || ''}
                        onChange={(e) => updateProductField('modelo', e.target.value)}
                        className="bg-slate-950/80 border-slate-700/40 text-slate-100 placeholder:text-slate-500 focus:border-cyan-700/60 focus:ring-cyan-700/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="clase">Clase</Label>
                      <Input 
                        id="clase" 
                        placeholder="Clase del producto" 
                        value={producto.clase || ''}
                        onChange={(e) => updateProductField('clase', e.target.value)}
                        className="bg-slate-950/80 border-slate-700/40 text-slate-100 placeholder:text-slate-500 focus:border-cyan-700/60 focus:ring-cyan-700/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="estilo">Estilo</Label>
                      <Input 
                        id="estilo" 
                        placeholder="Estilo" 
                        value={producto.estilo || ''}
                        onChange={(e) => updateProductField('estilo', e.target.value)}
                        className="bg-slate-950/80 border-slate-700/40 text-slate-100 placeholder:text-slate-500 focus:border-cyan-700/60 focus:ring-cyan-700/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="giro">Giro</Label>
                      <Input 
                        id="giro" 
                        placeholder="Giro" 
                        value={producto.giro || ''}
                        onChange={(e) => updateProductField('giro', e.target.value)}
                        className="bg-slate-950/80 border-slate-700/40 text-slate-100 placeholder:text-slate-500 focus:border-cyan-700/60 focus:ring-cyan-700/20"
                      />
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <div className="space-y-2 max-w-md">
                      <Label htmlFor="costo">Costo del Producto</Label>
                      <Input 
                        id="costo" 
                        type="number" 
                        step="0.01"
                        placeholder="0.00" 
                        value={producto.costo || ''}
                        onChange={(e) => updateProductField('costo', e.target.value)}
                        className="bg-slate-950/80 border-slate-700/40 text-slate-100 placeholder:text-slate-500 focus:border-cyan-700/60 focus:ring-cyan-700/20"
                      />
                      <p className="text-xs text-slate-500">Precio de compra o costo de adquisición del producto</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="stock_contable">Stock Contable</Label>
                      <Input 
                        id="stock_contable" 
                        type="number" 
                        value={producto.stock_contable || 0}
                        onChange={(e) => updateProductField('stock_contable', Number(e.target.value))}
                        className="bg-slate-950/80 border-slate-700/40 text-slate-100 placeholder:text-slate-500 focus:border-cyan-700/60 focus:ring-cyan-700/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="stock_fisico">Stock Físico</Label>
                      <Input 
                        id="stock_fisico" 
                        type="number" 
                        value={producto.stock_fisico || 0}
                        onChange={(e) => updateProductField('stock_fisico', Number(e.target.value))}
                        className="bg-slate-950/80 border-slate-700/40 text-slate-100 placeholder:text-slate-500 focus:border-cyan-700/60 focus:ring-cyan-700/20"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
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
