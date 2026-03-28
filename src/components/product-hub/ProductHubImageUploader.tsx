import { ChangeEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Upload, Star, Trash2 } from "lucide-react";

export type ProductHubEditableImage = {
  id: string;
  assetId?: string | null;
  preview: string;
  url?: string | null;
  imageData?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  fileSizeBytes?: number | null;
  isPrimary: boolean;
};

type ProductHubImageUploaderProps = {
  images: ProductHubEditableImage[];
  onAddFiles: (files: FileList | File[]) => Promise<void> | void;
  onRemoveImage: (id: string) => void;
  onSetPrimary: (id: string) => void;
};

export function ProductHubImageUploader({
  images,
  onAddFiles,
  onRemoveImage,
  onSetPrimary,
}: ProductHubImageUploaderProps) {
  const handleChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length) {
      await onAddFiles(files);
    }
    event.target.value = "";
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Imagens do produto</div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-accent">
          <Upload className="h-4 w-4" />
          Subir imagens
          <input
            type="file"
            multiple
            accept="image/png,image/jpeg,image/jpg,image/webp"
            className="hidden"
            onChange={handleChange}
          />
        </label>
      </div>

      <div className="text-xs text-muted-foreground">
        Envie imagens direto pela plataforma. A primeira ou a marcada como principal vira a capa do SKU.
      </div>

      {images.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          Nenhuma imagem adicionada ainda.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {images.map((image, index) => (
            <div key={image.id} className="overflow-hidden rounded-lg border bg-background">
              <div className="relative aspect-square overflow-hidden bg-muted/40">
                <img
                  src={image.preview}
                  alt={image.fileName || `Imagem ${index + 1}`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
                <div className="absolute left-2 top-2 flex items-center gap-2">
                  <Badge variant={image.isPrimary ? "default" : "secondary"}>
                    {image.isPrimary ? "Principal" : `Imagem ${index + 1}`}
                  </Badge>
                </div>
              </div>
              <div className="space-y-3 p-3">
                <div className="truncate text-xs text-muted-foreground">
                  {image.fileName || "Imagem enviada"}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={image.isPrimary ? "default" : "outline"}
                    size="sm"
                    className="gap-2"
                    onClick={() => onSetPrimary(image.id)}
                  >
                    <Star className="h-4 w-4" />
                    {image.isPrimary ? "Capa" : "Definir capa"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => onRemoveImage(image.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Remover
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
