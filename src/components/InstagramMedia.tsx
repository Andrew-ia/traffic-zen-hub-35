import React from 'react';
import { Image as ImageIcon, Video as VideoIcon, Instagram } from 'lucide-react';

interface InstagramMediaPlaceholderProps {
  type?: 'image' | 'video';
  className?: string;
}

export function InstagramMedia({ 
  type = 'image',
  className = ''
}: InstagramMediaPlaceholderProps) {
  
  return (
    <div className={`flex flex-col items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50 border border-gray-200 ${className}`}>
      <div className="flex items-center gap-2 text-gray-600">
        {type === 'video' ? (
          <VideoIcon className="w-6 h-6" />
        ) : (
          <ImageIcon className="w-6 h-6" />
        )}
        <Instagram className="w-5 h-5 text-purple-600" />
      </div>
      <span className="text-xs text-gray-500 mt-1 text-center">
        {type === 'video' ? 'Vídeo' : 'Imagem'} do Instagram
      </span>
    </div>
  );
}