'use client';

import { DashboardLayout } from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertTriangle, RefreshCw, Download } from 'lucide-react';
import { useState, useRef } from 'react';

interface PreviewData {
  headers: string[];
  columnMapping: { [key: number]: string };
  totalFilas: number;
  productosValidos: number;
  errores: { fila: number; error: string }[];
  preview: any[];
}

interface ImportResult {
  insertados: number;
  actualizados: number;
  errores: { fila: number; error: string }[];
}

export default function ImportarProductosPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (selectedFile: File) => {
    // Validar extensión
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
    setDebugInfo(null);

    // Obtener preview
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('action', 'preview');

      const response = await fetch('/api/importar-productos', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      
      // Guardar info de debug
      if (data.debug) {
        setDebugInfo(data.debug);
      }

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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    await processFile(selectedFile);
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      await processFile(droppedFile);
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

      const response = await fetch('/api/importar-productos', {
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
    // Crear plantilla de ejemplo
    const template = `OE,Nombre,Descripcion,Marca,Stock Contable,Stock Fisico,Costo,Codigo Barras,Etiquetas,Aplicacion
REF-001,Producto Ejemplo 1,Descripción del producto,MARCA1,10,10,100.00,123456789,motor,Toyota Corolla 2020
REF-002,Producto Ejemplo 2,Otra descripción,MARCA2,5,5,50.00,987654321,frenos,Honda Civic 2019`;
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla_productos.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Importar Productos</h1>
            <p className="text-slate-400">Carga masiva de productos desde archivo Excel</p>
          </div>
          <Button
            variant="outline"
            onClick={downloadTemplate}
            className="border-[#0e88c9]/50 text-[#0e88c9] hover:bg-[#0e88c9]/10"
          >
            <Download className="h-4 w-4 mr-2" />
            Descargar Plantilla
          </Button>
        </div>

        {/* Zona de carga */}
        <Card className="bg-[#141e2e] border border-[#0e88c9]/30">
          <CardHeader>
            <CardTitle className="text-lg text-slate-100 flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
              Cargar Archivo
            </CardTitle>
            <CardDescription>
              Formatos soportados: .xlsx, .xls, .csv | Columnas requeridas: OE (Referencia), Nombre
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div 
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                isDragging ? 'border-[#0e88c9] bg-[#0e88c9]/10' :
                file ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-slate-700 hover:border-[#0e88c9]/50'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
              />
              
              {!file ? (
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className={`h-12 w-12 mx-auto mb-4 ${isDragging ? 'text-[#0e88c9]' : 'text-slate-500'}`} />
                  <p className="text-slate-300 mb-2">
                    {isDragging ? 'Suelta el archivo aquí' : 'Arrastra un archivo aquí o haz clic para seleccionar'}
                  </p>
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
              <div className="flex items-center justify-center gap-2 mt-4 text-[#0e88c9]">
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

            {/* Debug info */}
            {debugInfo && (
              <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-xs text-yellow-400 font-bold mb-2">🔍 Debug Info:</p>
                <pre className="text-xs text-yellow-300/80 overflow-auto max-h-40">
                  {JSON.stringify(debugInfo, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Preview de datos */}
        {previewData && (
          <Card className="bg-[#141e2e] border border-[#0e88c9]/30">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg text-slate-100">Vista Previa</CardTitle>
                  <CardDescription>Revisa los datos antes de importar</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline" className="text-emerald-400 border-emerald-500/50">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {previewData.productosValidos} válidos
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
                    <Badge key={index} variant="secondary" className="bg-[#0e88c9]/20 text-[#0e88c9]">
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
                      <th className="text-left py-2 px-3 text-slate-400">OE</th>
                      <th className="text-left py-2 px-3 text-slate-400">Nombre</th>
                      <th className="text-left py-2 px-3 text-slate-400">Marca</th>
                      <th className="text-right py-2 px-3 text-slate-400">Stock</th>
                      <th className="text-right py-2 px-3 text-slate-400">Costo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.preview.map((producto, idx) => (
                      <tr key={idx} className="border-b border-slate-800">
                        <td className="py-2 px-3 text-slate-500">{producto._fila}</td>
                        <td className="py-2 px-3 text-[#0e88c9]">{producto.OE}</td>
                        <td className="py-2 px-3 text-slate-200">{producto.nombre}</td>
                        <td className="py-2 px-3 text-slate-400">{producto.marca || '-'}</td>
                        <td className="py-2 px-3 text-right text-slate-300">{producto.stock_contable}</td>
                        <td className="py-2 px-3 text-right text-emerald-400">${producto.costo?.toFixed(2) || '0.00'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {previewData.productosValidos > 10 && (
                  <p className="text-center text-sm text-slate-500 mt-2">
                    Mostrando 10 de {previewData.productosValidos} productos
                  </p>
                )}
              </div>

              {/* Errores de validación */}
              {previewData.errores.length > 0 && (
                <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <p className="text-sm font-medium text-amber-400 mb-2">Filas con errores (no se importarán):</p>
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
                  disabled={importing || previewData.productosValidos === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {importing ? (
                    <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Importando...</>
                  ) : (
                    <><Upload className="h-4 w-4 mr-2" /> Importar {previewData.productosValidos} productos</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Resultado de importación */}
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
                  <p className="text-2xl font-bold text-emerald-400">{importResult.insertados}</p>
                  <p className="text-sm text-slate-400">Productos nuevos</p>
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
                  <p className="text-sm font-medium text-red-400 mb-2">Errores durante la importación:</p>
                  <ul className="text-sm text-red-300/80 space-y-1 max-h-32 overflow-y-auto">
                    {importResult.errores.map((err, idx) => (
                      <li key={idx}>Fila {err.fila}: {err.error}</li>
                    ))}
                  </ul>
                </div>
              )}

              <Button onClick={handleReset} className="w-full bg-[#0e88c9] hover:bg-[#0e88c9]/90">
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
            <p>2. Las columnas <strong className="text-slate-300">OE</strong> (Referencia) y <strong className="text-slate-300">Nombre</strong> son obligatorias</p>
            <p>3. Si un producto con el mismo OE ya existe, se actualizará en lugar de duplicarse</p>
            <p>4. Los nombres de columnas son flexibles (ej: "Stock", "Stock Contable", "stock_contable" funcionan igual)</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
