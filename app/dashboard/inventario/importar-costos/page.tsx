'use client';

import { DashboardLayout } from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertTriangle, RefreshCw, Download, DollarSign } from 'lucide-react';
import { useState, useRef } from 'react';

interface PreviewData {
  headers: string[];
  columnMapping: { [key: number]: string };
  totalFilas: number;
  costosValidos: number;
  errores: { fila: number; error: string }[];
  preview: any[];
}

interface ImportResult {
  actualizados: number;
  creados: number;
  errores: { fila: number; error: string }[];
}

export default function ImportarCostosPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const extension = selectedFile.name.toLowerCase().slice(selectedFile.name.lastIndexOf('.'));
    if (!validExtensions.includes(extension)) {
      setError('Formato no válido. Use archivos .xlsx, .xls o .csv');
      return;
    }

    setFile(selectedFile);
    setError(null);
    setPreviewData(null);
    setImportResult(null);

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('action', 'preview');

      const response = await fetch('/api/importar-costos', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Error al procesar archivo');
        return;
      }

      setPreviewData(data);
    } catch (err: any) {
      setError(err.message || 'Error al procesar archivo');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('action', 'import');

      const response = await fetch('/api/importar-costos', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Error al importar');
        return;
      }

      setImportResult(data);
      setPreviewData(null);
    } catch (err: any) {
      setError(err.message || 'Error al importar');
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreviewData(null);
    setImportResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const downloadTemplate = () => {
    const template = `OE,Costo,Costo Proveedor,Costo Local,IVA Pagado,No Factura,Fecha Compra
REF-001,150.00,145.00,150.00,19.50,FAC-001,2026-01-15
REF-002,280.00,270.00,280.00,36.40,FAC-001,2026-01-15
REF-003,95.00,90.00,95.00,12.35,FAC-002,2026-02-20`;
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla_costos.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Importar Costos</h1>
            <p className="text-slate-400">Carga masiva de costos desde archivo Excel</p>
          </div>
          <Button
            variant="outline"
            onClick={downloadTemplate}
            className="border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10"
          >
            <Download className="h-4 w-4 mr-2" />
            Descargar Plantilla
          </Button>
        </div>

        {/* Zona de carga */}
        <Card className="bg-[#141e2e] border border-emerald-500/30">
          <CardHeader>
            <CardTitle className="text-lg text-slate-100 flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-400" />
              Cargar Archivo de Costos
            </CardTitle>
            <CardDescription>
              Formatos: .xlsx, .xls, .csv | Columnas requeridas: OE (o idprod) y Costo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div 
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                file ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-slate-700 hover:border-emerald-500/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload-costos"
              />
              
              {!file ? (
                <label htmlFor="file-upload-costos" className="cursor-pointer">
                  <Upload className="h-12 w-12 mx-auto mb-4 text-slate-500" />
                  <p className="text-slate-300 mb-2">Arrastra un archivo aquí o haz clic para seleccionar</p>
                  <p className="text-sm text-slate-500">Máximo 10MB</p>
                </label>
              ) : (
                <div className="flex items-center justify-center gap-4">
                  <FileSpreadsheet className="h-10 w-10 text-emerald-400" />
                  <div className="text-left">
                    <p className="text-slate-200 font-medium">{file.name}</p>
                    <p className="text-sm text-slate-500">{(file.size / 1024).toFixed(2)} KB</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleReset} className="text-slate-400 hover:text-red-400">
                    <XCircle className="h-5 w-5" />
                  </Button>
                </div>
              )}
            </div>

            {loading && (
              <div className="flex items-center justify-center gap-2 mt-4 text-emerald-400">
                <RefreshCw className="h-5 w-5 animate-spin" />
                <span>Procesando archivo...</span>
              </div>
            )}

            {error && (
              <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <div className="flex items-center gap-2 text-red-400">
                  <XCircle className="h-5 w-5" />
                  <span>{error}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Preview de datos */}
        {previewData && (
          <Card className="bg-[#141e2e] border border-emerald-500/30">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg text-slate-100">Vista Previa de Costos</CardTitle>
                  <CardDescription>Revisa los datos antes de importar</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline" className="text-emerald-400 border-emerald-500/50">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {previewData.costosValidos} válidos
                  </Badge>
                  {previewData.errores.length > 0 && (
                    <Badge variant="outline" className="text-amber-400 border-amber-500/50">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {previewData.errores.length} con errores
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Columnas mapeadas */}
              <div className="mb-4 p-3 bg-slate-900/50 rounded-lg">
                <p className="text-xs text-slate-500 mb-2">Columnas detectadas:</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(previewData.columnMapping).map(([index, field]) => (
                    <Badge key={index} variant="secondary" className="bg-emerald-500/20 text-emerald-400">
                      {previewData.headers[parseInt(index)]} → {field}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Tabla de preview */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-2 px-3 text-slate-400">Fila</th>
                      <th className="text-left py-2 px-3 text-slate-400">OE/ID</th>
                      <th className="text-right py-2 px-3 text-slate-400">Costo</th>
                      <th className="text-right py-2 px-3 text-slate-400">Costo Prov.</th>
                      <th className="text-right py-2 px-3 text-slate-400">Costo Local</th>
                      <th className="text-right py-2 px-3 text-slate-400">IVA</th>
                      <th className="text-left py-2 px-3 text-slate-400">Factura</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.preview.map((costo, idx) => (
                      <tr key={idx} className="border-b border-slate-800">
                        <td className="py-2 px-3 text-slate-500">{costo._fila}</td>
                        <td className="py-2 px-3 text-[#0e88c9]">{costo.OE || costo.idprod}</td>
                        <td className="py-2 px-3 text-right text-emerald-400 font-mono">${costo.costo?.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right text-slate-300 font-mono">${costo.costo_proveedor?.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right text-slate-300 font-mono">${costo.costo_local?.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right text-amber-400 font-mono">${costo.iva_pagado?.toFixed(2)}</td>
                        <td className="py-2 px-3 text-slate-400">{costo.nofactura || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {previewData.costosValidos > 10 && (
                  <p className="text-center text-sm text-slate-500 mt-2">
                    Mostrando 10 de {previewData.costosValidos} registros
                  </p>
                )}
              </div>

              {/* Errores */}
              {previewData.errores.length > 0 && (
                <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <p className="text-sm font-medium text-amber-400 mb-2">Filas con errores:</p>
                  <ul className="text-sm text-amber-300/80 space-y-1">
                    {previewData.errores.slice(0, 5).map((err, idx) => (
                      <li key={idx}>Fila {err.fila}: {err.error}</li>
                    ))}
                    {previewData.errores.length > 5 && (
                      <li>... y {previewData.errores.length - 5} más</li>
                    )}
                  </ul>
                </div>
              )}

              {/* Botón de importar */}
              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" onClick={handleReset} className="border-slate-600 text-slate-300">
                  Cancelar
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={importing || previewData.costosValidos === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {importing ? (
                    <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Importando...</>
                  ) : (
                    <><Upload className="h-4 w-4 mr-2" /> Importar {previewData.costosValidos} costos</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Resultado */}
        {importResult && (
          <Card className="bg-[#141e2e] border border-emerald-500/30">
            <CardHeader>
              <CardTitle className="text-lg text-emerald-400 flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Importación Completada
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                <div className="p-4 bg-emerald-500/10 rounded-lg text-center">
                  <p className="text-2xl font-bold text-emerald-400">{importResult.creados}</p>
                  <p className="text-sm text-slate-400">Nuevos registros</p>
                </div>
                <div className="p-4 bg-blue-500/10 rounded-lg text-center">
                  <p className="text-2xl font-bold text-blue-400">{importResult.actualizados}</p>
                  <p className="text-sm text-slate-400">Actualizados</p>
                </div>
                {importResult.errores.length > 0 && (
                  <div className="p-4 bg-red-500/10 rounded-lg text-center">
                    <p className="text-2xl font-bold text-red-400">{importResult.errores.length}</p>
                    <p className="text-sm text-slate-400">Con errores</p>
                  </div>
                )}
              </div>

              {importResult.errores.length > 0 && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg mb-4">
                  <p className="text-sm font-medium text-red-400 mb-2">Errores:</p>
                  <ul className="text-sm text-red-300/80 space-y-1 max-h-32 overflow-y-auto">
                    {importResult.errores.map((err, idx) => (
                      <li key={idx}>Fila {err.fila}: {err.error}</li>
                    ))}
                  </ul>
                </div>
              )}

              <Button onClick={handleReset} className="w-full bg-emerald-600 hover:bg-emerald-700">
                Importar otro archivo
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Instrucciones */}
        <Card className="bg-[#141e2e] border border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-sm text-slate-400">Instrucciones</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-500 space-y-2">
            <p>1. Descarga la plantilla de ejemplo para ver el formato correcto</p>
            <p>2. Las columnas <strong className="text-slate-300">OE</strong> (o idprod) y <strong className="text-slate-300">Costo</strong> son obligatorias</p>
            <p>3. Si el producto ya tiene costos registrados, se actualizarán y los valores anteriores se guardarán como respaldo</p>
            <p>4. Puedes usar la referencia OE del producto o su ID numérico (idprod)</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
