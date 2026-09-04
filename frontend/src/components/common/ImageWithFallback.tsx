import React, { useState, useEffect } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { fetchProduct } from '../../api/client';
import { ProductImage } from '../../types';

interface ImageWithFallbackProps {
  productId: string;
  initialSrc?: string | null;
  alt?: string;
  className?: string;
}

export const ImageWithFallback: React.FC<ImageWithFallbackProps> = ({
  productId,
  initialSrc,
  alt = '',
  className = '',
}) => {
  const [currentSrc, setCurrentSrc] = useState<string | null>(initialSrc || null);
  const [isFailed, setIsFailed] = useState<boolean>(!initialSrc);
  const [fallbackImages, setFallbackImages] = useState<ProductImage[] | null>(null);
  const [fallbackIndex, setFallbackIndex] = useState<number>(0);
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);

  useEffect(() => {
    setCurrentSrc(initialSrc || null);
    setIsFailed(!initialSrc);
    setFallbackImages(null);
    setFallbackIndex(0);
  }, [initialSrc, productId]);

  const handleError = async () => {
    if (!fallbackImages && !isLoadingDetails) {
      // Fetch product details to get all images
      setIsLoadingDetails(true);
      try {
        const detail = await fetchProduct(productId);
        if (detail.images && detail.images.length > 0) {
          setFallbackImages(detail.images);
          
          // If the initialSrc was from detail.images, we might want to skip the first one if it matches
          let startIndex = 0;
          if (detail.images[0].url === currentSrc && detail.images.length > 1) {
            startIndex = 1;
          }
          
          if (startIndex < detail.images.length) {
            setFallbackIndex(startIndex);
            setCurrentSrc(detail.images[startIndex].url);
          } else {
            setIsFailed(true);
          }
        } else {
          setIsFailed(true);
        }
      } catch (err) {
        setIsFailed(true);
      } finally {
        setIsLoadingDetails(false);
      }
    } else if (fallbackImages && fallbackIndex + 1 < fallbackImages.length) {
      // Try next image
      const nextIndex = fallbackIndex + 1;
      setFallbackIndex(nextIndex);
      setCurrentSrc(fallbackImages[nextIndex].url);
    } else {
      // No more fallbacks
      setIsFailed(true);
    }
  };

  if (isFailed || !currentSrc) {
    return (
      <div className={`flex flex-col items-center justify-center bg-slate-50 border border-slate-200 text-slate-400 ${className}`}>
        <ImageIcon className="w-8 h-8 opacity-50 mb-1" />
        <span className="text-[10px] font-medium px-2 text-center leading-tight">Image unavailable</span>
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      onError={handleError}
    />
  );
};
