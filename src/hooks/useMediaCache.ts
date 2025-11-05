import { useEffect, useRef, useState } from "react";

type CacheEntry = {
  blobUrl: string;
  size: number;
  createdAt: number;
};

class LruCache {
  private maxEntries: number;
  private map: Map<string, CacheEntry>;

  constructor(maxEntries = 50) {
    this.maxEntries = maxEntries;
    this.map = new Map();
  }

  get(key: string): CacheEntry | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    // bump to end
    this.map.delete(key);
    this.map.set(key, entry);
    return entry;
  }

  set(key: string, value: CacheEntry) {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.maxEntries) {
      const oldestKey = this.map.keys().next().value as string | undefined;
      if (oldestKey) {
        const oldest = this.map.get(oldestKey);
        if (oldest?.blobUrl) URL.revokeObjectURL(oldest.blobUrl);
        this.map.delete(oldestKey);
      }
    }
  }

  clear() {
    for (const [, entry] of this.map) {
      if (entry.blobUrl) URL.revokeObjectURL(entry.blobUrl);
    }
    this.map.clear();
  }
}

const globalCache = new LruCache(50);

export function useMediaCache(url?: string | null) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const activeUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let aborted = false;
    const sourceUrl = url ?? null;
    activeUrlRef.current = sourceUrl;

    if (!sourceUrl) {
      setBlobUrl(null);
      setError(null);
      setLoading(false);
      return;
    }

    const cached = globalCache.get(sourceUrl);
    if (cached) {
      setBlobUrl(cached.blobUrl);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch(sourceUrl)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const objUrl = URL.createObjectURL(blob);
        if (aborted) {
          URL.revokeObjectURL(objUrl);
          return;
        }
        globalCache.set(sourceUrl, {
          blobUrl: objUrl,
          size: blob.size,
          createdAt: Date.now(),
        });
        // only set if this is the last requested url
        if (activeUrlRef.current === sourceUrl) {
          setBlobUrl(objUrl);
          setError(null);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (aborted) return;
        setError((e as Error).message);
        setBlobUrl(null);
        setLoading(false);
      });

    return () => {
      aborted = true;
    };
  }, [url]);

  return { blobUrl, error, loading };
}

