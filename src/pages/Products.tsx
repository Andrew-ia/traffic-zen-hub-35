import { useState } from "react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useMercadoLivreProducts } from "@/hooks/useMercadoLivre";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Package, Search, ExternalLink, Copy, TrendingUp, Eye, DollarSign, BarChart3, Info, Truck, ShoppingBag } from "lucide-react";
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

export default function Products() {
    const { currentWorkspace } = useWorkspace();
    const workspaceId = currentWorkspace?.id || null;
    const { toast } = useToast();

    const [search, setSearch] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(20);
    const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

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
                        Todos os anúncios do Mercado Livre sincronizados
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
                                setCurrentPage(1); // Reset to first page on search
                            }}
                            className="pl-10"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Products Table */}
            <Card>
                <CardHeader className="border-b">
                    <div className="flex items-center justify-between">
                        <CardTitle>Lista de Produtos</CardTitle>
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
                                        <TableRow>
                                            <TableHead className="w-[50px]">Imagem</TableHead>
                                            <TableHead className="min-w-[250px]">Produto</TableHead>
                                            <TableHead>MLB ID</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Tipo Anúncio</TableHead>
                                            <TableHead>Envio</TableHead>
                                            <TableHead className="text-right">Preço</TableHead>
                                            <TableHead className="text-right">Estoque</TableHead>
                                            <TableHead className="text-right">Vendas</TableHead>
                                            <TableHead className="text-right">Visitas</TableHead>
                                            <TableHead className="text-right">Taxa Conv.</TableHead>
                                            <TableHead className="text-right">Receita</TableHead>
                                            <TableHead className="text-center">Categoria</TableHead>
                                            <TableHead className="text-center">Ações</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {paginatedProducts.map((product: any) => (
                                            <TableRow key={product.id}>
                                                <TableCell>
                                                    {product.thumbnail && (
                                                        <img
                                                            src={product.thumbnail}
                                                            alt={product.title}
                                                            className="h-12 w-12 rounded object-cover"
                                                        />
                                                    )}
                                                </TableCell>
                                                <TableCell className="font-medium">
                                                    <div className="max-w-md truncate" title={product.title}>
                                                        {product.title}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <code className="px-2 py-1 bg-muted rounded text-xs font-mono">
                                                            {product.id}
                                                        </code>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-6 w-6 p-0"
                                                            onClick={async () => {
                                                                try {
                                                                    await navigator.clipboard.writeText(product.id);
                                                                    toast({ title: "Copiado!", description: "MLB ID copiado" });
                                                                } catch (e) {
                                                                    toast({ title: "Erro ao copiar", variant: "destructive" });
                                                                }
                                                            }}
                                                            title="Copiar MLB ID"
                                                        >
                                                            <Copy className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                                <TableCell>{getStatusBadge(product.status)}</TableCell>
                                                <TableCell>
                                                    <Badge variant={product.listing_type_id === 'gold_special' || product.listing_type_id === 'gold_pro' ? 'default' : 'secondary'}>
                                                        {product.listing_type_id === 'gold_special' ? 'Premium' :
                                                         product.listing_type_id === 'gold_pro' ? 'Clássico' :
                                                         product.listing_type_id === 'free' ? 'Grátis' :
                                                         product.listing_type_id || 'N/A'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-1">
                                                            <Truck className="h-3 w-3" />
                                                            <Badge variant={product.isFull ? 'default' : 'outline'}>
                                                                {product.isFull ? 'Full' : 'Normal'}
                                                            </Badge>
                                                        </div>
                                                        {product.shipping?.free_shipping && (
                                                            <Badge variant="secondary" className="text-xs">Frete Grátis</Badge>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">{formatCurrency(product.price)}</TableCell>
                                                <TableCell className="text-right">
                                                    <Badge variant="outline">{formatNumber(product.stock || 0)}</Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <TrendingUp className="h-3 w-3 text-green-600" />
                                                        {formatNumber(product.sales || 0)}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Eye className="h-3 w-3 text-blue-600" />
                                                        {formatNumber(product.visits || 0)}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <BarChart3 className="h-3 w-3 text-purple-600" />
                                                        {product.conversionRate ? `${product.conversionRate.toFixed(2)}%` : '0%'}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <DollarSign className="h-3 w-3 text-emerald-600" />
                                                        {formatCurrency(product.revenue || 0)}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant="secondary" className="text-xs">
                                                        {product.category || 'N/A'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 px-2"
                                                            onClick={() => {
                                                                setSelectedProduct(product);
                                                                setIsDetailsOpen(true);
                                                            }}
                                                            title="Ver Detalhes Completos"
                                                        >
                                                            <Info className="h-3 w-3" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 px-2"
                                                            onClick={() => {
                                                                window.open(`https://www.mercadolivre.com.br/p/${product.id}`, '_blank');
                                                            }}
                                                            title="Ver no Mercado Livre"
                                                        >
                                                            <ExternalLink className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between p-4 border-t">
                                    <div className="text-sm text-muted-foreground">
                                        Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, totalProducts)} de {totalProducts} produtos
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                            disabled={currentPage === 1}
                                        >
                                            Anterior
                                        </Button>

                                        <div className="flex items-center gap-1">
                                            {Array.from({ length: totalPages }, (_, i) => i + 1)
                                                .filter(page => {
                                                    return (
                                                        page === 1 ||
                                                        page === totalPages ||
                                                        (page >= currentPage - 1 && page <= currentPage + 1)
                                                    );
                                                })
                                                .map((page, index, array) => (
                                                    <div key={page} className="flex items-center">
                                                        {index > 0 && array[index - 1] !== page - 1 && (
                                                            <span className="px-2 text-muted-foreground">...</span>
                                                        )}
                                                        <Button
                                                            variant={currentPage === page ? "default" : "outline"}
                                                            size="sm"
                                                            onClick={() => setCurrentPage(page)}
                                                            className="min-w-[2.5rem]"
                                                        >
                                                            {page}
                                                        </Button>
                                                    </div>
                                                ))
                                            }
                                        </div>

                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                            disabled={currentPage === totalPages}
                                        >
                                            Próximo
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Modal de Detalhes Completos */}
            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Package className="h-5 w-5" />
                            Detalhes Completos do Produto
                        </DialogTitle>
                        <DialogDescription>
                            Todas as informações coletadas da API do Mercado Livre
                        </DialogDescription>
                    </DialogHeader>

                    {selectedProduct && (
                        <div className="space-y-6">
                            {/* Informações Básicas */}
                            <div>
                                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                                    <ShoppingBag className="h-4 w-4" />
                                    Informações Básicas
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Título</p>
                                        <p className="font-medium">{selectedProduct.title}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">MLB ID</p>
                                        <code className="px-2 py-1 bg-muted rounded text-sm font-mono">
                                            {selectedProduct.id}
                                        </code>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Status</p>
                                        <div className="mt-1">{getStatusBadge(selectedProduct.status)}</div>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Categoria</p>
                                        <Badge variant="secondary">{selectedProduct.category || 'N/A'}</Badge>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Tipo de Anúncio</p>
                                        <Badge>{selectedProduct.listing_type_id || 'N/A'}</Badge>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Condição</p>
                                        <Badge variant="outline">
                                            {selectedProduct.condition === 'new' ? 'Novo' : 'Usado'}
                                        </Badge>
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            {/* Preço e Estoque */}
                            <div>
                                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                                    <DollarSign className="h-4 w-4" />
                                    Preço e Estoque
                                </h3>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Preço</p>
                                        <p className="text-2xl font-bold text-green-600">
                                            {formatCurrency(selectedProduct.price)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Estoque Disponível</p>
                                        <p className="text-2xl font-bold">{formatNumber(selectedProduct.stock || 0)}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Quantidade Vendida</p>
                                        <p className="text-2xl font-bold">{formatNumber(selectedProduct.sales || 0)}</p>
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            {/* Envio */}
                            <div>
                                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                                    <Truck className="h-4 w-4" />
                                    Informações de Envio
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Modo de Envio</p>
                                        <Badge variant={selectedProduct.isFull ? 'default' : 'outline'}>
                                            {selectedProduct.isFull ? 'Mercado Envios Full' : 'Mercado Envios Normal'}
                                        </Badge>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Frete Grátis</p>
                                        <Badge variant={selectedProduct.shipping?.free_shipping ? 'default' : 'secondary'}>
                                            {selectedProduct.shipping?.free_shipping ? 'Sim' : 'Não'}
                                        </Badge>
                                    </div>
                                    {selectedProduct.shipping?.logistic_type && (
                                        <div>
                                            <p className="text-sm text-muted-foreground">Tipo Logístico</p>
                                            <p className="font-medium">{selectedProduct.shipping.logistic_type}</p>
                                        </div>
                                    )}
                                    {selectedProduct.shipping?.tags && selectedProduct.shipping.tags.length > 0 && (
                                        <div className="col-span-2">
                                            <p className="text-sm text-muted-foreground">Tags de Envio</p>
                                            <div className="flex gap-1 flex-wrap mt-1">
                                                {selectedProduct.shipping.tags.map((tag: string, idx: number) => (
                                                    <Badge key={idx} variant="outline" className="text-xs">{tag}</Badge>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <Separator />

                            {/* Métricas de Performance */}
                            <div>
                                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                                    <BarChart3 className="h-4 w-4" />
                                    Métricas de Performance
                                </h3>
                                <div className="grid grid-cols-4 gap-4">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Vendas</p>
                                        <p className="text-xl font-bold text-green-600">{formatNumber(selectedProduct.sales || 0)}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Visitas</p>
                                        <p className="text-xl font-bold text-blue-600">{formatNumber(selectedProduct.visits || 0)}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Taxa de Conversão</p>
                                        <p className="text-xl font-bold text-purple-600">
                                            {selectedProduct.conversionRate ? `${selectedProduct.conversionRate.toFixed(2)}%` : '0%'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Receita Total</p>
                                        <p className="text-xl font-bold text-emerald-600">
                                            {formatCurrency(selectedProduct.revenue || 0)}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Atributos/Características */}
                            {selectedProduct.attributes && selectedProduct.attributes.length > 0 && (
                                <>
                                    <Separator />
                                    <div>
                                        <h3 className="font-semibold text-lg mb-3">Características do Produto</h3>
                                        <div className="grid grid-cols-2 gap-3">
                                            {selectedProduct.attributes.map((attr: any, idx: number) => (
                                                <div key={idx} className="border rounded p-3">
                                                    <p className="text-sm text-muted-foreground">{attr.name}</p>
                                                    <p className="font-medium">
                                                        {attr.value_name || attr.value_struct?.number || attr.value_struct?.unit || 'N/A'}
                                                        {attr.value_struct?.unit && ` ${attr.value_struct.unit}`}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Dimensões e Peso */}
                            {(selectedProduct.dimensions || selectedProduct.weight) && (
                                <>
                                    <Separator />
                                    <div>
                                        <h3 className="font-semibold text-lg mb-3">Dimensões e Peso</h3>
                                        <div className="grid grid-cols-4 gap-4">
                                            {selectedProduct.dimensions?.width && (
                                                <div>
                                                    <p className="text-sm text-muted-foreground">Largura</p>
                                                    <p className="font-medium">{selectedProduct.dimensions.width} cm</p>
                                                </div>
                                            )}
                                            {selectedProduct.dimensions?.height && (
                                                <div>
                                                    <p className="text-sm text-muted-foreground">Altura</p>
                                                    <p className="font-medium">{selectedProduct.dimensions.height} cm</p>
                                                </div>
                                            )}
                                            {selectedProduct.dimensions?.length && (
                                                <div>
                                                    <p className="text-sm text-muted-foreground">Comprimento</p>
                                                    <p className="font-medium">{selectedProduct.dimensions.length} cm</p>
                                                </div>
                                            )}
                                            {selectedProduct.weight && (
                                                <div>
                                                    <p className="text-sm text-muted-foreground">Peso</p>
                                                    <p className="font-medium">{selectedProduct.weight} g</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Imagens */}
                            {selectedProduct.pictures && selectedProduct.pictures.length > 0 && (
                                <>
                                    <Separator />
                                    <div>
                                        <h3 className="font-semibold text-lg mb-3">Imagens do Produto</h3>
                                        <div className="grid grid-cols-4 gap-2">
                                            {selectedProduct.pictures.map((pic: any, idx: number) => (
                                                <img
                                                    key={idx}
                                                    src={pic.url || pic.secure_url}
                                                    alt={`Produto ${idx + 1}`}
                                                    className="w-full h-32 object-cover rounded border"
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Link do Mercado Livre */}
                            <div className="flex justify-end gap-2 pt-4">
                                <Button
                                    variant="outline"
                                    onClick={() => setIsDetailsOpen(false)}
                                >
                                    Fechar
                                </Button>
                                <Button
                                    onClick={() => {
                                        window.open(`https://www.mercadolivre.com.br/p/${selectedProduct.id}`, '_blank');
                                    }}
                                >
                                    <ExternalLink className="h-4 w-4 mr-2" />
                                    Ver no Mercado Livre
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
