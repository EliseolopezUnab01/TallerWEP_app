'use client';

import type { ChangeEvent } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Trash2, Upload } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  allImages: string[];
  newImages: File[];
  currentImageIndex: number;
  setCurrentImageIndex: (indice: number) => void;
  prevImage: () => void;
  nextImage: () => void;
  deleteCurrentImage: () => void;
  handleNewImagesChange: (e: ChangeEvent<HTMLInputElement>) => void;
}

export function GaleriaImagenes({
  allImages,
  newImages,
  currentImageIndex,
  setCurrentImageIndex,
  prevImage,
  nextImage,
  deleteCurrentImage,
  handleNewImagesChange,
}: Props) {
  return (
    <Card className="bg-gradient-to-br from-white to-slate-50 dark:from-card dark:to-background border border-sky-200/70 dark:border-primary/30 shadow-[0_8px_30px_rgba(14,136,201,0.1)] dark:shadow-[0_0_20px_rgba(14,136,201,0.25)] rounded-xl overflow-hidden max-w-md mx-auto">
      <CardHeader className="py-2 px-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm text-slate-700 dark:text-slate-200 tracking-wide">GALERÍA DE IMÁGENES</CardTitle>
        <span className="text-xs text-emerald-400">{allImages.length + newImages.length}/10</span>
      </CardHeader>
      <CardContent className="p-3 space-y-3">
        <div className="relative w-full h-[180px] bg-slate-100 dark:bg-slate-900 rounded-xl overflow-hidden">
        {allImages.length > 0 ? (
          <>
            <div className="relative h-full w-full">
              <Image src={allImages[currentImageIndex]} alt="Producto" fill className="object-contain" />
            </div>
            <button type="button" onClick={prevImage} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full">
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button type="button" onClick={nextImage} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full">
              <ChevronRight className="h-6 w-6" />
            </button>
            <button type="button" onClick={deleteCurrentImage} className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-600 text-white p-2 rounded-full">
              <Trash2 className="h-4 w-4" />
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 px-3 py-1 rounded-full text-xs text-white">
              {currentImageIndex + 1} / {allImages.length}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full w-full p-4">
            <div className="rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-300 dark:border-slate-700/40 bg-slate-950/60 p-4 w-full h-full flex flex-col items-center justify-center">
              <Upload className="h-12 w-12 text-slate-800 dark:text-slate-500 mb-3" />
              <label htmlFor="image-upload-main" className="cursor-pointer">
                <div className="border border-primary/60 bg-primary/10 text-primary hover:bg-primary/20 px-4 py-2 rounded-lg text-sm font-medium">
                  Seleccionar Imágenes
                </div>
              </label>
              <input id="image-upload-main" type="file" multiple accept="image/*" onChange={handleNewImagesChange} className="hidden" />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 text-center">PNG, JPG, JPEG hasta 10MB</p>
            </div>
          </div>
        )}
      </div>
      {/* Miniaturas */}
      <div className="flex flex-wrap gap-2 items-center justify-center">
        {allImages.map((img, idx) => (
          <button key={idx} type="button" onClick={() => setCurrentImageIndex(idx)}
            className={`h-14 w-20 flex-shrink-0 rounded-md border overflow-hidden ${idx === currentImageIndex ? 'border-2 border-cyan-500' : 'border border-slate-700'}`}>
            <div className="relative h-full w-full">
              <Image src={img} alt="" fill className="object-cover" />
            </div>
          </button>
        ))}
        {newImages.map((img, idx) => (
          <div key={`new-${idx}`} className="h-14 w-20 flex-shrink-0 rounded-md border-2 border-emerald-500 bg-slate-100 dark:bg-slate-900 overflow-hidden">
            <img src={URL.createObjectURL(img)} alt={`Nueva ${idx + 1}`} className="h-full w-full object-cover" />
          </div>
        ))}
      </div>
      {allImages.length > 0 && (
        <div className="border-t border-slate-300 dark:border-slate-700/40 pt-3 text-center">
          <label htmlFor="image-upload-add" className="cursor-pointer inline-flex items-center gap-2 border border-primary/60 bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1.5 rounded-lg text-xs font-medium">
            <Upload className="h-3 w-3" /> Agregar Nuevas Imágenes
          </label>
          <input id="image-upload-add" type="file" multiple accept="image/*" onChange={handleNewImagesChange} className="hidden" />
        </div>
      )}
      </CardContent>
    </Card>
  );
}
