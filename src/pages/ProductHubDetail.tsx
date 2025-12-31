import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useProductHubItem } from "@/hooks/useProductHubItem";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Package, ArrowLeft, ShoppingBag, ExternalLink, Tag, Play } from "lucide-react";

function formatCurrency(value?: number | null) {
  if (value === undefined || value === null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default function ProductHubDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const fallbackWorkspaceId = (import.meta.env.VITE_WORKSPACE_ID as string | undefined)?.trim() || null;
  const workspaceId = currentWorkspace?.id || fallbackWorkspaceId;

  const { data, isLoading, isError } = useProductHubItem(id || null, workspaceId);
  const product = data?.product;
  const ads = data?.ads || [];

  const attributes = useMemo(() => {
    const raw = product?.metadata?.attributes;
    if (!Array.isArray(raw)) return [];
    return raw.map((a: any) => ({
      name: a.name || a.id || "Atributo",
      value: a.value_name || a.value_id || "",
    }));
  }, [product]);

  const images = product?.assets?.filter((a: any) => a.type === "image") || [];
  const videos = product?.assets?.filter((a: any) => a.type === "video") || [];

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
        <Skeleton className="h-6 w-48" />
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
        <div className="text-red-600 text-sm">Não foi possível carregar o produto.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="gap-2" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <Badge variant="outline" className="capitalize">{product.platform}</Badge>
        {product.sku && <Badge variant="secondary">SKU {product.sku}</Badge>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              {product.name}
            </CardTitle>
            <div className="text-sm text-muted-foreground">
              ID plataforma: {product.platform_product_id}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-2xl font-bold">{formatCurrency(product.price)}</div>
            <Separator />
            <div>
              <h4 className="text-sm font-semibold mb-2">Imagens</h4>
              {images.length === 0 ? (
                <div className="text-sm text-muted-foreground">Sem imagens.</div>
              ) : (
                <ScrollArea className="w-full">
                  <div className="flex gap-3 pb-2">
                    {images.map((img) => (
                      <div key={img.id} className="w-48 h-48 rounded-lg overflow-hidden border">
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
              <h4 className="text-sm font-semibold mb-2">Vídeos</h4>
              {videos.length === 0 ? (
                <div className="text-sm text-muted-foreground">Sem vídeos.</div>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {videos.map((video: any) => {
                    const url = video.url;
                    const isYoutube = typeof url === "string" && (url.includes("youtube.com") || url.includes("youtu.be"));
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
              <h4 className="text-sm font-semibold mb-2">Descrição</h4>
              {product.description ? (
                <div className="text-sm leading-relaxed whitespace-pre-wrap">
                  {product.description}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Sem descrição.</div>
              )}
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2">Características</h4>
              {attributes.length === 0 ? (
                <div className="text-sm text-muted-foreground">Nenhum atributo disponível.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {attributes.map((attr, idx) => (
                    <div key={`${attr.name}-${idx}`} className="flex items-start gap-2 text-sm">
                      <Tag className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <div className="font-medium">{attr.name}</div>
                        <div className="text-muted-foreground">{attr.value || "—"}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Detalhes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Categoria</span>
              <span>{product.category || "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Platform ID</span>
              <span className="font-mono text-xs">{product.platform_product_id}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Criado em</span>
              <span>{product.created_at ? new Date(product.created_at).toLocaleDateString("pt-BR") : "—"}</span>
            </div>
            {product.video_url && (
              <div className="space-y-2">
                <div className="text-muted-foreground">URL do vídeo (exportação)</div>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={product.video_url}
                    className="flex-1 text-xs px-2 py-1 rounded border bg-muted/50"
                  />
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => window.open(product.video_url!, "_blank")}>
                    <ExternalLink className="h-4 w-4" /> Abrir
                  </Button>
                </div>
              </div>
            )}
            {product.metadata?.permalink && (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={() => window.open(product.metadata.permalink, "_blank")}
              >
                <ShoppingBag className="h-4 w-4" />
                Ver anúncio original
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Anúncios vinculados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {ads.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhum anúncio vinculado.</div>
          ) : (
            ads.map((ad) => (
              <div key={ad.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between border rounded-lg p-3 gap-2">
                <div>
                  <div className="font-semibold">{ad.platform} • {ad.status || "—"}</div>
                  <div className="text-sm text-muted-foreground">Ad ID: {ad.platform_ad_id}</div>
                  <div className="text-xs text-muted-foreground">Atualizado: {ad.updated_at ? new Date(ad.updated_at).toLocaleString("pt-BR") : "—"}</div>
                </div>
                <div className="flex items-center gap-3 text-sm">
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
    </div>
  );
}
