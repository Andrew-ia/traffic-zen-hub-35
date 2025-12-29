
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, RefreshCw, ShoppingBag, Truck, Zap, Award, Search, TrendingUp, DollarSign, Calendar, Users, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "../hooks/useWorkspace";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface MarketStats {
    total_listings: number;
    scanned_listings: number;
    unique_sellers: number;
    official_stores_count: number;
    fulfillment_count: number;
    free_shipping_count: number;
    mercado_lider_count: number;
    created_today_count: number;
    total_revenue: number;
    average_price: number;
    total_sold_quantity: number;
    average_listing_age_days: number | null;
    sample_truncated: boolean;
}

interface Product {
    id: string;
    title: string;
    price: number;
    sold_quantity: number;
    permalink: string;
    thumbnail: string;
    ad_age_days: number | null;
    sales_per_day: number | null;
    official_store_id?: number | null;
    logistic_type?: string | null;
    shipping_free_shipping?: boolean;
    seller_power_seller_status?: string | null;
    seller_id?: string | null;
    seller_nickname?: string | null;
    seller_reputation_level?: string | null;
    seller_transactions?: number | null;
    seller_listings?: number | null;
}

interface Trend {
    keyword: string;
    url: string;
    position: number;
}

const PRESET_CATEGORIES = [
    { id: "MLB1431", name: "Joias e Bijuterias (Geral)" },
    { id: "MLB3937", name: "Joias e Relógios" },
    { id: "MLB1434", name: "Anéis" },
    { id: "MLB1436", name: "Brincos" },
    { id: "MLB1438", name: "Colares e Correntes" },
    { id: "MLB1442", name: "Pulseiras" },
];

export default function MercadoLivreMarketAnalysis() {
    const { currentWorkspace } = useWorkspace();
    const fallbackWorkspaceId = (import.meta.env.VITE_WORKSPACE_ID as string | undefined)?.trim() || null;
    const effectiveWorkspaceId = currentWorkspace?.id || fallbackWorkspaceId;
    const [isLoading, setIsLoading] = useState(false);
    const [stats, setStats] = useState<MarketStats | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [trends, setTrends] = useState<Trend[]>([]);
    const [analysisMeta, setAnalysisMeta] = useState<{ search_strategy?: string; total_listings?: number; scanned_listings?: number; sample_truncated?: boolean } | null>(null);
    const hasModeInitialized = useRef(false);
    
    // Mode State
    const [analysisMode, setAnalysisMode] = useState<"category" | "product">("category");
    
    // Category Mode State
    const [categoryId, setCategoryId] = useState("MLB1431"); 
    const [customId, setCustomId] = useState("");
    
    // Product Mode State
    const [productId, setProductId] = useState("");
    const [targetProduct, setTargetProduct] = useState<Product | null>(null);

    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const [isConnected, setIsConnected] = useState(true);
    const [checkStatusLoading, setCheckStatusLoading] = useState(false);

    const checkConnection = async () => {
        if (!effectiveWorkspaceId) return;
        setCheckStatusLoading(true);
        try {
            const res = await fetch(`/api/integrations/mercadolivre/status?workspaceId=${effectiveWorkspaceId}`);
            const data = await res.json();
            setIsConnected(data.connected);
        } catch (error) {
            console.error("Failed to check status:", error);
        } finally {
            setCheckStatusLoading(false);
        }
    };

    const handleCategoryChange = (value: string) => {
        setCategoryId(value);
        if (value !== "custom") {
            setCustomId("");
        }
    };

    const getActiveCategoryId = () => {
        return categoryId === "custom" ? customId : categoryId;
    };

    const normalizeStats = (raw: any): MarketStats => {
        const totalListings = Number(raw?.total_listings || 0);
        const scannedListings = raw?.scanned_listings === undefined || raw?.scanned_listings === null
            ? totalListings
            : Number(raw.scanned_listings);

        return {
            total_listings: totalListings,
            scanned_listings: scannedListings,
            unique_sellers: Number(raw?.unique_sellers || 0),
        official_stores_count: Number(raw?.official_stores_count || 0),
        fulfillment_count: Number(raw?.fulfillment_count || 0),
        free_shipping_count: Number(raw?.free_shipping_count || 0),
        mercado_lider_count: Number(raw?.mercado_lider_count || 0),
        created_today_count: Number(raw?.created_today_count || 0),
        total_revenue: Number(raw?.total_revenue || 0),
        average_price: Number(raw?.average_price || 0),
        total_sold_quantity: Number(raw?.total_sold_quantity || 0),
        average_listing_age_days: raw?.average_listing_age_days === null || raw?.average_listing_age_days === undefined
            ? null
            : Number(raw.average_listing_age_days),
        sample_truncated: Boolean(raw?.sample_truncated),
        };
    };

    const normalizeProduct = (item: any): Product => ({
        id: String(item?.id || ""),
        title: String(item?.title || ""),
        price: Number(item?.price || 0),
        sold_quantity: Number(item?.sold_quantity || 0),
        permalink: String(item?.permalink || ""),
        thumbnail: String(item?.thumbnail || ""),
        ad_age_days: item?.ad_age_days === null || item?.ad_age_days === undefined ? null : Number(item.ad_age_days),
        sales_per_day: item?.sales_per_day === null || item?.sales_per_day === undefined ? null : Number(item.sales_per_day),
        official_store_id: item?.official_store_id ?? null,
        logistic_type: item?.logistic_type ?? null,
        shipping_free_shipping: Boolean(item?.shipping_free_shipping),
        seller_power_seller_status: item?.seller_power_seller_status ?? null,
        seller_id: item?.seller_id ?? null,
        seller_nickname: item?.seller_nickname ?? null,
        seller_reputation_level: item?.seller_reputation_level ?? null,
        seller_transactions: item?.seller_transactions ?? null,
        seller_listings: item?.seller_listings ?? null,
    });

    const fetchData = async (refresh: boolean = false) => {
        setIsLoading(true);
        try {
            if (analysisMode === "category") {
                const activeId = getActiveCategoryId();
                if (!activeId) {
                    toast.error("Por favor, insira um ID de categoria válido.");
                    return;
                }

                // Basic validation
                if (!activeId.startsWith("MLB")) {
                    toast.warning("O ID da categoria geralmente começa com 'MLB' (ex: MLB1431). Verifique se você não colou um ID de item.");
                }

                if (refresh) {
                    // Trigger analysis
                    const analyzeRes = await fetch("/api/integrations/mercadolivre/analyze-market", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ categoryId: activeId, workspaceId: effectiveWorkspaceId })
                    });
                    
                    if (!analyzeRes.ok) {
                        const errData = await analyzeRes.json().catch(() => ({}));
                        if (analyzeRes.status === 403) {
                             throw new Error("ACESSO NEGADO: Conecte sua conta do Mercado Livre na aba Integrações para continuar. A API pública está bloqueada.");
                        }
                        throw new Error(errData.details || errData.error || "Falha ao analisar mercado. Verifique o ID ou tente novamente.");
                    }
                }

                // Fetch Dashboard Data
                const res = await fetch(`/api/integrations/mercadolivre/analysis-dashboard/${activeId}`);
                if (!res.ok) throw new Error("Failed to fetch dashboard data");
                
                const data = await res.json();
                setStats(normalizeStats(data.stats || {}));
                setProducts((data.topProducts || []).map(normalizeProduct));
                setTrends(data.trends || []);
                setAnalysisMeta(null);
                setTargetProduct(null); // Clear target product in category mode
                setLastUpdated(new Date());
                
                if (refresh) {
                    if (data.topProducts.length === 0) {
                        toast.warning("Análise concluída, mas nenhum produto foi encontrado. O Mercado Livre pode estar bloqueando as requisições.");
                    } else {
                        toast.success("Dados atualizados com sucesso!");
                    }
                }
            } else {
                // Product Mode
                if (!productId) {
                    toast.error("Por favor, insira um ID de produto (MLB...).");
                    return;
                }

                // Call analyze-product
                const analyzeRes = await fetch("/api/integrations/mercadolivre/analyze-product", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ productId, workspaceId: effectiveWorkspaceId })
                });

                if (!analyzeRes.ok) {
                     const errData = await analyzeRes.json().catch(() => ({}));
                     if (analyzeRes.status === 403) {
                          throw new Error("ACESSO NEGADO: Conecte sua conta do Mercado Livre na aba Integrações para continuar. A API pública está bloqueada.");
                     }
                     throw new Error(errData.details || errData.error || "Falha ao analisar produto.");
                }

                const data = await analyzeRes.json();
                setStats(normalizeStats(data.results.statistics || {}));
                setProducts((data.results.competitors || []).map(normalizeProduct));
                setTargetProduct(data.results.targetProduct ? normalizeProduct(data.results.targetProduct) : null);
                setAnalysisMeta(data.results.meta || null);
                setTrends([]); // No trends for product mode yet
                setLastUpdated(new Date());
                
                toast.success("Análise de competidores concluída!");
            }
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Erro ao carregar dados.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (effectiveWorkspaceId) {
            checkConnection();
            // Auto-fetch only for category mode on load if default is set, 
            // but to be safe and avoid errors, let's wait for user action or check if we have a valid category
            if (analysisMode === "category") {
                fetchData();
            }
        }
    }, [effectiveWorkspaceId]); 

    useEffect(() => {
        if (!hasModeInitialized.current) {
            hasModeInitialized.current = true;
            return;
        }
        setStats(null);
        setProducts([]);
        setTrends([]);
        setTargetProduct(null);
        setAnalysisMeta(null);
    }, [analysisMode]);

    const formatCurrency = (value: string | number) => {
        const num = Number(value);
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
    };

    const formatNumber = (value: string | number) => {
        const num = Number(value);
        return new Intl.NumberFormat('pt-BR').format(num);
    };

    const calculatePercentage = (count: number, total: number) => {
        const c = Number(count || 0);
        const t = Number(total || 0);
        if (!t) return "0%";
        return ((c / t) * 100).toFixed(1) + "%";
    };

    return (
        <div className="p-8 max-w-[1600px] mx-auto space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
                        <TrendingUp className="h-8 w-8 text-purple-600" />
                        Análise de Mercado
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Visão 360º: concorrência, logística e oportunidades.
                    </p>
                </div>
                
                <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg border">
                    <Button 
                        variant={analysisMode === "category" ? "default" : "ghost"} 
                        onClick={() => setAnalysisMode("category")}
                        size="sm"
                        className="px-4"
                    >
                        Categoria
                    </Button>
                    <Button 
                        variant={analysisMode === "product" ? "default" : "ghost"} 
                        onClick={() => setAnalysisMode("product")}
                        size="sm"
                        className="px-4"
                    >
                        Produto (Competidores)
                    </Button>
                </div>
            </div>

            {/* Inputs Section */}
            <div className="flex flex-col md:flex-row items-end gap-4 bg-card p-6 rounded-xl border shadow-sm">
                 {analysisMode === "category" ? (
                    <div className="flex flex-col gap-2 flex-1 w-full">
                        <Label>Categoria para Análise</Label>
                        <div className="flex flex-col md:flex-row gap-2">
                            <Select value={categoryId} onValueChange={handleCategoryChange}>
                                <SelectTrigger className="w-full md:w-[300px]">
                                    <SelectValue placeholder="Selecione a Categoria" />
                                </SelectTrigger>
                                <SelectContent>
                                    {PRESET_CATEGORIES.map(cat => (
                                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                    ))}
                                    <SelectItem value="custom">Outra (ID Personalizado)</SelectItem>
                                </SelectContent>
                            </Select>

                            {categoryId === "custom" && (
                                <Input 
                                    value={customId} 
                                    onChange={(e) => setCustomId(e.target.value)}
                                    className="w-full md:w-[150px]"
                                    placeholder="Ex: MLB1234"
                                />
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground">Selecione uma categoria de joias ou insira um ID manualmente.</p>
                    </div>
                 ) : (
                    <div className="flex flex-col gap-2 flex-1 w-full">
                        <Label>ID do Produto (MLB)</Label>
                        <div className="flex gap-2">
                            <Input 
                                value={productId} 
                                onChange={(e) => setProductId(e.target.value)}
                                className="w-full md:w-[400px]"
                                placeholder="Ex: MLB768799458"
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">Cole o ID do produto que deseja analisar para encontrar todos os concorrentes.</p>
                    </div>
                 )}

                <Button onClick={() => fetchData(true)} disabled={isLoading} size="lg" className="bg-purple-600 hover:bg-purple-700 w-full md:w-auto">
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    {isLoading ? "Analisando..." : (analysisMode === "category" ? "Analisar Categoria" : "Analisar Competidores")}
                </Button>
            </div>

            {/* Target Product Info (Only in Product Mode) */}
            {analysisMode === "product" && targetProduct && (
                 <Card className="bg-blue-50/50 border-blue-100 dark:bg-blue-950/10 dark:border-blue-900">
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Search className="h-4 w-4 text-blue-600" />
                            Produto Alvo Analisado
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex gap-4 items-start">
                            <img src={targetProduct.thumbnail} className="w-16 h-16 object-contain bg-white rounded border p-1" />
                            <div>
                                <h3 className="font-bold text-lg line-clamp-1">{targetProduct.title}</h3>
                                <div className="flex flex-wrap gap-x-6 gap-y-1 mt-1 text-sm text-muted-foreground">
                                    <span>Preço: <b className="text-foreground">{formatCurrency(targetProduct.price)}</b></span>
                                    <span>Vendas: <b className="text-foreground">{targetProduct.sold_quantity}</b></span>
                                    <span>ID: {targetProduct.id}</span>
                                    <span>Vendedor: <b className="text-foreground">{targetProduct.seller_nickname || targetProduct.seller_id || "-"}</b></span>
                                    <span>Anúncios: <b className="text-foreground">{targetProduct.seller_listings !== null && targetProduct.seller_listings !== undefined ? formatNumber(targetProduct.seller_listings) : "-"}</b></span>
                                    <span>Idade: <b className="text-foreground">{targetProduct.ad_age_days !== null ? formatNumber(targetProduct.ad_age_days) : "-"}</b></span>
                                </div>
                                <a href={targetProduct.permalink} target="_blank" className="text-blue-600 hover:underline text-xs mt-2 inline-flex items-center gap-1">
                                    Ver no Mercado Livre <Search className="h-3 w-3" />
                                </a>
                            </div>
                        </div>
                    </CardContent>
                 </Card>
            )}

            {!isConnected && !checkStatusLoading && (
                <Alert variant="warning" className="mb-6 border-orange-200 bg-orange-50 text-orange-800">
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                    <AlertTitle className="text-orange-900">Conta do Mercado Livre não conectada</AlertTitle>
                    <AlertDescription className="text-orange-800">
                        Para realizar análises de mercado precisas e evitar bloqueios, conecte sua conta do Mercado Livre na página de Integrações.
                        A busca pública é limitada e pode falhar frequentemente.
                    </AlertDescription>
                </Alert>
            )}

            {(!stats || stats.total_listings === 0) && !isLoading && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Nenhum dado encontrado</AlertTitle>
                    <AlertDescription>
                        Não encontramos produtos para esta categoria. Isso pode acontecer se:
                        <ul className="list-disc list-inside mt-2">
                            <li>O ID da categoria está incorreto.</li>
                            <li>A API do Mercado Livre bloqueou a busca (tente conectar sua conta oficial em Integrações).</li>
                            <li>A categoria não possui produtos relevantes no momento.</li>
                        </ul>
                    </AlertDescription>
                </Alert>
            )}

            {stats && stats.total_listings !== 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Key Metrics Cards similar to Metrify */}
                    <Card className="bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/20 dark:to-background border-indigo-100 dark:border-indigo-900/50">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground flex justify-between">
                                Total de Anúncios
                                <ShoppingBag className="h-4 w-4 text-indigo-500" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-indigo-700 dark:text-indigo-400">
                                {formatNumber(stats.total_listings)}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {analysisMeta?.sample_truncated
                                    ? `Amostra de ${formatNumber(stats.scanned_listings)}`
                                    : `${formatNumber(stats.scanned_listings)} analisados`}
                            </p>
                        </CardContent>
                    </Card>

                    {analysisMode === "product" && (
                        <Card className="bg-gradient-to-br from-sky-50 to-white dark:from-sky-950/20 dark:to-background border-sky-100 dark:border-sky-900/50">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground flex justify-between">
                                    Vendedores
                                    <Users className="h-4 w-4 text-sky-500" />
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-sky-700 dark:text-sky-400">
                                    {formatNumber(stats.unique_sellers)}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    vendedores únicos
                                </p>
                            </CardContent>
                        </Card>
                    )}

                    <Card className="bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-background border-blue-100 dark:border-blue-900/50">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground flex justify-between">
                                Lojas Oficiais
                                <Award className="h-4 w-4 text-blue-500" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                                {formatNumber(stats.official_stores_count)}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {calculatePercentage(stats.official_stores_count, stats.total_listings)} do total
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-green-50 to-white dark:from-green-950/20 dark:to-background border-green-100 dark:border-green-900/50">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground flex justify-between">
                                Fulfillment
                                <Zap className="h-4 w-4 text-green-500" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                                {formatNumber(stats.fulfillment_count)}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {calculatePercentage(stats.fulfillment_count, stats.total_listings)} entregam Full
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-yellow-50 to-white dark:from-yellow-950/20 dark:to-background border-yellow-100 dark:border-yellow-900/50">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground flex justify-between">
                                Frete Grátis
                                <Truck className="h-4 w-4 text-yellow-600" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-500">
                                {formatNumber(stats.free_shipping_count)}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {calculatePercentage(stats.free_shipping_count, stats.total_listings)} com frete grátis
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground flex justify-between">
                                Mercado Líderes
                                <Award className="h-4 w-4 text-purple-500" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {formatNumber(stats.mercado_lider_count)}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {calculatePercentage(stats.mercado_lider_count, stats.total_listings)} são líderes
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground flex justify-between">
                                Anunciados Hoje
                                <Calendar className="h-4 w-4 text-orange-500" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {formatNumber(stats.created_today_count)}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Novos concorrentes
                            </p>
                        </CardContent>
                    </Card>

                    {analysisMode === "product" && (
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground flex justify-between">
                                    Idade Média (dias)
                                    <Calendar className="h-4 w-4 text-gray-500" />
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {stats.average_listing_age_days !== null ? formatNumber(stats.average_listing_age_days.toFixed(0)) : "-"}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    tempo médio dos anúncios
                                </p>
                            </CardContent>
                        </Card>
                    )}

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground flex justify-between">
                                Mercado Endereçável
                                <DollarSign className="h-4 w-4 text-emerald-500" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                                {formatCurrency(stats.total_revenue)}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Faturamento estimado (Top Listings)
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground flex justify-between">
                                Preço Médio
                                <DollarSign className="h-4 w-4 text-gray-500" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {formatCurrency(stats.average_price)}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Ticket médio da categoria
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground flex justify-between">
                                Total Vendido
                                <ShoppingBag className="h-4 w-4 text-pink-500" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-pink-600 dark:text-pink-400">
                                {formatNumber(stats.total_sold_quantity)}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Unidades vendidas (acumulado)
                            </p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {analysisMode === "product" && analysisMeta && (
                <p className="text-xs text-muted-foreground">
                    Base de busca: {analysisMeta.search_strategy === "catalog" ? "Catálogo" : "Título"}
                    {analysisMeta.sample_truncated && analysisMeta.scanned_listings && analysisMeta.total_listings
                        ? ` • Amostra ${formatNumber(analysisMeta.scanned_listings)} de ${formatNumber(analysisMeta.total_listings)}`
                        : ""}
                </p>
            )}

            <Tabs defaultValue="products" className="w-full">
                <TabsList className="mb-4">
                    <TabsTrigger value="products">Top Produtos (Oportunidades)</TabsTrigger>
                    <TabsTrigger value="trends">Termos Mais Buscados</TabsTrigger>
                </TabsList>

                <TabsContent value="products">
                    <Card>
                        <CardHeader>
                            <CardTitle>Produtos com Alta Velocidade de Venda</CardTitle>
                            {analysisMode === "product" && (
                                <p className="text-xs text-muted-foreground">
                                    Top 60 anúncios por velocidade de vendas (ordenados por vendas/dia).
                                </p>
                            )}
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Produto</TableHead>
                                        <TableHead>Vendedor</TableHead>
                                        <TableHead>Anúncios</TableHead>
                                        <TableHead>Preço</TableHead>
                                        <TableHead>Vendas Totais</TableHead>
                                        <TableHead>Idade (Dias)</TableHead>
                                        <TableHead>Vendas/Dia</TableHead>
                                        <TableHead>Logística</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {products.map((product) => (
                                        <TableRow key={product.id}>
                                            <TableCell className="font-medium max-w-[300px]">
                                                <div className="flex items-center gap-3">
                                                    <img src={product.thumbnail} className="h-10 w-10 rounded object-contain bg-white border" />
                                                    <a href={product.permalink} target="_blank" className="hover:underline line-clamp-2" rel="noreferrer">
                                                        {product.title}
                                                    </a>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="space-y-0.5">
                                                    <p className="text-sm font-medium text-foreground">
                                                        {product.seller_nickname || product.seller_id || "-"}
                                                    </p>
                                                    {product.seller_reputation_level && (
                                                        <p className="text-[10px] text-muted-foreground uppercase">
                                                            {product.seller_reputation_level}
                                                        </p>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {product.seller_listings !== null && product.seller_listings !== undefined
                                                    ? formatNumber(product.seller_listings)
                                                    : "-"}
                                            </TableCell>
                                            <TableCell>{formatCurrency(product.price)}</TableCell>
                                            <TableCell>{product.sold_quantity}</TableCell>
                                            <TableCell>{product.ad_age_days !== null ? formatNumber(product.ad_age_days) : "-"}</TableCell>
                                            <TableCell>
                                                {product.sales_per_day !== null ? (
                                                    <Badge variant={Number(product.sales_per_day) > 1 ? "default" : "secondary"} className={Number(product.sales_per_day) > 1 ? "bg-green-600" : ""}>
                                                        {Number(product.sales_per_day).toFixed(1)} / dia
                                                    </Badge>
                                                ) : (
                                                    "-"
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex gap-1">
                                                    {product.logistic_type === 'fulfillment' && <Zap className="h-4 w-4 text-green-500" title="Full" />}
                                                    {product.shipping_free_shipping && <Truck className="h-4 w-4 text-green-500" title="Frete Grátis" />}
                                                    {product.official_store_id && <Award className="h-4 w-4 text-blue-500" title="Loja Oficial" />}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="trends">
                    <Card>
                        <CardHeader>
                            <CardTitle>Termos Mais Buscados no Mercado Livre</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {trends.map((trend) => (
                                    <div key={trend.keyword} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground font-bold text-xs">
                                                {trend.position}
                                            </span>
                                            <span className="font-medium">{trend.keyword}</span>
                                        </div>
                                        <a href={trend.url} target="_blank" className="text-blue-500 hover:underline text-xs" rel="noreferrer">
                                            Ver no ML
                                        </a>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
