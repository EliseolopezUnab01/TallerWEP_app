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
  Search, ChevronLeft, ChevronRight, X, Package, Save, Trash2, ArrowLeft, Upload, Edit, Eye, Lock, Unlock, History, Calendar, User, AlertTriangle
} from 'lucide-react';
import Image from 'next/image';
import { NotificationDropdown } from '@/components/notification-dropdown';
import { UserDropdown } from '@/components/user-dropdown';
import { useNotifications } from '@/contexts/notification-context';
import { useFloatingWindows } from '@/contexts/floating-windows-context';
import { getCodigoCatalogo } from '@/lib/format-utils';
import { SearchFilters, filterProductos, SearchFilterType } from '@/components/search-filters';

interface Producto {
  idprod: number;
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
  codigo_jerarquico?: string | number;
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
  const { addNotification } = useNotifications();
  const { updateProductInWindows } = useFloatingWindows();

  const [allProductos, setAllProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [producto, setProducto] = useState<Producto | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilter, setSearchFilter] = useState<SearchFilterType>('todos');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [newImages, setNewImages] = useState<File[]>([]);
  const [imagesToDelete, setImagesToDelete] = useState<string[]>([]);
  // Si viene con idParam, iniciar en modo edición directamente
  const [isEditing, setIsEditing] = useState(!!idParam);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  
  // Estados para precios
  const [precios, setPrecios] = useState<Precios>({ precio1: 0, precio2: 0, precio3: 0, precio4: 0, precio5: 0, precio6: 0, precio7: 0 });
  const [preciosDesbloqueado, setPreciosDesbloqueado] = useState(false);
  const [justificacionPrecio, setJustificacionPrecio] = useState('');
  const [historialPrecios, setHistorialPrecios] = useState<HistorialAjuste[]>([]);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  const [savingPrecios, setSavingPrecios] = useState(false);

  // Estados para el sistema de categorías jerárquico
  const [categoriasNuevo, setCategoriasNuevo] = useState<{idcategoria: number, nombre: string}[]>([]);
  const [grupos, setGrupos] = useState<{id_grupo: number, codigo: string, nombre: string, idcategoria: number}[]>([]);
  const [subgrupos, setSubgrupos] = useState<{id_subgrupo: number, codigo: string, nombre: string, id_grupo: number}[]>([]);
  const [selectedCategoria, setSelectedCategoria] = useState<number | null>(null);
  const [selectedGrupo, setSelectedGrupo] = useState<number | null>(null);
  const [selectedSubgrupo, setSelectedSubgrupo] = useState<number | null>(null);

  // Categorías antiguas (para compatibilidad)
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
    fetchCategoriasJerarquia();
  }, []);

  // Cargar categorías jerárquicas
  const fetchCategoriasJerarquia = async () => {
    try {
      const response = await fetch('/api/categorias-jerarquia');
      if (response.ok) {
        const data = await response.json();
        setCategoriasNuevo(data.categorias || []);
        setGrupos(data.grupos || []);
        setSubgrupos(data.subgrupos || []);
      }
    } catch (error) {
      console.error('Error al cargar categorías:', error);
    }
  };

  // Filtrar grupos por categoría seleccionada (comparar como números)
  const gruposFiltrados = selectedCategoria 
    ? grupos.filter(g => Number(g.idcategoria) === Number(selectedCategoria))
    : [];

  // Filtrar subgrupos por grupo seleccionado (comparar como números)
  const subgruposFiltrados = selectedGrupo
    ? subgrupos.filter(s => Number(s.id_grupo) === Number(selectedGrupo))
    : [];

  // Generar código jerárquico
  const generarCodigoJerarquico = async (idcategoria: number, id_grupo: number | null, id_subgrupo: number | null) => {
    try {
      const response = await fetch('/api/categorias-jerarquia/generar-codigo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idcategoria, id_grupo, id_subgrupo })
      });
      if (response.ok) {
        const data = await response.json();
        console.log('📋 Código jerárquico generado:', data.codigo_jerarquico);
        if (producto) {
          updateProductField('codigo_jerarquico', data.codigo_jerarquico);
        }
        return data.codigo_jerarquico;
      }
    } catch (error) {
      console.error('Error generando código:', error);
    }
    return null;
  };

  // Manejar cambio de categoría
  const handleCategoriaChange = (idcategoria: number) => {
    setSelectedCategoria(idcategoria);
    setSelectedGrupo(null);
    setSelectedSubgrupo(null);
    if (producto) {
      updateProductField('idcategoria_nuevo', idcategoria);
      updateProductField('id_grupo', null);
      updateProductField('id_subgrupo', null);
      generarCodigoJerarquico(idcategoria, null, null);
    }
  };

  // Manejar cambio de grupo
  const handleGrupoChange = (id_grupo: number) => {
    setSelectedGrupo(id_grupo);
    setSelectedSubgrupo(null);
    if (producto && selectedCategoria) {
      updateProductField('id_grupo', id_grupo);
      updateProductField('id_subgrupo', null);
      generarCodigoJerarquico(selectedCategoria, id_grupo, null);
    }
  };

  // Manejar cambio de subgrupo
  const handleSubgrupoChange = (id_subgrupo: number) => {
    setSelectedSubgrupo(id_subgrupo);
    if (producto && selectedCategoria) {
      updateProductField('id_subgrupo', id_subgrupo);
      generarCodigoJerarquico(selectedCategoria, selectedGrupo, id_subgrupo);
    }
  };

  useEffect(() => {
    if (idParam && allProductos.length > 0) {
      const found = allProductos.find(p => p.idprod === Number(idParam)) as any;
      if (found) {
        setProducto(found);
        setIsEditing(true);
        const idx = productosFiltrados.findIndex(p => p.idprod === Number(idParam));
        if (idx >= 0) setSelectedIndex(idx);
        fetchPrecios(Number(idParam));
        fetchHistorialPrecios(Number(idParam));
        // Inicializar valores de categoría jerárquica (convertir a números)
        if (found.idcategoria_nuevo) setSelectedCategoria(Number(found.idcategoria_nuevo));
        if (found.id_grupo) setSelectedGrupo(Number(found.id_grupo));
        if (found.id_subgrupo) setSelectedSubgrupo(Number(found.id_subgrupo));
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

  // Filtrar productos usando filtros unificados
  const productosFiltrados = filterProductos(allProductos, searchQuery, searchFilter);

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
    const prod = allProductos.find(p => p.idprod === idprod) as any;
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
      // Inicializar valores de categoría jerárquica (convertir a números)
      if (prod.idcategoria_nuevo) setSelectedCategoria(Number(prod.idcategoria_nuevo));
      else setSelectedCategoria(null);
      if (prod.id_grupo) setSelectedGrupo(Number(prod.id_grupo));
      else setSelectedGrupo(null);
      if (prod.id_subgrupo) setSelectedSubgrupo(Number(prod.id_subgrupo));
      else setSelectedSubgrupo(null);
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
        const data = await response.json();
        
        // Actualizar el producto en las ventanas flotantes con los nuevos precios
        if (data.product) {
          updateProductInWindows({
            idprod: data.product.idprod,
            nombre: data.product.nombre,
            descripcion: data.product.descripcion,
            imagen_principal: data.product.imagen_principal,
            stock_contable: data.product.stock_contable,
            costo: data.product.costo,
            OE: data.product.OE,
            marca: data.product.marca,
            categoria_nombre: data.product.categoria_nombre,
            idcategoria: data.product.idcategoria,
            idprodprov: data.product.idprodprov,
            idprodpaquete: data.product.idprodpaquete,
            codigo_barras: data.product.codigo_barras,
            precio1: data.product.precio1,
            precio2: data.product.precio2,
            precio3: data.product.precio3,
            precio4: data.product.precio4,
            precio5: data.product.precio5,
            precio6: data.product.precio6,
            precio7: data.product.precio7,
          });
        }
        
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

  const updateProductField = (field: keyof Producto | string, value: any) => {
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

  const handleSubmitClick = (e: React.FormEvent) => {
    e.preventDefault();
    if (!producto) return;
    setShowConfirmDialog(true);
  };

  const handleConfirmSave = async () => {
    if (!producto) return;
    setShowConfirmDialog(false);
    setSaving(true);

    try {
      const formData = new FormData();
      Object.entries(producto).forEach(([key, value]) => {
        if (key !== 'imagenes' && key !== 'imagen_principal' && value !== null && value !== undefined) {
          formData.append(key, String(value));
        }
      });
      
      // Agregar explícitamente los campos del sistema jerárquico (incluyendo valores vacíos para limpiar)
      if (selectedCategoria) {
        formData.set('idcategoria_nuevo', String(selectedCategoria));
      }
      // Siempre enviar id_grupo e id_subgrupo, incluso si son null (para limpiarlos)
      formData.set('id_grupo', selectedGrupo ? String(selectedGrupo) : '');
      formData.set('id_subgrupo', selectedSubgrupo ? String(selectedSubgrupo) : '');
      
      console.log('📤 Enviando datos jerárquicos:', {
        idcategoria_nuevo: selectedCategoria,
        id_grupo: selectedGrupo,
        id_subgrupo: selectedSubgrupo
      });
      
      imagesToDelete.forEach(img => formData.append('imagesToDelete', img));
      newImages.forEach(file => formData.append('newImages', file));

      const response = await fetch(`/api/productos/${producto.idprod}`, {
        method: 'PUT',
        body: formData,
      });

      if (response.ok) {
        const updatedData = await response.json();
        
        // Actualizar el producto en las ventanas flotantes abiertas
        if (updatedData.product) {
          updateProductInWindows({
            idprod: updatedData.product.idprod,
            nombre: updatedData.product.nombre,
            descripcion: updatedData.product.descripcion,
            imagen_principal: updatedData.product.imagen_principal,
            stock_contable: updatedData.product.stock_contable,
            stock_fisico: updatedData.product.stock_fisico,
            costo: updatedData.product.costo,
            OE: updatedData.product.OE,
            marca: updatedData.product.marca,
            categoria_nombre: updatedData.product.categoria_nombre,
            categoria_nueva_nombre: updatedData.product.categoria_nueva_nombre,
            idcategoria: updatedData.product.idcategoria,
            idcategoria_nuevo: updatedData.product.idcategoria_nuevo,
            idprodprov: updatedData.product.idprodprov,
            idprodpaquete: updatedData.product.idprodpaquete,
            codigo_barras: updatedData.product.codigo_barras,
            codigo_jerarquico: updatedData.product.codigo_jerarquico,
            precio1: updatedData.product.precio1,
            precio2: updatedData.product.precio2,
            precio3: updatedData.product.precio3,
            precio4: updatedData.product.precio4,
            precio5: updatedData.product.precio5,
            precio6: updatedData.product.precio6,
            precio7: updatedData.product.precio7,
          });
        }
        
        addNotification({
          type: 'success',
          title: 'Producto Actualizado',
          message: `El producto "${producto.nombre}" ha sido actualizado correctamente.`
        });
        await fetchAllProductos();
        handleCancelEdit();
      } else {
        const data = await response.json();
        addNotification({
          type: 'error',
          title: 'Error al actualizar',
          message: data.error || 'No se pudo actualizar el producto'
        });
      }
    } catch (error) {
      console.error('Error:', error);
      addNotification({
        type: 'error',
        title: 'Error de conexión',
        message: 'No se pudo conectar con el servidor'
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-screen bg-[#0a0f1a]">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-[#0e88c9] mb-4"></div>
          {idParam && <p className="text-slate-400">Cargando producto...</p>}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Navbar */}
        <div className="rounded-xl border border-[#0e88c9]/30 bg-[#0d1523] px-5 py-3 flex items-center justify-between gap-4 shadow-[0_0_25px_rgba(15,23,42,0.9)]">
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
            <NotificationDropdown />
            <UserDropdown />
          </div>
        </div>

        {/* Diálogo de confirmación */}
        {showConfirmDialog && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="bg-[#141e2e] border border-[#0e88c9]/30 rounded-xl p-6 max-w-md w-full mx-4 shadow-[0_0_30px_rgba(14,136,201,0.3)]">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-12 w-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-yellow-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-100">Confirmar Edición</h3>
                  <p className="text-sm text-slate-400">Esta acción modificará el producto</p>
                </div>
              </div>
              <p className="text-slate-300 mb-6">
                ¿Está seguro que desea guardar los cambios realizados al producto <span className="font-semibold text-[#0e88c9]">"{producto?.nombre}"</span>?
              </p>
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowConfirmDialog(false)}
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmSave}
                  className="bg-[#0e88c9] hover:bg-[#0e88c9]/90 text-white"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Sí, Guardar Cambios
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Columna Izquierda: Lista de productos */}
          <div className="lg:col-span-4 space-y-4">
            <Card className="bg-[#141e2e] border border-[#0e88c9]/30 rounded-xl overflow-hidden">
              <CardHeader className="py-2 px-3 border-b border-slate-800">
                <SearchFilters
                  searchTerm={searchQuery}
                  onSearchChange={(value) => { setSearchQuery(value); setSelectedIndex(0); }}
                  searchFilter={searchFilter}
                  onFilterChange={setSearchFilter}
                  compact={true}
                />
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
                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-[#0e88c9]/10 text-[#0e88c9] border-[#0e88c9]/30">
                            {(prod as any).categoria_nueva_nombre || prod.categoria_nombre || '-'}
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
              <form id="product-form" onSubmit={handleSubmitClick} className="space-y-4">
                {/* Galería de Imágenes - Centrada arriba */}
                <Card className="bg-[#141e2e] border border-[#0e88c9]/30 shadow-[0_0_20px_rgba(14,136,201,0.25)] rounded-xl overflow-hidden max-w-md mx-auto">
                  <CardHeader className="py-2 px-3 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm text-slate-200 tracking-wide">GALERÍA DE IMÁGENES</CardTitle>
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

                {/* UN SOLO CUADRO: Información del Producto */}
                <Card className="bg-[#141e2e] border border-[#0e88c9]/30 rounded-xl">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-slate-100 tracking-wide">INFORMACIÓN DEL PRODUCTO</CardTitle>
                    <CardDescription className="text-xs text-slate-400">Datos básicos, clasificación y stock</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Datos Básicos */}
                    <div className="grid grid-cols-2 gap-4">
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

                    {/* Separador Clasificación y Stock */}
                    <div className="border-t border-slate-700/40 pt-4">
                      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Clasificación Jerárquica</h4>
                    </div>

                    {/* Sistema de Categorías Jerárquico: Categoría > Grupo > Subgrupo */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Categoría *</Label>
                        <Select 
                          value={selectedCategoria?.toString() || ''} 
                          onValueChange={(v) => handleCategoriaChange(Number(v))}
                        >
                          <SelectTrigger className="bg-slate-950/80 border-slate-700/40 text-slate-100">
                            <SelectValue placeholder="Seleccione categoría" />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-900 border-slate-700">
                            {categoriasNuevo.map(c => (
                              <SelectItem key={c.idcategoria} value={c.idcategoria.toString()}>
                                {c.idcategoria} - {c.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Grupo</Label>
                        <Select 
                          value={selectedGrupo?.toString() || ''} 
                          onValueChange={(v) => handleGrupoChange(Number(v))}
                          disabled={!selectedCategoria}
                        >
                          <SelectTrigger className="bg-slate-950/80 border-slate-700/40 text-slate-100">
                            <SelectValue placeholder={selectedCategoria ? "Seleccione grupo" : "Primero seleccione categoría"} />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-900 border-slate-700">
                            {gruposFiltrados.map(g => (
                              <SelectItem key={g.id_grupo} value={g.id_grupo.toString()}>
                                {g.codigo} - {g.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Subgrupo</Label>
                        <Select 
                          value={selectedSubgrupo?.toString() || ''} 
                          onValueChange={(v) => handleSubgrupoChange(Number(v))}
                          disabled={!selectedGrupo}
                        >
                          <SelectTrigger className="bg-slate-950/80 border-slate-700/40 text-slate-100">
                            <SelectValue placeholder={selectedGrupo ? "Seleccione subgrupo" : "Primero seleccione grupo"} />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-900 border-slate-700">
                            {subgruposFiltrados.map(s => (
                              <SelectItem key={s.id_subgrupo} value={s.id_subgrupo.toString()}>
                                {s.codigo} - {s.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Código Jerárquico Generado */}
                    {(producto as any).codigo_jerarquico && (
                      <div className="mt-2 p-3 bg-[#0e88c9]/10 border border-[#0e88c9]/30 rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-400">Código Jerárquico:</span>
                          <span className="text-lg font-mono font-bold text-[#0e88c9]">
                            {(producto as any).codigo_jerarquico}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">
                          Formato: [Categoría 2d][Grupo 3d][Subgrupo 3d] = 8 dígitos
                        </p>
                      </div>
                    )}

                    {/* Otros campos de clasificación */}
                    <div className="grid grid-cols-2 gap-4 mt-4">
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
                    {/* Clasificación: Modelo, Clase, Estilo, Giro */}
                    <div className="grid grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label>Modelo</Label>
                        <Input value={producto.modelo || ''} onChange={(e) => updateProductField('modelo', e.target.value)}
                          placeholder="Modelo" className="bg-slate-950/80 border-slate-700/40 text-slate-100" />
                      </div>
                      <div className="space-y-2">
                        <Label>Clase</Label>
                        <Input value={producto.clase || ''} onChange={(e) => updateProductField('clase', e.target.value)}
                          placeholder="Clase" className="bg-slate-950/80 border-slate-700/40 text-slate-100" />
                      </div>
                      <div className="space-y-2">
                        <Label>Estilo</Label>
                        <Input value={producto.estilo || ''} onChange={(e) => updateProductField('estilo', e.target.value)}
                          placeholder="Estilo" className="bg-slate-950/80 border-slate-700/40 text-slate-100" />
                      </div>
                      <div className="space-y-2">
                        <Label>Giro</Label>
                        <Input value={producto.giro || ''} onChange={(e) => updateProductField('giro', e.target.value)}
                          placeholder="Giro" className="bg-slate-950/80 border-slate-700/40 text-slate-100" />
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
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id="exento" checked={producto.exento === 1} onChange={(e) => updateProductField('exento', e.target.checked ? 1 : 0)}
                        className="w-4 h-4 rounded border-slate-700 bg-slate-950/80 text-[#0e88c9]" />
                      <Label htmlFor="exento" className="cursor-pointer">Exento de Impuestos</Label>
                    </div>

                    {/* Separador Info Adicional */}
                    <div className="border-t border-slate-700/40 pt-4">
                      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Información Adicional</h4>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Etiquetas de Búsqueda</Label>
                      <Input value={producto.etiquetas || ''} onChange={(e) => updateProductField('etiquetas', e.target.value)}
                        placeholder="frenos, disco, toyota..." className="bg-slate-950/80 border-slate-700/40 text-slate-100" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Información Reservada (Acerca del Item)</Label>
                      <Textarea value={producto.info_reservada || ''} onChange={(e) => updateProductField('info_reservada', e.target.value)}
                        placeholder="Información RESERVADA para documentar el producto"
                        rows={2} className="text-sm bg-slate-950/80 border-slate-700/40 text-slate-100 resize-none" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Información Pública</Label>
                      <Textarea value={producto.info_publica || ''} onChange={(e) => updateProductField('info_publica', e.target.value)}
                        placeholder="Información para mostrar en tienda en línea"
                        rows={2} className="text-sm bg-slate-950/80 border-slate-700/40 text-slate-100 resize-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs">Referencias Directas (OE)</Label>
                        <Textarea value={producto.info_referencias_directas || ''} onChange={(e) => updateProductField('info_referencias_directas', e.target.value)}
                          rows={2} className="text-sm bg-slate-950/80 border-slate-700/40 text-slate-100 resize-none" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Referencias Indirectas</Label>
                        <Textarea value={producto.info_referencias_indirectas || ''} onChange={(e) => updateProductField('info_referencias_indirectas', e.target.value)}
                          rows={2} className="text-sm bg-slate-950/80 border-slate-700/40 text-slate-100 resize-none" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
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
