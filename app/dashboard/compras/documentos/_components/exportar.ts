import { EMPRESA } from '@/lib/empresa';
import { etiquetaTipo } from '@/lib/documentos-compras-constantes';
import { fechaInput, type Documento, type LineaDocumento } from './tipos';

const r2 = (n: unknown) => Math.round((Number(n) || 0) * 100) / 100;
const r4 = (n: unknown) => Math.round((Number(n) || 0) * 10000) / 10000;
const dinero = (n: unknown, dec = 2) =>
  (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });

const codigoLinea = (l: LineaDocumento) => (l.idtemporal ? l.temporal_codigo ?? '' : String(l.idprod ?? ''));

export async function exportarExcel(documento: Documento, lineas: LineaDocumento[]) {
  const XLSX = await import('xlsx');
  const enUsd = documento.moneda_documento === 'USD';
  const filas = lineas.map((l) => ({
    '#': l.linea_visual,
    Código: codigoLinea(l),
    'Ref. proveedor': l.referencia_proveedor ?? '',
    OEM: l.oems ?? '',
    Descripción: l.descripcion_articulo,
    Cantidad: Number(l.cantidad),
    [`Precio ${documento.moneda_documento}`]: r4(l.precio_moneda),
    ...(enUsd ? {} : { 'Precio USD': r4(l.precio_usd) }),
    'Subtotal USD': r2(Number(l.cantidad) * Number(l.precio_usd)),
    ...(l.precio_objetivo != null ? { 'Precio objetivo': r4(l.precio_objetivo) } : {}),
    Estatus: l.estatus_articulo,
    'Entrega est.': fechaInput(l.fecha_est_entrega),
    'Comentario proveedor': l.comentario_proveedor ?? '',
  }));
  const hoja = XLSX.utils.json_to_sheet(filas);
  XLSX.utils.sheet_add_aoa(
    hoja,
    [
      [],
      ['Total', '', '', '', '', '', `${documento.moneda_documento} ${r2(documento.total_moneda)}`, `USD ${r2(documento.total_usd)}`],
    ],
    { origin: -1 }
  );
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, etiquetaTipo(documento.tipo_documento).slice(0, 30));
  XLSX.writeFile(libro, `${documento.id_documento}.xlsx`);
}

interface ProveedorPdf {
  nombre_legal?: string | null;
  direccion?: string | null;
  ciudad?: string | null;
  pais?: string | null;
  telefono?: string | null;
  email?: string | null;
  nit?: string | null;
}

export async function imprimirOrden(documento: Documento, lineas: LineaDocumento[], proveedor: ProveedorPdf | null) {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF();
  const ancho = doc.internal.pageSize.getWidth();

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(EMPRESA.nombre, 14, 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const datosEmpresa = [
    EMPRESA.direccion,
    [EMPRESA.nit && `NIT ${EMPRESA.nit}`, EMPRESA.nrc && `NRC ${EMPRESA.nrc}`].filter(Boolean).join(' · '),
    [EMPRESA.telefono, EMPRESA.email].filter(Boolean).join(' · '),
  ].filter(Boolean);
  datosEmpresa.forEach((t, i) => doc.text(t, 14, 21 + i * 4));

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('ORDEN DE COMPRA', ancho - 14, 16, { align: 'right' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(documento.id_documento, ancho - 14, 21, { align: 'right' });
  doc.text(`Fecha: ${fechaInput(documento.fecha_documento)}`, ancho - 14, 25, { align: 'right' });

  autoTable(doc, {
    startY: 36,
    theme: 'plain',
    styles: { fontSize: 8, cellPadding: 1 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 28 }, 2: { fontStyle: 'bold', cellWidth: 28 } },
    body: [
      ['Proveedor', proveedor?.nombre_legal || documento.proveedor_nombre || '-', 'Moneda', documento.moneda_documento],
      ['Dirección', [proveedor?.direccion, proveedor?.ciudad, proveedor?.pais].filter(Boolean).join(', ') || '-', 'Incoterm', documento.incoterm || '-'],
      ['Contacto', documento.contacto_nombre || '-', 'Entrega estimada', fechaInput(documento.fecha_est_entrega) || '-'],
      ['Teléfono / email', [proveedor?.telefono, proveedor?.email].filter(Boolean).join(' · ') || '-', 'Pago', `${documento.condicion_pago === 'CREDITO' ? 'Crédito' : 'Contado'}${documento.acuerdo_pago ? ` · ${documento.acuerdo_pago}` : ''}`],
    ],
  });

  const moneda = documento.moneda_documento;
  autoTable(doc, {
    head: [['#', 'Código', 'Ref. proveedor', 'Descripción', 'Cant.', `Precio ${moneda}`, `Subtotal ${moneda}`]],
    body: lineas.map((l) => [
      l.linea_visual,
      codigoLinea(l),
      l.referencia_proveedor ?? '',
      l.descripcion_articulo,
      dinero(l.cantidad, 2),
      dinero(l.precio_moneda, 4),
      dinero(Number(l.cantidad) * Number(l.precio_moneda)),
    ]),
    foot: [['', '', '', '', '', 'Total', `${moneda} ${dinero(documento.total_moneda)}`]],
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59] },
    footStyles: { fillColor: [241, 245, 249], textColor: 20, fontStyle: 'bold' },
    styles: { fontSize: 8 },
    columnStyles: { 0: { cellWidth: 8 }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } },
  });

  const finTabla = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 120;
  let y = finTabla + 8;
  if (documento.comentarios) {
    doc.setFontSize(8);
    doc.text(doc.splitTextToSize(`Observaciones: ${documento.comentarios}`, ancho - 28), 14, y);
    y += 12;
  }
  const alto = doc.internal.pageSize.getHeight();
  const firma = Math.max(y + 20, alto - 30);
  doc.setDrawColor(120);
  doc.line(14, firma, 80, firma);
  doc.line(ancho - 80, firma, ancho - 14, firma);
  doc.setFontSize(8);
  doc.text('Autorizado por', 14, firma + 4);
  doc.text('Recibido por el proveedor', ancho - 80, firma + 4);

  doc.save(`${documento.id_documento}.pdf`);
}
