import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PackageX, ExternalLink, AlertTriangle } from "lucide-react";

interface Product {
    id: string;
    title: string;
    thumbnail?: string;
    stock?: number;
    sales: number;
    permalink?: string;
}

interface LowStockAlertsProps {
    products: Product[];
    loading?: boolean;
    threshold?: number;
}

export function LowStockAlerts({ products, loading, threshold = 5 }: LowStockAlertsProps) {
    if (loading) {
        return (
            <Card className="border-border/50 shadow-sm">
                <CardHeader className="border-b border-border/50 bg-muted/20">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <PackageX className="h-4 w-4" />
                        Alertas de Estoque
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                    <div className="space-y-3">
                        {[...Array(3)].map((_, i) => (
                            <Skeleton key={i} className="h-20 w-full" />
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Filtrar produtos com estoque baixo
    const lowStockProducts = products
        .filter((p) => p.stock !== undefined && p.stock <= threshold && p.stock > 0)
        .sort((a, b) => (a.stock || 0) - (b.stock || 0));

    // Produtos sem estoque
    const outOfStockProducts = products.filter((p) => p.stock === 0);

    const getStockBadgeColor = (stock: number) => {
        if (stock === 0) return "bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800";
        if (stock <= 2) return "bg-orange-100 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800";
        return "bg-yellow-100 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800";
    };

    const allAlerts = [...lowStockProducts, ...outOfStockProducts];

    if (allAlerts.length === 0) {
        return (
            <Card className="border-border/50 shadow-sm">
                <CardHeader className="border-b border-border/50 bg-muted/20">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <PackageX className="h-4 w-4" />
                        Alertas de Estoque
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                    <div className="text-center py-8">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-950/30 mb-3">
                            <PackageX className="h-6 w-6 text-green-600 dark:text-green-400" />
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Todos os produtos têm estoque adequado
                        </p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-border/50 shadow-sm">
            <CardHeader className="border-b border-border/50 bg-muted/20">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <PackageX className="h-4 w-4 text-orange-500" />
                        Alertas de Estoque
                    </CardTitle>
                    <Badge variant="outline" className="bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800">
                        {allAlerts.length} {allAlerts.length === 1 ? "alerta" : "alertas"}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="p-6">
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {allAlerts.slice(0, 10).map((product) => (
                        <div
                            key={product.id}
                            className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors"
                        >
                            {product.thumbnail && (
                                <img
                                    src={product.thumbnail}
                                    alt={product.title}
                                    className="h-12 w-12 rounded object-cover flex-shrink-0"
                                />
                            )}
                            <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-sm truncate">{product.title}</h4>
                                <div className="flex items-center gap-2 mt-1">
                                    <Badge
                                        variant="outline"
                                        className={`text-xs ${getStockBadgeColor(product.stock || 0)}`}
                                    >
                                        {product.stock === 0 ? (
                                            <>
                                                <AlertTriangle className="h-3 w-3 mr-1" />
                                                Sem estoque
                                            </>
                                        ) : (
                                            <>
                                                <PackageX className="h-3 w-3 mr-1" />
                                                {product.stock} {product.stock === 1 ? "unidade" : "unidades"}
                                            </>
                                        )}
                                    </Badge>
                                    {product.sales > 0 && (
                                        <span className="text-xs text-muted-foreground">
                                            {product.sales} vendas
                                        </span>
                                    )}
                                </div>
                            </div>
                            {product.permalink && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="flex-shrink-0 h-8 w-8 p-0"
                                    onClick={() => window.open(product.permalink, "_blank")}
                                    title="Ver no Mercado Livre"
                                >
                                    <ExternalLink className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    ))}
                </div>

                {allAlerts.length > 10 && (
                    <div className="mt-4 pt-4 border-t border-border/50 text-center">
                        <p className="text-xs text-muted-foreground">
                            Mostrando 10 de {allAlerts.length} alertas
                        </p>
                    </div>
                )}

                {/* Resumo */}
                <div className="mt-4 pt-4 border-t border-border/50">
                    <div className="grid grid-cols-2 gap-4 text-center">
                        <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20">
                            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                                {lowStockProducts.length}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">Estoque baixo</div>
                        </div>
                        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20">
                            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                                {outOfStockProducts.length}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">Sem estoque</div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
