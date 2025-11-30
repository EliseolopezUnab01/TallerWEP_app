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

export default function NuevoProductoPage() {
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    marca: '',
    OE: '',
    idprodprov: '',
    idprodpaquete: '',
    codigo_barras: '',
    idcategoria: '',
    lado: '',
    unimedida: 'UNIDAD',
    peso: '',
    codarancel: '',
    capacidad: '',
    etiquetas: '',
    info_referencias_directas: '',
    info_publica: '',
    info_reservada: '',
    stock_contable: '0',
    stock_fisico: '0'
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
        submitData.append(key, value);
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
        alert('Producto guardado exitosamente');
        // Redirigir al listado de productos o resetear el formulario
        router.push('/dashboard/inventario/administrar');
      } else {
        alert(`Error: ${result.error}`);
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
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-slate-50 tracking-tight">Nuevo Producto</h1>
          <p className="text-sm text-slate-400">Complete la información del producto para registrarlo en el inventario</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Columna 1: Imágenes / ficha visual como en Figma */}
            <div className="space-y-6 lg:order-1">
              <Card className="bg-slate-900/80 border-slate-800 shadow-xl overflow-hidden">
                <CardHeader className="border-b border-slate-800 pb-4">
                  <CardTitle className="text-slate-200">Vista previa del producto</CardTitle>
                  <CardDescription className="text-slate-400">Suba las imágenes principales del producto</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                    <ImageUpload onImagesChange={handleImagesChange} />
                  </div>
                  <p className="text-xs text-slate-500 text-center">
                    Máximo 10 imágenes. Use fotos claras del producto y su empaque.
                  </p>
                </CardContent>
              </Card>

              {/* Botón de envío tipo barra inferior de panel */}
              <Card className="bg-slate-900/80 border-slate-800 shadow-lg">
                <CardContent className="p-6 space-y-2">
                  <Button 
                    type="submit" 
                    disabled={loading} 
                    className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-950"
                    size="lg"
                  >
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
              <Card className="bg-slate-900/80 border-slate-800 shadow-xl">
                <CardHeader>
                  <CardTitle className="text-slate-200">Información del Producto</CardTitle>
                  <CardDescription className="text-slate-400">Ingrese los datos básicos y técnicos del producto</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Información Básica */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="nombre">Nombre del Producto *</Label>
                      <Input 
                        id="nombre" 
                        placeholder="Ej: Buje de Suspensión Delantero" 
                        required 
                        value={formData.nombre}
                        onChange={handleInputChange}
                        className="bg-slate-900/80 border-slate-700 text-slate-100 placeholder:text-slate-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="descripcion">Descripción</Label>
                      <Input 
                        id="descripcion" 
                        placeholder="Tipo de producto" 
                        value={formData.descripcion}
                        onChange={handleInputChange}
                        className="bg-slate-900/80 border-slate-700 text-slate-100 placeholder:text-slate-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="marca">Marca del Producto</Label>
                      <Input 
                        id="marca" 
                        placeholder="Ej: MOOG, BOSCH, etc." 
                        value={formData.marca}
                        onChange={handleInputChange}
                        className="bg-slate-900/80 border-slate-700 text-slate-100 placeholder:text-slate-500"
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
                        className="bg-slate-900/80 border-slate-700 text-slate-100 placeholder:text-slate-500"
                      />
                    </div>
                  </div>

                  {/* Códigos de Identificación */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="idprodprov">Código Proveedor</Label>
                      <Input 
                        id="idprodprov" 
                        placeholder="Código según factura" 
                        value={formData.idprodprov}
                        onChange={handleInputChange}
                        className="bg-slate-900/80 border-slate-700 text-slate-100 placeholder:text-slate-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="idprodpaquete">Código Paquete</Label>
                      <Input 
                        id="idprodpaquete" 
                        placeholder="Código del embalaje" 
                        value={formData.idprodpaquete}
                        onChange={handleInputChange}
                        className="bg-slate-900/80 border-slate-700 text-slate-100 placeholder:text-slate-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="codigo_barras">Código de Barras</Label>
                      <Input 
                        id="codigo_barras" 
                        placeholder="Código QR o barras" 
                        value={formData.codigo_barras}
                        onChange={handleInputChange}
                        className="bg-slate-900/80 border-slate-700 text-slate-100 placeholder:text-slate-500"
                      />
                    </div>
                  </div>

                  {/* Categorización */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="idcategoria">Categoría *</Label>
                      <Select onValueChange={(value) => handleSelectChange('idcategoria', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione categoría" />
                        </SelectTrigger>
                        <SelectContent>
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
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione lado" />
                        </SelectTrigger>
                        <SelectContent>
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
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
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
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="peso">Peso (libras)</Label>
                      <Input 
                        id="peso" 
                        type="number" 
                        step="0.001" 
                        placeholder="0.000" 
                        value={formData.peso}
                        onChange={handleInputChange}
                        className="bg-slate-900/80 border-slate-700 text-slate-100 placeholder:text-slate-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="codarancel">Código Arancelario</Label>
                      <Input 
                        id="codarancel" 
                        placeholder="8708990000" 
                        value={formData.codarancel}
                        onChange={handleInputChange}
                        className="bg-slate-900/80 border-slate-700 text-slate-100 placeholder:text-slate-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="capacidad">Capacidad</Label>
                      <Input 
                        id="capacidad" 
                        placeholder="Ej: 1 litro, 5 galones" 
                        value={formData.capacidad}
                        onChange={handleInputChange}
                        className="bg-slate-900/80 border-slate-700 text-slate-100 placeholder:text-slate-500"
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
                      className="bg-slate-900/80 border-slate-700 text-slate-100 placeholder:text-slate-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="info_referencias_directas">Referencias Directas (OE, OEM)</Label>
                    <Textarea 
                      id="info_referencias_directas" 
                      placeholder="Lista de números originales del fabricante separados por comas..."
                      rows={2}
                      value={formData.info_referencias_directas}
                      onChange={handleInputChange}
                      className="bg-slate-900/80 border-slate-700 text-slate-100 placeholder:text-slate-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="info_publica">Información Pública</Label>
                      <Textarea 
                        id="info_publica" 
                        placeholder="Información para mostrar a clientes..."
                        rows={3}
                        value={formData.info_publica}
                        onChange={handleInputChange}
                        className="bg-slate-900/80 border-slate-700 text-slate-100 placeholder:text-slate-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="info_reservada">Información Reservada</Label>
                      <Textarea 
                        id="info_reservada" 
                        placeholder="Información interna y confidencial..."
                        rows={3}
                        value={formData.info_reservada}
                        onChange={handleInputChange}
                        className="bg-slate-900/80 border-slate-700 text-slate-100 placeholder:text-slate-500"
                      />
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
                        className="bg-slate-900/80 border-slate-700 text-slate-100"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="stock_fisico">Stock Físico</Label>
                      <Input 
                        id="stock_fisico" 
                        type="number" 
                        value={formData.stock_fisico}
                        onChange={handleInputChange}
                        className="bg-slate-900/80 border-slate-700 text-slate-100"
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