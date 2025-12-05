import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { 
    AlertTriangle, 
    XCircle, 
    CheckCircle, 
    Info, 
    Zap,
    Target,
    Image,
    FileText,
    Tag,
    TrendingUp,
    ShoppingCart,
    Clock,
    Settings,
    Video,
    Package
} from "lucide-react";

interface SmartAlert {
    id: string;
    type: 'critical' | 'warning' | 'info' | 'success' | 'opportunity';
    category: 'seo' | 'content' | 'images' | 'technical' | 'competition' | 'performance';
    title: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
    effort: 'easy' | 'medium' | 'hard';
    potential_boost: number;
    actionable_steps: string[];
    context_data?: any;
    auto_fixable?: boolean;
    deadline?: string;
    related_alerts?: string[];
}

interface SmartAlertsProps {
    analysisData: {
        quality_score: {
            overall_score: number;
            breakdown: any;
            alerts: Array<{
                type: string;
                message: string;
                priority: string;
                action?: string;
            }>;
        };
        technical_analysis: {
            total_attributes: number;
            filled_attributes: number;
            missing_important: string[];
            completion_percentage: number;
        };
        image_analysis: {
            total_images: number;
            has_video: boolean;
            high_quality_images: number;
        };
        keyword_analysis: {
            keyword_density: number;
            missing_keywords: string[];
            primary_keywords: string[];
        };
        title_optimization: {
            current_score: number;
            weaknesses: string[];
        };
        organic_delivery_prediction: {
            ranking_potential: number;
            optimization_level: string;
        };
    };
    productData: {
        title: string;
        status: string;
        sold_quantity: number;
        category_id: string;
    };
}

export function SmartAlerts({ analysisData, productData }: SmartAlertsProps) {
    const [selectedCategory, setSelectedCategory] = useState<string>("all");
    const [showResolvedAlerts, setShowResolvedAlerts] = useState(false);

    // Gerar alertas inteligentes baseados nos dados
    const generateSmartAlerts = (): SmartAlert[] => {
        const alerts: SmartAlert[] = [];

        // 1. ALERTAS CRÍTICOS
        if (!analysisData.image_analysis.has_video) {
            alerts.push({
                id: 'no-video',
                type: 'critical',
                category: 'content',
                title: 'Sem Vídeos/Clips',
                description: 'Produtos com vídeos têm 80% mais conversão. Você está perdendo vendas sem clips.',
                impact: 'high',
                effort: 'medium',
                potential_boost: 35,
                actionable_steps: [
                    'Grave um vídeo curto (15-30s) mostrando o produto',
                    'Mostre detalhes, texturas e uso prático',
                    'Use boa iluminação e estabilização',
                    'Adicione via painel do vendedor ML'
                ],
                auto_fixable: false,
                deadline: '7 dias'
            });
        }

        if (analysisData.title_optimization.current_score < 40) {
            alerts.push({
                id: 'title-critical',
                type: 'critical',
                category: 'seo',
                title: 'Título Crítico para SEO',
                description: `Score do título: ${analysisData.title_optimization.current_score}/100. Títulos ruins podem reduzir visibilidade em até 60%.`,
                impact: 'high',
                effort: 'easy',
                potential_boost: 45,
                actionable_steps: [
                    'Use o gerador automático de títulos',
                    'Inclua palavras-chave da categoria',
                    'Mantenha entre 20-60 caracteres',
                    'Inclua marca quando relevante'
                ],
                auto_fixable: true,
                deadline: '24 horas'
            });
        }

        if (analysisData.technical_analysis.completion_percentage < 50) {
            alerts.push({
                id: 'technical-incomplete',
                type: 'critical',
                category: 'technical',
                title: 'Ficha Técnica Incompleta',
                description: `Apenas ${analysisData.technical_analysis.completion_percentage}% preenchida. Isso afeta seriamente o ranking.`,
                impact: 'high',
                effort: 'easy',
                potential_boost: 25,
                actionable_steps: [
                    'Preencha atributos obrigatórios: marca, modelo, cor',
                    'Complete dimensões e peso se aplicável',
                    'Adicione material e características especiais',
                    'Use o preenchimento automático quando disponível'
                ],
                auto_fixable: true
            });
        }

        // 2. ALERTAS DE WARNING
        if (analysisData.image_analysis.total_images < 5) {
            alerts.push({
                id: 'few-images',
                type: 'warning',
                category: 'images',
                title: 'Poucas Imagens',
                description: `Apenas ${analysisData.image_analysis.total_images} imagens. Produtos com 8+ imagens vendem 40% mais.`,
                impact: 'medium',
                effort: 'medium',
                potential_boost: 20,
                actionable_steps: [
                    'Adicione mais ângulos do produto',
                    'Mostre detalhes importantes',
                    'Inclua fotos de uso/contextualização',
                    'Use fundo neutro e boa iluminação'
                ]
            });
        }

        if (analysisData.keyword_analysis.keyword_density < 3) {
            alerts.push({
                id: 'low-keyword-density',
                type: 'warning',
                category: 'seo',
                title: 'Baixa Densidade de Keywords',
                description: `Densidade: ${analysisData.keyword_analysis.keyword_density.toFixed(1)}%. Ideal: 5-8%.`,
                impact: 'medium',
                effort: 'easy',
                potential_boost: 18,
                actionable_steps: [
                    'Adicione palavras-chave no campo modelo',
                    'Otimize a descrição com termos relevantes',
                    'Use sinônimos da categoria',
                    'Inclua termos de busca populares'
                ]
            });
        }

        if (productData.sold_quantity === 0) {
            alerts.push({
                id: 'no-sales',
                type: 'warning',
                category: 'performance',
                title: 'Produto sem Vendas',
                description: 'Produto sem histórico de vendas pode ter menor relevância no algoritmo.',
                impact: 'medium',
                effort: 'hard',
                potential_boost: 30,
                actionable_steps: [
                    'Considere estratégia de preço inicial atrativo',
                    'Ative anúncios patrocinados para gerar tração',
                    'Otimize título e imagens para melhor CTR',
                    'Monitore concorrência direta'
                ]
            });
        }

        // 3. ALERTAS INFORMATIVOS
        if (analysisData.organic_delivery_prediction.ranking_potential < 70) {
            alerts.push({
                id: 'ranking-potential',
                type: 'info',
                category: 'performance',
                title: 'Potencial de Ranking Médio',
                description: `Potencial atual: ${analysisData.organic_delivery_prediction.ranking_potential}%. Há espaço para melhoria.`,
                impact: 'medium',
                effort: 'medium',
                potential_boost: 22,
                actionable_steps: [
                    'Implemente todas as sugestões de alta prioridade',
                    'Monitore concorrentes diretos',
                    'Otimize baseado nas tendências da categoria',
                    'Acompanhe métricas semanalmente'
                ]
            });
        }

        // 4. ALERTAS DE OPORTUNIDADE
        if (analysisData.keyword_analysis.missing_keywords.length > 5) {
            alerts.push({
                id: 'missing-keywords',
                type: 'opportunity',
                category: 'seo',
                title: 'Palavras-chave Não Exploradas',
                description: `${analysisData.keyword_analysis.missing_keywords.length} palavras-chave importantes não estão sendo usadas.`,
                impact: 'high',
                effort: 'easy',
                potential_boost: 28,
                actionable_steps: [
                    'Adicione as palavras-chave sugeridas no modelo',
                    'Inclua termos na descrição de forma natural',
                    'Use variações e sinônimos',
                    'Monitore performance após implementação'
                ],
                context_data: {
                    missing_count: analysisData.keyword_analysis.missing_keywords.length,
                    top_missing: analysisData.keyword_analysis.missing_keywords.slice(0, 5)
                }
            });
        }

        if (analysisData.quality_score.overall_score >= 80) {
            alerts.push({
                id: 'high-quality',
                type: 'success',
                category: 'performance',
                title: 'Produto Bem Otimizado',
                description: `Score excelente: ${analysisData.quality_score.overall_score}/100. Continue monitorando para manter performance.`,
                impact: 'low',
                effort: 'easy',
                potential_boost: 5,
                actionable_steps: [
                    'Monitore posição nos resultados de busca',
                    'Acompanhe métricas de conversão',
                    'Mantenha-se atualizado com tendências',
                    'Considere testes A/B com variações'
                ]
            });
        }

        return alerts.sort((a, b) => {
            const typeOrder = { critical: 4, warning: 3, opportunity: 2, info: 1, success: 0 };
            const impactOrder = { high: 3, medium: 2, low: 1 };
            
            const aScore = (typeOrder[a.type] || 0) * 10 + (impactOrder[a.impact] || 0);
            const bScore = (typeOrder[b.type] || 0) * 10 + (impactOrder[b.impact] || 0);
            
            return bScore - aScore;
        });
    };

    const alerts = generateSmartAlerts();

    const getAlertIcon = (type: string) => {
        switch (type) {
            case 'critical': return <XCircle className="h-5 w-5 text-red-500" />;
            case 'warning': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
            case 'opportunity': return <Zap className="h-5 w-5 text-blue-500" />;
            case 'success': return <CheckCircle className="h-5 w-5 text-green-500" />;
            default: return <Info className="h-5 w-5 text-gray-500" />;
        }
    };

    const getCategoryIcon = (category: string) => {
        switch (category) {
            case 'seo': return <Target className="h-4 w-4" />;
            case 'content': return <FileText className="h-4 w-4" />;
            case 'images': return <Image className="h-4 w-4" />;
            case 'technical': return <Settings className="h-4 w-4" />;
            case 'competition': return <TrendingUp className="h-4 w-4" />;
            case 'performance': return <ShoppingCart className="h-4 w-4" />;
            default: return <Package className="h-4 w-4" />;
        }
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'critical': return 'border-red-500 bg-red-50 dark:bg-red-950/20';
            case 'warning': return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20';
            case 'opportunity': return 'border-blue-500 bg-blue-50 dark:bg-blue-950/20';
            case 'success': return 'border-green-500 bg-green-50 dark:bg-green-950/20';
            default: return 'border-gray-300 bg-gray-50 dark:bg-gray-950/20';
        }
    };

    const getEffortBadge = (effort: string) => {
        switch (effort) {
            case 'easy': return <Badge variant="outline" className="text-green-600 border-green-300">⚡ Fácil</Badge>;
            case 'medium': return <Badge variant="outline" className="text-yellow-600 border-yellow-300">🛠️ Médio</Badge>;
            case 'hard': return <Badge variant="outline" className="text-red-600 border-red-300">🚀 Difícil</Badge>;
            default: return <Badge variant="outline">❓</Badge>;
        }
    };

    const filteredAlerts = selectedCategory === "all" 
        ? alerts 
        : alerts.filter(alert => alert.category === selectedCategory);

    const criticalCount = alerts.filter(a => a.type === 'critical').length;
    const warningCount = alerts.filter(a => a.type === 'warning').length;
    const opportunityCount = alerts.filter(a => a.type === 'opportunity').length;

    return (
        <div className="space-y-6">
            {/* Header com Resumo */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-orange-500" />
                        Alertas Inteligentes
                    </CardTitle>
                    <CardDescription>
                        Análise contextual com ações prioritárias para otimização
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center">
                            <div className="text-2xl font-bold text-red-600">{criticalCount}</div>
                            <div className="text-sm text-muted-foreground">Críticos</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-yellow-600">{warningCount}</div>
                            <div className="text-sm text-muted-foreground">Avisos</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-blue-600">{opportunityCount}</div>
                            <div className="text-sm text-muted-foreground">Oportunidades</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-green-600">
                                {alerts.reduce((sum, alert) => sum + alert.potential_boost, 0)}%
                            </div>
                            <div className="text-sm text-muted-foreground">Boost Total</div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Filtros */}
            <div className="flex flex-wrap gap-2">
                <Button
                    variant={selectedCategory === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory("all")}
                >
                    Todos ({alerts.length})
                </Button>
                <Button
                    variant={selectedCategory === "seo" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory("seo")}
                >
                    <Target className="h-4 w-4 mr-1" />
                    SEO
                </Button>
                <Button
                    variant={selectedCategory === "content" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory("content")}
                >
                    <FileText className="h-4 w-4 mr-1" />
                    Conteúdo
                </Button>
                <Button
                    variant={selectedCategory === "images" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory("images")}
                >
                    <Image className="h-4 w-4 mr-1" />
                    Imagens
                </Button>
                <Button
                    variant={selectedCategory === "technical" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory("technical")}
                >
                    <Settings className="h-4 w-4 mr-1" />
                    Técnico
                </Button>
            </div>

            {/* Lista de Alertas */}
            <div className="space-y-4">
                {filteredAlerts.map((alert) => (
                    <Card key={alert.id} className={`border-2 ${getTypeColor(alert.type)}`}>
                        <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    {getAlertIcon(alert.type)}
                                    <div>
                                        <CardTitle className="text-lg">{alert.title}</CardTitle>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Badge variant="secondary" className="flex items-center gap-1">
                                                {getCategoryIcon(alert.category)}
                                                {alert.category}
                                            </Badge>
                                            {getEffortBadge(alert.effort)}
                                            <Badge variant="outline" className="text-green-600">
                                                +{alert.potential_boost}% boost
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                                {alert.deadline && (
                                    <div className="text-right">
                                        <Clock className="h-4 w-4 text-orange-500 mx-auto" />
                                        <div className="text-xs text-muted-foreground">{alert.deadline}</div>
                                    </div>
                                )}
                            </div>
                        </CardHeader>
                        
                        <CardContent className="space-y-4">
                            <p className="text-muted-foreground">{alert.description}</p>
                            
                            {alert.context_data?.missing_count && (
                                <div className="p-3 bg-muted rounded-lg">
                                    <p className="text-sm font-medium mb-2">
                                        Top {alert.context_data.top_missing.length} palavras em falta:
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                        {alert.context_data.top_missing.map((keyword: string) => (
                                            <Badge key={keyword} variant="outline" className="text-red-600">
                                                {keyword}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                            
                            <div>
                                <h4 className="font-medium mb-2">Passos para Resolver:</h4>
                                <div className="space-y-1">
                                    {alert.actionable_steps.map((step, index) => (
                                        <div key={index} className="flex items-start gap-2 text-sm">
                                            <div className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-medium mt-0.5">
                                                {index + 1}
                                            </div>
                                            <span className="text-muted-foreground">{step}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-sm">
                                    <span>Impacto:</span>
                                    <Progress 
                                        value={alert.impact === 'high' ? 100 : alert.impact === 'medium' ? 60 : 30} 
                                        className="w-16 h-2" 
                                    />
                                    <span className="text-muted-foreground">{alert.impact}</span>
                                </div>
                                
                                <div className="flex gap-2">
                                    {alert.auto_fixable && (
                                        <Button size="sm" className="gap-1">
                                            <Zap className="h-3 w-3" />
                                            Auto-corrigir
                                        </Button>
                                    )}
                                    <Button variant="outline" size="sm">
                                        Marcar como Resolvido
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {filteredAlerts.length === 0 && (
                <Card className="text-center py-8">
                    <CardContent>
                        <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                        <h3 className="text-lg font-semibold">Nenhum alerta na categoria selecionada</h3>
                        <p className="text-muted-foreground">Selecione outra categoria ou visualize todos os alertas</p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}