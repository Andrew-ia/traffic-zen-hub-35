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
        if (stock === 0) return "bg-destructive/10 text-destructive border-destructive/20";
        if (stock <= 2) return "bg-warning/10 text-warning border-warning/20";
        return "bg-warning/5 text-warning/80 border-warning/20";
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
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-success/10 mb-3">
                            <PackageX className="h-6 w-6 text-success" />
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
        <Card className="border-border/40 bg-card/50 backdrop-blur-md shadow-lg rounded-3xl overflow-hidden group">
            <CardHeader className="pb-4 border-b border-border/10 bg-muted/5">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <PackageX className="h-5 w-5 text-warning" />
                        Alertas de Estoque
                    </CardTitle>
                    <Badge variant="secondary" className="bg-warning/10 text-warning border-none px-2.5 py-0.5 font-bold uppercase text-[10px]">
                        {allAlerts.length} Alertas
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="divide-y divide-border/10 max-h-[400px] overflow-y-auto custom-scrollbar">
                    {allAlerts.slice(0, 10).map((product) => (
                        <div
                            key={product.id}
                            className="flex items-center gap-4 p-4 hover:bg-muted/10 transition-colors group/item"
                        >
                            {product.thumbnail && (
                                <div className="h-12 w-12 rounded-xl overflow-hidden border border-border/20 shrink-0">
                                    <img
                                        src={product.thumbnail}
                                        alt={product.title}
                                        className="h-full w-full object-cover"
                                    />
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-sm truncate uppercase tracking-tight">{product.title}</h4>
                                <div className="flex items-center gap-2 mt-1.5">
                                    <div className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${product.stock === 0 ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"
                                        }`}>
                                        {product.stock === 0 ? "Sem Estoque" : `${product.stock} un. restantes`}
                                    </div>
                                    {product.sales > 0 && (
                                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">
                                            {product.sales} vendas
                                        </span>
                                    )}
                                </div>
                            </div>
                            {product.permalink && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-full opacity-0 group-hover/item:opacity-100 transition-opacity"
                                    onClick={() => window.open(product.permalink, "_blank")}
                                >
                                    <ExternalLink className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    ))}
                </div>

                {/* Resumo */}
                <div className="p-4 bg-muted/5 border-t border-border/10">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 rounded-2xl bg-warning/10 border border-warning/20 text-center">
                            <div className="text-xl font-black text-warning">
                                {lowStockProducts.length}
                            </div>
                            <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Estoque Baixo</div>
                        </div>
                        <div className="p-3 rounded-2xl bg-destructive/10 border border-destructive/20 text-center">
                            <div className="text-xl font-black text-destructive">
                                {outOfStockProducts.length}
                            </div>
                            <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Zerados</div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
