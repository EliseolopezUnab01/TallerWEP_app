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
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Nuevo Producto</h1>
          <p className="text-gray-600">Complete la información del producto</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Columna 1: Información del producto */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Información del Producto</CardTitle>
                  <CardDescription>Ingrese los datos básicos del producto</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
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
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="descripcion">Descripción</Label>
                      <Input 
                        id="descripcion" 
                        placeholder="Tipo de producto" 
                        value={formData.descripcion}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="marca">Marca del Producto</Label>
                      <Input 
                        id="marca" 
                        placeholder="Ej: MOOG, BOSCH, etc." 
                        value={formData.marca}
                        onChange={handleInputChange}
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
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="idprodpaquete">Código Paquete</Label>
                      <Input 
                        id="idprodpaquete" 
                        placeholder="Código del embalaje" 
                        value={formData.idprodpaquete}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="codigo_barras">Código de Barras</Label>
                      <Input 
                        id="codigo_barras" 
                        placeholder="Código QR o barras" 
                        value={formData.codigo_barras}
                        onChange={handleInputChange}
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
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="codarancel">Código Arancelario</Label>
                      <Input 
                        id="codarancel" 
                        placeholder="8708990000" 
                        value={formData.codarancel}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="capacidad">Capacidad</Label>
                      <Input 
                        id="capacidad" 
                        placeholder="Ej: 1 litro, 5 galones" 
                        value={formData.capacidad}
                        onChange={handleInputChange}
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
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="stock_fisico">Stock Físico</Label>
                      <Input 
                        id="stock_fisico" 
                        type="number" 
                        value={formData.stock_fisico}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Columna 2: Imágenes */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Imágenes del Producto</CardTitle>
                  <CardDescription>Máximo 10 imágenes</CardDescription>
                </CardHeader>
                <CardContent>
                  <ImageUpload onImagesChange={handleImagesChange} />
                </CardContent>
              </Card>

              {/* Botón de envío */}
              <Card>
                <CardContent className="p-6">
                  <Button 
                    type="submit" 
                    disabled={loading} 
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    size="lg"
                  >
                    {loading ? 'Guardando Producto...' : 'Guardar Producto'}
                  </Button>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    {images.length > 0 
                      ? `Se guardarán ${images.length} imágenes con el producto`
                      : 'Producto se guardará sin imágenes'
                    }
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}