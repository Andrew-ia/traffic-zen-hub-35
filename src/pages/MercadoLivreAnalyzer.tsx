import { useState } from 'react';
import { useMLBAnalyzer } from '@/hooks/useMLBAnalyzer';
import { MLBAnalyzerInput } from '@/components/analyzer/MLBAnalyzerInput';
import { CompetitorSearch } from '@/components/analyzer/CompetitorSearch';
import { MLBAnalysisResults } from '@/components/analyzer/MLBAnalysisResults';
import { MarketTrends } from "@/components/mercadolivre/MarketTrends";
import { History, ShoppingBag } from 'lucide-react';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function MercadoLivreAnalyzer() {
    const {
        currentAnalysis,
        isAnalyzing,
        error,
        analyzeProduct,
        analysisHistory,
        currentWorkspace
    } = useMLBAnalyzer();

    const [activeTab, setActiveTab] = useState("direct");

    return (
        <div className="container mx-auto py-8 space-y-8 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-yellow-500 to-yellow-600 flex items-center gap-2">
                        <ShoppingBag className="h-8 w-8 text-yellow-500" />
                        Analisador de Anúncios ML
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Analise anúncios do Mercado Livre e obtenha sugestões de otimização
                    </p>
                </div>

                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="outline" className="gap-2">
                            <History className="h-4 w-4" />
                            Histórico
                        </Button>
                    </SheetTrigger>
                    <SheetContent>
                        <SheetHeader>
                            <SheetTitle>Histórico de Análises</SheetTitle>
                        </SheetHeader>
                        <div className="mt-6 space-y-4">
                            {analysisHistory.length === 0 ? (
                                <p className="text-center text-muted-foreground py-8">
                                    Nenhuma análise recente
                                </p>
                            ) : (
                                analysisHistory.map((item, i) => (
                                    <div
                                        key={i}
                                        className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                                        onClick={() => analyzeProduct(item.mlbId)}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="font-mono text-xs text-muted-foreground">{item.mlbId}</span>
                                            <span className={`text-xs font-bold ${item.score >= 80 ? 'text-green-600' :
                                                item.score >= 60 ? 'text-yellow-600' :
                                                    'text-red-600'
                                                }`}>
                                                Score: {item.score}
                                            </span>
                                        </div>
                                        <h4 className="text-sm font-medium line-clamp-2">{item.title}</h4>
                                        <p className="text-xs text-muted-foreground mt-2">
                                            {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true, locale: ptBR })}
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                    </SheetContent>
                </Sheet>
            </div>

            {!currentAnalysis && (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-3 max-w-[600px] mb-8 mx-auto">
                        <TabsTrigger value="direct">Análise Direta</TabsTrigger>
                        <TabsTrigger value="search">Buscar Concorrentes</TabsTrigger>
                        <TabsTrigger value="trends">Tendências de Mercado</TabsTrigger>
                    </TabsList>

                    <TabsContent value="direct" className="space-y-4">
                        <div className="max-w-3xl mx-auto text-center mb-8">
                            <h2 className="text-2xl font-semibold mb-2">Cole o Link ou ID do Anúncio</h2>
                            <p className="text-muted-foreground">
                                Cole o link do anúncio do seu concorrente ou o código MLB para uma análise completa de SEO e oportunidades.
                            </p>
                        </div>
                        <MLBAnalyzerInput
                            onAnalyze={analyzeProduct}
                            isLoading={isAnalyzing}
                        />
                    </TabsContent>

                    <TabsContent value="search" className="space-y-4">
                        <div className="max-w-3xl mx-auto text-center mb-8">
                            <h2 className="text-2xl font-semibold mb-2">Encontre seu Concorrente</h2>
                            <p className="text-muted-foreground">
                                Busque por palavras-chave para encontrar os anúncios mais relevantes e analisar suas estratégias.
                            </p>
                        </div>
                        <CompetitorSearch
                            onAnalyze={analyzeProduct}
                            isAnalyzing={isAnalyzing}
                            workspaceId={currentWorkspace?.id}
                        />
                    </TabsContent>

                    <TabsContent value="trends" className="space-y-4">
                        <div className="max-w-3xl mx-auto text-center mb-8">
                            <h2 className="text-2xl font-semibold mb-2">Tendências de Mercado</h2>
                            <p className="text-muted-foreground">
                                Explore as tendências de busca e produtos em alta no Mercado Livre para identificar oportunidades.
                            </p>
                        </div>
                        <MarketTrends workspaceId={currentWorkspace?.id} />
                    </TabsContent>
                </Tabs>
            )}

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200">
                    <h4 className="font-semibold flex items-center gap-2">
                        Erro na análise
                    </h4>
                    <p className="text-sm mt-1">{error}</p>
                    <Button
                        variant="link"
                        size="sm"
                        className="text-red-700 p-0 mt-2 h-auto"
                        onClick={() => window.location.reload()}
                    >
                        Tentar novamente
                    </Button>
                </div>
            )}

            {currentAnalysis && (
                <div className="space-y-6">
                    <Button
                        variant="ghost"
                        onClick={() => window.location.reload()}
                        className="mb-4"
                    >
                        ← Nova Análise
                    </Button>
                    <MLBAnalysisResults
                        result={currentAnalysis}
                        workspaceId={currentWorkspace?.id}
                        onReanalyze={analyzeProduct}
                    />
                </div>
            )}
        </div>
    );
}
