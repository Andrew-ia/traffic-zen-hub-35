import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useProductHub } from "@/hooks/useProductHub";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Package, Search, ShoppingBag, ExternalLink } from "lucide-react";

function formatCurrency(value?: number | null) {
  if (value === undefined || value === null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default function ProductHub() {
  const { currentWorkspace } = useWorkspace();
  const fallbackWorkspaceId = (import.meta.env.VITE_WORKSPACE_ID as string | undefined)?.trim() || null;
  const workspaceId = currentWorkspace?.id || fallbackWorkspaceId;
  const navigate = useNavigate();

  const [search, setSearch] = useState("");

  const { data, isLoading, isError } = useProductHub(workspaceId, {
    search: search.trim() || undefined,
    page: 1,
    limit: 48,
  });

  const items = useMemo(() => data?.items ?? [], [data?.items]);

  const primaryImage = (assets?: any[]) => {
    if (!assets || assets.length === 0) return null;
    const chosen = assets.find((a) => a.is_primary) || assets[0];
    return chosen?.url || null;
  };

  const byPlatform = useMemo(() => {
    const acc: Record<string, number> = {};
    items.forEach((it) => {
      acc[it.platform] = (acc[it.platform] || 0) + 1;
    });
    return acc;
  }, [items]);

  if (!workspaceId) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-3">
        <Package className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Selecione um workspace para ver o catálogo de produtos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Package className="h-7 w-7 text-primary" />
            Catálogo de Produtos
          </h1>
          <p className="text-muted-foreground">
            Produtos centralizados (Products Hub) — prontos para replicar em outros marketplaces.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 text-primary px-3 py-2 rounded-lg text-sm font-medium">
            {data?.total ?? 0} produtos
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/products")}>
            Ver anúncios ML
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.total ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Plataformas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {Object.keys(byPlatform).length === 0 ? (
              <div className="text-sm text-muted-foreground">—</div>
            ) : (
              Object.entries(byPlatform).map(([platform, qty]) => (
                <div key={platform} className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className="capitalize">{platform}</Badge>
                  <span className="text-muted-foreground">{qty}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Busca</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="SKU, nome ou ID na plataforma"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Exportação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" />
              Pronto para marketplaces (Shopee, etc.)
            </div>
            <div className="text-muted-foreground">Breve: exportar diretamente</div>
          </CardContent>
        </Card>
      </div>

      <div>
        {isError ? (
          <div className="text-sm text-red-600">Erro ao carregar produtos.</div>
        ) : isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, idx) => (
              <Card key={idx}>
                <Skeleton className="h-40 w-full" />
                <CardContent className="space-y-2 pt-4">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[40vh] space-y-3">
            <Package className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground text-sm">Nenhum produto no hub ainda.</p>
          </div>
        ) : (
          <ScrollArea className="h-[70vh]">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pr-3">
              {items.map((product) => {
                const img = primaryImage(product.assets);
                return (
                  <Card
                    key={product.id}
                    className="overflow-hidden hover:shadow-lg transition cursor-pointer"
                    onClick={() => navigate(`/product-hub/${product.id}`)}
                  >
                    {img ? (
                      <div className="h-40 w-full overflow-hidden bg-muted/40">
                        <img
                          src={img}
                          alt={product.name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    ) : (
                      <div className="h-40 w-full bg-muted/40 flex items-center justify-center text-muted-foreground text-sm">
                        Sem imagem
                      </div>
                    )}
                    <CardContent className="space-y-2 pt-4">
                      <div className="flex items-start gap-2">
                        <Badge variant="outline" className="capitalize">{product.platform}</Badge>
                        {product.sku && <Badge variant="secondary">SKU {product.sku}</Badge>}
                      </div>
                      <div className="font-semibold leading-tight line-clamp-2">{product.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {product.category || "Sem categoria"}
                      </div>
                      <div className="text-sm font-semibold">{formatCurrency(product.price)}</div>
                      <div className="text-xs text-muted-foreground">
                        ID plataforma: {product.platform_product_id}
                      </div>
                      {product.assets && product.assets.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {product.assets.slice(0, 3).map((asset) => (
                            <Badge key={asset.id} variant="outline" className="text-[11px]">
                              {asset.type}
                            </Badge>
                          ))}
                          {product.assets.length > 3 && (
                            <Badge variant="outline" className="text-[11px]">
                              +{product.assets.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                      {product.platform === "mercadolivre" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-2"
                          onClick={() => {
                            const url = product.assets?.find((a) => a.type === "image")?.url;
                            if (url) window.open(url, "_blank");
                          }}
                        >
                          <ExternalLink className="h-4 w-4" />
                          Ver mídia
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
