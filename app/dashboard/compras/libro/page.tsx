'use client';

import { useCallback, useEffect, useState } from 'react';
import { FileSpreadsheet, FileText, Loader2, RefreshCw } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { NotificationDropdown } from '@/components/notification-dropdown';
import { UserDropdown } from '@/components/user-dropdown';
import { UI } from '@/lib/ui';
import { obtenerEmpresa } from '@/lib/empresa-cliente';
import { nombreTipoDte } from '@/lib/compras-constantes';
import { fechaLocalISO } from '@/lib/fechas';
import type { FilaLibro } from '@/app/api/libro-compras/route';

type Totales = Record<
  | 'exentas_internas'
  | 'importaciones_exentas'
  | 'gravadas_internas'
  | 'importaciones_gravadas'
  | 'credito_fiscal'
  | 'otros_tributos'
  | 'total'
  | 'iva_percibido'
  | 'iva_retenido'
  | 'renta_retenida',
  number
>;

const COLUMNAS: { campo: keyof Totales; titulo: string }[] = [
  { campo: 'exentas_internas', titulo: 'Internas exentas / no sujetas' },
  { campo: 'importaciones_exentas', titulo: 'Importaciones exentas' },
  { campo: 'gravadas_internas', titulo: 'Internas gravadas' },
  { campo: 'importaciones_gravadas', titulo: 'Importaciones gravadas' },
  { campo: 'credito_fiscal', titulo: 'Crédito fiscal' },
  { campo: 'otros_tributos', titulo: 'Otros tributos' },
  { campo: 'total', titulo: 'Total compras' },
  { campo: 'iva_percibido', titulo: 'IVA percibido' },
  { campo: 'iva_retenido', titulo: 'IVA retenido' },
  { campo: 'renta_retenida', titulo: 'Renta retenida' },
];

const dinero = (n: unknown) =>
  (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const r2 = (n: unknown) => Math.round((Number(n) || 0) * 100) / 100;
const tipoDoc = (f: FilaLibro) => (f.clase === 'DUCA' ? 'DUCA' : nombreTipoDte(f.tipo));
const fechaCorta = (iso: string) => iso.split('-').reverse().join('/');

function primerDiaDelMes() {
  const hoy = new Date();
  return fechaLocalISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
}

export default function LibroComprasPage() {
  const [desde, setDesde] = useState(primerDiaDelMes);
  const [hasta, setHasta] = useState(() => fechaLocalISO());
  const [filas, setFilas] = useState<FilaLibro[]>([]);
  const [totales, setTotales] = useState<Totales | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(`/api/libro-compras?desde=${desde}&hasta=${hasta}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'No se pudo generar el libro');
      setFilas(data.filas);
      setTotales(data.totales);
    } catch (e) {
      setError((e as Error).message);
      setFilas([]);
      setTotales(null);
    } finally {
      setCargando(false);
    }
  }, [desde, hasta]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const exportarExcel = async () => {
    const XLSX = await import('xlsx');
    const datos = filas.map((f) => ({
      'No.': f.correlativo,
      Fecha: fechaCorta(f.fecha),
      Documento: tipoDoc(f),
      Número: f.numero,
      NRC: f.nrc ?? '',
      NIT: f.nit ?? '',
      Proveedor: f.proveedor,
      ...Object.fromEntries(COLUMNAS.map((c) => [c.titulo, r2(f[c.campo])])),
      Referencia: f.referencia ?? '',
    }));
    const hoja = XLSX.utils.json_to_sheet(datos);
    if (totales) {
      XLSX.utils.sheet_add_aoa(
        hoja,
        [['', '', '', '', '', '', 'TOTALES', ...COLUMNAS.map((c) => r2(totales[c.campo]))]],
        { origin: -1 }
      );
    }
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Libro de compras');
    XLSX.writeFile(libro, `libro_compras_${desde}_${hasta}.xlsx`);
  };

  const exportarPdf = async () => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const empresa = await obtenerEmpresa();
    const doc = new jsPDF({ orientation: 'landscape' });
    const ancho = doc.internal.pageSize.getWidth();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(empresa?.nombre || 'Empresa', 14, 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(
      [empresa?.nit && `NIT ${empresa.nit}`, empresa?.nrc && `NRC ${empresa.nrc}`].filter(Boolean).join(' · ') || ' ',
      14,
      19
    );
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('LIBRO DE COMPRAS', ancho - 14, 14, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Del ${fechaCorta(desde)} al ${fechaCorta(hasta)}`, ancho - 14, 19, { align: 'right' });

    autoTable(doc, {
      startY: 24,
      head: [['No.', 'Fecha', 'Doc.', 'Número', 'NRC', 'Proveedor', ...COLUMNAS.map((c) => c.titulo)]],
      body: filas.map((f) => [
        f.correlativo,
        fechaCorta(f.fecha),
        tipoDoc(f),
        f.numero,
        f.nrc ?? '',
        f.proveedor,
        ...COLUMNAS.map((c) => dinero(f[c.campo])),
      ]),
      foot: totales ? [['', '', '', '', '', 'TOTALES', ...COLUMNAS.map((c) => dinero(totales[c.campo]))]] : undefined,
      theme: 'grid',
      styles: { fontSize: 6, cellPadding: 0.8 },
      headStyles: { fillColor: [30, 41, 59], fontSize: 6 },
      footStyles: { fillColor: [241, 245, 249], textColor: 20, fontStyle: 'bold' },
      columnStyles: Object.fromEntries(
        [[3, { cellWidth: 38 }], ...COLUMNAS.map((_, i) => [i + 6, { halign: 'right' }])] as [number, object][]
      ),
    });
    doc.save(`libro_compras_${desde}_${hasta}.pdf`);
  };

  return (
    <DashboardLayout>
      <div className={UI.page}>
        <div className={UI.stack}>
          <div className={UI.navbar}>
            <div className="flex items-center gap-3">
              <span className={UI.navLabel}>Compras</span>
              <span className={UI.navDivider} />
              <span className={UI.navTitle}>Libro de Compras</span>
            </div>
            <div className="flex items-center gap-3">
              <NotificationDropdown />
              <UserDropdown />
            </div>
          </div>

          <div className={`${UI.densePanel} px-3 py-2 flex flex-wrap items-end gap-3`}>
            <label className="flex flex-col gap-1">
              <span className={UI.denseLabel}>Desde</span>
              <input type="date" className={UI.denseInput} value={desde} onChange={(e) => setDesde(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className={UI.denseLabel}>Hasta</span>
              <input type="date" className={UI.denseInput} value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </label>
            <button type="button" className={UI.denseBtn} onClick={cargar} disabled={cargando}>
              {cargando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Actualizar
            </button>
            <div className="ml-auto flex gap-2">
              <button type="button" className={UI.denseBtn} onClick={exportarExcel} disabled={!filas.length}>
                <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
              </button>
              <button type="button" className={UI.denseBtnPrimary} onClick={exportarPdf} disabled={!filas.length}>
                <FileText className="w-3.5 h-3.5" /> PDF
              </button>
            </div>
          </div>

          <p className={UI.note}>
            Por fecha de emisión. Incluye crédito fiscal (03), notas de crédito (05, restan) y débito (06), sujeto excluido
            (14, sin crédito fiscal) y la DUCA de cada importación con el IVA pagado en aduana. Las compras anuladas o
            invalidadas por el emisor no aparecen.
          </p>

          {error && <div className={`${UI.avisoError} px-3 py-2 text-xs`}>{error}</div>}

          <div className={`${UI.densePanel} overflow-auto max-h-[65vh]`}>
            <table className={UI.denseTable}>
              <thead>
                <tr>
                  <th className={UI.denseTh}>No.</th>
                  <th className={UI.denseTh}>Fecha</th>
                  <th className={UI.denseTh}>Doc.</th>
                  <th className={UI.denseTh}>Número</th>
                  <th className={UI.denseTh}>NRC</th>
                  <th className={UI.denseTh}>Proveedor</th>
                  {COLUMNAS.map((c) => (
                    <th key={c.campo} className={`${UI.denseTh} text-right`}>{c.titulo}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={`${f.clase}-${f.referencia}-${f.correlativo}`} className="hover:bg-muted/60">
                    <td className={UI.denseTd}>{f.correlativo}</td>
                    <td className={UI.denseTd}>{fechaCorta(f.fecha)}</td>
                    <td className={UI.denseTd}>{tipoDoc(f)}</td>
                    <td className={`${UI.denseTd} ${UI.denseMono} max-w-[16rem] truncate`} title={f.numero}>{f.numero}</td>
                    <td className={UI.denseTd}>{f.nrc ?? ''}</td>
                    <td className={`${UI.denseTd} max-w-[14rem] truncate`} title={f.proveedor}>{f.proveedor}</td>
                    {COLUMNAS.map((c) => (
                      <td
                        key={c.campo}
                        className={`${UI.denseTd} ${UI.denseMono} text-right ${Number(f[c.campo]) < 0 ? 'text-red-600 dark:text-red-400' : ''}`}
                      >
                        {Number(f[c.campo]) ? dinero(f[c.campo]) : ''}
                      </td>
                    ))}
                  </tr>
                ))}
                {!cargando && filas.length === 0 && !error && (
                  <tr>
                    <td colSpan={6 + COLUMNAS.length} className={`${UI.denseTd} text-center text-muted-foreground py-6`}>
                      No hay compras registradas en el período
                    </td>
                  </tr>
                )}
              </tbody>
              {totales && filas.length > 0 && (
                <tfoot>
                  <tr className="font-semibold bg-muted/60">
                    <td colSpan={6} className={`${UI.denseTd} text-right`}>Totales</td>
                    {COLUMNAS.map((c) => (
                      <td key={c.campo} className={`${UI.denseTd} ${UI.denseMono} text-right`}>{dinero(totales[c.campo])}</td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
