'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface ImageCarouselProps {
  images: string[];
  alt: string;
}

export function ImageCarousel({ images, alt }: ImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const nextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const goToImage = (index: number) => {
    setCurrentIndex(index);
  };

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  if (images.length === 0) {
    return (
      <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
        <p className="text-gray-500">Sin imágenes</p>
      </div>
    );
  }

  return (
    <>
      {/* Carrusel principal */}
      <div className="space-y-4">
        {/* Imagen principal */}
        <div className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden">
          <Image
            src={images[currentIndex]}
            alt={`${alt} - Imagen ${currentIndex + 1}`}
            fill
            className="object-cover cursor-zoom-in"
            onClick={openModal}
          />
          
          {/* Controles de navegación */}
          {images.length > 1 && (
            <>
              <Button
                variant="secondary"
                size="icon"
                className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100"
                onClick={prevImage}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100"
                onClick={nextImage}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}

          {/* Indicador de posición */}
          <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
            {currentIndex + 1} / {images.length}
          </div>
        </div>

        {/* Miniaturas */}
        {images.length > 1 && (
          <div className="flex space-x-2 overflow-x-auto pb-2">
            {images.map((image, index) => (
              <button
                key={index}
                className={`flex-shrink-0 w-16 h-16 relative rounded border-2 ${
                  index === currentIndex ? 'border-blue-500' : 'border-gray-300'
                }`}
                onClick={() => goToImage(index)}
              >
                <Image
                  src={image}
                  alt={`${alt} - Miniatura ${index + 1}`}
                  fill
                  className="object-cover rounded"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Modal para vista ampliada */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4">
          <div className="relative max-w-4xl max-h-full w-full">
            {/* Botón cerrar */}
            <Button
              variant="destructive"
              size="icon"
              className="absolute -top-10 right-0 z-10"
              onClick={closeModal}
            >
              <X className="h-4 w-4" />
            </Button>

            {/* Imagen ampliada */}
            <div className="relative aspect-square bg-black rounded-lg">
              <Image
                src={images[currentIndex]}
                alt={`${alt} - Imagen ${currentIndex + 1} (ampliada)`}
                fill
                className="object-contain"
              />
              
              {/* Controles en modal */}
              {images.length > 1 && (
                <>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100"
                    onClick={prevImage}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100"
                    onClick={nextImage}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              )}

              {/* Indicador en modal */}
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-70 text-white text-sm px-3 py-1 rounded">
                {currentIndex + 1} / {images.length}
              </div>
            </div>

            {/* Miniaturas en modal */}
            {images.length > 1 && (
              <div className="flex justify-center space-x-2 mt-4">
                {images.map((image, index) => (
                  <button
                    key={index}
                    className={`flex-shrink-0 w-12 h-12 relative rounded border-2 ${
                      index === currentIndex ? 'border-blue-500' : 'border-gray-300'
                    }`}
                    onClick={() => goToImage(index)}
                  >
                    <Image
                      src={image}
                      alt={`${alt} - Miniatura ${index + 1}`}
                      fill
                      className="object-cover rounded"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}