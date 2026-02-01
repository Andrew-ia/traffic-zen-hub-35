import { useState, useEffect, useCallback, useMemo } from "react";
import { MLBAnalysisResult } from "@/hooks/useMLBAnalyzer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { ShoppingBag, Zap, Target, ExternalLink } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { ImageUpload } from "@/components/analyzer/ImageUpload";

interface MLBAnalysisResultsProps {
    result: MLBAnalysisResult;
    workspaceId?: string;
    onReanalyze?: (mlbId: string) => Promise<any>;
}

// Helpers/Constants
const baseColorOptions = [
    { name: "Preto", id: "PRETO" },
    { name: "Branco", id: "BRANCO" },
    { name: "Vermelho", id: "VERMELHO" },
    { name: "Azul", id: "AZUL" },
    { name: "Verde", id: "VERDE" },
    { name: "Amarelo", id: "AMARELO" },
    { name: "Rosa", id: "ROSA" },
    { name: "Cinza", id: "CINZA" },
    { name: "Bege", id: "BEGE" },
    { name: "Marrom", id: "MARROM" },
    { name: "Roxo", id: "ROXO" },
    { name: "Laranja", id: "LARANJA" },
    { name: "Dourado", id: "DOURADO" },
    { name: "Prateado", id: "PRATEADO" },
    { name: "Transparente", id: "TRANSPARENTE" },
    { name: "Multicolorido", id: "MULTICOLORIDO" },
];

const baseSizeOptions = [
    { name: "P", id: "P" },
    { name: "M", id: "M" },
    { name: "G", id: "G" },
    { name: "GG", id: "GG" },
    { name: "XG", id: "XG" },
    { name: "Único", id: "UNICO" },
];

const colorOptionsByCategory: Record<string, { name: string; id: string }[]> = {
    // Exemplo: 'MLB1234': [{ name: 'Custom Color', id: 'CUSTOM' }]
};

const sizeOptionsByCategory: Record<string, { name: string; id: string }[]> = {
    // Exemplo
};

interface OptimizationPayload {
    description?: string;
    model?: string;
    attributes?: Record<string, string>;
}

type AttributeFunctionGroup = "seo" | "technical" | "other";

const SEO_ATTRIBUTE_IDS = new Set([
    "MODEL",
    "STYLE",
    "COLOR",
    "MAIN_COLOR",
    "SIZE",
    "MATERIAL",
    "FINISH",
    "LINE",
    "COLLECTION",
    "DESIGN",
    "PATTERN",
    "THEME",
    "FORMAT",
]);

const TECHNICAL_ATTRIBUTE_IDS = new Set([
    "BRAND",
    "GENDER",
    "WEIGHT",
    "HEIGHT",
    "WIDTH",
    "LENGTH",
    "DEPTH",
    "DIAMETER",
    "THICKNESS",
    "CONDITION",
    "GTIN",
    "EAN",
    "UPC",
    "MPN",
    "SKU",
    "PACKAGE_HEIGHT",
    "PACKAGE_WIDTH",
    "PACKAGE_LENGTH",
    "PACKAGE_WEIGHT",
    "IS_KIT",
    "UNITS_PER_PACK",
    "UNITS_PER_KIT",
]);

const SEO_NAME_HINTS = [
    "modelo",
    "estilo",
    "cor principal",
    "cor",
    "tamanho",
    "acabamento",
    "linha",
    "colecao",
    "design",
    "formato",
    "padrao",
    "estampa",
    "tema",
];

const TECHNICAL_NAME_HINTS = [
    "marca",
    "genero",
    "condicao",
    "codigo",
    "gtin",
    "ean",
    "mpn",
    "sku",
    "peso",
    "altura",
    "largura",
    "comprimento",
    "profundidade",
    "diametro",
    "espessura",
    "embalagem",
    "fecho",
    "pedra",
    "colar",
    "pingente",
    "kit",
    "personalizado",
    "fonte do produto",
    "unidades",
    "quantidade",
    "inclui caixa",
    "formato de venda",
    "material do",
    "material da",
    "material de",
];

const normalizeAttributeText = (value: string) => value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const hasHintMatch = (name: string, hints: string[]) => hints.some((hint) => name.includes(hint));

const getAttributeFunctionGroup = (attr: any): AttributeFunctionGroup => {
    const id = String(attr?.id || "").toUpperCase();
    const name = normalizeAttributeText(String(attr?.name || ""));

    if (TECHNICAL_ATTRIBUTE_IDS.has(id) || hasHintMatch(name, TECHNICAL_NAME_HINTS)) {
        return "technical";
    }

    if (SEO_ATTRIBUTE_IDS.has(id) || hasHintMatch(name, SEO_NAME_HINTS)) {
        return "seo";
    }

    return "other";
};

export function MLBAnalysisResults({ result: currentAnalysis, workspaceId, onReanalyze }: MLBAnalysisResultsProps) {
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState("apply");

    // Editing state
    const [editedTitle, setEditedTitle] = useState("");
    const [editedDescription, setEditedDescription] = useState("");
    const [editedModel, setEditedModel] = useState("");
    const [editedBrand, setEditedBrand] = useState("");
    const [editedColor, setEditedColor] = useState("");
    const [editedSize, setEditedSize] = useState("");
    const [allAttributes, setAllAttributes] = useState<Record<string, string>>({});
    const [attrUnits, setAttrUnits] = useState<Record<string, string>>({});

    const [titleError, setTitleError] = useState<string | null>(null);
    const [descriptionError, setDescriptionError] = useState<string | null>(null);
    const [warnings, setWarnings] = useState<string[]>([]);

    const [originalSnapshot, setOriginalSnapshot] = useState<any>(null);

    // Apply state
    const [applyAttributes, setApplyAttributes] = useState(true);
    const [applyModel, setApplyModel] = useState(true);
    const [applyDescription, setApplyDescription] = useState(true);
    const [applyImages, setApplyImages] = useState(true);
    const [isApplying, setIsApplying] = useState(false);
    const [lastApplication, setLastApplication] = useState<any>(null);
    const [applyError, setApplyError] = useState<any>(null);

    // Image upload state
    const [newImagePictureIds, setNewImagePictureIds] = useState<string[]>([]);

    // Loading states
    const [loadingItem, setLoadingItem] = useState(false);
    const [itemError, setItemError] = useState<string | null>(null);
    const [itemJson, setItemJson] = useState<any>(null);
    const [itemDesc, setItemDesc] = useState<any>(null);
    const [showItemJson, setShowItemJson] = useState(false);

    const [loadingCategory, setLoadingCategory] = useState(false);
    const [categoryError, setCategoryError] = useState<string | null>(null);
    const [categoryData, setCategoryData] = useState<any>(null);
    const [categoryAttrs, setCategoryAttrs] = useState<any[] | null>(null);
    const [showCategory, setShowCategory] = useState(false);

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

            // Populate allAttributes
            const initialAttributes: Record<string, string> = {};
            const initialUnits: Record<string, string> = {};
            attrs.forEach((a: any) => {
                const valueName = typeof a.value_name === 'string' ? a.value_name.trim() : '';
                if (valueName) {
                    initialAttributes[a.id] = valueName;
                }
                if (a?.value_struct?.unit) {
                    initialUnits[a.id] = String(a.value_struct.unit);
                }
            });
            setAllAttributes(initialAttributes);
            setAttrUnits(initialUnits);

            setOriginalSnapshot({
                title: currentAnalysis.product_data.title,
                model: (attrs.find((a: any) => a.id === 'MODEL')?.value_name) || '',
                attrs: {} // Could populate if needed
            });
        }
    }, [currentAnalysis]);

    const loadItemData = useCallback(async () => {
        if (!currentAnalysis?.mlb_id || !workspaceId) return;
        setLoadingItem(true);
        setItemError(null);
        setShowItemJson(true);
        try {
            const itemResp = await fetch(`/api/integrations/mercadolivre/items/${currentAnalysis.mlb_id}?workspaceId=${workspaceId}`);
            const itemData = await itemResp.json();
            setItemJson(itemData);
            try {
                const descResp = await fetch(`/api/integrations/mercadolivre/items/${currentAnalysis.mlb_id}/description?workspaceId=${workspaceId}`);
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
    }, [currentAnalysis?.mlb_id, workspaceId]);

    const loadCategoryData = useCallback(async () => {
        const catId = currentAnalysis?.product_data?.category_id;
        if (!catId || !workspaceId) return;
        setLoadingCategory(true);
        setCategoryError(null);
        setShowCategory(true);
        try {
            const catResp = await fetch(`/api/integrations/mercadolivre/categories/${catId}?workspaceId=${workspaceId}`);
            const catData = await catResp.json();
            setCategoryData(catData);
            try {
                const attrResp = await fetch(`/api/integrations/mercadolivre/categories/${catId}/attributes?workspaceId=${workspaceId}`);
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
    }, [currentAnalysis?.product_data?.category_id, workspaceId]);

    useEffect(() => {
        if (activeTab === 'apply') {
            loadItemData();
            loadCategoryData();
        }
    }, [activeTab, loadItemData, loadCategoryData]);

    const buildSeoTemplate = () => {
        const title = editedTitle || currentAnalysis?.product_data?.title || "Produto";

        const brand = allAttributes['BRAND'] || editedBrand || "Outras";
        const material = allAttributes['MATERIAL'] || "Verifique nas características";
        const color = allAttributes['COLOR'] || allAttributes['MAIN_COLOR'] || editedColor || "Verifique nas características";
        const model = allAttributes['MODEL'] || editedModel || "Exclusivo";
        const size = allAttributes['SIZE'] || editedSize || "Único";

        const fit = "Ajustável";
        const comfort = "Leve";
        const usage = "Uso diário, Presente";

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

    const applyOptimizations = async (mlbId: string, payload: OptimizationPayload) => {
        setIsApplying(true);
        setApplyError(null);
        setLastApplication(null);

        try {
            // Note: This endpoint should be implemented in backend if not exists
            const response = await fetch('/api/integrations/mercadolivre/apply-optimizations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mlbId,
                    workspaceId,
                    optimizations: payload
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Falha ao aplicar otimizações');
            }

            const result = await response.json();
            setLastApplication(result);
            return result;
        } catch (err: any) {
            setApplyError({ error: err.message, details: err.toString() });
            toast({
                title: "❌ Erro ao aplicar",
                description: err.message,
                variant: "destructive",
            });
            return { success: false };
        } finally {
            setIsApplying(false);
        }
    };

    if (!currentAnalysis) return null;

    return (
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

            <TabsContent value="apply" className="space-y-6">
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
                                <div className="space-y-6">
                                    {(() => {
                                        const existingAttrsMock = currentAnalysis?.product_data?.attributes || [];
                                        const catAttrs = categoryAttrs || [];
                                        const existingMap = new Map(existingAttrsMock.map((a: any) => [a.id, a]));
                                        const combinedAttrs = [...catAttrs];
                                        const isReadOnlyAttr = (attr: any) => Boolean(attr?.tags?.read_only);

                                        existingAttrsMock.forEach((attr: any) => {
                                            if (!combinedAttrs.find(ca => ca.id === attr.id)) {
                                                combinedAttrs.push(attr);
                                            }
                                        });

                                        const visibleAttrs = combinedAttrs.filter((attr: any) => !isReadOnlyAttr(attr));

                                        visibleAttrs.sort((a: any, b: any) => {
                                            const aReq = a.tags?.required || false;
                                            const bReq = b.tags?.required || false;
                                            if (aReq && !bReq) return -1;
                                            if (!aReq && bReq) return 1;
                                            return (a.name || a.id).localeCompare(b.name || b.id);
                                        });

                                        if (visibleAttrs.length === 0) {
                                            return (
                                                <div className="col-span-full py-12 text-center text-gray-400">
                                                    Nenhum atributo disponível.
                                                </div>
                                            );
                                        }

                                        const groupedAttrs: Record<AttributeFunctionGroup, any[]> = {
                                            seo: [],
                                            technical: [],
                                            other: []
                                        };

                                        visibleAttrs.forEach((attr: any) => {
                                            const groupKey = getAttributeFunctionGroup(attr);
                                            groupedAttrs[groupKey].push(attr);
                                        });

                                        const attributeGroups = [
                                            {
                                                key: "seo",
                                                title: "Funções de Busca SEO",
                                                description: "Atributos que ajudam na busca interna e relevância",
                                                attrs: groupedAttrs.seo
                                            },
                                            {
                                                key: "technical",
                                                title: "Funções técnicas",
                                                description: "Especificações técnicas, identificação e medidas",
                                                attrs: groupedAttrs.technical
                                            },
                                            {
                                                key: "other",
                                                title: "Outros atributos",
                                                description: "Demais campos da categoria",
                                                attrs: groupedAttrs.other
                                            }
                                        ];

                                        const renderAttributeField = (attr: any) => {
                                            const attrId = attr.id;
                                            const existingAttr = existingMap.get(attrId);
                                            const optionValues = Array.isArray(attr.values) ? attr.values.filter((v: any) => v?.name) : [];
                                            const optionMap = new Map(optionValues.map((v: any) => [String(v.id), String(v.name)]));
                                            const originalValue = (existingAttr?.value_name && String(existingAttr.value_name).trim())
                                                || (existingAttr?.value_id ? (optionMap.get(String(existingAttr.value_id)) || String(existingAttr.value_id)) : '')
                                                || '';
                                            const manualValue = allAttributes[attrId];
                                            const currentValue = manualValue !== undefined ? manualValue : originalValue;
                                            const normalizeOpt = (val: string) => String(val || '').trim().toLowerCase();
                                            const matchedOption = currentValue
                                                ? optionValues.find((opt: any) => normalizeOpt(opt?.name) === normalizeOpt(currentValue))
                                                : undefined;
                                            const selectValue = matchedOption?.name || currentValue || '';
                                            const renderOptions = selectValue && !optionValues.some((opt: any) => opt?.name === selectValue)
                                                ? [{ id: '__current__', name: selectValue }, ...optionValues]
                                                : optionValues;
                                            const listId = renderOptions.length > 0
                                                ? `attr-${String(attrId).replace(/[^a-zA-Z0-9_-]/g, "_")}`
                                                : undefined;
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
                                                        {attr.tags?.hidden && !attr.tags?.read_only && (
                                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                                                oculto
                                                            </span>
                                                        )}
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
                                                                            {allowedUnits.map((u: any) => (
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
                                                    ) : (
                                                        <div className="flex flex-col gap-1">
                                                            <Input
                                                                list={listId}
                                                                value={selectValue}
                                                                onChange={(e) => setAllAttributes(prev => ({ ...prev, [attrId]: e.target.value }))}
                                                                className="h-9 w-full bg-white dark:bg-zinc-950 border-gray-300 dark:border-zinc-700 focus:border-blue-500 rounded-md"
                                                            />
                                                            {listId ? (
                                                                <>
                                                                    <datalist id={listId}>
                                                                        {renderOptions.map((opt: any) => (
                                                                            <option key={opt.id || opt.name} value={opt.name} />
                                                                        ))}
                                                                    </datalist>
                                                                    <span className="text-[10px] text-muted-foreground">
                                                                        Digite livremente ou escolha uma opção sugerida.
                                                                    </span>
                                                                </>
                                                            ) : null}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        };

                                        return attributeGroups
                                            .filter((group) => group.attrs.length > 0)
                                            .map((group) => (
                                                <div
                                                    key={group.key}
                                                    className="rounded-xl border border-gray-100 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/40 p-4 sm:p-5 shadow-sm"
                                                >
                                                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                                                        <div>
                                                            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                                                                {group.title}
                                                            </h4>
                                                            <p className="text-xs text-muted-foreground">{group.description}</p>
                                                        </div>
                                                        <Badge variant="outline" className="text-[10px]">
                                                            {group.attrs.length} atributos
                                                        </Badge>
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-6 gap-y-8">
                                                        {group.attrs.map(renderAttributeField)}
                                                    </div>
                                                </div>
                                            ));
                                    })()}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Descrição */}
                    <div className="grid md:grid-cols-2 gap-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Descrição atual</CardTitle>
                                <CardDescription>Texto do anúncio no Mercado Livre</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {loadingItem && <div className="text-sm text-gray-500">Carregando descrição...</div>}
                                    {!loadingItem && !itemDesc?.plain_text && !itemDesc?.text && (
                                        <div className="text-sm text-gray-500">Nenhuma descrição capturada.</div>
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
                                <CardDescription>Descrição otimizada para melhor rankeamento</CardDescription>
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

                    {/* Image Upload */}
                    <ImageUpload
                        existingImages={currentAnalysis?.product_data?.pictures?.map((pic: any, index: number) => ({
                            id: `existing-${index}`,
                            url: pic.secure_url || pic.url,
                            size: pic.size
                        })) || []}
                        onImagesChange={setNewImagePictureIds}
                    />

                    {/* Apply Button */}
                    <Card className="border-green-200">
                        <CardContent className="p-6 text-center">
                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-xl font-bold text-green-800">Aplicar Modificações Selecionadas</h3>
                                    <p className="text-gray-600 mt-2">Selecione quais modificações você deseja aplicar</p>
                                </div>

                                <div className="flex flex-col space-y-3 max-w-sm mx-auto text-left">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox id="apply-attributes" checked={applyAttributes} onCheckedChange={(c) => setApplyAttributes(c === true)} />
                                        <label htmlFor="apply-attributes" className="text-sm font-medium">Aplicar atributos modificados</label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox id="apply-model" checked={applyModel} onCheckedChange={(c) => setApplyModel(c === true)} />
                                        <label htmlFor="apply-model" className="text-sm font-medium">Aplicar modelo</label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox id="apply-description" checked={applyDescription} onCheckedChange={(c) => setApplyDescription(c === true)} />
                                        <label htmlFor="apply-description" className="text-sm font-medium">Aplicar descrição</label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox id="apply-images" checked={applyImages} onCheckedChange={(c) => setApplyImages(c === true)} />
                                        <label htmlFor="apply-images" className="text-sm font-medium">Adicionar novas imagens ({newImagePictureIds.length})</label>
                                    </div>
                                </div>

                                <div className="flex gap-3 justify-center">
                                    <Button
                                        size="lg"
                                        className="bg-green-600 hover:bg-green-700 text-white px-8"
                                        disabled={isApplying}
                                        onClick={async () => {
                                            if (!currentAnalysis) return;

                                            const modifiedAttrs: Record<string, string> = {};
                                            if (applyAttributes) {
                                                Object.entries(allAttributes).forEach(([attrId, currentValue]) => {
                                                    const existingAttr = currentAnalysis?.product_data?.attributes?.find((a: any) => a.id === attrId);
                                                    const originalValue = existingAttr?.value_name || existingAttr?.value_id || '';
                                                    const attrMeta = (categoryAttrs || []).find((a: any) => a.id === attrId);

                                                    let finalValue: string | undefined = currentValue;
                                                    if (attrMeta?.value_type === 'number_unit') {
                                                        const unit = attrUnits[attrId] || attrMeta?.default_unit || attrMeta?.allowed_units?.[0]?.id || attrMeta?.allowed_units?.[0]?.name || '';
                                                        finalValue = `${currentValue} ${unit}`.trim();
                                                    }

                                                    if (finalValue !== originalValue && finalValue !== undefined) {
                                                        modifiedAttrs[attrId] = finalValue;
                                                    }
                                                });
                                            }

                                            const optimizations: OptimizationPayload = {
                                                description: applyDescription ? editedDescription.trim() : undefined,
                                                model: applyModel ? editedModel.trim() : undefined,
                                                attributes: applyAttributes ? modifiedAttrs : {}
                                            };

                                            const result = await applyOptimizations(currentAnalysis.mlb_id, optimizations);

                                            // Handle images separately if needed, passing pictureIds
                                            if (applyImages && newImagePictureIds.length > 0) {
                                                // Call add-pictures API here or inside applyOptimizations
                                                // For now assumes applied via logic or TODO
                                                try {
                                                    await fetch('/api/integrations/mercadolivre/add-pictures', {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({
                                                            mlbId: currentAnalysis.mlb_id,
                                                            workspaceId,
                                                            pictureIds: newImagePictureIds
                                                        })
                                                    });
                                                } catch (e) {
                                                    console.error('Error adding images', e);
                                                }
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

                                {lastApplication && (
                                    <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                                        <div className="font-medium text-green-800 mb-2">✅ Aplicado com sucesso!</div>
                                        <div className="text-sm text-green-700">
                                            Alterações: {lastApplication.changes_applied?.join(', ')}
                                        </div>
                                    </div>
                                )}
                                {applyError && (
                                    <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                                        <div className="font-medium text-red-800 mb-2">❌ {applyError.error}</div>
                                        <div className="text-sm text-red-700">{applyError.details}</div>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </TabsContent>
        </Tabs>
    );
}
