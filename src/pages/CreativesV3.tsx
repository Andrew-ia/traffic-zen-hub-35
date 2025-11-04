import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCreativeLibrary } from "@/hooks/useCreativeLibrary";
import {
  Plus,
  Search,
  Upload,
  Image as ImageIcon,
  Video,
  FileText,
  Download,
  Share2,
  MoreVertical,
  Folder,
  MessageCircle,
  Instagram,
  AlertCircle,
} from "lucide-react";

// Types
interface CreativeFolder {
  id: string;
  name: string;
  count: number;
  icon: React.ReactNode;
}

const TYPE_TAB_MAP: Record<string, string | null> = {
  all: null,
  images: "image",
  videos: "video",
  campaigns: "campaign",
  tryon: "virtual-tryon",
};

// Utility functions
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

// Creative Thumbnail Component
function CreativeThumbnail({
  creative,
  onDownload,
  onShareWhatsApp,
  onShareInstagram,
}: {
  creative: any;
  onDownload: () => void;
  onShareWhatsApp: () => void;
  onShareInstagram: () => void;
}) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const renderMedia = () => {
    const url = creative.thumbnailUrl || creative.storageUrl;

    if (creative.type === "video") {
      // Videos show thumbnail image, not the video player
      const thumbnailUrl = creative.thumbnailUrl || creative.storageUrl;

      return (
        <div className="relative h-full w-full overflow-hidden rounded-lg bg-muted">
          {!imageLoaded && !imageError && thumbnailUrl && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}
          {imageError || !thumbnailUrl ? (
            <div className="flex h-full w-full flex-col items-center justify-center">
              <Video className="mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Vídeo</p>
            </div>
          ) : (
            <img
              src={thumbnailUrl}
              alt={creative.name}
              className={`h-full w-full object-cover transition-opacity duration-300 ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              loading="lazy"
              onLoad={() => setImageLoaded(true)}
              onError={() => {
                console.error(`Failed to load video thumbnail: ${thumbnailUrl}`);
                setImageError(true);
              }}
            />
          )}
          {/* Video badge overlay */}
          <div className="absolute bottom-2 right-2">
            <Badge variant="secondary" className="bg-black/60 text-white">
              <Video className="mr-1 h-3 w-3" />
              Vídeo
            </Badge>
          </div>
          {/* Play button overlay */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm">
              <div className="ml-1 h-0 w-0 border-y-[8px] border-l-[14px] border-y-transparent border-l-white" />
            </div>
          </div>
        </div>
      );
    }

    // Image type
    if (url) {
      return (
        <div className="relative h-full w-full overflow-hidden rounded-lg bg-muted">
          {!imageLoaded && !imageError && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}
          {imageError ? (
            <div className="flex h-full w-full flex-col items-center justify-center p-4 text-center">
              <AlertCircle className="mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                Erro ao carregar imagem
              </p>
              <p className="mt-1 text-xs text-muted-foreground/60 line-clamp-2">
                {url}
              </p>
            </div>
          ) : (
            <img
              src={url}
              alt={creative.name}
              className={`h-full w-full object-cover transition-opacity duration-300 ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              loading="lazy"
              onLoad={() => setImageLoaded(true)}
              onError={() => {
                console.error(`Failed to load image: ${url}`);
                setImageError(true);
              }}
            />
          )}
        </div>
      );
    }

    return (
      <div className="flex h-full w-full items-center justify-center rounded-lg bg-muted">
        <ImageIcon className="h-8 w-8 text-muted-foreground" />
      </div>
    );
  };

  return (
    <Card className="group relative overflow-hidden transition-all hover:shadow-lg">
      <CardContent className="p-0">
        {/* Thumbnail - Square aspect ratio */}
        <div className="aspect-square w-full overflow-hidden">
          {renderMedia()}
        </div>

        {/* Hover overlay with actions */}
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            size="sm"
            variant="secondary"
            onClick={onDownload}
            className="h-8 w-8 p-0"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={onShareWhatsApp}
            className="h-8 w-8 p-0"
          >
            <MessageCircle className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={onShareInstagram}
            className="h-8 w-8 p-0"
          >
            <Instagram className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="secondary" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onDownload}>
                <Download className="mr-2 h-4 w-4" />
                Download
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onShareWhatsApp}>
                <MessageCircle className="mr-2 h-4 w-4" />
                Enviar WhatsApp
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onShareInstagram}>
                <Instagram className="mr-2 h-4 w-4" />
                Postar Instagram
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Info footer */}
        <div className="p-3">
          <h3 className="mb-1 text-sm font-medium line-clamp-1" title={creative.name}>
            {creative.name}
          </h3>

          {/* Show text content if available */}
          {creative.textContent && (
            <p className="mb-2 text-xs text-muted-foreground line-clamp-2" title={creative.textContent}>
              {creative.textContent}
            </p>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{formatBytes(creative.fileSizeBytes)}</span>
            {creative.aspectRatio && <span>{creative.aspectRatio}</span>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Main Component
export default function CreativesV3() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<keyof typeof TYPE_TAB_MAP>("all");
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  const { data: creativeData, isLoading, error } = useCreativeLibrary({ days: 30 });

  // Folders
  const folders: CreativeFolder[] = useMemo(() => {
    if (!creativeData) return [];

    const campaignCreatives = creativeData.filter(c => c.campaignCount > 0);
    const tryonCreatives = creativeData.filter(c =>
      c.metadata && 'source' in c.metadata && c.metadata.source === 'virtual-tryon'
    );

    return [
      {
        id: 'all',
        name: 'Todos os Criativos',
        count: creativeData.length,
        icon: <Folder className="h-4 w-4" />,
      },
      {
        id: 'campaigns',
        name: 'Criativos de Campanhas',
        count: campaignCreatives.length,
        icon: <Share2 className="h-4 w-4" />,
      },
      {
        id: 'tryon',
        name: 'Virtual Try-On',
        count: tryonCreatives.length,
        icon: <ImageIcon className="h-4 w-4" />,
      },
    ];
  }, [creativeData]);

  // Filtered creatives - ONLY show creatives with images
  const filteredCreatives = useMemo(() => {
    if (!creativeData) return [];

    const term = searchTerm.trim().toLowerCase();
    const typeFilter = TYPE_TAB_MAP[activeTab];

    return creativeData.filter((creative) => {
      // CRITICAL: Only show creatives that have an image
      const hasImage = !!(creative.thumbnailUrl || creative.storageUrl);
      if (!hasImage) return false;

      // Search filter
      const matchesSearch =
        !term ||
        creative.name.toLowerCase().includes(term) ||
        (creative.textContent ?? "").toLowerCase().includes(term);

      // Type filter
      let matchesType = true;
      if (typeFilter === "campaign") {
        matchesType = creative.campaignCount > 0;
      } else if (typeFilter === "virtual-tryon") {
        matchesType = creative.metadata && 'source' in creative.metadata && creative.metadata.source === 'virtual-tryon';
      } else if (typeFilter === "image" || typeFilter === "video") {
        // For image/video filters, check the type
        matchesType = creative.type?.toLowerCase() === typeFilter;
      }

      // Folder filter
      let matchesFolder = true;
      if (selectedFolder && selectedFolder !== 'all') {
        if (selectedFolder === 'campaigns') {
          matchesFolder = creative.campaignCount > 0;
        } else if (selectedFolder === 'tryon') {
          matchesFolder = creative.metadata && 'source' in creative.metadata && creative.metadata.source === 'virtual-tryon';
        }
      }

      return matchesSearch && matchesType && matchesFolder;
    });
  }, [creativeData, activeTab, searchTerm, selectedFolder]);

  // Actions
  const handleDownload = async (creative: any) => {
    // For videos, use storageUrl (the actual video file)
    // For images, use storageUrl first, then thumbnailUrl
    const url = creative.storageUrl || creative.thumbnailUrl;
    if (!url) {
      alert("URL de download não disponível");
      return;
    }

    try {
      // Fetch the file as a blob to bypass CORS issues
      const response = await fetch(url);
      const blob = await response.blob();

      // Create a temporary URL for the blob
      const blobUrl = window.URL.createObjectURL(blob);

      // Determine file extension based on type
      let extension = 'jpg';
      if (creative.type === 'video') {
        // Get extension from blob type or default to mp4
        const mimeType = blob.type;
        if (mimeType.includes('mp4')) extension = 'mp4';
        else if (mimeType.includes('webm')) extension = 'webm';
        else if (mimeType.includes('mov')) extension = 'mov';
        else if (mimeType.includes('avi')) extension = 'avi';
        else extension = 'mp4'; // default for videos
      } else {
        // For images
        const mimeType = blob.type;
        if (mimeType.includes('png')) extension = 'png';
        else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) extension = 'jpg';
        else if (mimeType.includes('webp')) extension = 'webp';
        else if (mimeType.includes('gif')) extension = 'gif';
        else extension = 'jpg'; // default for images
      }

      // Create a temporary link and trigger download
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${creative.name || 'creative'}.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up the blob URL
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Erro ao baixar arquivo:', error);
      // Fallback: open in new tab if fetch fails
      window.open(url, '_blank');
    }
  };

  const handleShareWhatsApp = async (creative: any) => {
    const url = creative.storageUrl || creative.thumbnailUrl;
    if (!url) {
      alert("URL não disponível para compartilhamento");
      return;
    }

    try {
      // Try to fetch the image and share as blob if Web Share API is available
      if (navigator.share) {
        const response = await fetch(url);
        const blob = await response.blob();
        const file = new File([blob], `${creative.name || 'creative'}.jpg`, { type: blob.type });

        await navigator.share({
          title: creative.name,
          text: creative.textContent || 'Confira este criativo',
          files: [file],
        });
      } else {
        // Fallback: WhatsApp Web with text and URL
        const text = `${creative.textContent || creative.name}`;
        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text + '\n' + url)}`;
        window.open(whatsappUrl, '_blank');
      }
    } catch (error) {
      console.error('Erro ao compartilhar no WhatsApp:', error);
      // Fallback: WhatsApp Web with text and URL
      const text = `${creative.textContent || creative.name}`;
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text + '\n' + url)}`;
      window.open(whatsappUrl, '_blank');
    }
  };

  const handleShareInstagram = async (creative: any) => {
    const url = creative.storageUrl || creative.thumbnailUrl;
    if (!url) {
      alert("URL não disponível");
      return;
    }

    try {
      // Fetch the image as blob
      const response = await fetch(url);
      const blob = await response.blob();

      // Copy image to clipboard
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob
        })
      ]);

      alert("✅ Imagem copiada! Cole no Instagram Stories ou Feed.");

      // Open Instagram in new tab
      setTimeout(() => {
        window.open('https://www.instagram.com/', '_blank');
      }, 500);
    } catch (error) {
      console.error('Erro ao copiar imagem:', error);

      // Fallback: download the image
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `${creative.name || 'creative'}_instagram.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);

        alert("📥 Imagem baixada! Faça upload manualmente no Instagram.");
        window.open('https://www.instagram.com/', '_blank');
      } catch (downloadError) {
        alert("❌ Erro ao processar imagem. Tente abrir a imagem diretamente.");
        window.open(url, '_blank');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Biblioteca de Criativos</h1>
          <p className="mt-1 text-muted-foreground">
            Organize e compartilhe seus criativos para WhatsApp e Instagram
          </p>
          {creativeData && (
            <p className="mt-1 text-xs text-muted-foreground">
              {filteredCreatives.length} de {creativeData.length} criativos
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Upload className="mr-2 h-4 w-4" />
            Upload
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Novo Criativo
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar criativos..."
          className="pl-10"
        />
      </div>

      {/* Folders */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {folders.map((folder) => (
          <Button
            key={folder.id}
            variant={selectedFolder === folder.id ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedFolder(folder.id)}
            className="flex-shrink-0"
          >
            {folder.icon}
            <span className="ml-2">{folder.name}</span>
            <Badge variant="secondary" className="ml-2">
              {folder.count}
            </Badge>
          </Button>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro ao carregar criativos</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as keyof typeof TYPE_TAB_MAP)}>
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="images">Imagens</TabsTrigger>
          <TabsTrigger value="videos">Vídeos</TabsTrigger>
          <TabsTrigger value="campaigns">Campanhas</TabsTrigger>
          <TabsTrigger value="tryon">Try-On</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {/* Loading state */}
          {isLoading && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-0">
                    <Skeleton className="aspect-square w-full" />
                    <div className="p-3">
                      <Skeleton className="mb-2 h-4 w-full" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && filteredCreatives.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
                <FileText className="h-10 w-10 text-muted-foreground" />
                <p className="text-muted-foreground">
                  Nenhum criativo encontrado para os filtros selecionados.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Grid of thumbnails - 5+ per row on large screens */}
          {!isLoading && filteredCreatives.length > 0 && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
              {filteredCreatives.map((creative) => (
                <CreativeThumbnail
                  key={creative.id}
                  creative={creative}
                  onDownload={() => handleDownload(creative)}
                  onShareWhatsApp={() => handleShareWhatsApp(creative)}
                  onShareInstagram={() => handleShareInstagram(creative)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
