import { useState, useMemo } from "react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useMercadoLivreFullAnalytics, useSyncFullAnalytics, MercadoLivreFullProduct } from "@/hooks/useMercadoLivre";
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Search,
    RefreshCw,
    TrendingUp,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    Clock,
    MoreHorizontal,
    ExternalLink,
    Zap,
    Filter
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

export default function MercadoLivreFullAnalytics() {
    const navigate = useNavigate();
    const { currentWorkspace } = useWorkspace();
    const workspaceId = currentWorkspace?.id || null;
    const { toast } = useToast();
    
    const [search, setSearch] = useState("");
    const [classFilter, setClassFilter] = useState<string>("all");
    const [sortBy, setSortBy] = useState<"profit" | "sales" | "class">("class");

    const {
        data: products,
        isLoading,
        error,
        refetch
    } = useMercadoLivreFullAnalytics(workspaceId);

    const { mutate: syncFull, isPending: isSyncing } = useSyncFullAnalytics();

    const handleSync = () => {
        if (!workspaceId) return;
        syncFull(workspaceId, {
            onSuccess: () => {
                toast({
                    title: "Sincronização iniciada",
                    description: "Os dados do Full estão sendo atualizados.",
                });
            },
            onError: () => {
                toast({
                    title: "Erro na sincronização",
                    description: "Não foi possível atualizar os dados.",
                    variant: "destructive",
                });
            }
        });
    };

    const filteredProducts = useMemo(() => {
        if (!products) return [];
        
        return products
            .filter(p => {
                const matchesSearch = p.title.toLowerCase().includes(search.toLowerCase()) || 
                                      p.ml_item_id.toLowerCase().includes(search.toLowerCase());
                const matchesClass = classFilter === "all" || p.classification === classFilter;
                return matchesSearch && matchesClass;
            })
            .sort((a, b) => {
                if (sortBy === "profit") return b.profit_unit - a.profit_unit;
                if (sortBy === "sales") return b.sales_30d - a.sales_30d;
                if (sortBy === "class") {
                    const classA = a.classification ?? "N/A";
                    const classB = b.classification ?? "N/A";
                    return classA.localeCompare(classB);
                }
                return 0;
            });
    }, [products, search, classFilter, sortBy]);

    const stats = useMemo(() => {
        if (!products) return { A: 0, B: 0, C: 0 };
        return {
            A: products.filter(p => p.classification === "A").length,
            B: products.filter(p => p.classification === "B").length,
            C: products.filter(p => p.classification === "C").length,
        };
    }, [products]);

    const getClassColor = (cls: string) => {
        switch (cls) {
            case "A": return "bg-green-100 text-green-800 border-green-200";
            case "B": return "bg-yellow-100 text-yellow-800 border-yellow-200";
            case "C": return "bg-blue-100 text-blue-800 border-blue-200";
            default: return "bg-gray-100 text-gray-800";
        }
    };

    const getClassIcon = (cls: string) => {
        switch (cls) {
            case "A": return <CheckCircle2 className="h-4 w-4 text-green-600" />;
            case "B": return <TrendingUp className="h-4 w-4 text-yellow-600" />;
            case "C": return <Clock className="h-4 w-4 text-blue-600" />;
            default: return null;
        }
    };

    if (isLoading) {
        return (
            <div className="p-8 space-y-6">
                <div className="flex justify-between items-center">
                    <Skeleton className="h-10 w-64" />
                    <Skeleton className="h-10 w-32" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
                </div>
                <Skeleton className="h-[400px]" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 text-center">
                <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold mb-2">Erro ao carregar dados</h2>
                <p className="text-muted-foreground mb-4">Não foi possível buscar as análises do Full.</p>
                <Button onClick={() => refetch()}>Tentar Novamente</Button>
            </div>
        );
    }

    return (
        <div className="p-8 space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Analytics Full</h1>
                    <p className="text-muted-foreground mt-1">
                        Análise de performance, margem e classificação automática do catálogo Full.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleSync} disabled={isSyncing}>
                        <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                        {isSyncing ? "Sincronizando..." : "Sincronizar Agora"}
                    </Button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-green-50/50 border-green-100">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-green-800">Classe A - Escalar</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-900">{stats.A}</div>
                        <p className="text-xs text-green-600 mt-1">Alta conversão e lucro</p>
                    </CardContent>
                </Card>
                <Card className="bg-yellow-50/50 border-yellow-100">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-yellow-800">Classe B - Otimizar</CardTitle>
                        <TrendingUp className="h-4 w-4 text-yellow-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-yellow-900">{stats.B}</div>
                        <p className="text-xs text-yellow-600 mt-1">Potencial de crescimento</p>
                    </CardContent>
                </Card>
                <Card className="bg-blue-50/50 border-blue-100">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-blue-800">Classe C - Aguardar</CardTitle>
                        <Clock className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-900">{stats.C}</div>
                        <p className="text-xs text-blue-600 mt-1">Produtos novos ou recuperação</p>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 items-center bg-card p-4 rounded-lg border shadow-sm">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por título ou MLB..."
                        className="pl-9"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <Select value={classFilter} onValueChange={setClassFilter}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Filtrar por Classe" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todas as Classes</SelectItem>
                        <SelectItem value="A">Classe A</SelectItem>
                        <SelectItem value="B">Classe B</SelectItem>
                        <SelectItem value="C">Classe C</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Ordenar por" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="class">Classificação</SelectItem>
                        <SelectItem value="profit">Maior Lucro</SelectItem>
                        <SelectItem value="sales">Mais Vendas 30d</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Products Table */}
            <Card>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[400px]">Produto</TableHead>
                            <TableHead>Classe</TableHead>
                            <TableHead className="text-right">Estoque</TableHead>
                            <TableHead className="text-right">Vendas 30d</TableHead>
                            <TableHead className="text-right">Lucro Unit.</TableHead>
                            <TableHead>Ação Recomendada</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredProducts.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center">
                                    Nenhum produto encontrado.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredProducts.map((product) => (
                                <TableRow key={product.id}>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium line-clamp-2" title={product.title}>
                                                {product.title}
                                            </span>
                                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                                <span>{product.ml_item_id}</span>
                                                <Badge variant="secondary" className="h-5 px-1 text-[10px]">FULL</Badge>
                                                {product.adsActive && (
                                                    <Badge variant="outline" className="h-5 px-1 text-[10px] bg-blue-50 text-blue-700 border-blue-200">Ads Ativo</Badge>
                                                )}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={getClassColor(product.classification)}>
                                            <div className="flex items-center gap-1">
                                                {getClassIcon(product.classification)}
                                                Class {product.classification}
                                            </div>
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className={`font-medium ${(product.available_quantity || 0) === 0 ? "text-red-600" : ""}`}>
                                            {product.available_quantity || 0}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="font-medium">{product.sales_30d}</div>
                                        <div className="text-xs text-muted-foreground">R$ {Number(product.revenue_30d).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className={`font-bold ${product.profit_unit > 0 ? "text-green-600" : "text-red-600"}`}>
                                            R$ {Number(product.profit_unit).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            Preço: R$ {Number(product.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="whitespace-pre-line text-xs">
                                            {product.recommendation || "Sem recomendação"}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                    <span className="sr-only">Abrir menu</span>
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                                <DropdownMenuItem onClick={() => window.open(product.ml_permalink, '_blank')}>
                                                    <ExternalLink className="mr-2 h-4 w-4" />
                                                    Ver no ML
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem>
                                                    <Zap className="mr-2 h-4 w-4" />
                                                    Ativar Ads
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => navigate(`/mercado-livre-analyzer?mlb=${product.ml_item_id}`)}>
                                                    <Filter className="mr-2 h-4 w-4" />
                                                    Ver Detalhes
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </Card>
        </div>
    );
}
