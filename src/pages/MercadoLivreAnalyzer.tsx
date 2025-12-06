import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { ShoppingBag, BarChart3, Zap, Target, Settings, AlertTriangle, FileText, Wrench, Package, ExternalLink } from "lucide-react";
import { useMLBAnalyzer } from "@/hooks/useMLBAnalyzer";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useMLBOptimizations } from "@/hooks/useMLBOptimizations";
import type { OptimizationPayload } from "@/hooks/useMLBOptimizations";
import { toast } from "@/hooks/use-toast";
import { MLBAnalyzerInput } from "@/components/analyzer/MLBAnalyzerInput";
import { QualityScore } from "@/components/analyzer/QualityScore";
import { ModelManager } from "@/components/analyzer/ModelManager";
import { SmartAlerts } from "@/components/analyzer/SmartAlerts";
import { TechnicalSheetAnalyzer } from "@/components/analyzer/TechnicalSheetAnalyzer";
import { ImageUpload } from "@/components/analyzer/ImageUpload";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup, SelectLabel } from "@/components/ui/select";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogFooter,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogAction,
    AlertDialogCancel,
} from "@/components/ui/alert-dialog";

export default function MercadoLivreAnalyzer() {
    const {
        isAnalyzing,
        currentAnalysis,
        error,
        lastAnalyzed,
        analyzeProduct,
        clearError
    } = useMLBAnalyzer();

    const {
        isApplying,
        error: applyError,
        applyOptimizations,
        lastApplication,
        clearLastApplication,
        clearError: clearApplyError
    } = useMLBOptimizations();
    const { currentWorkspace } = useWorkspace();

    const [activeTab, setActiveTab] = useState("overview");
    const [searchParams] = useSearchParams();
    const mlbFromQuery = searchParams.get("mlb") || undefined;

    const [editedTitle, setEditedTitle] = useState("");
    const [editedModel, setEditedModel] = useState("");
    const [editedDescription, setEditedDescription] = useState("");
    const [editedColor, setEditedColor] = useState("");
    const [editedSize, setEditedSize] = useState("");
    const [showColorCustom, setShowColorCustom] = useState(false);
    const [showSizeCustom, setShowSizeCustom] = useState(false);
    
    // Estados dos checkboxes para controlar o que será aplicado
    const [applyAttributes, setApplyAttributes] = useState(true);
    const [applyModel, setApplyModel] = useState(true);
    const [applyDescription, setApplyDescription] = useState(true);
    const [applyImages, setApplyImages] = useState(false);
    
    // Estados para upload de imagens
    const [newImagePictureIds, setNewImagePictureIds] = useState<string[]>([]);
    const [editedBrand, setEditedBrand] = useState("");
    const [showBrandCustom, setShowBrandCustom] = useState(false);
    const [titleError, setTitleError] = useState<string | null>(null);
    const [descriptionError, setDescriptionError] = useState<string | null>(null);
    const [warnings, setWarnings] = useState<string[]>([]);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [originalSnapshot, setOriginalSnapshot] = useState<{ title: string; model?: string; attrs: Record<string, string> } | null>(null);
    const [plannedOpt, setPlannedOpt] = useState<OptimizationPayload | null>(null);
    const [showItemJson, setShowItemJson] = useState(false);
    const [itemJson, setItemJson] = useState<any | null>(null);
    const [itemDesc, setItemDesc] = useState<any | null>(null);
    const [loadingItem, setLoadingItem] = useState(false);
    const [itemError, setItemError] = useState<string | null>(null);
    const [showCategory, setShowCategory] = useState(false);
    const [categoryData, setCategoryData] = useState<any | null>(null);
    const [categoryAttrs, setCategoryAttrs] = useState<any[] | null>(null);
    const [loadingCategory, setLoadingCategory] = useState(false);
    const [categoryError, setCategoryError] = useState<string | null>(null);
    const [allAttributes, setAllAttributes] = useState<Record<string, string>>({});
    const [showAdvancedAttrs, setShowAdvancedAttrs] = useState(false);
    

    const baseColorOptions = [
        'Preto', 'Branco', 'Cinza', 'Prata', 'Vermelho', 'Azul', 'Verde', 'Amarelo', 'Marrom', 'Rosa', 'Roxo', 'Laranja', 'Bege', 'Dourado'
    ];
    const baseSizeOptions = {
        padrao: ['PP', 'P', 'M', 'G', 'GG', 'XG'],
        numerico: ['30', '32', '34', '36', '38', '40', '42', '44', '46', '48'],
        unico: ['Único']
    };
    const colorOptionsByCategory: Record<string, string[]> = {
        MLB1051: ['Preto', 'Branco', 'Cinza', 'Prata', 'Azul', 'Vermelho', 'Verde', 'Amarelo'],
        MLB1430: ['Preto', 'Branco', 'Cinza', 'Vermelho', 'Azul', 'Verde', 'Amarelo', 'Rosa', 'Roxo', 'Bege'],
    };
    const sizeOptionsByCategory: Record<string, { padrao?: string[]; numerico?: string[]; unico?: string[] }> = {
        MLB1051: { numerico: baseSizeOptions.numerico },
        MLB1430: { padrao: baseSizeOptions.padrao, unico: baseSizeOptions.unico },
    };

    const categoryId = currentAnalysis?.product_data?.category_id as string | undefined;
    const colorOptions = (categoryId && colorOptionsByCategory[categoryId]) || baseColorOptions;
    const sizeOptions = (categoryId && sizeOptionsByCategory[categoryId]) || baseSizeOptions;

    useEffect(() => {
        if (currentAnalysis) {
            setEditedTitle(currentAnalysis.title_optimization.suggested_titles[0]?.title || "");
            setEditedModel(currentAnalysis.model_optimization?.optimized_models?.[0]?.model || "");
            setEditedDescription(currentAnalysis.seo_description.optimized_description || "");
            const attrs = currentAnalysis.product_data.attributes || [];
            
            const colorAttr = attrs.find((a: any) => a.id === 'COLOR');
            const sizeAttr = attrs.find((a: any) => a.id === 'SIZE');
            const brandAttr = attrs.find((a: any) => a.id === 'BRAND');
            setEditedColor(colorAttr?.value_name || "");
            setEditedSize(sizeAttr?.value_name || "");
            setEditedBrand(brandAttr?.value_name || "");
            
            setOriginalSnapshot({ 
                title: currentAnalysis.product_data.title, 
                model: (attrs.find((a: any) => a.id === 'MODEL')?.value_name) || '', 
                attrs: {}
            });
        }
    }, [currentAnalysis]);

    const loadItemData = useCallback(async () => {
        if (!currentAnalysis?.mlb_id || !currentWorkspace?.id) return;
        setLoadingItem(true);
        setItemError(null);
        setShowItemJson(true);
        try {
            const itemResp = await fetch(`/api/integrations/mercadolivre/items/${currentAnalysis.mlb_id}?workspaceId=${currentWorkspace.id}`);
            const itemData = await itemResp.json();
            setItemJson(itemData);
            try {
                const descResp = await fetch(`/api/integrations/mercadolivre/items/${currentAnalysis.mlb_id}/description?workspaceId=${currentWorkspace.id}`);
                const descData = await descResp.json();
                setItemDesc(descData);
            } catch (e) {
                setItemDesc(null);
            }
        } catch (e: any) {
            setItemError(e?.message || 'Falha ao carregar item');
        } finally {
            setLoadingItem(false);
        }
    }, [currentAnalysis?.mlb_id, currentWorkspace?.id]);

    useEffect(() => {
        if (activeTab === 'apply') {
            loadItemData();
        }
    }, [activeTab, loadItemData]);

    const loadCategoryData = useCallback(async () => {
        const catId = currentAnalysis?.product_data?.category_id;
        if (!catId || !currentWorkspace?.id) return;
        setLoadingCategory(true);
        setCategoryError(null);
        setShowCategory(true);
        try {
            const catResp = await fetch(`/api/integrations/mercadolivre/categories/${catId}?workspaceId=${currentWorkspace.id}`);
            const catData = await catResp.json();
            setCategoryData(catData);
            try {
                const attrResp = await fetch(`/api/integrations/mercadolivre/categories/${catId}/attributes?workspaceId=${currentWorkspace.id}`);
                const attrsData = await attrResp.json();
                setCategoryAttrs(Array.isArray(attrsData) ? attrsData : []);
            } catch (e) {
                setCategoryAttrs(null);
            }
        } catch (e: any) {
            setCategoryError(e?.message || 'Falha ao carregar categoria');
        } finally {
            setLoadingCategory(false);
        }
    }, [currentAnalysis?.product_data?.category_id, currentWorkspace?.id]);

    function validateFields() {
        const d = editedDescription.trim();
        const dEff = d || String(currentAnalysis?.seo_description?.optimized_description || '').trim();
        const w: string[] = [];
        const critical: string[] = [];
        const contactRegex = /(https?:\/\/|www\.|@|\b\d{9,}\b)/i;
        
        setTitleError(null);
        setDescriptionError(dEff.length === 0 ? "Descrição obrigatória" : null);
        
        // Validações críticas
        if (contactRegex.test(dEff)) critical.push("Detectado contato/URL na descrição. Remova antes de aplicar.");
        
        const status = currentAnalysis?.product_data?.status;
        if (status && String(status).toLowerCase() !== 'active') {
            critical.push(`O anúncio não está ativo (status: ${status}). Ative para editar.`);
        }

        // Validações de avisos (não bloqueiam aplicação)
        if (editedModel.trim().length === 0) {
            w.push("Modelo vazio - será mantido o atual.");
        }
        
        const hasBasicAttributes = editedBrand.trim() || editedColor.trim() || editedSize.trim();
        
        // Verificar atributos avançados modificados
        let modifiedAdvancedCount = 0;
        if (currentAnalysis?.product_data?.attributes) {
            for (const attr of currentAnalysis.product_data.attributes) {
                const originalValue = attr.value_name || attr.value_id || '';
                const currentValue = allAttributes[attr.id];
                if (currentValue && currentValue !== originalValue) {
                    modifiedAdvancedCount++;
                }
            }
        }
        
        if (!hasBasicAttributes && modifiedAdvancedCount === 0) {
            w.push("Nenhum atributo será alterado.");
        } else if (modifiedAdvancedCount > 0) {
            w.push(`${modifiedAdvancedCount} atributos avançados serão atualizados.`);
        }

        setWarnings([...w, ...critical]);
        return dEff.length > 0 && critical.length === 0;
    }

    function getTopAttrValues(attrId: string, limit: number = 5): string[] {
        const comps = currentAnalysis?.competitive_analysis?.top_competitors || [];
        const counts: Record<string, number> = {};
        for (const c of comps) {
            const attrs = Array.isArray(c.attributes) ? c.attributes : [];
            for (const a of attrs) {
                if (a.id === attrId && a.value_name) {
                    counts[a.value_name] = (counts[a.value_name] || 0) + 1;
                }
            }
        }
        const sorted = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .map(([name]) => name);
        return sorted.slice(0, limit);
    }

    function buildSeoTemplate(): string {
        const title = (editedTitle || currentAnalysis?.product_data?.title || '').trim();
        const color = (editedColor.trim() || (currentAnalysis?.product_data?.attributes || []).find((a: any) => a.id === 'COLOR')?.value_name || '').trim();
        const size = (editedSize.trim() || (currentAnalysis?.product_data?.attributes || []).find((a: any) => a.id === 'SIZE')?.value_name || '').trim();
        const material = ((currentAnalysis?.product_data?.attributes || []).find((a: any) => a.id === 'MATERIAL')?.value_name || '').trim();
        const brandVal = (editedBrand || (currentAnalysis?.product_data?.attributes || []).find((a: any) => a.id === 'BRAND')?.value_name || '').trim();
        const brandDisplay = brandVal && !['outras', 'genérica', 'generica', 'generic', 'outra'].includes(brandVal.toLowerCase()) ? brandVal : 'Nossa loja';

        const intro = `${title}. Modelo clássico e elegante. Fica lindo para compor qualquer look clean, fresh e minimalista.`;

        const brandBlock = `${brandDisplay} está no mercado oferecendo produtos de alta qualidade. Peças com excelente acabamento e durabilidade. Não perde a cor e mantemos um rigoroso padrão de qualidade.`;

        const specLines: string[] = [];
        specLines.push(`${title}`);
        if (material) specLines.push(`Material: ${material}`);
        if (color) specLines.push(`Cor: ${color}`);
        if (size) specLines.push(`Tamanho: ${size}`);
        specLines.push(`Acabamento de ótima qualidade, brilho prolongado e excelente durabilidade.`);

        const body = [
            intro,
            '',
            brandBlock,
            '',
            'CARACTERÍSTICAS:',
            ...specLines,
            '',
            'GARANTIA:',
            'Garantia de qualidade e acabamento.',
            '',
            'ACOMPANHA:',
            `${(title.toLowerCase().includes('brinco') || (currentAnalysis?.product_data?.category_id === 'MLB1432')) ? '02' : '01'} ${title}`,
            'Nota Fiscal',
            'Embalagem',
            '',
            'ENVIO:',
            'SEG A SEXTA: Para pedidos realizados até meio dia, envio NO MESMO DIA.',
            'SÁB, DOM E FERIADOS: Envio no próximo dia útil.',
            'OBS: A cor do produto pode variar sutilmente da foto do site.',
            '',
            'Garantia do vendedor: 30 dias'
        ];
        return body.join('\n');
    }

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
        <div className="space-y-6 pb-4 container mx-auto max-w-6xl px-4 md:px-6 overflow-x-hidden">
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
                    <TabsList className="grid w-full grid-cols-10">
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
                        <TabsTrigger value="apply" className="flex items-center gap-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                            <Zap className="h-4 w-4" />
                            <span className="hidden sm:inline font-bold">Aplicar</span>
                        </TabsTrigger>
                    </TabsList>

                    {/* Overview Rápido */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                                                        {Array.from(new Set(suggestion.keywords_added)).map(kw => (
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
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                        {currentAnalysis?.model_optimization ? (
                            <ModelManager
                                currentModel={currentAnalysis.model_optimization?.current_model || null}
                                currentScore={currentAnalysis.model_optimization?.current_score || 0}
                                strategicKeywords={(currentAnalysis.model_optimization?.strategic_keywords || []).map(k => ({
                                    keyword: typeof k === 'string' ? k : k.keyword || 'Palavra-chave',
                                    relevance: 'alta' as const,
                                    type: 'trend' as const,
                                    search_volume: 1000,
                                    competition_level: 'media' as const,
                                    ranking_boost: 5,
                                    ctr_potential: 5,
                                    conversion_impact: 5,
                                    usage_recommendation: 'Usar no início do título'
                                }))}
                                optimizedModels={(currentAnalysis.model_optimization?.optimized_models || []).map((m, index) => ({
                                    model: m?.model || `Modelo ${index + 1}`,
                                    score: m?.score || 50,
                                    strategy: 'SEO Padrão',
                                    keywords_used: [],
                                    expected_boost: 5,
                                    reasoning: 'Otimização baseada em palavras-chave'
                                }))}
                                categoryInsights={currentAnalysis.model_optimization?.category_insights || {
                                    category_name: "Categoria",
                                    trending_terms: [],
                                    high_conversion_words: [],
                                    seasonal_keywords: []
                                }}
                                onModelSelect={(model) => {
                                    setEditedModel(model);
                                    setActiveTab('apply');
                                }}
                                onRefreshStrategy={() => {
                                    console.log('Atualizando estratégia...');
                                    // TODO: Implementar atualização de estratégia
                                }}
                            />
                        ) : (
                            <Card className="text-center py-12">
                                <CardContent className="space-y-4">
                                    <Target className="h-16 w-16 text-muted-foreground mx-auto" />
                                    <div>
                                        <h3 className="text-xl font-semibold mb-2">Otimização de Modelo Indisponível</h3>
                                        <p className="text-muted-foreground">
                                            A análise de otimização do campo modelo não está disponível para este produto.
                                        </p>
                                        <p className="text-sm text-muted-foreground mt-2">
                                            Faça uma nova análise do produto para gerar otimizações de modelo.
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
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
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                        <div className="grid gap-6">
                            {/* Concorrentes Diretos */}
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle>Concorrentes Diretos</CardTitle>
                                            <CardDescription>
                                                Produtos similares ao seu anúncio na categoria
                                            </CardDescription>
                                        </div>
                                        {(currentAnalysis.competitive_analysis.top_competitors || []).length > 0 && (
                                            <Badge variant="secondary" className="text-xs">
                                                Dados reais ML
                                            </Badge>
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {(currentAnalysis.competitive_analysis.top_competitors || []).length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {currentAnalysis.competitive_analysis.top_competitors.slice(0, 9).map((c) => (
                                                <div key={c.id} className="p-4 border rounded-lg space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <Badge variant={c.shipping.free_shipping ? 'default' : 'outline'}>
                                                            {c.shipping.free_shipping ? 'Frete grátis' : 'Frete'}
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
                                    ) : (
                                        <div className="text-center py-8 text-muted-foreground">
                                            <div className="space-y-3">
                                                <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
                                                    <Target className="w-8 h-8" />
                                                </div>
                                                <div>
                                                    <p className="font-medium">Nenhum concorrente encontrado</p>
                                                    <p className="text-xs mt-1">
                                                        Não foi possível encontrar produtos similares a este anúncio no momento
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Top 10 da Categoria */}
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle>Top 10 Produtos da Categoria</CardTitle>
                                            <CardDescription>
                                                Os produtos mais vendidos na categoria {currentAnalysis.product_data.category_id}
                                            </CardDescription>
                                        </div>
                                        {currentAnalysis.competitive_analysis.category_top_products && currentAnalysis.competitive_analysis.category_top_products.length > 0 && (
                                            <Badge variant="secondary" className="text-xs">
                                                Dados reais ML
                                            </Badge>
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {currentAnalysis.competitive_analysis.category_top_products && currentAnalysis.competitive_analysis.category_top_products.length > 0 ? (
                                        <div className="space-y-3">
                                            {currentAnalysis.competitive_analysis.category_top_products.map((product, index) => (
                                                <div key={product.id} className="flex items-center gap-4 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                                                        #{index + 1}
                                                    </div>
                                                    <img
                                                        src={product.thumbnail}
                                                        alt={product.title}
                                                        className="w-12 h-12 object-cover rounded"
                                                        onError={(e) => { e.currentTarget.src = '/placeholder-product.jpg' }}
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium line-clamp-1 mb-1">{product.title}</p>
                                                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                            <span className="font-medium text-green-600">R$ {product.price}</span>
                                                            <span>{product.sold_quantity} vendidos</span>
                                                            <span>⭐ {product.seller.reputation_level}</span>
                                                            {product.shipping.free_shipping && (
                                                                <Badge variant="secondary" className="text-xs px-1 py-0">
                                                                    Frete grátis
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <a
                                                        href={product.permalink}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-xs text-blue-600 hover:underline flex-shrink-0"
                                                    >
                                                        Ver →
                                                    </a>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 text-muted-foreground">
                                            <div className="space-y-3">
                                                <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
                                                    <Package className="w-8 h-8" />
                                                </div>
                                                <div>
                                                    <p className="font-medium">Nenhum produto encontrado</p>
                                                    <p className="text-xs mt-1">
                                                        Não foi possível buscar os produtos mais vendidos desta categoria no momento
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Análise de Mercado */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Análise de Mercado</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                        </div>
                    </TabsContent>

                    <TabsContent value="apply" className="space-y-6">
                        {/* ABA APLICAR COMPLETAMENTE NOVA */}
                        <div className="max-w-5xl mx-auto space-y-6">
                            {/* Header */}
                            <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20">
                                <CardHeader className="text-center">
                                    <CardTitle className="text-2xl text-green-800 dark:text-green-200 flex items-center justify-center gap-3">
                                        <Zap className="w-8 h-8" />
                                        Aplicar Otimizações
                                    </CardTitle>
                                    <CardDescription className="text-green-700 dark:text-green-300">
                                        Edite todos os atributos do produto e aplique as otimizações automaticamente
                                    </CardDescription>
                                </CardHeader>
                            </Card>

                            {/* Atributos do Produto */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Target className="w-5 h-5" />
                                        Todos os Atributos do Produto ({currentAnalysis?.product_data?.attributes?.length || 0})
                                    </CardTitle>
                                    <CardDescription>
                                        Edite qualquer atributo do produto. Alterações serão aplicadas diretamente no MercadoLivre.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {currentAnalysis?.product_data?.attributes?.length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                                            {currentAnalysis.product_data.attributes
                                                .sort((a: any, b: any) => a.id.localeCompare(b.id))
                                                .map((attr: any) => {
                                                    const attrId = attr.id;
                                                    const originalValue = attr.value_name || attr.value_id || '';
                                                    const currentValue = allAttributes[attrId] || originalValue;
                                                    const isModified = currentValue !== originalValue;
                                                    
                                                    return (
                                                        <div key={attrId} className={`p-4 rounded-lg border-2 transition-all ${isModified ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' : 'border-gray-200'}`}>
                                                            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                                                                {attrId.replace(/_/g, ' ').toUpperCase()}
                                                                {isModified && <span className="ml-2 text-blue-600 font-bold">*</span>}
                                                            </label>
                                                            <Input
                                                                value={currentValue}
                                                                onChange={(e) => setAllAttributes(prev => ({
                                                                    ...prev,
                                                                    [attrId]: e.target.value
                                                                }))}
                                                                placeholder={originalValue || 'Vazio'}
                                                                className={isModified ? 'border-blue-500' : ''}
                                                            />
                                                            <div className="mt-2 text-xs text-gray-500">
                                                                Original: {originalValue || 'Vazio'}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    ) : (
                                        <div className="text-center py-12 text-gray-500">
                                            <div className="text-4xl mb-4">📋</div>
                                            <div className="text-lg font-medium">Nenhum atributo encontrado</div>
                                            <div className="text-sm">Faça uma análise do produto primeiro</div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Descrição */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Descrição SEO</CardTitle>
                                    <CardDescription>
                                        Descrição otimizada para melhor rankeamento
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        <Textarea
                                            value={editedDescription}
                                            onChange={(e) => setEditedDescription(e.target.value)}
                                            rows={8}
                                            placeholder="Digite a descrição otimizada..."
                                            className="resize-none"
                                        />
                                        <Button
                                            variant="outline"
                                            onClick={() => setEditedDescription(buildSeoTemplate())}
                                        >
                                            Usar Template SEO
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Upload de Imagens */}
                            <ImageUpload
                                existingImages={currentAnalysis?.product_data?.pictures?.map((pic: any, index: number) => ({
                                    id: `existing-${index}`,
                                    url: pic.secure_url || pic.url,
                                    size: pic.size
                                })) || []}
                                onImagesChange={setNewImagePictureIds}
                            />

                            {/* Botão de Aplicar */}
                            <Card className="border-green-200">
                                <CardContent className="p-6 text-center">
                                    <div className="space-y-4">
                                        <div>
                                            <h3 className="text-xl font-bold text-green-800">
                                                Aplicar Modificações Selecionadas
                                            </h3>
                                            <p className="text-gray-600 mt-2">
                                                Selecione quais modificações você deseja aplicar no seu anúncio
                                            </p>
                                        </div>
                                        
                                        {/* Checkboxes de seleção */}
                                        <div className="flex flex-col space-y-3 max-w-sm mx-auto text-left">
                                            <div className="flex justify-between items-center border-b pb-2 mb-1">
                                                <span className="text-sm font-medium text-gray-700">Modificações a aplicar:</span>
                                                <div className="flex gap-2">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm"
                                                        onClick={() => {
                                                            setApplyAttributes(true);
                                                            setApplyModel(true);
                                                            setApplyDescription(true);
                                                            setApplyImages(true);
                                                        }}
                                                    >
                                                        Selecionar tudo
                                                    </Button>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm"
                                                        onClick={() => {
                                                            setApplyAttributes(false);
                                                            setApplyModel(false);
                                                            setApplyDescription(false);
                                                            setApplyImages(false);
                                                        }}
                                                    >
                                                        Limpar
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="apply-attributes"
                                                    checked={applyAttributes}
                                                    onCheckedChange={setApplyAttributes}
                                                />
                                                <label htmlFor="apply-attributes" className="text-sm font-medium cursor-pointer">
                                                    Aplicar atributos modificados ({Object.keys(allAttributes).filter(k => 
                                                        currentAnalysis?.product_data?.attributes?.some((attr: any) => 
                                                            attr.id === k && (allAttributes[k] !== (attr.value_name || attr.value_id || ''))
                                                        )
                                                    ).length})
                                                </label>
                                            </div>
                                            
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="apply-model"
                                                    checked={applyModel}
                                                    onCheckedChange={setApplyModel}
                                                />
                                                <label htmlFor="apply-model" className="text-sm font-medium cursor-pointer">
                                                    Aplicar modelo: {(() => {
                                                        const finalModel = allAttributes['MODEL'] || editedModel.trim();
                                                        return finalModel ? `"${finalModel.substring(0, 30)}${finalModel.length > 30 ? '...' : ''}"` : '(vazio)';
                                                    })()}
                                                </label>
                                            </div>
                                            
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="apply-description"
                                                    checked={applyDescription}
                                                    onCheckedChange={setApplyDescription}
                                                />
                                                <label htmlFor="apply-description" className="text-sm font-medium cursor-pointer">
                                                    Aplicar descrição SEO ({editedDescription.trim().length} caracteres)
                                                </label>
                                            </div>
                                            
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="apply-images"
                                                    checked={applyImages}
                                                    onCheckedChange={setApplyImages}
                                                />
                                                <label htmlFor="apply-images" className="text-sm font-medium cursor-pointer">
                                                    Adicionar novas imagens ({newImagePictureIds.length} imagens)
                                                </label>
                                            </div>
                                        </div>
                                        
                                        <div className="flex gap-3 justify-center">
                                            <Button
                                                size="lg"
                                                className="bg-green-600 hover:bg-green-700 text-white px-8"
                                                disabled={isApplying}
                                                onClick={async () => {
                                                    if (!currentAnalysis) return;
                                                    
                                                    // Verificar se pelo menos uma opção está selecionada
                                                    if (!applyAttributes && !applyModel && !applyDescription && !applyImages) {
                                                        toast({
                                                            title: "⚠️ Nenhuma modificação selecionada",
                                                            description: "Selecione pelo menos uma opção para aplicar.",
                                                            variant: "destructive"
                                                        });
                                                        return;
                                                    }
                                                    
                                                    // Preparar atributos modificados (apenas se checkbox estiver marcado)
                                                    const modifiedAttrs: Record<string, string> = {};
                                                    if (applyAttributes && currentAnalysis?.product_data?.attributes) {
                                                        for (const attr of currentAnalysis.product_data.attributes) {
                                                            const originalValue = attr.value_name || attr.value_id || '';
                                                            const currentValue = allAttributes[attr.id];
                                                            if (currentValue && currentValue !== originalValue) {
                                                                modifiedAttrs[attr.id] = currentValue;
                                                            }
                                                        }
                                                    }

                                                    // Se o atributo MODEL foi modificado, usar ele ao invés do editedModel
                                                    const finalModel = modifiedAttrs['MODEL'] || editedModel.trim();
                                                    
                                                    const optimizations: OptimizationPayload = {
                                                        description: applyDescription ? editedDescription.trim() : undefined,
                                                        model: applyModel ? finalModel : undefined,
                                                        attributes: applyAttributes ? modifiedAttrs : {}
                                                    };

                                                    let allResults = [];
                                                    
                                                    // Aplicar otimizações básicas
                                                    if (applyAttributes || applyModel || applyDescription) {
                                                        const result = await applyOptimizations(currentAnalysis.mlb_id, optimizations);
                                                        if (result?.success) {
                                                            allResults.push(`Otimizações: ${result.changes_applied.length} mudanças`);
                                                        }
                                                    }
                                                    
                                                    // Aplicar imagens se selecionado
                                                    if (applyImages && newImagePictureIds.length > 0) {
                                                        try {
                                                            const imageResponse = await fetch('/api/integrations/mercadolivre/add-pictures', {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({
                                                                    mlbId: currentAnalysis.mlb_id,
                                                                    workspaceId: currentWorkspace?.id,
                                                                    pictureIds: newImagePictureIds
                                                                })
                                                            });
                                                            
                                                            const imageResult = await imageResponse.json();
                                                            if (imageResult.success) {
                                                                allResults.push(`Imagens: ${imageResult.added_pictures.length} adicionadas`);
                                                            }
                                                        } catch (err) {
                                                            console.error('Erro ao adicionar imagens:', err);
                                                        }
                                                    }
                                                    
                                                    // Toast final
                                                    if (allResults.length > 0) {
                                                        toast({
                                                            title: "✅ Aplicado com sucesso!",
                                                            description: allResults.join(' • '),
                                                        });
                                                    } else {
                                                        toast({
                                                            title: "❌ Erro ao aplicar",
                                                            description: "Verifique sua conexão e tente novamente.",
                                                            variant: "destructive",
                                                        });
                                                    }
                                                }}
                                            >
                                                <Zap className="w-5 h-5 mr-2" />
                                                {isApplying ? 'Aplicando...' : 'Aplicar Agora'}
                                            </Button>

                                            <Button
                                                size="lg"
                                                variant="outline"
                                                className="border-blue-600 text-blue-600 hover:bg-blue-50 px-8"
                                                onClick={() => {
                                                    if (currentAnalysis?.product_data?.permalink) {
                                                        window.open(currentAnalysis.product_data.permalink, '_blank');
                                                    }
                                                }}
                                            >
                                                <ExternalLink className="w-5 h-5 mr-2" />
                                                Ver Anúncio
                                            </Button>
                                        </div>
                                        
                                        {/* Resultado */}
                                        {lastApplication && (
                                            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                                                <div className="font-medium text-green-800 mb-2">
                                                    ✅ Aplicado com sucesso!
                                                </div>
                                                <div className="text-sm text-green-700">
                                                    Alterações: {lastApplication.changes_applied.join(', ')}
                                                </div>
                                            </div>
                                        )}
                                        
                                        {applyError && (
                                            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                                                <div className="font-medium text-red-800 mb-2">
                                                    ❌ {applyError.error}
                                                </div>
                                                <div className="text-sm text-red-700">
                                                    {applyError.details}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
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
