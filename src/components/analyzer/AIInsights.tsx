import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
    Brain, 
    Zap, 
    TrendingUp, 
    Target, 
    CheckCircle, 
    AlertTriangle, 
    Info, 
    ArrowRight,
    Lightbulb,
    BarChart3,
    DollarSign,
    Users,
    Settings,
    Clock,
    Trophy
} from "lucide-react";

export interface AISuggestion {
    id: string;
    type: 'seo' | 'sales' | 'competitive' | 'technical';
    category: string;
    title: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
    difficulty: 'easy' | 'medium' | 'hard';
    estimated_score_boost: number;
    estimated_conversion_boost?: number;
    action_data?: {
        field: string;
        current_value?: string;
        suggested_value?: string;
        attribute_id?: string;
    };
    reasoning: string;
    competitor_insight?: string;
    roi_score: number;
    quick_apply: boolean;
}

export interface AIOpportunityAnalysis {
    overall_opportunity_score: number;
    total_suggestions: number;
    high_impact_count: number;
    quick_wins_available: number;
    competitive_gap_score: number;
    seo_optimization_potential: number;
    sales_optimization_potential: number;
    estimated_total_boost: number;
    suggestions: AISuggestion[];
}

interface AIInsightsProps {
    analysisData: any; // MLBAnalysisResult
    onApplySuggestion: (suggestion: AISuggestion) => void;
    onApplyMultiple: (suggestions: AISuggestion[]) => void;
}

export function AIInsights({ analysisData, onApplySuggestion, onApplyMultiple }: AIInsightsProps) {
    const [aiAnalysis, setAIAnalysis] = useState<AIOpportunityAnalysis | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(true);
    const [selectedSuggestions, setSelectedSuggestions] = useState<string[]>([]);
    const [activeFilter, setActiveFilter] = useState<'all' | 'high' | 'quick' | 'seo' | 'sales'>('all');

    useEffect(() => {
        generateAIAnalysis();
    }, [analysisData]); // eslint-disable-line react-hooks/exhaustive-deps

    const generateAIAnalysis = async () => {
        setIsAnalyzing(true);
        setAIAnalysis(null); // Limpar análise anterior

        try {
            // Chamar API real do GPT-4
            const response = await fetch('/api/integrations/ai-analysis', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    mlbId: analysisData.mlb_id,
                    analysisData: analysisData,
                    workspaceId: '00000000-0000-0000-0000-000000000010' // TODO: Get from context
                })
            });

            const aiResponse = await response.json();

            if (!response.ok || !aiResponse.success) {
                // Lançar erro com detalhes completos
                const error: any = new Error(aiResponse.error || 'Erro na análise IA');
                error.details = aiResponse.details;
                error.error_code = aiResponse.error_code;
                error.actions = aiResponse.actions || [];
                throw error;
            }

            // Converter para formato esperado pelo componente
            const analysisResult: AIOpportunityAnalysis = {
                overall_opportunity_score: aiResponse.overall_opportunity_score,
                total_suggestions: aiResponse.total_suggestions,
                high_impact_count: aiResponse.high_impact_count,
                quick_wins_available: aiResponse.quick_wins_available,
                competitive_gap_score: aiResponse.competitive_gap_score,
                seo_optimization_potential: aiResponse.seo_optimization_potential,
                sales_optimization_potential: aiResponse.sales_optimization_potential,
                estimated_total_boost: aiResponse.estimated_total_boost,
                suggestions: aiResponse.suggestions
            };

            setAIAnalysis(analysisResult);

            console.log(`✅ Análise IA concluída em ${aiResponse.processing_time_ms}ms:`, aiResponse.ai_insights);

        } catch (error: any) {
            console.error('❌ Erro na análise IA:', error);

            // NÃO usar fallback - deixar aiAnalysis como null
            // O componente vai renderizar a tela de erro com detalhes
            setAIAnalysis(null);

            // Armazenar detalhes do erro para exibição
            (window as any).__aiAnalysisError = {
                message: error.message || 'Erro desconhecido',
                details: error.details || 'Não foi possível conectar com o serviço de IA',
                error_code: error.error_code || 'UNKNOWN_ERROR',
                actions: error.actions || [
                    'Verifique sua conexão com a internet',
                    'Tente novamente em alguns instantes'
                ]
            };
        } finally {
            setIsAnalyzing(false);
        }
    };

    const getImpactColor = (impact: string) => {
        switch (impact) {
            case 'high': return 'bg-red-100 text-red-800 border-red-200';
            case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'low': return 'bg-green-100 text-green-800 border-green-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const getDifficultyColor = (difficulty: string) => {
        switch (difficulty) {
            case 'easy': return 'text-green-600';
            case 'medium': return 'text-yellow-600';
            case 'hard': return 'text-red-600';
            default: return 'text-gray-600';
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'seo': return <BarChart3 className="w-4 h-4" />;
            case 'sales': return <DollarSign className="w-4 h-4" />;
            case 'competitive': return <Users className="w-4 h-4" />;
            case 'technical': return <Settings className="w-4 h-4" />;
            default: return <Lightbulb className="w-4 h-4" />;
        }
    };

    const filteredSuggestions = aiAnalysis?.suggestions.filter(suggestion => {
        switch (activeFilter) {
            case 'high': return suggestion.impact === 'high';
            case 'quick': return suggestion.quick_apply;
            case 'seo': return suggestion.type === 'seo';
            case 'sales': return suggestion.type === 'sales';
            default: return true;
        }
    }) || [];

    const toggleSuggestionSelection = (suggestionId: string) => {
        setSelectedSuggestions(prev => 
            prev.includes(suggestionId) 
                ? prev.filter(id => id !== suggestionId)
                : [...prev, suggestionId]
        );
    };

    const applySelectedSuggestions = () => {
        if (!aiAnalysis) return;
        const suggestions = aiAnalysis.suggestions.filter(s => selectedSuggestions.includes(s.id));
        onApplyMultiple(suggestions);
        setSelectedSuggestions([]);
    };

    if (isAnalyzing) {
        return (
            <div className="space-y-6">
                <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
                    <CardContent className="p-8 text-center">
                        <div className="space-y-4">
                            <div className="w-16 h-16 mx-auto bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                                <Brain className="w-8 h-8 text-blue-600 animate-pulse" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-blue-800 dark:text-blue-200">🛡️ Especialista ML Analisando</h3>
                                <p className="text-blue-600 dark:text-blue-300 mt-2">
                                    Análise profissional de compliance, SEO e conversão por especialista sênior IA...
                                </p>
                            </div>
                            <Progress value={75} className="w-full max-w-md mx-auto" />
                            <p className="text-xs text-blue-500">🔍 Verificando regras ML, SEO interno, veracidade técnica e otimização de conversão</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!aiAnalysis) {
        // Buscar detalhes do erro armazenados
        const errorDetails = (window as any).__aiAnalysisError || {
            message: 'Erro desconhecido',
            details: 'Não foi possível gerar análise de IA',
            error_code: 'UNKNOWN_ERROR',
            actions: ['Tente novamente']
        };

        return (
            <div className="space-y-6">
                <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
                    <CardContent className="p-8">
                        <div className="space-y-4">
                            <div className="w-16 h-16 mx-auto bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
                                <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
                            </div>

                            <div className="text-center">
                                <h3 className="text-xl font-bold text-red-800 dark:text-red-200 mb-2">
                                    {errorDetails.message}
                                </h3>
                                <p className="text-red-600 dark:text-red-300 mb-4">
                                    {errorDetails.details}
                                </p>

                                {errorDetails.error_code && (
                                    <Badge variant="outline" className="text-red-600 border-red-300 mb-4">
                                        Código: {errorDetails.error_code}
                                    </Badge>
                                )}
                            </div>

                            {errorDetails.actions && errorDetails.actions.length > 0 && (
                                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-red-200">
                                    <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                                        <Info className="w-4 h-4" />
                                        Como resolver:
                                    </h4>
                                    <ul className="space-y-2">
                                        {errorDetails.actions.map((action: string, index: number) => (
                                            <li key={index} className="text-sm text-gray-600 dark:text-gray-300 flex items-start gap-2">
                                                <span className="text-red-500 font-bold">•</span>
                                                <span>{action}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div className="flex justify-center gap-3">
                                <Button
                                    onClick={() => generateAIAnalysis()}
                                    variant="default"
                                    className="bg-red-600 hover:bg-red-700"
                                >
                                    Tentar Novamente
                                </Button>
                            </div>

                            {/* Links úteis baseado no tipo de erro */}
                            {errorDetails.error_code === 'INSUFFICIENT_QUOTA' && (
                                <div className="text-center text-sm text-gray-500">
                                    <a
                                        href="https://platform.openai.com/account/billing"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:underline"
                                    >
                                        Adicionar créditos OpenAI →
                                    </a>
                                </div>
                            )}
                            {errorDetails.error_code === 'INVALID_API_KEY' && (
                                <div className="text-center text-sm text-gray-500">
                                    <a
                                        href="https://platform.openai.com/api-keys"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:underline"
                                    >
                                        Obter chave de API →
                                    </a>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header de Oportunidades */}
            <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl text-purple-800 dark:text-purple-200 flex items-center justify-center gap-3">
                        <Brain className="w-8 h-8" />
                        🛡️ Análise Especialista Concluída
                    </CardTitle>
                    <CardDescription className="text-purple-600 dark:text-purple-300">
                        Análise profissional focada em compliance ML, SEO interno, veracidade técnica e alta conversão
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-lg border">
                            <div className="text-3xl font-bold text-purple-600 mb-1">{aiAnalysis.overall_opportunity_score}</div>
                            <div className="text-sm text-gray-600">Score de Oportunidade</div>
                            <Progress value={aiAnalysis.overall_opportunity_score} className="mt-2" />
                        </div>
                        <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-lg border">
                            <div className="text-3xl font-bold text-red-600 mb-1">{aiAnalysis.high_impact_count}</div>
                            <div className="text-sm text-gray-600">Alto Impacto</div>
                            <div className="text-xs text-gray-500 mt-1">de {aiAnalysis.total_suggestions} sugestões</div>
                        </div>
                        <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-lg border">
                            <div className="text-3xl font-bold text-green-600 mb-1">{aiAnalysis.quick_wins_available}</div>
                            <div className="text-sm text-gray-600">Quick Wins</div>
                            <div className="text-xs text-gray-500 mt-1">aplicação fácil</div>
                        </div>
                        <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-lg border">
                            <div className="text-3xl font-bold text-blue-600 mb-1">+{aiAnalysis.estimated_total_boost}</div>
                            <div className="text-sm text-gray-600">Score Potencial</div>
                            <div className="text-xs text-gray-500 mt-1">pontos de melhoria</div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Filtros e Ações */}
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Target className="w-5 h-5" />
                                Sugestões Priorizadas ({filteredSuggestions.length})
                            </CardTitle>
                            <CardDescription>
                                Ordenadas por ROI e facilidade de implementação
                            </CardDescription>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button 
                                variant={activeFilter === 'all' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setActiveFilter('all')}
                            >
                                Todas ({aiAnalysis.total_suggestions})
                            </Button>
                            <Button 
                                variant={activeFilter === 'high' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setActiveFilter('high')}
                            >
                                Alto Impacto ({aiAnalysis.high_impact_count})
                            </Button>
                            <Button 
                                variant={activeFilter === 'quick' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setActiveFilter('quick')}
                            >
                                Quick Wins ({aiAnalysis.quick_wins_available})
                            </Button>
                            <Button 
                                variant={activeFilter === 'seo' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setActiveFilter('seo')}
                            >
                                SEO
                            </Button>
                            <Button 
                                variant={activeFilter === 'sales' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setActiveFilter('sales')}
                            >
                                Vendas
                            </Button>
                        </div>
                    </div>
                    
                    {selectedSuggestions.length > 0 && (
                        <div className="flex items-center gap-4 mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex-1">
                                <div className="font-medium">{selectedSuggestions.length} sugestões selecionadas</div>
                                <div className="text-sm text-gray-600">
                                    Boost estimado: +{aiAnalysis.suggestions
                                        .filter(s => selectedSuggestions.includes(s.id))
                                        .reduce((sum, s) => sum + s.estimated_score_boost, 0)} pontos
                                </div>
                            </div>
                            <Button onClick={applySelectedSuggestions} className="bg-blue-600 hover:bg-blue-700">
                                <Zap className="w-4 h-4 mr-2" />
                                Aplicar Selecionadas
                            </Button>
                            <Button variant="outline" onClick={() => setSelectedSuggestions([])}>
                                Limpar
                            </Button>
                        </div>
                    )}
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {filteredSuggestions.map((suggestion, index) => (
                            <div 
                                key={suggestion.id}
                                className={`p-5 border-2 rounded-lg transition-all hover:shadow-md ${
                                    selectedSuggestions.includes(suggestion.id) 
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' 
                                        : 'border-gray-200 hover:border-gray-300'
                                }`}
                            >
                                <div className="flex items-start gap-4">
                                    {/* Checkbox */}
                                    <div className="flex-shrink-0 mt-1">
                                        <input
                                            type="checkbox"
                                            checked={selectedSuggestions.includes(suggestion.id)}
                                            onChange={() => toggleSuggestionSelection(suggestion.id)}
                                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                        />
                                    </div>

                                    {/* Ranking */}
                                    <div className="flex-shrink-0 w-8 h-8 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-full flex items-center justify-center text-sm font-bold">
                                        #{index + 1}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2 mb-2">
                                            <div className="flex items-center gap-1">
                                                {getTypeIcon(suggestion.type)}
                                                <Badge variant="outline">{suggestion.category}</Badge>
                                            </div>
                                            <Badge className={getImpactColor(suggestion.impact)}>
                                                {suggestion.impact.toUpperCase()}
                                            </Badge>
                                            <span className={`text-sm font-medium ${getDifficultyColor(suggestion.difficulty)}`}>
                                                {suggestion.difficulty === 'easy' && <Clock className="w-3 h-3 inline mr-1" />}
                                                {suggestion.difficulty}
                                            </span>
                                            <div className="text-sm font-medium text-purple-600">
                                                ROI: {suggestion.roi_score}/100
                                            </div>
                                            {suggestion.quick_apply && (
                                                <Badge variant="outline" className="text-green-600 border-green-300">
                                                    <Zap className="w-3 h-3 mr-1" />
                                                    Quick Apply
                                                </Badge>
                                            )}
                                        </div>

                                        <h4 className="font-bold text-lg mb-1">{suggestion.title}</h4>
                                        <p className="text-gray-600 dark:text-gray-300 mb-2">{suggestion.description}</p>
                                        
                                        <div className="text-sm text-gray-500 mb-3">
                                            <div className="flex items-center gap-4">
                                                {suggestion.estimated_score_boost > 0 && (
                                                    <span className="flex items-center gap-1">
                                                        <TrendingUp className="w-3 h-3" />
                                                        +{suggestion.estimated_score_boost} pontos SEO
                                                    </span>
                                                )}
                                                {suggestion.estimated_conversion_boost && (
                                                    <span className="flex items-center gap-1">
                                                        <DollarSign className="w-3 h-3" />
                                                        +{suggestion.estimated_conversion_boost}% conversão
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {suggestion.reasoning && (
                                            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded text-sm text-gray-600 dark:text-gray-300 mb-3">
                                                <strong>Por que:</strong> {suggestion.reasoning}
                                            </div>
                                        )}

                                        {suggestion.competitor_insight && (
                                            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded text-sm text-blue-700 dark:text-blue-300 mb-3">
                                                <strong>Insight Competitivo:</strong> {suggestion.competitor_insight}
                                            </div>
                                        )}

                                        {suggestion.action_data && (
                                            <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded text-sm mb-3">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                    {suggestion.action_data.current_value && (
                                                        <div>
                                                            <span className="text-gray-500">Atual:</span> 
                                                            <span className="ml-1 font-mono">
                                                                {typeof suggestion.action_data.current_value === 'string' 
                                                                    ? suggestion.action_data.current_value 
                                                                    : JSON.stringify(suggestion.action_data.current_value)
                                                                }
                                                            </span>
                                                        </div>
                                                    )}
                                                    {suggestion.action_data.suggested_value && (
                                                        <div>
                                                            <span className="text-green-700">Sugerido:</span> 
                                                            <span className="ml-1 font-mono font-bold">
                                                                {typeof suggestion.action_data.suggested_value === 'string' 
                                                                    ? suggestion.action_data.suggested_value 
                                                                    : JSON.stringify(suggestion.action_data.suggested_value)
                                                                }
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Button */}
                                    <div className="flex-shrink-0">
                                        <Button 
                                            onClick={() => onApplySuggestion(suggestion)}
                                            size="sm"
                                            className="bg-green-600 hover:bg-green-700 text-white"
                                        >
                                            <ArrowRight className="w-4 h-4 mr-1" />
                                            Aplicar
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {filteredSuggestions.length === 0 && (
                            <div className="text-center py-12 text-gray-500">
                                <Trophy className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                                <h3 className="text-lg font-medium mb-2">Nenhuma sugestão encontrada</h3>
                                <p className="text-sm">Tente alterar os filtros ou seu anúncio já está muito bem otimizado!</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

// Função para gerar análise inteligente baseada nos dados reais
function generateIntelligentAnalysis(analysisData: any): AIOpportunityAnalysis {
    const currentScore = analysisData?.quality_score?.overall_score || 60;
    const breakdown = analysisData?.quality_score?.breakdown || {};
    const titleScore = breakdown.title_seo || 50;
    const descScore = breakdown.description_quality || 40;
    const techScore = breakdown.technical_sheet || 50;
    const imagesScore = breakdown.images_quality || 50;
    const keywordsScore = breakdown.keywords_density || 50;
    const modelScore = breakdown.model_optimization || 50;
    const competitorCount = analysisData?.competitive_analysis?.top_competitors?.length || 0;
    const productData = analysisData?.product_data || {};
    const attributes = productData.attributes || [];
    const imageAnalysis = analysisData?.image_analysis || {};
    const keywordAnalysis = analysisData?.keyword_analysis || {};

    const suggestions: AISuggestion[] = [];

    // ANÁLISE DE TÍTULO
    if (titleScore < 75) {
        const bestTitle = analysisData?.title_optimization?.suggested_titles?.[0];
        if (bestTitle) {
            suggestions.push({
                id: 'title-opt',
                type: 'seo',
                category: 'Título SEO',
                title: 'Otimizar título para melhor ranking',
                description: `Score atual: ${titleScore}/100. Título otimizado pode aumentar até +${bestTitle.score - titleScore} pontos`,
                impact: titleScore < 50 ? 'high' : 'medium',
                difficulty: 'easy',
                estimated_score_boost: Math.min(25, bestTitle.score - titleScore),
                action_data: {
                    field: 'title',
                    current_value: analysisData?.title_optimization?.current_title,
                    suggested_value: bestTitle.title
                },
                reasoning: `${bestTitle.reasoning}. Keywords adicionadas: ${bestTitle.keywords_added?.join(', ')}`,
                roi_score: 85,
                quick_apply: true
            });
        }
    }

    // ANÁLISE DE DESCRIÇÃO
    if (descScore < 70) {
        suggestions.push({
            id: 'desc-opt',
            type: 'technical',
            category: 'Descrição',
            title: 'Implementar descrição estruturada SEO',
            description: `Score atual: ${descScore}/100. Descrição estruturada pode aumentar conversão em até 40%`,
            impact: 'high',
            difficulty: 'easy',
            estimated_score_boost: Math.min(35, 90 - descScore),
            estimated_conversion_boost: 30,
            action_data: {
                field: 'description',
                suggested_value: analysisData?.seo_description?.optimized_description || 'Descrição SEO otimizada'
            },
            reasoning: 'Descrição com estrutura padronizada (CARACTERÍSTICAS, GARANTIA, ACOMPANHA, ENVIO) melhora confiança do comprador',
            roi_score: 90,
            quick_apply: true
        });
    }

    // ANÁLISE DE MODELO/CAMPO MODELO
    if (modelScore < 70) {
        const currentModel = attributes.find(a => a.id === 'MODEL')?.value_name || '';
        const bestModel = analysisData?.model_optimization?.optimized_models?.[0];
        if (bestModel) {
            suggestions.push({
                id: 'model-opt',
                type: 'technical',
                category: 'Campo Modelo',
                title: 'Otimizar campo modelo com keywords estratégicas',
                description: `Score atual: ${modelScore}/100. Modelo otimizado: "${bestModel.model}"`,
                impact: 'medium',
                difficulty: 'easy',
                estimated_score_boost: Math.min(15, bestModel.score - modelScore),
                action_data: {
                    field: 'model',
                    current_value: currentModel,
                    suggested_value: bestModel.model
                },
                reasoning: `${bestModel.reasoning}. Estratégia: ${bestModel.strategy}`,
                roi_score: 75,
                quick_apply: true
            });
        }
    }

    // ANÁLISE DE IMAGENS
    if (imagesScore < 60) {
        const currentImages = imageAnalysis.total_images || 0;
        const hasVideo = imageAnalysis.has_video || false;
        suggestions.push({
            id: 'images-opt',
            type: 'sales',
            category: 'Imagens',
            title: `Melhorar qualidade e quantidade de imagens`,
            description: `Apenas ${currentImages} imagens. Concorrentes têm média de 8+ imagens${!hasVideo ? ' e vídeos' : ''}`,
            impact: currentImages < 3 ? 'high' : 'medium',
            difficulty: 'medium',
            estimated_score_boost: Math.min(20, (8 - currentImages) * 3),
            estimated_conversion_boost: 15,
            reasoning: `Mais imagens aumentam confiança. ${!hasVideo ? 'Vídeos aumentam conversão em 30%.' : ''}`,
            roi_score: 70,
            quick_apply: false
        });
    }

    // ANÁLISE DE ATRIBUTOS/FICHA TÉCNICA
    const missingImportantAttrs = analysisData?.technical_analysis?.missing_important || [];
    if (missingImportantAttrs.length > 0) {
        missingImportantAttrs.slice(0, 2).forEach((attrName, index) => {
            suggestions.push({
                id: `attr-${attrName.toLowerCase()}`,
                type: 'technical',
                category: 'Atributos',
                title: `Preencher atributo: ${attrName}`,
                description: `Atributo "${attrName}" não preenchido. Presente em 90% dos concorrentes top`,
                impact: 'medium',
                difficulty: 'easy',
                estimated_score_boost: 8,
                action_data: {
                    field: 'attributes',
                    attribute_id: attrName,
                    current_value: '',
                    suggested_value: getSuggestedValueForAttribute(attrName, productData)
                },
                reasoning: 'Atributos completos melhoram relevância nos filtros do ML',
                roi_score: 65,
                quick_apply: true
            });
        });
    }

    // ANÁLISE DE KEYWORDS
    const missingKeywords = keywordAnalysis.missing_keywords || [];
    if (missingKeywords.length > 0) {
        suggestions.push({
            id: 'keywords-missing',
            type: 'seo',
            category: 'Keywords',
            title: `Adicionar ${missingKeywords.length} keywords estratégicas`,
            description: `Keywords em falta: ${missingKeywords.slice(0, 3).join(', ')}${missingKeywords.length > 3 ? '...' : ''}`,
            impact: 'high',
            difficulty: 'medium',
            estimated_score_boost: Math.min(20, missingKeywords.length * 3),
            reasoning: 'Keywords presentes em concorrentes top mas ausentes no seu anúncio',
            competitor_insight: `${missingKeywords.length} keywords encontradas em análise competitiva`,
            roi_score: 80,
            quick_apply: false
        });
    }

    // ANÁLISE DE DENSIDADE DE KEYWORDS
    const keywordDensity = keywordAnalysis.keyword_density || 0;
    if (keywordDensity < 5) {
        suggestions.push({
            id: 'keyword-density',
            type: 'seo',
            category: 'Densidade SEO',
            title: 'Aumentar densidade de palavras-chave',
            description: `Densidade atual: ${keywordDensity.toFixed(1)}% (recomendado: 5-8%)`,
            impact: 'medium',
            difficulty: 'medium',
            estimated_score_boost: 12,
            reasoning: 'Baixa densidade reduz relevância nos algoritmos do ML',
            roi_score: 70,
            quick_apply: false
        });
    }

    // ANÁLISE DE PREÇO (se tiver dados competitivos)
    const priceAnalysis = analysisData?.competitive_analysis?.price_analysis;
    if (priceAnalysis && priceAnalysis.price_position === 'above_average') {
        suggestions.push({
            id: 'price-competitive',
            type: 'sales',
            category: 'Preço Competitivo',
            title: 'Ajustar preço para faixa mais competitiva',
            description: `Preço atual R$ ${priceAnalysis.current_price} está acima da média (R$ ${priceAnalysis.market_average?.toFixed(2)})`,
            impact: 'high',
            difficulty: 'easy',
            estimated_conversion_boost: 25,
            reasoning: 'Preço competitivo aumenta conversão e melhora posicionamento orgânico',
            competitor_insight: `Preço recomendado: R$ ${priceAnalysis.optimal_price_range?.recommended || priceAnalysis.market_average}`,
            roi_score: 85,
            quick_apply: false
        });
    }

    // ANÁLISE DE SHIPPING
    if (!productData.shipping?.free_shipping) {
        suggestions.push({
            id: 'free-shipping',
            type: 'sales',
            category: 'Frete Grátis',
            title: 'Ativar frete grátis',
            description: 'Frete grátis é decisivo para 78% dos compradores no ML',
            impact: 'high',
            difficulty: 'medium',
            estimated_conversion_boost: 35,
            reasoning: 'Frete grátis melhora posicionamento e aumenta conversão significativamente',
            roi_score: 90,
            quick_apply: false
        });
    }

    // Calcular métricas do resumo
    const highImpactCount = suggestions.filter(s => s.impact === 'high').length;
    const quickWinsCount = suggestions.filter(s => s.quick_apply).length;
    const avgROI = suggestions.reduce((sum, s) => sum + s.roi_score, 0) / suggestions.length || 0;

    return {
        overall_opportunity_score: Math.min(95, avgROI + (suggestions.length * 2)),
        total_suggestions: suggestions.length,
        high_impact_count: highImpactCount,
        quick_wins_available: quickWinsCount,
        competitive_gap_score: Math.max(0, 90 - currentScore),
        seo_optimization_potential: Math.max(0, 95 - currentScore),
        sales_optimization_potential: Math.min(50, suggestions.filter(s => s.type === 'sales').length * 15),
        estimated_total_boost: suggestions.reduce((sum, s) => sum + s.estimated_score_boost, 0),
        suggestions
    };
}

// Função auxiliar para sugerir valores de atributos
function getSuggestedValueForAttribute(attrName: string, productData: any): string {
    const defaults: { [key: string]: string } = {
        'BRAND': 'Genérico',
        'COLOR': 'Variado',
        'SIZE': 'Único',
        'MATERIAL': 'Material de qualidade',
        'WEIGHT': 'Leve',
        'DIMENSIONS': 'Compacto',
        'WARRANTY': '30 dias'
    };

    // Tentar extrair do título ou outros atributos
    const title = productData.title?.toLowerCase() || '';
    
    if (attrName === 'COLOR') {
        const colors = ['preto', 'branco', 'cinza', 'azul', 'vermelho', 'verde', 'amarelo', 'rosa'];
        const foundColor = colors.find(color => title.includes(color));
        return foundColor ? foundColor.charAt(0).toUpperCase() + foundColor.slice(1) : 'A definir';
    }

    if (attrName === 'BRAND') {
        // Tentar extrair marca do título ou usar genérico
        return 'Genérico';
    }

    return defaults[attrName] || 'A definir';
}