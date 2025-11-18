import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useMediaCache } from "@/hooks/useMediaCache";

interface MediaThumbProps {
  thumbnailUrl?: string | null;
  url?: string | null;
  type?: "image" | "video" | null;
  alt?: string;
  className?: string;
  onClick?: () => void;
}

export function MediaThumb({ thumbnailUrl, url, type = "image", alt, className, onClick }: MediaThumbProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [useFullUrl, setUseFullUrl] = useState<boolean>(false);
  const isVideo = type === "video";

  // Intersection Observer for lazy fetch
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
            break;
          }
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Para vídeos, evitamos baixar via fetch/cache (pesado e sujeito a CORS)
  // Carregamos diretamente a URL do vídeo e usamos a thumb apenas como poster.
  const primaryUrl = useFullUrl ? url ?? undefined : thumbnailUrl ?? url ?? undefined;
  const requestedUrl = isVisible ? (isVideo ? undefined : primaryUrl) : undefined;
  const { blobUrl, error, loading } = useMediaCache(requestedUrl);

  // Fallback: if thumb fails, try full url
  useEffect(() => {
    if (!isVideo && error && !useFullUrl && url) {
      setUseFullUrl(true);
    }
  }, [error, useFullUrl, url, isVideo]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-hidden rounded-md bg-muted",
        "flex items-center justify-center",
        className
      )}
      onClick={onClick}
    >
      {!isVisible && (
        <div className="h-full w-full" />
      )}
      {isVisible && (
        isVideo ? (
          <>
            <video
              className="h-full w-full object-cover"
              src={url ?? undefined}
              poster={thumbnailUrl ?? undefined}
              muted
              playsInline
              preload="none"
              controls
              referrerPolicy="no-referrer"
            />
            {url && (
              <a
                href={url}
                download
                target="_blank"
                rel="noreferrer"
                className="absolute bottom-2 right-2 rounded bg-black/50 px-2 py-1 text-xs text-white"
                onClick={(e) => e.stopPropagation()}
              >
                Baixar
              </a>
            )}
          </>
        ) : (
          <img
            className="h-full w-full object-cover"
            src={blobUrl ?? (primaryUrl ?? undefined)}
            alt={alt ?? ""}
            loading="lazy"
            onError={() => setUseFullUrl(true)}
          />
        )
      )}
      {loading && (
        <div className="absolute inset-0 animate-pulse bg-muted" />
      )}
    </div>
  );
}
