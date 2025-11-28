'use client';

import { DashboardLayout } from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Edit, Trash2, Eye, Package, Filter, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

interface Producto {
  idprod: number;
  nombre: string;
  descripcion: string;
  marca: string;
  OE: string;
  idcategoria: string;
  categoria_nombre: string;
  stock_contable: number;
  stock_fisico: number;
  imagen_principal: string;
  created_at: string;
}

interface Categoria {
  idcategoria: string;
  nombre: string;
  descripcion?: string;
}

export default function AdministrarProductoPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategoria, setFilterCategoria] = useState('');
  const [showModalCategoria, setShowModalCategoria] = useState(false);
  const [categoriaForm, setCategoriaForm] = useState({
    idcategoria: '',
    nombre: '',
    descripcion: ''
  });
  const [loadingCategoria, setLoadingCategoria] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      const [productosResponse, categoriasResponse] = await Promise.all([
        fetch('/api/productos'),
        fetch('/api/categorias')
      ]);

      const productosData = await productosResponse.json();
      const categoriasData = await categoriasResponse.json();

      if (productosResponse.ok) {
        setProductos(productosData.products || []);
      }

      if (categoriasResponse.ok) {
        setCategorias(categoriasData.categorias || []);
      }
    } catch (error) {
      console.error('Error al cargar datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEliminar = async (idprod: number) => {
    if (!confirm('¿Está seguro de que desea eliminar este producto?')) {
      return;
    }

    try {
      const response = await fetch(`/api/productos/${idprod}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        alert('Producto eliminado exitosamente');
        cargarDatos();
      } else {
        const data = await response.json();
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error al eliminar producto:', error);
      alert('Error al conectar con el servidor');
    }
  };

  const handleCrearCategoria = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingCategoria(true);

    try {
      const response = await fetch('/api/categorias', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(categoriaForm),
      });

      const data = await response.json();

      if (response.ok) {
        alert('Categoría creada exitosamente');
        setShowModalCategoria(false);
        setCategoriaForm({ idcategoria: '', nombre: '', descripcion: '' });
        cargarDatos();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error al crear categoría:', error);
      alert('Error al conectar con el servidor');
    } finally {
      setLoadingCategoria(false);
    }
  };

  const productosFiltrados = productos.filter(producto => {
    const coincideBusqueda = 
      producto.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      producto.OE.toLowerCase().includes(searchTerm.toLowerCase()) ||
      producto.marca?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      producto.descripcion?.toLowerCase().includes(searchTerm.toLowerCase());

    const coincideCategoria = !filterCategoria || producto.idcategoria === filterCategoria;

    return coincideBusqueda && coincideCategoria;
  });

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Cargando productos...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 relative">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Administrar Productos</h1>
            <p className="text-gray-600">Gestiona todos los productos del inventario</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={() => setShowModalCategoria(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Nueva Categoría
            </Button>
            <Link href="/dashboard/inventario/nuevo">
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Package className="h-4 w-4 mr-2" />
                Nuevo Producto
              </Button>
            </Link>
          </div>
        </div>

        {/* Filtros y Búsqueda */}
        <Card>
          <CardHeader>
            <CardTitle>Filtrar Productos</CardTitle>
            <CardDescription>Busca y filtra productos por categoría</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar por nombre, OE, marca..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="sm:w-48">
                <select
                  value={filterCategoria}
                  onChange={(e) => setFilterCategoria(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todas las categorías</option>
                  {categorias.map(categoria => (
                    <option key={categoria.idcategoria} value={categoria.idcategoria}>
                      {categoria.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm('');
                  setFilterCategoria('');
                }}
              >
                <Filter className="h-4 w-4 mr-2" />
                Limpiar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Productos</p>
                  <p className="text-2xl font-bold">{productos.length}</p>
                </div>
                <Package className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">En Stock</p>
                  <p className="text-2xl font-bold text-green-600">
                    {productos.filter(p => p.stock_contable > 0).length}
                  </p>
                </div>
                <Package className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Sin Stock</p>
                  <p className="text-2xl font-bold text-red-600">
                    {productos.filter(p => p.stock_contable === 0).length}
                  </p>
                </div>
                <Package className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Categorías</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {categorias.length}
                  </p>
                </div>
                <Filter className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Productos */}
        <Card>
          <CardHeader>
            <CardTitle>Lista de Productos</CardTitle>
            <CardDescription>
              {productosFiltrados.length} de {productos.length} productos encontrados
            </CardDescription>
          </CardHeader>
          <CardContent>
            {productosFiltrados.length === 0 ? (
              <div className="text-center py-8">
                <Package className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No hay productos</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {productos.length === 0 
                    ? 'Comienza agregando tu primer producto.'
                    : 'No se encontraron productos con los filtros aplicados.'
                  }
                </p>
                {productos.length === 0 && (
                  <Link href="/dashboard/inventario/nuevo">
                    <Button className="mt-4 bg-blue-600 hover:bg-blue-700">
                      <Package className="h-4 w-4 mr-2" />
                      Agregar Primer Producto
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {productosFiltrados.map((producto) => (
                  <Card key={producto.idprod} className="overflow-hidden">
                    <div className="aspect-square relative bg-gray-100">
                      {producto.imagen_principal ? (
                        <Image
                          src={producto.imagen_principal}
                          alt={producto.nombre}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <Package className="h-12 w-12 text-gray-400" />
                        </div>
                      )}
                      <Badge 
                        className={`absolute top-2 right-2 ${
                          producto.stock_contable > 0 
                            ? 'bg-green-500 hover:bg-green-600' 
                            : 'bg-red-500 hover:bg-red-600'
                        }`}
                      >
                        {producto.stock_contable} en stock
                      </Badge>
                    </div>
                    
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <h3 className="font-semibold text-lg line-clamp-2">
                          {producto.nombre}
                        </h3>
                        
                        <div className="space-y-1 text-sm text-gray-600">
                          <p><strong>OE:</strong> {producto.OE}</p>
                          {producto.marca && <p><strong>Marca:</strong> {producto.marca}</p>}
                          {producto.descripcion && (
                            <p className="line-clamp-2">{producto.descripcion}</p>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-1">
                          {producto.idcategoria && (
                            <Badge variant="outline" className="text-xs">
                              {producto.categoria_nombre || producto.idcategoria}
                            </Badge>
                          )}
                        </div>

                        <div className="flex justify-between items-center pt-2">
                          <span className="text-xs text-gray-500">
                            {new Date(producto.created_at).toLocaleDateString()}
                          </span>
                          
                          <div className="flex gap-1">
                            <Link href={`/dashboard/inventario/editar/${producto.idprod}`}>
                              <Button variant="outline" size="sm">
                                <Eye className="h-3 w-3" />
                              </Button>
                            </Link>
                            <Link href={`/dashboard/inventario/editar/${producto.idprod}`}>
                              <Button variant="outline" size="sm">
                                <Edit className="h-3 w-3" />
                              </Button>
                            </Link>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleEliminar(producto.idprod)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal para Crear Categoría - SIMPLIFICADO */}
        {showModalCategoria && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full">
              <div className="flex items-center justify-between p-6 border-b">
                <h3 className="text-lg font-semibold">Nueva Categoría</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowModalCategoria(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <form onSubmit={handleCrearCategoria} className="p-6 space-y-4">
                <div className="space-y-2">
                  <label htmlFor="idcategoria" className="text-sm font-medium">
                    Código de Categoría *
                  </label>
                  <Input
                    id="idcategoria"
                    placeholder="Ej: FRENOS, MOTOR, SUSPEN"
                    value={categoriaForm.idcategoria}
                    onChange={(e) => setCategoriaForm(prev => ({
                      ...prev,
                      idcategoria: e.target.value.toUpperCase()
                    }))}
                    required
                    maxLength={6}
                    className="uppercase"
                  />
                  <p className="text-xs text-gray-500">
                    Máximo 6 caracteres. Ej: FRENOS, MOTOR
                  </p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="nombre" className="text-sm font-medium">
                    Nombre de la Categoría *
                  </label>
                  <Input
                    id="nombre"
                    placeholder="Ej: Sistema de Frenos"
                    value={categoriaForm.nombre}
                    onChange={(e) => setCategoriaForm(prev => ({
                      ...prev,
                      nombre: e.target.value
                    }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="descripcion" className="text-sm font-medium">
                    Descripción
                  </label>
                  <textarea
                    id="descripcion"
                    placeholder="Descripción opcional de la categoría..."
                    value={categoriaForm.descripcion}
                    onChange={(e) => setCategoriaForm(prev => ({
                      ...prev,
                      descripcion: e.target.value
                    }))}
                    className="w-full h-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowModalCategoria(false)}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={loadingCategoria}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {loadingCategoria ? 'Creando...' : 'Crear Categoría'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}