// app/dashboard/inventario/nuevo/page.tsx
'use client';

import { DashboardLayout } from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ImageUpload } from '@/components/image-upload';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, AlertTriangle, X } from 'lucide-react';
import Link from 'next/link';
import { NotificationDropdown } from '@/components/notification-dropdown';
import { UserDropdown } from '@/components/user-dropdown';
import { useNotifications } from '@/contexts/notification-context';

interface CategoriaNueva {
  idcategoria: number;
  nombre: string;
}

interface Grupo {
  id_grupo: number;
  codigo: string;
  nombre: string;
  idcategoria: number;
}

interface Subgrupo {
  id_subgrupo: number;
  codigo: string;
  nombre: string;
  id_grupo: number;
}

export default function NuevoProductoPage() {
  const [loading, setLoading] = useState(false);
  const { addNotification } = useNotifications();
  const [images, setImages] = useState<File[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [formData, setFormData] = useState({
    // 27 campos de la tabla PRODUCTOS (Excel) + costo
    idprodprov: '',
    idprodpaquete: '',
    idprodfisico: '',
    OE: '',
    nombre: '',
    descripcion: '',
    etiquetas: '',
    marca: '',
    peso: '',
    codarancel: '',
    lado: '',
    modelo: '',
    clase: '',
    estilo: '',
    giro: '',
    capacidad: '',
    unimedida: 'UNIDAD',
    idcategoria: '',
    idcategoria_nuevo: '',
    id_grupo: '',
    id_subgrupo: '',
    codigo_barras: '',
    info_reservada: '',
    info_publica: '',
    info_referencias_directas: '',
    info_referencias_indirectas: '',
    exento: false,
    stock_contable: '0',
    stock_fisico: '0',
    costo: '0'
  });
  const router = useRouter();
  
  // Estados para categorías jerárquicas
  const [categoriasNuevas, setCategoriasNuevas] = useState<CategoriaNueva[]>([]);
  const [gruposDB, setGruposDB] = useState<Grupo[]>([]);
  const [subgruposDB, setSubgruposDB] = useState<Subgrupo[]>([]);
  const [gruposFiltrados, setGruposFiltrados] = useState<Grupo[]>([]);
  const [subgruposFiltrados, setSubgruposFiltrados] = useState<Subgrupo[]>([]);
  
  // Estados para diálogos de confirmación
  const [showConfirmSave, setShowConfirmSave] = useState(false);
  const [showConfirmLeave, setShowConfirmLeave] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  
  // Estado para validación de OE duplicado
  const [oeError, setOeError] = useState<string | null>(null);
  const [checkingOE, setCheckingOE] = useState(false);
  const oeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Estado para validación de Código Proveedor duplicado
  const [proveedorError, setProveedorError] = useState<string | null>(null);
  const [checkingProveedor, setCheckingProveedor] = useState(false);
  const proveedorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Estado para errores de validación
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  
  // Verificar si hay cambios sin guardar
  const hasUnsavedChanges = useCallback(() => {
    return formData.nombre || formData.OE || formData.descripcion || 
           formData.marca || formData.idprodprov || formData.etiquetas ||
           formData.info_referencias_directas || images.length > 0;
  }, [formData, images]);

  const unidadesMedida = [
    'UNIDAD', 'PAR', 'JUEGO', 'KIT', 'LITRO', 'GALON', 'METRO'
  ];

  const lados = ['IZQUIERDO', 'DERECHO', 'AMBOS', 'NO APLICA'];
  
  // Cargar categorías jerárquicas
  useEffect(() => {
    const fetchCategorias = async () => {
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
    fetchCategorias();
  }, []);
  
  // Filtrar grupos cuando cambia la categoría
  useEffect(() => {
    if (formData.idcategoria_nuevo) {
      const filtered = gruposDB.filter(g => g.idcategoria === Number(formData.idcategoria_nuevo));
      setGruposFiltrados(filtered);
      setFormData(prev => ({ ...prev, id_grupo: '', id_subgrupo: '' }));
      setSubgruposFiltrados([]);
    } else {
      setGruposFiltrados([]);
      setSubgruposFiltrados([]);
    }
  }, [formData.idcategoria_nuevo, gruposDB]);
  
  // Filtrar subgrupos cuando cambia el grupo
  useEffect(() => {
    if (formData.id_grupo) {
      const filtered = subgruposDB.filter(s => s.id_grupo === Number(formData.id_grupo));
      setSubgruposFiltrados(filtered);
      setFormData(prev => ({ ...prev, id_subgrupo: '' }));
    } else {
      setSubgruposFiltrados([]);
    }
  }, [formData.id_grupo, subgruposDB]);
  
  // Prevenir navegación con cambios sin guardar (cierre de pestaña/ventana)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges()) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);
  
  // Interceptar clicks en links para mostrar confirmación
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a');
      
      if (link && hasUnsavedChanges()) {
        const href = link.getAttribute('href');
        // Solo interceptar links internos de navegación
        if (href && href.startsWith('/') && !href.startsWith('/dashboard/inventario/nuevo')) {
          e.preventDefault();
          e.stopPropagation();
          setPendingNavigation(href);
          setShowConfirmLeave(true);
        }
      }
    };
    
    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [hasUnsavedChanges]);
  
  // Verificar OE duplicado
  const checkOEDuplicate = async (oe: string) => {
    if (!oe.trim()) {
      setOeError(null);
      return;
    }
    
    setCheckingOE(true);
    try {
      const response = await fetch(`/api/productos?search=${encodeURIComponent(oe)}&filters=oem&limit=10`);
      if (response.ok) {
        const data = await response.json();
        const exists = data.products?.some((p: any) => p.OE?.toLowerCase() === oe.toLowerCase());
        if (exists) {
          setOeError('Este OE ya existe en otro producto');
        } else {
          setOeError(null);
        }
      }
    } catch (error) {
      console.error('Error verificando OE:', error);
    } finally {
      setCheckingOE(false);
    }
  };
  
  // Verificar Código Proveedor duplicado
  const checkProveedorDuplicate = async (proveedor: string) => {
    if (!proveedor.trim()) {
      setProveedorError(null);
      return;
    }
    
    setCheckingProveedor(true);
    try {
      const response = await fetch(`/api/productos?search=${encodeURIComponent(proveedor)}&filters=codigo&limit=10`);
      if (response.ok) {
        const data = await response.json();
        const exists = data.products?.some((p: any) => p.idprodprov?.toLowerCase() === proveedor.toLowerCase());
        if (exists) {
          setProveedorError('Este Código Proveedor ya existe en otro producto');
        } else {
          setProveedorError(null);
        }
      }
    } catch (error) {
      console.error('Error verificando Código Proveedor:', error);
    } finally {
      setCheckingProveedor(false);
    }
  };

  const handleImagesChange = (newImages: File[]) => {
    setImages(prev => {
      const totalImages = prev.length + newImages.length;
      if (totalImages <= 10) {
        return [...prev, ...newImages];
      } else {
        alert('Máximo 10 imágenes permitidas');
        return prev;
      }
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [id]: value
    }));
    // Limpiar error de validación cuando el usuario escribe
    if (validationErrors[id]) {
      setValidationErrors(prev => ({ ...prev, [id]: '' }));
    }
    // Limpiar errores específicos de OE y Proveedor
    if (id === 'OE') {
      setOeError(null);
      setCheckingOE(false);
    }
    if (id === 'idprodprov') {
      setProveedorError(null);
      setCheckingProveedor(false);
    }
  };

  const handleSelectChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    // Limpiar error de validación
    if (validationErrors[field]) {
      setValidationErrors(prev => ({ ...prev, [field]: '' }));
    }
  };
  
  // Prevenir submit con Enter en campos de texto
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.currentTarget.tagName !== 'TEXTAREA') {
      e.preventDefault();
    }
  };
  
  // Validar campos obligatorios
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!formData.nombre.trim()) errors.nombre = 'El nombre es obligatorio';
    if (!formData.descripcion.trim()) errors.descripcion = 'La descripción es obligatoria';
    if (!formData.marca.trim()) errors.marca = 'La marca es obligatoria (use N/A si no aplica)';
    if (!formData.OE.trim()) errors.OE = 'La referencia OE es obligatoria';
    if (!formData.idprodprov.trim()) errors.idprodprov = 'El código proveedor es obligatorio';
    if (!formData.idcategoria_nuevo) errors.idcategoria_nuevo = 'La categoría es obligatoria';
    if (!formData.id_grupo) errors.id_grupo = 'El grupo es obligatorio';
    if (!formData.id_subgrupo) errors.id_subgrupo = 'El subgrupo es obligatorio';
    if (!formData.etiquetas.trim()) errors.etiquetas = 'Las etiquetas de búsqueda son obligatorias';
    if (!formData.info_referencias_directas.trim()) errors.info_referencias_directas = 'Al menos una referencia directa es obligatoria';
    
    if (oeError) errors.OE = oeError;
    if (proveedorError) errors.idprodprov = proveedorError;
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  // Mostrar diálogo de confirmación antes de guardar
  const handleSaveClick = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      setShowConfirmSave(true);
    } else {
      addNotification({
        type: 'error',
        title: 'Campos obligatorios',
        message: 'Por favor complete todos los campos obligatorios marcados con *'
      });
    }
  };
  
  // Confirmar guardado
  const confirmSave = async () => {
    setShowConfirmSave(false);
    setLoading(true);
    
    try {
      // Crear FormData para enviar archivos
      const submitData = new FormData();
      
      // Agregar datos del producto
      Object.entries(formData).forEach(([key, value]) => {
        // Convertir boolean a string para FormData
        submitData.append(key, typeof value === 'boolean' ? String(value) : value);
      });
      
      // Agregar imágenes
      images.forEach(image => {
        submitData.append('imagenes', image);
      });

      // Enviar a la API
      const response = await fetch('/api/productos', {
        method: 'POST',
        body: submitData,
      });

      const result = await response.json();

      if (response.ok) {
        // Agregar notificación de éxito
        addNotification({
          type: 'success',
          title: 'Producto Creado',
          message: `El producto "${formData.nombre}" ha sido registrado exitosamente en el inventario.`
        });
        // Redirigir al listado de productos
        router.push('/dashboard/inventario/administrar');
      } else {
        if (result.error?.includes('OE')) {
          setOeError('Este OE ya existe en otro producto');
          setValidationErrors(prev => ({ ...prev, OE: 'Este OE ya existe en otro producto' }));
        }
        addNotification({
          type: 'error',
          title: 'Error al crear producto',
          message: result.error || 'No se pudo guardar el producto'
        });
      }
    } catch (error) {
      console.error('Error al guardar producto:', error);
      alert('Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Navbar superior tipo Figma */}
        <div className="rounded-xl border border-[#0e88c9]/30 bg-[#0d1523] px-5 py-3 flex items-center justify-between gap-4 shadow-[0_0_25px_rgba(15,23,42,0.9)]">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Inventario</span>
            <span className="h-6 w-px bg-slate-700" />
            <span className="text-sm tracking-[0.18em] uppercase text-slate-200">Nuevo Producto</span>
          </div>
          <div className="flex items-center gap-3">
            <NotificationDropdown />
            <UserDropdown />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-slate-300 hover:text-slate-50"
              onClick={() => {
                if (hasUnsavedChanges()) {
                  setPendingNavigation('/dashboard/inventario/administrar');
                  setShowConfirmLeave(true);
                } else {
                  router.push('/dashboard/inventario/administrar');
                }
              }}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-50 tracking-tight">
                Nuevo Producto
              </h1>
              <p className="text-sm text-slate-400">
                Complete la información del producto para registrarlo en el inventario
              </p>
            </div>
          </div>
          <Button 
            type="submit" 
            form="product-form"
            disabled={loading} 
            className="border-[#0e88c9]/60 bg-[#0e88c9]/10 text-[#0e88c9] hover:bg-[#0e88c9]/20 rounded-full px-5"
          >
            <Save className="h-4 w-4 mr-2" />
            {loading ? 'Guardando...' : 'Guardar Producto'}
          </Button>
        </div>

        <form id="product-form" onSubmit={handleSaveClick}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Columna 1: Imágenes / ficha visual como en Figma */}
            <div className="space-y-6 lg:order-1">
              <Card className="bg-[#141e2e] border border-[#0e88c9]/30 shadow-[0_0_20px_rgba(14,136,201,0.25)] rounded-xl overflow-hidden">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm text-slate-200 tracking-wide">IMÁGENES</CardTitle>
                  <span className="text-xs text-emerald-400">{images.length}/10</span>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Imagen principal grande */}
                  <div className="relative w-full h-[200px] bg-slate-900 rounded-2xl overflow-hidden">
                    {images.length > 0 ? (
                      <>
                        <img 
                          src={URL.createObjectURL(images[selectedImageIndex] || images[0])} 
                          alt="Vista previa" 
                          className="h-full w-full object-contain"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setImages(prev => prev.filter((_, i) => i !== selectedImageIndex));
                            setSelectedImageIndex(0);
                          }}
                          className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg transition-colors"
                        >
                          ×
                        </button>
                        <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                          {selectedImageIndex + 1} / {images.length}
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-full w-full p-4">
                        <div className="rounded-xl border-2 border-dashed border-slate-700/40 bg-slate-950/60 p-4 w-full h-full flex flex-col items-center justify-center">
                          <ImageUpload onImagesChange={handleImagesChange} />
                          <p className="text-xs text-slate-500 mt-2">
                            PNG, JPG, JPEG hasta 10MB. Máximo 10 imágenes.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Botón agregar más y miniaturas */}
                  {images.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex justify-center">
                        <ImageUpload onImagesChange={handleImagesChange} />
                      </div>
                      
                      {/* Grid de miniaturas con drag & drop */}
                      {images.length > 1 && (
                        <div className="space-y-2">
                          <p className="text-xs text-slate-400">Arrastra para reordenar</p>
                          <div className="grid grid-cols-5 gap-2">
                            {images.map((img, idx) => (
                              <div 
                                key={idx} 
                                className={`relative aspect-square rounded-lg border-2 overflow-hidden group cursor-pointer ${
                                  idx === selectedImageIndex 
                                    ? 'border-[#0e88c9] bg-slate-800 ring-2 ring-[#0e88c9]/50' 
                                    : 'border-slate-700/50 bg-slate-900 hover:border-slate-500'
                                }`}
                                draggable
                                onDragStart={(e) => {
                                  e.dataTransfer.setData('text/plain', idx.toString());
                                  e.currentTarget.style.opacity = '0.5';
                                }}
                                onDragEnd={(e) => {
                                  e.currentTarget.style.opacity = '1';
                                }}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'));
                                  const targetIndex = idx;
                                  
                                  if (draggedIndex !== targetIndex) {
                                    const newImages = [...images];
                                    const [draggedImage] = newImages.splice(draggedIndex, 1);
                                    newImages.splice(targetIndex, 0, draggedImage);
                                    setImages(newImages);
                                  }
                                }}
                              >
                                <img 
                                  src={URL.createObjectURL(img)} 
                                  alt={`Imagen ${idx + 1}`} 
                                  className="h-full w-full object-cover"
                                  onClick={() => setSelectedImageIndex(idx)}
                                />
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setImages(prev => prev.filter((_, i) => i !== idx));
                                    if (selectedImageIndex >= idx && selectedImageIndex > 0) {
                                      setSelectedImageIndex(prev => prev - 1);
                                    }
                                  }}
                                  className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  ×
                                </button>
                                {idx === selectedImageIndex && (
                                  <div className="absolute inset-0 border-2 border-[#0e88c9] rounded-lg pointer-events-none"></div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Botón de envío tipo barra inferior de panel */}
              <Card className="bg-[#141e2e] border border-[#0e88c9]/30 shadow-lg rounded-xl">
                <CardContent className="p-6 space-y-2">
                  <Button 
                    type="submit" 
                    disabled={loading} 
                    className="w-full border border-[#0e88c9]/60 bg-[#0e88c9]/10 text-[#0e88c9] hover:bg-[#0e88c9]/20 rounded-xl transition-all"
                    size="lg"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {loading ? 'Guardando Producto...' : 'Guardar Producto'}
                  </Button>
                  <p className="text-xs text-slate-400 mt-1 text-center">
                    {images.length > 0 
                      ? `Se guardarán ${images.length} imágenes con el producto`
                      : 'Producto se guardará sin imágenes por ahora'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Columna 2-3: Información del producto (formulario principal) */}
            <div className="lg:col-span-2 space-y-6 lg:order-2">
              <Card className="bg-[#141e2e] border border-[#0e88c9]/30 shadow-lg rounded-xl">
                <CardHeader className="pb-3 flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm text-slate-100 tracking-wide">INFORMACIÓN DEL PRODUCTO</CardTitle>
                    <CardDescription className="text-xs text-slate-400">Ingrese los datos básicos y técnicos del producto</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Información Básica */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="nombre" className={validationErrors.nombre ? 'text-red-400' : ''}>Nombre del Producto *</Label>
                      <Input 
                        id="nombre" 
                        placeholder="Ej: Buje de Suspensión Delantero" 
                        value={formData.nombre}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        className={`bg-slate-950/80 text-slate-100 placeholder:text-slate-500 focus:border-cyan-700/60 focus:ring-cyan-700/20 ${validationErrors.nombre ? 'border-red-500' : 'border-slate-700/40'}`}
                      />
                      {validationErrors.nombre && <p className="text-xs text-red-400">{validationErrors.nombre}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="descripcion" className={validationErrors.descripcion ? 'text-red-400' : ''}>Descripción *</Label>
                      <Input 
                        id="descripcion" 
                        placeholder="Descripción breve del producto" 
                        value={formData.descripcion}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        className={`bg-slate-950/80 text-slate-100 placeholder:text-slate-500 focus:border-cyan-700/60 focus:ring-cyan-700/20 ${validationErrors.descripcion ? 'border-red-500' : 'border-slate-700/40'}`}
                      />
                      {validationErrors.descripcion && <p className="text-xs text-red-400">{validationErrors.descripcion}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="etiquetas" className={validationErrors.etiquetas ? 'text-red-400' : ''}>Etiquetas de Búsqueda *</Label>
                      <Input 
                        id="etiquetas" 
                        placeholder="frenos, disco, delantero, toyota (separar con comas)" 
                        value={formData.etiquetas}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        className={`bg-slate-950/80 text-slate-100 placeholder:text-slate-500 focus:border-cyan-700/60 focus:ring-cyan-700/20 ${validationErrors.etiquetas ? 'border-red-500' : 'border-slate-700/40'}`}
                      />
                      {validationErrors.etiquetas && <p className="text-xs text-red-400">{validationErrors.etiquetas}</p>}
                    </div>
                  </div>

                  {/* Códigos de Identificación */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="marca" className={validationErrors.marca ? 'text-red-400' : ''}>Marca *</Label>
                      <Input 
                        id="marca" 
                        placeholder="Ej: MOOG, BOSCH, N/A" 
                        value={formData.marca}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        className={`bg-slate-950/80 text-slate-100 placeholder:text-slate-500 focus:border-cyan-700/60 focus:ring-cyan-700/20 ${validationErrors.marca ? 'border-red-500' : 'border-slate-700/40'}`}
                      />
                      {validationErrors.marca && <p className="text-xs text-red-400">{validationErrors.marca}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="OE" className={validationErrors.OE || oeError ? 'text-red-400' : ''}>Referencia OE *</Label>
                      <div className="relative">
                        <Input 
                          id="OE" 
                          placeholder="Referencia del fabricante" 
                          value={formData.OE}
                          onChange={(e) => {
                            handleInputChange(e);
                            const value = e.target.value;
                            // Copiar OE a Referencias Directas automáticamente
                            setFormData(prev => ({
                              ...prev,
                              info_referencias_directas: value ? (prev.info_referencias_directas.includes(value) ? prev.info_referencias_directas : value) : prev.info_referencias_directas
                            }));
                            // Verificar OE duplicado con debounce más eficiente
                            if (oeTimeoutRef.current) {
                              clearTimeout(oeTimeoutRef.current);
                            }
                            if (value.trim()) {
                              oeTimeoutRef.current = setTimeout(() => checkOEDuplicate(value), 300);
                            } else {
                              setOeError(null);
                              setCheckingOE(false);
                            }
                          }}
                          onKeyDown={handleKeyDown}
                          className={`bg-slate-950/80 text-slate-100 placeholder:text-slate-500 focus:border-cyan-700/60 focus:ring-cyan-700/20 pr-10 ${validationErrors.OE || oeError ? 'border-red-500' : 'border-slate-700/40'}`}
                        />
                        {/* Indicador de estado */}
                        <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                          {checkingOE ? (
                            <div className="w-5 h-5 border-2 border-[#0e88c9] border-t-transparent rounded-full animate-spin"></div>
                          ) : formData.OE.trim() ? (
                            oeError ? (
                              <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                                <X className="h-3 w-3 text-white" />
                              </div>
                            ) : (
                              <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                                <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            )
                          ) : null}
                        </div>
                      </div>
                      {(validationErrors.OE || oeError) && <p className="text-xs text-red-400">{validationErrors.OE || oeError}</p>}
                    </div>
                  </div>

                  {/* Códigos Adicionales */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="idprodprov" className={validationErrors.idprodprov || proveedorError ? 'text-red-400' : ''}>Código Proveedor *</Label>
                      <div className="relative">
                        <Input 
                          id="idprodprov" 
                          placeholder="Código según factura" 
                          value={formData.idprodprov}
                          onChange={(e) => {
                            handleInputChange(e);
                            const value = e.target.value;
                            // Verificar Código Proveedor duplicado con debounce
                            if (proveedorTimeoutRef.current) {
                              clearTimeout(proveedorTimeoutRef.current);
                            }
                            if (value.trim()) {
                              proveedorTimeoutRef.current = setTimeout(() => checkProveedorDuplicate(value), 300);
                            } else {
                              setProveedorError(null);
                              setCheckingProveedor(false);
                            }
                          }}
                          onKeyDown={handleKeyDown}
                          className={`bg-slate-950/80 text-slate-100 placeholder:text-slate-500 focus:border-cyan-700/60 focus:ring-cyan-700/20 pr-10 ${validationErrors.idprodprov || proveedorError ? 'border-red-500' : 'border-slate-700/40'}`}
                        />
                        {/* Indicador de estado */}
                        <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                          {checkingProveedor ? (
                            <div className="w-5 h-5 border-2 border-[#0e88c9] border-t-transparent rounded-full animate-spin"></div>
                          ) : formData.idprodprov.trim() ? (
                            proveedorError ? (
                              <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                                <X className="h-3 w-3 text-white" />
                              </div>
                            ) : (
                              <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                                <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            )
                          ) : null}
                        </div>
                      </div>
                      {(validationErrors.idprodprov || proveedorError) && <p className="text-xs text-red-400">{validationErrors.idprodprov || proveedorError}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="idprodpaquete">Código Paquete</Label>
                      <Input 
                        id="idprodpaquete" 
                        placeholder="Código del embalaje" 
                        value={formData.idprodpaquete}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        className="bg-slate-950/80 border-slate-700/40 text-slate-100 placeholder:text-slate-500 focus:border-cyan-700/60 focus:ring-cyan-700/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="idprodfisico">ID Producto Físico</Label>
                      <Input 
                        id="idprodfisico" 
                        placeholder="ID del producto físico" 
                        value={formData.idprodfisico}
                        onChange={handleInputChange}
                        className="bg-slate-950/80 border-slate-700/40 text-slate-100 placeholder:text-slate-500 focus:border-cyan-700/60 focus:ring-cyan-700/20"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="codigo_barras">Código de Barras</Label>
                    <Input 
                      id="codigo_barras" 
                      placeholder="Código QR o barras" 
                      value={formData.codigo_barras}
                      onChange={handleInputChange}
                      className="bg-slate-950/80 border-slate-700/40 text-slate-100 placeholder:text-slate-500 focus:border-cyan-700/60 focus:ring-cyan-700/20"
                    />
                  </div>

                  {/* Categorización Jerárquica */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="idcategoria_nuevo" className={validationErrors.idcategoria_nuevo ? 'text-red-400' : ''}>Categoría *</Label>
                      <Select 
                        value={formData.idcategoria_nuevo}
                        onValueChange={(value) => handleSelectChange('idcategoria_nuevo', value)}
                      >
                        <SelectTrigger className={`bg-slate-950/80 text-slate-100 focus:border-cyan-700/60 focus:ring-cyan-700/20 ${validationErrors.idcategoria_nuevo ? 'border-red-500' : 'border-slate-700/40'}`}>
                          <SelectValue placeholder="Seleccione categoría" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-700 text-slate-100">
                          {categoriasNuevas.map((cat) => (
                            <SelectItem key={cat.idcategoria} value={String(cat.idcategoria)}>
                              {cat.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {validationErrors.idcategoria_nuevo && <p className="text-xs text-red-400">{validationErrors.idcategoria_nuevo}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="id_grupo" className={validationErrors.id_grupo ? 'text-red-400' : ''}>Grupo *</Label>
                      <Select 
                        value={formData.id_grupo}
                        onValueChange={(value) => handleSelectChange('id_grupo', value)}
                        disabled={!formData.idcategoria_nuevo}
                      >
                        <SelectTrigger className={`bg-slate-950/80 text-slate-100 focus:border-cyan-700/60 focus:ring-cyan-700/20 ${validationErrors.id_grupo ? 'border-red-500' : 'border-slate-700/40'} ${!formData.idcategoria_nuevo ? 'opacity-50' : ''}`}>
                          <SelectValue placeholder={formData.idcategoria_nuevo ? "Seleccione grupo" : "Primero seleccione categoría"} />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-700 text-slate-100">
                          {gruposFiltrados.map((grupo) => (
                            <SelectItem key={grupo.id_grupo} value={String(grupo.id_grupo)}>
                              {grupo.codigo} - {grupo.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {validationErrors.id_grupo && <p className="text-xs text-red-400">{validationErrors.id_grupo}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="id_subgrupo" className={validationErrors.id_subgrupo ? 'text-red-400' : ''}>Subgrupo *</Label>
                      <Select 
                        value={formData.id_subgrupo}
                        onValueChange={(value) => handleSelectChange('id_subgrupo', value)}
                        disabled={!formData.id_grupo}
                      >
                        <SelectTrigger className={`bg-slate-950/80 text-slate-100 focus:border-cyan-700/60 focus:ring-cyan-700/20 ${validationErrors.id_subgrupo ? 'border-red-500' : 'border-slate-700/40'} ${!formData.id_grupo ? 'opacity-50' : ''}`}>
                          <SelectValue placeholder={formData.id_grupo ? "Seleccione subgrupo" : "Primero seleccione grupo"} />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-700 text-slate-100">
                          {subgruposFiltrados.map((subgrupo) => (
                            <SelectItem key={subgrupo.id_subgrupo} value={String(subgrupo.id_subgrupo)}>
                              {subgrupo.codigo} - {subgrupo.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {validationErrors.id_subgrupo && <p className="text-xs text-red-400">{validationErrors.id_subgrupo}</p>}
                    </div>
                  </div>
                  
                  {/* Especificaciones Técnicas */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                    <div className="space-y-2">
                      <Label htmlFor="peso">Peso (libras)</Label>
                      <Input 
                        id="peso" 
                        type="number" 
                        step="0.001" 
                        placeholder="0.000" 
                        value={formData.peso}
                        onChange={handleInputChange}
                        className="bg-slate-950/80 border-slate-700/40 text-slate-100 placeholder:text-slate-500 focus:border-cyan-700/60 focus:ring-cyan-700/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="codarancel">Código Arancelario</Label>
                      <Input 
                        id="codarancel" 
                        placeholder="8708990000" 
                        value={formData.codarancel}
                        onChange={handleInputChange}
                        className="bg-slate-950/80 border-slate-700/40 text-slate-100 placeholder:text-slate-500 focus:border-cyan-700/60 focus:ring-cyan-700/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="capacidad">Capacidad</Label>
                      <Input 
                        id="capacidad" 
                        placeholder="Ej: 1 litro, 5 galones" 
                        value={formData.capacidad}
                        onChange={handleInputChange}
                        className="bg-slate-950/80 border-slate-700/40 text-slate-100 placeholder:text-slate-500 focus:border-cyan-700/60 focus:ring-cyan-700/20"
                      />
                    </div>
                  </div>

                  {/* Clasificación Adicional */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="modelo">Modelo</Label>
                      <Input 
                        id="modelo" 
                        placeholder="Modelo" 
                        value={formData.modelo}
                        onChange={handleInputChange}
                        className="bg-slate-950/80 border-slate-700/40 text-slate-100 placeholder:text-slate-500 focus:border-cyan-700/60 focus:ring-cyan-700/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="clase">Clase</Label>
                      <Input 
                        id="clase" 
                        placeholder="Clase del producto" 
                        value={formData.clase}
                        onChange={handleInputChange}
                        className="bg-slate-950/80 border-slate-700/40 text-slate-100 placeholder:text-slate-500 focus:border-cyan-700/60 focus:ring-cyan-700/20"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="estilo">Estilo</Label>
                      <Input 
                        id="estilo" 
                        placeholder="Estilo" 
                        value={formData.estilo}
                        onChange={handleInputChange}
                        className="bg-slate-950/80 border-slate-700/40 text-slate-100 placeholder:text-slate-500 focus:border-cyan-700/60 focus:ring-cyan-700/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="giro">Giro</Label>
                      <Input 
                        id="giro" 
                        placeholder="Giro" 
                        value={formData.giro}
                        onChange={handleInputChange}
                        className="bg-slate-950/80 border-slate-700/40 text-slate-100 placeholder:text-slate-500 focus:border-cyan-700/60 focus:ring-cyan-700/20"
                      />
                    </div>
                  </div>

                  {/* Costo del Producto */}
                  <div className="border-t pt-4">
                    <div className="space-y-2 max-w-md">
                      <Label htmlFor="costo">Costo del Producto</Label>
                      <Input 
                        id="costo" 
                        type="number" 
                        step="0.01"
                        placeholder="0.00" 
                        value={formData.costo}
                        onChange={handleInputChange}
                        className="bg-slate-950/80 border-slate-700/40 text-slate-100 placeholder:text-slate-500 focus:border-cyan-700/60 focus:ring-cyan-700/20"
                      />
                      <p className="text-xs text-slate-500">Precio de compra o costo de adquisición del producto</p>
                    </div>
                  </div>

                  {/* Stock Inicial */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="stock_contable">Stock Contable</Label>
                      <Input 
                        id="stock_contable" 
                        type="number" 
                        value={formData.stock_contable}
                        onChange={handleInputChange}
                        className="bg-slate-950/80 border-slate-700/40 text-slate-100 placeholder:text-slate-500 focus:border-cyan-700/60 focus:ring-cyan-700/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="stock_fisico">Stock Físico</Label>
                      <Input 
                        id="stock_fisico" 
                        type="number" 
                        value={formData.stock_fisico}
                        onChange={handleInputChange}
                        className="bg-slate-950/80 border-slate-700/40 text-slate-100 placeholder:text-slate-500 focus:border-cyan-700/60 focus:ring-cyan-700/20"
                      />
                    </div>
                  </div>

                  {/* Información Adicional */}
                  <div className="space-y-4 border-t pt-4">
                    <h3 className="text-sm font-medium text-slate-400">Información Adicional</h3>
                    
                    <div className="space-y-2">
                      <Label htmlFor="info_reservada">Información Reservada (Acerca del Item)</Label>
                      <Textarea 
                        id="info_reservada" 
                        placeholder="Información escrita RESERVADA que se desea documentar del producto. Debe ser multilínea."
                        value={formData.info_reservada}
                        onChange={handleInputChange}
                        rows={3}
                        className="bg-slate-950/80 border-slate-700/40 text-slate-100 placeholder:text-slate-500 focus:border-cyan-700/60 focus:ring-cyan-700/20"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="info_publica">Información Pública</Label>
                      <Textarea 
                        id="info_publica" 
                        placeholder="Lo mismo que lo anterior pero en caso de publicar en tienda en línea, sería esta la información a mostrar."
                        value={formData.info_publica}
                        onChange={handleInputChange}
                        rows={3}
                        className="bg-slate-950/80 border-slate-700/40 text-slate-100 placeholder:text-slate-500 focus:border-cyan-700/60 focus:ring-cyan-700/20"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="info_referencias_directas" className={validationErrors.info_referencias_directas ? 'text-red-400' : ''}>Referencias Directas (OEM, ODA, OE) *</Label>
                      <Textarea 
                        id="info_referencias_directas" 
                        placeholder="Todas las referencias originales que identifican a este producto (OEM, ODA, OE, números originales de fabricantes)"
                        value={formData.info_referencias_directas}
                        onChange={handleInputChange}
                        rows={2}
                        className={`bg-slate-950/80 text-slate-100 placeholder:text-slate-500 focus:border-cyan-700/60 focus:ring-cyan-700/20 ${validationErrors.info_referencias_directas ? 'border-red-500' : 'border-slate-700/40'}`}
                      />
                      {validationErrors.info_referencias_directas && <p className="text-xs text-red-400">{validationErrors.info_referencias_directas}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="info_referencias_indirectas">Referencias Indirectas</Label>
                      <Textarea 
                        id="info_referencias_indirectas" 
                        placeholder="Referencias de productos que no son exactamente estos productos, pero que pueden ser útiles como referencia."
                        value={formData.info_referencias_indirectas}
                        onChange={handleInputChange}
                        rows={2}
                        className="bg-slate-950/80 border-slate-700/40 text-slate-100 placeholder:text-slate-500 focus:border-cyan-700/60 focus:ring-cyan-700/20"
                      />
                    </div>
                  </div>

                  {/* Opciones Finales: Lado, Unidad de Medida y Exento */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="lado">Lado</Label>
                      <Select onValueChange={(value) => handleSelectChange('lado', value)}>
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
                        defaultValue="UNIDAD"
                        onValueChange={(value) => handleSelectChange('unimedida', value)}
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
                    <div className="space-y-2 flex items-end">
                      <Label htmlFor="exento" className="flex items-center gap-2 cursor-pointer h-10 px-3 rounded-md border border-slate-700/40 bg-slate-950/80 w-full">
                        <input
                          type="checkbox"
                          id="exento"
                          checked={formData.exento}
                          onChange={(e) => setFormData(prev => ({ ...prev, exento: e.target.checked }))}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-950/80 text-[#0e88c9] focus:ring-[#0e88c9] focus:ring-offset-0"
                        />
                        <span className="text-sm text-slate-100">Exento de Impuestos</span>
                      </Label>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
        
        {/* Modal de Confirmación de Guardado */}
        {showConfirmSave && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-[#141e2e] border border-[#0e88c9]/30 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-amber-500/20 rounded-lg">
                  <AlertTriangle className="h-6 w-6 text-amber-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-100">Confirmar Creación</h3>
                  <p className="text-sm text-slate-400 mt-1">Esta acción creará un nuevo producto</p>
                </div>
              </div>
              <p className="mt-4 text-slate-300">
                ¿Está seguro que desea crear el producto "<span className="text-[#0e88c9] font-medium">{formData.nombre}</span>"?
              </p>
              <div className="flex justify-end gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => setShowConfirmSave(false)}
                  className="border-slate-600 text-slate-300 hover:bg-slate-800"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={confirmSave}
                  disabled={loading}
                  className="bg-[#0e88c9] text-white hover:bg-[#0e88c9]/80"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? 'Guardando...' : 'Sí, Crear Producto'}
                </Button>
              </div>
            </div>
          </div>
        )}
        
        {/* Modal de Confirmación de Abandono */}
        {showConfirmLeave && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-[#141e2e] border border-[#0e88c9]/30 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-amber-500/20 rounded-lg">
                  <AlertTriangle className="h-6 w-6 text-amber-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-100">Cambios sin guardar</h3>
                  <p className="text-sm text-slate-400 mt-1">Tiene información sin guardar</p>
                </div>
              </div>
              <p className="mt-4 text-slate-300">
                ¿Está seguro que desea abandonar la página? Los cambios no guardados se perderán.
              </p>
              <div className="flex justify-end gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowConfirmLeave(false);
                    setPendingNavigation(null);
                  }}
                  className="border-slate-600 text-slate-300 hover:bg-slate-800 rounded-full px-6"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => {
                    setShowConfirmLeave(false);
                    if (pendingNavigation) {
                      router.push(pendingNavigation);
                    }
                  }}
                  className="bg-[#0e88c9] text-white hover:bg-[#0e88c9]/80 rounded-full px-6"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Sí, Abandonar
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
