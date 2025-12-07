import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useCatalogIntelligence, ProductCatalogData } from "@/hooks/useCatalogIntelligence";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Trophy,
    TrendingUp,
    TrendingDown,
    Eye,
    ShoppingCart,
    Target,
    Crown,
    Zap,
    AlertCircle,
    RefreshCcw,
    ExternalLink,
    WifiOff,
    X
} from "lucide-react";


export default function CatalogIntelligence() {
    const { currentWorkspace } = useWorkspace();
    const navigate = useNavigate();
    const {
        data: catalogData,
        isLoading,
        error,
        lastAnalyzedAt,
        refreshData,
        clearError
    } = useCatalogIntelligence();
    
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [sortBy, setSortBy] = useState<string>("sales_desc");

    // Usar dados reais da API
    const products = catalogData?.products || [];
    const categoryAnalysis = catalogData?.category_analysis;

    const filteredProducts = products.filter(product => {
        const matchesSearch = product.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            product.mlb_id.includes(searchTerm);
        const matchesStatus = statusFilter === "all" || product.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const sortedProducts = useMemo(() => {
        const base = [...filteredProducts];
        base.sort((a, b) => {
            switch (sortBy) {
                case 'sales_desc':
                    return b.sales_120_days - a.sales_120_days;
                case 'sales_asc':
                    return a.sales_120_days - b.sales_120_days;
                case 'conversion_desc':
                    return b.conversion_rate - a.conversion_rate;
                case 'position_asc':
                    return a.catalog_position - b.catalog_position;
                case 'opportunity':
                    return Number(b.can_win_with_boosters && !b.is_catalog_winner) - Number(a.can_win_with_boosters && !a.is_catalog_winner)
                        || a.catalog_position - b.catalog_position;
                default:
                    return 0;
            }
        });
        return base;
    }, [filteredProducts, sortBy]);

    const handleViewAnalysis = (mlbId: string) => {
        navigate(`/mercado-livre-analyzer?mlb=${mlbId}`);
    };

    const handleOpenListing = (product: ProductCatalogData) => {
        const url = product.permalink || `https://produto.mercadolivre.com.br/${product.mlb_id}`;
        window.open(url, '_blank');
    };

    const handleOpenWinner = (product: ProductCatalogData) => {
        const winnerLink = product.winner_snapshot?.permalink || (product.winner_snapshot ? `https://produto.mercadolivre.com.br/${product.winner_snapshot.id}` : null);
        if (winnerLink) {
            window.open(winnerLink, '_blank');
        }
    };

    const getStatusBadge = (status: string, isWinner: boolean) => {
        if (isWinner) {
            return <Badge variant="default" className="bg-gray-500"><Crown className="w-3 h-3 mr-1" />Vencedor</Badge>;
        }
        
        switch (status) {
            case 'winning':
                return <Badge variant="default" className="bg-green-500"><TrendingUp className="w-3 h-3 mr-1" />Ganhando</Badge>;
            case 'losing':
                return <Badge variant="destructive"><TrendingDown className="w-3 h-3 mr-1" />Perdendo</Badge>;
            case 'competitive':
                return <Badge variant="outline"><Target className="w-3 h-3 mr-1" />Competitivo</Badge>;
            default:
                return <Badge variant="secondary">-</Badge>;
        }
    };

    const getBoosterIcons = (boosters: ProductCatalogData['boosters']) => {
        return (
            <div className="flex gap-1">
                {boosters.is_full && (
                    <Badge variant="outline" className="text-xs px-1 py-0 bg-blue-50 text-blue-700 border-blue-200">
                        FULL
                    </Badge>
                )}
                {boosters.free_shipping && (
                    <Badge variant="outline" className="text-xs px-1 py-0 bg-green-50 text-green-700 border-green-200">
                        Frete Grátis
                    </Badge>
                )}
                {boosters.has_pickup && (
                    <Badge variant="outline" className="text-xs px-1 py-0 bg-purple-50 text-purple-700 border-purple-200">
                        Coleta
                    </Badge>
                )}
                {boosters.installments_no_interest && (
                    <Badge variant="outline" className="text-xs px-1 py-0 bg-yellow-50 text-yellow-700 border-yellow-200">
                        S/ Juros
                    </Badge>
                )}
                <Badge variant="outline" className={`text-xs px-1 py-0 ${
                    boosters.account_medal === 'gold' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                    boosters.account_medal === 'silver' ? 'bg-gray-50 text-gray-700 border-gray-200' :
                    'bg-orange-50 text-orange-700 border-orange-200'
                }`}>
                    {boosters.account_medal.toUpperCase()}
                </Badge>
            </div>
        );
    };

    if (!currentWorkspace) {
        return (
            <div className="space-y-4">
                <h1 className="text-4xl font-bold tracking-tight">Inteligência de Catálogo</h1>
                <p className="text-muted-foreground">Selecione um workspace para visualizar a inteligência de catálogo.</p>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="space-y-6 pb-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-1">
                        <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
                            <Trophy className="h-10 w-10 text-yellow-500" />
                            Inteligência de Catálogo
                        </h1>
                        <p className="text-muted-foreground">
                            Analise o desempenho dos seus produtos e identifique oportunidades no catálogo do MercadoLivre
                        </p>
                    </div>
                </div>

                {/* Error Display */}
                <Card className="border-red-200 bg-red-50">
                    <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0">
                                <WifiOff className="h-8 w-8 text-red-500" />
                            </div>
                            <div className="flex-1 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-semibold text-red-700">
                                        {error.error}
                                    </h3>
                                    <Button 
                                        variant="ghost" 
                                        size="sm"
                                        onClick={clearError}
                                        className="text-red-500 hover:text-red-700"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                                <p className="text-red-600">
                                    {error.details}
                                </p>
                                {error.suggestions && error.suggestions.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-sm font-medium text-red-700">Sugestões:</p>
                                        <ul className="space-y-1">
                                            {error.suggestions.map((suggestion, index) => (
                                                <li key={index} className="text-sm text-red-600 flex items-start gap-2">
                                                    <span className="text-red-400 mt-1">•</span>
                                                    <span>{suggestion}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                <div className="flex gap-3 pt-2">
                                    <Button 
                                        variant="outline" 
                                        onClick={() => window.location.href = '/integrations'}
                                        className="border-red-300 text-red-700 hover:bg-red-100"
                                    >
                                        Verificar Integrações
                                    </Button>
                                    <Button 
                                        onClick={refreshData}
                                        disabled={isLoading}
                                        className="bg-red-600 hover:bg-red-700 text-white"
                                    >
                                        <RefreshCcw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                                        Tentar Novamente
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-4">
            {/* Header */}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                    <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
                        <Trophy className="h-10 w-10 text-yellow-500" />
                        Inteligência de Catálogo
                    </h1>
                    <p className="text-muted-foreground">
                        Analise o desempenho dos seus produtos e identifique oportunidades no catálogo do MercadoLivre
                    </p>
                </div>
                
                <div className="flex items-center gap-3">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={refreshData}
                        disabled={isLoading}
                    >
                        <RefreshCcw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                        {isLoading ? 'Atualizando...' : 'Atualizar Dados'}
                    </Button>
                    {lastAnalyzedAt && (
                        <span className="text-sm text-muted-foreground">
                            Última análise: {new Date(lastAnalyzedAt).toLocaleString('pt-BR')}
                        </span>
                    )}
                </div>
            </div>

            {/* KPIs Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-medium">Produtos Vencedores</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <span className="text-2xl font-bold text-green-600">
                                {categoryAnalysis?.winners_count || 0}
                            </span>
                            <Crown className="h-5 w-5 text-yellow-500" />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            de {categoryAnalysis?.total_products || 0} produtos
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-medium">Oportunidades</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <span className="text-2xl font-bold text-blue-600">
                                {categoryAnalysis?.opportunities_count || 0}
                            </span>
                            <Zap className="h-5 w-5 text-blue-500" />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            podem vencer com ajustes
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-medium">Vendas (120d)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <span className="text-2xl font-bold">
                                {categoryAnalysis?.avg_sales_120d || 0}
                            </span>
                            <ShoppingCart className="h-5 w-5 text-green-500" />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            vendas médias (120d)
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-medium">Taxa de Conversão</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <span className="text-2xl font-bold">
                                {(categoryAnalysis?.avg_conversion_rate || 0).toFixed(1)}%
                            </span>
                            <Target className="h-5 w-5 text-purple-500" />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            média geral
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Filtros */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Filtros e Busca</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1">
                            <Input
                                placeholder="Buscar por título ou MLB ID..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="max-w-sm"
                            />
                        </div>
                        
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-48">
                                <SelectValue placeholder="Status no catálogo" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos os status</SelectItem>
                                <SelectItem value="winning">Vencedores</SelectItem>
                                <SelectItem value="losing">Perdendo</SelectItem>
                                <SelectItem value="competitive">Competitivos</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={sortBy} onValueChange={setSortBy}>
                            <SelectTrigger className="w-48">
                                <SelectValue placeholder="Ordenar por" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="sales_desc">Vendas (maior)</SelectItem>
                                <SelectItem value="sales_asc">Vendas (menor)</SelectItem>
                                <SelectItem value="conversion_desc">Conversão (maior)</SelectItem>
                                <SelectItem value="position_asc">Posição (melhor)</SelectItem>
                                <SelectItem value="opportunity">Oportunidades</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Tabela de Produtos */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Eye className="h-5 w-5" />
                        Visão por Produto
                    </CardTitle>
                    <CardDescription>
                        Análise detalhada de cada produto no catálogo
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="space-y-4">
                            {[...Array(5)].map((_, i) => (
                                <Skeleton key={i} className="h-16 w-full" />
                            ))}
                        </div>
                    ) : sortedProducts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <AlertCircle className="h-16 w-16 text-gray-400 mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 mb-2">
                                {products.length === 0 ? 'Nenhum produto encontrado' : 'Nenhum produto corresponde aos filtros'}
                            </h3>
                            <p className="text-gray-500 mb-6 max-w-md">
                                {products.length === 0 
                                    ? 'Conecte sua conta do MercadoLivre e sincronize seus produtos para ver a análise de catálogo.'
                                    : 'Tente ajustar os filtros ou usar termos de busca diferentes.'
                                }
                            </p>
                            {products.length === 0 && (
                                <Button 
                                    onClick={() => window.location.href = '/integrations'}
                                    className="bg-blue-600 hover:bg-blue-700 text-white"
                                >
                                    Configurar Integração
                                </Button>
                            )}
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Produto</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Posição</TableHead>
                                    <TableHead>Preços</TableHead>
                                    <TableHead>Performance</TableHead>
                                    <TableHead>Impulsionadores</TableHead>
                                    <TableHead>Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedProducts.map((product) => (
                                    <TableRow key={product.mlb_id}>
                                        {/* Produto */}
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <img
                                                    src={product.thumbnail}
                                                    alt={product.title}
                                                    className="h-12 w-12 object-cover rounded"
                                                    onError={(e) => { e.currentTarget.src = '/placeholder-product.jpg' }}
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-medium line-clamp-2 text-sm">
                                                        {product.title}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {product.mlb_id}
                                                    </p>
                                                </div>
                                            </div>
                                        </TableCell>

                                        {/* Status */}
                                        <TableCell>
                                            {getStatusBadge(product.status, product.is_catalog_winner)}
                                        </TableCell>

                                        {/* Posição */}
                                        <TableCell>
                                            <div className="text-center">
                                                <span className="text-xl font-bold">
                                                    #{product.catalog_position}
                                                </span>
                                                <p className="text-xs text-muted-foreground">
                                                    {product.category_name}
                                                </p>
                                            </div>
                                        </TableCell>

                                        {/* Preços */}
                                        <TableCell>
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium">
                                                        R$ {product.current_price.toFixed(2)}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        (seu)
                                                    </span>
                                                </div>
                                                {!product.is_catalog_winner && (
                                                    <div className="space-y-1">
                                                        <div className="text-xs text-orange-600">
                                                            Vencedor: R$ {product.winner_price.toFixed(2)}
                                                        </div>
                                                        {product.can_win_with_boosters ? (
                                                            <div className="text-xs text-blue-600 font-medium">
                                                                Pode vencer: R$ {product.suggested_price.toFixed(2)}
                                                            </div>
                                                        ) : (
                                                            <div className="text-xs text-red-600">
                                                                Para vencer: R$ {product.price_to_win.toFixed(2)}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                {product.winner_snapshot && (
                                                    <div className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                                                        <span className="font-semibold text-gray-700">Vencedor:</span>
                                                        <span>R$ {typeof product.winner_snapshot.price === 'number' ? product.winner_snapshot.price.toFixed(2) : '-'}</span>
                                                        {product.winner_snapshot.free_shipping && (
                                                            <Badge variant="outline" className="px-1 py-0 text-[10px]">
                                                                Frete grátis
                                                            </Badge>
                                                        )}
                                                        {product.winner_snapshot.seller_medal && (
                                                            <Badge variant="outline" className="px-1 py-0 text-[10px]">
                                                                Medalha {product.winner_snapshot.seller_medal}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                )}
                                                {product.competitive_gap && (
                                                    <p className="text-[11px] text-orange-700">
                                                        {product.competitive_gap.notes?.[0]}
                                                    </p>
                                                )}
                                            </div>
                                        </TableCell>

                                        {/* Performance */}
                                        <TableCell>
                                            <div className="space-y-1">
                                                <div className="flex justify-between text-xs">
                                                    <span>Vendas (120d):</span>
                                                    <span className="font-medium">{product.sales_120_days}</span>
                                                </div>
                                                <div className="flex justify-between text-xs">
                                                    <span>Conversão:</span>
                                                    <span className="font-medium">{product.conversion_rate}%</span>
                                                </div>
                                                <div className="flex justify-between text-xs">
                                                    <span>Total:</span>
                                                    <span className="font-medium">{product.total_sold_historical}</span>
                                                </div>
                                            </div>
                                        </TableCell>

                                        {/* Impulsionadores */}
                                        <TableCell>
                                            {getBoosterIcons(product.boosters)}
                                        </TableCell>

                                        {/* Ações */}
                                        <TableCell>
                                            <div className="flex gap-1">
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="h-8 px-2"
                                                    onClick={() => handleViewAnalysis(product.mlb_id)}
                                                    title="Abrir análise detalhada"
                                                >
                                                    <Eye className="h-3 w-3" />
                                                </Button>
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="h-8 px-2"
                                                    onClick={() => handleOpenListing(product)}
                                                    title="Ver anúncio no Mercado Livre"
                                                >
                                                    <ExternalLink className="h-3 w-3" />
                                                </Button>
                                                {product.winner_snapshot && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-8 px-2"
                                                        onClick={() => handleOpenWinner(product)}
                                                        title="Ver anúncio vencedor"
                                                    >
                                                        <Crown className="h-3 w-3" />
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
