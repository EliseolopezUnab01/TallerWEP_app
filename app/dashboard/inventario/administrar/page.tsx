'use client';

import { DashboardLayout } from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Edit, Trash2, Eye, Package, Filter, Plus, X, LayoutGrid, List, FileDown, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { NotificationDropdown } from '@/components/notification-dropdown';
import { UserDropdown } from '@/components/user-dropdown';
import { generateCatalogPDF } from '@/lib/generate-catalog-pdf';

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
  grupo?: string;
  subgrupo?: string;
}

interface Categoria {
  idcategoria: string;
  nombre: string;
  descripcion?: string;
}

interface CategoriaNueva {
  idcategoria: number;
  nombre: string;
  descripcion?: string;
  activo?: number;
}

interface Grupo {
  id_grupo: number;
  codigo: string;
  nombre: string;
  descripcion?: string;
  idcategoria: number;
  categoria_nombre?: string;
}

interface Subgrupo {
  id_subgrupo: number;
  codigo: string;
  nombre: string;
  descripcion?: string;
  id_grupo: number;
  grupo_nombre?: string;
}


export default function AdministrarProductoPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  // Nuevos estados para el sistema jerárquico
  const [categoriasNuevas, setCategoriasNuevas] = useState<CategoriaNueva[]>([]);
  const [gruposDB, setGruposDB] = useState<Grupo[]>([]);
  const [subgruposDB, setSubgruposDB] = useState<Subgrupo[]>([]);
  const [grupos, setGrupos] = useState<string[]>([]);
  const [subgrupos, setSubgrupos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategoria, setFilterCategoria] = useState('');
  const [filterGrupo, setFilterGrupo] = useState('');
  const [filterSubgrupo, setFilterSubgrupo] = useState('');
  const [showModalCategoria, setShowModalCategoria] = useState(false);
  const [showModalGrupo, setShowModalGrupo] = useState(false);
  const [showModalSubgrupo, setShowModalSubgrupo] = useState(false);
  const [categoriaForm, setCategoriaForm] = useState({
    idcategoria: '',
    nombre: '',
    descripcion: ''
  });
  const [grupoForm, setGrupoForm] = useState({
    codigo: '',
    nombre: '',
    descripcion: '',
    idcategoria: 0
  });
  const [subgrupoForm, setSubgrupoForm] = useState({
    codigo: '',
    nombre: '',
    descripcion: '',
    id_grupo: 0
  });
  const [loadingCategoria, setLoadingCategoria] = useState(false);
  const [loadingGrupo, setLoadingGrupo] = useState(false);
  const [loadingSubgrupo, setLoadingSubgrupo] = useState(false);
  const [vistaTabla, setVistaTabla] = useState(false);
  const [activeTab, setActiveTab] = useState<'productos' | 'categorias'>('productos');
  const [categoriaSubTab, setCategoriaSubTab] = useState<'categorias' | 'grupos' | 'subgrupos'>('categorias');
  const [selectedCategoriaFilter, setSelectedCategoriaFilter] = useState<number | null>(null);
  const [generandoPDF, setGenerandoPDF] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      const [productosResponse, categoriasResponse, jerarquiaResponse] = await Promise.all([
        fetch('/api/productos'),
        fetch('/api/categorias'),
        fetch('/api/categorias-jerarquia')
      ]);

      const productosData = await productosResponse.json();
      const categoriasData = await categoriasResponse.json();
      const jerarquiaData = await jerarquiaResponse.json();

      if (productosResponse.ok) {
        const prods = productosData.products || [];
        setProductos(prods);
        
        // Extraer grupos y subgrupos únicos de los productos (para compatibilidad)
        const gruposUnicos = [...new Set(prods.map((p: any) => p.grupo).filter((g: string) => g && g.trim() !== ''))] as string[];
        const subgruposUnicos = [...new Set(prods.map((p: any) => p.subgrupo).filter((s: string) => s && s.trim() !== ''))] as string[];
        
        setGrupos(gruposUnicos.sort());
        setSubgrupos(subgruposUnicos.sort());
      }

      if (categoriasResponse.ok) {
        setCategorias(categoriasData.categorias || []);
      }

      // Cargar datos del sistema jerárquico
      if (jerarquiaResponse.ok) {
        setCategoriasNuevas(jerarquiaData.categorias || []);
        setGruposDB(jerarquiaData.grupos || []);
        setSubgruposDB(jerarquiaData.subgrupos || []);
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

  const handleDescargarCatalogo = async () => {
    setGenerandoPDF(true);
    try {
      await generateCatalogPDF(productos as any);
    } catch (error) {
      console.error('Error al generar catálogo:', error);
      alert('Error al generar el catálogo PDF');
    } finally {
      setGenerandoPDF(false);
    }
  };

  const handleCrearCategoria = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Usar el código auto-generado
    const codigo = parseInt(categoriaForm.idcategoria || getSiguienteCodigoCategoria());
    if (isNaN(codigo) || codigo < 10 || codigo > 99) {
      alert('No hay códigos de categoría disponibles (10-99 agotados)');
      return;
    }
    
    setLoadingCategoria(true);

    try {
      // Usar la API del nuevo sistema jerárquico
      const response = await fetch('/api/categorias-jerarquia', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tipo: 'categoria',
          idcategoria: codigo,
          nombre: categoriaForm.nombre,
          descripcion: categoriaForm.descripcion
        }),
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

  // Crear grupo en el sistema jerárquico
  const handleCrearGrupo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grupoForm.idcategoria) {
      alert('Debe seleccionar una categoría');
      return;
    }
    setLoadingGrupo(true);

    try {
      const response = await fetch('/api/categorias-jerarquia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'grupo',
          codigo: grupoForm.codigo.padStart(3, '0'),
          nombre: grupoForm.nombre,
          descripcion: grupoForm.descripcion,
          idcategoria: grupoForm.idcategoria
        }),
      });

      const data = await response.json();

      if (response.ok) {
        alert('Grupo creado exitosamente');
        setShowModalGrupo(false);
        setGrupoForm({ codigo: '', nombre: '', descripcion: '', idcategoria: 0 });
        cargarDatos();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error al crear grupo:', error);
      alert('Error al conectar con el servidor');
    } finally {
      setLoadingGrupo(false);
    }
  };

  // Crear subgrupo en el sistema jerárquico
  const handleCrearSubgrupo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subgrupoForm.id_grupo) {
      alert('Debe seleccionar un grupo');
      return;
    }
    setLoadingSubgrupo(true);

    try {
      const response = await fetch('/api/categorias-jerarquia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'subgrupo',
          codigo: subgrupoForm.codigo.padStart(3, '0'),
          nombre: subgrupoForm.nombre,
          descripcion: subgrupoForm.descripcion,
          id_grupo: subgrupoForm.id_grupo
        }),
      });

      const data = await response.json();

      if (response.ok) {
        alert('Subgrupo creado exitosamente');
        setShowModalSubgrupo(false);
        setSubgrupoForm({ codigo: '', nombre: '', descripcion: '', id_grupo: 0 });
        cargarDatos();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error al crear subgrupo:', error);
      alert('Error al conectar con el servidor');
    } finally {
      setLoadingSubgrupo(false);
    }
  };

  // Filtrar grupos por categoría seleccionada
  const gruposFiltradosPorCategoria = selectedCategoriaFilter
    ? gruposDB.filter(g => g.idcategoria === selectedCategoriaFilter)
    : gruposDB;

  // Función para eliminar categoría
  const handleEliminarCategoria = async (idcategoria: number) => {
    const gruposEnCategoria = gruposDB.filter(g => g.idcategoria === idcategoria).length;
    if (gruposEnCategoria > 0) {
      alert(`No se puede eliminar esta categoría porque tiene ${gruposEnCategoria} grupos asociados. Elimine primero los grupos.`);
      return;
    }
    if (!confirm('¿Está seguro de eliminar esta categoría?')) return;
    try {
      const response = await fetch(`/api/categorias-jerarquia?tipo=categoria&id=${idcategoria}`, { method: 'DELETE' });
      if (response.ok) {
        alert('Categoría eliminada');
        cargarDatos();
      } else {
        const data = await response.json();
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      alert('Error al eliminar');
    }
  };

  // Función para eliminar grupo
  const handleEliminarGrupo = async (id_grupo: number) => {
    if (!confirm('¿Está seguro de eliminar este grupo? Los subgrupos asociados también serán eliminados.')) return;
    try {
      const response = await fetch(`/api/categorias-jerarquia?tipo=grupo&id=${id_grupo}`, { method: 'DELETE' });
      if (response.ok) {
        alert('Grupo eliminado');
        cargarDatos();
      } else {
        const data = await response.json();
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      alert('Error al eliminar');
    }
  };

  // Función para eliminar subgrupo
  const handleEliminarSubgrupo = async (id_subgrupo: number) => {
    if (!confirm('¿Está seguro de eliminar este subgrupo?')) return;
    try {
      const response = await fetch(`/api/categorias-jerarquia?tipo=subgrupo&id=${id_subgrupo}`, { method: 'DELETE' });
      if (response.ok) {
        alert('Subgrupo eliminado');
        cargarDatos();
      } else {
        const data = await response.json();
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      alert('Error al eliminar');
    }
  };

  // Obtener siguiente código disponible para categoría (busca huecos)
  const getSiguienteCodigoCategoria = (): string => {
    const codigosUsados = new Set(categoriasNuevas.map(c => c.idcategoria));
    for (let i = 10; i <= 99; i++) {
      if (!codigosUsados.has(i)) {
        return String(i);
      }
    }
    return ''; // No hay códigos disponibles
  };

  // Obtener siguiente código disponible para grupo (busca huecos dentro de la categoría)
  const getSiguienteCodigoGrupo = (idcategoria: number): string => {
    const gruposDeCategoria = gruposDB.filter(g => g.idcategoria === idcategoria);
    const codigosUsados = new Set(gruposDeCategoria.map(g => parseInt(g.codigo) || 0));
    for (let i = 0; i <= 999; i++) {
      if (!codigosUsados.has(i)) {
        return String(i).padStart(3, '0');
      }
    }
    return ''; // No hay códigos disponibles
  };

  // Obtener siguiente código disponible para subgrupo (busca huecos dentro del grupo)
  const getSiguienteCodigoSubgrupo = (id_grupo: number): string => {
    const subgruposDeGrupo = subgruposDB.filter(s => s.id_grupo === id_grupo);
    const codigosUsados = new Set(subgruposDeGrupo.map(s => parseInt(s.codigo) || 0));
    for (let i = 0; i <= 999; i++) {
      if (!codigosUsados.has(i)) {
        return String(i).padStart(3, '0');
      }
    }
    return ''; // No hay códigos disponibles
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
          <div className="text-lg text-slate-200">Cargando productos...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-[#0a0f1a] p-6">
        <div className="space-y-6">
          {/* Navbar superior */}
          <div className="rounded-xl border border-[#0e88c9]/30 bg-[#0d1523] px-5 py-3 flex items-center justify-between gap-4 shadow-[0_0_25px_rgba(15,23,42,0.9)]">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Inventario</span>
              <span className="h-6 w-px bg-slate-700" />
              <span className="text-sm tracking-[0.18em] uppercase text-slate-200">Administrar Productos</span>
            </div>
            <div className="flex items-center gap-3">
              <NotificationDropdown />
              <UserDropdown />
            </div>
          </div>

          {/* Título y botones */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-50 tracking-tight">Administrar Inventario</h1>
              <p className="text-sm text-slate-400">Gestiona productos y categorías del sistema</p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline"
                className="border-amber-500/60 text-amber-400 hover:bg-amber-500/10"
                onClick={handleDescargarCatalogo}
                disabled={generandoPDF || productos.length === 0}
              >
                {generandoPDF ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileDown className="h-4 w-4 mr-2" />
                )}
                {generandoPDF ? 'Generando...' : 'Descargar Catálogo'}
              </Button>
              <Button 
                variant="outline"
                className="border-[#0e88c9]/60 text-[#0e88c9] hover:bg-[#0e88c9]/10"
                onClick={() => setShowModalCategoria(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nueva Categoría
              </Button>
              <Link href="/dashboard/inventario/nuevo">
                <Button className="border-[#0e88c9]/60 bg-[#0e88c9]/10 text-[#0e88c9] hover:bg-[#0e88c9]/20 rounded-full px-5">
                  <Package className="h-4 w-4 mr-2" />
                  Nuevo Producto
                </Button>
              </Link>
            </div>
          </div>

          {/* Pestañas */}
          <div className="flex items-center gap-4 border-b border-slate-700/40 pb-2">
            <button
              onClick={() => setActiveTab('productos')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all ${
                activeTab === 'productos'
                  ? 'text-[#0e88c9] border-b-2 border-[#0e88c9]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Package className="h-4 w-4" />
              Administrar Productos
            </button>
            <button
              onClick={() => setActiveTab('categorias')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all ${
                activeTab === 'categorias'
                  ? 'text-[#0e88c9] border-b-2 border-[#0e88c9]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Filter className="h-4 w-4" />
              Administrar Categorías
            </button>
          </div>

          {/* CONTENIDO PESTAÑA PRODUCTOS */}
          {activeTab === 'productos' && (
          <>
          {/* Estadísticas */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-[#141e2e] border border-[#0e88c9]/30 shadow-lg rounded-xl">
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
            <Card className="bg-[#141e2e] border border-[#0e88c9]/30 shadow-lg rounded-xl">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-400">En Stock</p>
                    <p className="text-2xl font-bold text-green-500">{productos.filter(p => p.stock_contable > 0).length}</p>
                  </div>
                  <Package className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[#141e2e] border border-[#0e88c9]/30 shadow-lg rounded-xl">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-400">Sin Stock</p>
                    <p className="text-2xl font-bold text-red-500">{productos.filter(p => p.stock_contable === 0).length}</p>
                  </div>
                  <Package className="h-8 w-8 text-red-500" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[#141e2e] border border-[#0e88c9]/30 shadow-lg rounded-xl">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-400">Categorías</p>
                    <p className="text-2xl font-bold text-purple-400">{categorias.length}</p>
                  </div>
                  <Filter className="h-8 w-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filtros y Búsqueda */}
          <Card className="bg-[#141e2e] border border-[#0e88c9]/30 shadow-lg rounded-xl">
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
                    className="pl-10 bg-slate-950/80 border-slate-700/40 text-slate-100 placeholder:text-slate-500"
                  />
                </div>
                <div className="sm:w-48">
                  <select
                    value={filterCategoria}
                    onChange={(e) => setFilterCategoria(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-slate-700/40 bg-slate-950/80 text-sm text-slate-100"
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
                  className="border-[#0e88c9]/60 text-[#0e88c9] hover:bg-[#0e88c9]/10"
                  onClick={() => { setSearchTerm(''); setFilterCategoria(''); }}
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Limpiar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Lista de Productos */}
          <Card className="bg-[#141e2e] border border-[#0e88c9]/30 shadow-lg rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-slate-200">Lista de Productos</CardTitle>
                <CardDescription className="text-slate-400">
                  {productosFiltrados.length} de {productos.length} productos encontrados
                </CardDescription>
              </div>
              {/* Toggle Vista Cards / Tabla */}
              <div className="flex items-center gap-1 bg-slate-900/50 rounded-full p-1">
                <button
                  onClick={() => setVistaTabla(false)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all ${
                    !vistaTabla ? 'bg-[#0e88c9] text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <LayoutGrid className="h-4 w-4" />
                  <span className="hidden sm:inline">Cards</span>
                </button>
                <button
                  onClick={() => setVistaTabla(true)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all ${
                    vistaTabla ? 'bg-[#0e88c9] text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <List className="h-4 w-4" />
                  <span className="hidden sm:inline">Tabla</span>
                </button>
              </div>
            </CardHeader>
            <CardContent>
              {productosFiltrados.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="mx-auto h-12 w-12 text-slate-500" />
                  <h3 className="mt-2 text-sm font-medium text-slate-100">No hay productos</h3>
                  <p className="mt-1 text-sm text-slate-400">
                    {productos.length === 0 ? 'Comienza agregando tu primer producto.' : 'No se encontraron productos con los filtros aplicados.'}
                  </p>
                </div>
              ) : vistaTabla ? (
                /* Vista Tabla Compacta */
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left py-3 px-2 text-slate-400 font-medium">ID</th>
                        <th className="text-left py-3 px-2 text-slate-400 font-medium">Foto</th>
                        <th className="text-left py-3 px-2 text-slate-400 font-medium">Nombre</th>
                        <th className="text-left py-3 px-2 text-slate-400 font-medium">OE</th>
                        <th className="text-left py-3 px-2 text-slate-400 font-medium">Categoría</th>
                        <th className="text-left py-3 px-2 text-slate-400 font-medium">Stock</th>
                        <th className="text-left py-3 px-2 text-slate-400 font-medium">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productosFiltrados.map((producto) => (
                        <tr key={producto.idprod} className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                          <td className="py-2 px-2 text-slate-300">{producto.idprod}</td>
                          <td className="py-2 px-2">
                            <div className="w-10 h-10 relative bg-slate-900 rounded overflow-hidden">
                              {producto.imagen_principal ? (
                                <Image src={producto.imagen_principal} alt={producto.nombre} fill className="object-cover" sizes="40px" />
                              ) : (
                                <div className="flex items-center justify-center h-full"><Package className="h-4 w-4 text-slate-600" /></div>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-2 text-slate-200 max-w-[200px] truncate">{producto.nombre}</td>
                          <td className="py-2 px-2 text-slate-300">{producto.OE}</td>
                          <td className="py-2 px-2"><Badge variant="outline" className="text-xs">{producto.categoria_nombre || producto.idcategoria || '-'}</Badge></td>
                          <td className="py-2 px-2">
                            <span className={`font-medium ${producto.stock_contable > 0 ? 'text-green-400' : 'text-red-400'}`}>{producto.stock_contable}</span>
                          </td>
                          <td className="py-2 px-2">
                            <div className="flex gap-1">
                              <Link href={`/dashboard/inventario/perfil?id=${producto.idprod}`}>
                                <Button variant="outline" size="sm" className="h-7 px-2 border-cyan-500/30 text-cyan-300"><Eye className="h-3 w-3" /></Button>
                              </Link>
                              <Link href={`/dashboard/inventario/editar-producto?id=${producto.idprod}`}>
                                <Button variant="outline" size="sm" className="h-7 px-2 border-cyan-500/30 text-cyan-300"><Edit className="h-3 w-3" /></Button>
                              </Link>
                              <Button variant="outline" size="sm" className="h-7 px-2 text-red-400 border-red-500/40" onClick={() => handleEliminar(producto.idprod)}><Trash2 className="h-3 w-3" /></Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                /* Vista Cards */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {productosFiltrados.map((producto) => (
                    <Card key={producto.idprod} className="overflow-hidden bg-[#0d1523] border border-[#0e88c9]/20 shadow-md rounded-xl transition-all hover:shadow-xl">
                      <div className="aspect-square relative bg-slate-900">
                        {producto.imagen_principal ? (
                          <Image src={producto.imagen_principal} alt={producto.nombre} fill className="object-cover" sizes="(max-width: 768px) 100vw, 25vw" />
                        ) : (
                          <div className="flex items-center justify-center h-full"><Package className="h-12 w-12 text-slate-600" /></div>
                        )}
                        <Badge className={`absolute top-2 right-2 ${producto.stock_contable > 0 ? 'bg-green-500' : 'bg-red-500'}`}>
                          {producto.stock_contable} en stock
                        </Badge>
                      </div>
                      <CardContent className="p-3">
                        <h3 className="font-semibold text-sm line-clamp-1 text-slate-100 mb-1">{producto.nombre}</h3>
                        <p className="text-xs text-slate-400 mb-2">OE: {producto.OE}</p>
                        <div className="flex gap-1">
                          <Link href={`/dashboard/inventario/perfil?id=${producto.idprod}`}>
                            <Button variant="outline" size="sm" className="h-7 px-2 border-cyan-500/30 text-cyan-300"><Eye className="h-3 w-3" /></Button>
                          </Link>
                          <Link href={`/dashboard/inventario/editar-producto?id=${producto.idprod}`}>
                            <Button variant="outline" size="sm" className="h-7 px-2 border-cyan-500/30 text-cyan-300"><Edit className="h-3 w-3" /></Button>
                          </Link>
                          <Button variant="outline" size="sm" className="h-7 px-2 text-red-400 border-red-500/40" onClick={() => handleEliminar(producto.idprod)}><Trash2 className="h-3 w-3" /></Button>
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

          {/* CONTENIDO PESTAÑA CATEGORÍAS */}
          {activeTab === 'categorias' && (
          <>
          {/* Estadísticas de Categorías - Usando el nuevo sistema jerárquico */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-[#141e2e] border border-[#0e88c9]/30 shadow-lg rounded-xl">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-400">Total Categorías</p>
                    <p className="text-2xl font-bold text-slate-50">{categoriasNuevas.length}</p>
                  </div>
                  <Filter className="h-8 w-8 text-cyan-400" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[#141e2e] border border-[#0e88c9]/30 shadow-lg rounded-xl">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-400">Total Grupos</p>
                    <p className="text-2xl font-bold text-green-500">{gruposDB.length}</p>
                  </div>
                  <Package className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[#141e2e] border border-[#0e88c9]/30 shadow-lg rounded-xl">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-400">Total Subgrupos</p>
                    <p className="text-2xl font-bold text-purple-500">{subgruposDB.length}</p>
                  </div>
                  <Filter className="h-8 w-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sub-pestañas: Categorías, Grupos, Subgrupos */}
          <div className="flex items-center gap-2 bg-[#141e2e] border border-[#0e88c9]/30 rounded-xl p-2">
            <button
              onClick={() => setCategoriaSubTab('categorias')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                categoriaSubTab === 'categorias'
                  ? 'bg-[#0e88c9] text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              Categorías ({categoriasNuevas.length})
            </button>
            <button
              onClick={() => setCategoriaSubTab('grupos')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                categoriaSubTab === 'grupos'
                  ? 'bg-[#0e88c9] text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              Grupos ({gruposDB.length})
            </button>
            <button
              onClick={() => setCategoriaSubTab('subgrupos')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                categoriaSubTab === 'subgrupos'
                  ? 'bg-[#0e88c9] text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              Subgrupos ({subgruposDB.length})
            </button>
            <div className="flex-1" />
            {categoriaSubTab === 'grupos' && (
              <Button
                variant="outline"
                size="sm"
                className="border-green-500/60 text-green-400 hover:bg-green-500/10"
                onClick={() => setShowModalGrupo(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Nuevo Grupo
              </Button>
            )}
            {categoriaSubTab === 'subgrupos' && (
              <Button
                variant="outline"
                size="sm"
                className="border-purple-500/60 text-purple-400 hover:bg-purple-500/10"
                onClick={() => setShowModalSubgrupo(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Nuevo Subgrupo
              </Button>
            )}
            {categoriaSubTab === 'categorias' && (
              <Button
                variant="outline"
                size="sm"
                className="border-[#0e88c9]/60 text-[#0e88c9] hover:bg-[#0e88c9]/10"
                onClick={() => setShowModalCategoria(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Nueva Categoría
              </Button>
            )}
          </div>

          {/* Lista de Categorías - Usando el nuevo sistema numérico */}
          {categoriaSubTab === 'categorias' && (
          <Card className="bg-[#141e2e] border border-[#0e88c9]/30 shadow-lg rounded-xl">
            <CardHeader>
              <CardTitle className="text-slate-200">Lista de Categorías</CardTitle>
              <CardDescription className="text-slate-400">Sistema jerárquico: Categoría → Grupo → Subgrupo</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {categoriasNuevas.map(categoria => {
                  const gruposEnCategoria = gruposDB.filter(g => g.idcategoria === categoria.idcategoria).length;
                  return (
                    <Card key={categoria.idcategoria} className="bg-[#0d1523] border border-slate-700/40 rounded-xl hover:border-[#0e88c9]/50 transition-all">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <span className="text-lg font-bold text-[#0e88c9] bg-[#0e88c9]/10 px-3 py-1 rounded">{categoria.idcategoria}</span>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-slate-500 hover:text-red-400"
                            onClick={() => handleEliminarCategoria(categoria.idcategoria)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <h3 className="font-semibold text-slate-100 mb-2">{categoria.nombre}</h3>
                        <p className="text-xs text-slate-500 mb-3">{gruposEnCategoria} grupos</p>
                        <Badge 
                          variant="outline" 
                          className={gruposEnCategoria > 0 
                            ? 'bg-green-500/10 text-green-400 border-green-500/30' 
                            : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                          }
                        >
                          {gruposEnCategoria > 0 ? `${gruposEnCategoria} grupos` : 'Sin grupos'}
                        </Badge>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
          )}

          {/* Lista de Grupos - Usando el nuevo sistema */}
          {categoriaSubTab === 'grupos' && (
          <Card className="bg-[#141e2e] border border-[#0e88c9]/30 shadow-lg rounded-xl">
            <CardHeader>
              <CardTitle className="text-slate-200">Lista de Grupos</CardTitle>
              <CardDescription className="text-slate-400">Grupos organizados por categoría</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filtro por categoría */}
              <div className="mb-4 flex items-center gap-2">
                <span className="text-sm text-slate-400">Filtrar por categoría:</span>
                <select
                  value={selectedCategoriaFilter || ''}
                  onChange={(e) => setSelectedCategoriaFilter(e.target.value ? Number(e.target.value) : null)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200"
                >
                  <option value="">Todas las categorías</option>
                  {categoriasNuevas.map(c => (
                    <option key={c.idcategoria} value={c.idcategoria}>{c.idcategoria} - {c.nombre}</option>
                  ))}
                </select>
              </div>
              {gruposFiltradosPorCategoria.length === 0 ? (
                <div className="text-center py-8">
                  <Filter className="mx-auto h-12 w-12 text-slate-500" />
                  <h3 className="mt-2 text-sm font-medium text-slate-100">No hay grupos</h3>
                  <p className="mt-1 text-sm text-slate-400">Crea grupos usando el botón "Nuevo Grupo"</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {gruposFiltradosPorCategoria.map(grupo => {
                    const subgruposEnGrupo = subgruposDB.filter(s => s.id_grupo === grupo.id_grupo).length;
                    const categoriaNombre = categoriasNuevas.find(c => c.idcategoria === grupo.idcategoria)?.nombre || '';
                    return (
                      <Card key={grupo.id_grupo} className="bg-[#0d1523] border border-slate-700/40 rounded-xl hover:border-green-500/50 transition-all">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-mono text-green-400 bg-green-500/10 px-2 py-1 rounded">{grupo.codigo}</span>
                              <span className="text-xs text-slate-500">Cat: {grupo.idcategoria}</span>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6 text-slate-500 hover:text-red-400"
                              onClick={() => handleEliminarGrupo(grupo.id_grupo)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                          <h3 className="font-semibold text-slate-100 mb-1">{grupo.nombre}</h3>
                          <p className="text-xs text-slate-500 mb-3">{categoriaNombre}</p>
                          <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30">
                            {subgruposEnGrupo} subgrupos
                          </Badge>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
          )}

          {/* Lista de Subgrupos - Usando el nuevo sistema */}
          {categoriaSubTab === 'subgrupos' && (
          <Card className="bg-[#141e2e] border border-[#0e88c9]/30 shadow-lg rounded-xl">
            <CardHeader>
              <CardTitle className="text-slate-200">Lista de Subgrupos</CardTitle>
              <CardDescription className="text-slate-400">Subgrupos organizados por grupo</CardDescription>
            </CardHeader>
            <CardContent>
              {subgruposDB.length === 0 ? (
                <div className="text-center py-8">
                  <Filter className="mx-auto h-12 w-12 text-slate-500" />
                  <h3 className="mt-2 text-sm font-medium text-slate-100">No hay subgrupos</h3>
                  <p className="mt-1 text-sm text-slate-400">Crea subgrupos usando el botón "Nuevo Subgrupo"</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {subgruposDB.map(subgrupo => {
                    const grupo = gruposDB.find(g => g.id_grupo === subgrupo.id_grupo);
                    const categoria = grupo ? categoriasNuevas.find(c => c.idcategoria === grupo.idcategoria) : null;
                    return (
                      <Card key={subgrupo.id_subgrupo} className="bg-[#0d1523] border border-slate-700/40 rounded-xl hover:border-purple-500/50 transition-all">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-mono text-purple-400 bg-purple-500/10 px-2 py-1 rounded">{subgrupo.codigo}</span>
                              <span className="text-xs text-slate-500">Grupo: {grupo?.codigo || '-'}</span>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6 text-slate-500 hover:text-red-400"
                              onClick={() => handleEliminarSubgrupo(subgrupo.id_subgrupo)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                          <h3 className="font-semibold text-slate-100 mb-1">{subgrupo.nombre}</h3>
                          <p className="text-xs text-slate-500 mb-3">{grupo?.nombre || '-'} → {categoria?.nombre || '-'}</p>
                          <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30">
                            Subgrupo
                          </Badge>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
          )}
          </>
          )}

          {/* Modal para Crear Categoría */}
          {showModalCategoria && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
              <div className="bg-slate-950/95 border border-cyan-700/40 rounded-xl max-w-md w-full shadow-xl">
                <div className="flex items-center justify-between p-6 border-b border-slate-800/30">
                  <h3 className="text-lg font-semibold text-slate-100">Nueva Categoría</h3>
                  <Button variant="ghost" size="icon" onClick={() => {
                    setShowModalCategoria(false);
                    setCategoriaForm({ idcategoria: '', nombre: '', descripcion: '' });
                  }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                
                <form onSubmit={handleCrearCategoria} className="p-6 space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="idcategoria" className="text-sm font-medium text-slate-200">Código de Categoría (auto-generado)</label>
                    <Input
                      id="idcategoria"
                      value={categoriaForm.idcategoria || getSiguienteCodigoCategoria()}
                      readOnly
                      className="bg-slate-950/80 border-slate-700/40 text-slate-100"
                    />
                    <p className="text-xs text-slate-500">
                      {getSiguienteCodigoCategoria() 
                        ? `Siguiente código disponible: ${getSiguienteCodigoCategoria()}` 
                        : '⚠️ No hay códigos disponibles (10-99 agotados)'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="nombre" className="text-sm font-medium text-slate-200">Nombre de la Categoría *</label>
                    <Input
                      id="nombre"
                      placeholder="Ej: Sistema de Frenos"
                      value={categoriaForm.nombre}
                      onChange={(e) => setCategoriaForm(prev => ({ ...prev, nombre: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="descripcion" className="text-sm font-medium text-slate-200">Descripción</label>
                    <textarea
                      id="descripcion"
                      placeholder="Descripción opcional..."
                      value={categoriaForm.descripcion}
                      onChange={(e) => setCategoriaForm(prev => ({ ...prev, descripcion: e.target.value }))}
                      className="w-full h-20 px-3 py-2 border border-slate-700/40 rounded-md bg-slate-950/80 text-slate-100 text-sm resize-none"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="outline" className="border-[#0e88c9]/60 text-[#0e88c9]" onClick={() => setShowModalCategoria(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={loadingCategoria} className="bg-[#0e88c9]/10 text-[#0e88c9] border-[#0e88c9]/60 rounded-full">
                      {loadingCategoria ? 'Creando...' : 'Crear Categoría'}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Modal para Crear Grupo */}
          {showModalGrupo && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
              <div className="bg-slate-950/95 border border-green-700/40 rounded-xl max-w-md w-full shadow-xl">
                <div className="flex items-center justify-between p-6 border-b border-slate-800/30">
                  <h3 className="text-lg font-semibold text-slate-100">Nuevo Grupo</h3>
                  <Button variant="ghost" size="icon" onClick={() => setShowModalGrupo(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                
                <form onSubmit={handleCrearGrupo} className="p-6 space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-200">Categoría *</label>
                    <select
                      value={grupoForm.idcategoria || ''}
                      onChange={(e) => {
                        const idcat = Number(e.target.value);
                        const siguienteCodigo = idcat ? getSiguienteCodigoGrupo(idcat) : '';
                        setGrupoForm(prev => ({ ...prev, idcategoria: idcat, codigo: siguienteCodigo }));
                      }}
                      required
                      className="w-full bg-slate-950/80 border border-slate-700/40 rounded-md px-3 py-2 text-slate-100"
                    >
                      <option value="">Seleccione una categoría</option>
                      {categoriasNuevas.map(c => (
                        <option key={c.idcategoria} value={c.idcategoria}>{c.idcategoria} - {c.nombre}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-200">Código del Grupo (auto-generado)</label>
                    <Input
                      placeholder="Se genera automáticamente"
                      value={grupoForm.codigo}
                      onChange={(e) => setGrupoForm(prev => ({ ...prev, codigo: e.target.value.replace(/\D/g, '').slice(0, 3) }))}
                      maxLength={3}
                      className="bg-slate-950/80 border-slate-700/40 text-slate-100"
                      readOnly
                    />
                    <p className="text-xs text-slate-500">El código se genera automáticamente al seleccionar la categoría</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-200">Nombre del Grupo *</label>
                    <Input
                      placeholder="Ej: Bomba de Inyección"
                      value={grupoForm.nombre}
                      onChange={(e) => setGrupoForm(prev => ({ ...prev, nombre: e.target.value }))}
                      required
                      className="bg-slate-950/80 border-slate-700/40 text-slate-100"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="outline" className="border-green-500/60 text-green-400" onClick={() => setShowModalGrupo(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={loadingGrupo} className="bg-green-500/10 text-green-400 border-green-500/60 rounded-full">
                      {loadingGrupo ? 'Creando...' : 'Crear Grupo'}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Modal para Crear Subgrupo */}
          {showModalSubgrupo && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
              <div className="bg-slate-950/95 border border-purple-700/40 rounded-xl max-w-md w-full shadow-xl">
                <div className="flex items-center justify-between p-6 border-b border-slate-800/30">
                  <h3 className="text-lg font-semibold text-slate-100">Nuevo Subgrupo</h3>
                  <Button variant="ghost" size="icon" onClick={() => setShowModalSubgrupo(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                
                <form onSubmit={handleCrearSubgrupo} className="p-6 space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-200">Categoría</label>
                    <select
                      value={selectedCategoriaFilter || ''}
                      onChange={(e) => {
                        setSelectedCategoriaFilter(e.target.value ? Number(e.target.value) : null);
                        setSubgrupoForm(prev => ({ ...prev, id_grupo: 0 }));
                      }}
                      className="w-full bg-slate-950/80 border border-slate-700/40 rounded-md px-3 py-2 text-slate-100"
                    >
                      <option value="">Seleccione una categoría</option>
                      {categoriasNuevas.map(c => (
                        <option key={c.idcategoria} value={c.idcategoria}>{c.idcategoria} - {c.nombre}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-200">Grupo *</label>
                    <select
                      value={subgrupoForm.id_grupo || ''}
                      onChange={(e) => {
                        const idGrupo = Number(e.target.value);
                        const siguienteCodigo = idGrupo ? getSiguienteCodigoSubgrupo(idGrupo) : '';
                        setSubgrupoForm(prev => ({ ...prev, id_grupo: idGrupo, codigo: siguienteCodigo }));
                      }}
                      required
                      className="w-full bg-slate-950/80 border border-slate-700/40 rounded-md px-3 py-2 text-slate-100"
                    >
                      <option value="">Seleccione un grupo</option>
                      {gruposFiltradosPorCategoria.map(g => (
                        <option key={g.id_grupo} value={g.id_grupo}>{g.codigo} - {g.nombre}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-200">Código del Subgrupo (auto-generado)</label>
                    <Input
                      placeholder="Se genera automáticamente"
                      value={subgrupoForm.codigo}
                      onChange={(e) => setSubgrupoForm(prev => ({ ...prev, codigo: e.target.value.replace(/\D/g, '').slice(0, 3) }))}
                      maxLength={3}
                      className="bg-slate-950/80 border-slate-700/40 text-slate-100"
                      readOnly
                    />
                    <p className="text-xs text-slate-500">El código se genera automáticamente al seleccionar el grupo</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-200">Nombre del Subgrupo *</label>
                    <Input
                      placeholder="Ej: Sellos"
                      value={subgrupoForm.nombre}
                      onChange={(e) => setSubgrupoForm(prev => ({ ...prev, nombre: e.target.value }))}
                      required
                      className="bg-slate-950/80 border-slate-700/40 text-slate-100"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="outline" className="border-purple-500/60 text-purple-400" onClick={() => setShowModalSubgrupo(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={loadingSubgrupo} className="bg-purple-500/10 text-purple-400 border-purple-500/60 rounded-full">
                      {loadingSubgrupo ? 'Creando...' : 'Crear Subgrupo'}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </div>
      </div>
    </DashboardLayout>
  );
}
