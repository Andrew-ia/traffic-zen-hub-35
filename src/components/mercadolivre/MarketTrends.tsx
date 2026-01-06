import { useState } from "react";
import { useMercadoLivreTrends, useMercadoLivreCategory, useMercadoLivreCategoryTopProducts } from "@/hooks/useMercadoLivre";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, ExternalLink, ChevronRight, Layers, ShoppingBag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const ROOT_CATEGORIES = [
    { id: "MLB3937", name: "Joias e Relógios" },
    { id: "MLB1430", name: "Roupas e Calçados" },
    { id: "MLB1051", name: "Celulares e Telefones" },
    { id: "MLB5672", name: "Acessórios para Veículos" },
    { id: "MLB1499", name: "Indústria e Comércio" }
];

interface MarketTrendsProps {
    workspaceId?: string | null;
}

export function MarketTrends({ workspaceId = null }: MarketTrendsProps) {
    const [selectedCategory, setSelectedCategory] = useState(ROOT_CATEGORIES[0].id);
    const [currentPage, setCurrentPage] = useState(1);
    const { data: categoryData, isLoading: categoryLoading } = useMercadoLivreCategory(workspaceId, selectedCategory);
    const { data: trends, isLoading: trendsLoading, error: trendsError } = useMercadoLivreTrends(workspaceId, selectedCategory);
    const { data: topProducts, isLoading: topProductsLoading } = useMercadoLivreCategoryTopProducts(workspaceId, selectedCategory);

    const ITEMS_PER_PAGE = 20;
    const totalPages = trends ? Math.ceil(trends.length / ITEMS_PER_PAGE) : 0;
    
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const currentTrends = trends?.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const handleCategoryChange = (categoryId: string) => {
        setSelectedCategory(categoryId);
        setCurrentPage(1);
    };

    const isRootCategory = ROOT_CATEGORIES.some(c => c.id === selectedCategory);

    return (
        <Card className="col-span-1 shadow-sm border-border/40">
            <CardHeader>
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="flex items-center gap-2 text-base font-semibold">
                                <TrendingUp className="h-5 w-5 text-primary" />
                                Análise de Mercado
                            </CardTitle>
                            <CardDescription>
                                Descubra tendências e produtos mais vendidos
                            </CardDescription>
                        </div>
                    </div>

                    {/* Breadcrumbs Navigation */}
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground overflow-x-auto whitespace-nowrap pb-2 no-scrollbar">
                        <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-muted-foreground"
                                    onClick={() => handleCategoryChange("MLB3937")}
                                >
                                    Início
                                </Button>
                                {categoryData?.path_from_root?.map((crumb, index) => (
                                    <div key={crumb.id} className="flex items-center flex-shrink-0">
                                        <ChevronRight className="h-3.5 w-3.5 mx-1 opacity-50" />
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleCategoryChange(crumb.id)}
                                            className={cn(
                                                "h-6 px-2 font-normal hover:text-primary transition-colors",
                                                index === categoryData.path_from_root!.length - 1 && "font-semibold text-foreground bg-muted/50"
                                            )}
                                        >
                                            {crumb.name}
                                        </Button>
                                    </div>
                                ))}
                    </div>

                    {/* Subcategories Selection */}
                    {categoryLoading ? (
                        <div className="flex gap-2 overflow-hidden">
                            {[1,2,3,4].map(i => <Skeleton key={i} className="h-8 w-24 rounded-full" />)}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {/* Root Categories Quick Access (Only shown if we are at a root or don't have specific children to show yet) */}
                            {(!categoryData?.path_from_root || categoryData.path_from_root.length <= 1) && (
                                <div className="flex flex-wrap gap-2">
                                    {ROOT_CATEGORIES.map((cat) => (
                                        <Button
                                            key={cat.id}
                                            variant={selectedCategory === cat.id ? "secondary" : "outline"}
                                            size="sm"
                                            onClick={() => handleCategoryChange(cat.id)}
                                            className="text-xs rounded-full"
                                        >
                                            {cat.name}
                                        </Button>
                                    ))}
                                </div>
                            )}

                            {/* Subcategories Children */}
                            {categoryData?.children_categories && categoryData.children_categories.length > 0 && (
                                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="flex items-center gap-2">
                                        <Layers className="h-3 w-3 text-muted-foreground" />
                                        <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                                            Subcategorias de {categoryData.name}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto pr-2 custom-scrollbar">
                                        {categoryData.children_categories.map((sub) => (
                                            <Badge
                                                        key={sub.id}
                                                        variant="outline"
                                                        className="cursor-pointer hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all py-1.5 px-3"
                                                        onClick={() => handleCategoryChange(sub.id)}
                                                    >
                                                        {sub.name}
                                                        {sub.total_items_in_this_category && (
                                                            <span className="ml-1.5 opacity-50 text-[9px]">
                                                                ({sub.total_items_in_this_category})
                                                            </span>
                                                        )}
                                                    </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="trends" className="w-full">
                    <TabsList className="w-full grid grid-cols-2 mb-4">
                        <TabsTrigger value="trends">Termos Mais Buscados</TabsTrigger>
                        <TabsTrigger value="products">Produtos Mais Vendidos</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="trends" className="space-y-4">
                        {trendsLoading ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {Array.from({ length: 10 }).map((_, i) => (
                                    <Skeleton key={i} className="h-12 w-full" />
                                ))}
                            </div>
                        ) : trendsError ? (
                            <div className="text-center p-6 text-muted-foreground text-sm">
                                Não foi possível carregar as tendências no momento.
                                <br />
                                <span className="text-xs opacity-70">{(trendsError as Error).message}</span>
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {currentTrends?.map((trend, index) => {
                                        const globalIndex = startIndex + index + 1;
                                        return (
                                        <a
                                            key={index}
                                            href={trend.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="group flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className={`
                                                    flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium
                                                    ${globalIndex <= 3 ? 'bg-primary/10 text-primary' : 'bg-muted/40 text-muted-foreground'}
                                                `}>
                                                    {globalIndex}
                                                </span>
                                                <span className="text-sm font-medium group-hover:text-primary transition-colors line-clamp-1">
                                                    {trend.keyword}
                                                </span>
                                            </div>
                                            <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </a>
                                    )})}
                                </div>
                                
                                {/* Pagination Controls */}
                                {trends && trends.length > ITEMS_PER_PAGE && (
                                    <div className="flex items-center justify-between pt-4 border-t border-border/40">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                            disabled={currentPage === 1}
                                            className="h-8 text-xs"
                                        >
                                            Anterior
                                        </Button>
                                        <span className="text-xs text-muted-foreground">
                                            Página {currentPage} de {totalPages}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                            disabled={currentPage === totalPages}
                                            className="h-8 text-xs"
                                        >
                                            Próximo
                                        </Button>
                                    </div>
                                )}
                            </>
                        )}
                    </TabsContent>

                    <TabsContent value="products" className="space-y-4">
                        {topProductsLoading ? (
                             <div className="grid grid-cols-1 gap-3">
                                {Array.from({ length: 5 }).map((_, i) => (
                                    <Skeleton key={i} className="h-20 w-full" />
                                ))}
                            </div>
                        ) : !Array.isArray(topProducts) || topProducts.length === 0 ? (
                            <div className="text-center p-6 text-muted-foreground text-sm">
                                Nenhuma informação de produtos mais vendidos disponível para esta categoria.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {topProducts.map((product: any, index: number) => {
                                    const title = product.title || product.name || "Produto sem título";
                                    const thumbnail = product.thumbnail || product.pictures?.[0]?.url || "";
                                    const price = product.price || 0;
                                    const productUrl = product.permalink && product.permalink.startsWith('http') 
                                        ? product.permalink 
                                        : `https://lista.mercadolivre.com.br/${encodeURIComponent(title)}`;
                                    
                                    return (
                                    <a 
                                        key={product.id || index}
                                        href={productUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-start gap-4 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group"
                                        onClick={(e) => {
                                            if (!productUrl) e.preventDefault();
                                        }}
                                    >
                                        <div className="relative flex-shrink-0">
                                            <img 
                                                src={thumbnail} 
                                                alt={title} 
                                                className="w-16 h-16 object-contain rounded-md bg-muted/20 p-1 border border-border/50"
                                            />
                                            <span className={`
                                                absolute -top-2 -left-2 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold shadow-sm
                                                ${index < 3 ? 'bg-primary/10 text-primary' : 'bg-muted/40 text-muted-foreground'}
                                            `}>
                                                {index + 1}
                                            </span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
                                                {title}
                                            </h4>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-sm font-bold text-success">
                                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price)}
                                                </span>
                                                {product.sold_quantity > 0 && (
                                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                        • <ShoppingBag className="h-3 w-3" /> {product.sold_quantity} vendidos
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />
                                    </a>
                                )})}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}
