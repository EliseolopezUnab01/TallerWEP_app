'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { X, Upload, ZoomIn } from 'lucide-react';
import Image from 'next/image';

interface ImageUploadProps {
  onImagesChange: (images: File[]) => void;
}

export function ImageUpload({ onImagesChange }: ImageUploadProps) {
  const [images, setImages] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (files.length + images.length > 10) {
      alert('Máximo 10 imágenes permitidas');
      return;
    }

    const newImages = [...images, ...files.slice(0, 10 - images.length)];
    setImages(newImages);
    onImagesChange(newImages);

    // Crear URLs para previsualización
    const newPreviewUrls = newImages.map(file => URL.createObjectURL(file));
    
    // Revocar URLs antiguas para liberar memoria
    previewUrls.forEach(url => URL.revokeObjectURL(url));
    
    setPreviewUrls(newPreviewUrls);
  }, [images, onImagesChange, previewUrls]);

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    const newPreviewUrls = previewUrls.filter((_, i) => i !== index);
    
    setImages(newImages);
    setPreviewUrls(newPreviewUrls);
    onImagesChange(newImages);

    // Revocar URL para liberar memoria
    URL.revokeObjectURL(previewUrls[index]);
  };

  const openImage = (url: string) => {
    setSelectedImage(url);
  };

  const closeImage = () => {
    setSelectedImage(null);
  };

  // Limpiar URLs al desmontar el componente
  const cleanup = useCallback(() => {
    previewUrls.forEach(url => URL.revokeObjectURL(url));
  }, [previewUrls]);

  // Efecto de limpieza
  useState(() => {
    return () => cleanup();
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Imágenes del Producto</label>
        <span className="text-sm text-gray-500">
          {images.length}/10 imágenes
        </span>
      </div>

      {/* Área de carga */}
      <Card>
        <CardContent className="p-6">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <Upload className="mx-auto h-8 w-8 text-gray-400" />
            <div className="mt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById('image-upload')?.click()}
              >
                Seleccionar Imágenes
              </Button>
              <input
                id="image-upload"
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              PNG, JPG, JPEG hasta 10MB. Máximo 10 imágenes.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Previsualización de imágenes */}
      {previewUrls.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h4 className="text-sm font-medium mb-4">Vista previa</h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {previewUrls.map((url, index) => (
                <div key={index} className="relative group">
                  <div className="aspect-square relative rounded-lg overflow-hidden border">
                    <Image
                      src={url}
                      alt={`Preview ${index + 1}`}
                      fill
                      className="object-cover cursor-pointer"
                      onClick={() => openImage(url)}
                      sizes="(max-width: 768px) 50vw, 20vw"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 bg-white bg-opacity-80 hover:bg-opacity-100 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => openImage(url)}
                      >
                        <ZoomIn className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeImage(index)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                  <div className="absolute bottom-1 left-1 bg-black bg-opacity-70 text-white text-xs px-1 rounded">
                    {index + 1}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal para ver imagen en grande */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4">
          <div className="relative max-w-4xl max-h-full">
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute -top-10 right-0 z-10"
              onClick={closeImage}
            >
              <X className="h-4 w-4" />
            </Button>
            <div className="relative w-full h-96 md:h-[500px]">
              <Image
                src={selectedImage}
                alt="Imagen ampliada"
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 80vw"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}