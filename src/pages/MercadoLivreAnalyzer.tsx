import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ShoppingBag, BarChart3, Zap, Target, Settings, AlertTriangle, FileText, Wrench } from "lucide-react";
import { useMLBAnalyzer } from "@/hooks/useMLBAnalyzer";
import { MLBAnalyzerInput } from "@/components/analyzer/MLBAnalyzerInput";
import { QualityScore } from "@/components/analyzer/QualityScore";
import { ModelManager } from "@/components/analyzer/ModelManager";
import { SmartAlerts } from "@/components/analyzer/SmartAlerts";
import { TechnicalSheetAnalyzer } from "@/components/analyzer/TechnicalSheetAnalyzer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function MercadoLivreAnalyzer() {
    const {
        isAnalyzing,
        currentAnalysis,
        error,
        lastAnalyzed,
        analyzeProduct,
        clearError
    } = useMLBAnalyzer();

    const [activeTab, setActiveTab] = useState("overview");
    const [searchParams] = useSearchParams();
    const mlbFromQuery = searchParams.get("mlb") || undefined;

    const handleAnalyze = async (mlbId: string) => {
        clearError();
        await analyzeProduct(mlbId);
        if (!error) {
            setActiveTab("quality");
        }
    };

    const marketAverage: number | undefined = currentAnalysis?.competitive_analysis?.price_analysis?.market_average;
    const pricePosition: string = currentAnalysis?.competitive_analysis?.price_analysis?.price_position || '-';
    const trends: string[] = currentAnalysis?.competitive_analysis?.market_insights?.category_trends || [];
    const preferences: string[] = currentAnalysis?.competitive_analysis?.market_insights?.consumer_preferences || [];

    return (
        <div className="space-y-6 pb-4">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:gap-4">
                <div className="space-y-1">
                    <h1 className="text-4xl sm:text-5xl font-bold tracking-tight flex items-center gap-3">
                        <ShoppingBag className="h-10 w-10 text-yellow-500" />
                        Analisador MLB
                    </h1>
                    <p className="text-sm sm:text-base text-muted-foreground">
                        Ferramenta completa de análise e otimização SEO para produtos do Mercado Livre
                    </p>
                </div>
            </div>

            {/* Input de Análise */}
            <MLBAnalyzerInput
                onAnalyze={handleAnalyze}
                isLoading={isAnalyzing}
                error={error}
                lastAnalyzed={lastAnalyzed}
                initialMlbId={mlbFromQuery}
            />

            {/* Conteúdo Principal */}
            {currentAnalysis ? (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                    <TabsList className="grid w-full grid-cols-9">
                        <TabsTrigger value="quality" className="flex items-center gap-2">
                            <BarChart3 className="h-4 w-4" />
                            <span className="hidden sm:inline">Quality</span>
                        </TabsTrigger>
                        <TabsTrigger value="title" className="flex items-center gap-2">
                            <Target className="h-4 w-4" />
                            <span className="hidden sm:inline">Título</span>
                        </TabsTrigger>
                        <TabsTrigger value="keywords" className="flex items-center gap-2">
                            <Zap className="h-4 w-4" />
                            <span className="hidden sm:inline">Keywords</span>
                        </TabsTrigger>
                        <TabsTrigger value="model" className="flex items-center gap-2">
                            <Settings className="h-4 w-4" />
                            <span className="hidden sm:inline">Modelo</span>
                        </TabsTrigger>
                        <TabsTrigger value="sheet" className="flex items-center gap-2">
                            <Wrench className="h-4 w-4" />
                            <span className="hidden sm:inline">Ficha</span>
                        </TabsTrigger>
                        <TabsTrigger value="alerts" className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" />
                            <span className="hidden sm:inline">Alertas</span>
                        </TabsTrigger>
                        <TabsTrigger value="technical" className="flex items-center gap-2">
                            <span className="hidden sm:inline">Técnico</span>
                        </TabsTrigger>
                        <TabsTrigger value="seo" className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            <span className="hidden sm:inline">SEO</span>
                        </TabsTrigger>
                        <TabsTrigger value="competitors" className="flex items-center gap-2">
                            <span className="hidden sm:inline">Concorrentes</span>
                        </TabsTrigger>
                    </TabsList>

                    {/* Overview Rápido */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {/* Produto Info */}
                        <Card className="md:col-span-2">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    📦 {currentAnalysis.product_data.title}
                                </CardTitle>
                                <CardDescription className="font-mono text-xs">
                                    {currentAnalysis.mlb_id} • {currentAnalysis.product_data.category_id}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <span>Preço:</span>
                                    <span className="font-bold">R$ {currentAnalysis.product_data.price}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span>Vendidos:</span>
                                    <span>{currentAnalysis.product_data.sold_quantity}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span>Status:</span>
                                    <Badge variant={currentAnalysis.product_data.status === 'active' ? 'default' : 'secondary'}>
                                        {currentAnalysis.product_data.status}
                                    </Badge>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Score Rápido */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg">Score Geral</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <div className="text-center">
                                    <div className="text-3xl font-bold text-primary">
                                        {currentAnalysis.quality_score.overall_score}
                                    </div>
                                    <div className="text-xs text-muted-foreground">/ 100</div>
                                </div>
                                <Progress value={currentAnalysis.quality_score.overall_score} />
                            </CardContent>
                        </Card>

                        {/* Alertas Rápidos */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg">Alertas</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between text-xs">
                                        <span>Críticos:</span>
                                        <span className="text-red-600 font-bold">
                                            {currentAnalysis.quality_score.alerts.filter(a => a.type === 'error').length}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span>Avisos:</span>
                                        <span className="text-yellow-600 font-bold">
                                            {currentAnalysis.quality_score.alerts.filter(a => a.type === 'warning').length}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span>Sugestões:</span>
                                        <span className="text-blue-600 font-bold">
                                            {currentAnalysis.quality_score.suggestions.length}
                                        </span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Abas de Conteúdo */}
                    <TabsContent value="quality" className="space-y-6">
                        <QualityScore score={currentAnalysis.quality_score} />
                    </TabsContent>

                    <TabsContent value="title" className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Análise do Título</CardTitle>
                                <CardDescription>
                                    Otimização SEO do título atual
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="p-4 bg-muted rounded-lg">
                                    <p className="font-medium">Título Atual:</p>
                                    <p className="text-lg">{currentAnalysis.title_optimization.current_title}</p>
                                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                                        <span>Score: {currentAnalysis.title_optimization.current_score}/100</span>
                                        <span>Caracteres: {currentAnalysis.title_optimization.current_title.length}</span>
                                    </div>
                                </div>

                                {currentAnalysis.title_optimization.weaknesses.length > 0 && (
                                    <div>
                                        <h4 className="font-medium mb-2">Pontos Fracos:</h4>
                                        <div className="space-y-1">
                                            {currentAnalysis.title_optimization.weaknesses.map((weakness, index) => (
                                                <Alert key={index}>
                                                    <AlertDescription>{weakness}</AlertDescription>
                                                </Alert>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <h4 className="font-medium mb-3">Sugestões Otimizadas:</h4>
                                    <div className="space-y-3">
                                        {currentAnalysis.title_optimization.suggested_titles.map((suggestion, index) => (
                                            <div key={index} className="p-4 border rounded-lg space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <Badge variant="secondary">Score: {suggestion.score}</Badge>
                                                    <Badge variant={suggestion.score > currentAnalysis.title_optimization.current_score ? 'default' : 'outline'}>
                                                        {suggestion.score > currentAnalysis.title_optimization.current_score ? '↑ Melhor' : '→ Similar'}
                                                    </Badge>
                                                </div>
                                                <p className="font-medium">{suggestion.title}</p>
                                                <p className="text-sm text-muted-foreground">{suggestion.reasoning}</p>
                                                
                                                {suggestion.keywords_added.length > 0 && (
                                                    <div className="flex flex-wrap gap-1">
                                                        <span className="text-xs text-green-600">Adicionadas:</span>
                                                        {suggestion.keywords_added.map(kw => (
                                                            <Badge key={kw} variant="outline" className="text-xs">
                                                                +{kw}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="keywords" className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Palavras-chave Encontradas</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div>
                                        <h4 className="font-medium mb-2">Primárias:</h4>
                                        <div className="flex flex-wrap gap-1">
                                            {currentAnalysis.keyword_analysis.primary_keywords.map(keyword => (
                                                <Badge key={keyword} variant="default">{keyword}</Badge>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="font-medium mb-2">Secundárias:</h4>
                                        <div className="flex flex-wrap gap-1">
                                            {currentAnalysis.keyword_analysis.secondary_keywords.map(keyword => (
                                                <Badge key={keyword} variant="secondary">{keyword}</Badge>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="font-medium mb-2">Long-tail:</h4>
                                        <div className="flex flex-wrap gap-1">
                                            {currentAnalysis.keyword_analysis.long_tail_keywords.slice(0, 5).map(keyword => (
                                                <Badge key={keyword} variant="outline">{keyword}</Badge>
                                            ))}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Oportunidades</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div>
                                        <h4 className="font-medium mb-2">Em Falta:</h4>
                                        <div className="flex flex-wrap gap-1">
                                            {currentAnalysis.keyword_analysis.missing_keywords.slice(0, 8).map(keyword => (
                                                <Badge key={keyword} variant="outline" className="text-red-600 border-red-200">
                                                    {keyword}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="font-medium mb-2">Tendência:</h4>
                                        <div className="flex flex-wrap gap-1">
                                            {currentAnalysis.keyword_analysis.trending_keywords.map(keyword => (
                                                <Badge key={keyword} variant="outline" className="text-green-600 border-green-200">
                                                    🔥 {keyword}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="pt-2">
                                        <div className="flex items-center justify-between text-sm">
                                            <span>Densidade de Keywords:</span>
                                            <span className="font-bold">{currentAnalysis.keyword_analysis.keyword_density.toFixed(1)}%</span>
                                        </div>
                                        <Progress value={currentAnalysis.keyword_analysis.keyword_density} className="mt-1" />
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    <TabsContent value="model" className="space-y-6">
                        <ModelManager 
                            currentModel={currentAnalysis.model_optimization?.current_model || null}
                            currentScore={currentAnalysis.model_optimization?.current_score || 0}
                            strategicKeywords={currentAnalysis.model_optimization?.strategic_keywords || []}
                            optimizedModels={currentAnalysis.model_optimization?.optimized_models || []}
                            categoryInsights={currentAnalysis.model_optimization?.category_insights || {
                                category_name: "Categoria",
                                trending_terms: [],
                                high_conversion_words: [],
                                seasonal_keywords: []
                            }}
                            onModelSelect={(model) => {
                                console.log('Modelo selecionado:', model);
                                // TODO: Implementar ação de seleção de modelo
                            }}
                            onRefreshStrategy={() => {
                                console.log('Atualizando estratégia...');
                                // TODO: Implementar atualização de estratégia
                            }}
                        />
                    </TabsContent>

                    <TabsContent value="sheet" className="space-y-6">
                        {currentAnalysis.technical_sheet_analysis && (
                            <TechnicalSheetAnalyzer 
                                analysis={currentAnalysis.technical_sheet_analysis}
                                productId={currentAnalysis.mlb_id}
                                onOptimize={(attributeId) => {
                                    console.log('Otimizar atributo:', attributeId);
                                    // TODO: Implementar redirecionamento para ML
                                }}
                                onViewDetails={(attributeId) => {
                                    console.log('Ver detalhes do atributo:', attributeId);
                                    // TODO: Implementar modal de detalhes
                                }}
                            />
                        )}
                    </TabsContent>

                    <TabsContent value="alerts" className="space-y-6">
                        <SmartAlerts 
                            analysisData={{
                                quality_score: currentAnalysis.quality_score,
                                technical_analysis: currentAnalysis.technical_analysis,
                                image_analysis: currentAnalysis.image_analysis,
                                keyword_analysis: currentAnalysis.keyword_analysis,
                                title_optimization: currentAnalysis.title_optimization,
                                organic_delivery_prediction: currentAnalysis.organic_delivery_prediction || {
                                    ranking_potential: 50,
                                    optimization_level: "médio"
                                }
                            }}
                            productData={{
                                title: currentAnalysis.product_data.title,
                                status: currentAnalysis.product_data.status,
                                sold_quantity: currentAnalysis.product_data.sold_quantity,
                                category_id: currentAnalysis.product_data.category_id
                            }}
                        />
                    </TabsContent>

                    <TabsContent value="technical" className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Ficha Técnica</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <p className="text-muted-foreground">Total de Atributos:</p>
                                            <p className="font-bold">{currentAnalysis.technical_analysis.total_attributes}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Preenchidos:</p>
                                            <p className="font-bold">{currentAnalysis.technical_analysis.filled_attributes}</p>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm">Completude:</span>
                                            <span className="text-sm font-bold">{currentAnalysis.technical_analysis.completion_percentage}%</span>
                                        </div>
                                        <Progress value={currentAnalysis.technical_analysis.completion_percentage} />
                                    </div>

                                    {currentAnalysis.technical_analysis.missing_important.length > 0 && (
                                        <div>
                                            <h4 className="font-medium mb-2">Atributos Importantes em Falta:</h4>
                                            <div className="flex flex-wrap gap-1">
                                                {currentAnalysis.technical_analysis.missing_important.map(attr => (
                                                    <Badge key={attr} variant="outline" className="text-red-600">
                                                        {attr}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Imagens e Mídia</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <p className="text-muted-foreground">Total de Imagens:</p>
                                            <p className="font-bold">{currentAnalysis.image_analysis.total_images}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Alta Qualidade:</p>
                                            <p className="font-bold">{currentAnalysis.image_analysis.high_quality_images}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm">Tem Vídeo:</span>
                                            <Badge variant={currentAnalysis.image_analysis.has_video ? 'default' : 'secondary'}>
                                                {currentAnalysis.image_analysis.has_video ? 'Sim' : 'Não'}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm">Variações com Imagens:</span>
                                            <Badge variant={currentAnalysis.image_analysis.has_variations_images ? 'default' : 'secondary'}>
                                                {currentAnalysis.image_analysis.has_variations_images ? 'Sim' : 'Não'}
                                            </Badge>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    <TabsContent value="seo" className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Descrição SEO Otimizada</CardTitle>
                                <CardDescription>
                                    Descrição gerada automaticamente para máximo SEO
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="p-4 bg-muted rounded-lg">
                                    <pre className="whitespace-pre-wrap text-sm">
                                        {currentAnalysis.seo_description.optimized_description}
                                    </pre>
                                </div>

                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <p className="text-muted-foreground">Legibilidade:</p>
                                        <div className="flex items-center gap-2">
                                            <Progress value={currentAnalysis.seo_description.readability_score} className="flex-1" />
                                            <span className="font-bold">{currentAnalysis.seo_description.readability_score}/100</span>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground">Keywords SEO:</p>
                                        <p className="font-bold">{currentAnalysis.seo_description.seo_keywords.length}</p>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="font-medium mb-2">Call-to-Action:</h4>
                                    <p className="text-lg font-medium text-green-600">
                                        {currentAnalysis.seo_description.call_to_action}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="competitors" className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Concorrentes Principais</CardTitle>
                                <CardDescription>
                                    Comparação com até 15 anúncios similares na categoria
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {(currentAnalysis.competitive_analysis.top_competitors || []).slice(0, 9).map((c) => (
                                        <div key={c.id} className="p-4 border rounded-lg space-y-2">
                                            <div className="flex items-center justify-between">
                                                <Badge variant={c.shipping.free_shipping ? 'default' : 'outline'}>
                                                    {c.shipping.free_shipping ? 'Frete grátis' : 'Frete' }
                                                </Badge>
                                                <Badge variant="outline">Score {c.score.overall}</Badge>
                                            </div>
                                            <p className="font-medium line-clamp-2">{c.title}</p>
                                            <div className="flex items-center justify-between text-sm">
                                                <span>Preço</span>
                                                <span className="font-bold">R$ {c.price}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-sm">
                                                <span>Vendidos</span>
                                                <span className="font-bold">{c.sold_quantity}</span>
                                            </div>
                                            <div className="flex flex-wrap gap-1 pt-1">
                                                {c.attributes.slice(0, 3).map((a) => (
                                                    <Badge key={`${c.id}-${a.id}`} variant="outline" className="text-xs">
                                                        {a.value_name || a.id}
                                                    </Badge>
                                                ))}
                                            </div>
                                            <a href={c.permalink} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">
                                                Ver anúncio
                                            </a>
                                        </div>
                                    ))}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                                    <div className="p-3 border rounded-md">
                                        <p className="text-sm text-muted-foreground">Posição de Preço</p>
                                        <p className="font-bold">{pricePosition}</p>
                                        <div className="text-xs">Média: R$ {marketAverage !== undefined && Number.isFinite(marketAverage) ? marketAverage.toFixed(2) : '-'}</div>
                                    </div>
                                    <div className="p-3 border rounded-md">
                                        <p className="text-sm text-muted-foreground">Tendências</p>
                                        <div className="flex flex-wrap gap-1">
                                            {trends.map((t) => (
                                                <Badge key={t} variant="outline">{t}</Badge>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="p-3 border rounded-md">
                                        <p className="text-sm text-muted-foreground">Preferências</p>
                                        <div className="flex flex-wrap gap-1">
                                            {preferences.map((t) => (
                                                <Badge key={t} variant="outline">{t}</Badge>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            ) : (
                <Card className="text-center py-12">
                    <CardContent className="space-y-4">
                        <ShoppingBag className="h-16 w-16 text-muted-foreground mx-auto" />
                        <div>
                            <h3 className="text-xl font-semibold">Analisador MLB Pronto</h3>
                            <p className="text-muted-foreground">
                                Cole um MLB ID acima para começar a análise completa
                            </p>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-md mx-auto text-xs">
                            <div className="text-center p-2">
                                <div className="font-bold text-lg">0-100</div>
                                <div className="text-muted-foreground">Score</div>
                            </div>
                            <div className="text-center p-2">
                                <div className="font-bold text-lg">10+</div>
                                <div className="text-muted-foreground">Critérios</div>
                            </div>
                            <div className="text-center p-2">
                                <div className="font-bold text-lg">SEO</div>
                                <div className="text-muted-foreground">Otimizado</div>
                            </div>
                            <div className="text-center p-2">
                                <div className="font-bold text-lg">IA</div>
                                <div className="text-muted-foreground">Powered</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
