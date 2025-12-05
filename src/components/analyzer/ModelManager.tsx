import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { 
    Target, 
    TrendingUp, 
    Heart, 
    ShoppingCart, 
    Camera, 
    Zap,
    Copy,
    RefreshCw,
    Lightbulb,
    Trophy,
    ArrowUp,
    ArrowDown,
    Minus
} from "lucide-react";

interface ModelKeywordStrategy {
    keyword: string;
    relevance: 'alta' | 'media' | 'baixa';
    type: 'trend' | 'characteristic' | 'search_behavior' | 'emotional' | 'purchase' | 'photographic';
    search_volume: number;
    competition_level: 'baixa' | 'media' | 'alta';
    ranking_boost: number;
    ctr_potential: number;
    conversion_impact: number;
    usage_recommendation: string;
}

interface OptimizedModel {
    model: string;
    score: number;
    strategy: string;
    keywords_used: string[];
    expected_boost: number;
    reasoning: string;
}

interface ModelManagerProps {
    currentModel: string | null;
    currentScore: number;
    strategicKeywords: ModelKeywordStrategy[];
    optimizedModels: OptimizedModel[];
    categoryInsights: {
        category_name: string;
        trending_terms: string[];
        high_conversion_words: string[];
        seasonal_keywords: string[];
    };
    onModelSelect?: (model: string) => void;
    onRefreshStrategy?: () => void;
}

export function ModelManager({
    currentModel,
    currentScore,
    strategicKeywords,
    optimizedModels,
    categoryInsights,
    onModelSelect,
    onRefreshStrategy
}: ModelManagerProps) {
    const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
    const [customModel, setCustomModel] = useState("");
    const [activeKeywordFilter, setActiveKeywordFilter] = useState<string>("all");

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'trend': return <TrendingUp className="h-4 w-4 text-green-500" />;
            case 'characteristic': return <Target className="h-4 w-4 text-blue-500" />;
            case 'search_behavior': return <Zap className="h-4 w-4 text-purple-500" />;
            case 'emotional': return <Heart className="h-4 w-4 text-pink-500" />;
            case 'purchase': return <ShoppingCart className="h-4 w-4 text-orange-500" />;
            case 'photographic': return <Camera className="h-4 w-4 text-gray-500" />;
            default: return <Target className="h-4 w-4" />;
        }
    };

    const getRelevanceColor = (relevance: string) => {
        switch (relevance) {
            case 'alta': return 'bg-green-100 text-green-800 border-green-200';
            case 'media': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'baixa': return 'bg-gray-100 text-gray-800 border-gray-200';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getCompetitionColor = (level: string) => {
        switch (level) {
            case 'baixa': return 'text-green-600';
            case 'media': return 'text-yellow-600';
            case 'alta': return 'text-red-600';
            default: return 'text-gray-600';
        }
    };

    const toggleKeywordSelection = (keyword: string) => {
        setSelectedKeywords(prev => 
            prev.includes(keyword) 
                ? prev.filter(k => k !== keyword)
                : [...prev, keyword]
        );
    };

    const generateCustomModel = () => {
        const model = selectedKeywords.join(' ').trim();
        setCustomModel(model);
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    const getFilteredKeywords = () => {
        if (activeKeywordFilter === "all") return strategicKeywords;
        return strategicKeywords.filter(k => k.type === activeKeywordFilter);
    };

    const getScoreChangeIcon = (expectedBoost: number) => {
        if (expectedBoost > 20) return <ArrowUp className="h-4 w-4 text-green-500" />;
        if (expectedBoost > 10) return <ArrowUp className="h-4 w-4 text-yellow-500" />;
        return <Minus className="h-4 w-4 text-gray-500" />;
    };

    return (
        <div className="space-y-6">
            {/* Status Atual */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Target className="h-5 w-5" />
                        Campo Modelo Atual
                    </CardTitle>
                    <CardDescription>
                        Análise do campo modelo atual e oportunidades de otimização
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                        <div className="flex-1">
                            <p className="font-medium">
                                {currentModel || "⚠️ Campo modelo não preenchido"}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                {currentModel ? `${currentModel.length} caracteres` : "Oportunidade perdida de ranking"}
                            </p>
                        </div>
                        <div className="text-center">
                            <div className={`text-2xl font-bold ${currentScore >= 60 ? 'text-green-600' : currentScore >= 30 ? 'text-yellow-600' : 'text-red-600'}`}>
                                {currentScore}
                            </div>
                            <div className="text-xs text-muted-foreground">/ 100</div>
                        </div>
                    </div>

                    {!currentModel && (
                        <Alert>
                            <Lightbulb className="h-4 w-4" />
                            <AlertDescription>
                                <strong>Oportunidade Crítica:</strong> Produtos sem campo modelo perdem até 40% de visibilidade orgânica. 
                                Use as estratégias abaixo para otimizar agora!
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>

            {/* Tabs Principal */}
            <Tabs defaultValue="keywords" className="space-y-4">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="keywords">100 Palavras</TabsTrigger>
                    <TabsTrigger value="models">Modelos Prontos</TabsTrigger>
                    <TabsTrigger value="builder">Construtor</TabsTrigger>
                    <TabsTrigger value="insights">Insights</TabsTrigger>
                </TabsList>

                {/* Tab: 100 Palavras Estratégicas */}
                <TabsContent value="keywords" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>100 Palavras Estratégicas</CardTitle>
                            <CardDescription>
                                Palavras otimizadas por IA baseadas em tendências, comportamento e conversão
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Filtros */}
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    variant={activeKeywordFilter === "all" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setActiveKeywordFilter("all")}
                                >
                                    Todas ({strategicKeywords.length})
                                </Button>
                                <Button
                                    variant={activeKeywordFilter === "trend" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setActiveKeywordFilter("trend")}
                                >
                                    <TrendingUp className="h-4 w-4 mr-1" />
                                    Tendência ({strategicKeywords.filter(k => k.type === 'trend').length})
                                </Button>
                                <Button
                                    variant={activeKeywordFilter === "purchase" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setActiveKeywordFilter("purchase")}
                                >
                                    <ShoppingCart className="h-4 w-4 mr-1" />
                                    Compra ({strategicKeywords.filter(k => k.type === 'purchase').length})
                                </Button>
                                <Button
                                    variant={activeKeywordFilter === "emotional" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setActiveKeywordFilter("emotional")}
                                >
                                    <Heart className="h-4 w-4 mr-1" />
                                    Emocional ({strategicKeywords.filter(k => k.type === 'emotional').length})
                                </Button>
                            </div>

                            {/* Lista de Keywords */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                                {getFilteredKeywords().slice(0, 50).map((keyword, index) => (
                                    <div
                                        key={`${keyword.keyword}-${index}`}
                                        className={`p-3 border rounded-lg cursor-pointer transition-all hover:shadow-sm ${
                                            selectedKeywords.includes(keyword.keyword) 
                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' 
                                                : 'hover:border-gray-300'
                                        }`}
                                        onClick={() => toggleKeywordSelection(keyword.keyword)}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                {getTypeIcon(keyword.type)}
                                                <span className="font-medium">{keyword.keyword}</span>
                                            </div>
                                            <Badge variant="outline" className={getRelevanceColor(keyword.relevance)}>
                                                {keyword.relevance}
                                            </Badge>
                                        </div>
                                        
                                        <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                                            <div>
                                                <span>Vol: </span>
                                                <span className="font-medium">{keyword.search_volume.toLocaleString()}</span>
                                            </div>
                                            <div>
                                                <span>Comp: </span>
                                                <span className={`font-medium ${getCompetitionColor(keyword.competition_level)}`}>
                                                    {keyword.competition_level}
                                                </span>
                                            </div>
                                            <div>
                                                <span>Boost: </span>
                                                <span className="font-medium">{keyword.ranking_boost}/10</span>
                                            </div>
                                        </div>
                                        
                                        <div className="flex gap-1 mt-2">
                                            <Progress value={keyword.ctr_potential * 10} className="flex-1 h-1" />
                                            <Progress value={keyword.conversion_impact * 10} className="flex-1 h-1" />
                                        </div>
                                        
                                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                            {keyword.usage_recommendation}
                                        </p>
                                    </div>
                                ))}
                            </div>

                            {strategicKeywords.length > 50 && (
                                <div className="text-center">
                                    <Button variant="outline" size="sm">
                                        Ver mais {strategicKeywords.length - 50} palavras
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab: Modelos Otimizados Prontos */}
                <TabsContent value="models" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Trophy className="h-5 w-5 text-yellow-500" />
                                Modelos Otimizados Prontos
                            </CardTitle>
                            <CardDescription>
                                Modelos gerados por IA com diferentes estratégias de otimização
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {optimizedModels.map((model, index) => (
                                <div key={index} className="p-4 border rounded-lg space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="secondary">Score: {model.score}</Badge>
                                            <Badge variant="outline" className="text-green-600">
                                                {getScoreChangeIcon(model.expected_boost)}
                                                +{model.expected_boost}%
                                            </Badge>
                                        </div>
                                        <Button
                                            size="sm"
                                            onClick={() => copyToClipboard(model.model)}
                                            className="gap-1"
                                        >
                                            <Copy className="h-3 w-3" />
                                            Copiar
                                        </Button>
                                    </div>
                                    
                                    <div>
                                        <h4 className="font-medium text-sm text-blue-600 mb-1">
                                            {model.strategy}
                                        </h4>
                                        <p className="font-mono text-lg p-2 bg-muted rounded">
                                            {model.model}
                                        </p>
                                    </div>
                                    
                                    <p className="text-sm text-muted-foreground">
                                        {model.reasoning}
                                    </p>
                                    
                                    <div className="flex flex-wrap gap-1">
                                        {model.keywords_used.map(keyword => (
                                            <Badge key={keyword} variant="outline" className="text-xs">
                                                {keyword}
                                            </Badge>
                                        ))}
                                    </div>
                                    
                                    {onModelSelect && (
                                        <Button 
                                            variant="outline" 
                                            size="sm"
                                            onClick={() => onModelSelect(model.model)}
                                            className="w-full"
                                        >
                                            Usar Este Modelo
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab: Construtor Personalizado */}
                <TabsContent value="builder" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Construtor de Modelo Personalizado</CardTitle>
                            <CardDescription>
                                Selecione palavras-chave estratégicas para criar seu modelo personalizado
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex flex-wrap gap-2">
                                {selectedKeywords.map(keyword => (
                                    <Badge 
                                        key={keyword} 
                                        variant="default"
                                        className="cursor-pointer"
                                        onClick={() => toggleKeywordSelection(keyword)}
                                    >
                                        {keyword} ✕
                                    </Badge>
                                ))}
                            </div>

                            <div className="flex gap-2">
                                <Button 
                                    onClick={generateCustomModel}
                                    disabled={selectedKeywords.length === 0}
                                >
                                    <Zap className="h-4 w-4 mr-1" />
                                    Gerar Modelo
                                </Button>
                                <Button 
                                    variant="outline"
                                    onClick={() => setSelectedKeywords([])}
                                >
                                    Limpar
                                </Button>
                            </div>

                            {customModel && (
                                <div className="p-4 border rounded-lg">
                                    <h4 className="font-medium mb-2">Modelo Gerado:</h4>
                                    <div className="flex items-center gap-2">
                                        <Input 
                                            value={customModel} 
                                            onChange={(e) => setCustomModel(e.target.value)}
                                            className="flex-1"
                                        />
                                        <Button 
                                            size="sm"
                                            onClick={() => copyToClipboard(customModel)}
                                        >
                                            <Copy className="h-3 w-3" />
                                        </Button>
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-2">
                                        {customModel.length} caracteres • {selectedKeywords.length} palavras-chave
                                    </p>
                                </div>
                            )}

                            <Alert>
                                <Lightbulb className="h-4 w-4" />
                                <AlertDescription>
                                    <strong>Dica:</strong> Combine 2-4 palavras de tipos diferentes para máxima efetividade. 
                                    Trends + Purchase = ótima combinação!
                                </AlertDescription>
                            </Alert>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab: Insights da Categoria */}
                <TabsContent value="insights" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>{categoryInsights.category_name}</CardTitle>
                                <CardDescription>Insights específicos da categoria</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <h4 className="font-medium mb-2 flex items-center gap-1">
                                        <TrendingUp className="h-4 w-4 text-green-500" />
                                        Em Tendência
                                    </h4>
                                    <div className="flex flex-wrap gap-1">
                                        {categoryInsights.trending_terms.map(term => (
                                            <Badge key={term} variant="outline" className="text-green-600 border-green-200">
                                                {term}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <h4 className="font-medium mb-2 flex items-center gap-1">
                                        <ShoppingCart className="h-4 w-4 text-orange-500" />
                                        Alta Conversão
                                    </h4>
                                    <div className="flex flex-wrap gap-1">
                                        {categoryInsights.high_conversion_words.map(term => (
                                            <Badge key={term} variant="outline" className="text-orange-600 border-orange-200">
                                                {term}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <h4 className="font-medium mb-2 flex items-center gap-1">
                                        <Heart className="h-4 w-4 text-pink-500" />
                                        Sazonais
                                    </h4>
                                    <div className="flex flex-wrap gap-1">
                                        {categoryInsights.seasonal_keywords.map(term => (
                                            <Badge key={term} variant="outline" className="text-pink-600 border-pink-200">
                                                {term}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Estratégias Recomendadas</CardTitle>
                                <CardDescription>Baseadas na análise da categoria</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <Alert>
                                    <Target className="h-4 w-4" />
                                    <AlertDescription>
                                        <strong>Foco Principal:</strong> Use palavras de tendência no início do modelo para máximo impacto no ranking.
                                    </AlertDescription>
                                </Alert>

                                <Alert>
                                    <ShoppingCart className="h-4 w-4" />
                                    <AlertDescription>
                                        <strong>Conversão:</strong> Inclua pelo menos uma palavra de alta conversão para melhorar vendas.
                                    </AlertDescription>
                                </Alert>

                                <Alert>
                                    <RefreshCw className="h-4 w-4" />
                                    <AlertDescription>
                                        <strong>Sazonal:</strong> Atualize conforme época do ano para aproveitar picos de busca.
                                    </AlertDescription>
                                </Alert>

                                {onRefreshStrategy && (
                                    <Button onClick={onRefreshStrategy} className="w-full gap-2">
                                        <RefreshCw className="h-4 w-4" />
                                        Atualizar Estratégia
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}