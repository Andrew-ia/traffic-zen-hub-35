import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useProductHub } from "@/hooks/useProductHub";
import {
  useCreateProductHubPurchaseList,
  useProductHubPurchaseListItems,
  useProductHubPurchaseLists,
  useUpdateProductHubPurchaseList,
} from "@/hooks/useProductHubPurchaseLists";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Package, Search, ShoppingBag, ExternalLink, Plus, Save, X, Printer } from "lucide-react";

type SizeEntry = {
  size: string;
  quantity: string;
};

type DraftPurchaseItem = {
  productId: string;
  name: string;
  imageUrl?: string | null;
  suggestion: string;
  sizeEntries: SizeEntry[];
};

const RING_SIZE_OPTIONS = ["17", "18", "19", "20", "21"];

function formatCurrency(value?: number | null) {
  if (value === undefined || value === null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function normalizeSizeEntry(entry: any): SizeEntry | null {
  if (!entry) return null;
  const size = String(entry.size ?? "").trim();
  const quantity = String(entry.quantity ?? "").trim();
  if (!size && !quantity) return null;
  return { size, quantity };
}

function parseSizeEntries(value?: string | null): SizeEntry[] {
  if (!value) return [];
  const trimmed = String(value).trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed
        .map(normalizeSizeEntry)
        .filter((entry): entry is SizeEntry => Boolean(entry));
    }
  } catch (error) {
    // ignore invalid JSON and fall back to parsing
  }

  return trimmed
    .split(/[;,]/)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => {
      const parts = segment.split(/[:xX]/).map((part) => part.trim());
      if (parts.length >= 2) {
        return { size: parts[0], quantity: parts[1] };
      }
      return { size: segment, quantity: "" };
    })
    .filter((entry) => entry.size || entry.quantity);
}

function hasSizeEntries(entries: SizeEntry[]) {
  return entries.some((entry) => entry.size.trim() || entry.quantity.trim());
}

function isRingProduct(name?: string | null, entries?: SizeEntry[], sizesRaw?: string | null) {
  if (entries && hasSizeEntries(entries)) return true;
  if (sizesRaw && parseSizeEntries(sizesRaw).length > 0) return true;
  const normalized = String(name || "").toLowerCase();
  return normalized.includes("anel");
}

function serializeSizeEntries(entries: SizeEntry[]): string {
  const normalized = entries
    .map((entry) => ({
      size: String(entry.size || "").trim(),
      quantity: String(entry.quantity || "").trim(),
    }))
    .filter((entry) => entry.size || entry.quantity);

  return normalized.length ? JSON.stringify(normalized) : "";
}

function formatSizeEntries(value?: string | null): string {
  const entries = parseSizeEntries(value);
  if (!entries.length) return "";
  return entries
    .map((entry) => (entry.quantity ? `${entry.size} x ${entry.quantity}` : entry.size))
    .join(", ");
}

export default function ProductHub() {
  const { currentWorkspace } = useWorkspace();
  const fallbackWorkspaceId = (import.meta.env.VITE_WORKSPACE_ID as string | undefined)?.trim() || null;
  const workspaceId = currentWorkspace?.id || fallbackWorkspaceId;
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [searchBy, setSearchBy] = useState<"name" | "mlb">("name");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 48;
  const [draftName, setDraftName] = useState("");
  const [draftItems, setDraftItems] = useState<DraftPurchaseItem[]>([]);
  const [draftOpen, setDraftOpen] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [editingListId, setEditingListId] = useState<string | null>(null);

  const { data, isLoading, isError } = useProductHub(workspaceId, {
    search: search.trim() || undefined,
    searchBy,
    page: currentPage,
    limit: pageSize,
  });
  const { data: listsData, isLoading: listsLoading } = useProductHubPurchaseLists(workspaceId);
  const { data: listItemsData, isLoading: listItemsLoading } = useProductHubPurchaseListItems(
    workspaceId,
    selectedListId
  );
  const createListMutation = useCreateProductHubPurchaseList(workspaceId);
  const updateListMutation = useUpdateProductHubPurchaseList(workspaceId);

  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const draftIds = useMemo(() => new Set(draftItems.map((item) => item.productId)), [draftItems]);
  const selectedList = useMemo(
    () => listsData?.lists?.find((list) => list.id === selectedListId) || null,
    [listsData?.lists, selectedListId]
  );

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

  useEffect(() => {
    if (!selectedListId && listsData?.lists?.length) {
      setSelectedListId(listsData.lists[0].id);
    }
  }, [listsData, selectedListId]);

  useEffect(() => {
    if (!workspaceId) return;
    const key = `productHubDraft:${workspaceId}`;
    const raw = localStorage.getItem(key);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.name && Array.isArray(parsed?.items)) {
        setDraftName(parsed.name);
        setDraftItems(
          parsed.items.map((item: DraftPurchaseItem & { sizes?: string }) => {
            const sizeEntries = Array.isArray(item.sizeEntries)
              ? item.sizeEntries.map((entry) => normalizeSizeEntry(entry)).filter(Boolean)
              : parseSizeEntries(item.sizes);
            const normalizedEntries = sizeEntries.filter(
              (entry): entry is SizeEntry => Boolean(entry)
            );
            const ringEntries =
              normalizedEntries.length === 0 && isRingProduct(item.name)
                ? [{ size: "", quantity: "" }]
                : normalizedEntries;
            return {
              ...item,
              suggestion: item.suggestion || "",
              sizeEntries: ringEntries,
            };
          })
        );
        setDraftOpen(true);
        if (parsed.editingListId) setEditingListId(parsed.editingListId);
      }
    } catch (error) {
      console.warn("Failed to restore draft list:", error);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId) return;
    const key = `productHubDraft:${workspaceId}`;
    if (!draftOpen) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(
      key,
      JSON.stringify({
        name: draftName,
        items: draftItems,
        editingListId,
      })
    );
  }, [workspaceId, draftOpen, draftName, draftItems, editingListId]);

  const startDraft = () => {
    const today = new Date().toLocaleDateString("pt-BR");
    setDraftName(`Lista ${today}`);
    setDraftItems([]);
    setDraftOpen(true);
    setEditingListId(null);
  };

  const cancelDraft = () => {
    setDraftOpen(false);
    setDraftName("");
    setDraftItems([]);
    setEditingListId(null);
  };

  const addToDraft = (product: any) => {
    setDraftItems((prev) => {
      if (prev.some((item) => item.productId === product.id)) return prev;
      const ringCandidate = isRingProduct(product.name);
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          imageUrl: primaryImage(product.assets),
          suggestion: "",
          sizeEntries: ringCandidate ? [{ size: "", quantity: "" }] : [],
        },
      ];
    });
  };

  const updateDraftSuggestion = (productId: string, value: string) => {
    setDraftItems((prev) =>
      prev.map((item) => (item.productId === productId ? { ...item, suggestion: value } : item))
    );
  };

  const updateDraftSizeEntry = (
    productId: string,
    index: number,
    updates: Partial<SizeEntry>
  ) => {
    setDraftItems((prev) =>
      prev.map((item) => {
        if (item.productId !== productId) return item;
        const nextEntries = item.sizeEntries.map((entry, entryIndex) =>
          entryIndex === index ? { ...entry, ...updates } : entry
        );
        return { ...item, sizeEntries: nextEntries };
      })
    );
  };

  const addDraftSizeEntry = (productId: string) => {
    setDraftItems((prev) =>
      prev.map((item) => {
        if (item.productId !== productId) return item;
        return {
          ...item,
          sizeEntries: [...item.sizeEntries, { size: "", quantity: "" }],
        };
      })
    );
  };

  const removeDraftSizeEntry = (productId: string, index: number) => {
    setDraftItems((prev) =>
      prev.map((item) => {
        if (item.productId !== productId) return item;
        const nextEntries = item.sizeEntries.filter((_, entryIndex) => entryIndex !== index);
        return { ...item, sizeEntries: nextEntries };
      })
    );
  };

  const removeDraftItem = (productId: string) => {
    setDraftItems((prev) => prev.filter((item) => item.productId !== productId));
  };

  const saveDraft = async () => {
    const trimmedName = draftName.trim();
    if (!trimmedName || draftItems.length === 0) return;
    try {
      const payloadItems = draftItems.map((item) => ({
        productId: item.productId,
        suggestion: item.suggestion.trim(),
        sizes: serializeSizeEntries(item.sizeEntries),
      }));
      if (editingListId) {
        await updateListMutation.mutateAsync({
          listId: editingListId,
          name: trimmedName,
          items: payloadItems,
        });
        setSelectedListId(editingListId);
      } else {
        const payload = {
          name: trimmedName,
          items: payloadItems,
        };
        const response = await createListMutation.mutateAsync(payload);
        const createdId = response?.list?.id as string | undefined;
        if (createdId) setSelectedListId(createdId);
      }
      cancelDraft();
    } catch (error) {
      console.error("Failed to save purchase list:", error);
    }
  };

  const startEditingList = () => {
    if (!selectedList || !listItemsData?.items) return;
    setDraftName(selectedList.name);
    setDraftItems(
      listItemsData.items.map((item) => ({
        productId: item.product_id,
        name: item.name,
        imageUrl: item.image_url,
        suggestion: item.suggestion || "",
        sizeEntries: (() => {
          const entries = parseSizeEntries(item.sizes || "");
          const ringFallback = isRingProduct(item.name, entries, item.sizes) && entries.length === 0;
          return ringFallback ? [{ size: "", quantity: "" }] : entries;
        })(),
      }))
    );
    setDraftOpen(true);
    setEditingListId(selectedList.id);
  };

  const handlePrintList = () => {
    if (!selectedList || !listItemsData?.items?.length) return;
    const escapeHtml = (value: string) =>
      value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const rows = listItemsData.items
      .map((item) => {
        const name = escapeHtml(item.name || "");
        const suggestion = escapeHtml(item.suggestion || "");
        const sizesFormatted = formatSizeEntries(item.sizes);
        const sizes = escapeHtml(sizesFormatted);
        const image = item.image_url
          ? `<img src="${escapeHtml(item.image_url)}" alt="${name}" loading="eager" />`
          : `<div class="placeholder">Sem imagem</div>`;
        return `
          <div class="row">
            ${image}
            <div class="content">
              <div class="name">${name}</div>
              <div class="suggestion">${suggestion || "-"}</div>
              ${sizes ? `<div class="sizes">Tamanhos: ${sizes}</div>` : ""}
            </div>
          </div>
        `;
      })
      .join("");

    const win = window.open("", "_blank", "width=680,height=900");
    if (!win) return;
    win.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(selectedList.name)}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
            h1 { font-size: 16px; margin: 0 0 12px 0; }
            .row { display: flex; gap: 10px; align-items: center; margin-bottom: 10px; font-size: 12px; }
            img { width: 36px; height: 36px; border-radius: 6px; object-fit: cover; display: block; }
            .placeholder { width: 36px; height: 36px; border-radius: 6px; background: #f3f4f6; color: #6b7280;
              display: flex; align-items: center; justify-content: center; font-size: 9px; text-align: center; }
            .content { flex: 1; }
            .name { font-weight: 600; }
            .suggestion { color: #374151; font-size: 11px; margin-top: 2px; }
            .sizes { color: #6b7280; font-size: 10px; margin-top: 2px; }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(selectedList.name)}</h1>
          ${rows}
          <script>
            (function () {
              const images = Array.from(document.images);
              let finished = false;
              const finalize = () => {
                if (finished) return;
                finished = true;
                window.focus();
                window.print();
              };

              if (!images.length) {
                finalize();
                return;
              }

              let pending = images.length;
              const done = () => {
                pending -= 1;
                if (pending <= 0) finalize();
              };

              images.forEach((img) => {
                if (img.complete) {
                  done();
                } else {
                  img.addEventListener("load", done);
                  img.addEventListener("error", done);
                }
              });

              setTimeout(finalize, 2500);
            })();
          </script>
        </body>
      </html>
    `);
    win.document.close();
  };

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
            <div className="flex flex-col gap-2">
              <Select
                value={searchBy}
                onValueChange={(value) => {
                  setSearchBy(value as "name" | "mlb");
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Filtro" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Nome</SelectItem>
                  <SelectItem value="mlb">MLB</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={searchBy === "mlb" ? "Buscar por MLB (ex: MLB123)" : "Buscar por nome"}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>
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

      <div className="grid gap-6 lg:grid-cols-[420px_1fr] xl:grid-cols-[460px_1fr]">
        <div className="lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-base">Listas de Compra</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Monte suas sugestões e salve listas compactas para impressão.
                </p>
              </div>
              <Button size="sm" onClick={startDraft}>
                <Plus className="h-4 w-4 mr-2" />
                Nova lista
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-3">
                  {draftOpen ? (
                    <>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex-1">
                          <Input
                            placeholder="Nome da lista"
                            value={draftName}
                            onChange={(e) => setDraftName(e.target.value)}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={saveDraft}
                            disabled={
                              !draftName.trim() ||
                              draftItems.length === 0 ||
                              createListMutation.isPending ||
                              updateListMutation.isPending
                            }
                          >
                            <Save className="h-4 w-4 mr-2" />
                            {editingListId ? "Salvar alterações" : "Salvar"}
                          </Button>
                          <Button size="sm" variant="outline" onClick={cancelDraft}>
                            <X className="h-4 w-4 mr-2" />
                            Cancelar
                          </Button>
                        </div>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Rascunho salvo automaticamente enquanto você edita.
                      </div>
                      {draftItems.length === 0 ? (
                        <div className="text-sm text-muted-foreground">
                          Adicione produtos usando o botão "Adicionar à lista" no catálogo.
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
                          {draftItems.map((item) => (
                            <div
                              key={item.productId}
                              className="flex items-center gap-3 rounded-lg border border-border/60 p-2"
                            >
                              {item.imageUrl ? (
                                <img
                                  src={item.imageUrl}
                                  alt={item.name}
                                  className="h-10 w-10 rounded-md object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="h-10 w-10 rounded-md bg-muted text-[10px] text-muted-foreground flex items-center justify-center">
                                  Sem imagem
                                </div>
                              )}
                          <div className="flex-1">
                            <div className="text-sm font-medium leading-tight">{item.name}</div>
                            {isRingProduct(item.name, item.sizeEntries) ? (
                              <div className="mt-2 space-y-2">
                                {item.sizeEntries.map((entry, index) => (
                                  <div key={`${item.productId}-${index}`} className="flex items-center gap-2">
                                    <Select
                                      value={entry.size}
                                      onValueChange={(value) =>
                                        updateDraftSizeEntry(item.productId, index, { size: value })
                                      }
                                    >
                                      <SelectTrigger className="h-8 w-[96px]">
                                        <SelectValue placeholder="Tam." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {RING_SIZE_OPTIONS.map((size) => (
                                          <SelectItem key={size} value={size}>
                                            {size}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <Input
                                      type="number"
                                      min={0}
                                      placeholder="Qtd"
                                      value={entry.quantity}
                                      onChange={(e) =>
                                        updateDraftSizeEntry(item.productId, index, { quantity: e.target.value })
                                      }
                                      className="h-8 w-[90px] text-xs"
                                    />
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => removeDraftSizeEntry(item.productId, index)}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ))}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => addDraftSizeEntry(item.productId)}
                                >
                                  + Tamanho
                                </Button>
                              </div>
                            ) : (
                              <Input
                                placeholder="Sugestão de compra (ex: 12 un)"
                                value={item.suggestion}
                                onChange={(e) => updateDraftSuggestion(item.productId, e.target.value)}
                                className="mt-1 h-8 text-xs"
                              />
                            )}
                          </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeDraftItem(item.productId)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      Clique em "Nova lista" para montar uma sugestão com os produtos do catálogo.
                    </div>
                  )}
                </div>
                <div className="border-t border-border/60 pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      Listas salvas
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePrintList}
                      disabled={!selectedListId || !listItemsData?.items?.length}
                    >
                      <Printer className="h-4 w-4 mr-2" />
                      Imprimir
                    </Button>
                  </div>
                  {listsLoading ? (
                    <Skeleton className="h-9 w-full" />
                  ) : (listsData?.lists?.length || 0) === 0 ? (
                    <div className="text-xs text-muted-foreground">Nenhuma lista salva ainda.</div>
                  ) : (
                    <Select value={selectedListId || ""} onValueChange={setSelectedListId}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione uma lista" />
                      </SelectTrigger>
                      <SelectContent>
                        {listsData?.lists?.map((list) => (
                          <SelectItem key={list.id} value={list.id}>
                            {list.name} ({Number(list.items_count || 0)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={startEditingList}
                    disabled={!selectedListId || listItemsLoading || !listItemsData?.items?.length}
                  >
                    Editar lista
                  </Button>
                  {selectedListId && (
                    <>
                      {listItemsLoading ? (
                        <div className="space-y-2">
                          {Array.from({ length: 4 }).map((_, idx) => (
                            <Skeleton key={idx} className="h-10 w-full" />
                          ))}
                        </div>
                      ) : (listItemsData?.items?.length || 0) === 0 ? (
                        <div className="text-xs text-muted-foreground">Lista sem itens.</div>
                      ) : (
                        <div className="space-y-2 max-h-[360px] overflow-auto pr-1">
                          {listItemsData?.items?.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center gap-2 rounded-lg border border-border/60 p-2 text-xs"
                            >
                              {item.image_url ? (
                                <img
                                  src={item.image_url}
                                  alt={item.name}
                                  className="h-8 w-8 rounded object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="h-8 w-8 rounded bg-muted text-[9px] text-muted-foreground flex items-center justify-center">
                                  Sem imagem
                                </div>
                              )}
                              <div className="flex-1">
                              <div className="font-semibold leading-tight line-clamp-1">{item.name}</div>
                              <div className="text-[11px] text-muted-foreground">
                                {item.suggestion || "Sem sugestão"}
                              </div>
                              {formatSizeEntries(item.sizes) && (
                                <div className="text-[10px] text-muted-foreground">
                                  Tamanhos: {formatSizeEntries(item.sizes)}
                                </div>
                              )}
                            </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
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
            <div className="space-y-4">
              <ScrollArea className="h-[70vh]">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pr-3">
                  {items.map((product) => {
                    const img = primaryImage(product.assets);
                    const isDrafted = draftIds.has(product.id);
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
                          {draftOpen && (
                            <Button
                              variant={isDrafted ? "secondary" : "outline"}
                              size="sm"
                              className="gap-2"
                              onClick={(event) => {
                                event.stopPropagation();
                                if (!isDrafted) addToDraft(product);
                              }}
                              disabled={isDrafted}
                            >
                              <Plus className="h-4 w-4" />
                              {isDrafted ? "Adicionado" : "Adicionar à lista"}
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>

              {data?.totalPages && data.totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Página {currentPage} de {data.totalPages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(data.totalPages, p + 1))}
                      disabled={currentPage === data.totalPages}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
