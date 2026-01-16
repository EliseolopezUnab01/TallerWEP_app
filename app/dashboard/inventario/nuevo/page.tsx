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
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';
import { NotificationDropdown } from '@/components/notification-dropdown';
import { UserDropdown } from '@/components/user-dropdown';
import { useNotifications } from '@/contexts/notification-context';

export default function NuevoProductoPage() {
  const [loading, setLoading] = useState(false);
  const { addNotification } = useNotifications();
  const [images, setImages] = useState<File[]>([]);
  const [formData, setFormData] = useState({
    // 28 campos de la tabla PRODUCTOS
    tipo: '',
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

  const unidadesMedida = [
    'UNIDAD', 'PAR', 'JUEGO', 'KIT', 'LITRO', 'GALON', 'METRO'
  ];

  const lados = ['IZQUIERDO', 'DERECHO', 'AMBOS', 'NO APLICA'];

  const handleImagesChange = (newImages: File[]) => {
    setImages(newImages);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [id]: value
    }));
  };

  const handleSelectChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
            <Link href="/dashboard/inventario/administrar">
              <Button variant="ghost" size="icon" className="text-slate-300 hover:text-slate-50">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
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

        <form id="product-form" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Columna 1: Imágenes / ficha visual como en Figma */}
            <div className="space-y-6 lg:order-1">
              <Card className="bg-[#141e2e] border border-[#0e88c9]/30 shadow-[0_0_20px_rgba(14,136,201,0.25)] rounded-xl overflow-hidden">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm text-slate-200 tracking-wide">IMAGE GALLERY</CardTitle>
                  <span className="text-xs text-emerald-400">{images.length}/10</span>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="relative w-full h-[250px] bg-slate-900 rounded-2xl overflow-hidden">
                    <div className="flex items-center justify-center h-full w-full p-4">
                      <div className="rounded-xl border-2 border-dashed border-slate-700/40 bg-slate-950/60 p-4 w-full h-full flex flex-col items-center justify-center">
                        <ImageUpload onImagesChange={handleImagesChange} />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center justify-center">
                    {images.length > 0 ? (
                      images.map((img, idx) => (
                        <div key={idx} className="h-14 w-20 flex-shrink-0 rounded-md border border-cyan-700/50 bg-slate-900 overflow-hidden">
                          <div className="relative h-full w-full">
                            <img 
                              src={URL.createObjectURL(img)} 
                              alt={`Uploaded preview ${idx + 1}`} 
                              className="h-full w-full object-cover"
                            />
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-500 text-center">
                        Suba hasta 10 imágenes. Use fotos claras del producto y su empaque.
                      </p>
                    )}
                  </div>
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
                      <Label htmlFor="nombre">Nombre del Producto *</Label>
                      <Input 
                        id="nombre" 
                        placeholder="Ej: Buje de Suspensión Delantero" 
                        required 
                        value={formData.nombre}
                        onChange={handleInputChange}
                        className="bg-slate-950/80 border-slate-700/40 text-slate-100 placeholder:text-slate-500 focus:border-cyan-700/60 focus:ring-cyan-700/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="descripcion">Descripción</Label>
                      <Input 
                        id="descripcion" 
                        placeholder="Descripción breve del producto" 
                        value={formData.descripcion}
                        onChange={handleInputChange}
                        className="bg-slate-950/80 border-slate-700/40 text-slate-100 placeholder:text-slate-500 focus:border-cyan-700/60 focus:ring-cyan-700/20"
                      />
                    </div>
                  </div>

                  {/* Códigos de Identificación */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="marca">Marca</Label>
                      <Input 
                        id="marca" 
                        placeholder="Ej: MOOG, BOSCH, etc." 
                        value={formData.marca}
                        onChange={handleInputChange}
                        className="bg-slate-950/80 border-slate-700/40 text-slate-100 placeholder:text-slate-500 focus:border-cyan-700/60 focus:ring-cyan-700/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="OE">Referencia OE *</Label>
                      <Input 
                        id="OE" 
                        placeholder="Referencia del fabricante" 
                        required 
                        value={formData.OE}
                        onChange={handleInputChange}
                        className="bg-slate-950/80 border-slate-700/40 text-slate-100 placeholder:text-slate-500 focus:border-cyan-700/60 focus:ring-cyan-700/20"
                      />
                    </div>
                  </div>

                  {/* Códigos Adicionales */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="idprodprov">Código Proveedor</Label>
                      <Input 
                        id="idprodprov" 
                        placeholder="Código según factura" 
                        value={formData.idprodprov}
                        onChange={handleInputChange}
                        className="bg-slate-950/80 border-slate-700/40 text-slate-100 placeholder:text-slate-500 focus:border-cyan-700/60 focus:ring-cyan-700/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="idprodpaquete">Código Paquete</Label>
                      <Input 
                        id="idprodpaquete" 
                        placeholder="Código del embalaje" 
                        value={formData.idprodpaquete}
                        onChange={handleInputChange}
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

                  {/* Exento de Impuestos */}
                  <div className="space-y-2">
                    <Label htmlFor="exento" className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        id="exento"
                        checked={formData.exento}
                        onChange={(e) => setFormData(prev => ({ ...prev, exento: e.target.checked }))}
                        className="w-4 h-4 rounded border-slate-700 bg-slate-950/80 text-[#0e88c9] focus:ring-[#0e88c9] focus:ring-offset-0"
                      />
                      <span className="text-sm">Exento de Impuestos</span>
                    </Label>
                    <p className="text-xs text-slate-500">Marque si el producto está exento de IVA u otros impuestos</p>
                  </div>

                  {/* Categorización */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="idcategoria">Categoría *</Label>
                      <Select onValueChange={(value) => handleSelectChange('idcategoria', value)}>
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

                  {/* Información Adicional */}
                  <div className="space-y-2">
                    <Label htmlFor="etiquetas">Etiquetas de Búsqueda</Label>
                    <Input 
                      id="etiquetas" 
                      placeholder="frenos, disco, delantero, toyota (separar con comas)" 
                      value={formData.etiquetas}
                      onChange={handleInputChange}
                      className="bg-slate-950/80 border-slate-700/40 text-slate-100 placeholder:text-slate-500 focus:border-cyan-700/60 focus:ring-cyan-700/20"
                    />
                  </div>

                  {/* Clasificación Adicional */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="tipo">Tipo</Label>
                      <Input 
                        id="tipo" 
                        placeholder="Tipo de producto" 
                        value={formData.tipo}
                        onChange={handleInputChange}
                        className="bg-slate-950/80 border-slate-700/40 text-slate-100 placeholder:text-slate-500 focus:border-cyan-700/60 focus:ring-cyan-700/20"
                      />
                    </div>
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
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
