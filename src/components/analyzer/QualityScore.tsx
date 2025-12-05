import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
    TrendingUp, 
    AlertTriangle, 
    CheckCircle, 
    XCircle,
    Target,
    Zap,
    Trophy
} from "lucide-react";

interface QualityScoreProps {
    score: {
        overall_score: number;
        breakdown: {
            title_seo: number;
            technical_sheet: number;
            images_quality: number;
            keywords_density: number;
            model_optimization: number;
            description_quality: number;
            category_relevance: number;
            pricing_strategy: number;
            shipping_optimization: number;
            variations_usage: number;
        };
        alerts: Array<{
            type: 'warning' | 'error' | 'info' | 'success';
            message: string;
            priority: 'high' | 'medium' | 'low';
            action?: string;
        }>;
        suggestions: Array<{
            category: string;
            title: string;
            description: string;
            impact: 'high' | 'medium' | 'low';
            difficulty: 'easy' | 'medium' | 'hard';
        }>;
    };
}

export function QualityScore({ score }: QualityScoreProps) {
    const getScoreColor = (value: number) => {
        if (value >= 80) return 'text-green-600';
        if (value >= 60) return 'text-yellow-600';
        return 'text-red-600';
    };

    const getScoreBgColor = (value: number) => {
        if (value >= 80) return 'bg-green-100 dark:bg-green-900/20';
        if (value >= 60) return 'bg-yellow-100 dark:bg-yellow-900/20';
        return 'bg-red-100 dark:bg-red-900/20';
    };

    const getScoreLabel = (value: number) => {
        if (value >= 80) return 'Excelente';
        if (value >= 60) return 'Bom';
        if (value >= 40) return 'Regular';
        return 'Precisa Melhorar';
    };

    const getAlertIcon = (type: string) => {
        switch (type) {
            case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
            case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
            case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
            default: return <Target className="h-4 w-4 text-blue-500" />;
        }
    };

    const getImpactColor = (impact: string) => {
        switch (impact) {
            case 'high': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
            case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
            default: return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
        }
    };

    const getDifficultyIcon = (difficulty: string) => {
        switch (difficulty) {
            case 'easy': return '⚡';
            case 'medium': return '🛠️';
            default: return '🚀';
        }
    };

    const breakdownItems = [
        { key: 'title_seo', label: 'SEO do Título', weight: 20 },
        { key: 'keywords_density', label: 'Densidade de Keywords', weight: 15 },
        { key: 'technical_sheet', label: 'Ficha Técnica', weight: 15 },
        { key: 'images_quality', label: 'Qualidade das Imagens', weight: 10 },
        { key: 'model_optimization', label: 'Campo Modelo', weight: 10 },
        { key: 'description_quality', label: 'Qualidade da Descrição', weight: 10 },
        { key: 'category_relevance', label: 'Relevância da Categoria', weight: 5 },
        { key: 'pricing_strategy', label: 'Estratégia de Preço', weight: 5 },
        { key: 'shipping_optimization', label: 'Otimização de Envio', weight: 5 },
        { key: 'variations_usage', label: 'Uso de Variações', weight: 5 }
    ];

    const priorityAlerts = score.alerts.filter(alert => alert.priority === 'high');
    const quickWins = score.suggestions.filter(s => s.difficulty === 'easy' && s.impact === 'high');

    return (
        <div className="space-y-6">
            {/* Score Principal */}
            <Card>
                <CardHeader className="text-center pb-2">
                    <CardTitle className="flex items-center justify-center gap-2">
                        <Trophy className="h-6 w-6 text-yellow-500" />
                        Score de Qualidade
                    </CardTitle>
                    <CardDescription>
                        Análise completa baseada em 10 critérios de SEO e otimização
                    </CardDescription>
                </CardHeader>
                
                <CardContent className="text-center space-y-4">
                    <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full ${getScoreBgColor(score.overall_score)}`}>
                        <div className="text-center">
                            <div className={`text-2xl font-bold ${getScoreColor(score.overall_score)}`}>
                                {score.overall_score}
                            </div>
                            <div className="text-xs text-muted-foreground">/ 100</div>
                        </div>
                    </div>
                    
                    <div>
                        <Badge variant="secondary" className="text-sm">
                            {getScoreLabel(score.overall_score)}
                        </Badge>
                    </div>
                    
                    <Progress value={score.overall_score} className="w-full" />
                    
                    <div className="text-sm text-muted-foreground">
                        {score.overall_score >= 80 && "🎉 Produto muito bem otimizado!"}
                        {score.overall_score >= 60 && score.overall_score < 80 && "👍 Bom produto, mas há espaço para melhorias"}
                        {score.overall_score >= 40 && score.overall_score < 60 && "⚠️ Produto precisa de otimizações importantes"}
                        {score.overall_score < 40 && "🚨 Produto precisa de melhorias urgentes"}
                    </div>
                </CardContent>
            </Card>

            {/* Breakdown Detalhado */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        Breakdown Detalhado
                    </CardTitle>
                    <CardDescription>
                        Pontuação por categoria (peso no score final)
                    </CardDescription>
                </CardHeader>
                
                <CardContent className="space-y-3">
                    {breakdownItems.map(item => {
                        const value = score.breakdown[item.key as keyof typeof score.breakdown];
                        return (
                            <div key={item.key} className="space-y-1">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="font-medium">{item.label}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">({item.weight}%)</span>
                                        <span className={`font-bold ${getScoreColor(value)}`}>
                                            {value}
                                        </span>
                                    </div>
                                </div>
                                <Progress value={value} className="h-2" />
                            </div>
                        );
                    })}
                </CardContent>
            </Card>

            {/* Alertas Prioritários */}
            {priorityAlerts.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-red-500" />
                            Alertas Prioritários
                        </CardTitle>
                        <CardDescription>
                            Problemas que precisam de atenção imediata
                        </CardDescription>
                    </CardHeader>
                    
                    <CardContent className="space-y-3">
                        {priorityAlerts.map((alert, index) => (
                            <Alert key={index} variant={alert.type === 'error' ? 'destructive' : 'default'}>
                                {getAlertIcon(alert.type)}
                                <AlertDescription>
                                    <div className="space-y-1">
                                        <p className="font-medium">{alert.message}</p>
                                        {alert.action && (
                                            <p className="text-sm text-muted-foreground">
                                                💡 {alert.action}
                                            </p>
                                        )}
                                    </div>
                                </AlertDescription>
                            </Alert>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Quick Wins */}
            {quickWins.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Zap className="h-5 w-5 text-green-500" />
                            Quick Wins
                        </CardTitle>
                        <CardDescription>
                            Melhorias fáceis com alto impacto
                        </CardDescription>
                    </CardHeader>
                    
                    <CardContent className="space-y-3">
                        {quickWins.map((suggestion, index) => (
                            <div key={index} className="p-3 border rounded-lg space-y-2">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-medium">{suggestion.title}</h4>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="secondary" className={getImpactColor(suggestion.impact)}>
                                            {suggestion.impact}
                                        </Badge>
                                        <span className="text-lg">{getDifficultyIcon(suggestion.difficulty)}</span>
                                    </div>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    {suggestion.description}
                                </p>
                                <Badge variant="outline" className="text-xs">
                                    {suggestion.category}
                                </Badge>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Todas as Sugestões */}
            {score.suggestions.length > quickWins.length && (
                <Card>
                    <CardHeader>
                        <CardTitle>Todas as Sugestões</CardTitle>
                        <CardDescription>
                            Oportunidades de melhoria organizadas por impacto
                        </CardDescription>
                    </CardHeader>
                    
                    <CardContent className="space-y-3">
                        {score.suggestions
                            .filter(s => !quickWins.includes(s))
                            .sort((a, b) => {
                                const impactOrder = { high: 3, medium: 2, low: 1 };
                                return impactOrder[b.impact as keyof typeof impactOrder] - 
                                       impactOrder[a.impact as keyof typeof impactOrder];
                            })
                            .map((suggestion, index) => (
                                <div key={index} className="p-3 border rounded-lg space-y-2">
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-medium">{suggestion.title}</h4>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="secondary" className={getImpactColor(suggestion.impact)}>
                                                {suggestion.impact}
                                            </Badge>
                                            <span className="text-lg">{getDifficultyIcon(suggestion.difficulty)}</span>
                                        </div>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        {suggestion.description}
                                    </p>
                                    <Badge variant="outline" className="text-xs">
                                        {suggestion.category}
                                    </Badge>
                                </div>
                            ))}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}