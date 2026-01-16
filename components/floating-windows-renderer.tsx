'use client';

import React, { useState, useEffect } from 'react';
import { useFloatingWindows } from '@/contexts/floating-windows-context';
import { useRouter } from 'next/navigation';
import { X, Package, Layers, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Image from 'next/image';

export function FloatingWindowsRenderer() {
  const router = useRouter();
  const { 
    floatingWindows, 
    closeFloatingWindow, 
    bringToFront, 
    updateWindowPosition,
    updateWindowSize
  } = useFloatingWindows();

  const [draggingWindow, setDraggingWindow] = useState<number | null>(null);
  const [resizingWindow, setResizingWindow] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Manejo global del mouse para arrastrar y redimensionar
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggingWindow !== null) {
        updateWindowPosition(draggingWindow, {
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        });
      }
      if (resizingWindow !== null) {
        const win = floatingWindows.find(w => w.id === resizingWindow);
        if (win) {
          const newWidth = Math.max(320, e.clientX - win.position.x);
          const newHeight = Math.max(300, e.clientY - win.position.y);
          updateWindowSize(resizingWindow, { width: newWidth, height: newHeight });
        }
      }
    };

    const handleMouseUp = () => {
      setDraggingWindow(null);
      setResizingWindow(null);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    if (draggingWindow !== null || resizingWindow !== null) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = draggingWindow ? 'move' : 'se-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingWindow, resizingWindow, dragOffset, updateWindowPosition, updateWindowSize, floatingWindows]);

  const handleMouseDown = (e: React.MouseEvent, windowId: number, position: { x: number; y: number }) => {
    e.preventDefault();
    bringToFront(windowId);
    setDraggingWindow(windowId);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const handleWindowClick = (windowId: number) => {
    bringToFront(windowId);
  };

  const handleResizeStart = (e: React.MouseEvent, windowId: number) => {
    e.preventDefault();
    e.stopPropagation();
    bringToFront(windowId);
    setResizingWindow(windowId);
  };

  const handleOpenTab = (productId: number) => {
    router.push(`/dashboard/inventario/perfil?id=${productId}`);
  };

  const handleEdit = (productId: number) => {
    router.push(`/dashboard/inventario/editar-producto?id=${productId}`);
  };

  if (floatingWindows.length === 0) return null;

  return (
    <>
      {floatingWindows.map((win) => (
        <div
          key={`floating-${win.id}`}
          className="fixed bg-[#0d1523] border border-[#0e88c9]/50 rounded-xl shadow-2xl select-none"
          style={{
            top: win.position.y,
            left: win.position.x,
            width: win.size.width,
            height: win.size.height,
            zIndex: win.zIndex
          }}
          onClick={() => handleWindowClick(win.id)}
        >
          {/* Header arrastrable */}
          <div
            className="flex items-center justify-between px-3 py-2 border-b border-slate-700 cursor-move bg-[#141e2e]"
            onMouseDown={(e) => handleMouseDown(e, win.id, win.position)}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Package className="h-4 w-4 text-[#0e88c9] flex-shrink-0" />
              <span className="text-sm font-medium text-slate-200 truncate">{win.producto.nombre}</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeFloatingWindow(win.id);
              }}
              className="p-1 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400 flex-shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Contenido de la ventana */}
          <div className="p-3 overflow-y-auto" style={{ height: win.size.height - 44 }}>
            {/* Imagen */}
            <div className="bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center h-32 mb-3">
              {win.producto.imagen_principal ? (
                <Image
                  src={win.producto.imagen_principal}
                  alt={win.producto.nombre}
                  width={120}
                  height={120}
                  className="object-contain"
                />
              ) : (
                <Package className="h-16 w-16 text-slate-600" />
              )}
            </div>

            {/* Info del producto */}
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-500">ID:</span>
                  <span className="text-[#0e88c9] ml-1 font-medium">{win.producto.idprod}</span>
                </div>
                <div>
                  <span className="text-slate-500">Stock:</span>
                  <span className={`ml-1 font-medium ${win.producto.stock_contable > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {win.producto.stock_contable}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Costo:</span>
                  <span className="text-emerald-400 ml-1 font-medium">${win.producto.costo || '0.00'}</span>
                </div>
                <div>
                  <span className="text-slate-500">OE:</span>
                  <span className="text-slate-300 ml-1">{win.producto.OE || '-'}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500">Marca:</span>
                  <span className="text-slate-300 ml-1">{win.producto.marca || '-'}</span>
                </div>
              </div>

              {/* Categoría */}
              <div className="pt-2 border-t border-slate-700/50">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-slate-500 text-xs">Categoría:</span>
                    <span className="text-[#0e88c9] ml-1 text-xs">{win.producto.categoria_nombre || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-xs">Código:</span>
                    <span className="text-slate-300 ml-1 text-xs">{win.producto.codigo_barras || '-'}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <div>
                    <span className="text-slate-500 text-xs">Proveedor:</span>
                    <span className="text-slate-300 ml-1 text-xs">{win.producto.idprodprov || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-xs">Stock Físico:</span>
                    <span className="text-slate-300 ml-1 text-xs">{win.producto.stock_contable}</span>
                  </div>
                </div>
              </div>

              {/* Precios */}
              {(win.producto.precio1 || win.producto.precio2 || win.producto.precio3) && (
                <div className="pt-2 border-t border-slate-700/50">
                  <div className="text-xs text-slate-500 mb-1">PRECIOS DE VENTA</div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <div className="text-slate-500">GENERAL</div>
                      <div className="text-[#0e88c9] font-medium">${win.producto.precio1 || '0.00'}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">MAYORISTA</div>
                      <div className="text-[#0e88c9] font-medium">${win.producto.precio2 || '0.00'}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">CLIENTE</div>
                      <div className="text-[#0e88c9] font-medium">${win.producto.precio3 || '0.00'}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">MINORISTA</div>
                      <div className="text-[#0e88c9] font-medium">${win.producto.precio5 || '0.00'}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">INVERSOR</div>
                      <div className="text-[#0e88c9] font-medium">${win.producto.precio6 || '0.00'}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">ESPECIAL</div>
                      <div className="text-[#0e88c9] font-medium">${win.producto.precio7 || '0.00'}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Botones de acción */}
              <div className="flex gap-2 pt-3">
                <Button
                  size="sm"
                  onClick={() => handleOpenTab(win.producto.idprod)}
                  className="flex-1 h-8 text-xs bg-[#0e88c9]/10 text-[#0e88c9] border border-[#0e88c9]/40 hover:bg-[#0e88c9]/20"
                >
                  <Layers className="h-3 w-3 mr-1" />
                  Pestaña
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleEdit(win.producto.idprod)}
                  className="flex-1 h-8 text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/20"
                >
                  <Edit className="h-3 w-3 mr-1" />
                  Editar
                </Button>
              </div>
            </div>
          </div>

          {/* Handle de redimensionamiento */}
          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
            onMouseDown={(e) => handleResizeStart(e, win.id)}
          >
            <svg className="w-4 h-4 text-slate-500 hover:text-[#0e88c9]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22 22H20V20H22V22ZM22 18H20V16H22V18ZM18 22H16V20H18V22ZM22 14H20V12H22V14ZM18 18H16V16H18V18ZM14 22H12V20H14V22Z" />
            </svg>
          </div>
        </div>
      ))}
    </>
  );
}
