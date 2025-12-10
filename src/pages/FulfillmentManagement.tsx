import { useState } from "react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useFulfillmentSummary } from "@/hooks/useFulfillment";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Package,
    Search,
    AlertTriangle,
    PackageX,
    ArrowRightLeft,
    RefreshCw,
    TrendingDown,
    Warehouse,
    CheckCircle2,
    XCircle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export default function FulfillmentManagement() {
    const { currentWorkspace } = useWorkspace();
    const workspaceId = currentWorkspace?.id || null;
    const [search, setSearch] = useState("");
    const [lowStockThreshold, setLowStockThreshold] = useState(5);
    const [activeTab, setActiveTab] = useState("all");

    const {
        data: summary,
        isLoading,
        refetch,
        isRefetching,
    } = useFulfillmentSummary(workspaceId);

    if (!workspaceId) {
        return (
            <div className="space-y-4">
                <h1 className="text-4xl font-bold">Gestão de Estoque Full</h1>
                <p className="text-muted-foreground">
                    Selecione um workspace para ver o estoque Full
                </p>
            </div>
        );
    }

    // Filtrar produtos pela busca
    const filteredProducts = summary?.products?.filter(
        (product) =>
            product.title?.toLowerCase().includes(search.toLowerCase()) ||
            product.itemId?.toLowerCase().includes(search.toLowerCase()) ||
            product.inventoryId?.toLowerCase().includes(search.toLowerCase())
    ) || [];

    const outOfStockProducts = filteredProducts.filter((p) => (p.available || 0) === 0);
    const lowStockProducts = filteredProducts.filter(
        (p) => (p.available || 0) > 0 && (p.available || 0) <= lowStockThreshold
    );
    const productsToShow =
        activeTab === "all"
            ? filteredProducts
            : activeTab === "zero"
            ? outOfStockProducts
            : lowStockProducts;

    const formatNumber = (value: number) => {
        return new Intl.NumberFormat("pt-BR").format(value || 0);
    };

    const getUnavailableLabel = (status: string): string => {
        const labels: Record<string, string> = {
            damaged: "Avariado",
            lost: "Perdido",
            withdrawal: "Em Retirada",
            internal_process: "Processo Interno",
            transfer: "Transferência",
            noFiscalCoverage: "Sem Cobertura Fiscal",
            not_supported: "Não Suportado",
        };
        return labels[status] || status;
    };

    const getUnavailableColor = (status: string): string => {
        const colors: Record<string, string> = {
            damaged: "text-red-600",
            lost: "text-orange-600",
            withdrawal: "text-blue-600",
            internal_process: "text-purple-600",
            transfer: "text-cyan-600",
            noFiscalCoverage: "text-yellow-600",
            not_supported: "text-gray-600",
        };
        return colors[status] || "text-gray-600";
    };

    return (
        <div className="space-y-6 pb-4">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                    <h1 className="text-4xl sm:text-5xl font-bold tracking-tight flex items-center gap-3">
                        <Warehouse className="h-10 w-10 text-primary" />
                        Gestão de Estoque Full
                    </h1>
                    <p className="text-sm sm:text-base text-muted-foreground">
                        Controle e planejamento de envios do Mercado Envios Full
                    </p>
                </div>
                <Button
                    onClick={() => refetch()}
                    disabled={isLoading || isRefetching}
                    variant="outline"
                >
                    <RefreshCw className={`mr-2 h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
                    Atualizar
                </Button>
            </div>

            {/* Stats Cards */}
            {isLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                        <Card key={i}>
                            <CardHeader className="pb-3">
                                <Skeleton className="h-4 w-24" />
                            </CardHeader>
                            <CardContent>
                                <Skeleton className="h-8 w-16" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <Package className="h-4 w-4" />
                                Produtos no Full
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-blue-600">
                                {formatNumber(summary?.fullProducts || 0)}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                                de {formatNumber(summary?.totalProducts || 0)} produtos
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4" />
                                Estoque Disponível
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-600">
                                {formatNumber(summary?.availableStock || 0)}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                                {summary?.totalStock
                                    ? `${((summary.availableStock / summary.totalStock) * 100).toFixed(1)}%`
                                    : "0%"}{" "}
                                do total
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <XCircle className="h-4 w-4" />
                                Estoque Indisponível
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-orange-600">
                                {formatNumber(summary?.unavailableStock || 0)}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                                {summary?.totalStock
                                    ? `${((summary.unavailableStock / summary.totalStock) * 100).toFixed(1)}%`
                                    : "0%"}{" "}
                                do total
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <Warehouse className="h-4 w-4" />
                                Estoque Total
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatNumber(summary?.totalStock || 0)}</div>
                            <div className="text-xs text-muted-foreground mt-1">unidades no Full</div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Breakdown de Indisponíveis */}
            {!isLoading && summary && summary.unavailableStock > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-orange-600" />
                            Detalhamento de Estoque Indisponível
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {Object.entries(summary.unavailableDetail).map(([status, quantity]) => {
                                if (quantity === 0) return null;
                                return (
                                    <div key={status} className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium">
                                                {getUnavailableLabel(status)}
                                            </span>
                                            <span className={`text-lg font-bold ${getUnavailableColor(status)}`}>
                                                {formatNumber(quantity)}
                                            </span>
                                        </div>
                                        <Progress
                                            value={(quantity / summary.unavailableStock) * 100}
                                            className="h-2"
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            {((quantity / summary.unavailableStock) * 100).toFixed(1)}% do indisponível
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Search */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-col gap-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por produto, MLB ID ou Inventory ID..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <div className="flex items-center justify-between gap-3">
                            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v)}>
                                <TabsList>
                                    <TabsTrigger value="all">
                                        Todos
                                        <Badge variant="outline" className="ml-2">{filteredProducts.length}</Badge>
                                    </TabsTrigger>
                                    <TabsTrigger value="zero">
                                        Zerados
                                        <Badge variant="destructive" className="ml-2">{outOfStockProducts.length}</Badge>
                                    </TabsTrigger>
                                    <TabsTrigger value="low">
                                        Baixa
                                        <Badge variant="outline" className="ml-2">{lowStockProducts.length}</Badge>
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">Limite de baixa</span>
                                <Input
                                    type="number"
                                    min={1}
                                    value={lowStockThreshold}
                                    onChange={(e) => setLowStockThreshold(Number(e.target.value) || 1)}
                                    className="w-24"
                                />
                                <span className="text-sm text-muted-foreground">unid.</span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Tabela de Produtos */}
            <Card>
                <CardHeader>
                    <CardTitle>Produtos no Fulfillment</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="space-y-3">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <Skeleton key={i} className="h-16 w-full" />
                            ))}
                        </div>
                    ) : productsToShow.length === 0 ? (
                        <div className="text-center py-12">
                            <PackageX className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">
                                {search
                                    ? "Nenhum produto encontrado com esse termo de busca"
                                    : activeTab === "zero"
                                    ? "Nenhum produto zerado"
                                    : activeTab === "low"
                                    ? "Nenhum produto em baixa"
                                    : "Nenhum produto no Mercado Envios Full"}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[80px]">Imagem</TableHead>
                                        <TableHead className="min-w-[250px]">Produto</TableHead>
                                        <TableHead>Inventory ID</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                        <TableHead className="text-right">Disponível</TableHead>
                                        <TableHead className="text-right">Indisponível</TableHead>
                                        <TableHead className="text-center">Saúde do Estoque</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {productsToShow.map((product) => {
                                        const healthPercentage = product.total
                                            ? (product.available / product.total) * 100
                                            : 0;
                                        const healthColor =
                                            healthPercentage >= 80
                                                ? "text-green-600"
                                                : healthPercentage >= 50
                                                ? "text-yellow-600"
                                                : "text-red-600";

                                        return (
                                            <TableRow key={product.inventoryId}>
                                                <TableCell>
                                                    <img
                                                        src={product.thumbnail}
                                                        alt={product.title}
                                                        className="w-16 h-16 object-cover rounded"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <div>
                                                        <p className="font-medium line-clamp-2">
                                                            {product.title}
                                                        </p>
                                                        <p className="text-sm text-muted-foreground">
                                                            {product.itemId}
                                                        </p>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <code className="px-2 py-1 bg-muted rounded text-sm font-mono">
                                                        {product.inventoryId}
                                                    </code>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Badge variant="outline">{formatNumber(product.total)}</Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Badge variant="default" className="bg-green-600">
                                                        {formatNumber(product.available)}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {product.unavailable > 0 ? (
                                                        <Badge variant="destructive">
                                                            {formatNumber(product.unavailable)}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-muted-foreground">0</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <div className="space-y-1">
                                                        <div className={`text-lg font-bold ${healthColor}`}>
                                                            {healthPercentage.toFixed(0)}%
                                                        </div>
                                                        <Progress value={healthPercentage} className="h-2 w-20 mx-auto" />
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
