'use client';

import { useState, useEffect, Suspense, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Search, ChevronLeft, ChevronRight, 
  Package, Wrench, Briefcase, Settings, Edit, Save, X, Plus, Trash2, ExternalLink, Layers, Eye
} from 'lucide-react';
import Image from 'next/image';
import { NotificationDropdown } from '@/components/notification-dropdown';
import { UserDropdown } from '@/components/user-dropdown';
import { useFloatingWindows } from '@/contexts/floating-windows-context';
import { getCodigoCatalogo } from '@/lib/format-utils';
import { SearchFilters, filterProductos, SearchFilterType } from '@/components/search-filters';

interface Producto {
  idprod: number;
  nombre: string;
  codigo_barras: string;
  idprodprov: string;
  idprodpaquete: string;
  idprodfisico?: string;
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
  // Campos adicionales
  grupo_nombre?: string;
  subgrupo_nombre?: string;
  aplicacion_marcas?: string;
  costo: string;
  codigo_jerarquico?: string | number;
}

interface Precio {
  tipo: string;
  valor: number;
  editable: boolean;
}

// Interface para pestañas de productos
interface ProductTab {
  id: number;
  nombre: string;
  producto: Producto;
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
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilter, setSearchFilter] = useState<SearchFilterType>('todos');
  const [searchResults, setSearchResults] = useState<Producto[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  
  // Sistema de pestañas dinámicas
  const [openTabs, setOpenTabs] = useState<ProductTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<number | null>(null);
  
  // Lista de todos los productos para el panel izquierdo
  const [allProductos, setAllProductos] = useState<Producto[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  
  // Ventanas flotantes - usando contexto global
  const { openFloatingWindow: openGlobalFloatingWindow } = useFloatingWindows();

  // Precios múltiples
  const [precios, setPrecios] = useState<Precio[]>([]);

  // Sistema de categorías jerárquico
  const [categoriasNuevas, setCategoriasNuevas] = useState<{idcategoria: number, nombre: string}[]>([]);
  const [gruposDB, setGruposDB] = useState<{id_grupo: number, codigo: string, nombre: string, idcategoria: number}[]>([]);
  const [subgruposDB, setSubgruposDB] = useState<{id_subgrupo: number, codigo: string, nombre: string, id_grupo: number}[]>([]);

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
    fetchAllProductos();
    fetchCategoriasJerarquia();
  }, []);

  // Cargar categorías jerárquicas
  const fetchCategoriasJerarquia = async () => {
    try {
      const response = await fetch('/api/categorias-jerarquia');
      if (response.ok) {
        const data = await response.json();
        setCategoriasNuevas(data.categorias || []);
        setGruposDB(data.grupos || []);
        setSubgruposDB(data.subgrupos || []);
      }
    } catch (error) {
      console.error('Error al cargar categorías:', error);
    }
  };

  // Obtener nombre de categoría por ID
  const getCategoriaNombre = (idcategoria_nuevo: number | null) => {
    if (!idcategoria_nuevo) return null;
    const cat = categoriasNuevas.find(c => c.idcategoria === idcategoria_nuevo);
    return cat ? `${cat.idcategoria} - ${cat.nombre}` : null;
  };

  // Obtener nombre de grupo por ID
  const getGrupoNombre = (id_grupo: number | null) => {
    if (!id_grupo) return null;
    const grupo = gruposDB.find(g => g.id_grupo === id_grupo);
    return grupo ? `${grupo.codigo} - ${grupo.nombre}` : null;
  };

  // Obtener nombre de subgrupo por ID
  const getSubgrupoNombre = (id_subgrupo: number | null) => {
    if (!id_subgrupo) return null;
    const subgrupo = subgruposDB.find(s => s.id_subgrupo === id_subgrupo);
    return subgrupo ? `${subgrupo.codigo} - ${subgrupo.nombre}` : null;
  };

  useEffect(() => {
    if (idParam && allProductos.length > 0) {
      const found = allProductos.find(p => p.idprod === Number(idParam));
      if (found) {
        setProducto(found);
        setOpenTabs(prev => {
          const existingTab = prev.find(tab => tab.id === found.idprod);
          if (existingTab) return prev;
          return [...prev, { id: found.idprod, nombre: found.nombre, producto: found }];
        });
        setActiveTabId(found.idprod);
        loadPrecios(found);
      }
      setLoading(false);
    } else if (!idParam) {
      setLoading(false);
    }
  }, [idParam, allProductos]);

  // Filtrar productos según búsqueda usando filtros unificados
  const productosFiltrados = filterProductos(allProductos, searchQuery, searchFilter);

  // Producto seleccionado en la lista (para preview)
  const productoPreview = productosFiltrados[selectedIndex] || null;

  // Función para seleccionar producto (definida antes del useCallback que la usa)
  const handleSelectProduct = useCallback((productId: number) => {
    const found = allProductos.find(p => p.idprod === productId);
    if (found) {
      setOpenTabs(prev => {
        const existingTab = prev.find(tab => tab.id === found.idprod);
        if (existingTab) return prev;
        return [...prev, { id: found.idprod, nombre: found.nombre, producto: found }];
      });
      setActiveTabId(productId);
      setProducto(found);
      setCurrentImageIndex(0);
      
      const preciosFromDB: Precio[] = [
        { tipo: 'GENERAL', valor: parseFloat((found as any).precio1 || '0'), editable: false },
        { tipo: 'MAYORISTA', valor: parseFloat((found as any).precio2 || '0'), editable: false },
        { tipo: 'CLIENTE', valor: parseFloat((found as any).precio3 || '0'), editable: false },
        { tipo: 'MECÁNICO', valor: parseFloat((found as any).precio4 || '0'), editable: false },
        { tipo: 'MINORISTA', valor: parseFloat((found as any).precio5 || '0'), editable: false },
        { tipo: 'INVERSOR', valor: parseFloat((found as any).precio6 || '0'), editable: false },
        { tipo: 'ESPECIAL', valor: parseFloat((found as any).precio7 || '0'), editable: false },
      ];
      setPrecios(preciosFromDB);
    }
  }, [allProductos]);

  // Manejo de teclado para navegación - DEBE estar antes de cualquier return condicional
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (loading) return; // No hacer nada si está cargando
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, productosFiltrados.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && productoPreview) {
      e.preventDefault();
      handleSelectProduct(productoPreview.idprod);
    }
  }, [productosFiltrados.length, productoPreview, loading, handleSelectProduct]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Auto-scroll al elemento seleccionado
  useEffect(() => {
    if (listRef.current && !loading) {
      const selectedEl = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex, loading]);

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

  const loadPrecios = (prod: any) => {
    const preciosFromDB: Precio[] = [
      { tipo: 'GENERAL', valor: parseFloat(prod.precio1 || '0'), editable: false },
      { tipo: 'MAYORISTA', valor: parseFloat(prod.precio2 || '0'), editable: false },
      { tipo: 'CLIENTE', valor: parseFloat(prod.precio3 || '0'), editable: false },
      { tipo: 'MECÁNICO', valor: parseFloat(prod.precio4 || '0'), editable: false },
      { tipo: 'MINORISTA', valor: parseFloat(prod.precio5 || '0'), editable: false },
      { tipo: 'INVERSOR', valor: parseFloat(prod.precio6 || '0'), editable: false },
      { tipo: 'ESPECIAL', valor: parseFloat(prod.precio7 || '0'), editable: false },
    ];
    setPrecios(preciosFromDB);
  };

  // Función para abrir ventana flotante usando el contexto global
  const openFloatingWindow = (prod: Producto) => {
    openGlobalFloatingWindow(prod as any);
  };

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
          
          // Agregar automáticamente como pestaña si viene de URL
          setOpenTabs(prev => {
            const existingTab = prev.find(tab => tab.id === found.idprod);
            if (existingTab) {
              return prev; // Ya existe, no agregar duplicado
            }
            const newTab: ProductTab = {
              id: found.idprod,
              nombre: found.nombre,
              producto: found
            };
            return [...prev, newTab];
          });
          setActiveTabId(found.idprod);
          
          // Cargar los 7 tipos de precios desde la base de datos
          const preciosFromDB: Precio[] = [
            { tipo: 'GENERAL', valor: parseFloat(found.precio1 || '0'), editable: false },
            { tipo: 'MAYORISTA', valor: parseFloat(found.precio2 || '0'), editable: false },
            { tipo: 'CLIENTE', valor: parseFloat(found.precio3 || '0'), editable: false },
            { tipo: 'MECÁNICO', valor: parseFloat(found.precio4 || '0'), editable: false },
            { tipo: 'MINORISTA', valor: parseFloat(found.precio5 || '0'), editable: false },
            { tipo: 'INVERSOR', valor: parseFloat(found.precio6 || '0'), editable: false },
            { tipo: 'ESPECIAL', valor: parseFloat(found.precio7 || '0'), editable: false },
          ];
          setPrecios(preciosFromDB);
          
          // Cargar aplicaciones/detalles
          const apps: string[] = [];
          if (found.info_publica) apps.push(found.info_publica);
          if (found.info_referencias_directas) apps.push(found.info_referencias_directas);
          if (found.aplicacion_marcas) apps.push(found.aplicacion_marcas);
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

  // Función para agregar producto como nueva pestaña
  const addProductTab = async (productId: number) => {
    // Buscar el producto en los resultados o cargar
    try {
      const response = await fetch('/api/productos');
      if (response.ok) {
        const data = await response.json();
        const found = data.products?.find((p: Producto) => p.idprod === productId);
        if (found) {
          // Agregar pestaña verificando duplicados con el estado más reciente
          setOpenTabs(prev => {
            const existingTab = prev.find(tab => tab.id === found.idprod);
            if (existingTab) {
              return prev; // Ya existe, no agregar duplicado
            }
            const newTab: ProductTab = {
              id: found.idprod,
              nombre: found.nombre,
              producto: found
            };
            return [...prev, newTab];
          });
          setActiveTabId(productId);
          setProducto(found);
          setCurrentImageIndex(0);
          
          // Cargar precios (usando los nombres que vienen de la API)
          const preciosFromDB: Precio[] = [
            { tipo: 'GENERAL', valor: parseFloat(found.precio1 || '0'), editable: false },
            { tipo: 'MAYORISTA', valor: parseFloat(found.precio2 || '0'), editable: false },
            { tipo: 'CLIENTE', valor: parseFloat(found.precio3 || '0'), editable: false },
            { tipo: 'MECÁNICO', valor: parseFloat(found.precio4 || '0'), editable: false },
            { tipo: 'MINORISTA', valor: parseFloat(found.precio5 || '0'), editable: false },
            { tipo: 'INVERSOR', valor: parseFloat(found.precio6 || '0'), editable: false },
            { tipo: 'ESPECIAL', valor: parseFloat(found.precio7 || '0'), editable: false },
          ];
          setPrecios(preciosFromDB);
        }
      }
    } catch (error) {
      console.error('Error al cargar producto:', error);
    }
    
    setShowSearchResults(false);
    setSearchQuery('');
  };

  // Función para cerrar una pestaña
  const closeTab = (tabId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenTabs(prev => {
      const newTabs = prev.filter(tab => tab.id !== tabId);
      // Si cerramos la pestaña activa, activar otra
      if (activeTabId === tabId && newTabs.length > 0) {
        const lastTab = newTabs[newTabs.length - 1];
        setActiveTabId(lastTab.id);
        setProducto(lastTab.producto);
        setCurrentImageIndex(0);
      } else if (newTabs.length === 0) {
        setActiveTabId(null);
        setProducto(null);
      }
      return newTabs;
    });
  };

  // Función para cambiar de pestaña
  const switchTab = (tab: ProductTab) => {
    setActiveTabId(tab.id);
    setProducto(tab.producto);
    setCurrentImageIndex(0);
    
    // Cargar precios del producto (usando los nombres que vienen de la API)
    const p = tab.producto as any;
    const preciosFromDB: Precio[] = [
      { tipo: 'GENERAL', valor: parseFloat(p.precio1 || '0'), editable: false },
      { tipo: 'MAYORISTA', valor: parseFloat(p.precio2 || '0'), editable: false },
      { tipo: 'CLIENTE', valor: parseFloat(p.precio3 || '0'), editable: false },
      { tipo: 'MECÁNICO', valor: parseFloat(p.precio4 || '0'), editable: false },
      { tipo: 'MINORISTA', valor: parseFloat(p.precio5 || '0'), editable: false },
      { tipo: 'INVERSOR', valor: parseFloat(p.precio6 || '0'), editable: false },
      { tipo: 'ESPECIAL', valor: parseFloat(p.precio7 || '0'), editable: false },
    ];
    setPrecios(preciosFromDB);
  };

  const selectProduct = (productId: number) => {
    handleSelectProduct(productId);
  };

  const getAllImages = () => {
    if (!producto) return [];
    const images: string[] = [];
    
    // Primero agregar imagen_principal si existe
    if (producto.imagen_principal) {
      images.push(producto.imagen_principal);
    }
    
    // Luego agregar el array de imagenes
    if (producto.imagenes && producto.imagenes.length > 0) {
      images.push(...producto.imagenes);
    }
    
    // Eliminar duplicados usando Set
    const uniqueImages = Array.from(new Set(images));
    
    return uniqueImages.slice(0, 10); // Máximo 10 imágenes
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

  // Vista principal
  return (
    <DashboardLayout>
      <div className="min-h-screen bg-[#0a0f1a] p-4">
        {/* Navbar superior */}
        <div className="rounded-xl border border-[#0e88c9]/30 bg-[#0d1523] px-5 py-3 flex items-center justify-between gap-4 shadow-[0_0_25px_rgba(15,23,42,0.9)] mb-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Inventario</span>
            <span className="h-6 w-px bg-slate-700" />
            <span className="text-sm tracking-[0.18em] uppercase text-slate-200">Perfil del Producto</span>
          </div>
          <div className="flex items-center gap-3">
            <NotificationDropdown />
            <UserDropdown />
          </div>
        </div>

        {/* Layout principal de 2 columnas */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Columna Izquierda: Lista de productos con buscador */}
          <div className="lg:col-span-4 space-y-3">
            <Card className="bg-[#141e2e] border border-[#0e88c9]/30 rounded-xl overflow-hidden">
              <CardHeader className="py-2 px-3 border-b border-slate-800">
                <SearchFilters
                  searchTerm={searchQuery}
                  onSearchChange={setSearchQuery}
                  searchFilter={searchFilter}
                  onFilterChange={setSearchFilter}
                  compact={true}
                />
              </CardHeader>
              <div ref={listRef} className="h-[calc(100vh-280px)] overflow-y-auto divide-y divide-slate-800/50">
                {productosFiltrados.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500 p-4">
                    <Package className="h-8 w-8 mb-2" />
                    <p className="text-sm">No hay productos</p>
                  </div>
                ) : (
                  productosFiltrados.map((prod, idx) => (
                    <div
                      key={prod.idprod}
                      onClick={() => setSelectedIndex(idx)}
                      onDoubleClick={() => selectProduct(prod.idprod)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${
                        idx === selectedIndex ? 'bg-[#0e88c9]/20 border-l-2 border-[#0e88c9]' : 'hover:bg-slate-800/50'
                      } ${producto?.idprod === prod.idprod ? 'bg-emerald-500/10 border-l-2 border-emerald-500' : ''}`}
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
                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-[#0e88c9]/10 text-[#0e88c9] border-[#0e88c9]/30">
                            {(prod as any).categoria_nueva_nombre || prod.categoria_nombre || '-'}
                          </Badge>
                          <span className={`text-[10px] font-medium ${prod.stock_contable > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            Stock: {prod.stock_contable}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            {/* Info del producto seleccionado (preview) */}
            {productoPreview && (
              <Card className="bg-[#141e2e] border border-[#0e88c9]/30 rounded-xl">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Producto Seleccionado</span>
                    <div className="flex gap-1">
                      {/* Botón para abrir en pestaña */}
                      <Button 
                        size="sm" 
                        onClick={() => selectProduct(productoPreview.idprod)}
                        className="h-7 text-xs bg-[#0e88c9]/10 text-[#0e88c9] border border-[#0e88c9]/40 hover:bg-[#0e88c9]/20"
                        title="Abrir en pestaña"
                      >
                        <Layers className="h-3 w-3 mr-1" />
                        Pestaña
                      </Button>
                      {/* Botón para abrir en ventana flotante - usa producto seleccionado si existe, sino el preview */}
                      <Button 
                        size="sm" 
                        onClick={() => openFloatingWindow(producto || productoPreview)}
                        className="h-7 text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/20"
                        title="Abrir en ventana flotante"
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Flotante
                      </Button>
                    </div>
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
                  <p className="text-xs text-slate-500 italic">Doble click en lista para ver perfil completo</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Columna Derecha: Información del producto */}
          <div className="lg:col-span-8">
            {/* Pestañas dinámicas */}
            {openTabs.length > 0 && (
              <div className="mb-3">
                <div className="bg-[#0d1523] border border-[#1e2a3b] p-1 rounded-lg flex gap-1 flex-wrap">
                  {openTabs.map((tab) => (
                    <div
                      key={`tab-${tab.id}`}
                      className={`inline-flex items-center px-3 py-1.5 rounded text-sm font-medium transition-colors cursor-pointer ${
                        activeTabId === tab.id 
                          ? 'bg-[#0e88c9] text-white' 
                          : 'text-slate-400 hover:text-slate-200 hover:bg-[#1e2a3b]'
                      }`}
                      onClick={() => switchTab(tab)}
                    >
                      <Package className="h-3 w-3 mr-1.5" />
                      <span className="max-w-[120px] truncate text-xs">{tab.nombre}</span>
                      <button
                        onClick={(e) => closeTab(tab.id, e)}
                        className="ml-2 p-0.5 rounded hover:bg-red-500/20"
                        title="Cerrar pestaña"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Contenido del producto - Diseño como imagen de referencia */}
            {producto ? (
              <div className="bg-[#0d1523] border border-[#1e2a3b] rounded-lg overflow-hidden">
                {/* Header con nombre y botón editar */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-[#1e2a3b]">
                  <div>
                    <div className="text-xl font-bold text-slate-200">{producto.nombre}</div>
                    <div className="text-sm text-slate-500">{producto.descripcion || ''}</div>
                  </div>
                  <Button
                    onClick={() => router.push(`/dashboard/inventario/editar-producto?id=${producto.idprod}`)}
                    className="bg-[#0e88c9] hover:bg-[#0e88c9]/80 text-white"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Editar Producto
                  </Button>
                </div>

                {/* Contenido principal: Imagen + Info */}
                <div className="grid grid-cols-12">
                  {/* Imagen grande a la izquierda */}
                  <div className="col-span-5 p-4 border-r border-[#1e2a3b]">
                    <div className="relative aspect-square bg-slate-900/50 rounded-lg overflow-hidden">
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
                      {getAllImages().length > 1 && (
                        <>
                          <button onClick={prevImage} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full">
                            <ChevronLeft className="h-5 w-5" />
                          </button>
                          <button onClick={nextImage} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full">
                            <ChevronRight className="h-5 w-5" />
                          </button>
                        </>
                      )}
                    </div>
                    {getAllImages().length > 1 && (
                      <div className="flex gap-2 justify-center mt-3">
                        {getAllImages().map((img, idx) => (
                          <button
                            key={`img-${idx}`}
                            onClick={() => setCurrentImageIndex(idx)}
                            className={`w-12 h-12 rounded overflow-hidden border-2 ${idx === currentImageIndex ? 'border-[#0e88c9]' : 'border-slate-700'}`}
                          >
                            <Image src={img} alt="" width={48} height={48} className="object-cover w-full h-full" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Info apilada a la derecha */}
                  <div className="col-span-7">
                    {/* ID Producto y Stock */}
                    <div className="grid grid-cols-2 border-b border-[#1e2a3b]">
                      <div className="p-4 border-r border-[#1e2a3b]">
                        <div className="text-xs text-slate-500 uppercase">ID Producto</div>
                        <div className="text-2xl font-bold text-slate-200">{producto.idprod}</div>
                      </div>
                      <div className="p-4">
                        <div className="text-xs text-slate-500 uppercase">Stock</div>
                        <div className={`text-2xl font-bold ${producto.stock_contable > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {producto.stock_contable}
                        </div>
                      </div>
                    </div>

                    {/* Código Catálogo */}
                    <div className="p-4 border-b border-[#1e2a3b]">
                      <div className="text-xs text-slate-500 uppercase">Código Catálogo</div>
                      <div className="text-lg font-semibold text-amber-400">{getCodigoCatalogo(producto)}</div>
                    </div>

                    {/* Referencia OE */}
                    <div className="p-4 border-b border-[#1e2a3b]">
                      <div className="text-xs text-slate-500 uppercase">Referencia OE</div>
                      <div className="text-lg font-semibold text-slate-200">{producto.OE || '-'}</div>
                    </div>

                    {/* Marca */}
                    <div className="p-4 border-b border-[#1e2a3b]">
                      <div className="text-xs text-slate-500 uppercase">Marca</div>
                      <div className="text-lg font-semibold text-slate-200">{producto.marca || '-'}</div>
                    </div>

                    {/* Categoría - Usando el nuevo sistema jerárquico */}
                    <div className="p-4 border-b border-[#1e2a3b]">
                      <div className="text-xs text-slate-500 uppercase">Categoría</div>
                      <Badge variant="outline" className="mt-1 bg-[#0e88c9]/10 text-[#0e88c9] border-[#0e88c9]/30">
                        {(producto as any).categoria_nueva_nombre 
                          ? `${(producto as any).idcategoria_nuevo} - ${(producto as any).categoria_nueva_nombre}` 
                          : producto.categoria_nombre || '-'}
                      </Badge>
                    </div>

                    {/* Grupo y Subgrupo */}
                    <div className="grid grid-cols-2 border-b border-[#1e2a3b]">
                      <div className="p-4 border-r border-[#1e2a3b]">
                        <div className="text-xs text-slate-500 uppercase">Grupo</div>
                        <Badge variant="outline" className="mt-1 bg-green-500/10 text-green-400 border-green-500/30">
                          {(producto as any).grupo_nombre 
                            ? `${(producto as any).grupo_codigo} - ${(producto as any).grupo_nombre}` 
                            : '-'}
                        </Badge>
                      </div>
                      <div className="p-4">
                        <div className="text-xs text-slate-500 uppercase">Subgrupo</div>
                        <Badge variant="outline" className="mt-1 bg-purple-500/10 text-purple-400 border-purple-500/30">
                          {(producto as any).subgrupo_nombre 
                            ? `${(producto as any).subgrupo_codigo} - ${(producto as any).subgrupo_nombre}` 
                            : '-'}
                        </Badge>
                      </div>
                    </div>

                    {/* Costo */}
                    <div className="p-4">
                      <div className="text-xs text-slate-500 uppercase">Costo</div>
                      <div className="text-2xl font-bold text-emerald-400">${producto.costo || '0.00'}</div>
                    </div>
                  </div>
                </div>

                {/* Fila inferior: Códigos */}
                <div className="grid grid-cols-3 border-t border-[#1e2a3b]">
                  <div className="p-4 border-r border-[#1e2a3b]">
                    <div className="text-xs text-slate-500">Cód. Proveedor</div>
                    <div className="text-sm font-medium text-slate-200">{producto.idprodprov || '-'}</div>
                  </div>
                  <div className="p-4 border-r border-[#1e2a3b]">
                    <div className="text-xs text-slate-500">Cód. Paquete</div>
                    <div className="text-sm font-medium text-slate-200">{producto.idprodpaquete || '-'}</div>
                  </div>
                  <div className="p-4">
                    <div className="text-xs text-slate-500">Código Barras</div>
                    <div className="text-sm font-medium text-slate-200">{producto.codigo_barras || '-'}</div>
                  </div>
                </div>

                {/* Precios de Venta */}
                <div className="border-t border-[#1e2a3b] p-4">
                  <div className="text-xs text-slate-500 uppercase mb-3">Precios de Venta</div>
                  <div className="grid grid-cols-4 gap-4">
                    {precios.map((precio, idx) => (
                      <div key={`precio-${idx}`}>
                        <div className="text-xs text-slate-500">{precio.tipo}</div>
                        <div className="text-lg font-bold text-[#0e88c9]">${precio.valor.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Información Adicional */}
                <div className="border-t border-[#1e2a3b] p-4">
                  <div className="text-xs text-slate-500 uppercase mb-3">Información Adicional</div>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <div className="text-xs text-slate-500">Clase</div>
                      <div className="text-sm font-medium text-slate-200">{producto.clase || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Lado</div>
                      <div className="text-sm font-medium text-slate-200">{producto.lado || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Modelo</div>
                      <div className="text-sm font-medium text-slate-200">{producto.modelo || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Estilo</div>
                      <div className="text-sm font-medium text-slate-200">{producto.estilo || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Giro</div>
                      <div className="text-sm font-medium text-slate-200">{producto.giro || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Peso</div>
                      <div className="text-sm font-medium text-slate-200">{producto.peso || '-'} {producto.unimedida || ''}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Exento IVA</div>
                      <div className={`text-sm font-medium ${producto.exento ? 'text-yellow-400' : 'text-slate-400'}`}>{producto.exento ? 'Sí' : 'No'}</div>
                    </div>
                  </div>
                  {producto.etiquetas && (
                    <div className="mt-3">
                      <div className="text-xs text-slate-500">Etiquetas</div>
                      <div className="text-sm font-medium text-slate-200">{producto.etiquetas}</div>
                    </div>
                  )}
                </div>
              </div>
            ) : productoPreview ? (
              /* Preview del producto seleccionado con hover/flechas */
              <div className="bg-[#0d1523] border border-[#1e2a3b] rounded-lg overflow-hidden">
                {/* Header con nombre y botón editar */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-[#1e2a3b]">
                  <div>
                    <div className="text-xl font-bold text-slate-200">{productoPreview.nombre}</div>
                    <div className="text-sm text-slate-500">{productoPreview.descripcion || ''}</div>
                  </div>
                  <Button
                    onClick={() => router.push(`/dashboard/inventario/editar-producto?id=${productoPreview.idprod}`)}
                    className="bg-[#0e88c9] hover:bg-[#0e88c9]/80 text-white"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Editar Producto
                  </Button>
                </div>

                {/* Contenido principal: Imagen + Info */}
                <div className="grid grid-cols-12">
                  {/* Imagen grande a la izquierda */}
                  <div className="col-span-5 p-4 border-r border-[#1e2a3b]">
                    <div className="relative aspect-square bg-slate-900/50 rounded-lg overflow-hidden">
                      {productoPreview.imagen_principal ? (
                        <Image
                          src={productoPreview.imagen_principal}
                          alt={productoPreview.nombre}
                          fill
                          className="object-contain"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <Package className="h-24 w-24 text-slate-600" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Info apilada a la derecha */}
                  <div className="col-span-7">
                    {/* ID Producto y Stock */}
                    <div className="grid grid-cols-2 border-b border-[#1e2a3b]">
                      <div className="p-4 border-r border-[#1e2a3b]">
                        <div className="text-xs text-slate-500 uppercase">ID Producto</div>
                        <div className="text-2xl font-bold text-slate-200">{productoPreview.idprod}</div>
                      </div>
                      <div className="p-4">
                        <div className="text-xs text-slate-500 uppercase">Stock</div>
                        <div className={`text-2xl font-bold ${productoPreview.stock_contable > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {productoPreview.stock_contable}
                        </div>
                      </div>
                    </div>

                    {/* Referencia OE */}
                    <div className="p-4 border-b border-[#1e2a3b]">
                      <div className="text-xs text-slate-500 uppercase">Referencia OE</div>
                      <div className="text-lg font-semibold text-slate-200">{productoPreview.OE || '-'}</div>
                    </div>

                    {/* Marca */}
                    <div className="p-4 border-b border-[#1e2a3b]">
                      <div className="text-xs text-slate-500 uppercase">Marca</div>
                      <div className="text-lg font-semibold text-slate-200">{productoPreview.marca || '-'}</div>
                    </div>

                    {/* Categoría */}
                    <div className="p-4 border-b border-[#1e2a3b]">
                      <div className="text-xs text-slate-500 uppercase">Categoría</div>
                      <Badge className="mt-1 bg-[#0e88c9]/20 text-[#0e88c9] border-[#0e88c9]/40">
                        {productoPreview.categoria_nombre || productoPreview.idcategoria || '-'}
                      </Badge>
                    </div>

                    {/* Costo */}
                    <div className="p-4">
                      <div className="text-xs text-slate-500 uppercase">Costo</div>
                      <div className="text-2xl font-bold text-emerald-400">${productoPreview.costo || '0.00'}</div>
                    </div>
                  </div>
                </div>

                {/* Códigos */}
                <div className="grid grid-cols-3 border-t border-[#1e2a3b]">
                  <div className="p-3 border-r border-[#1e2a3b]">
                    <div className="text-xs text-slate-500">Cód. Proveedor</div>
                    <div className="text-sm font-medium text-slate-300">{productoPreview.idprodprov || '-'}</div>
                  </div>
                  <div className="p-3 border-r border-[#1e2a3b]">
                    <div className="text-xs text-slate-500">Cód. Paquete</div>
                    <div className="text-sm font-medium text-slate-300">{productoPreview.idprodpaquete || '-'}</div>
                  </div>
                  <div className="p-3">
                    <div className="text-xs text-slate-500">Código Barras</div>
                    <div className="text-sm font-medium text-slate-300">{productoPreview.codigo_barras || '-'}</div>
                  </div>
                </div>

                {/* Mensaje de ayuda */}
                <div className="px-4 py-2 bg-[#141e2e] border-t border-[#1e2a3b]">
                  <p className="text-xs text-slate-500 text-center">
                    Presiona <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-400">Enter</kbd> o haz doble click para ver el perfil completo
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[500px] bg-[#0d1523] border border-[#1e2a3b] rounded-lg">
                <Package className="h-20 w-20 text-slate-600 mb-4" />
                <h2 className="text-lg font-semibold text-slate-300 mb-2">Selecciona un producto de la lista</h2>
                <p className="text-sm text-slate-500 text-center px-4">Usa las flechas ↑↓ o pasa el mouse</p>
              </div>
            )}
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
