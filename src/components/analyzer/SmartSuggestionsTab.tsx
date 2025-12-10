import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Lightbulb, TrendingUp, AlertTriangle, CheckCircle, ExternalLink } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface SmartSuggestionsTabProps {
    mlbId: string;
    workspaceId?: string;
    categoryId: string;
    currentAnalysis: any;
}

export function SmartSuggestionsTab({ mlbId, workspaceId, categoryId, currentAnalysis }: SmartSuggestionsTabProps) {
    const [loading, setLoading] = useState(false);
    const [suggestions, setSuggestions] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const loadSmartSuggestions = async () => {
        if (!mlbId) return;

        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/integrations/mercadolivre/smart-suggestions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mlbId,
                    workspaceId
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erro ao carregar sugestões');
            }

            setSuggestions(data.suggestions);
        } catch (err: any) {
            console.error('Erro ao carregar sugestões inteligentes:', err);
            setError(err.message || 'Falha ao carregar sugestões');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSmartSuggestions();
    }, [mlbId]);

    if (loading) {
        return (
            <Card>
                <CardContent className="py-12 text-center">
                    <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary mb-4" />
                    <p className="text-muted-foreground">Analisando mercado e gerando sugestões inteligentes...</p>
                    <p className="text-sm text-muted-foreground mt-2">Buscando top 20 produtos da categoria</p>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                    {error}
                    <Button variant="outline" size="sm" className="ml-4" onClick={loadSmartSuggestions}>
                        Tentar novamente
                    </Button>
                </AlertDescription>
            </Alert>
        );
    }

    if (!suggestions) {
        return null;
    }

    const { attribute_suggestions, title_suggestions, market_positioning } = suggestions;

    return (
        <div className="space-y-6">
            {/* Header com Overview */}
            <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
                        <Lightbulb className="w-6 h-6" />
                        Sugestões Inteligentes Baseadas em Dados de Mercado
                    </CardTitle>
                    <CardDescription className="text-blue-700 dark:text-blue-300">
                        Análise dos top 20 produtos mais vendidos da sua categoria
                    </CardDescription>
                </CardHeader>
            </Card>

            {/* Posicionamento de Mercado */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5" />
                        Posicionamento de Mercado
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Preço */}
                    <div className="p-4 rounded-lg bg-muted">
                        <h4 className="font-semibold mb-2 flex items-center gap-2">
                            💰 Análise de Preço
                        </h4>
                        <p className="text-sm">{market_positioning.price_recommendation}</p>
                    </div>

                    {/* Vantagens Competitivas */}
                    {market_positioning.competitive_advantages.length > 0 && (
                        <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200">
                            <h4 className="font-semibold mb-2 flex items-center gap-2 text-green-800 dark:text-green-200">
                                <CheckCircle className="w-4 h-4" />
                                Suas Vantagens Competitivas
                            </h4>
                            <ul className="space-y-1">
                                {market_positioning.competitive_advantages.map((advantage: string, idx: number) => (
                                    <li key={idx} className="text-sm text-green-700 dark:text-green-300">
                                        ✓ {advantage}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Áreas de Melhoria */}
                    {market_positioning.improvement_areas.length > 0 && (
                        <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200">
                            <h4 className="font-semibold mb-2 flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                                <AlertTriangle className="w-4 h-4" />
                                Áreas para Melhorar
                            </h4>
                            <ul className="space-y-1">
                                {market_positioning.improvement_areas.map((area: string, idx: number) => (
                                    <li key={idx} className="text-sm text-yellow-700 dark:text-yellow-300">
                                        → {area}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Sugestões de Atributos */}
            {attribute_suggestions.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Atributos Usados pelos Top Vendedores</CardTitle>
                        <CardDescription>
                            Atributos encontrados nos produtos mais vendidos da categoria
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {attribute_suggestions.map((suggestion: any, idx: number) => (
                                <div
                                    key={idx}
                                    className={`p-4 rounded-lg border-2 ${
                                        suggestion.priority === 'high'
                                            ? 'border-red-300 bg-red-50 dark:bg-red-950/20'
                                            : suggestion.priority === 'medium'
                                            ? 'border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20'
                                            : 'border-gray-300 bg-gray-50 dark:bg-gray-950/20'
                                    }`}
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <h4 className="font-semibold text-lg">{suggestion.attribute_name}</h4>
                                            <p className="text-sm text-muted-foreground mt-1">{suggestion.reason}</p>
                                        </div>
                                        <Badge
                                            variant={
                                                suggestion.priority === 'high'
                                                    ? 'destructive'
                                                    : suggestion.priority === 'medium'
                                                    ? 'default'
                                                    : 'secondary'
                                            }
                                        >
                                            {suggestion.priority === 'high' ? 'Alta Prioridade' :
                                             suggestion.priority === 'medium' ? 'Prioridade Média' :
                                             'Baixa Prioridade'}
                                        </Badge>
                                    </div>

                                    <div className="mt-3">
                                        <p className="text-sm font-medium mb-2">Valores mais usados pelos concorrentes:</p>
                                        <div className="flex flex-wrap gap-2">
                                            {suggestion.suggested_values.map((value: string, vIdx: number) => (
                                                <Badge key={vIdx} variant="outline" className="cursor-pointer hover:bg-primary hover:text-primary-foreground">
                                                    {value}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Sugestões de Título */}
            {title_suggestions.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Sugestões de Título Otimizado</CardTitle>
                        <CardDescription>
                            Baseado nas palavras-chave mais usadas pelos top vendedores
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {title_suggestions.map((suggestion: any, idx: number) => (
                                <div key={idx} className="p-4 rounded-lg border-2 border-blue-300 bg-blue-50 dark:bg-blue-950/20">
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                                                    TÍTULO SUGERIDO
                                                </span>
                                            </div>
                                            <p className="font-bold text-lg mb-2">{suggestion.suggested_title}</p>
                                            <p className="text-sm text-muted-foreground">{suggestion.reason}</p>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                                navigator.clipboard.writeText(suggestion.suggested_title);
                                                toast({
                                                    title: "✓ Copiado!",
                                                    description: "Título copiado para área de transferência"
                                                });
                                            }}
                                        >
                                            Copiar
                                        </Button>
                                    </div>

                                    <div className="mt-3">
                                        <p className="text-xs font-medium mb-2 text-muted-foreground">
                                            Palavras-chave adicionadas:
                                        </p>
                                        <div className="flex flex-wrap gap-1">
                                            {suggestion.keywords_used.map((keyword: string, kIdx: number) => (
                                                <Badge key={kIdx} variant="secondary" className="text-xs">
                                                    {keyword}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Resumo e Ações */}
            <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
                <CardContent className="py-6">
                    <div className="text-center space-y-4">
                        <h3 className="text-xl font-bold text-green-800 dark:text-green-200">
                            📊 Análise Completa
                        </h3>
                        <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto">
                            <div className="text-center">
                                <div className="text-3xl font-bold text-green-600">{attribute_suggestions.length}</div>
                                <div className="text-sm text-muted-foreground">Atributos Sugeridos</div>
                            </div>
                            <div className="text-center">
                                <div className="text-3xl font-bold text-green-600">{title_suggestions.length}</div>
                                <div className="text-sm text-muted-foreground">Títulos Sugeridos</div>
                            </div>
                            <div className="text-center">
                                <div className="text-3xl font-bold text-green-600">20</div>
                                <div className="text-sm text-muted-foreground">Produtos Analisados</div>
                            </div>
                        </div>
                        <p className="text-sm text-green-700 dark:text-green-300">
                            Use as sugestões acima para otimizar seu anúncio e aumentar suas vendas
                        </p>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                if (currentAnalysis?.product_data?.permalink) {
                                    window.open(currentAnalysis.product_data.permalink, '_blank');
                                }
                            }}
                        >
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Ver Anúncio no ML
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
