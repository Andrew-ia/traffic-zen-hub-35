import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useCreativeLibrary } from "@/hooks/useCreativeLibrary";
import { MediaThumb } from "@/components/creatives/MediaThumb";
import { Search, PlayCircle } from "lucide-react";

function formatBytes(bytes: number | null) {
  if (!bytes || !Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatSeconds(sec: number | null) {
  if (!sec || !Number.isFinite(sec)) return "—";
  const minutes = Math.floor(sec / 60);
  const seconds = Math.floor(sec % 60);
  return `${minutes}m ${seconds}s`;
}

export default function Videos() {
  const [searchTerm, setSearchTerm] = useState("");
  const { data: creativeData, isLoading, error } = useCreativeLibrary({ days: 30, onlyType: 'video', includeAssociations: false, limit: 200 });

  const videos = useMemo(() => {
    const all = creativeData ?? [];
    const filtered = all.filter((c) => (c.type || "").toLowerCase() === "video");
    const search = searchTerm.trim().toLowerCase();
    if (!search) return filtered;
    return filtered.filter((c) => (c.name || "").toLowerCase().includes(search));
  }, [creativeData, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Vídeos</h1>
          <p className="mt-1 text-muted-foreground">Biblioteca de criativos em vídeo com métricas agregadas dos últimos 30 dias.</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar vídeos..."
          className="pl-10"
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Erro ao carregar vídeos</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="mb-3 h-5 w-2/3" />
                <Skeleton className="h-[160px] w-full" />
                <div className="mt-3 flex items-center gap-2">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {videos.map((video) => (
            <Card key={video.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <PlayCircle className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium truncate" title={video.name}>{video.name || "Vídeo"}</span>
                  </div>
                  <Badge variant="outline">{formatSeconds(video.durationSeconds)}</Badge>
                </div>
                <div className="mt-3">
                  <MediaThumb
                    thumbnailUrl={video.thumbnailUrl}
                    url={video.storageUrl}
                    type="video"
                    className="h-[160px]"
                  />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                  <div>
                    <span className="font-medium text-foreground">CTR</span>
                    <div>{video.metrics.ctr !== null ? `${video.metrics.ctr.toFixed(2)}%` : "—"}</div>
                  </div>
                  <div>
                    <span className="font-medium text-foreground">CPC</span>
                    <div>{video.metrics.cpc !== null ? `R$ ${video.metrics.cpc.toFixed(2)}` : "—"}</div>
                  </div>
                  <div>
                    <span className="font-medium text-foreground">CPA</span>
                    <div>{video.metrics.cpa !== null ? `R$ ${video.metrics.cpa.toFixed(2)}` : "—"}</div>
                  </div>
                  <div>
                    <span className="font-medium text-foreground">ROAS</span>
                    <div>{video.metrics.roas !== null ? `${video.metrics.roas.toFixed(2)}x` : "—"}</div>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Aspecto: {video.aspectRatio || "—"}</span>
                  <span>Tamanho: {formatBytes(video.fileSizeBytes)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
