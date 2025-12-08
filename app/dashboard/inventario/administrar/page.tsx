'use client';

import { DashboardLayout } from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Edit, Trash2, Eye, Package, Filter, Plus, X, Tags, Grid3X3 } from 'lucide-react';
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
  total_productos?: number;
}

export default function AdministrarProductoPage() {
  const [activeTab, setActiveTab] = useState<'productos' | 'categorias'>('productos');
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
  const [searchTermCategoria, setSearchTermCategoria] = useState('');

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
        // Calcular total de productos por categoría
        const categoriasConConteo = (categoriasData.categorias || []).map((categoria: Categoria) => ({
          ...categoria,
          total_productos: productosData.products?.filter((p: Producto) => p.idcategoria === categoria.idcategoria).length || 0
        }));
        setCategorias(categoriasConConteo);
      }
    } catch (error) {
      console.error('Error al cargar datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEliminarProducto = async (idprod: number) => {
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

  const handleEliminarCategoria = async (idcategoria: string) => {
    if (!confirm('¿Está seguro de que desea eliminar esta categoría? Los productos asociados quedarán sin categoría.')) {
      return;
    }

    try {
      const response = await fetch(`/api/categorias/${idcategoria}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok) {
        alert('Categoría eliminada exitosamente');
        cargarDatos();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error al eliminar categoría:', error);
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

  const categoriasFiltradas = categorias.filter(categoria => {
    return categoria.nombre.toLowerCase().includes(searchTermCategoria.toLowerCase()) ||
           categoria.idcategoria.toLowerCase().includes(searchTermCategoria.toLowerCase()) ||
           categoria.descripcion?.toLowerCase().includes(searchTermCategoria.toLowerCase());
  });

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-slate-200">Cargando productos...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 relative">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-50 tracking-tight">Administrar Productos</h1>
            <p className="text-sm text-slate-400">Gestiona todos los productos del inventario</p>
          </div>
          <div className="flex gap-2">
            {activeTab === 'productos' && (
              <Link href="/dashboard/inventario/nuevo">
                <Button className="bg-cyan-500 hover:bg-cyan-600 text-slate-950">
                  <Package className="h-4 w-4 mr-2" />
                  Nuevo Producto
                </Button>
              </Link>
            )}
            {activeTab === 'categorias' && (
              <Button 
                onClick={() => setShowModalCategoria(true)}
                className="bg-cyan-500 hover:bg-cyan-600 text-slate-950"
              >
                <Plus className="h-4 w-4 mr-2" />
                Nueva Categoría
              </Button>
            )}
          </div>
        </div>

        {/* Pestañas */}
        <div className="border-b border-slate-800">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('productos')}
              className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'productos'
                  ? 'border-cyan-500 text-cyan-400'
                  : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-600'
              }`}
            >
              <Package className="h-4 w-4 inline mr-2" />
              Productos
            </button>
            <button
              onClick={() => setActiveTab('categorias')}
              className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'categorias'
                  ? 'border-cyan-500 text-cyan-400'
                  : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-600'
              }`}
            >
              <Tags className="h-4 w-4 inline mr-2" />
              Categorías
            </button>
          </nav>
        </div>

        {/* Contenido de Productos */}
        {activeTab === 'productos' && (
          <>
            {/* Filtros y Búsqueda */}
            <Card className="bg-slate-900/80 border-slate-800 shadow-lg">
              <CardHeader>
                <CardTitle className="text-slate-200">Filtrar Productos</CardTitle>
                <CardDescription className="text-slate-400">Busca y filtra productos por categoría</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                    <Input
                      placeholder="Buscar por nombre, OE, marca..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 bg-slate-900/80 border-slate-700 text-slate-100 placeholder:text-slate-500"
                    />
                  </div>
                  <div className="sm:w-48">
                    <select
                      value={filterCategoria}
                      onChange={(e) => setFilterCategoria(e.target.value)}
                      className="w-full h-10 px-3 rounded-md border border-slate-700 bg-slate-900 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
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
                    className="border-slate-700 text-slate-300 hover:bg-slate-800"
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    Limpiar
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Estadísticas */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="bg-slate-900/80 border-slate-800 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-400">Total Productos</p>
                      <p className="text-2xl font-bold text-slate-50">{productos.length}</p>
                    </div>
                    <Package className="h-8 w-8 text-cyan-400" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-slate-900/80 border-slate-800 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-400">En Stock</p>
                      <p className="text-2xl font-bold text-green-600">
                        {productos.filter(p => p.stock_contable > 0).length}
                      </p>
                    </div>
                    <Package className="h-8 w-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-slate-900/80 border-slate-800 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-400">Sin Stock</p>
                      <p className="text-2xl font-bold text-red-600">
                        {productos.filter(p => p.stock_contable === 0).length}
                      </p>
                    </div>
                    <Package className="h-8 w-8 text-red-500" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-slate-900/80 border-slate-800 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-400">Categorías</p>
                      <p className="text-2xl font-bold text-purple-400">
                        {categorias.length}
                      </p>
                    </div>
                    <Tags className="h-8 w-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Lista de Productos */}
            <Card className="bg-slate-900/80 border-slate-800 shadow-xl">
              <CardHeader>
                <CardTitle className="text-slate-200">Lista de Productos</CardTitle>
                <CardDescription className="text-slate-400">
                  {productosFiltrados.length} de {productos.length} productos encontrados
                </CardDescription>
              </CardHeader>
              <CardContent>
                {productosFiltrados.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="mx-auto h-12 w-12 text-slate-500" />
                    <h3 className="mt-2 text-sm font-medium text-slate-100">No hay productos</h3>
                    <p className="mt-1 text-sm text-slate-400">
                      {productos.length === 0 
                        ? 'Comienza agregando tu primer producto.'
                        : 'No se encontraron productos con los filtros aplicados.'
                      }
                    </p>
                    {productos.length === 0 && (
                      <Link href="/dashboard/inventario/nuevo">
                        <Button className="mt-4 bg-cyan-500 hover:bg-cyan-600 text-slate-950">
                          <Package className="h-4 w-4 mr-2" />
                          Agregar Primer Producto
                        </Button>
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {productosFiltrados.map((producto) => (
                      <Card key={producto.idprod} className="overflow-hidden bg-slate-900/80 border-slate-800 shadow-lg hover:border-slate-700 transition-colors">
                        <div className="aspect-square relative bg-slate-900">
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
                              <Package className="h-12 w-12 text-slate-600" />
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
                            <h3 className="font-semibold text-lg line-clamp-2 text-slate-100">
                              {producto.nombre}
                            </h3>
                            
                            <div className="space-y-1 text-sm text-slate-300">
                              <p><strong className="text-slate-400">OE:</strong> {producto.OE}</p>
                              {producto.marca && <p><strong className="text-slate-400">Marca:</strong> {producto.marca}</p>}
                              {producto.descripcion && (
                                <p className="line-clamp-2 text-slate-400">{producto.descripcion}</p>
                              )}
                            </div>

                            <div className="flex flex-wrap gap-1">
                              {producto.idcategoria && (
                                <Badge variant="outline" className="text-xs border-slate-700 text-slate-300">
                                  {producto.categoria_nombre || producto.idcategoria}
                                </Badge>
                              )}
                            </div>

                            <div className="flex justify-between items-center pt-2">
                              <span className="text-xs text-slate-500">
                                {new Date(producto.created_at).toLocaleDateString()}
                              </span>
                              
                              <div className="flex gap-1">
                                <Link href={`/dashboard/inventario/perfil?id=${producto.idprod}`}>
                                  <Button variant="outline" size="sm" className="border-slate-700 text-slate-300 hover:bg-slate-800">
                                    <Eye className="h-3 w-3" />
                                  </Button>
                                </Link>
                                <Link href={`/dashboard/inventario/editar/${producto.idprod}`}>
                                  <Button variant="outline" size="sm" className="border-slate-700 text-slate-300 hover:bg-slate-800">
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                </Link>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10 border-red-500/40"
                                  onClick={() => handleEliminarProducto(producto.idprod)}
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
          </>
        )}

        {/* Contenido de Categorías */}
        {activeTab === 'categorias' && (
          <>
            {/* Búsqueda de Categorías */}
            <Card className="bg-slate-900/80 border-slate-800 shadow-lg">
              <CardHeader>
                <CardTitle className="text-slate-200">Buscar Categorías</CardTitle>
                <CardDescription className="text-slate-400">Encuentra y gestiona categorías del inventario</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                    <Input
                      placeholder="Buscar por nombre o código..."
                      value={searchTermCategoria}
                      onChange={(e) => setSearchTermCategoria(e.target.value)}
                      className="pl-10 bg-slate-900/80 border-slate-700 text-slate-100 placeholder:text-slate-500"
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setSearchTermCategoria('')}
                    className="border-slate-700 text-slate-300 hover:bg-slate-800"
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    Limpiar
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Estadísticas de Categorías */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-slate-900/80 border-slate-800 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-400">Total Categorías</p>
                      <p className="text-2xl font-bold text-slate-50">{categorias.length}</p>
                    </div>
                    <Tags className="h-8 w-8 text-cyan-400" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-slate-900/80 border-slate-800 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-400">Categorías Activas</p>
                      <p className="text-2xl font-bold text-green-600">
                        {categorias.filter(c => (c.total_productos || 0) > 0).length}
                      </p>
                    </div>
                    <Grid3X3 className="h-8 w-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-slate-900/80 border-slate-800 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-400">Categorías Vacías</p>
                      <p className="text-2xl font-bold text-slate-400">
                        {categorias.filter(c => (c.total_productos || 0) === 0).length}
                      </p>
                    </div>
                    <Tags className="h-8 w-8 text-slate-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Lista de Categorías */}
            <Card className="bg-slate-900/80 border-slate-800 shadow-xl">
              <CardHeader>
                <CardTitle className="text-slate-200">Lista de Categorías</CardTitle>
                <CardDescription className="text-slate-400">
                  {categoriasFiltradas.length} de {categorias.length} categorías encontradas
                </CardDescription>
              </CardHeader>
              <CardContent>
                {categoriasFiltradas.length === 0 ? (
                  <div className="text-center py-8">
                    <Tags className="mx-auto h-12 w-12 text-slate-500" />
                    <h3 className="mt-2 text-sm font-medium text-slate-100">No hay categorías</h3>
                    <p className="mt-1 text-sm text-slate-400">
                      {categorias.length === 0 
                        ? 'Comienza creando tu primera categoría.'
                        : 'No se encontraron categorías con los filtros aplicados.'
                      }
                    </p>
                    {categorias.length === 0 && (
                      <Button 
                        className="mt-4 bg-cyan-500 hover:bg-cyan-600 text-slate-950"
                        onClick={() => setShowModalCategoria(true)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Crear Primera Categoría
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {categoriasFiltradas.map((categoria) => (
                      <Card key={categoria.idcategoria} className="bg-slate-900/80 border-slate-800 shadow-lg hover:border-slate-700 transition-colors">
                        <CardContent className="p-6">
                          <div className="space-y-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <Badge variant="outline" className="mb-2 border-slate-700 text-slate-300">
                                  {categoria.idcategoria}
                                </Badge>
                                <h3 className="font-semibold text-lg text-slate-100">
                                  {categoria.nombre}
                                </h3>
                                {categoria.descripcion && (
                                  <p className="text-sm text-slate-400 mt-2 line-clamp-2">
                                    {categoria.descripcion}
                                  </p>
                                )}
                              </div>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 border-red-500/40"
                                onClick={() => handleEliminarCategoria(categoria.idcategoria)}
                                disabled={(categoria.total_productos || 0) > 0}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                            
                            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                              <span className="text-sm text-slate-500">
                                {(categoria.total_productos || 0)} productos
                              </span>
                              <Badge 
                                variant={
                                  (categoria.total_productos || 0) > 0 ? "default" : "secondary"
                                }
                                className={
                                  (categoria.total_productos || 0) > 0 
                                    ? 'bg-green-500 hover:bg-green-600' 
                                    : 'bg-slate-700 text-slate-400'
                                }
                              >
                                {(categoria.total_productos || 0) > 0 ? 'Activa' : 'Vacía'}
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Modal para Crear Categoría */}
        {showModalCategoria && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-md w-full shadow-2xl">
              <div className="flex items-center justify-between p-6 border-b border-slate-800">
                <h3 className="text-lg font-semibold text-slate-100">Nueva Categoría</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowModalCategoria(false)}
                  className="text-slate-400 hover:text-slate-300"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <form onSubmit={handleCrearCategoria} className="p-6 space-y-4">
                <div className="space-y-2">
                  <label htmlFor="idcategoria" className="text-sm font-medium text-slate-200">
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
                    className="uppercase bg-slate-900/80 border-slate-700 text-slate-100"
                  />
                  <p className="text-xs text-slate-400">
                    Máximo 6 caracteres. Ej: FRENOS, MOTOR
                  </p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="nombre" className="text-sm font-medium text-slate-200">
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
                    className="bg-slate-900/80 border-slate-700 text-slate-100"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="descripcion" className="text-sm font-medium text-slate-200">
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
                    className="w-full h-20 px-3 py-2 border border-slate-700 rounded-md bg-slate-900 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm resize-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowModalCategoria(false)}
                    className="border-slate-700 text-slate-300 hover:bg-slate-800"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={loadingCategoria}
                    className="bg-cyan-500 hover:bg-cyan-600 text-slate-950"
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