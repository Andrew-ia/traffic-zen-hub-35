import React, { useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface InstagramMediaProps {
  src?: string;
  alt?: string;
  className?: string;
  type?: 'image' | 'video';
  poster?: string;
  thumbnailSrc?: string;
}

export function InstagramMedia({ 
  src, 
  alt, 
  className = '', 
  type = 'image',
  poster,
  thumbnailSrc
}: InstagramMediaProps) {
  const [hasError, setHasError] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 ${className}`}>
        <AlertCircle className="w-8 h-8 text-gray-400" />
        <span className="text-gray-500 text-sm ml-2">Mídia não disponível</span>
      </div>
    );
  }

  const handleRetry = async () => {
    setIsRetrying(true);
    setHasError(false);
    // Small delay to show loading state
    setTimeout(() => {
      setIsRetrying(false);
    }, 1000);
  };

  const handleError = () => {
    setHasError(true);
    setIsRetrying(false);
  };

  if (hasError) {
    return (
      <div className={`flex flex-col items-center justify-center bg-gray-50 border-2 border-dashed border-gray-200 ${className}`}>
        <AlertCircle className="w-6 h-6 text-orange-500 mb-2" />
        <p className="text-gray-600 text-sm mb-2 text-center px-2">
          Instagram bloqueou o carregamento desta mídia
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRetry}
          disabled={isRetrying}
          className="text-xs"
        >
          {isRetrying ? (
            <>
              <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
              Tentando...
            </>
          ) : (
            <>
              <RefreshCw className="w-3 h-3 mr-1" />
              Tentar novamente
            </>
          )}
        </Button>
      </div>
    );
  }

  if (type === 'video') {
    return (
      <video 
        src={src}
        className={className}
        muted 
        playsInline 
        preload="metadata" 
        poster={poster || thumbnailSrc}
        referrerPolicy="no-referrer"
        controls
        onError={handleError}
        crossOrigin="anonymous"
      />
    );
  }

  return (
    <img 
      src={src}
      alt={alt}
      className={className}
      onError={handleError}
      referrerPolicy="no-referrer"
      crossOrigin="anonymous"
    />
  );
}