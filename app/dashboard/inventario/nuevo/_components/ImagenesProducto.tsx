'use client';

import type { Dispatch, SetStateAction } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ImageUpload } from '@/components/image-upload';

interface Props {
  images: File[];
  setImages: Dispatch<SetStateAction<File[]>>;
  selectedImageIndex: number;
  setSelectedImageIndex: Dispatch<SetStateAction<number>>;
  handleImagesChange: (nuevas: File[]) => void;
}

export function ImagenesProducto({ images, setImages, selectedImageIndex, setSelectedImageIndex, handleImagesChange }: Props) {
  return (
    <Card className="bg-gradient-to-br from-white to-slate-50 dark:from-card dark:to-background border border-sky-200/70 dark:border-primary/30 shadow-[0_8px_30px_rgba(14,136,201,0.1)] dark:shadow-[0_0_20px_rgba(14,136,201,0.25)] rounded-xl overflow-hidden">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm text-slate-700 dark:text-slate-200 tracking-wide">IMÁGENES</CardTitle>
        <span className="text-xs text-emerald-400">{images.length}/10</span>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Imagen principal grande */}
        <div className="relative w-full h-[200px] bg-slate-100 dark:bg-slate-900 rounded-2xl overflow-hidden">
          {images.length > 0 ? (
            <>
              <img 
                src={URL.createObjectURL(images[selectedImageIndex] || images[0])} 
                alt="Vista previa" 
                className="h-full w-full object-contain"
              />
              <button
                type="button"
                onClick={() => {
                  setImages(prev => prev.filter((_, i) => i !== selectedImageIndex));
                  setSelectedImageIndex(0);
                }}
                className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg transition-colors"
              >
                ×
              </button>
              <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                {selectedImageIndex + 1} / {images.length}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full w-full p-4">
              <div className="rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-300 dark:border-slate-700/40 bg-slate-950/60 p-4 w-full h-full flex flex-col items-center justify-center">
                <ImageUpload onImagesChange={handleImagesChange} />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  PNG, JPG, JPEG hasta 10MB. Máximo 10 imágenes.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Botón agregar más y miniaturas */}
        {images.length > 0 && (
          <div className="space-y-3">
            <div className="flex justify-center">
              <ImageUpload onImagesChange={handleImagesChange} />
            </div>

            {/* Grid de miniaturas con drag & drop */}
            {images.length > 1 && (
              <div className="space-y-2">
                <p className="text-xs text-slate-400">Arrastra para reordenar</p>
                <div className="grid grid-cols-5 gap-2">
                  {images.map((img, idx) => (
                    <div 
                      key={idx} 
                      className={`relative aspect-square rounded-lg border-2 overflow-hidden group cursor-pointer ${
                        idx === selectedImageIndex 
                          ? 'border-primary bg-slate-800 ring-2 ring-primary/50' 
                          : 'border-slate-700/50 bg-slate-100 dark:bg-slate-900 hover:border-slate-500'
                      }`}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', idx.toString());
                        e.currentTarget.style.opacity = '0.5';
                      }}
                      onDragEnd={(e) => {
                        e.currentTarget.style.opacity = '1';
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'));
                        const targetIndex = idx;

                        if (draggedIndex !== targetIndex) {
                          const newImages = [...images];
                          const [draggedImage] = newImages.splice(draggedIndex, 1);
                          newImages.splice(targetIndex, 0, draggedImage);
                          setImages(newImages);
                        }
                      }}
                    >
                      <img 
                        src={URL.createObjectURL(img)} 
                        alt={`Imagen ${idx + 1}`} 
                        className="h-full w-full object-cover"
                        onClick={() => setSelectedImageIndex(idx)}
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setImages(prev => prev.filter((_, i) => i !== idx));
                          if (selectedImageIndex >= idx && selectedImageIndex > 0) {
                            setSelectedImageIndex(prev => prev - 1);
                          }
                        }}
                        className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ×
                      </button>
                      {idx === selectedImageIndex && (
                        <div className="absolute inset-0 border-2 border-primary rounded-lg pointer-events-none"></div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
