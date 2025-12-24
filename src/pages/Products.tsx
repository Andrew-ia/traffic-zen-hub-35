import { useMemo, useState } from "react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useMercadoLivreProducts } from "@/hooks/useMercadoLivre";
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Package,
    Search,
    ExternalLink,
    TrendingUp,
    Target,
    AlertCircle,
    Truck,
    Box,
    Copy,
    Eye,
    Info,
    DownloadCloud,
    FileText
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
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(20);
    const [pdfFormat, setPdfFormat] = useState<"a4" | "10x15">("a4");

    const {
        data: productsData,
        isLoading,
        error
    } = useMercadoLivreProducts(workspaceId, "all", debouncedSearch);

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

    const filteredProducts = productsData?.items?.filter((product: any) => {
        const matchesSearch = debouncedSearch 
            ? true 
            : (product.title?.toLowerCase().includes(search.toLowerCase()) ||
               product.id?.toLowerCase().includes(search.toLowerCase()));

        const productCategory = String(product.category || "").trim();
        const matchesCategory = categoryFilter === "all" || productCategory === categoryFilter;

        return matchesSearch && matchesCategory;
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

            {/* Alertas de estoque */}
            <LowStockAlerts
                products={productsData?.items || []}
                loading={isLoading}
                threshold={5}
            />

            {/* Filters & Search */}
            <Card className="bg-card/50 backdrop-blur-sm">
                <CardContent className="p-4">
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
                            <div className="min-w-[1200px]"> {/* Horizontal scroll */}
                                <Table>
                                    <TableHeader className="bg-muted/50 sticky top-0 z-10 shadow-sm">
                                        <TableRow className="hover:bg-muted/50">
                                            <TableHead className="w-[70px] pl-4">Img</TableHead>
                                            <TableHead className="w-[300px]">Produto / Categoria</TableHead>
                                            <TableHead className="w-[100px]">Status</TableHead>
                                            <TableHead className="w-[120px] text-right">Preço</TableHead>
                                            <TableHead className="w-[100px] text-right">Estoque</TableHead>
                                            <TableHead className="w-[100px] text-right">Vendas</TableHead>
                                            <TableHead className="w-[100px] text-right">Receita</TableHead>
                                            <TableHead className="w-[100px] text-right">Visitas</TableHead>
                                            <TableHead className="w-[200px]">Tipo / Logística</TableHead>
                                            <TableHead className="w-[100px] text-center pr-4">Ações</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {paginatedProducts.map((product: any) => {
                                            const sortedAttributes = getSortedAttributes(product.attributes);
                                            const mlLink = product.permalink ||
                                                (product.id ? `https://produto.mercadolivre.com.br/MLB-${product.id.replace(/^MLB/, '')}` : '#');

                                            return (
                                                <Dialog key={product.id}>
                                                    <TableRow className="hover:bg-muted/30 transition-colors group">
                                                        {/* Img */}
                                                        <TableCell className="pl-4 py-3 align-middle">
                                                            <div className="h-12 w-12 rounded-md overflow-hidden border bg-white">
                                                                {product.thumbnail ? (
                                                                    <img
                                                                        src={product.thumbnail}
                                                                        alt={product.title}
                                                                        className="h-full w-full object-cover"
                                                                    />
                                                                ) : (
                                                                    <Package className="h-full w-full p-2 text-muted-foreground" />
                                                                )}
                                                            </div>
                                                        </TableCell>

                                                        {/* Produto / Categoria */}
                                                        <TableCell className="align-middle">
                                                            <div className="space-y-1">
                                                                <div className="font-medium text-sm line-clamp-2" title={product.title}>
                                                                    {product.title}
                                                                </div>
                                                                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                                                    <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-normal">
                                                                        {getCategoryDisplay(product)}
                                                                    </Badge>

                                                                    <span className="text-border mx-1">|</span>

                                                                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-mono">
                                                                        {product.id}
                                                                    </Badge>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-5 w-5 hover:bg-muted"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            copyToClipboard(product.id, "MLB ID");
                                                                        }}
                                                                        title="Copiar MLB ID"
                                                                    >
                                                                        <Copy className="h-2.5 w-2.5 text-muted-foreground" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </TableCell>

                                                        {/* Status */}
                                                        <TableCell className="align-middle">
                                                            {getStatusBadge(product.status)}
                                                        </TableCell>

                                                        {/* Preço */}
                                                        <TableCell className="text-right align-middle font-semibold">
                                                            {formatCurrency(product.price)}
                                                        </TableCell>

                                                        {/* Estoque */}
                                                        <TableCell className="text-right align-middle">
                                                            <Badge variant={product.stock > 0 ? "outline" : "destructive"} className="font-mono">
                                                                {formatNumber(product.stock)}
                                                            </Badge>
                                                        </TableCell>

                                                        {/* Vendas */}
                                                        <TableCell className="text-right align-middle">
                                                            <div className="flex items-center justify-end gap-1 text-green-600 font-medium">
                                                                <TrendingUp className="h-3 w-3" />
                                                                {formatNumber(product.sales || 0)}
                                                            </div>
                                                        </TableCell>

                                                        {/* Receita */}
                                                        <TableCell className="text-right align-middle text-emerald-600 font-semibold">
                                                            {formatCurrency(product.revenue || 0)}
                                                        </TableCell>

                                                        {/* Visitas */}
                                                        <TableCell className="text-right align-middle">
                                                            <div className="flex items-center justify-end gap-1 text-blue-600">
                                                                <Eye className="h-3 w-3" />
                                                                {formatNumber(product.visits || 0)}
                                                            </div>
                                                        </TableCell>

                                                        {/* Tipo / Logística */}
                                                        <TableCell className="align-middle">
                                                            <div className="flex flex-col gap-1 text-xs">
                                                                <div className="flex items-center gap-1">
                                                                    <Badge variant="secondary" className="h-5 text-[10px]">
                                                                        {getListingTypeLabel(product.listing_type_id)}
                                                                    </Badge>
                                                                </div>
                                                                <div className="flex items-center gap-1 text-muted-foreground">
                                                                    <Truck className="h-3 w-3" />
                                                                    <span>{getDeliveryLabel(product)}</span>
                                                                </div>
                                                            </div>
                                                        </TableCell>

                                                        {/* Ações */}
                                                        <TableCell className="text-center align-middle pr-4">
                                                            <div className="flex items-center justify-center gap-2">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-8 text-xs text-blue-600 hover:text-blue-700"
                                                                    onClick={() => window.open(mlLink, '_blank')}
                                                                >
                                                                    <ExternalLink className="h-3 w-3 mr-1" />
                                                                    Abrir
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-8 text-xs text-purple-600 hover:text-purple-700"
                                                                    onClick={() => navigate(`/mercado-livre-analyzer?mlb=${product.id}`)}
                                                                >
                                                                    <Target className="h-3 w-3 mr-1" />
                                                                    Analisar
                                                                </Button>
                                                                <DialogTrigger asChild>
                                                                    <Button variant="outline" size="sm" className="h-8 text-xs">
                                                                        <Info className="h-3 w-3 mr-1" />
                                                                        Detalhes
                                                                    </Button>
                                                                </DialogTrigger>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>

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
                                                                        <div className="text-muted-foreground text-xs">Preço</div>
                                                                        <div className="font-medium">{formatCurrency(product.price)}</div>
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <div className="text-muted-foreground text-xs">Status</div>
                                                                        <div>{getStatusBadge(product.status)}</div>
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
                                                                        <div className="text-muted-foreground text-xs">Tipo de anúncio</div>
                                                                        <div className="font-medium">{getListingTypeLabel(product.listing_type_id)}</div>
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <div className="text-muted-foreground text-xs">Categoria</div>
                                                                        <div className="font-medium">{product.category || "-"}</div>
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
                                    </TableBody>
                                </Table>
                            </div>
                            <ScrollBar orientation="horizontal" />
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
        </div>
    );
}
