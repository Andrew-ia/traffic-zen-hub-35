import { useState } from "react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useMercadoLivreProducts } from "@/hooks/useMercadoLivre";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    AlertCircle,
    Truck,
    Box,
    Copy,
    Eye,
    Info,
    DownloadCloud
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Products() {
    const { currentWorkspace } = useWorkspace();
    const fallbackWorkspaceId = (import.meta.env.VITE_WORKSPACE_ID as string | undefined)?.trim() || null;
    const workspaceId = currentWorkspace?.id || fallbackWorkspaceId;
    const { toast } = useToast();

    const [search, setSearch] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(20);

    const {
        data: productsData,
        isLoading,
        error
    } = useMercadoLivreProducts(workspaceId, "all");

    const filteredProducts = productsData?.items?.filter((product: any) =>
        product.title?.toLowerCase().includes(search.toLowerCase()) ||
        product.id?.toLowerCase().includes(search.toLowerCase())
    ) || [];

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

    const handleDownloadPdf = (productId: string) => {
        if (!workspaceId) {
            toast({ title: "Workspace não selecionado", description: "Selecione um workspace para exportar", variant: "destructive" });
            return;
        }
        const url = `/api/integrations/mercadolivre/products/${productId}/pdf?workspaceId=${workspaceId}`;
        window.open(url, "_blank");
    };

    const handleDownloadXlsx = () => {
        if (!workspaceId) {
            toast({ title: "Workspace não selecionado", description: "Selecione um workspace para exportar", variant: "destructive" });
            return;
        }
        const url = `/api/integrations/mercadolivre/products/export/xlsx?workspaceId=${workspaceId}`;
        window.open(url, "_blank");
    };

    if (!workspaceId) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
                <Package className="h-16 w-16 text-muted-foreground/50" />
                <h1 className="text-2xl font-bold">Selecione um Workspace</h1>
                <p className="text-muted-foreground">Para visualizar seus produtos, selecione um workspace no menu.</p>
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
                        Produtos Mercado Livre
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Todos os anúncios sincronizados do Mercado Livre
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="bg-primary/10 text-primary px-4 py-2 rounded-lg font-medium text-sm border border-primary/20">
                        {totalProducts} produtos encontrados
                    </div>
                    <Button variant="outline" size="sm" className="gap-2" onClick={handleDownloadXlsx}>
                        <DownloadCloud className="h-4 w-4" />
                        Exportar XLSX
                    </Button>
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
                    <div className="flex items-center gap-4">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por título ou MLB ID..."
                                value={search}
                                onChange={(e) => {
                                    setSearch(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="pl-10"
                            />
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
                                            <TableHead className="w-[300px]">Produto / ID</TableHead>
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

                                                        {/* Produto / ID */}
                                                        <TableCell className="align-middle">
                                                            <div className="space-y-1">
                                                                <div className="font-medium text-sm line-clamp-2" title={product.title}>
                                                                    {product.title}
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono text-muted-foreground">
                                                                        {product.id}
                                                                    </code>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-4 w-4"
                                                                        onClick={() => copyToClipboard(product.id, "ID")}
                                                                        title="Copiar ID"
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
                                                                        <Badge variant="outline" className="font-mono">MLB {product.id}</Badge>
                                                                        {product.sku && <Badge variant="secondary">SKU: {product.sku}</Badge>}
                                                                        {getStatusBadge(product.status)}
                                                                    </DialogDescription>
                                                                </div>
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
