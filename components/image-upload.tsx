'use client';

import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';

interface ImageUploadProps {
  onImagesChange: (images: File[]) => void;
}

export function ImageUpload({ onImagesChange }: ImageUploadProps) {
  const inputId = useId();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onImagesChange(files);
    }
    // Reset input para permitir seleccionar el mismo archivo de nuevo
    e.target.value = '';
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => document.getElementById(inputId)?.click()}
        className="bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800"
      >
        <Upload className="h-4 w-4 mr-2" />
        Seleccionar Imágenes
      </Button>
      <input
        id={inputId}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/jpg"
        onChange={handleFileChange}
        className="hidden"
      />
    </>
  );
}