'use client';

import jsPDF from 'jspdf';

interface ProductoCatalogo {
  idprod: number;
  nombre: string;
  descripcion?: string;
  marca?: string;
  OE?: string;
  codigo_jerarquico?: string | number;
  imagen_principal?: string;
  categoria_nueva_nombre?: string;
  grupo_nombre?: string;
  grupo_codigo?: string;
  subgrupo_nombre?: string;
  subgrupo_codigo?: string;
  idcategoria_nuevo?: number;
  id_grupo?: number;
  id_subgrupo?: number;
  aplicacion_marcas?: string;
  precio1?: number;
}

interface CategoriaAgrupada {
  idcategoria: number;
  nombre: string;
  grupos: GrupoAgrupado[];
}

interface GrupoAgrupado {
  id_grupo: number;
  codigo: string;
  nombre: string;
  subgrupos: SubgrupoAgrupado[];
}

interface SubgrupoAgrupado {
  id_subgrupo: number;
  codigo: string;
  nombre: string;
  productos: ProductoCatalogo[];
}

// Función para cargar imagen como base64
async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// Función para dibujar círculo con check verde
function drawGreenCheck(doc: jsPDF, x: number, y: number, size: number) {
  // Círculo verde
  doc.setFillColor(76, 175, 80); // Verde
  doc.circle(x, y, size, 'F');
  
  // Check blanco (simulado con líneas)
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.5);
  // Línea corta del check
  doc.line(x - size * 0.4, y, x - size * 0.1, y + size * 0.3);
  // Línea larga del check
  doc.line(x - size * 0.1, y + size * 0.3, x + size * 0.5, y - size * 0.3);
}

export async function generateCatalogPDF(productos: ProductoCatalogo[]): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 8;
  const contentWidth = pageWidth - (margin * 2);

  // Pre-cargar imágenes de productos
  const imageCache = new Map<string, string>();
  console.log('Cargando imágenes de productos...');
  for (const producto of productos) {
    if (producto.imagen_principal) {
      const imgUrl = producto.imagen_principal.startsWith('/') 
        ? producto.imagen_principal 
        : `/${producto.imagen_principal}`;
      try {
        const base64 = await loadImageAsBase64(imgUrl);
        if (base64) {
          imageCache.set(producto.imagen_principal, base64);
        }
      } catch (e) {
        console.log('Error cargando imagen:', producto.imagen_principal);
      }
    }
  }
  console.log(`Imágenes cargadas: ${imageCache.size}`);

  // Cargar imagen del header
  let headerImage: string | null = null;
  try {
    headerImage = await loadImageAsBase64('/catalogo-header.png');
  } catch (e) {
    console.log('Header image not found');
  }

  // Ordenar productos por código jerárquico
  const productosOrdenados = [...productos].sort((a, b) => {
    const codigoA = String(a.codigo_jerarquico || '99999999');
    const codigoB = String(b.codigo_jerarquico || '99999999');
    return codigoA.localeCompare(codigoB);
  });

  let currentPage = 1;
  let yPosition = margin;

  // Función para agregar encabezado estilo original exacto
  const addHeader = () => {
    // Fondo blanco
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pageWidth, 28, 'F');
    
    if (headerImage) {
      try {
        // Imagen del header ocupando todo el ancho
        doc.addImage(headerImage, 'PNG', 0, 2, pageWidth, 20);
      } catch (e) {
        addTextHeader();
      }
    } else {
      addTextHeader();
    }

    // Línea verde gruesa (como en el original)
    doc.setFillColor(0, 128, 0);
    doc.rect(0, 24, pageWidth, 3, 'F');

    return 30;
  };

  const addTextHeader = () => {
    // Círculo con logo (simulado)
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(1);
    doc.circle(margin + 8, 12, 7, 'FD');
    
    // Letra A dentro del círculo
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text('A', margin + 8, 14, { align: 'center' });
    
    // ARGUETA REPUESTOS
    doc.setFontSize(12);
    doc.text('ARGUETA', margin + 20, 10);
    doc.setTextColor(100, 100, 100);
    doc.text('REPUESTOS', margin + 42, 10);
    
    // Subtítulo
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.text('AUTOMOTRIZ - INDUSTRIAL', margin + 20, 15);

    // Iconos de vehículos (siluetas simples)
    doc.setFillColor(0, 0, 0);
    const iconStartX = pageWidth / 2 - 30;
    const iconY = 10;
    // Simular iconos con rectángulos
    for (let i = 0; i < 6; i++) {
      doc.rect(iconStartX + (i * 12), iconY, 10, 6, 'F');
    }
  };

  // Función para agregar pie de página estilo original
  const addFooter = () => {
    const footerY = pageHeight - 10;
    
    // Fondo negro del footer
    doc.setFillColor(30, 30, 30);
    doc.rect(0, footerY - 3, pageWidth, 15, 'F');

    // Información de contacto
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(255, 255, 255);
    doc.text('ARGUETA REPUESTOS', margin, footerY + 2);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5);
    doc.text('Calle Almendros y Ave. Diana No30, Col. Carmenza, San Miguel | Tel. +503 2684 9702 | email: argueta.t@hotmail.com', margin + 28, footerY + 2);
    
    // Número de página
    doc.text(`P.${currentPage}`, pageWidth - margin - 3, footerY + 2, { align: 'right' });
  };

  // Función para nueva página
  const newPage = () => {
    addFooter();
    doc.addPage();
    currentPage++;
    yPosition = addHeader();
  };

  // Función para verificar espacio disponible
  const checkSpace = (needed: number) => {
    if (yPosition + needed > pageHeight - 18) {
      newPage();
    }
  };

  // Agregar primera página
  yPosition = addHeader();

  // Configuración del grid - 3 columnas como el original
  const cardWidth = contentWidth / 3;
  const cardHeight = 55; // Altura del card
  const imageSize = 32; // Tamaño de la imagen (cuadrada)
  let col = 0;
  let rowStartY = yPosition;

  // Renderizar todos los productos en grid
  for (const producto of productosOrdenados) {
    if (col === 0) {
      checkSpace(cardHeight + 3);
      rowStartY = yPosition;
    }

    const cardX = margin + (col * cardWidth);
    
    // Línea divisoria vertical (excepto primera columna)
    if (col > 0) {
      doc.setDrawColor(230, 230, 230);
      doc.setLineWidth(0.2);
      doc.line(cardX, rowStartY, cardX, rowStartY + cardHeight);
    }

    // === LADO IZQUIERDO: Texto ===
    const textX = cardX + 2;
    const textWidth = cardWidth - imageSize - 8;

    // Nombre del producto (en mayúsculas, negrita)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(0, 0, 0);
    const nombreLineas = doc.splitTextToSize(producto.nombre.toUpperCase(), textWidth);
    doc.text(nombreLineas.slice(0, 2), textX, rowStartY + 5);

    // Código con check verde
    const codigoCatalogo = formatCodigoCatalogo(producto);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(codigoCatalogo, textX, rowStartY + 15);
    
    // Check verde al lado del código
    drawGreenCheck(doc, textX + doc.getTextWidth(codigoCatalogo) + 4, rowStartY + 13, 2);

    // APLICACION (label)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5);
    doc.setTextColor(0, 0, 0);
    doc.text('APLICACION', textX, rowStartY + 22);

    // Marcas/Aplicación (en azul, subrayado)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(0, 0, 180); // Azul
    const aplicacion = producto.aplicacion_marcas || producto.marca || '-';
    const aplicacionLineas = doc.splitTextToSize(aplicacion.toUpperCase(), textWidth);
    doc.text(aplicacionLineas.slice(0, 2), textX, rowStartY + 27);
    
    // Subrayado para las marcas
    if (aplicacionLineas[0]) {
      const lineWidth = Math.min(doc.getTextWidth(aplicacionLineas[0]), textWidth);
      doc.setDrawColor(0, 0, 180);
      doc.setLineWidth(0.1);
      doc.line(textX, rowStartY + 28, textX + lineWidth, rowStartY + 28);
    }

    // OE (si existe)
    if (producto.OE) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5);
      doc.setTextColor(0, 0, 0);
      const oeText = producto.OE.length > 25 ? producto.OE.substring(0, 22) + '...' : producto.OE;
      doc.text(oeText, textX, rowStartY + 38);
    }

    // Precio (DI: XX.XX)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(0, 0, 0);
    const precio = producto.precio1 
      ? (typeof producto.precio1 === 'string' ? parseFloat(producto.precio1) : producto.precio1)
      : 0;
    doc.text(`DI: ${precio.toFixed(2)}`, textX, rowStartY + 50);

    // === LADO DERECHO: Imagen ===
    const imgX = cardX + cardWidth - imageSize - 3;
    const imgY = rowStartY + 3;

    const imgBase64 = producto.imagen_principal ? imageCache.get(producto.imagen_principal) : null;
    
    if (imgBase64) {
      try {
        doc.addImage(imgBase64, 'JPEG', imgX, imgY, imageSize, imageSize);
      } catch (e) {
        // Placeholder si falla
        doc.setFillColor(248, 248, 248);
        doc.rect(imgX, imgY, imageSize, imageSize, 'F');
        doc.setDrawColor(220, 220, 220);
        doc.rect(imgX, imgY, imageSize, imageSize, 'S');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(4);
        doc.setTextColor(180, 180, 180);
        doc.text('IMAGEN NO', imgX + imageSize/2, imgY + imageSize/2 - 1, { align: 'center' });
        doc.text('DISPONIBLE', imgX + imageSize/2, imgY + imageSize/2 + 2, { align: 'center' });
      }
    } else {
      // Placeholder
      doc.setFillColor(248, 248, 248);
      doc.rect(imgX, imgY, imageSize, imageSize, 'F');
      doc.setDrawColor(220, 220, 220);
      doc.rect(imgX, imgY, imageSize, imageSize, 'S');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(4);
      doc.setTextColor(180, 180, 180);
      doc.text('IMAGEN NO', imgX + imageSize/2, imgY + imageSize/2 - 1, { align: 'center' });
      doc.text('DISPONIBLE', imgX + imageSize/2, imgY + imageSize/2 + 2, { align: 'center' });
    }

    // Avanzar columna
    col++;
    if (col >= 3) {
      col = 0;
      yPosition = rowStartY + cardHeight + 2;
      
      // Línea horizontal divisoria entre filas
      doc.setDrawColor(230, 230, 230);
      doc.setLineWidth(0.2);
      doc.line(margin, yPosition - 1, pageWidth - margin, yPosition - 1);
    }
  }

  // Si la última fila no está completa, ajustar yPosition
  if (col > 0) {
    yPosition = rowStartY + cardHeight + 2;
  }

  // Agregar footer a la última página
  addFooter();

  // Descargar el PDF
  doc.save('catalogo_productos.pdf');
}

function organizarProductos(productos: ProductoCatalogo[]): CategoriaAgrupada[] {
  const mapa = new Map<number, CategoriaAgrupada>();

  // Ordenar productos por código jerárquico
  const productosOrdenados = [...productos].sort((a, b) => {
    const codigoA = String(a.codigo_jerarquico || '99999999');
    const codigoB = String(b.codigo_jerarquico || '99999999');
    return codigoA.localeCompare(codigoB);
  });

  for (const producto of productosOrdenados) {
    const idCategoria = producto.idcategoria_nuevo || 0;
    const idGrupo = producto.id_grupo || 0;
    const idSubgrupo = producto.id_subgrupo || 0;

    // Obtener o crear categoría
    if (!mapa.has(idCategoria)) {
      mapa.set(idCategoria, {
        idcategoria: idCategoria,
        nombre: producto.categoria_nueva_nombre || 'Sin Categoría',
        grupos: []
      });
    }
    const categoria = mapa.get(idCategoria)!;

    // Buscar o crear grupo
    let grupo = categoria.grupos.find(g => g.id_grupo === idGrupo);
    if (!grupo) {
      grupo = {
        id_grupo: idGrupo,
        codigo: producto.grupo_codigo || '000',
        nombre: producto.grupo_nombre || 'Sin Grupo',
        subgrupos: []
      };
      categoria.grupos.push(grupo);
    }

    // Buscar o crear subgrupo
    let subgrupo = grupo.subgrupos.find(s => s.id_subgrupo === idSubgrupo);
    if (!subgrupo) {
      subgrupo = {
        id_subgrupo: idSubgrupo,
        codigo: producto.subgrupo_codigo || '000',
        nombre: producto.subgrupo_nombre || 'Sin Subgrupo',
        productos: []
      };
      grupo.subgrupos.push(subgrupo);
    }

    // Agregar producto
    subgrupo.productos.push(producto);
  }

  // Ordenar categorías por ID
  return Array.from(mapa.values()).sort((a, b) => a.idcategoria - b.idcategoria);
}

function formatCodigoCatalogo(producto: ProductoCatalogo): string {
  if (producto.codigo_jerarquico) {
    const str = String(producto.codigo_jerarquico).padStart(8, '0');
    const categoria = str.slice(0, 2);
    const grupo = str.slice(2, 5);
    const subgrupo = str.slice(5, 8);
    return `${categoria}${grupo}${subgrupo}${producto.idprod}`;
  }
  return `${producto.idprod}`;
}
