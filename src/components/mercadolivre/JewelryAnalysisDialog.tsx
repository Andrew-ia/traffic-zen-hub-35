import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Gem, Loader2, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface JewelryAnalysisDialogProps {
    workspaceId: string;
}

export function JewelryAnalysisDialog({ workspaceId }: JewelryAnalysisDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [report, setReport] = useState<any>(null);

    const handleAnalyze = async () => {
        setIsLoading(true);
        try {
            // 1. Trigger Analysis for "Joias e Bijuterias" (MLB1431)
            const analyzeRes = await fetch("/api/integrations/mercadolivre/analyze-market", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ categoryId: "MLB1431", workspaceId })
            });
            
            if (!analyzeRes.ok) throw new Error("Falha ao iniciar análise");
            
            // 2. Fetch Report
            const reportRes = await fetch("/api/integrations/mercadolivre/analysis-report/MLB1431");
            if (!reportRes.ok) throw new Error("Falha ao buscar relatório");
            
            const data = await reportRes.json();
            setReport(data);
            toast.success("Análise concluída com sucesso!");
        } catch (error) {
            console.error(error);
            toast.error("Erro ao realizar análise.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button 
                    className="h-11 px-6 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:opacity-90 transition-all shadow-xl shadow-purple-500/20 font-black text-xs uppercase tracking-widest"
                >
                    <Gem className="mr-2 h-4 w-4" />
                    Analisar Joias
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-2xl flex items-center gap-2">
                        <Gem className="h-6 w-6 text-purple-600" />
                        Análise de Joias e Bijuterias
                    </DialogTitle>
                    <DialogDescription>
                        Identifique oportunidades de produtos com alta demanda e baixa concorrência, e veja as tendências de busca.
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-4">
                    {!report ? (
                        <div className="flex flex-col items-center justify-center py-12 space-y-4">
                            <p className="text-muted-foreground text-center max-w-md">
                                Clique no botão abaixo para iniciar a coleta de dados do Mercado Livre. 
                                Isso pode levar alguns segundos.
                            </p>
                            <Button onClick={handleAnalyze} disabled={isLoading} size="lg">
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                                {isLoading ? "Analisando Joias e Bijuterias..." : "Buscar Oportunidades em Joias"}
                            </Button>
                        </div>
                    ) : (
                        <Tabs defaultValue="products" className="w-full">
                            <div className="flex justify-between items-center mb-4">
                                <TabsList>
                                    <TabsTrigger value="products">Top Produtos (Oportunidades)</TabsTrigger>
                                    <TabsTrigger value="trends">Termos Mais Buscados</TabsTrigger>
                                </TabsList>
                                <Button variant="outline" size="sm" onClick={handleAnalyze} disabled={isLoading}>
                                    <RefreshCw className={`h-3 w-3 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                                    Atualizar
                                </Button>
                            </div>

                            <TabsContent value="products" className="space-y-4">
                                <div className="grid gap-4">
                                    {report.products.length === 0 && (
                                        <div className="text-center py-8 text-muted-foreground">
                                            Nenhum produto com alta velocidade de vendas encontrado nesta categoria.
                                        </div>
                                    )}
                                    {report.products.map((product: any) => {
                                        const salesPerDay = Number(product.sales_per_day || 0);
                                        const isHot = salesPerDay > 1.0;
                                        
                                        return (
                                        <Card key={product.id} className="overflow-hidden border-l-4 border-l-transparent hover:border-l-purple-500 transition-all">
                                            <div className="flex flex-col sm:flex-row gap-4 p-4">
                                                <div className="h-32 w-32 flex-shrink-0 bg-gray-50 rounded-lg overflow-hidden flex items-center justify-center border">
                                                    <img src={product.thumbnail} alt={product.title} className="max-h-full max-w-full object-contain hover:scale-110 transition-transform" />
                                                </div>
                                                <div className="flex-1 space-y-3">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <div className="flex gap-2 mb-2">
                                                                {isHot && (
                                                                    <Badge className="bg-orange-500 hover:bg-orange-600 text-white border-0">
                                                                        🔥 Alta Demanda
                                                                    </Badge>
                                                                )}
                                                                <Badge variant="outline" className="text-muted-foreground">
                                                                    {product.id}
                                                                </Badge>
                                                            </div>
                                                            <h3 className="font-bold text-lg leading-tight hover:text-purple-600 cursor-pointer" onClick={() => window.open(product.permalink, '_blank')}>
                                                                {product.title}
                                                            </h3>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="block font-black text-2xl text-green-600">R$ {product.price}</span>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="grid grid-cols-3 gap-2 bg-muted/30 p-3 rounded-xl border border-border/50">
                                                        <div className="text-center border-r border-border/50 last:border-0">
                                                            <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Vendas Totais</p>
                                                            <p className="font-black text-lg">{product.sold_quantity}</p>
                                                        </div>
                                                        <div className="text-center border-r border-border/50 last:border-0">
                                                            <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Tempo de Anúncio</p>
                                                            <p className="font-bold text-lg">{product.ad_age_days || 0} dias</p>
                                                        </div>
                                                        <div className="text-center last:border-0">
                                                            <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Velocidade</p>
                                                            <p className={`font-black text-lg ${salesPerDay > 1 ? 'text-orange-500' : 'text-blue-500'}`}>
                                                                {salesPerDay.toFixed(1)} / dia
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </Card>
                                    )})}
                                </div>
                            </TabsContent>
                            
                            <TabsContent value="trends">
                                <Card>
                                    <CardContent className="p-0">
                                        <div className="divide-y">
                                            {report.trends.map((trend: any, index: number) => (
                                                <div key={index} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                                                    <div className="flex items-center gap-4">
                                                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-100 text-yellow-700 font-bold text-sm">
                                                            {trend.position}
                                                        </span>
                                                        <span className="font-medium">{trend.keyword}</span>
                                                    </div>
                                                    <Button variant="ghost" size="sm" asChild>
                                                        <a href={trend.url} target="_blank" rel="noopener noreferrer">
                                                            <ExternalLink className="h-4 w-4" />
                                                        </a>
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        </Tabs>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
