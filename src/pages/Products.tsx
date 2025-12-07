import { useState } from "react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useMercadoLivreProducts } from "@/hooks/useMercadoLivre";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Package, Search, ExternalLink, Copy, TrendingUp, Eye, DollarSign, BarChart3, Truck, ShoppingBag, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function Products() {
    const { currentWorkspace } = useWorkspace();
    const workspaceId = currentWorkspace?.id || null;
    const { toast } = useToast();

    const [search, setSearch] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(20);

    const {
        data: productsData,
        isLoading,
        refetch
    } = useMercadoLivreProducts(workspaceId, "all");

    if (!workspaceId) {
        return (
            <div className="space-y-4">
                <h1 className="text-4xl font-bold">Produtos</h1>
                <p className="text-muted-foreground">Selecione um workspace para ver os produtos</p>
            </div>
        );
    }

    // Filtrar produtos pela busca
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

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
        }).format(value || 0);
    };

    const formatNumber = (value: number) => {
        return new Intl.NumberFormat("pt-BR").format(value || 0);
    };

    const getStatusBadge = (status: string) => {
        const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
            active: { label: "Ativo", variant: "default" },
            paused: { label: "Pausado", variant: "secondary" },
            closed: { label: "Fechado", variant: "destructive" },
        };

        const statusInfo = statusMap[status] || { label: status, variant: "outline" as const };
        return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
    };

    return (
        <div className="space-y-6 pb-4">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                    <h1 className="text-4xl sm:text-5xl font-bold tracking-tight flex items-center gap-3">
                        <Package className="h-10 w-10 text-primary" />
                        Produtos Mercado Livre
                    </h1>
                    <p className="text-sm sm:text-base text-muted-foreground">
                        Todos os anúncios do Mercado Livre sincronizados - Visualização Completa
                    </p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total de Produtos</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatNumber(productsData?.totalCount || 0)}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                            {formatNumber(productsData?.counts?.active || 0)} ativos
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Full / Normal</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-baseline gap-2">
                            <div className="text-2xl font-bold text-blue-600">{formatNumber(productsData?.counts?.full || 0)}</div>
                            <span className="text-muted-foreground">/</span>
                            <div className="text-2xl font-bold text-orange-600">{formatNumber(productsData?.counts?.normal || 0)}</div>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                            produtos
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Estoque Full / Normal</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-baseline gap-2">
                            <div className="text-2xl font-bold text-blue-600">{formatNumber(productsData?.stock?.full || 0)}</div>
                            <span className="text-muted-foreground">/</span>
                            <div className="text-2xl font-bold text-orange-600">{formatNumber(productsData?.stock?.normal || 0)}</div>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                            {formatNumber(productsData?.stock?.total || 0)} total
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Receita Estimada</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatCurrency((productsData?.items || []).reduce((sum: number, p: any) => sum + (p.revenue || 0), 0))}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                            {formatNumber((productsData?.items || []).reduce((sum: number, p: any) => sum + (p.sales || 0), 0))} unidades vendidas (histórico)
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Search */}
            <Card>
                <CardContent className="p-4">
                    <div className="relative">
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
                </CardContent>
            </Card>

            {/* Products Table - EXPANDIDA COM TODAS AS INFORMAÇÕES */}
            <Card>
                <CardHeader className="border-b">
                    <div className="flex items-center justify-between">
                        <CardTitle>Lista Completa de Produtos</CardTitle>
                        <p className="text-sm text-muted-foreground">
                            {totalProducts} {totalProducts === 1 ? 'produto encontrado' : 'produtos encontrados'}
                        </p>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="p-6 space-y-3">
                            {[...Array(10)].map((_, i) => (
                                <Skeleton key={i} className="h-16 w-full" />
                            ))}
                        </div>
                    ) : totalProducts === 0 ? (
                        <div className="text-center py-12">
                            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                            <p className="text-muted-foreground">
                                {search ? 'Nenhum produto encontrado com esse critério' : 'Nenhum produto encontrado'}
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead className="w-[60px]">Img</TableHead>
                                            <TableHead className="min-w-[300px]">Produto / MLB ID</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Condição</TableHead>
                                            <TableHead>Categoria</TableHead>
                                            <TableHead>Tipo Anúncio</TableHead>
                                            <TableHead>Envio</TableHead>
                                            <TableHead>Frete</TableHead>
                                            <TableHead className="text-right">Preço</TableHead>
                                            <TableHead className="text-right">Estoque</TableHead>
                                            <TableHead className="text-right">Vendas</TableHead>
                                            <TableHead className="text-right">Visitas</TableHead>
                                            <TableHead className="text-right">Conv. %</TableHead>
                                            <TableHead className="text-right">Receita</TableHead>
                                            <TableHead>Garantia</TableHead>
                                            <TableHead>Dimensões (LxAxC)</TableHead>
                                            <TableHead>Peso</TableHead>
                                            <TableHead className="text-center">Ações</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {paginatedProducts.map((product: any) => (
                                            <TableRow key={product.id} className="hover:bg-muted/50">
                                                {/* Imagem */}
                                                <TableCell>
                                                    {product.thumbnail && (
                                                        <img
                                                            src={product.thumbnail}
                                                            alt={product.title}
                                                            className="h-14 w-14 rounded object-cover border"
                                                        />
                                                    )}
                                                </TableCell>

                                                {/* Produto / MLB ID */}
                                                <TableCell>
                                                    <div className="space-y-1">
                                                        <div className="font-medium text-sm max-w-md truncate" title={product.title}>
                                                            {product.title}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <code className="px-2 py-0.5 bg-muted rounded text-xs font-mono">
                                                                {product.id}
                                                            </code>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-5 w-5 p-0"
                                                                onClick={async () => {
                                                                    try {
                                                                        await navigator.clipboard.writeText(product.id);
                                                                        toast({ title: "Copiado!", description: "MLB ID copiado" });
                                                                    } catch (e) {
                                                                        toast({ title: "Erro ao copiar", variant: "destructive" });
                                                                    }
                                                                }}
                                                            >
                                                                <Copy className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </TableCell>

                                                {/* Status */}
                                                <TableCell>{getStatusBadge(product.status)}</TableCell>

                                                {/* Condição */}
                                                <TableCell>
                                                    <Badge variant="outline" className="text-xs">
                                                        {product.condition === 'new' ? 'Novo' : 'Usado'}
                                                    </Badge>
                                                </TableCell>

                                                {/* Categoria */}
                                                <TableCell>
                                                    <Badge variant="secondary" className="text-xs max-w-[150px] truncate">
                                                        {product.category || 'N/A'}
                                                    </Badge>
                                                </TableCell>

                                                {/* Tipo Anúncio */}
                                                <TableCell>
                                                    <Badge variant={product.listing_type_id === 'gold_special' || product.listing_type_id === 'gold_pro' ? 'default' : 'secondary'} className="text-xs">
                                                        {product.listing_type_id === 'gold_special' ? 'Premium' :
                                                         product.listing_type_id === 'gold_pro' ? 'Clássico' :
                                                         product.listing_type_id === 'free' ? 'Grátis' :
                                                         product.listing_type_id || 'N/A'}
                                                    </Badge>
                                                </TableCell>

                                                {/* Envio */}
                                                <TableCell>
                                                    <Badge variant={product.isFull ? 'default' : 'outline'} className="text-xs flex items-center gap-1 w-fit">
                                                        <Truck className="h-3 w-3" />
                                                        {product.isFull ? 'Full' : 'Normal'}
                                                    </Badge>
                                                </TableCell>

                                                {/* Frete */}
                                                <TableCell>
                                                    {product.shipping?.free_shipping ? (
                                                        <Badge variant="default" className="text-xs bg-green-600">Grátis</Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-xs">Pago</Badge>
                                                    )}
                                                </TableCell>

                                                {/* Preço */}
                                                <TableCell className="text-right font-semibold">{formatCurrency(product.price)}</TableCell>

                                                {/* Estoque */}
                                                <TableCell className="text-right">
                                                    <Badge variant={product.stock > 10 ? 'default' : product.stock > 0 ? 'secondary' : 'destructive'}>
                                                        {formatNumber(product.stock || 0)}
                                                    </Badge>
                                                </TableCell>

                                                {/* Vendas */}
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-1 text-green-600 font-semibold">
                                                        <TrendingUp className="h-3 w-3" />
                                                        {formatNumber(product.sales || 0)}
                                                    </div>
                                                </TableCell>

                                                {/* Visitas */}
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-1 text-blue-600">
                                                        <Eye className="h-3 w-3" />
                                                        {formatNumber(product.visits || 0)}
                                                    </div>
                                                </TableCell>

                                                {/* Taxa de Conversão */}
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-1 text-purple-600 font-medium">
                                                        <BarChart3 className="h-3 w-3" />
                                                        {product.conversionRate ? `${product.conversionRate.toFixed(2)}%` : '0%'}
                                                    </div>
                                                </TableCell>

                                                {/* Receita */}
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-1 text-emerald-600 font-semibold">
                                                        <DollarSign className="h-3 w-3" />
                                                        {formatCurrency(product.revenue || 0)}
                                                    </div>
                                                </TableCell>

                                                {/* Garantia */}
                                                <TableCell>
                                                    {product.warranty ? (
                                                        <div className="flex items-center gap-1 text-xs text-green-600">
                                                            <CheckCircle2 className="h-3 w-3" />
                                                            <span>{product.warranty}</span>
                                                        </div>
                                                    ) : (
                                                        <Badge variant="outline" className="text-xs">Sem garantia</Badge>
                                                    )}
                                                </TableCell>

                                                {/* Dimensões */}
                                                <TableCell>
                                                    {product.dimensions ? (
                                                        <div className="text-xs font-mono">
                                                            {product.dimensions.width || 0} x {product.dimensions.height || 0} x {product.dimensions.length || 0} cm
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">-</span>
                                                    )}
                                                </TableCell>

                                                {/* Peso */}
                                                <TableCell>
                                                    {product.weight ? (
                                                        <div className="text-xs font-mono">{product.weight} g</div>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">-</span>
                                                    )}
                                                </TableCell>

                                                {/* Ações */}
                                                <TableCell className="text-center">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 px-3 text-xs"
                                                        onClick={() => {
                                                            window.open(`https://produto.mercadolivre.com.br/${product.id}`, '_blank');
                                                        }}
                                                    >
                                                        <ExternalLink className="h-3 w-3 mr-1" />
                                                        Ver no ML
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between border-t p-4">
                                    <div className="text-sm text-muted-foreground">
                                        Página {currentPage} de {totalPages} ({totalProducts} produtos)
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                        >
                                            Anterior
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages}
                                        >
                                            Próxima
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
