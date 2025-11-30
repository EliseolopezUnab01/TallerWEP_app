"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Package, Edit, ArrowLeft, Tag, Search, Bell, UserCircle2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function PerfilProductoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const idParam = searchParams.get("id");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [producto, setProducto] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searching, setSearching] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Datos de ejemplo solo para campos que aún no existen en BD
  const mockInfoReservada =
    "Margen de ganancia mínimo 18%. Revisar disponibilidad con proveedor antes de ofertas masivas.";

  useEffect(() => {
    const fetchProducto = async () => {
      if (!idParam) {
        setError("No se proporcionó un ID de producto en la URL.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/productos");
        if (!res.ok) {
          throw new Error("No se pudieron obtener los productos");
        }

        const data = await res.json();
        const idNumber = Number(idParam);
        const found = Array.isArray(data.products)
          ? data.products.find((p: any) => p.idprod === idNumber)
          : null;

        if (!found) {
          setError("Producto no encontrado.");
        } else {
          setProducto(found);
        }
      } catch (err) {
        setError("Error al cargar el producto.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchProducto();
  }, [idParam]);

  const etiquetasArray: string[] = producto?.etiquetas
    ? String(producto.etiquetas)
        .split(",")
        .map((t: string) => t.trim())
        .filter(Boolean)
    : ["suspensión", "deportivo", "delantero", "toyota"]; // fallback

  const imagenPrincipal = producto?.imagen_principal || "/window.svg";
  const images: string[] =
    producto && Array.isArray((producto as any).imagenes) && (producto as any).imagenes.length > 0
      ? ((producto as any).imagenes as string[])
      : [imagenPrincipal];
  const totalImages = images.length;
  const safeIndex = totalImages > 0 ? Math.min(currentImageIndex, totalImages - 1) : 0;
  const currentImage = images[totalImages > 0 ? safeIndex : 0];
  const referenciasDirectas = producto?.info_referencias_directas
    ? String(producto.info_referencias_directas).split("\n").filter((l: string) => l.trim() !== "")
    : [];
  const referenciasIndirectas = producto?.info_referencias_indirectas
    ? String(producto.info_referencias_indirectas).split("\n").filter((l: string) => l.trim() !== "")
    : [];

  const handleSearch = async (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;

    try {
      setSearching(true);
      const res = await fetch("/api/productos");
      if (!res.ok) return;

      const data = await res.json();
      const products: any[] = Array.isArray(data.products) ? data.products : [];

      const lower = trimmed.toLowerCase();
      const asNumber = Number(trimmed);

      const found =
        products.find((p) => p.idprod === asNumber && !Number.isNaN(asNumber)) ||
        products.find((p) => String(p.OE).toLowerCase() === lower) ||
        products.find((p) => String(p.nombre).toLowerCase().includes(lower));

      if (found?.idprod) {
        router.push(`/dashboard/inventario/perfil?id=${found.idprod}`);
      }
    } finally {
      setSearching(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-slate-200 text-sm">Cargando perfil de producto...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Navbar superior tipo Figma */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/80 px-5 py-3 flex items-center justify-between gap-4 shadow-[0_0_25px_rgba(15,23,42,0.9)]">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Inventario</span>
            <span className="h-6 w-px bg-slate-700" />
            <span className="text-sm tracking-[0.18em] uppercase text-slate-200">Perfil del producto</span>
          </div>
          <div className="flex items-center gap-3 w-full max-w-xl">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                placeholder={searching ? "Buscando producto..." : "Buscar por ID, OE o nombre..."}
                className="pl-9 bg-slate-950/80 border-slate-700 text-slate-100 placeholder:text-slate-500 h-9 text-xs"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSearch(searchTerm);
                  }
                }}
              />
            </div>
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

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/inventario/administrar">
              <Button variant="ghost" size="icon" className="text-slate-300 hover:text-slate-50">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-50 tracking-tight">
                Perfil del Producto
              </h1>
              <p className="text-sm text-slate-400">
                Vista detallada del producto dentro del inventario del taller
              </p>
            </div>
          </div>
          <Button variant="outline" className="border-cyan-500/60 text-cyan-300 hover:bg-cyan-500/10 rounded-full px-5">
            <Edit className="h-4 w-4 mr-2" />
            Editar Producto
          </Button>
        </div>
        {error || !producto ? (
          <Card className="bg-slate-950/80 border border-cyan-700/40 rounded-xl p-5 space-y-2 shadow-[0_0_18px_rgba(15,23,42,0.9)]">
            <p className="text-sm text-slate-300">
              {error || "Producto no encontrado. Vuelva al listado e intente nuevamente."}
            </p>
            <p className="text-xs text-slate-500">
              También puedes buscar un producto usando la barra superior por <span className="font-semibold text-slate-300">ID</span>, <span className="font-semibold text-slate-300">OE</span> o <span className="font-semibold text-slate-300">nombre</span>.
            </p>
          </Card>
        ) : (
          <>
            {/* Galería de imagen superior, similar al layout de Figma */}
            <Card className="bg-slate-950/90 border border-cyan-700/40 shadow-[0_0_40px_rgba(8,47,73,0.7)] rounded-xl overflow-hidden">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm text-slate-200 tracking-wide">IMAGE GALLERY</CardTitle>
                <span className="text-xs text-emerald-400">+10</span>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative w-full h-64 bg-slate-900 rounded-lg overflow-hidden flex items-center justify-between px-6">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full bg-slate-950/60 hover:bg-slate-800 text-slate-200"
                    onClick={() => {
                      if (totalImages > 0) {
                        setCurrentImageIndex((prev) => (prev - 1 + totalImages) % totalImages);
                      }
                    }}
                  >
                    <span className="text-lg">&#8249;</span>
                  </Button>
                  <div className="relative h-44 w-[60%] min-w-[260px] mx-4 bg-slate-800 rounded-lg overflow-hidden">
                    <Image src={currentImage} alt={producto.nombre} fill className="object-cover" />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full bg-slate-950/60 hover:bg-slate-800 text-slate-200"
                    onClick={() => {
                      if (totalImages > 0) {
                        setCurrentImageIndex((prev) => (prev + 1) % totalImages);
                      }
                    }}
                  >
                    <span className="text-lg">&#8250;</span>
                  </Button>
                </div>

                <div className="flex items-center justify-center gap-3">
                  {images.map((img, index) => (
                    <div
                      key={`${img}-${index}`}
                      className={`h-14 w-20 rounded-md border  bg-slate-900 overflow-hidden cursor-pointer transition-all ${
                        index === safeIndex ? "border-cyan-500/80 ring-2 ring-cyan-500/40" : "border-slate-700"
                      }`}
                      onClick={() => setCurrentImageIndex(index)}
                    >
                      <Image
                        src={img}
                        alt={`Thumbnail ${index + 1}`}
                        width={80}
                        height={56}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Secciones inferiores en dos columnas como en el Figma */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
          {/* Columna izquierda: proveedor, precios, OEM, aplicación/detalles */}
          <div className="space-y-4">
            <Card className="bg-slate-950/80 border border-cyan-700/40 rounded-xl shadow-[0_0_22px_rgba(15,23,42,0.9)]">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-slate-200">PROVEEDOR</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-slate-300 space-y-2">
                <div className="flex justify-between">
                  <p className="text-slate-400">Código proveedor</p>
                  <p className="font-mono text-slate-100">{producto.idprodprov || "—"}</p>
                </div>
                <div className="flex justify-between">
                  <p className="text-slate-400">Código paquete</p>
                  <p className="font-mono text-slate-100">{producto.idprodpaquete || "—"}</p>
                </div>
                <div className="flex justify-between">
                  <p className="text-slate-400">Código físico</p>
                  <p className="font-mono text-slate-100">{producto.idprodfisico || "—"}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-950/80 border border-cyan-700/40 rounded-xl shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-slate-200">PRECIOS</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-xs text-slate-300">
                <div className="space-y-1">
                  <p className="text-slate-400">MAYOR</p>
                  <p className="font-semibold text-slate-100">—</p>
                </div>
                <div className="space-y-1">
                  <p className="text-slate-400">PVP</p>
                  <p className="font-semibold text-slate-100">—</p>
                </div>
                <div className="space-y-1">
                  <p className="text-slate-400">ICL</p>
                  <p className="font-semibold text-slate-100">—</p>
                </div>
                <div className="space-y-1">
                  <p className="text-slate-400">CÓD. ARANCEL</p>
                  <p className="font-mono text-slate-100">{producto.codarancel || "N/D"}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-950/80 border border-slate-800 rounded-xl shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-slate-200">OEM / CRUCES</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-slate-300 space-y-1">
                <p className="text-slate-400">OEM / Cruces registrados</p>
                {referenciasDirectas.length === 0 && referenciasIndirectas.length === 0 ? (
                  <p className="text-slate-500">Sin referencias registradas.</p>
                ) : (
                  <>
                    {referenciasDirectas.map((ref) => (
                      <p key={ref} className="font-mono text-slate-100">
                        {ref}
                      </p>
                    ))}
                    {referenciasIndirectas.map((ref) => (
                      <p key={ref} className="font-mono text-slate-100">
                        {ref}
                      </p>
                    ))}
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="bg-slate-950/80 border border-slate-800 rounded-xl shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-slate-200">APLICACIÓN / DETALLES</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-slate-300 space-y-1">
                <p className="text-slate-400">Aplicación y observaciones</p>
                <p>
                  {producto.info_publica || "Sin información pública registrada."}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Columna derecha: referencias, nombres/alias, descripción, aplicación (chips) */}
          <div className="space-y-4">
            <Card className="bg-slate-950/80 border border-cyan-700/40 rounded-xl shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-slate-200">REFERENCIAS</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-xs text-slate-300">
                <div className="space-y-1">
                  <p className="text-slate-400">OEM / Cruces registrados</p>
                  <p className="font-mono text-slate-100">{producto.OE}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-slate-400">REF. PRODUCTO</p>
                  <p className="font-mono text-slate-100">{producto.idprod}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-slate-400">REF. FABRICANTE</p>
                  <p className="font-mono text-slate-100">{producto.marca || "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-slate-400">OEM</p>
                  <p className="font-mono text-slate-100">{producto.OE}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-950/80 border border-slate-800 rounded-xl shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-slate-200">NOMBRES / ALIAS</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-xs text-slate-300">
                <div className="space-y-1">
                  <p className="text-slate-400">NOMBRE</p>
                  <p className="font-semibold text-slate-100">{producto.nombre}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-slate-400">ALIAS</p>
                  <p className="font-semibold text-slate-100">—</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-950/80 border border-slate-800 rounded-xl shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-slate-200">DESCRIPCIÓN</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-300 space-y-2">
                <p>{producto.descripcion || "Sin descripción registrada."}</p>
                {producto.info_reservada && (
                  <p className="text-xs text-slate-400">Nota interna: {producto.info_reservada}</p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-slate-950/80 border border-slate-800 rounded-xl shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-slate-200">APLICACIÓN</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2 text-xs text-slate-300">
                {etiquetasArray.map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="border-slate-700 text-slate-200 px-3 py-1 rounded-full"
                  >
                    {tag.toUpperCase()}
                  </Badge>
                ))}
              </CardContent>
            </Card>
          </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
