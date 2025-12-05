import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
    CheckCircle, 
    XCircle, 
    AlertTriangle, 
    Settings,
    TrendingUp,
    Target,
    Zap,
    Info,
    ArrowUp,
    ExternalLink,
    Copy,
    Eye,
    EyeOff
} from "lucide-react";

interface TechnicalAttribute {
    id: string;
    name: string;
    value_id?: string;
    value_name?: string;
    values?: Array<{ id: string; name: string; }>;
    required: boolean;
    importance_level: 'critical' | 'high' | 'medium' | 'low';
    seo_impact: number;
    conversion_impact: number;
    category: 'basic' | 'physical' | 'technical' | 'marketing' | 'logistics';
    suggestions?: string[];
    validation?: {
        valid: boolean;
        issues: string[];
        recommendations: string[];
    };
}

interface TechnicalSheetAnalysis {
    completion_score: number;
    total_attributes: number;
    filled_attributes: number;
    critical_missing: TechnicalAttribute[];
    high_priority_missing: TechnicalAttribute[];
    optimization_opportunities: Array<{
        attribute: TechnicalAttribute;
        potential_boost: number;
        implementation_difficulty: 'easy' | 'medium' | 'hard';
        steps: string[];
    }>;
    category_specific_insights: {
        required_attributes: string[];
        recommended_attributes: string[];
        competitive_advantages: string[];
    };
    seo_impact_analysis: {
        current_seo_score: number;
        max_possible_score: number;
        improvement_potential: number;
        priority_attributes: TechnicalAttribute[];
    };
    validation_results: Array<{
        attribute_id: string;
        valid: boolean;
        issues: string[];
        recommendations: string[];
    }>;
}

interface TechnicalSheetAnalyzerProps {
    analysis: TechnicalSheetAnalysis;
    productId: string;
    onOptimize?: (attributeId: string) => void;
    onViewDetails?: (attributeId: string) => void;
}

export function TechnicalSheetAnalyzer({ 
    analysis, 
    productId, 
    onOptimize, 
    onViewDetails 
}: TechnicalSheetAnalyzerProps) {
    const [activeTab, setActiveTab] = useState("overview");
    const [showCompletedAttributes, setShowCompletedAttributes] = useState(false);

    const getImportanceColor = (level: string) => {
        switch (level) {
            case 'critical': return 'text-red-600 border-red-200 bg-red-50';
            case 'high': return 'text-orange-600 border-orange-200 bg-orange-50';
            case 'medium': return 'text-blue-600 border-blue-200 bg-blue-50';
            case 'low': return 'text-gray-600 border-gray-200 bg-gray-50';
            default: return 'text-gray-600';
        }
    };

    const getImportanceIcon = (level: string) => {
        switch (level) {
            case 'critical': return <XCircle className="h-4 w-4 text-red-500" />;
            case 'high': return <AlertTriangle className="h-4 w-4 text-orange-500" />;
            case 'medium': return <Info className="h-4 w-4 text-blue-500" />;
            case 'low': return <CheckCircle className="h-4 w-4 text-green-500" />;
            default: return <Info className="h-4 w-4 text-gray-500" />;
        }
    };

    const getDifficultyColor = (difficulty: string) => {
        switch (difficulty) {
            case 'easy': return 'text-green-600 border-green-200';
            case 'medium': return 'text-yellow-600 border-yellow-200';
            case 'hard': return 'text-red-600 border-red-200';
            default: return 'text-gray-600';
        }
    };

    const getCategoryIcon = (category: string) => {
        switch (category) {
            case 'basic': return '🏷️';
            case 'physical': return '📏';
            case 'technical': return '⚙️';
            case 'marketing': return '📈';
            case 'logistics': return '🚚';
            default: return '📋';
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    return (
        <div className="space-y-6">
            {/* Header com Score Principal */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Settings className="h-5 w-5 text-blue-500" />
                        Ficha Técnica Completa
                    </CardTitle>
                    <CardDescription>
                        Análise avançada de atributos com impacto em SEO e conversão
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center">
                            <div className="text-3xl font-bold text-primary mb-1">
                                {analysis.completion_score}%
                            </div>
                            <div className="text-sm text-muted-foreground">Completude</div>
                            <Progress value={analysis.completion_score} className="mt-2" />
                        </div>
                        
                        <div className="text-center">
                            <div className="text-2xl font-bold text-green-600 mb-1">
                                {analysis.filled_attributes}/{analysis.total_attributes}
                            </div>
                            <div className="text-sm text-muted-foreground">Preenchidos</div>
                        </div>

                        <div className="text-center">
                            <div className="text-2xl font-bold text-orange-600 mb-1">
                                {analysis.critical_missing.length + analysis.high_priority_missing.length}
                            </div>
                            <div className="text-sm text-muted-foreground">Prioritários</div>
                        </div>

                        <div className="text-center">
                            <div className="text-2xl font-bold text-blue-600 mb-1">
                                {analysis.seo_impact_analysis.improvement_potential}
                            </div>
                            <div className="text-sm text-muted-foreground">Potential SEO</div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Tabs Principais */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="missing">
                        Faltando ({analysis.critical_missing.length + analysis.high_priority_missing.length})
                    </TabsTrigger>
                    <TabsTrigger value="optimization">Otimização</TabsTrigger>
                    <TabsTrigger value="insights">Insights</TabsTrigger>
                </TabsList>

                {/* Tab: Overview */}
                <TabsContent value="overview" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Score SEO */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Target className="h-4 w-4" />
                                    Impacto SEO
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm">Score Atual:</span>
                                    <span className="font-bold">{analysis.seo_impact_analysis.current_seo_score}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm">Máximo Possível:</span>
                                    <span className="font-bold text-green-600">{analysis.seo_impact_analysis.max_possible_score}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm">Potencial:</span>
                                    <Badge variant="outline" className="text-blue-600">
                                        +{analysis.seo_impact_analysis.improvement_potential}
                                    </Badge>
                                </div>
                                <Progress 
                                    value={(analysis.seo_impact_analysis.current_seo_score / analysis.seo_impact_analysis.max_possible_score) * 100} 
                                    className="mt-2" 
                                />
                            </CardContent>
                        </Card>

                        {/* Distribuição por Categoria */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4" />
                                    Por Categoria
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {Object.entries(
                                        [...analysis.critical_missing, ...analysis.high_priority_missing]
                                        .reduce((acc, attr) => {
                                            acc[attr.category] = (acc[attr.category] || 0) + 1;
                                            return acc;
                                        }, {} as { [key: string]: number })
                                    ).map(([category, count]) => (
                                        <div key={category} className="flex items-center justify-between">
                                            <span className="text-sm flex items-center gap-1">
                                                {getCategoryIcon(category)}
                                                {category}
                                            </span>
                                            <Badge variant="outline">{count}</Badge>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Tab: Atributos Faltando */}
                <TabsContent value="missing" className="space-y-4">
                    {/* Críticos */}
                    {analysis.critical_missing.length > 0 && (
                        <Card className="border-red-200">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-red-600">
                                    <XCircle className="h-5 w-5" />
                                    Atributos Críticos ({analysis.critical_missing.length})
                                </CardTitle>
                                <CardDescription>
                                    Estes atributos são obrigatórios e afetam significativamente o ranking
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {analysis.critical_missing.map((attr, index) => (
                                    <div key={index} className="p-4 border rounded-lg space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                {getCategoryIcon(attr.category)}
                                                <span className="font-medium">{attr.name}</span>
                                                <Badge variant="destructive">Crítico</Badge>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline">SEO: {attr.seo_impact}/10</Badge>
                                                <Badge variant="outline">Conv: {attr.conversion_impact}/10</Badge>
                                            </div>
                                        </div>

                                        {attr.suggestions && (
                                            <div>
                                                <h5 className="text-sm font-medium mb-2">Sugestões:</h5>
                                                <div className="space-y-1">
                                                    {attr.suggestions.map((suggestion, i) => (
                                                        <p key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                                                            <span>•</span>
                                                            <span>{suggestion}</span>
                                                        </p>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex gap-2">
                                            <Button size="sm" onClick={() => onOptimize?.(attr.id)}>
                                                <ExternalLink className="h-3 w-3 mr-1" />
                                                Preencher no ML
                                            </Button>
                                            <Button variant="outline" size="sm" onClick={() => onViewDetails?.(attr.id)}>
                                                <Eye className="h-3 w-3 mr-1" />
                                                Ver Detalhes
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}

                    {/* Alta Prioridade */}
                    {analysis.high_priority_missing.length > 0 && (
                        <Card className="border-orange-200">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-orange-600">
                                    <AlertTriangle className="h-5 w-5" />
                                    Alta Prioridade ({analysis.high_priority_missing.length})
                                </CardTitle>
                                <CardDescription>
                                    Recomendados para melhorar SEO e experiência do usuário
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {analysis.high_priority_missing.map((attr, index) => (
                                    <div key={index} className="p-3 border rounded-lg space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                {getCategoryIcon(attr.category)}
                                                <span className="font-medium text-sm">{attr.name}</span>
                                                <Badge variant="secondary">Alta</Badge>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Badge variant="outline" className="text-xs">SEO: {attr.seo_impact}</Badge>
                                            </div>
                                        </div>

                                        {attr.suggestions && (
                                            <p className="text-xs text-muted-foreground">
                                                💡 {attr.suggestions[0]}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                {/* Tab: Oportunidades de Otimização */}
                <TabsContent value="optimization" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Zap className="h-5 w-5 text-yellow-500" />
                                Oportunidades Prioritárias
                            </CardTitle>
                            <CardDescription>
                                Ranqueadas por potencial de impacto vs facilidade de implementação
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {analysis.optimization_opportunities.slice(0, 6).map((opportunity, index) => (
                                <div key={index} className="p-4 border rounded-lg space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            {getImportanceIcon(opportunity.attribute.importance_level)}
                                            <span className="font-medium">{opportunity.attribute.name}</span>
                                            <Badge variant="outline" className={getDifficultyColor(opportunity.implementation_difficulty)}>
                                                {opportunity.implementation_difficulty}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="text-green-600">
                                                <ArrowUp className="h-3 w-3 mr-1" />
                                                +{opportunity.potential_boost}
                                            </Badge>
                                        </div>
                                    </div>

                                    <div>
                                        <h5 className="text-sm font-medium mb-2">Passos para implementar:</h5>
                                        <div className="space-y-1">
                                            {opportunity.steps.map((step, i) => (
                                                <div key={i} className="flex items-start gap-2 text-xs">
                                                    <span className="text-primary font-medium">{step.split('.')[0]}.</span>
                                                    <span className="text-muted-foreground">{step.split('.').slice(1).join('.')}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <Button size="sm" onClick={() => onOptimize?.(opportunity.attribute.id)}>
                                            Implementar
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={() => copyToClipboard(opportunity.steps.join('\n'))}>
                                            <Copy className="h-3 w-3 mr-1" />
                                            Copiar Passos
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab: Insights da Categoria */}
                <TabsContent value="insights" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Específicos da Categoria</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <h4 className="font-medium mb-2 text-red-600">Obrigatórios:</h4>
                                    <div className="flex flex-wrap gap-1">
                                        {analysis.category_specific_insights.required_attributes.map(attr => (
                                            <Badge key={attr} variant="destructive" className="text-xs">
                                                {attr}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <h4 className="font-medium mb-2 text-blue-600">Recomendados:</h4>
                                    <div className="flex flex-wrap gap-1">
                                        {analysis.category_specific_insights.recommended_attributes.map(attr => (
                                            <Badge key={attr} variant="secondary" className="text-xs">
                                                {attr}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <h4 className="font-medium mb-2 text-green-600">Vantagem Competitiva:</h4>
                                    <div className="flex flex-wrap gap-1">
                                        {analysis.category_specific_insights.competitive_advantages.map(attr => (
                                            <Badge key={attr} variant="outline" className="text-xs text-green-600 border-green-200">
                                                {attr}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Validação de Dados</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {analysis.validation_results.length > 0 ? (
                                    <div className="space-y-3">
                                        {analysis.validation_results.slice(0, 5).map((result, index) => (
                                            <Alert key={index}>
                                                <AlertTriangle className="h-4 w-4" />
                                                <AlertDescription className="space-y-1">
                                                    <p className="font-medium">Problema em {result.attribute_id}</p>
                                                    {result.issues.map((issue, i) => (
                                                        <p key={i} className="text-xs text-red-600">• {issue}</p>
                                                    ))}
                                                    {result.recommendations.length > 0 && (
                                                        <p className="text-xs text-blue-600">💡 {result.recommendations[0]}</p>
                                                    )}
                                                </AlertDescription>
                                            </Alert>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-4">
                                        <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
                                        <p className="text-sm text-muted-foreground">
                                            Todos os atributos preenchidos estão válidos
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}