import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { ShoppingBag, Zap, Target, ExternalLink } from "lucide-react";
import { useMLBAnalyzer } from "@/hooks/useMLBAnalyzer";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useMLBOptimizations } from "@/hooks/useMLBOptimizations";
import type { OptimizationPayload } from "@/hooks/useMLBOptimizations";
import { toast } from "@/hooks/use-toast";
import { MLBAnalyzerInput } from "@/components/analyzer/MLBAnalyzerInput";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

    const [activeTab, setActiveTab] = useState("apply");
    const [searchParams] = useSearchParams();
    const mlbFromQuery = searchParams.get("mlb") || undefined;

    const [editedTitle, setEditedTitle] = useState("");
    const [editedModel, setEditedModel] = useState("");
    const [editedDescription, setEditedDescription] = useState("");
    const [editedColor, setEditedColor] = useState("");
    const [editedSize, setEditedSize] = useState("");
    const [attrUnits, setAttrUnits] = useState<Record<string, string>>({});
    const [showColorCustom, setShowColorCustom] = useState(false);
    const [showSizeCustom, setShowSizeCustom] = useState(false);

    // Estados dos checkboxes para controlar o que será aplicado
    // Estados dos checkboxes para controlar o que será aplicado
    const [applyAttributes, setApplyAttributes] = useState(false);
    const [applyModel, setApplyModel] = useState(false);
    const [applyDescription, setApplyDescription] = useState(false);
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
    const getAttrValue = useCallback(
        (keys: string[], contains?: string[]) => {
            const attrs = currentAnalysis?.product_data?.attributes || [];
            return (
                attrs.find((a: any) => {
                    const id = String(a.id || "").toLowerCase();
                    const name = String(a.name || "").toLowerCase();
                    if (keys.map((k) => k.toLowerCase()).includes(id)) return true;
                    if (keys.map((k) => k.toLowerCase()).includes(name)) return true;
                    if (contains && contains.some((c) => name.includes(c.toLowerCase()))) return true;
                    return false;
                })?.value_name ||
                attrs.find((a: any) => {
                    const name = String(a.name || "").toLowerCase();
                    if (contains && contains.some((c) => name.includes(c.toLowerCase()))) return true;
                    return false;
                })?.value_name ||
                ""
            );
        },
        [currentAnalysis?.product_data?.attributes]
    );

    const material = getAttrValue(['MATERIAL'], ['material']);
    const color = getAttrValue(['MAIN_COLOR', 'COLOR'], ['cor', 'color']);

    // Preencher unidades padrão para atributos number_unit
    useEffect(() => {
        const map: Record<string, string> = {};
        const attrs = currentAnalysis?.product_data?.attributes || [];
        const catAttrs = categoryAttrs || [];

        attrs.forEach((attr: any) => {
            if (attr?.value_struct?.unit) {
                map[attr.id] = String(attr.value_struct.unit);
            }
        });

        catAttrs.forEach((attr: any) => {
            if (attr?.value_type === 'number_unit' && !map[attr.id]) {
                const defaultUnit = attr?.default_unit || attr?.allowed_units?.[0]?.id || attr?.allowed_units?.[0]?.name;
                if (defaultUnit) map[attr.id] = String(defaultUnit);
            }
        });

        setAttrUnits((prev) => ({ ...map, ...prev }));
    }, [currentAnalysis?.product_data?.attributes, categoryAttrs]);


    const baseColorOptions = useMemo(() => [
        'Preto', 'Branco', 'Cinza', 'Prata', 'Vermelho', 'Azul', 'Verde', 'Amarelo', 'Marrom', 'Rosa', 'Roxo', 'Laranja', 'Bege', 'Dourado'
    ], []);
    const baseSizeOptions = useMemo(() => ({
        padrao: ['PP', 'P', 'M', 'G', 'GG', 'XG'],
        numerico: ['30', '32', '34', '36', '38', '40', '42', '44', '46', '48'],
        unico: ['Único']
    }), []);
    const colorOptionsByCategory = useMemo<Record<string, string[]>>(() => ({
        MLB1051: ['Preto', 'Branco', 'Cinza', 'Prata', 'Azul', 'Vermelho', 'Verde', 'Amarelo'],
        MLB1430: ['Preto', 'Branco', 'Cinza', 'Vermelho', 'Azul', 'Verde', 'Amarelo', 'Rosa', 'Roxo', 'Bege'],
    }), []);
    const sizeOptionsByCategory = useMemo<Record<string, { padrao?: string[]; numerico?: string[]; unico?: string[] }>>(() => ({
        MLB1051: { numerico: baseSizeOptions.numerico },
        MLB1430: { padrao: baseSizeOptions.padrao, unico: baseSizeOptions.unico },
    }), [baseSizeOptions]);

    const categoryId = currentAnalysis?.product_data?.category_id as string | undefined;
    const colorOptions = (categoryId && colorOptionsByCategory[categoryId]) || baseColorOptions;
    const sizeOptions = (categoryId && sizeOptionsByCategory[categoryId]) || baseSizeOptions;
    const attrLabels = useMemo(() => ({
        BRAND: "Marca",
        MODEL: "Modelo",
        COLOR: "Cor",
        SIZE: "Tamanho",
        MATERIAL: "Material",
        GTIN: "GTIN/EAN",
        WEIGHT: "Peso",
        DIMENSIONS: "Dimensões"
    }), []);

    // Checklist de score removido (tab desativada)

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

    useEffect(() => {
        if (activeTab === 'apply') {
            loadItemData();
            loadCategoryData();
        }
    }, [activeTab, loadItemData, loadCategoryData]);

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

    const handleAnalyze = async (mlbId: string) => {
        clearError();
        await analyzeProduct(mlbId);
        if (!error) {
            setActiveTab("apply");
        }
    };

    const handleApplySuggestion = (suggestion: any) => {
        // Aplicar sugestão específica
        if (suggestion.action_data) {
            const { field, suggested_value, attribute_id } = suggestion.action_data;

            switch (field) {
                case 'title':
                    if (suggested_value) setEditedTitle(suggested_value);
                    break;
                case 'description':
                    if (suggested_value) setEditedDescription(suggested_value);
                    break;
                case 'model':
                    if (suggested_value) {
                        setEditedModel(suggested_value);
                        // Também aplicar no atributo MODEL se existir
                        setAllAttributes(prev => ({
                            ...prev,
                            'MODEL': suggested_value
                        }));
                    }
                    break;
                case 'attributes':
                    if (attribute_id && suggested_value) {
                        setAllAttributes(prev => ({
                            ...prev,
                            [attribute_id]: suggested_value
                        }));
                    }
                    break;
            }

            // Navegar para aba aplicar
            setActiveTab("apply");

            toast({
                title: "✅ Sugestão aplicada",
                description: `${suggestion.title} foi aplicada. Revise na aba Aplicar.`,
            });
        } else {
            toast({
                title: "ℹ️ Sugestão selecionada",
                description: "Esta sugestão requer ação manual. Verifique a descrição.",
            });
        }
    };

    const handleApplyMultipleSuggestions = (suggestions: any[]) => {
        let appliedCount = 0;

        suggestions.forEach(suggestion => {
            if (suggestion.action_data) {
                const { field, suggested_value, attribute_id } = suggestion.action_data;

                switch (field) {
                    case 'title':
                        if (suggested_value) {
                            setEditedTitle(suggested_value);
                            appliedCount++;
                        }
                        break;
                    case 'description':
                        if (suggested_value) {
                            setEditedDescription(suggested_value);
                            appliedCount++;
                        }
                        break;
                    case 'model':
                        if (suggested_value) {
                            setEditedModel(suggested_value);
                            // Também aplicar no atributo MODEL se existir
                            setAllAttributes(prev => ({
                                ...prev,
                                'MODEL': suggested_value
                            }));
                            appliedCount++;
                        }
                        break;
                    case 'attributes':
                        if (attribute_id && suggested_value) {
                            setAllAttributes(prev => ({
                                ...prev,
                                [attribute_id]: suggested_value
                            }));
                            appliedCount++;
                        }
                        break;
                }
            }
        });

        if (appliedCount > 0) {
            setActiveTab("apply");
            toast({
                title: "✅ Sugestões aplicadas",
                description: `${appliedCount} sugestões foram aplicadas. Revise na aba Aplicar.`,
            });
        } else {
            toast({
                title: "ℹ️ Sugestões selecionadas",
                description: "Algumas sugestões requerem ação manual.",
            });
        }
    };

    const marketAverage: number | undefined = currentAnalysis?.competitive_analysis?.price_analysis?.market_average;
    const pricePosition: string = currentAnalysis?.competitive_analysis?.price_analysis?.price_position || '-';
    const trends: string[] = currentAnalysis?.competitive_analysis?.market_insights?.category_trends || [];
    const preferences: string[] = currentAnalysis?.competitive_analysis?.market_insights?.consumer_preferences || [];

    const buildSeoTemplate = () => {
        const title = editedTitle || currentAnalysis?.product_data?.title || "Produto";

        // Helpers para capitalizar
        const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

        // Atributos
        const brand = allAttributes['BRAND'] || editedBrand || "Outras";
        const material = allAttributes['MATERIAL'] || "Verifique nas características";
        const color = allAttributes['COLOR'] || allAttributes['MAIN_COLOR'] || editedColor || "Verifique nas características";
        const model = allAttributes['MODEL'] || editedModel || "Exclusivo";
        const size = allAttributes['SIZE'] || editedSize || "Único";

        // Valores padrão para template
        const fit = "Ajustável";
        const comfort = "Leve";
        const usage = "Uso diário, Presente";

        // Cabeçalho da descrição
        // Tentativa de limpar o título para usar como "nome do produto" se possível, senão usa o título todo
        // Ex: "Seu Anel Dourado..."
        const head = `Seu ${title} ${model !== "Exclusivo" ? model : ""} em ${material}, ${color}; ${fit}, ${comfort}; ideal para ${usage}.`;

        const sections = [
            head,
            `Características:\n• Marca: ${brand}\n• Material: ${material}\n• Cor/Acabamento: ${color}\n• Formato/Design: ${model}\n• Tamanhos/Medidas: ${size}\n• Ajuste/Conforto: ${fit}, ${comfort}`,
            `Acompanha:\n• 01 unidade embalada e pronta para presente.`,
            `Diferenciais:\n• Não escurece fácil\n• Ajustável\n• Antialérgico`,
            `Cuidados:\n• Evite contato direto com água, suor intenso e produtos químicos\n• Após usar, limpe com flanela seca\n• Guarde separado de outras peças para evitar atrito.`,
            `Envio:\n• Seg a sex: pedidos até 12h saem no mesmo dia\n• Sáb/Dom/Feriados: envio no próximo dia útil`
        ];

        return sections.join('\n\n');
    };


    return (
        <div className="space-y-6 pb-4 container mx-auto w-full max-w-[1800px] px-4 md:px-6 overflow-x-hidden">
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
                    <TabsList className="grid w-full grid-cols-1">
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













































                    <TabsContent value="apply" className="space-y-6">
                        {/* ABA APLICAR COMPLETAMENTE NOVA */}
                        <div className="w-full mx-auto space-y-6">
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
                                    <div className="bg-white dark:bg-zinc-900 rounded-lg p-6 border border-gray-100 dark:border-zinc-800 shadow-sm">
                                        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-6 flex items-center gap-2">
                                            Ficha técnica
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-6 gap-y-8">
                                            {(() => {
                                                const existingAttrsMock = currentAnalysis?.product_data?.attributes || [];
                                                const catAttrs = categoryAttrs || [];
                                                const existingMap = new Map(existingAttrsMock.map((a: any) => [a.id, a]));
                                                const combinedAttrs = [...catAttrs];

                                                existingAttrsMock.forEach((attr: any) => {
                                                    if (!combinedAttrs.find(ca => ca.id === attr.id)) {
                                                        combinedAttrs.push(attr);
                                                    }
                                                });

                                                combinedAttrs.sort((a: any, b: any) => {
                                                    const aReq = a.tags?.required || false;
                                                    const bReq = b.tags?.required || false;
                                                    if (aReq && !bReq) return -1;
                                                    if (!aReq && bReq) return 1;
                                                    return (a.name || a.id).localeCompare(b.name || b.id);
                                                });

                                                if (combinedAttrs.length === 0) {
                                                    return (
                                                        <div className="col-span-full py-12 text-center text-gray-400">
                                                            Nenhum atributo disponível.
                                                        </div>
                                                    );
                                                }

                                                return combinedAttrs.map((attr: any) => {
                                                    const attrId = attr.id;
                                                    const existingAttr = existingMap.get(attrId);
                                                    const optionValues = Array.isArray(attr.values) ? attr.values.filter((v: any) => v?.name) : [];
                                                    const optionMap = new Map(optionValues.map((v: any) => [String(v.id), String(v.name)]));
                                                    const originalValue = existingAttr?.value_name
                                                        || (existingAttr?.value_id ? optionMap.get(String(existingAttr.value_id)) || existingAttr.value_id : '')
                                                        || '';
                                                    const currentValue = allAttributes[attrId] !== undefined ? allAttributes[attrId] : originalValue;
                                                    const isRequired = attr.tags?.required || false;
                                                    const isNumberUnit = attr.value_type === 'number_unit';

                                                    const allowedUnits = Array.isArray(attr.allowed_units)
                                                        ? attr.allowed_units.map((u: any) => u?.id || u?.name).filter(Boolean)
                                                        : [];
                                                    const unitValue = attrUnits[attrId] || existingAttr?.value_struct?.unit || attr.default_unit || allowedUnits[0] || '';

                                                    const numberValue = isNumberUnit
                                                        ? (allAttributes[attrId] !== undefined
                                                            ? allAttributes[attrId]
                                                            : (existingAttr?.value_struct?.number !== undefined
                                                                ? String(existingAttr.value_struct.number)
                                                                : String(originalValue).replace(/[^\d.,-]/g, '').replace(',', '.')))
                                                        : currentValue;

                                                    return (
                                                        <div key={attrId} className="flex flex-col gap-2">
                                                            <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1 min-h-[1.25rem]" title={attr.name}>
                                                                <span className="line-clamp-2 leading-tight">{attr.name || attrId}</span>
                                                                {isRequired && <span className="text-red-500 font-bold shrink-0">*</span>}
                                                            </label>

                                                            {isNumberUnit ? (
                                                                <div className="flex gap-2 w-full">
                                                                    <div className="relative flex-1">
                                                                        <Input
                                                                            value={numberValue}
                                                                            onChange={(e) => setAllAttributes(prev => ({ ...prev, [attrId]: e.target.value }))}
                                                                            className="h-9 w-full bg-white dark:bg-zinc-950 border-gray-300 dark:border-zinc-700 focus:border-blue-500 rounded-md"
                                                                        />
                                                                    </div>
                                                                    <div className="w-[80px]">
                                                                        {allowedUnits.length > 0 ? (
                                                                            <Select
                                                                                value={unitValue}
                                                                                onValueChange={(val) => setAttrUnits((prev) => ({ ...prev, [attrId]: val }))}
                                                                            >
                                                                                <SelectTrigger className="h-9 w-full bg-white dark:bg-zinc-950 border-gray-300 dark:border-zinc-700 rounded-md px-2">
                                                                                    <SelectValue placeholder="un." />
                                                                                </SelectTrigger>
                                                                                <SelectContent>
                                                                                    {allowedUnits.map((u) => (
                                                                                        <SelectItem key={u} value={u}>{u}</SelectItem>
                                                                                    ))}
                                                                                </SelectContent>
                                                                            </Select>
                                                                        ) : (
                                                                            <Input
                                                                                value={unitValue}
                                                                                onChange={(e) => setAttrUnits((prev) => ({ ...prev, [attrId]: e.target.value }))}
                                                                                placeholder="un."
                                                                                className="h-9 w-full bg-white dark:bg-zinc-950 border-gray-300 dark:border-zinc-700 rounded-md text-center"
                                                                            />
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ) : optionValues.length > 0 ? (
                                                                <Select
                                                                    value={currentValue}
                                                                    onValueChange={(val) => setAllAttributes(prev => ({ ...prev, [attrId]: val }))}
                                                                >
                                                                    <SelectTrigger className="h-9 w-full bg-white dark:bg-zinc-950 border-gray-300 dark:border-zinc-700 focus:border-blue-500 rounded-md">
                                                                        <SelectValue placeholder="Selecionar" />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        {optionValues.map((opt: any) => (
                                                                            <SelectItem key={opt.id || opt.name} value={opt.name}>
                                                                                {opt.name}
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            ) : (
                                                                <Input
                                                                    value={currentValue}
                                                                    onChange={(e) => setAllAttributes(prev => ({ ...prev, [attrId]: e.target.value }))}
                                                                    className="h-9 w-full bg-white dark:bg-zinc-950 border-gray-300 dark:border-zinc-700 focus:border-blue-500 rounded-md"
                                                                />
                                                            )}

                                                            {/* Checkbox N/A mock visual (apenas visual para conformidade com ref) */}
                                                            <div className="flex justify-end">
                                                                <span className="text-[10px] text-gray-400 dark:text-zinc-600 cursor-not-allowed select-none">□ N/A</span>
                                                            </div>
                                                        </div>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Descrição: original x otimizada */}
                            <div className="grid md:grid-cols-2 gap-4">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Descrição atual (capturada)</CardTitle>
                                        <CardDescription>
                                            Texto do anúncio no Mercado Livre
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-2">
                                            {loadingItem && (
                                                <div className="text-sm text-gray-500">Carregando descrição...</div>
                                            )}
                                            {!loadingItem && !itemDesc?.plain_text && !itemDesc?.text && (
                                                <div className="text-sm text-gray-500">
                                                    Nenhuma descrição capturada para este anúncio.
                                                </div>
                                            )}
                                            {(itemDesc?.plain_text || itemDesc?.text) && (
                                                <div className="text-sm text-gray-800 whitespace-pre-line bg-gray-50 border rounded-lg p-3 max-h-64 overflow-auto">
                                                    {itemDesc?.plain_text || itemDesc?.text}
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>

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
                            </div>

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
                                                    onCheckedChange={(c) => setApplyAttributes(c === true)}
                                                />
                                                <label htmlFor="apply-attributes" className="text-sm font-medium cursor-pointer">
                                                    Aplicar atributos modificados ({Object.keys(allAttributes).filter(attrId => {
                                                        const existingAttr = currentAnalysis?.product_data?.attributes?.find((a: any) => a.id === attrId);
                                                        const originalValue = existingAttr?.value_name || existingAttr?.value_id || '';
                                                        const currentValue = allAttributes[attrId];
                                                        return currentValue !== originalValue && currentValue !== undefined;
                                                    }).length})
                                                </label>
                                            </div>

                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="apply-model"
                                                    checked={applyModel}
                                                    onCheckedChange={(c) => setApplyModel(c === true)}
                                                />
                                                <label htmlFor="apply-model" className="text-sm font-medium cursor-pointer">
                                                    Aplicar modelo: {(() => {
                                                        const finalModel = allAttributes['MODEL'] || editedModel.trim();
                                                        const originalModel = currentAnalysis?.product_data?.attributes?.find((attr: any) => attr.id === 'MODEL')?.value_name || '';
                                                        const isModified = finalModel !== originalModel;
                                                        const modelText = finalModel ? `"${finalModel.substring(0, 30)}${finalModel.length > 30 ? '...' : ''}"` : '(vazio)';
                                                        return `${modelText}${isModified ? ' *' : ''}`;
                                                    })()}
                                                </label>
                                            </div>

                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="apply-description"
                                                    checked={applyDescription}
                                                    onCheckedChange={(c) => setApplyDescription(c === true)}
                                                />
                                                <label htmlFor="apply-description" className="text-sm font-medium cursor-pointer">
                                                    Aplicar descrição SEO ({editedDescription.trim().length} caracteres)
                                                </label>
                                            </div>

                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="apply-images"
                                                    checked={applyImages}
                                                    onCheckedChange={(c) => setApplyImages(c === true)}
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
                                                    if (applyAttributes) {
                                                        // Iterar sobre todos os atributos editados em allAttributes
                                                        Object.entries(allAttributes).forEach(([attrId, currentValue]) => {
                                                            const existingAttr = currentAnalysis?.product_data?.attributes?.find((a: any) => a.id === attrId);
                                                            const originalValue = existingAttr?.value_name || existingAttr?.value_id || '';
                                                            const attrMeta = (categoryAttrs || []).find((a) => a.id === attrId);

                                                            let finalValue: string | undefined = currentValue;

                                                            if (attrMeta?.value_type === 'number_unit') {
                                                                const unit = attrUnits[attrId] || attrMeta?.default_unit || attrMeta?.allowed_units?.[0]?.id || attrMeta?.allowed_units?.[0]?.name || '';
                                                                finalValue = `${currentValue} ${unit}`.trim();
                                                            }

                                                            // Se o valor for diferente do original (ou se for novo e não vazio), incluir para envio
                                                            if (finalValue !== originalValue && finalValue !== undefined) {
                                                                modifiedAttrs[attrId] = finalValue;
                                                            }
                                                        });
                                                    }

                                                    // Se o atributo MODEL foi modificado, usar ele ao invés do editedModel
                                                    const finalModel = modifiedAttrs['MODEL'] || editedModel.trim();

                                                    const optimizations: OptimizationPayload = {
                                                        description: applyDescription ? editedDescription.trim() : undefined,
                                                        model: applyModel ? finalModel : undefined,
                                                        attributes: applyAttributes ? modifiedAttrs : {}
                                                    };

                                                    const allResults = [];

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
