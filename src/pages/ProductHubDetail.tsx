import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useProductHubItem } from "@/hooks/useProductHubItem";
import {
  useAdjustProductHubInventory,
  useCreateProductHubChannelLink,
  useDeleteProductHubChannelLink,
  useProductHubLinkableListings,
  useSyncProductHubInventory,
  useUpdateProductHubProduct,
} from "@/hooks/useProductHubManagement";
import { ProductHubProductDialog } from "@/components/product-hub/ProductHubProductDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Boxes,
  ExternalLink,
  Link2,
  Package,
  Pencil,
  Play,
  Plus,
  RefreshCcw,
  Tag,
  Unlink2,
  Warehouse,
} from "lucide-react";

function formatCurrency(value?: number | null) {
  if (value === undefined || value === null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDimension(value?: number | null, suffix = "") {
  if (value === undefined || value === null) return "—";
  return `${value}${suffix}`;
}

function formatTimestamp(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR");
}

function getChannelLabel(channel?: string | null) {
  if (channel === "mercadolivre") return "Mercado Livre";
  if (channel === "shopee") return "Shopee";
  return "Outro canal";
}

function getMovementLabel(movementType?: string | null) {
  if (movementType === "manual_adjustment") return "Ajuste manual";
  if (movementType === "catalog_edit") return "Edicao do cadastro";
  if (movementType === "sale") return "Venda";
  if (movementType === "return") return "Devolucao";
  if (movementType === "reservation") return "Reserva";
  if (movementType === "release") return "Liberacao";
  return "Movimento";
}

function buildSyncMessage(syncResults: Array<Record<string, any>>) {
  if (!syncResults.length) return "Nenhum canal vinculado para sincronizar.";
  const synced = syncResults.filter((item) => item.synced).length;
  const failed = syncResults.filter((item) => item.synced === false && !item.skipped).length;
  const skipped = syncResults.filter((item) => item.skipped).length;
  return `${synced} sincronizado(s), ${failed} com erro e ${skipped} pendente(s).`;
}

export default function ProductHubDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const fallbackWorkspaceId = (import.meta.env.VITE_WORKSPACE_ID as string | undefined)?.trim() || null;
  const workspaceId = currentWorkspace?.id || fallbackWorkspaceId;
  const { toast } = useToast();

  const [editOpen, setEditOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const [mlLinkOpen, setMlLinkOpen] = useState(false);
  const [manualLinkOpen, setManualLinkOpen] = useState(false);
  const [mlSearch, setMlSearch] = useState("");
  const [adjustmentDelta, setAdjustmentDelta] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("Ajuste manual");
  const [adjustmentNotes, setAdjustmentNotes] = useState("");
  const [adjustmentSync, setAdjustmentSync] = useState(true);
  const [manualChannel, setManualChannel] = useState<"shopee" | "other">("shopee");
  const [manualExternalId, setManualExternalId] = useState("");
  const [manualSku, setManualSku] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [manualStatus, setManualStatus] = useState("active");
  const [manualPrice, setManualPrice] = useState("");
  const [manualPublishedStock, setManualPublishedStock] = useState("");
  const [manualPermalink, setManualPermalink] = useState("");

  const { data, isLoading, isError } = useProductHubItem(id || null, workspaceId);
  const updateProductMutation = useUpdateProductHubProduct(workspaceId, id || null);
  const adjustInventoryMutation = useAdjustProductHubInventory(workspaceId, id || null);
  const syncInventoryMutation = useSyncProductHubInventory(workspaceId, id || null);
  const createChannelLinkMutation = useCreateProductHubChannelLink(workspaceId, id || null);
  const deleteChannelLinkMutation = useDeleteProductHubChannelLink(workspaceId, id || null);
  const { data: linkableListingsData, isLoading: linkableListingsLoading } = useProductHubLinkableListings(
    id || null,
    workspaceId,
    mlSearch,
    mlLinkOpen,
  );

  const product = data?.product;
  const ads = data?.ads || [];
  const channelLinks = data?.channelLinks || [];
  const inventoryMovements = data?.inventoryMovements || [];

  const attributes = useMemo(() => {
    const raw = product?.metadata?.attributes;
    if (!Array.isArray(raw)) return [];
    return raw.map((attribute: any) => ({
      name: attribute.name || attribute.id || "Atributo",
      value: attribute.value_name || attribute.value_id || "",
    }));
  }, [product]);

  const images = product?.assets?.filter((asset) => asset.type === "image") || [];
  const videos = product?.assets?.filter((asset) => asset.type === "video") || [];
  const availableStock = Number(product?.available_stock || 0);
  const stockOnHand = Number(product?.stock_on_hand || 0);
  const stockReserved = Number(product?.stock_reserved || 0);
  const mlLinksCount = channelLinks.filter((link) => link.channel === "mercadolivre").length;
  const shopeeLinksCount = channelLinks.filter((link) => link.channel === "shopee").length;

  const handleUpdateProduct = async (payload: any) => {
    try {
      await updateProductMutation.mutateAsync(payload);
      setEditOpen(false);
      toast({
        title: "Produto atualizado",
        description: "Os dados base do SKU foram atualizados.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar",
        description: error?.message || "Nao foi possivel salvar o produto.",
        variant: "destructive",
      });
    }
  };

  const handleAdjustInventory = async () => {
    try {
      const result = await adjustInventoryMutation.mutateAsync({
        deltaQuantity: Number(adjustmentDelta),
        reason: adjustmentReason,
        notes: adjustmentNotes,
        syncChannels: adjustmentSync,
      });
      setStockOpen(false);
      setAdjustmentDelta("");
      setAdjustmentReason("Ajuste manual");
      setAdjustmentNotes("");
      setAdjustmentSync(true);
      toast({
        title: "Estoque ajustado",
        description: buildSyncMessage(result.syncResults || []),
      });
    } catch (error: any) {
      toast({
        title: "Erro ao ajustar estoque",
        description: error?.message || "Nao foi possivel registrar o movimento.",
        variant: "destructive",
      });
    }
  };

  const handleSyncInventory = async () => {
    try {
      const result = await syncInventoryMutation.mutateAsync();
      toast({
        title: "Sincronizacao executada",
        description: buildSyncMessage(result.syncResults || []),
      });
    } catch (error: any) {
      toast({
        title: "Erro ao sincronizar",
        description: error?.message || "Nao foi possivel sincronizar o estoque.",
        variant: "destructive",
      });
    }
  };

  const handleCreateMlLink = async (internalProductId: string) => {
    try {
      await createChannelLinkMutation.mutateAsync({
        channel: "mercadolivre",
        internalProductId,
      });
      setMlLinkOpen(false);
      setMlSearch("");
      toast({
        title: "Anuncio vinculado",
        description: "O anuncio do Mercado Livre agora aponta para este SKU.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao vincular anuncio",
        description: error?.message || "Nao foi possivel vincular o anuncio.",
        variant: "destructive",
      });
    }
  };

  const handleCreateManualLink = async () => {
    try {
      await createChannelLinkMutation.mutateAsync({
        channel: manualChannel,
        externalListingId: manualExternalId,
        sku: manualSku,
        title: manualTitle,
        status: manualStatus,
        price: manualPrice || null,
        publishedStock: manualPublishedStock || null,
        permalink: manualPermalink,
      });
      setManualLinkOpen(false);
      setManualExternalId("");
      setManualSku("");
      setManualTitle("");
      setManualStatus("active");
      setManualPrice("");
      setManualPublishedStock("");
      setManualPermalink("");
      toast({
        title: "Canal vinculado",
        description: `${getChannelLabel(manualChannel)} adicionado a este produto base.`,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao criar vinculo",
        description: error?.message || "Nao foi possivel salvar o canal.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteLink = async (source: string, sourceId: string) => {
    try {
      await deleteChannelLinkMutation.mutateAsync({ source, sourceId });
      toast({
        title: "Vinculo removido",
        description: "O canal foi desvinculado deste SKU.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao remover vinculo",
        description: error?.message || "Nao foi possivel remover o vinculo.",
        variant: "destructive",
      });
    }
  };

  if (!workspaceId) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-3">
        <Package className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Selecione um workspace para ver o produto.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" className="gap-2" disabled>
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" className="gap-2" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <div className="text-red-600 text-sm">Nao foi possivel carregar o produto.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="gap-2" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
            <Badge variant="outline" className="capitalize">{product.platform}</Badge>
            {product.source && <Badge variant="outline" className="capitalize">{product.source}</Badge>}
            {product.sku && <Badge variant="secondary">SKU {product.sku}</Badge>}
          </div>

          <div>
            <h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>
            <p className="text-muted-foreground">
              {product.platform === "hub"
                ? `Produto base ${product.platform_product_id}`
                : `Origem sincronizada ${product.platform_product_id}`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setMlLinkOpen(true)}>
            <Link2 className="h-4 w-4" />
            Vincular anúncio ML
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setManualLinkOpen(true)}>
            <Plus className="h-4 w-4" />
            Novo vínculo
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setStockOpen(true)}>
            <Warehouse className="h-4 w-4" />
            Ajustar estoque
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleSyncInventory}
            disabled={syncInventoryMutation.isPending}
          >
            <RefreshCcw className="h-4 w-4" />
            {syncInventoryMutation.isPending ? "Sincronizando..." : "Sincronizar estoque"}
          </Button>
          <Button size="sm" className="gap-2" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" />
            Editar produto
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Estoque central</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-bold">{availableStock}</div>
            <div className="text-sm text-muted-foreground">
              Fisico {stockOnHand} • Reservado {stockReserved}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Preco e custo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-lg font-semibold">{formatCurrency(product.price)}</div>
            <div className="text-sm text-muted-foreground">Custo base {formatCurrency(product.cost_price)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Canais publicados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-bold">{channelLinks.length}</div>
            <div className="text-sm text-muted-foreground">
              ML {mlLinksCount} • Shopee {shopeeLinksCount}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Dimensoes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            <div>Peso {formatDimension(product.weight_kg, " kg")}</div>
            <div>
              {formatDimension(product.width_cm, " cm")} x {formatDimension(product.height_cm, " cm")} x{" "}
              {formatDimension(product.length_cm, " cm")}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.8fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Dados do produto
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
              <div className="rounded-lg border p-3">
                <div className="text-muted-foreground">Categoria</div>
                <div className="font-medium">{product.category || "—"}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-muted-foreground">Status</div>
                <div className="font-medium capitalize">{product.status || "—"}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-muted-foreground">Fornecedor</div>
                <div className="font-medium">{product.supplier || "—"}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-muted-foreground">Codigo de barras</div>
                <div className="font-medium">{product.barcode || "—"}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-muted-foreground">Criado em</div>
                <div className="font-medium">
                  {product.created_at ? new Date(product.created_at).toLocaleDateString("pt-BR") : "—"}
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-muted-foreground">Atualizado em</div>
                <div className="font-medium">
                  {product.updated_at ? new Date(product.updated_at).toLocaleDateString("pt-BR") : "—"}
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="text-sm font-semibold mb-2">Imagens</h3>
              {images.length === 0 ? (
                <div className="text-sm text-muted-foreground">Sem imagens.</div>
              ) : (
                <ScrollArea className="w-full">
                  <div className="flex gap-3 pb-2">
                    {images.map((img) => (
                      <div key={img.id} className="w-40 h-40 rounded-lg overflow-hidden border">
                        <img
                          src={img.url}
                          alt={product.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    ))}
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Videos</h3>
              {videos.length === 0 ? (
                <div className="text-sm text-muted-foreground">Sem videos.</div>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {videos.map((video) => {
                    const url = video.url;
                    const isYoutube =
                      typeof url === "string" && (url.includes("youtube.com") || url.includes("youtu.be"));
                    return (
                      <div
                        key={video.id}
                        className="w-48 h-32 rounded-lg overflow-hidden border bg-black/5 cursor-pointer"
                        onClick={() => window.open(url, "_blank")}
                        title={url}
                      >
                        {isYoutube ? (
                          <div className="w-full h-full flex items-center justify-center bg-black/40 text-white">
                            <Play className="h-6 w-6" />
                          </div>
                        ) : (
                          <video className="w-full h-full object-cover">
                            <source src={url} />
                          </video>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Descricao</h3>
              <div className="text-sm leading-relaxed whitespace-pre-wrap">
                {product.description || "Sem descricao cadastrada."}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Observacoes internas</h3>
              <div className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                {product.notes || "Sem observacoes internas."}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Caracteristicas</h3>
              {attributes.length === 0 ? (
                <div className="text-sm text-muted-foreground">Nenhum atributo disponivel.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {attributes.map((attribute, index) => (
                    <div key={`${attribute.name}-${index}`} className="flex items-start gap-2 text-sm">
                      <Tag className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <div className="font-medium">{attribute.name}</div>
                        <div className="text-muted-foreground">{attribute.value || "—"}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Boxes className="h-5 w-5 text-primary" />
                Canais vinculados
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {channelLinks.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  Nenhum canal vinculado ainda. Use os botões acima para ligar o SKU ao ML ou Shopee.
                </div>
              ) : (
                channelLinks.map((link) => (
                  <div key={`${link.source}-${link.source_id}`} className="rounded-lg border p-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{getChannelLabel(link.channel)}</Badge>
                      {link.status && <Badge variant="secondary" className="capitalize">{link.status}</Badge>}
                      {link.sku && <Badge variant="outline">SKU {link.sku}</Badge>}
                    </div>
                    <div className="font-medium leading-tight">
                      {link.title || link.external_listing_id}
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div>ID do canal: {link.external_listing_id}</div>
                      <div>
                        Preco {formatCurrency(link.price)} • Estoque publicado {link.published_stock ?? "—"}
                      </div>
                      <div>Atualizado {formatTimestamp(link.updated_at)}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {link.permalink && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => window.open(link.permalink!, "_blank")}
                        >
                          <ExternalLink className="h-4 w-4" />
                          Abrir
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => handleDeleteLink(link.source, link.source_id)}
                        disabled={deleteChannelLinkMutation.isPending}
                      >
                        <Unlink2 className="h-4 w-4" />
                        Desvincular
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Warehouse className="h-5 w-5 text-primary" />
                Movimentos de estoque
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {inventoryMovements.length === 0 ? (
                <div className="text-sm text-muted-foreground">Nenhum movimento registrado ainda.</div>
              ) : (
                inventoryMovements.map((movement) => (
                  <div key={movement.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium">{getMovementLabel(movement.movement_type)}</div>
                      <div
                        className={`text-sm font-semibold ${
                          Number(movement.delta_quantity) >= 0 ? "text-emerald-600" : "text-red-600"
                        }`}
                      >
                        {Number(movement.delta_quantity) >= 0 ? "+" : ""}
                        {movement.delta_quantity}
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground space-y-1">
                      <div>
                        Saldo {movement.balance_before} → {movement.balance_after}
                      </div>
                      <div>{movement.reason || "Sem motivo informado"}</div>
                      {movement.notes && <div>{movement.notes}</div>}
                      <div>{formatTimestamp(movement.created_at)}</div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mercado Ads vinculados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {ads.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhum registro de Mercado Ads vinculado.</div>
          ) : (
            ads.map((ad) => (
              <div
                key={ad.id}
                className="flex flex-col gap-2 rounded-lg border p-3 lg:flex-row lg:items-center lg:justify-between"
              >
                <div>
                  <div className="font-semibold">
                    {ad.platform} • {ad.status || "—"}
                  </div>
                  <div className="text-sm text-muted-foreground">Ad ID: {ad.platform_ad_id}</div>
                  <div className="text-xs text-muted-foreground">
                    Atualizado: {ad.updated_at ? new Date(ad.updated_at).toLocaleString("pt-BR") : "—"}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <div>Imp: {ad.impressions ?? 0}</div>
                  <div>Cliques: {ad.clicks ?? 0}</div>
                  <div>Gasto: {formatCurrency(ad.spend)}</div>
                  {ad.permalink && (
                    <Button variant="ghost" size="sm" className="gap-1" onClick={() => window.open(ad.permalink!, "_blank")}>
                      <ExternalLink className="h-4 w-4" /> Abrir
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <ProductHubProductDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        initialProduct={product}
        isSubmitting={updateProductMutation.isPending}
        onSubmit={handleUpdateProduct}
      />

      <Dialog open={stockOpen} onOpenChange={setStockOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ajustar estoque central</DialogTitle>
            <DialogDescription>
              Use valor positivo para entrada e negativo para saida. O saldo disponivel atual e {availableStock}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="stock-delta">Quantidade do ajuste</Label>
              <Input
                id="stock-delta"
                type="number"
                value={adjustmentDelta}
                onChange={(event) => setAdjustmentDelta(event.target.value)}
                placeholder="Ex: 5 ou -2"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stock-reason">Motivo</Label>
              <Input
                id="stock-reason"
                value={adjustmentReason}
                onChange={(event) => setAdjustmentReason(event.target.value)}
                placeholder="Reposicao, venda externa, ajuste..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stock-notes">Observacoes</Label>
              <Textarea
                id="stock-notes"
                value={adjustmentNotes}
                onChange={(event) => setAdjustmentNotes(event.target.value)}
                rows={4}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="font-medium">Sincronizar anuncios do ML</div>
                <div className="text-sm text-muted-foreground">
                  Atualiza os anuncios vinculados com o novo saldo central.
                </div>
              </div>
              <Switch checked={adjustmentSync} onCheckedChange={setAdjustmentSync} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStockOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleAdjustInventory}
              disabled={adjustInventoryMutation.isPending || !adjustmentDelta || Number(adjustmentDelta) === 0}
            >
              {adjustInventoryMutation.isPending ? "Salvando..." : "Registrar ajuste"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mlLinkOpen} onOpenChange={setMlLinkOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Vincular anuncio do Mercado Livre</DialogTitle>
            <DialogDescription>
              Escolha um anuncio existente para apontar para este SKU base.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ml-search">Buscar anuncio</Label>
              <Input
                id="ml-search"
                value={mlSearch}
                onChange={(event) => setMlSearch(event.target.value)}
                placeholder="Buscar por titulo, SKU ou MLB..."
              />
            </div>
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {linkableListingsLoading ? (
                Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-24 w-full" />)
              ) : (linkableListingsData?.items?.length || 0) === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                  Nenhum anuncio disponivel para vinculo.
                </div>
              ) : (
                linkableListingsData?.items?.map((listing) => (
                  <div key={listing.id} className="rounded-lg border p-3 space-y-2">
                    <div className="font-medium">{listing.title || listing.ml_item_id}</div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div>ID {listing.ml_item_id}</div>
                      <div>
                        SKU {listing.sku || "—"} • Estoque {listing.available_quantity ?? "—"} • Preco{" "}
                        {formatCurrency(listing.price)}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {listing.ml_permalink && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => window.open(listing.ml_permalink!, "_blank")}
                        >
                          <ExternalLink className="h-4 w-4" />
                          Abrir
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={() => handleCreateMlLink(listing.id)}
                        disabled={createChannelLinkMutation.isPending}
                      >
                        Vincular
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={manualLinkOpen} onOpenChange={setManualLinkOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Novo vinculo de canal</DialogTitle>
            <DialogDescription>
              Cadastre canais manuais enquanto a automacao completa de Shopee ainda esta em construcao.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="manual-channel">Canal</Label>
              <Select value={manualChannel} onValueChange={(value) => setManualChannel(value as "shopee" | "other")}>
                <SelectTrigger id="manual-channel">
                  <SelectValue placeholder="Canal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="shopee">Shopee</SelectItem>
                  <SelectItem value="other">Outro canal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual-external-id">ID no canal</Label>
              <Input
                id="manual-external-id"
                value={manualExternalId}
                onChange={(event) => setManualExternalId(event.target.value)}
                placeholder="Ex: SHOPEE-123"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual-sku">SKU publicado</Label>
              <Input
                id="manual-sku"
                value={manualSku}
                onChange={(event) => setManualSku(event.target.value)}
                placeholder="Opcional"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual-status">Status</Label>
              <Select value={manualStatus} onValueChange={setManualStatus}>
                <SelectTrigger id="manual-status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="paused">Pausado</SelectItem>
                  <SelectItem value="draft">Rascunho</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="manual-title">Titulo do anuncio</Label>
              <Input
                id="manual-title"
                value={manualTitle}
                onChange={(event) => setManualTitle(event.target.value)}
                placeholder="Titulo publicado no canal"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual-price">Preco</Label>
              <Input
                id="manual-price"
                type="number"
                step="0.01"
                value={manualPrice}
                onChange={(event) => setManualPrice(event.target.value)}
                placeholder="0,00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual-stock">Estoque publicado</Label>
              <Input
                id="manual-stock"
                type="number"
                step="1"
                value={manualPublishedStock}
                onChange={(event) => setManualPublishedStock(event.target.value)}
                placeholder={String(availableStock)}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="manual-permalink">Link publico</Label>
              <Input
                id="manual-permalink"
                value={manualPermalink}
                onChange={(event) => setManualPermalink(event.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualLinkOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreateManualLink}
              disabled={createChannelLinkMutation.isPending || !manualExternalId.trim()}
            >
              {createChannelLinkMutation.isPending ? "Salvando..." : "Salvar vinculo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
