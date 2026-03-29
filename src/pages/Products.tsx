import { useEffect, useRef, useMemo, useState } from "react";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
    useMercadoLivrePricingControl,
    useMercadoLivreProducts,
    useToggleMercadoLivreProduct,
    useUpdateMercadoLivrePrice,
    useUpdateMercadoLivrePricingControl
} from "@/hooks/useMercadoLivre";
import { useDebounce } from "@/hooks/useDebounce";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogFooter,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Package,
    Search,
    ExternalLink,
    TrendingUp,
    Target,
    AlertCircle,
    DollarSign,
    Truck,
    Box,
    Copy,
    Eye,
    Info,
    DownloadCloud,
    FileText,
    RefreshCw,
    Calendar,
    Image,
    Video,
    Store,
    Tag
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { LowStockAlerts } from "@/components/mercadolivre/LowStockAlerts";

export default function Products() {
    const { currentWorkspace } = useWorkspace();
    const fallbackWorkspaceId = (import.meta.env.VITE_WORKSPACE_ID as string | undefined)?.trim() || null;
    const workspaceId = currentWorkspace?.id || fallbackWorkspaceId;
    const { toast } = useToast();
    const navigate = useNavigate();

    const [search, setSearch] = useState("");
    const debouncedSearch = useDebounce(search, 500);
    const [categoryFilter, setCategoryFilter] = useState<string>("all");
    const [segmentFilter, setSegmentFilter] = useState<"all" | "active" | "paused" | "closed" | "full" | "catalog">("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(20);
    const [pdfFormat, setPdfFormat] = useState<"a4" | "10x15">("a4");
    const [priceDialog, setPriceDialog] = useState<{
        id: string;
        title: string;
        price: number;
        storefrontPrice: number;
    } | null>(null);
    const [priceDraft, setPriceDraft] = useState("");
    const [costDraft, setCostDraft] = useState("");
    const [toggleDialog, setToggleDialog] = useState<{ id: string; title: string; nextStatus: "active" | "paused" } | null>(null);
    const hydratedCostDialogRef = useRef<string | null>(null);

    const {
        data: productsData,
        isLoading,
        error,
        refetch,
        isFetching
    } = useMercadoLivreProducts(workspaceId, "all", debouncedSearch, { statuses: "all" });
    const updatePriceMutation = useUpdateMercadoLivrePrice();
    const updatePricingControlMutation = useUpdateMercadoLivrePricingControl();
    const toggleStatusMutation = useToggleMercadoLivreProduct();
    const pricingControlQuery = useMercadoLivrePricingControl(workspaceId, priceDialog?.id || null, {
        enabled: Boolean(priceDialog?.id),
        refreshTodaySpend: false,
    });

    const categoryOptions = useMemo(() => {
        const map = new Map<string, string>();
        (productsData?.items || []).forEach((product: any) => {
            const id = String(product.category || "").trim();
            const name = (product.category_name || product.category_path || "").trim();
            if (id && name) {
                map.set(id, name);
            }
        });
        return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
    }, [productsData]);

    const listingCounts = useMemo(() => {
        const base = productsData?.items || [];
        return {
            all: base.length,
            active: base.filter((product: any) => product.status === "active").length,
            paused: base.filter((product: any) => product.status === "paused").length,
            closed: base.filter((product: any) => product.status === "closed").length,
            full: base.filter((product: any) => product.isFull).length,
            catalog: base.filter((product: any) => product.catalog_listing || product.catalog_product_id).length,
        };
    }, [productsData]);

    const filteredProducts = productsData?.items?.filter((product: any) => {
        const normalizedSearch = debouncedSearch.trim().toLowerCase();
        const matchesSearch = !normalizedSearch || [
            product.title,
            product.id,
            product.sku,
            product.category_name,
            product.category_path,
        ]
            .filter(Boolean)
            .some((value: string) => String(value).toLowerCase().includes(normalizedSearch));

        const productCategory = String(product.category || "").trim();
        const matchesCategory = categoryFilter === "all" || productCategory === categoryFilter;

        const matchesSegment = (() => {
            switch (segmentFilter) {
                case "active":
                case "paused":
                case "closed":
                    return product.status === segmentFilter;
                case "full":
                    return Boolean(product.isFull);
                case "catalog":
                    return Boolean(product.catalog_listing || product.catalog_product_id);
                default:
                    return true;
            }
        })();

        return matchesSearch && matchesCategory && matchesSegment;
    }) || [];

    const totalProducts = filteredProducts.length;
    const totalPages = Math.ceil(totalProducts / itemsPerPage);
    const paginatedProducts = filteredProducts.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const formatCurrency = (value: number | undefined) => {
        if (value === undefined || value === null) return "-";
        return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
        }).format(value);
    };

    const formatNumber = (value: number) => {
        return new Intl.NumberFormat("pt-BR").format(value || 0);
    };

    const getPricingRiskMeta = (riskLevel?: string | null) => {
        switch (riskLevel) {
            case "high":
                return { label: "Alto", className: "bg-red-100 text-red-700 border-red-200" };
            case "medium":
                return { label: "Médio", className: "bg-amber-100 text-amber-700 border-amber-200" };
            case "low":
                return { label: "Baixo", className: "bg-emerald-100 text-emerald-700 border-emerald-200" };
            default:
                return { label: "Sem custo", className: "bg-slate-100 text-slate-700 border-slate-200" };
        }
    };

    const getRiskExplanation = (pricingSummary: any) => {
        if (!pricingSummary) {
            return "Resumo de precificação indisponível.";
        }

        const reasons = Array.isArray(pricingSummary.riskReasons) ? pricingSummary.riskReasons : [];

        if (!pricingSummary.costConfigured || reasons.includes("cost_missing")) {
            return "Sem custo configurado. Configure o custo para liberar a margem real.";
        }

        if (reasons.includes("unit_loss")) {
            return "Risco alto: prejuízo unitário no preço atual.";
        }

        if (reasons.includes("ads_net_loss_30d")) {
            return "Risco alto: Ads 30d no negativo. O anúncio dá lucro por unidade, mas os anúncios pagos consumiram mais do que geraram.";
        }

        if (reasons.includes("ads_limit_exceeded")) {
            return "Risco médio: gasto diário de ads acima do limite configurado.";
        }

        return "Margem unitária positiva no preço atual.";
    };

    const parsePrice = (value: string) => {
        const normalized = value.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
        return Number(normalized);
    };

    const parseOptionalMoney = (value: string) => {
        const trimmed = value.trim();
        if (!trimmed) return null;
        return parsePrice(trimmed);
    };

    const getCategoryDisplay = (product: any) => {
        return product.category_name || product.category_path || product.category || "Categoria não informada";
    };

    const getStatusBadge = (status: string | undefined) => {
        if (!status) return <Badge variant="outline">N/A</Badge>;

        const styles: Record<string, string> = {
            active: "bg-green-100 text-green-700 hover:bg-green-200 border-green-200",
            paused: "bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border-yellow-200",
            closed: "bg-red-100 text-red-700 hover:bg-red-200 border-red-200",
            draft: "bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-200"
        };

        const labels: Record<string, string> = {
            active: "Ativo",
            paused: "Pausado",
            closed: "Fechado",
            draft: "Rascunho"
        };

        return (
            <Badge variant="outline" className={`${styles[status] || styles.draft} border`}>
                {labels[status] || status}
            </Badge>
        );
    };

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        toast({
            title: "Copiado",
            description: `${label} copiado para a área de transferência`,
        });
    };

    const getSortedAttributes = (attributes: any[]) => {
        if (!attributes) return [];

        const priorityKeys = ['Marca', 'Modelo', 'Material', 'Estilo', 'Cor', 'Gênero', 'Tamanho', 'Voltagem'];

        return [...attributes].sort((a, b) => {
            const aIndex = priorityKeys.findIndex(k => a.name === k || a.id === k);
            const bIndex = priorityKeys.findIndex(k => b.name === k || b.id === k);

            if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
            if (aIndex !== -1) return -1;
            if (bIndex !== -1) return 1;
            return 0;
        });
    };

    const getAttributeValue = (product: any, keys: string[]) => {
        const targets = keys.map((k) => k.toLowerCase());
        const attr = (product.attributes || []).find((a: any) => {
            const id = String(a.id || "").toLowerCase();
            const name = String(a.name || "").toLowerCase();
            return targets.includes(id) || targets.includes(name);
        });
        return attr?.value_name || attr?.value_id || "-";
    };

    const getListingTypeLabel = (listingType?: string | null) => {
        if (!listingType) return "N/A";
        if (listingType === "gold_special") return "Clássico";
        if (listingType === "gold_pro") return "Premium";
        return listingType;
    };

    const getDeliveryLabel = (product: any) => {
        const base = product.isFull ? "Full" : "Normal";
        const parts = [base];
        if (product.shipping?.mode) parts.push(product.shipping.mode);
        if (product.shipping?.free_shipping) parts.push("Frete grátis");
        return parts.join(" • ");
    };

    const formatPercent = (value: number | undefined | null, digits = 1) => {
        const normalized = Number(value || 0);
        return `${normalized.toFixed(digits)}%`;
    };

    const getBasePrice = (product: any) => {
        const value = Number(product.base_price ?? product.price ?? 0);
        return Number.isFinite(value) ? value : 0;
    };

    const getStorefrontPrice = (product: any) => {
        const salePrice = Number(product.sale_price);
        if (Number.isFinite(salePrice) && salePrice > 0) {
            return salePrice;
        }

        return getBasePrice(product);
    };

    const getPromotionMeta = (product: any) => {
        const currentPrice = getStorefrontPrice(product);
        const originalCandidates = [
            Number(product.sale_price_regular_amount || 0),
            Number(product.original_price || 0),
        ];
        const originalPrice = originalCandidates.find((value) => Number.isFinite(value) && value > currentPrice) || 0;
        if (!Number.isFinite(originalPrice) || !Number.isFinite(currentPrice) || originalPrice <= currentPrice || currentPrice <= 0) {
            return null;
        }

        const discountPct = ((originalPrice - currentPrice) / originalPrice) * 100;
        return {
            originalPrice,
            currentPrice,
            discountPct,
        };
    };

    const getNetReceivedAmount = (product: any) => {
        const pricingSummary = product?.pricing_summary;
        const summaryValue = Number(pricingSummary?.netReceivedBeforeCompanyTax);
        if (Number.isFinite(summaryValue) && summaryValue >= 0) {
            return summaryValue;
        }

        if (!pricingSummary) {
            return null;
        }

        const storefrontPrice = getStorefrontPrice(product);
        const mlFeeRate = Number(pricingSummary.mlFeeRate || 0);
        const paymentFeeRate = Number(pricingSummary.paymentFeeRate || 0);
        const fixedFee = Number(pricingSummary.fixedFee || 0);
        const variableRate = mlFeeRate + paymentFeeRate;

        if (!Number.isFinite(storefrontPrice) || storefrontPrice <= 0) {
            return null;
        }

        return Math.max(0, (storefrontPrice * (1 - variableRate)) - fixedFee);
    };

    const formatRelativeAge = (value?: string | null) => {
        if (!value) return "Sem data";
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return "Sem data";
        const diffMs = Date.now() - parsed.getTime();
        const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
        if (diffDays === 0) return "Criado hoje";
        if (diffDays === 1) return "Criado há 1 dia";
        return `Criado há ${formatNumber(diffDays)} dias`;
    };

    const isCatalogListing = (product: any) => Boolean(product.catalog_listing || product.catalog_product_id);

    const getShippingLine = (product: any) => {
        if (product.shipping?.free_shipping) return "Frete grátis";
        if (product.shipping?.mode) return `Frete via ${product.shipping.mode}`;
        return "Frete por conta do comprador";
    };

    const getChannelLabels = (channels?: string[]) => {
        const values = Array.isArray(channels) ? channels : [];
        if (!values.length) return ["Marketplace"];

        return values.map((channel) => {
            const normalized = String(channel || "").toLowerCase();
            if (normalized === "mshops") return "MShops";
            if (normalized === "marketplace") return "Marketplace";
            return channel;
        });
    };

    const segmentOptions: Array<{
        key: "all" | "active" | "paused" | "closed" | "full" | "catalog";
        label: string;
        count: number;
    }> = [
        { key: "all", label: "Todos", count: listingCounts.all },
        { key: "active", label: "Ativos", count: listingCounts.active },
        { key: "paused", label: "Pausados", count: listingCounts.paused },
        { key: "closed", label: "Fechados", count: listingCounts.closed },
        { key: "full", label: "Full", count: listingCounts.full },
        { key: "catalog", label: "Catálogo", count: listingCounts.catalog },
    ];

    const handleExportPurchaseList = () => {
        const items = filteredProducts.map((p: any) => ({
            title: p.title || "-",
            sku: p.sku || p.variation || "-",
            thumb: p.thumbnail || (Array.isArray(p.pictures) ? p.pictures[0]?.url : undefined) || "",
            stock: typeof p.stock === "number" ? p.stock : 0,
        }));

        const date = new Date();
        const pad = (n: number) => String(n).padStart(2, "0");
        const fileName = `lista-compra_${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.html`;

        const style = `
            <style>
            :root { color-scheme: light dark; }
            body { font-family: -apple-system, system-ui, Segoe UI, Roboto, Helvetica, Arial, sans-serif; margin: 24px; }
            h1 { font-size: 20px; margin: 0 0 16px; }
            .meta { color: #666; font-size: 12px; margin-bottom: 20px; }
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
            .item { display: grid; grid-template-columns: 64px 1fr; gap: 12px; align-items: center; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; }
            .thumb { width: 64px; height: 64px; border-radius: 6px; object-fit: cover; background: #fff; border: 1px solid #e5e7eb; }
            .title { font-size: 14px; font-weight: 600; line-height: 1.3; margin-bottom: 4px; }
            .sku { font-size: 12px; color: #374151; }
            @media print {
              .item { break-inside: avoid; }
              a { color: inherit; text-decoration: none; }
            }
            </style>
        `;

        const header = `
            <h1>Lista de Compra</h1>
            <div class="meta">
              Total: ${items.length} itens
              ${categoryFilter !== "all" ? ` • Categoria: ${categoryOptions.find(([id]) => id === categoryFilter)?.[1] || categoryFilter}` : ""}
              ${search ? ` • Filtro: "${search}"` : ""}
            </div>
        `;

        const grid = `
            <div class="grid">
              ${items.map(it => `
                <div class="item">
                  ${it.thumb ? `<img class="thumb" src="${it.thumb}" alt="${it.title}">` : `<div class="thumb"></div>`}
                  <div>
                    <div class="title">${it.title}</div>
                    <div class="sku">SKU: ${it.sku} • Estoque: ${formatNumber(it.stock)}</div>
                  </div>
                </div>
              `).join("")}
            </div>
        `;

        const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${style}</head><body>${header}${grid}</body></html>`;
        const blob = new Blob([html], { type: "text/html;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast({
            title: "Lista exportada",
            description: "Arquivo HTML baixado com nome " + fileName,
        });
    };

    const handleExportPurchaseListPdf = () => {
        if (!workspaceId) {
            toast({ title: "Workspace não selecionado", description: "Selecione um workspace para exportar", variant: "destructive" });
            return;
        }
        const params = new URLSearchParams({ workspaceId });
        if (categoryFilter && categoryFilter !== "all") {
            params.set("category", categoryFilter);
        }
        if (search) {
            params.set("search", search);
        }
        const url = `/api/integrations/mercadolivre/products/export/purchase-list.pdf?${params.toString()}`;
        window.open(url, "_blank");
    };

    const handleDownloadPdf = (productId: string, size?: "a4" | "10x15") => {
        if (!workspaceId) {
            toast({ title: "Workspace não selecionado", description: "Selecione um workspace para exportar", variant: "destructive" });
            return;
        }
        const params = new URLSearchParams({ workspaceId });
        const chosenSize = size || pdfFormat;
        if (chosenSize === "10x15") {
            params.set("pageSize", "10x15");
        }
        const url = `/api/integrations/mercadolivre/products/${productId}/pdf?${params.toString()}`;
        window.open(url, "_blank");
    };

    const handleDownloadXlsx = (opts?: { category?: string }) => {
        if (!workspaceId) {
            toast({ title: "Workspace não selecionado", description: "Selecione um workspace para exportar", variant: "destructive" });
            return;
        }
        const params = new URLSearchParams({ workspaceId });
        if (opts?.category && opts.category !== "all") {
            params.set("category", opts.category);
        }
        const url = `/api/integrations/mercadolivre/products/export/xlsx?${params.toString()}`;
        window.open(url, "_blank");
    };

    const handleRefreshProducts = async () => {
        if (!workspaceId) return;
        try {
            const result = await refetch();
            if (result.error) {
                const message = result.error instanceof Error ? result.error.message : "Falha ao atualizar a lista.";
                toast({
                    title: "Erro ao atualizar",
                    description: message,
                    variant: "destructive",
                });
                return;
            }
            toast({
                title: "Lista atualizada",
                description: "Anúncios recarregados com sucesso.",
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : "Falha ao atualizar a lista.";
            toast({
                title: "Erro ao atualizar",
                description: message,
                variant: "destructive",
            });
        }
    };

    const handleOpenPriceDialog = (product: any) => {
        hydratedCostDialogRef.current = null;
        const basePrice = getBasePrice(product);
        setPriceDialog({
            id: product.id,
            title: product.title,
            price: basePrice,
            storefrontPrice: getStorefrontPrice(product),
        });
        setPriceDraft(String(basePrice || ""));
        setCostDraft("");
    };

    const handleApplyPrice = async () => {
        if (!priceDialog || !workspaceId) return;
        const priceValue = parsePrice(priceDraft);
        if (!Number.isFinite(priceValue) || priceValue <= 0) {
            toast({
                title: "Preço inválido",
                description: "Informe um valor maior que zero.",
                variant: "destructive",
            });
            return;
        }

        const costValue = parseOptionalMoney(costDraft);
        if (costValue !== null && (!Number.isFinite(costValue) || costValue < 0)) {
            toast({
                title: "Custo inválido",
                description: "Informe um custo maior ou igual a zero.",
                variant: "destructive",
            });
            return;
        }

        const currentCostPrice = pricingControlQuery.data?.controls.costPrice ?? null;
        const priceChanged = Math.abs(priceValue - priceDialog.price) > 0.0001;
        const costChanged = currentCostPrice === null
            ? costValue !== null
            : costValue === null || Math.abs(costValue - currentCostPrice) > 0.0001;

        if (!priceChanged && !costChanged) {
            toast({
                title: "Sem alterações",
                description: "Preço e custo já estão com esses valores.",
            });
            setPriceDialog(null);
            setPriceDraft("");
            setCostDraft("");
            return;
        }

        let priceUpdated = false;
        let costUpdated = false;
        let priceError: string | null = null;
        let costError: string | null = null;

        try {
            if (priceChanged) {
                try {
                    await updatePriceMutation.mutateAsync({
                        workspaceId,
                        productId: priceDialog.id,
                        price: priceValue,
                    });
                    priceUpdated = true;
                } catch (err: any) {
                    priceError = err?.message || "Não foi possível atualizar o preço.";
                }
            }

            if (costChanged) {
                try {
                    await updatePricingControlMutation.mutateAsync({
                        workspaceId,
                        mlItemId: priceDialog.id,
                        controls: {
                            costPrice: costValue,
                        },
                    });
                    costUpdated = true;
                } catch (err: any) {
                    costError = err?.message || "Não foi possível atualizar o custo.";
                }
            }

            if (priceError || costError) {
                const partialSuccess = priceUpdated || costUpdated;
                toast({
                    title: partialSuccess ? "Atualização parcial" : "Falha ao atualizar",
                    description: [
                        priceUpdated ? `Preço salvo em ${formatCurrency(priceValue)}` : null,
                        costUpdated ? `Custo salvo em ${costValue === null ? "Sem custo" : formatCurrency(costValue)}` : null,
                        priceError,
                        costError,
                    ].filter(Boolean).join(" • "),
                    variant: partialSuccess ? "default" : "destructive",
                });
                return;
            }

            toast({
                title: priceChanged && costChanged
                    ? "Preço e custo atualizados"
                    : priceChanged
                        ? "Preço atualizado"
                        : "Custo atualizado",
                description: [
                    priceChanged ? `${priceDialog.title} → ${formatCurrency(priceValue)}` : null,
                    costChanged ? `Custo → ${costValue === null ? "Sem custo" : formatCurrency(costValue)}` : null,
                ].filter(Boolean).join(" • "),
            });
            setPriceDialog(null);
            setPriceDraft("");
            setCostDraft("");
        } catch (err: any) {
            toast({
                title: "Falha ao atualizar",
                description: err?.message || "Não foi possível salvar as alterações.",
                variant: "destructive",
            });
        }
    };

    useEffect(() => {
        if (!priceDialog) {
            hydratedCostDialogRef.current = null;
            setCostDraft("");
            return;
        }

        const queryItemId = String(pricingControlQuery.data?.item?.mlItemId || "").trim().toUpperCase();
        const dialogItemId = String(priceDialog.id || "").trim().toUpperCase();
        if (!queryItemId || queryItemId !== dialogItemId) return;
        if (hydratedCostDialogRef.current === dialogItemId) return;

        const currentCost = pricingControlQuery.data?.controls.costPrice;
        setCostDraft(currentCost === null || currentCost === undefined ? "" : String(currentCost));
        hydratedCostDialogRef.current = dialogItemId;
    }, [priceDialog, pricingControlQuery.data]);

    const handleConfirmToggle = async () => {
        if (!toggleDialog || !workspaceId) return;
        try {
            await toggleStatusMutation.mutateAsync({
                workspaceId,
                productId: toggleDialog.id,
                status: toggleDialog.nextStatus,
            });
            toast({
                title: "Status atualizado",
                description: `${toggleDialog.title} → ${toggleDialog.nextStatus === "active" ? "Ativo" : "Pausado"}`,
            });
            setToggleDialog(null);
        } catch (err: any) {
            toast({
                title: "Falha ao atualizar status",
                description: err?.message || "Não foi possível atualizar o status.",
                variant: "destructive",
            });
        }
    };
    
    // removido: exportação XLSX A4 por produto

    if (!workspaceId) {
        return (
                    <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
                        <Package className="h-16 w-16 text-muted-foreground/50" />
                        <h1 className="text-2xl font-bold">Selecione um Workspace</h1>
                        <p className="text-muted-foreground">Para visualizar seus anúncios, selecione um workspace no menu.</p>
                    </div>
                );
            }

    return (
        <>
            <div className="space-y-6 h-full flex flex-col">
            {/* Header Section */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between px-1">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Package className="h-8 w-8 text-primary" />
                        Anúncios Mercado Livre
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Todos os anúncios sincronizados do Mercado Livre
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="bg-primary/10 text-primary px-4 py-2 rounded-lg font-medium text-sm border border-primary/20">
                        {totalProducts} produtos encontrados
                    </div>
                    <Button
                        size="sm"
                        className="gap-2"
                        onClick={handleRefreshProducts}
                        disabled={isFetching}
                        title="Recarregar anúncios do Mercado Livre"
                    >
                        <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
                        {isFetching ? "Atualizando..." : "Atualizar lista"}
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => handleDownloadXlsx()}>
                        <DownloadCloud className="h-4 w-4" />
                        Exportar XLSX
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        disabled={categoryFilter === "all"}
                        onClick={() => handleDownloadXlsx({ category: categoryFilter })}
                    >
                        <DownloadCloud className="h-4 w-4" />
                        Exportar XLSX (categoria)
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={handleExportPurchaseListPdf}
                        title="Exporta PDF com nome, SKU, estoque e thumb"
                    >
                        <FileText className="h-4 w-4" />
                        Exportar Lista de Compra (PDF)
                    </Button>
                    {/* removido: botão XLSX (A4 por produto) */}
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-muted-foreground">Total Ativos</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatNumber(productsData?.counts?.active || 0)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-muted-foreground">Full / Normal</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-baseline gap-2">
                            <span className="text-blue-600 font-bold">{formatNumber(productsData?.counts?.full || 0)}</span>
                            <span className="text-muted-foreground">/</span>
                            <span className="text-orange-600 font-bold">{formatNumber(productsData?.counts?.normal || 0)}</span>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-muted-foreground">Estoque Disponível</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatNumber(productsData?.stock?.total || 0)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-muted-foreground">Receita Estimada</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-600">
                            {formatCurrency((productsData?.items || []).reduce((sum: number, p: any) => sum + (p.revenue || 0), 0))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters & Search */}
            <Card className="bg-card/50 backdrop-blur-sm">
                <CardContent className="p-4">
                    <div className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                            {segmentOptions.map((option) => (
                                <Button
                                    key={option.key}
                                    type="button"
                                    variant={segmentFilter === option.key ? "default" : "outline"}
                                    className="h-9 rounded-full"
                                    onClick={() => {
                                        setSegmentFilter(option.key);
                                        setCurrentPage(1);
                                    }}
                                >
                                    {option.label}
                                    <Badge variant="secondary" className="ml-2 h-5 rounded-full px-1.5 text-[10px]">
                                        {formatNumber(option.count)}
                                    </Badge>
                                </Button>
                            ))}
                        </div>

                        <div className="flex flex-col md:flex-row md:items-center gap-3">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por título..."
                                value={search}
                                onChange={(e) => {
                                    setSearch(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="pl-10"
                            />
                        </div>
                        <div className="w-full md:w-60">
                            <Select
                                value={categoryFilter}
                                onValueChange={(value) => {
                                    setCategoryFilter(value);
                                    setCurrentPage(1);
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Filtrar por categoria" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas categorias</SelectItem>
                                    {categoryOptions.map(([id, name]) => (
                                        <SelectItem key={id} value={id}>
                                            {name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="text-xs text-muted-foreground">
                            {formatNumber(totalProducts)} anúncios na visualização atual
                        </div>
                    </div>
                    </div>
                </CardContent>
            </Card>

            {/* Main Table */}
            <Card className="flex-1 overflow-hidden border-0 shadow-md">
                <CardHeader className="px-6 py-4 border-b bg-muted/30">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Box className="h-5 w-5" />
                            Lista Completa de Anúncios
                        </CardTitle>
                        
                    </div>
                </CardHeader>
                <CardContent className="p-0 overflow-hidden relative h-full">
                    {isLoading ? (
                        <div className="p-6 space-y-4">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="flex items-center gap-4">
                                    <Skeleton className="h-12 w-12 rounded" />
                                    <div className="space-y-2 flex-1">
                                        <Skeleton className="h-4 w-[200px]" />
                                        <Skeleton className="h-3 w-[150px]" />
                                    </div>
                                    <Skeleton className="h-8 w-full max-w-3xl" />
                                </div>
                            ))}
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center p-12 text-center text-red-500">
                            <AlertCircle className="h-12 w-12 mb-4" />
                            <h3 className="text-lg font-semibold">Erro ao carregar do Mercado Livre</h3>
                            <p className="text-sm opacity-80">Verifique a conexão ou tente novamente.</p>
                        </div>
                    ) : paginatedProducts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                            <Package className="h-16 w-16 mb-4 opacity-20" />
                            <h3 className="text-lg font-semibold">Nenhum produto encontrado</h3>
                            <p className="text-sm">Tente ajustar seus filtros de busca.</p>
                        </div>
                    ) : (
                        <ScrollArea className="h-[calc(100vh-350px)] w-full">
                            <div className="space-y-3 p-4">
                                {paginatedProducts.map((product: any) => {
                                    const sortedAttributes = getSortedAttributes(product.attributes);
                                    const mlLink = product.permalink ||
                                        (product.id ? `https://produto.mercadolivre.com.br/MLB-${product.id.replace(/^MLB/, '')}` : '#');
                                    const pricingSummary = product.pricing_summary;
                                    const riskMeta = getPricingRiskMeta(pricingSummary?.riskLevel);
                                    const channels = getChannelLabels(product.channels);
                                    const promotionMeta = getPromotionMeta(product);
                                    const storefrontPrice = getStorefrontPrice(product);
                                    const basePrice = getBasePrice(product);
                                    const netReceivedAmount = getNetReceivedAmount(product);
                                    const hasStorefrontDifference = Math.abs(storefrontPrice - basePrice) > 0.0001;

                                    return (
                                        <Dialog key={product.id}>
                                            <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition hover:border-primary/30 hover:shadow-md">
                                                <div className="grid gap-4 xl:grid-cols-[96px,minmax(0,1fr)]">
                                                    <div className="space-y-2">
                                                        <div className="h-24 w-24 overflow-hidden rounded-2xl border bg-white">
                                                            {product.thumbnail ? (
                                                                <img
                                                                    src={product.thumbnail}
                                                                    alt={product.title}
                                                                    className="h-full w-full object-cover"
                                                                />
                                                            ) : (
                                                                <Package className="h-full w-full p-5 text-muted-foreground" />
                                                            )}
                                                        </div>
                                                        <div className="flex flex-wrap gap-1">
                                                            {isCatalogListing(product) ? <Badge className="bg-sky-100 text-sky-700 hover:bg-sky-100">Catálogo</Badge> : null}
                                                            {product.isFull ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Full</Badge> : null}
                                                            {product.shipping?.free_shipping ? <Badge variant="secondary">Frete grátis</Badge> : null}
                                                        </div>
                                                    </div>

                                                    <div className="space-y-3">
                                                        <div className="space-y-3">
                                                            <div className="space-y-2">
                                                                <div className="flex flex-wrap items-start gap-2">
                                                                    <h3 className="text-base font-semibold leading-6 text-foreground">{product.title}</h3>
                                                                    {getStatusBadge(product.status)}
                                                                    {product.official_store_id ? <Badge variant="secondary">Loja oficial</Badge> : null}
                                                                </div>
                                                                <p className="text-sm text-muted-foreground">
                                                                    {product.category_path || getCategoryDisplay(product)}
                                                                </p>
                                                            </div>

                                                            <div className="rounded-2xl border bg-muted/20 p-4">
                                                                <div className="grid gap-3 xl:grid-cols-[minmax(0,1.4fr),repeat(4,minmax(0,180px))]">
                                                                    <div className="rounded-2xl border bg-background p-4">
                                                                        <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Preço de vitrine</div>
                                                                        <div className="mt-1 text-4xl font-bold leading-none text-foreground">{formatCurrency(storefrontPrice)}</div>
                                                                        {promotionMeta ? (
                                                                            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                                                                                <span className="text-muted-foreground line-through">
                                                                                    {formatCurrency(promotionMeta.originalPrice)}
                                                                                </span>
                                                                                <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100">
                                                                                    Promoção {formatPercent(promotionMeta.discountPct, 1)}
                                                                                </Badge>
                                                                            </div>
                                                                        ) : null}
                                                                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                                                            {hasStorefrontDifference ? (
                                                                                <span>Preço-base no anúncio: {formatCurrency(basePrice)}</span>
                                                                            ) : null}
                                                                            <span>{getShippingLine(product)}</span>
                                                                        </div>
                                                                    </div>

                                                                    <div className="rounded-xl border bg-background p-3">
                                                                        <div className="text-xs text-muted-foreground">Custo</div>
                                                                        <div className="mt-1 font-semibold">
                                                                            {pricingSummary?.costConfigured && pricingSummary.costPrice != null
                                                                                ? formatCurrency(pricingSummary.costPrice)
                                                                                : "Sem custo"}
                                                                        </div>
                                                                    </div>
                                                                    <div className="rounded-xl border bg-background p-3">
                                                                        <div className="text-xs text-muted-foreground">Recebido</div>
                                                                        <div className="mt-1 font-semibold text-sky-700">
                                                                            {netReceivedAmount != null ? formatCurrency(netReceivedAmount) : "N/D"}
                                                                        </div>
                                                                    </div>
                                                                    <div className="rounded-xl border bg-background p-3">
                                                                        <div className="text-xs text-muted-foreground">Lucro / un</div>
                                                                        <div className={`mt-1 font-semibold ${(pricingSummary?.profitPerUnitCurrentPrice ?? 0) >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                                                                            {pricingSummary?.profitPerUnitCurrentPrice != null
                                                                                ? formatCurrency(pricingSummary.profitPerUnitCurrentPrice)
                                                                                : "N/D"}
                                                                        </div>
                                                                    </div>
                                                                    <div className="rounded-xl border bg-background p-3">
                                                                        <div className="text-xs text-muted-foreground">Margem</div>
                                                                        <div className="mt-1 font-semibold">
                                                                            {pricingSummary?.marginCurrentPrice != null
                                                                                ? formatPercent(pricingSummary.marginCurrentPrice * 100, 1)
                                                                                : "N/D"}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="flex flex-wrap gap-2 text-xs">
                                                            <Badge variant="outline" className="gap-1">
                                                                <Tag className="h-3 w-3" />
                                                                MLB {product.id}
                                                            </Badge>
                                                            {product.sku ? (
                                                                <Badge variant="outline" className="gap-1">
                                                                    SKU {product.sku}
                                                                </Badge>
                                                            ) : null}
                                                            <Badge variant="outline" className="gap-1">
                                                                <Calendar className="h-3 w-3" />
                                                                {formatRelativeAge(product.date_created)}
                                                            </Badge>
                                                            <Badge variant="outline" className="gap-1">
                                                                Tarifa ML {formatPercent((pricingSummary?.mlFeeRate || 0) * 100, 2)}
                                                            </Badge>
                                                            {pricingSummary?.fixedFee ? (
                                                                <Badge variant="outline">
                                                                    Taxa fixa {formatCurrency(pricingSummary.fixedFee)}
                                                                </Badge>
                                                            ) : null}
                                                        </div>

                                                        <div className="flex flex-wrap gap-2 text-xs">
                                                            <Badge variant="secondary" className="gap-1">
                                                                <Eye className="h-3 w-3" />
                                                                {formatNumber(product.visits || 0)} visitas
                                                            </Badge>
                                                            <Badge variant="secondary" className="gap-1">
                                                                <TrendingUp className="h-3 w-3" />
                                                                {formatNumber(product.sales || 0)} vendidos
                                                            </Badge>
                                                            <Badge variant="secondary">
                                                                Conversão {formatPercent(product.conversionRate || 0, 2)}
                                                            </Badge>
                                                            <Badge variant="secondary">
                                                                Estoque {formatNumber(product.stock || 0)}
                                                            </Badge>
                                                            <Badge variant="secondary" className="gap-1">
                                                                <Image className="h-3 w-3" />
                                                                {formatNumber(product.pictures_count || 0)} imagens
                                                            </Badge>
                                                            <Badge variant="secondary" className="gap-1">
                                                                <Video className="h-3 w-3" />
                                                                {product.has_video ? "Com vídeo" : "Sem vídeo"}
                                                            </Badge>
                                                        </div>

                                                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                                            <span className="inline-flex items-center gap-1">
                                                                <Truck className="h-3 w-3" />
                                                                {getShippingLine(product)}
                                                            </span>
                                                            <span className="inline-flex items-center gap-1">
                                                                <Store className="h-3 w-3" />
                                                                {channels.join(" • ")}
                                                            </span>
                                                            <span>{getListingTypeLabel(product.listing_type_id)}</span>
                                                        </div>

                                                        <div className="rounded-2xl border bg-muted/30 p-3 text-sm">
                                                            {!pricingSummary ? (
                                                                <span className="text-muted-foreground">Resumo de precificação indisponível.</span>
                                                            ) : (
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <Badge variant="outline" className={`border ${riskMeta.className}`}>
                                                                        Risco {riskMeta.label}
                                                                    </Badge>
                                                                    <span className="text-muted-foreground">
                                                                        {getRiskExplanation(pricingSummary)}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        
                                                        <div className="grid gap-3 text-sm md:grid-cols-3 xl:grid-cols-6">
                                                            <div className="rounded-xl border bg-background p-3">
                                                                <div className="text-xs text-muted-foreground">Receita</div>
                                                                <div className="mt-1 font-semibold text-emerald-700">{formatCurrency(product.revenue || 0)}</div>
                                                            </div>
                                                            <div className="rounded-xl border bg-background p-3">
                                                                <div className="text-xs text-muted-foreground">Visitas</div>
                                                                <div className="mt-1 font-semibold">{formatNumber(product.visits || 0)}</div>
                                                            </div>
                                                            <div className="rounded-xl border bg-background p-3">
                                                                <div className="text-xs text-muted-foreground">Vendidos</div>
                                                                <div className="mt-1 font-semibold">{formatNumber(product.sales || 0)}</div>
                                                            </div>
                                                            <div className="rounded-xl border bg-background p-3">
                                                                <div className="text-xs text-muted-foreground">Conversão</div>
                                                                <div className="mt-1 font-semibold">{formatPercent(product.conversionRate || 0, 2)}</div>
                                                            </div>
                                                            <div className="rounded-xl border bg-background p-3">
                                                                <div className="text-xs text-muted-foreground">Estoque</div>
                                                                <div className="mt-1 font-semibold">{formatNumber(product.stock || 0)}</div>
                                                            </div>
                                                            <div className="rounded-xl border bg-background p-3">
                                                                <div className="text-xs text-muted-foreground">Conteúdo</div>
                                                                <div className="mt-1 font-semibold">{formatNumber(product.pictures_count || 0)} img • {product.has_video ? "vídeo" : "sem vídeo"}</div>
                                                            </div>
                                                        </div>

                                                        <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-8 text-xs text-blue-600 hover:text-blue-700"
                                                                onClick={() => window.open(mlLink, '_blank')}
                                                            >
                                                                <ExternalLink className="mr-1 h-3 w-3" />
                                                                Abrir
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-8 text-xs text-emerald-600 hover:text-emerald-700"
                                                                onClick={() => handleOpenPriceDialog(product)}
                                                            >
                                                                <DollarSign className="mr-1 h-3 w-3" />
                                                                Preço
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-8 text-xs text-amber-600 hover:text-amber-700"
                                                                onClick={() => navigate(`/mercado-livre-price-calculator?mlb=${product.id}`)}
                                                            >
                                                                Precificar
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-8 text-xs text-purple-600 hover:text-purple-700"
                                                                onClick={() => navigate(`/mercado-livre-analyzer?mlb=${product.id}`)}
                                                            >
                                                                <Target className="mr-1 h-3 w-3" />
                                                                Analisar
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-8 text-xs text-orange-600 hover:text-orange-700"
                                                                disabled={!(product.status === "active" || product.status === "paused")}
                                                                onClick={() => {
                                                                    if (!(product.status === "active" || product.status === "paused")) return;
                                                                    setToggleDialog({
                                                                        id: product.id,
                                                                        title: product.title,
                                                                        nextStatus: product.status === "active" ? "paused" : "active",
                                                                    });
                                                                }}
                                                            >
                                                                <AlertCircle className="mr-1 h-3 w-3" />
                                                                {product.status === "active" ? "Pausar" : "Ativar"}
                                                            </Button>
                                                            <DialogTrigger asChild>
                                                                <Button variant="outline" size="sm" className="h-8 text-xs">
                                                                    <Info className="mr-1 h-3 w-3" />
                                                                    Detalhes
                                                                </Button>
                                                            </DialogTrigger>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <DialogContent className="max-w-6xl w-[95vw]">
                                                        <DialogHeader className="pb-2">
                                                            <div className="flex items-center justify-between gap-3">
                                                                <div>
                                                                    <DialogTitle className="flex items-center gap-2">
                                                                        <Package className="w-5 h-5" />
                                                                        {product.title}
                                                                    </DialogTitle>
                                                                    <DialogDescription className="flex flex-wrap gap-2 items-center">
                                                                        <Badge variant="outline" className="text-[11px]">
                                                                            {product.category || product.category_name || "Categoria não informada"}
                                                                        </Badge>
                                                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                                            ID: {product.id}
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-4 w-4"
                                                                                onClick={() => copyToClipboard(product.id, "ID")}
                                                                                title="Copiar ID"
                                                                            >
                                                                                <Copy className="h-2.5 w-2.5 text-muted-foreground" />
                                                                            </Button>
                                                                        </span>
                                                                        {product.sku && <Badge variant="secondary">SKU: {product.sku}</Badge>}
                                                                        {getStatusBadge(product.status)}
                                                                    </DialogDescription>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <Select
                                                                        value={pdfFormat}
                                                                        onValueChange={(v) => setPdfFormat(v as "a4" | "10x15")}
                                                                    >
                                                                        <SelectTrigger className="h-8 w-[140px] text-xs">
                                                                            <SelectValue placeholder="Formato" />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="a4">PDF A4</SelectItem>
                                                                            <SelectItem value="10x15">Etiqueta 10x15</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="gap-2"
                                                                        onClick={() => handleDownloadPdf(product.id)}
                                                                    >
                                                                        <DownloadCloud className="h-4 w-4" />
                                                                        Baixar PDF
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </DialogHeader>

                                                        <div className="space-y-4">
                                                            <Card>
                                                                <CardHeader className="pb-2">
                                                                    <CardTitle className="text-sm">Condições gerais</CardTitle>
                                                                </CardHeader>
                                                                <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                                                                    <div className="space-y-1">
                                                                        <div className="text-muted-foreground text-xs">Código do anúncio</div>
                                                                        <div className="font-medium">{product.id}</div>
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <div className="text-muted-foreground text-xs">SKU / variação</div>
                                                                        <div className="font-medium">{product.sku || product.variation || "-"}</div>
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <div className="text-muted-foreground text-xs">Título</div>
                                                                        <div className="font-medium line-clamp-2">{product.title}</div>
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <div className="text-muted-foreground text-xs">Quantidade (estoque)</div>
                                                                        <div className="font-medium">{formatNumber(product.stock)}</div>
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <div className="text-muted-foreground text-xs">Catálogo</div>
                                                                        <div className="font-medium">
                                                                            {isCatalogListing(product)
                                                                                ? `Sim${product.catalog_product_id ? ` • ${product.catalog_product_id}` : ""}`
                                                                                : "Não"}
                                                                        </div>
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <div className="text-muted-foreground text-xs">Preço de vitrine</div>
                                                                        <div className="font-medium">
                                                                            {formatCurrency(storefrontPrice)}
                                                                            {promotionMeta ? (
                                                                                <span className="ml-2 text-xs text-muted-foreground line-through">
                                                                                    {formatCurrency(promotionMeta.originalPrice)}
                                                                                </span>
                                                                            ) : null}
                                                                        </div>
                                                                        {hasStorefrontDifference ? (
                                                                            <div className="text-xs text-muted-foreground">
                                                                                Base do anúncio: {formatCurrency(basePrice)}
                                                                            </div>
                                                                        ) : null}
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <div className="text-muted-foreground text-xs">Tarifa ML / taxa fixa</div>
                                                                        <div className="font-medium">
                                                                            {pricingSummary
                                                                                ? `${formatPercent((pricingSummary.mlFeeRate || 0) * 100, 2)} • ${formatCurrency(pricingSummary.fixedFee || 0)}`
                                                                                : "-"}
                                                                        </div>
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <div className="text-muted-foreground text-xs">Status</div>
                                                                        <div>{getStatusBadge(product.status)}</div>
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <div className="text-muted-foreground text-xs">Criado em</div>
                                                                        <div className="font-medium">
                                                                            {product.date_created ? new Date(product.date_created).toLocaleDateString("pt-BR") : "-"} • {formatRelativeAge(product.date_created)}
                                                                        </div>
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <div className="text-muted-foreground text-xs">Garantia</div>
                                                                        <div className="font-medium">{product.warranty || product.warranty_time || "-"}</div>
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <div className="text-muted-foreground text-xs">Entrega / frete</div>
                                                                        <div className="font-medium">{getDeliveryLabel(product)}</div>
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <div className="text-muted-foreground text-xs">Canais</div>
                                                                        <div className="font-medium">{getChannelLabels(product.channels).join(" • ")}</div>
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <div className="text-muted-foreground text-xs">Tipo de anúncio</div>
                                                                        <div className="font-medium">{getListingTypeLabel(product.listing_type_id)}</div>
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <div className="text-muted-foreground text-xs">Categoria</div>
                                                                        <div className="font-medium">{product.category || "-"}</div>
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <div className="text-muted-foreground text-xs">Visitas / vendas / conversão</div>
                                                                        <div className="font-medium">
                                                                            {formatNumber(product.visits || 0)} / {formatNumber(product.sales || 0)} / {formatPercent(product.conversionRate || 0, 2)}
                                                                        </div>
                                                                    </div>
                                                                    <div className="space-y-1 sm:col-span-2 lg:col-span-3">
                                                                        <div className="text-muted-foreground text-xs">Descrição</div>
                                                                        <div className="p-3 rounded border bg-muted/40 text-sm h-32 overflow-auto whitespace-pre-wrap">
                                                                            {product.description || "Sem descrição disponível"}
                                                                        </div>
                                                                    </div>
                                                                </CardContent>
                                                            </Card>

                                                            <Card>
                                                                <CardHeader className="pb-2">
                                                                    <CardTitle className="text-sm">Características do produto</CardTitle>
                                                                </CardHeader>
                                                                <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                                                                    <div>
                                                                        <div className="text-xs text-muted-foreground">Cor principal</div>
                                                                        <div className="font-medium">{product.color || getAttributeValue(product, ['color', 'cor'])}</div>
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-xs text-muted-foreground">Material</div>
                                                                        <div className="font-medium">{product.material || getAttributeValue(product, ['material'])}</div>
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-xs text-muted-foreground">Estilo</div>
                                                                        <div className="font-medium">{product.style || getAttributeValue(product, ['style', 'estilo'])}</div>
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-xs text-muted-foreground">Comprimento / Largura / Diâmetro</div>
                                                                        <div className="font-medium">
                                                                            {[product.length || getAttributeValue(product, ['length', 'comprimento']), product.width || getAttributeValue(product, ['width', 'largura']), product.diameter || getAttributeValue(product, ['diameter', 'diâmetro'])].filter(Boolean).join(" x ") || "-"}
                                                                        </div>
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-xs text-muted-foreground">Tipo de brinco</div>
                                                                        <div className="font-medium">{product.earring_type || getAttributeValue(product, ['earring_type', 'tipo de brinco'])}</div>
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-xs text-muted-foreground">Com pedra / Tipo de pedras</div>
                                                                        <div className="font-medium">
                                                                            {product.has_stones || product.stone_type
                                                                                ? [product.has_stones, product.stone_type].filter(Boolean).join(" • ")
                                                                                : "-"}
                                                                        </div>
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-xs text-muted-foreground">Peças no kit</div>
                                                                        <div className="font-medium">{product.kit_pieces || "-"}</div>
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-xs text-muted-foreground">Código universal (EAN/GTIN)</div>
                                                                        <div className="font-medium">{product.universal_code || product.fiscal?.ean || "-"}</div>
                                                                    </div>
                                                                    <div className="sm:col-span-2 lg:col-span-3">
                                                                        <div className="text-xs text-muted-foreground mb-2">Atributos</div>
                                                                        {sortedAttributes.length === 0 ? (
                                                                            <div className="text-sm text-muted-foreground">Sem atributos informados</div>
                                                                        ) : (
                                                                            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                                                                {sortedAttributes.map((attr: any, i: number) => (
                                                                                    <div key={i} className="p-2 rounded border bg-muted/30 text-xs">
                                                                                        <div className="text-muted-foreground font-semibold">{attr.name}</div>
                                                                                        <div className="font-medium break-words">{attr.value_name}</div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </CardContent>
                                                            </Card>

                                                            <Card>
                                                                <CardHeader className="pb-2">
                                                                    <CardTitle className="text-sm">Dados fiscais</CardTitle>
                                                                </CardHeader>
                                                                <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                                                                    <div>
                                                                        <div className="text-xs text-muted-foreground">NCM</div>
                                                                        <div className="font-medium">{product.fiscal?.ncm || "-"}</div>
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-xs text-muted-foreground">Origem</div>
                                                                        <div className="font-medium">{product.fiscal?.origin || "-"}</div>
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-xs text-muted-foreground">CFOP</div>
                                                                        <div className="font-medium">{product.fiscal?.cfop || "-"}</div>
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-xs text-muted-foreground">CST / CSOSN</div>
                                                                        <div className="font-medium">
                                                                            {[product.fiscal?.cst, product.fiscal?.csosn].filter(Boolean).join(" / ") || "-"}
                                                                        </div>
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-xs text-muted-foreground">Estado de origem</div>
                                                                        <div className="font-medium">{product.fiscal?.state || "-"}</div>
                                                                    </div>
                                                                    <div className="sm:col-span-2 lg:col-span-3">
                                                                        <div className="text-xs text-muted-foreground">Informações adicionais</div>
                                                                        <div className="font-medium">{product.fiscal?.additionalInfo || "-"}</div>
                                                                    </div>
                                                                </CardContent>
                                                            </Card>
                                                        </div>
                                                    </DialogContent>
                                        </Dialog>
                                    );
                                })}
                            </div>
                        </ScrollArea>
                    )}
                </CardContent>
            </Card>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between py-2">
                    <div className="text-sm text-muted-foreground">
                        Página {currentPage} de {totalPages}
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
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                        >
                            Próxima
                        </Button>
                    </div>
                </div>
            )}

            {/* Alertas de estoque */}
            <LowStockAlerts
                products={productsData?.items || []}
                loading={isLoading}
                threshold={5}
            />
            </div>

            <Dialog
            open={Boolean(priceDialog)}
            onOpenChange={(open) => {
                if (!open) {
                    setPriceDialog(null);
                    setPriceDraft("");
                    setCostDraft("");
                }
            }}
            >
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Atualizar preço-base e custo</DialogTitle>
                    <DialogDescription>
                        {priceDialog?.title}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                    <div>
                        <div className="text-xs text-muted-foreground mb-1">Preço-base atual do anúncio</div>
                        <div className="text-lg font-semibold">{priceDialog ? formatCurrency(priceDialog.price) : "—"}</div>
                        {priceDialog && Math.abs(priceDialog.storefrontPrice - priceDialog.price) > 0.0001 ? (
                            <div className="mt-1 text-[11px] text-muted-foreground">
                                Preço de vitrine atual: {formatCurrency(priceDialog.storefrontPrice)}
                            </div>
                        ) : null}
                    </div>
                    <div>
                        <div className="text-xs text-muted-foreground mb-1">Novo preço-base</div>
                        <Input
                            value={priceDraft}
                            onChange={(event) => setPriceDraft(event.target.value)}
                            placeholder="Ex: 129,90"
                            inputMode="decimal"
                        />
                    </div>
                    <div>
                        <div className="text-xs text-muted-foreground mb-1">Custo do produto</div>
                        <Input
                            value={costDraft}
                            onChange={(event) => setCostDraft(event.target.value)}
                            placeholder="Ex: 12,90"
                            inputMode="decimal"
                            disabled={pricingControlQuery.isLoading}
                        />
                        <div className="mt-1 text-[11px] text-muted-foreground">
                            {pricingControlQuery.isLoading
                                ? "Carregando custo atual..."
                                : pricingControlQuery.data?.controls.costPrice != null
                                    ? `Custo atual: ${formatCurrency(pricingControlQuery.data.controls.costPrice)}`
                                    : "Sem custo configurado. Esse valor afeta apenas a análise interna."}
                        </div>
                    </div>
                </div>
                <DialogFooter className="mt-4">
                    <Button
                        variant="outline"
                        onClick={() => setPriceDialog(null)}
                        disabled={updatePriceMutation.isPending || updatePricingControlMutation.isPending}
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleApplyPrice}
                        disabled={updatePriceMutation.isPending || updatePricingControlMutation.isPending}
                    >
                        {updatePriceMutation.isPending || updatePricingControlMutation.isPending ? "Salvando..." : "Salvar alterações"}
                    </Button>
                </DialogFooter>
            </DialogContent>
            </Dialog>

            <AlertDialog open={Boolean(toggleDialog)} onOpenChange={(open) => !open && setToggleDialog(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Alterar status do anúncio?</AlertDialogTitle>
                    <AlertDialogDescription>
                        {toggleDialog
                            ? `Você está prestes a ${toggleDialog.nextStatus === "active" ? "ativar" : "pausar"} “${toggleDialog.title}”.`
                            : ""}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={toggleStatusMutation.isPending}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleConfirmToggle}
                        disabled={toggleStatusMutation.isPending}
                    >
                        {toggleStatusMutation.isPending ? "Atualizando..." : "Confirmar"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
