'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Search, Bell, UserCircle2, ChevronLeft, ChevronRight, 
  Package, Wrench, Briefcase, Settings, Edit, Save, X, Plus, Trash2
} from 'lucide-react';
import Image from 'next/image';

interface Producto {
  idprod: number;
  nombre: string;
  codigo_barras: string;
  idprodprov: string;
  idprodpaquete: string;
  OE: string;
  descripcion: string;
  etiquetas: string;
  marca: string;
  modelo: string;
  clase: string;
  peso: string;
  codarancel: number;
  lado: string;
  estilo: string;
  giro: string;
  capacidad: string;
  unimedida: string;
  idcategoria: string;
  categoria_nombre: string;
  info_reservada: string;
  info_publica: string;
  info_referencias_directas: string;
  info_referencias_indirectas: string;
  exento: number;
  stock_contable: number;
  stock_fisico: number;
  imagen_principal?: string;
  imagenes?: string[];
  // Campos nuevos de la migración
  precio_manual: string;
  precio_pvr: string;
  precio_lcl: string;
  precio_general: string;
  precio_cliente: string;
  precio_mecanico: string;
  precio_minorista: string;
  precio_mayorista: string;
  precio_especial: string;
  serie: string;
  tipo: string;
  grupo: string;
  subgrupo: string;
  aplicacion_marcas: string;
  aplicacion_modelos: string;
  criterios: string;
  costo: string;
  aplica_imp: number;
  utilidad: string;
  descuento: string;
  descuento_maximo: string;
  dias_entrega: number;
}

interface Precio {
  tipo: string;
  valor: number;
  editable: boolean;
}

function PerfilProductoPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const idParam = searchParams?.get('id');
  
  console.log('PerfilProductoPage - ID recibido:', idParam);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [producto, setProducto] = useState<Producto | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [activeTab, setActiveTab] = useState('producto');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Producto[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Precios múltiples
  const [precios, setPrecios] = useState<Precio[]>([]);

  // Referencias OEM/Cruces
  const [referencias, setReferencias] = useState([
    { fabricante: 'DAF', codigo: '1251720' },
    { fabricante: 'DAF', codigo: '1265391' },
    { fabricante: 'IVECO', codigo: '47272495' },
    { fabricante: 'IVECO', codigo: '46217155' },
    { fabricante: 'IVECO', codigo: '46888615' },
    { fabricante: 'MAN', codigo: '06507311' },
    { fabricante: 'MERCEDES', codigo: 'A0039972792' },
    { fabricante: 'MERCEDES', codigo: '0039972792' },
    { fabricante: 'VOLVO', codigo: '966385' },
  ]);

  // Aplicaciones/Detalles
  const [aplicaciones, setAplicaciones] = useState<string[]>([]);

  // Ubicaciones
  const [ubicaciones, setUbicaciones] = useState([
    { codigo: 'E9-A6', stock: 33 },
  ]);

  useEffect(() => {
    if (idParam) {
      setError(''); // Limpiar error anterior
      fetchProducto();
    } else {
      setLoading(false);
      setError('');
    }
  }, [idParam]);

  const fetchProducto = async () => {
    try {
      console.log('Cargando producto con ID:', idParam);
      const response = await fetch('/api/productos');
      if (response.ok) {
        const data = await response.json();
        console.log('Productos recibidos:', data.products?.length);
        const found = data.products?.find((p: any) => p.idprod === Number(idParam));
        if (found) {
          console.log('Producto encontrado:', found);
          setProducto(found);
          
          // Cargar los 7 tipos de precios desde la base de datos
          const preciosFromDB: Precio[] = [
            { tipo: 'Precio 1 - GENERAL', valor: parseFloat(found.precio1 || 0), editable: false },
            { tipo: 'Precio 2 - MAYORISTA', valor: parseFloat(found.precio2 || 0), editable: false },
            { tipo: 'Precio 3 - CLIENTE', valor: parseFloat(found.precio3 || 0), editable: false },
            { tipo: 'Precio 4 - MECÁNICO', valor: parseFloat(found.precio4 || 0), editable: false },
            { tipo: 'Precio 5 - MAYORISTA', valor: parseFloat(found.precio5 || 0), editable: false },
            { tipo: 'Precio 6 - INVERSOR', valor: parseFloat(found.precio6 || 0), editable: false },
            { tipo: 'Precio 7 - ESPECIAL', valor: parseFloat(found.precio7 || 0), editable: false },
          ];
          setPrecios(preciosFromDB);
          
          // Cargar aplicaciones/detalles
          const apps: string[] = [];
          if (found.info_publica) apps.push(found.info_publica);
          if (found.info_referencias_directas) apps.push(found.info_referencias_directas);
          if (found.criterios) apps.push(found.criterios);
          setAplicaciones(apps.length > 0 ? apps : ['Sin información de aplicaciones disponible']);
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
            p.idprodpaquete?.toLowerCase().includes(searchLower) ||
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
    router.push(`/dashboard/inventario/perfil?id=${productId}`);
    setShowSearchResults(false);
    setSearchQuery('');
  };

  const getAllImages = () => {
    if (!producto) return [];
    const images = [];
    if (producto.imagen_principal) images.push(producto.imagen_principal);
    if (producto.imagenes && producto.imagenes.length > 0) {
      images.push(...producto.imagenes);
    }
    return images.slice(0, 10); // Máximo 10 imágenes
  };

  const nextImage = () => {
    const allImages = getAllImages();
    if (allImages.length === 0) return;
    
    // Si está en la última imagen, volver a la primera
    if (currentImageIndex >= allImages.length - 1) {
      setCurrentImageIndex(0);
    } else {
      setCurrentImageIndex(currentImageIndex + 1);
    }
  };

  const prevImage = () => {
    const allImages = getAllImages();
    if (allImages.length === 0) return;
    
    // Si está en la primera imagen, ir a la última
    if (currentImageIndex <= 0) {
      setCurrentImageIndex(allImages.length - 1);
    } else {
      setCurrentImageIndex(currentImageIndex - 1);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-screen bg-[#0a0f1a]">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-[#0e88c9] mb-4"></div>
          <div className="text-lg text-slate-200">Cargando producto...</div>
          {idParam && <div className="text-sm text-slate-400 mt-2">ID: {idParam}</div>}
        </div>
      </DashboardLayout>
    );
  }

  // Si no hay ID, mostrar la misma interfaz pero sin producto cargado
  if (!idParam) {
    // Usar un producto vacío para mantener la misma estructura visual
    const emptyProducto = {
      idprod: 0,
      nombre: '',
      imagen_principal: '',
      imagenes: []
    };
    
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-[#0a0f1a] p-6">
          {/* Navbar superior tipo Figma */}
          <div className="rounded-xl border border-[#0e88c9]/30 bg-[#0d1523] px-5 py-3 flex items-center justify-between gap-4 shadow-[0_0_25px_rgba(15,23,42,0.9)] mb-6">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Inventario</span>
              <span className="h-6 w-px bg-slate-700" />
              <span className="text-sm tracking-[0.18em] uppercase text-slate-200">Perfil del Producto</span>
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
            <h1 className="text-2xl md:text-3xl font-bold text-slate-50 tracking-tight">Perfil del Producto</h1>
            <p className="text-sm text-slate-400">Visualiza y gestiona la información detallada del producto</p>
          </div>

          {/* Barra de búsqueda */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 max-w-2xl relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Buscar por código, OEM, referencia, nombre..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10 bg-[#0d1523] border-[#1e2a3b] text-slate-200 placeholder:text-slate-500 h-12 text-base"
                />
              </div>
              
              {/* Resultados de búsqueda */}
              {showSearchResults && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-[#0d1523] border border-[#1e2a3b] rounded-lg shadow-xl max-h-96 overflow-y-auto z-50">
                  {searchResults.map((result) => (
                    <button
                      key={result.idprod}
                      onClick={() => selectProduct(result.idprod)}
                      className="w-full px-4 py-3 hover:bg-[#1e2a3b] transition-colors text-left border-b border-[#1e2a3b] last:border-b-0"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-slate-200">{result.nombre}</div>
                          <div className="flex gap-4 mt-1 text-xs text-slate-400">
                            {result.codigo_barras && (
                              <span>Código: <span className="text-[#0e88c9]">{result.codigo_barras}</span></span>
                            )}
                            {result.OE && (
                              <span>OEM: <span className="text-[#0e88c9]">{result.OE}</span></span>
                            )}
                            {result.idprodprov && (
                              <span>Ref: <span className="text-[#0e88c9]">{result.idprodprov}</span></span>
                            )}
                          </div>
                        </div>
                        <Badge variant="outline" className="bg-[#0e88c9]/10 text-[#0e88c9] border-[#0e88c9]/30">
                          ID: {result.idprod}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              
              {showSearchResults && searchResults.length === 0 && searchQuery.length >= 2 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-[#0d1523] border border-[#1e2a3b] rounded-lg shadow-xl p-4 z-50">
                  <div className="text-center text-slate-400">
                    <Package className="h-12 w-12 mx-auto mb-2 text-slate-600" />
                    <p>No se encontraron productos</p>
                  </div>
                </div>
              )}
            </div>
            
            <Button
              variant="outline"
              onClick={() => {
                setShowSearchResults(false);
                setSearchQuery('');
              }}
              className="border-[#1e2a3b] text-slate-300 hover:bg-[#1e2a3b]"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Contenido principal - Mensaje de búsqueda */}
          <div className="flex flex-col items-center justify-center mt-20">
            <Package className="h-32 w-32 text-slate-600 mb-6" />
            <h2 className="text-xl font-semibold text-slate-300 mb-2">Busca un producto</h2>
            <p className="text-sm text-slate-500 mb-6">Usa la barra de búsqueda para encontrar y visualizar el perfil del producto</p>
            <Button
              onClick={() => router.push('/dashboard/inventario/administrar')}
              variant="outline"
              className="border-[#0e88c9]/60 text-[#0e88c9] hover:bg-[#0e88c9]/10"
            >
              <Package className="h-4 w-4 mr-2" />
              Ver todos los productos
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Si hay error después de buscar, mostrar mensaje con opción de volver
  if (error && idParam) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-screen bg-[#0a0f1a]">
          <Package className="h-24 w-24 text-slate-600 mb-4" />
          <div className="text-lg text-slate-200 mb-2">{error}</div>
          <div className="text-sm text-slate-400 mb-4">ID solicitado: {idParam}</div>
          <Button
            onClick={() => router.push('/dashboard/inventario/perfil')}
            className="bg-[#0e88c9] hover:bg-[#0e88c9]/90 text-white"
          >
            Volver a buscar
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  if (!producto && idParam) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-[#0a0f1a] p-6">
        {/* Navbar superior tipo Figma */}
        <div className="rounded-xl border border-[#0e88c9]/30 bg-[#0d1523] px-5 py-3 flex items-center justify-between gap-4 shadow-[0_0_25px_rgba(15,23,42,0.9)] mb-6">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Inventario</span>
            <span className="h-6 w-px bg-slate-700" />
            <span className="text-sm tracking-[0.18em] uppercase text-slate-200">Perfil del Producto</span>
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
          <h1 className="text-2xl md:text-3xl font-bold text-slate-50 tracking-tight">Perfil del Producto</h1>
          <p className="text-sm text-slate-400">Visualiza y gestiona la información detallada del producto</p>
        </div>

        {/* Barra de búsqueda */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 max-w-2xl relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                type="text"
                placeholder="Buscar por código, OEM, referencia, nombre..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10 bg-[#0d1523] border-[#1e2a3b] text-slate-200 placeholder:text-slate-500 h-12 text-base"
              />
            </div>
            
            {/* Resultados de búsqueda */}
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-[#0d1523] border border-[#1e2a3b] rounded-lg shadow-xl max-h-96 overflow-y-auto z-50">
                {searchResults.map((result) => (
                  <button
                    key={result.idprod}
                    onClick={() => selectProduct(result.idprod)}
                    className="w-full px-4 py-3 hover:bg-[#1e2a3b] transition-colors text-left border-b border-[#1e2a3b] last:border-b-0"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-slate-200">{result.nombre}</div>
                        <div className="flex gap-4 mt-1 text-xs text-slate-400">
                          {result.codigo_barras && (
                            <span>Código: <span className="text-[#0e88c9]">{result.codigo_barras}</span></span>
                          )}
                          {result.OE && (
                            <span>OEM: <span className="text-[#0e88c9]">{result.OE}</span></span>
                          )}
                          {result.idprodprov && (
                            <span>Ref: <span className="text-[#0e88c9]">{result.idprodprov}</span></span>
                          )}
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-[#0e88c9]/10 text-[#0e88c9] border-[#0e88c9]/30">
                        ID: {result.idprod}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            )}
            
            {showSearchResults && searchResults.length === 0 && searchQuery.length >= 2 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-[#0d1523] border border-[#1e2a3b] rounded-lg shadow-xl p-4 z-50">
                <div className="text-center text-slate-400">
                  <Package className="h-12 w-12 mx-auto mb-2 text-slate-600" />
                  <p>No se encontraron productos</p>
                </div>
              </div>
            )}
          </div>
          
          <Button
            variant="outline"
            onClick={() => {
              setShowSearchResults(false);
              setSearchQuery('');
            }}
            className="border-[#1e2a3b] text-slate-300 hover:bg-[#1e2a3b]"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Contenido principal */}
        <div>
          {/* Header con código y acciones */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.back()}
                className="text-slate-400 hover:text-slate-200"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-4">
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">CÓDIGO</div>
                  <div className="text-2xl font-bold text-[#0e88c9]">{producto.idprod}</div>
                </div>
                <div className="border-l border-[#1e2a3b] pl-4 h-12 flex items-center">
                  <div className="text-xl font-semibold text-slate-200">{producto.nombre}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs de tipo de producto */}
          <div className="mb-6">
            <div className="bg-[#0d1523] border border-[#1e2a3b] p-1 rounded-lg inline-flex gap-1">
              <button
                onClick={() => setActiveTab('producto')}
                className={`inline-flex items-center px-4 py-2 rounded text-sm font-medium transition-colors ${
                  activeTab === 'producto' 
                    ? 'bg-[#0e88c9] text-white' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Package className="h-4 w-4 mr-2" />
                PRODUCTO
              </button>
              <button
                onClick={() => setActiveTab('insumo')}
                className={`inline-flex items-center px-4 py-2 rounded text-sm font-medium transition-colors ${
                  activeTab === 'insumo' 
                    ? 'bg-[#0e88c9] text-white' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Wrench className="h-4 w-4 mr-2" />
                INSUMO
              </button>
              <button
                onClick={() => setActiveTab('servicio')}
                className={`inline-flex items-center px-4 py-2 rounded text-sm font-medium transition-colors ${
                  activeTab === 'servicio' 
                    ? 'bg-[#0e88c9] text-white' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Briefcase className="h-4 w-4 mr-2" />
                SERVICIO
              </button>
              <button
                onClick={() => setActiveTab('herramienta')}
                className={`inline-flex items-center px-4 py-2 rounded text-sm font-medium transition-colors ${
                  activeTab === 'herramienta' 
                    ? 'bg-[#0e88c9] text-white' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Settings className="h-4 w-4 mr-2" />
                HERRAMIENTA
              </button>
            </div>
          </div>

          {/* Layout de 2 columnas */}
          <div className="grid grid-cols-12 gap-6">
            {/* Columna izquierda - Galería e información */}
            <div className="col-span-5 space-y-6">
              {/* Galería de imágenes */}
              <div className="bg-[#0d1523] border border-[#1e2a3b] rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
                    Modo Inventario
                  </h3>
                  <Badge variant="outline" className="bg-[#0e88c9]/10 text-[#0e88c9] border-[#0e88c9]/30">
                    PRINCIPAL
                  </Badge>
                </div>
                
                <div className="relative aspect-square bg-[#141e2e] rounded-lg overflow-hidden mb-4">
                  {getAllImages()[currentImageIndex] ? (
                    <Image
                      src={getAllImages()[currentImageIndex]}
                      alt={producto.nombre}
                      fill
                      className="object-contain"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <Package className="h-24 w-24 text-slate-600" />
                    </div>
                  )}
                  
                  {/* Controles de navegación */}
                  {getAllImages().length > 1 && (
                    <>
                      <button
                        onClick={prevImage}
                        className="absolute left-4 top-1/2 -translate-y-1/2 bg-[#0e88c9] hover:bg-[#0e88c9]/90 text-white rounded-full p-2 transition-all hover:scale-110"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <button
                        onClick={nextImage}
                        className="absolute right-4 top-1/2 -translate-y-1/2 bg-[#0e88c9] hover:bg-[#0e88c9]/90 text-white rounded-full p-2 transition-all hover:scale-110"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </>
                  )}
                  
                  {/* Indicador de posición */}
                  {getAllImages().length > 1 && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 px-3 py-1 rounded-full">
                      <span className="text-xs text-white font-medium">
                        {currentImageIndex + 1} / {getAllImages().length}
                      </span>
                    </div>
                  )}
                </div>

                {/* Thumbnails */}
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {getAllImages().map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentImageIndex(idx)}
                      className={`relative flex-shrink-0 w-20 h-20 bg-[#141e2e] rounded border-2 transition-all ${
                        currentImageIndex === idx ? 'border-[#0e88c9] scale-105' : 'border-[#1e2a3b] hover:border-[#0e88c9]/50'
                      }`}
                    >
                      {img ? (
                        <Image src={img} alt="" fill className="object-contain" />
                      ) : (
                        <Package className="h-8 w-8 text-slate-600 m-auto" />
                      )}
                    </button>
                  ))}
                </div>

                <div className="text-xs text-slate-500 mt-4 text-center">
                  ARGUETA REPUESTOS
                </div>
              </div>

              {/* Precios */}
              <div className="bg-[#0d1523] border border-[#1e2a3b] rounded-lg p-6">
                <h3 className="text-sm font-semibold text-[#ff6b35] uppercase tracking-wide mb-4">
                  Tipos de Precios
                </h3>
                <div className="space-y-3">
                  {precios.map((precio, idx) => (
                    <div key={idx} className="flex items-center justify-between py-2.5 px-3 bg-[#141e2e] border border-[#1e2a3b] rounded-lg hover:border-[#0e88c9]/50 transition-colors">
                      <span className="text-xs font-medium text-slate-400">
                        {precio.tipo}
                      </span>
                      <span className="text-base font-mono font-semibold text-[#0e88c9]">
                        ${precio.valor.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* OEM / Cruces */}
              <div className="bg-[#0d1523] border border-[#1e2a3b] rounded-lg p-6">
                <h3 className="text-sm font-semibold text-[#ff6b35] uppercase tracking-wide mb-4">
                  OEM / Cruces
                </h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {referencias.map((ref, idx) => (
                    <div key={idx} className="flex items-center justify-between py-2 border-b border-[#1e2a3b] last:border-0">
                      <span className="text-xs font-medium text-slate-400">{ref.fabricante}</span>
                      <span className="text-sm font-mono text-slate-200">{ref.codigo}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Columna derecha - Detalles del producto */}
            <div className="col-span-7 space-y-6">
              {/* Referencias */}
              <div className="bg-[#0d1523] border border-[#1e2a3b] rounded-lg p-6">
                <h3 className="text-sm font-semibold text-[#ff6b35] uppercase tracking-wide mb-4">
                  Referencias
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-500 uppercase block mb-2">REF. PROVEEDOR</label>
                    <Input
                      value={producto.idprodprov || ''}
                      readOnly
                      className="bg-[#141e2e] border-[#1e2a3b] text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 uppercase block mb-2">REF. FABRICANTE</label>
                    <Input
                      value={producto.idprodpaquete || ''}
                      readOnly
                      className="bg-[#141e2e] border-[#1e2a3b] text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 uppercase block mb-2">REF. PRODUCTO</label>
                    <Input
                      value={producto.idprod.toString()}
                      readOnly
                      className="bg-[#141e2e] border-[#1e2a3b] text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 uppercase block mb-2">OEM</label>
                    <Input
                      value={producto.OE || ''}
                      readOnly
                      className="bg-[#141e2e] border-[#1e2a3b] text-slate-200"
                    />
                  </div>
                </div>
              </div>

              {/* Información del producto */}
              <div className="bg-[#0d1523] border border-[#1e2a3b] rounded-lg p-6">
                <h3 className="text-sm font-semibold text-[#ff6b35] uppercase tracking-wide mb-4">
                  Información
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-slate-500 uppercase block mb-2">NOMBRE</label>
                    <Input
                      value={producto.nombre}
                      readOnly
                      className="bg-[#141e2e] border-[#1e2a3b] text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 uppercase block mb-2">ALIAS</label>
                    <Input
                      value={producto.descripcion || ''}
                      readOnly
                      className="bg-[#141e2e] border-[#1e2a3b] text-slate-200"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-slate-500 uppercase block mb-2">Grupo</label>
                      <Input
                        value={producto.idcategoria || ''}
                        readOnly
                        className="bg-[#141e2e] border-[#1e2a3b] text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 uppercase block mb-2">Sub-Grupo</label>
                      <Input
                        value={producto.categoria_nombre || ''}
                        readOnly
                        className="bg-[#141e2e] border-[#1e2a3b] text-slate-200"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs text-slate-500 uppercase block mb-2">Marca</label>
                      <Input
                        value={producto.marca || ''}
                        readOnly
                        className="bg-[#141e2e] border-[#1e2a3b] text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 uppercase block mb-2">Modelo</label>
                      <Input
                        value={producto.modelo || ''}
                        readOnly
                        className="bg-[#141e2e] border-[#1e2a3b] text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 uppercase block mb-2">Serie</label>
                      <Input
                        value=""
                        readOnly
                        className="bg-[#141e2e] border-[#1e2a3b] text-slate-200"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-slate-500 uppercase block mb-2">Tipo</label>
                      <Input
                        value=""
                        readOnly
                        className="bg-[#141e2e] border-[#1e2a3b] text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 uppercase block mb-2">Clase</label>
                      <Input
                        value=""
                        readOnly
                        className="bg-[#141e2e] border-[#1e2a3b] text-slate-200"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-slate-500 uppercase block mb-2">Peso</label>
                      <div className="flex gap-2">
                        <Input
                          value={producto.peso || ''}
                          readOnly
                          className="bg-[#141e2e] border-[#1e2a3b] text-slate-200"
                        />
                        <Badge variant="outline" className="bg-[#0e88c9]/10 text-[#0e88c9] border-[#0e88c9]/30">
                          Lb
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Aplicación */}
              <div className="bg-[#0d1523] border border-[#1e2a3b] rounded-lg p-6">
                <h3 className="text-sm font-semibold text-[#ff6b35] uppercase tracking-wide mb-4">
                  Aplicación
                </h3>
                <div>
                  <label className="text-xs text-slate-500 uppercase block mb-2">Marca / Modelo</label>
                  <Input
                    value={producto.aplicacion_marcas || 'No especificado'}
                    readOnly
                    className="bg-[#141e2e] border-[#1e2a3b] text-slate-200 mb-3"
                  />
                  <Input
                    value={producto.aplicacion_modelos || 'No especificado'}
                    readOnly
                    className="bg-[#141e2e] border-[#1e2a3b] text-slate-200"
                  />
                </div>
              </div>

              {/* Aplicación / Detalles */}
              <div className="bg-[#0d1523] border border-[#1e2a3b] rounded-lg p-6">
                <h3 className="text-sm font-semibold text-[#ff6b35] uppercase tracking-wide mb-4">
                  Aplicación / Detalles
                </h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {aplicaciones.map((app, idx) => (
                    <p key={idx} className="text-sm text-slate-400 leading-relaxed">
                      {app}
                    </p>
                  ))}
                </div>
              </div>

              {/* Ubicaciones */}
              <div className="bg-[#0d1523] border border-[#1e2a3b] rounded-lg p-6">
                <h3 className="text-sm font-semibold text-[#ff6b35] uppercase tracking-wide mb-4">
                  Ubicaciones
                </h3>
                <div className="flex items-center gap-4">
                  {ubicaciones.map((ub, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="bg-[#141e2e] border border-[#1e2a3b] rounded px-4 py-2">
                        <span className="text-sm font-mono text-slate-200">{ub.codigo}</span>
                      </div>
                      <div className="bg-[#141e2e] border border-[#1e2a3b] rounded px-4 py-2">
                        <span className="text-sm font-mono text-slate-200">{ub.codigo}</span>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center gap-4 ml-auto">
                    <div>
                      <span className="text-xs text-slate-500 uppercase block mb-1">STOCK CONTABLE</span>
                      <div className="bg-[#0e88c9]/10 border border-[#0e88c9]/30 rounded px-4 py-2">
                        <span className="text-lg font-bold text-[#0e88c9]">{producto.stock_contable}</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 uppercase block mb-1">STOCK FÍSICO</span>
                      <div className="bg-green-500/10 border border-green-500/30 rounded px-4 py-2">
                        <span className="text-lg font-bold text-green-500">{producto.stock_fisico}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function PerfilProductoPage() {
  return (
    <Suspense fallback={
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-screen bg-[#0a0f1a]">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-[#0e88c9] mb-4"></div>
          <div className="text-lg text-slate-200">Cargando...</div>
        </div>
      </DashboardLayout>
    }>
      <PerfilProductoPageContent />
    </Suspense>
  );
}
