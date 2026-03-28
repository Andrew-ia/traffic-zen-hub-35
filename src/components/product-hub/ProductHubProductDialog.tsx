import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProductHubItem } from "@/hooks/useProductHub";
import type { ProductHubSavePayload } from "@/hooks/useProductHubManagement";
import {
  ProductHubImageUploader,
  type ProductHubEditableImage,
} from "@/components/product-hub/ProductHubImageUploader";

type ProductHubProductDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialProduct?: ProductHubItem | null;
  isSubmitting?: boolean;
  onSubmit: (payload: ProductHubSavePayload) => Promise<void> | void;
};

type FormState = {
  sku: string;
  name: string;
  category: string;
  price: string;
  cost_price: string;
  stock_on_hand: string;
  stock_reserved: string;
  status: string;
  supplier: string;
  barcode: string;
  video_url: string;
  description: string;
  notes: string;
  weight_kg: string;
  width_cm: string;
  height_cm: string;
  length_cm: string;
};

function toInputValue(value?: string | number | null) {
  if (value === undefined || value === null) return "";
  return String(value);
}

function buildInitialState(product?: ProductHubItem | null): FormState {
  return {
    sku: toInputValue(product?.sku),
    name: toInputValue(product?.name),
    category: toInputValue(product?.category),
    price: toInputValue(product?.price),
    cost_price: toInputValue(product?.cost_price),
    stock_on_hand: toInputValue(product?.stock_on_hand),
    stock_reserved: toInputValue(product?.stock_reserved),
    status: toInputValue(product?.status) || "active",
    supplier: toInputValue(product?.supplier),
    barcode: toInputValue(product?.barcode),
    video_url: toInputValue(product?.video_url),
    description: toInputValue(product?.description),
    notes: toInputValue(product?.notes),
    weight_kg: toInputValue(product?.weight_kg),
    width_cm: toInputValue(product?.width_cm),
    height_cm: toInputValue(product?.height_cm),
    length_cm: toInputValue(product?.length_cm),
  };
}

function buildInitialImages(product?: ProductHubItem | null): ProductHubEditableImage[] {
  const images =
    product?.assets
      ?.filter((asset) => asset.type === "image")
      .map((asset, index) => ({
        id: `existing-${asset.id}`,
        assetId: asset.id,
        preview: asset.url,
        url: asset.url,
        fileName: asset.file_name || `imagem-${index + 1}`,
        mimeType: asset.mime_type || null,
        fileSizeBytes: asset.file_size_bytes ?? null,
        isPrimary: Boolean(asset.is_primary),
      })) || [];

  if (images.length > 0 && !images.some((image) => image.isPrimary)) {
    images[0].isPrimary = true;
  }

  return images;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error(`Falha ao ler ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export function ProductHubProductDialog({
  open,
  onOpenChange,
  mode,
  initialProduct,
  isSubmitting,
  onSubmit,
}: ProductHubProductDialogProps) {
  const [form, setForm] = useState<FormState>(() => buildInitialState(initialProduct));
  const [images, setImages] = useState<ProductHubEditableImage[]>(() =>
    buildInitialImages(initialProduct),
  );

  useEffect(() => {
    if (!open) return;
    setForm(buildInitialState(initialProduct));
    setImages(buildInitialImages(initialProduct));
  }, [open, initialProduct]);

  const handleChange = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleAddFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter((file) =>
      ["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.type),
    );

    const uploadedImages = await Promise.all(
      validFiles.map(async (file) => {
        const imageData = await readFileAsDataUrl(file);
        return {
          id: crypto.randomUUID(),
          preview: imageData,
          imageData,
          fileName: file.name,
          mimeType: file.type,
          fileSizeBytes: file.size,
          isPrimary: false,
        };
      }),
    );

    setImages((current) => {
      const next = [...current, ...uploadedImages];
      if (next.length > 0 && !next.some((image) => image.isPrimary)) {
        next[0].isPrimary = true;
      }
      return next;
    });
  };

  const handleRemoveImage = (imageId: string) => {
    setImages((current) => {
      const next = current.filter((image) => image.id !== imageId);
      if (next.length > 0 && !next.some((image) => image.isPrimary)) {
        next[0].isPrimary = true;
      }
      return next;
    });
  };

  const handleSetPrimary = (imageId: string) => {
    setImages((current) =>
      current.map((image) => ({
        ...image,
        isPrimary: image.id === imageId,
      })),
    );
  };

  const submit = async () => {
    await onSubmit({
      ...form,
      price: form.price || null,
      cost_price: form.cost_price || null,
      stock_on_hand: form.stock_on_hand || null,
      stock_reserved: form.stock_reserved || null,
      weight_kg: form.weight_kg || null,
      width_cm: form.width_cm || null,
      height_cm: form.height_cm || null,
      length_cm: form.length_cm || null,
      images: images.map((image) => ({
        id: image.assetId || null,
        url: image.url || null,
        imageData: image.imageData || null,
        fileName: image.fileName || null,
        mimeType: image.mimeType || null,
        fileSizeBytes: image.fileSizeBytes ?? null,
        isPrimary: image.isPrimary,
      })),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Novo produto SKU" : "Editar produto SKU"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Cadastre o produto base uma vez e depois publique nos canais."
              : "Atualize os dados centrais do produto e mantenha o estoque unificado."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="product-hub-sku">SKU</Label>
                <Input
                  id="product-hub-sku"
                  value={form.sku}
                  onChange={(event) => handleChange("sku", event.target.value)}
                  placeholder="Ex: BRI-001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-hub-status">Status</Label>
                <Select value={form.status} onValueChange={(value) => handleChange("status", value)}>
                  <SelectTrigger id="product-hub-status">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="draft">Rascunho</SelectItem>
                    <SelectItem value="archived">Arquivado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-hub-name">Nome</Label>
              <Input
                id="product-hub-name"
                value={form.name}
                onChange={(event) => handleChange("name", event.target.value)}
                placeholder="Nome base do produto"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-hub-category">Categoria</Label>
              <Input
                id="product-hub-category"
                value={form.category}
                onChange={(event) => handleChange("category", event.target.value)}
                placeholder="Brincos, aneis, pulseiras..."
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="product-hub-price">Preco base</Label>
                <Input
                  id="product-hub-price"
                  type="number"
                  step="0.01"
                  value={form.price}
                  onChange={(event) => handleChange("price", event.target.value)}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-hub-cost">Custo</Label>
                <Input
                  id="product-hub-cost"
                  type="number"
                  step="0.01"
                  value={form.cost_price}
                  onChange={(event) => handleChange("cost_price", event.target.value)}
                  placeholder="0,00"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="product-hub-stock-on-hand">Estoque fisico</Label>
                <Input
                  id="product-hub-stock-on-hand"
                  type="number"
                  step="1"
                  value={form.stock_on_hand}
                  onChange={(event) => handleChange("stock_on_hand", event.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-hub-stock-reserved">Estoque reservado</Label>
                <Input
                  id="product-hub-stock-reserved"
                  type="number"
                  step="1"
                  value={form.stock_reserved}
                  onChange={(event) => handleChange("stock_reserved", event.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="product-hub-supplier">Fornecedor</Label>
                <Input
                  id="product-hub-supplier"
                  value={form.supplier}
                  onChange={(event) => handleChange("supplier", event.target.value)}
                  placeholder="Fornecedor"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-hub-barcode">Codigo de barras</Label>
                <Input
                  id="product-hub-barcode"
                  value={form.barcode}
                  onChange={(event) => handleChange("barcode", event.target.value)}
                  placeholder="EAN / GTIN"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="product-hub-weight">Peso (kg)</Label>
                <Input
                  id="product-hub-weight"
                  type="number"
                  step="0.001"
                  value={form.weight_kg}
                  onChange={(event) => handleChange("weight_kg", event.target.value)}
                  placeholder="0.000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-hub-width">Largura (cm)</Label>
                <Input
                  id="product-hub-width"
                  type="number"
                  step="0.01"
                  value={form.width_cm}
                  onChange={(event) => handleChange("width_cm", event.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="product-hub-height">Altura (cm)</Label>
                <Input
                  id="product-hub-height"
                  type="number"
                  step="0.01"
                  value={form.height_cm}
                  onChange={(event) => handleChange("height_cm", event.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-hub-length">Comprimento (cm)</Label>
                <Input
                  id="product-hub-length"
                  type="number"
                  step="0.01"
                  value={form.length_cm}
                  onChange={(event) => handleChange("length_cm", event.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-hub-video">Video</Label>
              <Input
                id="product-hub-video"
                value={form.video_url}
                onChange={(event) => handleChange("video_url", event.target.value)}
                placeholder="https://..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-hub-description">Descricao</Label>
              <Textarea
                id="product-hub-description"
                value={form.description}
                onChange={(event) => handleChange("description", event.target.value)}
                placeholder="Descricao base do produto"
                rows={5}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-hub-notes">Observacoes internas</Label>
              <Textarea
                id="product-hub-notes"
                value={form.notes}
                onChange={(event) => handleChange("notes", event.target.value)}
                placeholder="Notas para operacao, estoque ou marketplace"
                rows={4}
              />
            </div>
          </div>
        </div>

        <ProductHubImageUploader
          images={images}
          onAddFiles={handleAddFiles}
          onRemoveImage={handleRemoveImage}
          onSetPrimary={handleSetPrimary}
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={isSubmitting || !form.sku.trim() || !form.name.trim()}>
            {isSubmitting ? "Salvando..." : mode === "create" ? "Criar produto" : "Salvar alteracoes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
