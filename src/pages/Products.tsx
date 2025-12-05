import { useState } from "react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct, useDuplicateProduct, useDeletedProducts, useRestoreProduct, useGenerateDescription, Product } from "@/hooks/useProducts";
import { useSmartCategorySelector, MLCategory, CategoryPrediction } from "@/hooks/useMercadoLivreCategories";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Package, Plus, Search, Upload, Image as ImageIcon, Edit, Trash2, Copy, Archive, RotateCcw, Sparkles, Calculator, TrendingUp, DollarSign, Zap, Target, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { useMercadoLivreListings } from "@/hooks/useMercadoLivre";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type MLAttributeField = {
    id: string;
    label: string;
    placeholder?: string;
    type?: "text" | "number" | "select";
    options?: { value_id: string; label: string }[];
    helperText?: string;
};

const ML_ATTRIBUTE_FIELDS: MLAttributeField[] = [
    { id: "MATERIAL", label: "Material", placeholder: "Ouro 18k, Aço inox, Couro..." },
    { id: "COLOR", label: "Cor", placeholder: "Dourado, Prateado, Preto..." },
    { 
        id: "SELLING_FORMAT", 
        label: "Formato da venda", 
        type: "select",
        options: [
            { value_id: "UNIT", label: "Unidade" },
            { value_id: "KIT", label: "Kit" },
            { value_id: "PACK", label: "Pack / Caixa" },
            { value_id: "PAIR", label: "Par" },
        ],
        helperText: "Como o produto é vendido no anúncio",
    },
    { id: "MODEL", label: "Modelo", placeholder: "Ex: Air Max 2024, Anel Solitário" },
    { id: "TYPE", label: "Tipo", placeholder: "Ex: Tênis, Anel, Colar" },
    { id: "STYLE", label: "Estilo", placeholder: "Casual, Clássico, Esportivo..." },
    { id: "LENGTH", label: "Comprimento (cm)", type: "number", placeholder: "Ex: 25" },
    { id: "WIDTH", label: "Largura (cm)", type: "number", placeholder: "Ex: 10" },
    { id: "DIAMETER", label: "Diâmetro (cm)", type: "number", placeholder: "Ex: 2.5" },
    { 
        id: "HAS_STONE", 
        label: "Com pedra?", 
        type: "select",
        options: [
            { value_id: "YES", label: "Sim" },
            { value_id: "NO", label: "Não" }
        ],
        helperText: "Útil para joias e semijoias",
    },
    { id: "PIECES_PER_PACK", label: "Qtd. de peças (kit)", type: "number", placeholder: "Ex: 12" },
];

const ML_ATTRIBUTE_IDS = ML_ATTRIBUTE_FIELDS.map(field => field.id);

export default function Products() {
    const { currentWorkspace } = useWorkspace();
    const workspaceId = currentWorkspace?.id || null;
    const { toast } = useToast();

    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [activeTab, setActiveTab] = useState("general");
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [productToDelete, setProductToDelete] = useState<string | null>(null);
    const [productToDuplicate, setProductToDuplicate] = useState<any | null>(null);
    const [duplicateOptions, setDuplicateOptions] = useState({
        title: '',
        sku: '',
        modifyTitle: true,
        modifySku: true,
        resetStock: false,
        resetImages: false
    });
    const [trashDialogOpen, setTrashDialogOpen] = useState(false);
    const [mlPage, setMlPage] = useState(1);

    const [formData, setFormData] = useState<Partial<Product>>({
        title: "",
        sku: "",
        description: "",
        price: 0,
        cost_price: 0,
        original_price: 0,
        available_quantity: 0,
        ml_full_stock: 0,
        ml_normal_stock: 0,
        reserved_stock: 0,
        minimum_stock: 0,
        condition: "new",
        ml_listing_type: "gold_special",
        ml_category_id: "",
        attributes: [],
        weight_kg: 0,
        height_cm: 0,
        width_cm: 0,
        length_cm: 0,
        free_shipping: false,
        images: [],
    });

    // Estados para precificação
    const [pricingData, setPricingData] = useState({
        cost_price: 0,
        additional_costs: 0, // custos adicionais (frete, embalagem, etc)
        profit_margin: 30, // margem em %
        marketplace_fee: 12, // taxa da plataforma (ML = ~12%)
        advertising_cost: 5, // custo de publicidade em %
        operational_cost: 8, // custo operacional em %
    });

    // Estados para categorias ML
    const [suggestedCategories, setSuggestedCategories] = useState<CategoryPrediction[]>([]);
    const [categorySearch, setCategorySearch] = useState("");
    const [attributeValues, setAttributeValues] = useState<Record<string, string>>({});
    const [otherAttributes, setOtherAttributes] = useState<any[]>([]);
    const [newAttribute, setNewAttribute] = useState({ id: "", name: "", value: "" });

    const [imageUrl, setImageUrl] = useState("");
    const [isUploading, setIsUploading] = useState(false);
    const [dragActive, setDragActive] = useState(false);

    const { data, isLoading } = useProducts(workspaceId, {
        search,
        page,
        limit: 20,
    });

    const mlLimit = 10;
    const mlListings = useMercadoLivreListings(workspaceId, mlPage, mlLimit);

    const createMutation = useCreateProduct();
    const updateMutation = useUpdateProduct();
    const deleteMutation = useDeleteProduct();
    const duplicateMutation = useDuplicateProduct();
    const deletedProductsQuery = useDeletedProducts(workspaceId);
    const restoreMutation = useRestoreProduct();
    const generateDescriptionMutation = useGenerateDescription();
    const { suggestCategory, searchByText, allCategories, isLoadingPrediction, isLoadingSearch } = useSmartCategorySelector();
    const isLoadingCategories = isLoadingPrediction || isLoadingSearch;

    const formatAttributeValue = (field: MLAttributeField, rawValue?: string) => {
        if (rawValue === undefined || rawValue === null) return null;
        const trimmed = String(rawValue).trim();
        if (!trimmed) return null;

        let valueId: string | undefined;
        let valueName: string | undefined = trimmed;

        if (field.type === "select" && field.options) {
            const option = field.options.find(opt => opt.value_id === trimmed || opt.label.toLowerCase() === trimmed.toLowerCase());
            valueId = option?.value_id;
            valueName = option?.label || trimmed;
        }

        return {
            id: field.id,
            name: field.label,
            value_id: valueId,
            value_name: valueName
        };
    };

    const buildAttributesPayload = (values: Record<string, string>, extras: any[] = otherAttributes) => {
        const formatted = ML_ATTRIBUTE_FIELDS
            .map(field => formatAttributeValue(field, values[field.id]))
            .filter(Boolean) as any[];

        const filteredExtras = (extras || []).filter(attr => !ML_ATTRIBUTE_IDS.includes(attr.id));
        return [...filteredExtras, ...formatted];
    };

    const setAttributesFromValues = (values: Record<string, string>, extras: any[] = []) => {
        setAttributeValues(values);
        setOtherAttributes(extras);
        setFormData(prev => ({
            ...prev,
            attributes: buildAttributesPayload(values, extras)
        }));
    };

    const hydrateAttributes = (attributes: any[] = []) => {
        const values: Record<string, string> = {};
        const extras: any[] = [];

        attributes.forEach(attr => {
            if (ML_ATTRIBUTE_IDS.includes(attr.id)) {
                values[attr.id] = attr.value_id || attr.value_name || "";
            } else {
                extras.push(attr);
            }
        });

        setAttributesFromValues(values, extras);
    };

    const handleAttributeChange = (field: MLAttributeField, value: string) => {
        setAttributeValues(prev => {
            const next = { ...prev, [field.id]: value };
            setFormData(form => ({
                ...form,
                attributes: buildAttributesPayload(next, otherAttributes)
            }));
            return next;
        });
    };

    const handleAddCustomAttribute = () => {
        if (!newAttribute.id.trim() || !newAttribute.value.trim()) {
            toast({
                title: "Atributo incompleto",
                description: "Preencha ID e valor para adicionar.",
                variant: "destructive",
            });
            return;
        }

        const attrId = newAttribute.id.trim().toUpperCase();
        const attrName = newAttribute.name.trim() || attrId;
        const attrValue = newAttribute.value.trim();

        if (ML_ATTRIBUTE_IDS.includes(attrId)) {
            const field = ML_ATTRIBUTE_FIELDS.find(f => f.id === attrId);
            if (field) {
                handleAttributeChange(field, attrValue);
            }
            setNewAttribute({ id: "", name: "", value: "" });
            return;
        }

        const updatedExtras = [
            ...otherAttributes.filter(attr => attr.id !== attrId),
            { id: attrId, name: attrName, value_name: attrValue }
        ];

        setOtherAttributes(updatedExtras);
        setFormData(form => ({
            ...form,
            attributes: buildAttributesPayload(attributeValues, updatedExtras)
        }));
        setNewAttribute({ id: "", name: "", value: "" });
    };

    const handleRemoveCustomAttribute = (attrId: string) => {
        const updatedExtras = otherAttributes.filter(attr => attr.id !== attrId);
        setOtherAttributes(updatedExtras);
        setFormData(form => ({
            ...form,
            attributes: buildAttributesPayload(attributeValues, updatedExtras)
        }));
    };

    const resetForm = () => {
        setFormData({
            title: "",
            sku: "",
            description: "",
            price: 0,
            cost_price: 0,
            original_price: 0,
            available_quantity: 0,
            ml_full_stock: 0,
            ml_normal_stock: 0,
            reserved_stock: 0,
            minimum_stock: 0,
            condition: "new",
            ml_listing_type: "gold_special",
            ml_category_id: "",
            attributes: [],
            weight_kg: 0,
            height_cm: 0,
            width_cm: 0,
            length_cm: 0,
            free_shipping: false,
            images: [],
        });
        setSuggestedCategories([]);
        setCategorySearch("");
        setAttributesFromValues({}, []);
        setNewAttribute({ id: "", name: "", value: "" });
        setEditingProduct(null);
        setActiveTab("general");
    };

    const createExampleProduct = () => {
        const exampleAttributeValues: Record<string, string> = {
            MATERIAL: "Sintético premium",
            COLOR: "Preto/Branco",
            SELLING_FORMAT: "UNIT",
            MODEL: "Air Max 2024",
            TYPE: "Tênis",
            STYLE: "Esportivo",
            LENGTH: "25",
            WIDTH: "35",
            HAS_STONE: "NO",
            PIECES_PER_PACK: "1"
        };

        setFormData({
            title: "Tênis Nike Air Max 2024 - Masculino Preto/Branco",
            sku: "NIKE-AM-2024-BLK-42",
            description: `🔥 LANÇAMENTO 2024! 

✅ PRODUTO 100% ORIGINAL NIKE
✅ GARANTIA OFICIAL DE 12 MESES
✅ FRETE GRÁTIS PARA TODO BRASIL

📋 ESPECIFICAÇÕES:
• Marca: Nike
• Modelo: Air Max 2024
• Cor: Preto com detalhes em branco
• Tamanho: 42 BR
• Gênero: Masculino
• Material: Sintético premium + Mesh respirável
• Solado: Borracha antiderrapante com tecnologia Air Max

🎯 PRINCIPAIS CARACTERÍSTICAS:
• Tecnologia Air Max para máximo conforto
• Design moderno e versátil
• Palmilha anatômica removível
• Ventilação superior para pés secos
• Ideal para corrida, caminhada e uso casual

📦 ACOMPANHA:
• Tênis Nike Air Max 2024
• Caixa original Nike
• Manual de cuidados

🚚 ENTREGA EXPRESSA: Receba em 1-2 dias úteis!
💡 Dúvidas? Nosso atendimento está disponível 24h!`,
            price: 389.99,
            cost_price: 180.00,
            original_price: 459.99,
            available_quantity: 25,
            ml_full_stock: 0,
            ml_normal_stock: 0,
            reserved_stock: 0,
            minimum_stock: 0,
            condition: "new",
            ml_listing_type: "gold_special",
            ml_category_id: "MLB1276",
            attributes: buildAttributesPayload(exampleAttributeValues, []),
            weight_kg: 0.8,
            height_cm: 15,
            width_cm: 35,
            length_cm: 25,
            free_shipping: true,
            images: [
                "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500",
                "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=500",
                "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=500"
            ],
        });
        setSuggestedCategories([]);
        setCategorySearch("");
        setAttributesFromValues(exampleAttributeValues, []);
        setEditingProduct(null);
        setActiveTab("general");
        setIsDialogOpen(true);
        toast({
            title: "Produto exemplo carregado!",
            description: "Dados preenchidos automaticamente para demonstração",
        });
    };

    const handleOpenCreate = () => {
        resetForm();
        setIsDialogOpen(true);
    };

    const handleEdit = (product: Product) => {
        setEditingProduct(product);
        setFormData({
            ...product,
            // Ensure numeric fields are numbers
            price: Number(product.price),
            cost_price: Number(product.cost_price || 0),
            original_price: Number(product.original_price || 0),
            available_quantity: Number(product.available_quantity || 0),
            weight_kg: Number(product.weight_kg || 0),
            height_cm: Number(product.height_cm || 0),
            width_cm: Number(product.width_cm || 0),
            length_cm: Number(product.length_cm || 0),
            // Ensure arrays are arrays
            images: product.images || [],
            attributes: product.attributes || [],
        });
        setCategorySearch(product.ml_category_id || "");
        setSuggestedCategories([]);
        hydrateAttributes(product.attributes || []);
        setNewAttribute({ id: "", name: "", value: "" });
        setIsDialogOpen(true);
    };

    const handleSave = async () => {
        if (!workspaceId) return;
        if (!formData.title || !formData.price || formData.price <= 0) {
            toast({
                title: "Erro",
                description: "Preencha título e preço válido",
                variant: "destructive",
            });
            return;
        }

        try {
            const attributesPayload = buildAttributesPayload(attributeValues, otherAttributes);

            if (editingProduct && editingProduct.id) {
                await updateMutation.mutateAsync({
                    id: editingProduct.id,
                    product: {
                        ...formData,
                        attributes: attributesPayload,
                        workspace_id: workspaceId,
                    } as Product,
                });
                toast({ title: "Sucesso!", description: "Produto atualizado com sucesso" });
            } else {
                await createMutation.mutateAsync({
                    ...formData,
                    attributes: attributesPayload,
                    workspace_id: workspaceId,
                } as Product);
                toast({ title: "Sucesso!", description: "Produto criado com sucesso" });
            }

            setIsDialogOpen(false);
            resetForm();
        } catch (error: any) {
            toast({
                title: "Erro",
                description: error.message,
                variant: "destructive",
            });
        }
    };

    const handleDelete = async () => {
        if (!productToDelete || !workspaceId) return;
        try {
            await deleteMutation.mutateAsync({ id: productToDelete, workspaceId });
            toast({ title: "Produto deletado", description: "O produto foi removido da lista principal" });
            setProductToDelete(null);
        } catch (error: any) {
            toast({ title: "Erro", description: error.message, variant: "destructive" });
        }
    };

    const handleDuplicate = (product: any) => {
        setProductToDuplicate(product);
        setDuplicateOptions({
            title: `${product.title} (Cópia)`,
            sku: product.sku ? `${product.sku}-1` : '',
            modifyTitle: true,
            modifySku: true,
            resetStock: false,
            resetImages: false
        });
    };

    const confirmDuplicate = async () => {
        if (!workspaceId || !productToDuplicate) return;
        
        try {
            const modifications: any = {};
            
            if (duplicateOptions.modifyTitle && duplicateOptions.title) {
                modifications.title = duplicateOptions.title;
            }
            
            if (duplicateOptions.modifySku && duplicateOptions.sku) {
                modifications.sku = duplicateOptions.sku;
            }
            
            if (duplicateOptions.resetStock) {
                modifications.available_quantity = 0;
            }
            
            if (duplicateOptions.resetImages) {
                modifications.images = [];
            }
            
            await duplicateMutation.mutateAsync({ 
                id: productToDuplicate.id, 
                workspaceId,
                modifications
            });
            
            toast({ 
                title: "Produto duplicado!", 
                description: "O produto foi duplicado com sucesso" 
            });
            
            setProductToDuplicate(null);
        } catch (error: any) {
            toast({ 
                title: "Erro ao duplicar", 
                description: error.message, 
                variant: "destructive" 
            });
        }
    };

    const handleRestoreProduct = async (productId: string) => {
        if (!workspaceId) return;
        
        try {
            await restoreMutation.mutateAsync({ id: productId, workspaceId });
            toast({ 
                title: "Produto restaurado!", 
                description: "O produto foi restaurado com sucesso" 
            });
        } catch (error: any) {
            toast({ 
                title: "Erro ao restaurar", 
                description: error.message, 
                variant: "destructive" 
            });
        }
    };

    const handleGenerateDescription = async () => {
        if (!formData.title) {
            toast({
                title: "Título necessário",
                description: "Digite o título do produto antes de gerar a descrição",
                variant: "destructive"
            });
            return;
        }

        try {
            const result = await generateDescriptionMutation.mutateAsync({
                title: formData.title,
                category: formData.ml_category_id,
                price: formData.price
            });

            setFormData(prev => ({
                ...prev,
                description: result.description
            }));

            toast({
                title: "Descrição gerada!",
                description: "A descrição foi gerada com IA baseada no título do produto"
            });
        } catch (error: any) {
            toast({
                title: "Erro ao gerar descrição",
                description: error.message,
                variant: "destructive"
            });
        }
    };

    // Funções de precificação
    const calculatePricing = () => {
        const baseCost = pricingData.cost_price + pricingData.additional_costs;
        
        // Custo total com taxas e despesas operacionais
        const totalFeesPercent = pricingData.marketplace_fee + pricingData.advertising_cost + pricingData.operational_cost;
        
        // Preço de venda = (Custo Base) / (1 - (Margem + Taxas) / 100)
        const sellPrice = baseCost / (1 - (pricingData.profit_margin + totalFeesPercent) / 100);
        
        // Lucro líquido por unidade
        const grossProfit = sellPrice - baseCost;
        const totalFees = sellPrice * (totalFeesPercent / 100);
        const netProfit = grossProfit - totalFees;
        
        // ROI (Return on Investment)
        const roi = baseCost > 0 ? (netProfit / baseCost) * 100 : 0;
        
        return {
            suggestedPrice: Math.ceil(sellPrice), // Arredonda para cima
            baseCost,
            grossProfit,
            totalFees,
            netProfit,
            roi,
            marginPercent: baseCost > 0 ? (netProfit / sellPrice) * 100 : 0
        };
    };

    const applyCalculatedPrice = () => {
        const calculation = calculatePricing();
        setFormData(prev => ({
            ...prev,
            price: calculation.suggestedPrice,
            cost_price: pricingData.cost_price
        }));
        
        toast({
            title: "Preço aplicado!",
            description: `Preço de venda: R$ ${calculation.suggestedPrice.toFixed(2)}`,
        });
    };

    // Funções para categorias ML
    const handleAutoSuggestCategory = async () => {
        if (!formData.title || formData.title.length < 3) {
            setSuggestedCategories([]);
            return;
        }

        try {
            const predictions = await suggestCategory(formData.title);
            setSuggestedCategories(predictions);
            
            if (predictions.length > 0) {
                toast({
                    title: "Categorias sugeridas!",
                    description: `${predictions.length} categoria(s) encontrada(s) baseada no título`,
                });
            }
        } catch (error: any) {
            console.error("Error suggesting category:", error);
        }
    };

    const handleCategorySearch = async (query: string) => {
        setCategorySearch(query);
        if (!query || query.length < 2) {
            setSuggestedCategories([]);
            return;
        }

        try {
            const results = await searchByText(query);
            const formattedResults = results.map((cat: any) => ({
                id: cat.id,
                name: cat.name,
                probability: cat.relevance_score / 100,
                predicted: false
            }));
            setSuggestedCategories(formattedResults);
        } catch (error: any) {
            console.error("Error searching categories:", error);
        }
    };

    const selectCategory = (category: CategoryPrediction | MLCategory) => {
        setFormData(prev => ({
            ...prev,
            ml_category_id: category.id
        }));
        setCategorySearch(category.name || category.id);
        
        toast({
            title: "Categoria selecionada!",
            description: category.name,
        });
    };

    const addImage = () => {
        if (imageUrl.trim()) {
            setFormData(prev => ({
                ...prev,
                images: [...(prev.images || []), imageUrl.trim()]
            }));
            setImageUrl("");
            toast({
                title: "Imagem adicionada!",
                description: "URL da imagem foi adicionada com sucesso",
            });
        } else {
            toast({
                title: "URL inválida",
                description: "Por favor, insira uma URL válida de imagem",
                variant: "destructive",
            });
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(true);
    };

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
    };

    const uploadImage = async (file: File): Promise<string> => {
        if (!workspaceId) {
            throw new Error("Workspace não selecionado");
        }

        const formData = new FormData();
        formData.append('image', file);
        formData.append('workspaceId', workspaceId);

        const response = await fetch('/api/upload/image', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erro ao fazer upload da imagem');
        }

        const result = await response.json();
        return result.url;
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        
        const files = Array.from(e.dataTransfer.files);
        const imageFiles = files.filter(file => file.type.startsWith('image/'));
        
        if (imageFiles.length === 0) {
            toast({
                title: "Arquivo inválido",
                description: "Por favor, arraste apenas arquivos de imagem (JPEG, PNG, WebP, GIF)",
                variant: "destructive",
            });
            return;
        }

        await handleImageFiles(imageFiles);
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        await handleImageFiles(files);
        // Limpar o input para permitir selecionar o mesmo arquivo novamente
        e.target.value = '';
    };

    const handleImageFiles = async (files: File[]) => {
        if (!workspaceId) {
            toast({
                title: "Erro",
                description: "Selecione um workspace primeiro",
                variant: "destructive",
            });
            return;
        }

        setIsUploading(true);
        
        try {
            const uploadPromises = files.map(async (file) => {
                // Validar tamanho do arquivo (5MB)
                if (file.size > 5 * 1024 * 1024) {
                    throw new Error(`Arquivo ${file.name} é muito grande (máx. 5MB)`);
                }
                
                return await uploadImage(file);
            });

            const uploadedUrls = await Promise.all(uploadPromises);
            
            // Adicionar as URLs ao estado
            setFormData(prev => ({
                ...prev,
                images: [...(prev.images || []), ...uploadedUrls]
            }));

            toast({
                title: "Upload concluído!",
                description: `${files.length} imagem(ns) adicionada(s) com sucesso`,
            });

        } catch (error: any) {
            console.error('Upload error:', error);
            toast({
                title: "Erro no upload",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setIsUploading(false);
        }
    };

    const removeImage = (index: number) => {
        setFormData(prev => ({
            ...prev,
            images: prev.images?.filter((_, i) => i !== index)
        }));
    };

    if (!workspaceId) {
        return (
            <div className="space-y-4">
                <h1 className="text-4xl font-bold">Produtos</h1>
                <p className="text-muted-foreground">Selecione um workspace</p>
            </div>
        );
    }

    const products = data?.products || [];
    const total = data?.total || 0;

    return (
        <div className="space-y-6 pb-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-4xl font-bold flex items-center gap-3">
                        <Package className="h-10 w-10 text-primary" />
                        Produtos
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Catálogo centralizado para publicação no Mercado Livre
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" className="gap-2" onClick={() => setTrashDialogOpen(true)}>
                        <Archive className="h-4 w-4" />
                        Lixeira{deletedProductsQuery.data?.products?.length ? ` (${deletedProductsQuery.data.products.length})` : ''}
                    </Button>
                    <Button variant="outline" className="gap-2" onClick={createExampleProduct}>
                        <Package className="h-4 w-4" />
                        Produto Exemplo
                    </Button>
                    <Button className="gap-2" onClick={handleOpenCreate}>
                        <Plus className="h-4 w-4" />
                        Novo Produto
                    </Button>
                </div>
            </div>

            {/* Search */}
            <Card>
                <CardContent className="p-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por título, SKU ou descrição..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Estoques */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Estoque Full</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {new Intl.NumberFormat("pt-BR").format((data?.products || []).reduce((sum: number, p: any) => sum + Number(p.ml_full_stock || 0), 0))}
                        </div>
                        <p className="text-sm text-muted-foreground">Itens alocados no ML Full</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Estoque Normal</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {new Intl.NumberFormat("pt-BR").format((data?.products || []).reduce((sum: number, p: any) => sum + Number(p.ml_normal_stock || 0), 0))}
                        </div>
                        <p className="text-sm text-muted-foreground">Itens para anúncios normais</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Estoque Total</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {new Intl.NumberFormat("pt-BR").format((data?.products || []).reduce((sum: number, p: any) => sum + Number(p.available_quantity || 0), 0))}
                        </div>
                        <p className="text-sm text-muted-foreground">Soma do catálogo interno</p>
                    </CardContent>
                </Card>
            </div>

            {/* Anúncios Mercado Livre (paginação) */}
            <Card>
                <CardHeader className="flex items-center justify-between">
                    <CardTitle>Anúncios Mercado Livre</CardTitle>
                    <div className="text-sm text-muted-foreground">
                        Total: {mlListings.data?.totalCount ?? 0} • Ativos: {mlListings.data?.activeCount ?? 0}
                        {mlListings.data?.items && (
                            <>
                                {' '}• Full: {mlListings.data.items.filter((x: any) => x.isFull).length}
                                {' '}• Normal: {mlListings.data.items.filter((x: any) => !x.isFull).length}
                            </>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    {mlListings.isLoading ? (
                        <div className="space-y-3">
                            {[...Array(5)].map((_, i) => (
                                <Skeleton key={i} className="h-20 w-full" />
                            ))}
                        </div>
                    ) : (mlListings.data?.items?.length ?? 0) === 0 ? (
                        <div className="text-center py-12">
                            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                            <h3 className="text-lg font-semibold mb-2">Nenhum anúncio encontrado</h3>
                            <p className="text-muted-foreground">Conecte o Mercado Livre para listar seus anúncios</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-muted-foreground">
                                            <th className="p-2">Produto</th>
                                            <th className="p-2">MLB</th>
                                            <th className="p-2 text-right">Preço</th>
                                            <th className="p-2 text-right">Vendas</th>
                                            <th className="p-2 text-right">Visitas</th>
                                            <th className="p-2 text-right">Estoque</th>
                                            <th className="p-2">Tipo</th>
                                            <th className="p-2">Status</th>
                                            <th className="p-2">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {mlListings.data?.items.map((item: any) => (
                                            <tr key={item.id} className="border-t">
                                                <td className="p-2">
                                                    <div className="flex items-center gap-2">
                                                        {item.thumbnail && (
                                                            <img src={item.thumbnail} alt={item.title} className="h-8 w-8 rounded object-cover" />
                                                        )}
                                                        <span className="line-clamp-1" title={item.title}>{item.title}</span>
                                                    </div>
                                                </td>
                                                <td className="p-2 font-mono text-xs">{item.id}</td>
                                                <td className="p-2 text-right">
                                                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.price)}
                                                </td>
                                                <td className="p-2 text-right">{item.sales}</td>
                                                <td className="p-2 text-right">{new Intl.NumberFormat("pt-BR").format(item.visits)}</td>
                                                <td className="p-2 text-right">{item.stock}</td>
                                                <td className="p-2">
                                                    <span className={`text-xs px-2 py-1 rounded ${item.isFull ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>{item.isFull ? 'Full' : 'Normal'}</span>
                                                </td>
                                                <td className="p-2">
                                                    <span className={`text-xs px-2 py-1 rounded ${item.status === 'active' ? 'bg-green-100 text-green-700' : item.status === 'paused' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'}`}>{item.status}</span>
                                                </td>
                                                <td className="p-2">
                                                    <div className="flex items-center gap-1">
                                                        <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => window.open(`https://mercadolivre.com.br/p/${item.id}`, '_blank')}>Abrir</Button>
                                                        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => navigator.clipboard.writeText(item.id)}>Copiar</Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex justify-center">
                                <Pagination>
                                    <PaginationContent>
                                        <PaginationItem>
                                            <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); if (mlPage > 1) setMlPage(mlPage - 1); }} />
                                        </PaginationItem>
                                        <PaginationItem>
                                            <PaginationLink href="#" isActive>{mlListings.data?.page ?? mlPage}</PaginationLink>
                                        </PaginationItem>
                                        <PaginationItem>
                                            <PaginationNext href="#" onClick={(e) => { e.preventDefault(); const maxPages = Math.ceil((mlListings.data?.totalCount ?? 0) / mlLimit); if (mlPage < maxPages) setMlPage(mlPage + 1); }} />
                                        </PaginationItem>
                                    </PaginationContent>
                                </Pagination>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Products List */}
            <Card>
                <CardHeader>
                    <CardTitle>
                        {total} produto{total !== 1 ? "s" : ""} encontrado{total !== 1 ? "s" : ""}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="space-y-3">
                            {[...Array(5)].map((_, i) => (
                                <Skeleton key={i} className="h-20 w-full" />
                            ))}
                        </div>
                    ) : products.length === 0 ? (
                        <div className="text-center py-12">
                            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                            <h3 className="text-lg font-semibold mb-2">Nenhum produto encontrado</h3>
                            <p className="text-muted-foreground mb-4">
                                Crie seu primeiro produto para começar ou use um exemplo
                            </p>
                            <div className="flex gap-2 justify-center">
                                <Button variant="outline" onClick={createExampleProduct}>
                                    <Package className="h-4 w-4 mr-2" />
                                    Produto Exemplo
                                </Button>
                                <Button onClick={handleOpenCreate}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Criar Produto
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {products.map((product: any) => (
                                <div
                                    key={product.id}
                                    className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors group"
                                >
                                    {product.images?.[0] ? (
                                        <img
                                            src={product.images[0]}
                                            alt={product.title}
                                            className="h-16 w-16 object-cover rounded"
                                        />
                                    ) : (
                                        <div className="h-16 w-16 bg-muted rounded flex items-center justify-center">
                                            <Package className="h-8 w-8 text-muted-foreground" />
                                        </div>
                                    )}

                                    <div className="flex-1">
                                        <h3 className="font-semibold">{product.title}</h3>
                                        <p className="text-sm text-muted-foreground">
                                            {product.sku && `SKU: ${product.sku}`}
                                            {product.ml_item_id && ` • ML: ${product.ml_item_id}`}
                                        </p>
                                    </div>

                                    <div className="text-right mr-4">
                                        <p className="font-bold text-lg">
                                            {new Intl.NumberFormat("pt-BR", {
                                                style: "currency",
                                                currency: "BRL",
                                            }).format(product.price)}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            Estoque: {product.available_quantity || 0}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <span
                                            className={`text-xs px-2 py-1 rounded mr-2 ${product.status === "active"
                                                    ? "bg-green-100 text-green-700"
                                                    : product.status === "draft"
                                                        ? "bg-gray-100 text-gray-700"
                                                        : "bg-yellow-100 text-yellow-700"
                                                }`}
                                        >
                                            {product.status}
                                        </span>

                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={() => handleDuplicate(product)}
                                            disabled={duplicateMutation.isPending}
                                            title="Duplicar produto"
                                        >
                                            <Copy className="h-4 w-4 text-muted-foreground hover:text-blue-600" />
                                        </Button>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={() => handleEdit(product)}
                                            title="Editar produto"
                                        >
                                            <Edit className="h-4 w-4 text-muted-foreground hover:text-primary" />
                                        </Button>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={() => setProductToDelete(product.id)}
                                            title="Excluir produto"
                                        >
                                            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Pagination */}
            {total > 20 && (
                <div className="flex justify-center gap-2">
                    <Button
                        variant="outline"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                    >
                        Anterior
                    </Button>
                    <span className="py-2 px-4">
                        Página {page} de {data?.totalPages || 1}
                    </span>
                    <Button
                        variant="outline"
                        onClick={() => setPage(p => p + 1)}
                        disabled={page >= (data?.totalPages || 1)}
                    >
                        Próxima
                    </Button>
                </div>
            )}

            {/* Create/Edit Product Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingProduct ? "Editar Produto" : "Novo Produto"}</DialogTitle>
                        <DialogDescription>
                            Preencha as informações completas do produto para o Mercado Livre
                        </DialogDescription>
                    </DialogHeader>

                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="grid w-full grid-cols-6">
                            <TabsTrigger value="general">Geral</TabsTrigger>
                            <TabsTrigger value="pricing">Preço & Estoque</TabsTrigger>
                            <TabsTrigger value="calculator" className="gap-1">
                                <Calculator className="h-3 w-3" />
                                Calculadora
                            </TabsTrigger>
                            <TabsTrigger value="mercadolivre">Mercado Livre</TabsTrigger>
                            <TabsTrigger value="shipping">Frete</TabsTrigger>
                            <TabsTrigger value="images">Imagens</TabsTrigger>
                        </TabsList>

                        {/* ABAS */}
                        <div className="py-4">

                            {/* GERAL */}
                            <TabsContent value="general" className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2 col-span-2">
                                        <Label htmlFor="title">Título do Produto *</Label>
                                        <Input
                                            id="title"
                                            placeholder="Ex: Tênis Nike Air Max 2024 Original"
                                            value={formData.title}
                                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="sku">SKU (Código Interno)</Label>
                                        <Input
                                            id="sku"
                                            placeholder="Ex: NIKE-AM-2024-BLK"
                                            value={formData.sku}
                                            onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="condition">Condição</Label>
                                        <Select
                                            value={formData.condition}
                                            onValueChange={(value) => setFormData({ ...formData, condition: value })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecione" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="new">Novo</SelectItem>
                                                <SelectItem value="used">Usado</SelectItem>
                                                <SelectItem value="refurbished">Recondicionado</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2 col-span-2">
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="description">Descrição Detalhada</Label>
                                            <Button 
                                                type="button"
                                                variant="outline" 
                                                size="sm" 
                                                className="gap-2 text-purple-600 border-purple-600 hover:bg-purple-50"
                                                onClick={handleGenerateDescription}
                                                disabled={generateDescriptionMutation.isPending || !formData.title}
                                            >
                                                <Sparkles className="h-4 w-4" />
                                                {generateDescriptionMutation.isPending ? "Gerando..." : "Gerar com IA"}
                                            </Button>
                                        </div>
                                        <Textarea
                                            id="description"
                                            placeholder="Descreva seu produto com detalhes ou clique em 'Gerar com IA'..."
                                            rows={8}
                                            value={formData.description || ""}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        />
                                        {!formData.title && (
                                            <p className="text-xs text-muted-foreground">
                                                💡 Preencha o título primeiro para gerar uma descrição personalizada com IA
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </TabsContent>

                            {/* PREÇO & ESTOQUE */}
                            <TabsContent value="pricing" className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="price">Preço de Venda (R$) *</Label>
                                        <Input
                                            id="price"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={formData.price}
                                            onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="original_price">Preço Original (De/Por)</Label>
                                        <Input
                                            id="original_price"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            placeholder="0.00"
                                            value={formData.original_price}
                                            onChange={(e) => setFormData({ ...formData, original_price: parseFloat(e.target.value) || 0 })}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="cost_price">Preço de Custo (Interno)</Label>
                                        <Input
                                            id="cost_price"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            placeholder="0.00"
                                            value={formData.cost_price}
                                            onChange={(e) => setFormData({ ...formData, cost_price: parseFloat(e.target.value) || 0 })}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="quantity">Estoque Total Disponível</Label>
                                        <Input
                                            id="quantity"
                                            type="number"
                                            min="0"
                                            value={formData.available_quantity}
                                            onChange={(e) => setFormData({ ...formData, available_quantity: parseInt(e.target.value) || 0 })}
                                        />
                                    </div>

                                </div>
                            </TabsContent>

                            {/* CALCULADORA DE PRECIFICAÇÃO */}
                            <TabsContent value="calculator" className="space-y-6">
                                <div className="border rounded-lg p-4 bg-gradient-to-br from-blue-50 to-purple-50">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Calculator className="h-5 w-5 text-blue-600" />
                                        <h3 className="text-lg font-semibold text-blue-900">Calculadora de Precificação Inteligente</h3>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-6">
                                        {/* Custos e Configurações */}
                                        <div className="space-y-4">
                                            <h4 className="font-medium text-gray-900 flex items-center gap-2">
                                                <DollarSign className="h-4 w-4" />
                                                Custos e Configurações
                                            </h4>
                                            
                                            <div className="space-y-3">
                                                <div>
                                                    <Label htmlFor="cost_price_calc">Custo do Produto (R$)</Label>
                                                    <Input
                                                        id="cost_price_calc"
                                                        type="number"
                                                        step="0.01"
                                                        placeholder="0,00"
                                                        value={pricingData.cost_price}
                                                        onChange={(e) => setPricingData({...pricingData, cost_price: Number(e.target.value)})}
                                                    />
                                                </div>
                                                
                                                <div>
                                                    <Label htmlFor="additional_costs">Custos Adicionais (R$)</Label>
                                                    <Input
                                                        id="additional_costs"
                                                        type="number"
                                                        step="0.01"
                                                        placeholder="Embalagem, frete, etc."
                                                        value={pricingData.additional_costs}
                                                        onChange={(e) => setPricingData({...pricingData, additional_costs: Number(e.target.value)})}
                                                    />
                                                </div>
                                                
                                                <div>
                                                    <Label htmlFor="profit_margin">Margem de Lucro (%)</Label>
                                                    <Input
                                                        id="profit_margin"
                                                        type="number"
                                                        step="0.1"
                                                        placeholder="30"
                                                        value={pricingData.profit_margin}
                                                        onChange={(e) => setPricingData({...pricingData, profit_margin: Number(e.target.value)})}
                                                    />
                                                </div>
                                                
                                                <div>
                                                    <Label htmlFor="marketplace_fee">Taxa da Plataforma (%)</Label>
                                                    <Input
                                                        id="marketplace_fee"
                                                        type="number"
                                                        step="0.1"
                                                        placeholder="12 (Mercado Livre)"
                                                        value={pricingData.marketplace_fee}
                                                        onChange={(e) => setPricingData({...pricingData, marketplace_fee: Number(e.target.value)})}
                                                    />
                                                </div>
                                                
                                                <div>
                                                    <Label htmlFor="advertising_cost">Custo de Publicidade (%)</Label>
                                                    <Input
                                                        id="advertising_cost"
                                                        type="number"
                                                        step="0.1"
                                                        placeholder="5"
                                                        value={pricingData.advertising_cost}
                                                        onChange={(e) => setPricingData({...pricingData, advertising_cost: Number(e.target.value)})}
                                                    />
                                                </div>
                                                
                                                <div>
                                                    <Label htmlFor="operational_cost">Custo Operacional (%)</Label>
                                                    <Input
                                                        id="operational_cost"
                                                        type="number"
                                                        step="0.1"
                                                        placeholder="8"
                                                        value={pricingData.operational_cost}
                                                        onChange={(e) => setPricingData({...pricingData, operational_cost: Number(e.target.value)})}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Resultados */}
                                        <div className="space-y-4">
                                            <h4 className="font-medium text-gray-900 flex items-center gap-2">
                                                <TrendingUp className="h-4 w-4" />
                                                Análise de Precificação
                                            </h4>
                                            
                                            {(() => {
                                                const calc = calculatePricing();
                                                return (
                                                    <div className="bg-white rounded-lg p-4 space-y-3 border">
                                                        <div className="flex justify-between items-center py-2 border-b">
                                                            <span className="text-sm text-gray-600">Custo Total:</span>
                                                            <span className="font-medium">R$ {calc.baseCost.toFixed(2)}</span>
                                                        </div>
                                                        
                                                        <div className="flex justify-between items-center py-2 border-b">
                                                            <span className="text-sm text-gray-600">Preço Sugerido:</span>
                                                            <span className="font-bold text-lg text-green-600">
                                                                R$ {calc.suggestedPrice.toFixed(2)}
                                                            </span>
                                                        </div>
                                                        
                                                        <div className="flex justify-between items-center py-2 border-b">
                                                            <span className="text-sm text-gray-600">Lucro Bruto:</span>
                                                            <span className="font-medium text-blue-600">R$ {calc.grossProfit.toFixed(2)}</span>
                                                        </div>
                                                        
                                                        <div className="flex justify-between items-center py-2 border-b">
                                                            <span className="text-sm text-gray-600">Taxas Totais:</span>
                                                            <span className="font-medium text-orange-600">-R$ {calc.totalFees.toFixed(2)}</span>
                                                        </div>
                                                        
                                                        <div className="flex justify-between items-center py-2 border-b">
                                                            <span className="text-sm text-gray-600">Lucro Líquido:</span>
                                                            <span className="font-bold text-green-600">R$ {calc.netProfit.toFixed(2)}</span>
                                                        </div>
                                                        
                                                        <div className="flex justify-between items-center py-2">
                                                            <span className="text-sm text-gray-600">ROI:</span>
                                                            <span className={`font-bold ${calc.roi >= 50 ? 'text-green-600' : calc.roi >= 25 ? 'text-yellow-600' : 'text-red-600'}`}>
                                                                {calc.roi.toFixed(1)}%
                                                            </span>
                                                        </div>
                                                        
                                                        <div className="pt-3 border-t">
                                                            <Button 
                                                                onClick={applyCalculatedPrice}
                                                                className="w-full gap-2 bg-gradient-to-r from-blue-600 to-purple-600"
                                                                disabled={calc.baseCost <= 0}
                                                            >
                                                                <Calculator className="h-4 w-4" />
                                                                Aplicar Preço Calculado
                                                            </Button>
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                            
                                            {/* Simulação de vendas */}
                                            <div className="bg-gray-50 rounded-lg p-4">
                                                <h5 className="font-medium text-gray-900 mb-3">Simulação de Lucro por Volume</h5>
                                                <div className="grid grid-cols-3 gap-2 text-sm">
                                                    {[10, 50, 100].map(qty => {
                                                        const calc = calculatePricing();
                                                        const totalProfit = calc.netProfit * qty;
                                                        return (
                                                            <div key={qty} className="bg-white p-2 rounded text-center">
                                                                <div className="font-medium">{qty} vendas</div>
                                                                <div className="text-green-600 font-bold">
                                                                    R$ {totalProfit.toFixed(0)}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                            
                                            {/* Dicas de precificação */}
                                            <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                                                <h5 className="font-medium text-yellow-800 mb-2">💡 Dicas de Precificação</h5>
                                                <ul className="text-xs text-yellow-700 space-y-1">
                                                    <li>• ROI ideal: acima de 50%</li>
                                                    <li>• Mercado Livre: taxa ~12%</li>
                                                    <li>• Considere sazonalidade</li>
                                                    <li>• Compare com concorrentes</li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-lg border p-4 bg-muted/30 space-y-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <h4 className="font-medium">Características do anúncio</h4>
                                            <p className="text-xs text-muted-foreground">
                                                Preencha atributos-chave do Mercado Livre para melhorar relevância e evitar bloqueios.
                                            </p>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setAttributesFromValues({}, [])}
                                        >
                                            Limpar atributos
                                        </Button>
                                    </div>

                                    <div className="grid grid-cols-3 gap-3">
                                        {ML_ATTRIBUTE_FIELDS.map((field) => (
                                            <div key={field.id} className="space-y-1.5">
                                                <Label htmlFor={`attr-${field.id}`}>{field.label}</Label>
                                                {field.type === "select" ? (
                                                    <Select
                                                        value={attributeValues[field.id] || ""}
                                                        onValueChange={(value) => handleAttributeChange(field, value)}
                                                    >
                                                        <SelectTrigger id={`attr-${field.id}`}>
                                                            <SelectValue placeholder="Selecione" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {field.options?.map(option => (
                                                                <SelectItem key={option.value_id} value={option.value_id}>
                                                                    {option.label}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                ) : (
                                                    <Input
                                                        id={`attr-${field.id}`}
                                                        type={field.type === "number" ? "number" : "text"}
                                                        placeholder={field.placeholder}
                                                        value={attributeValues[field.id] || ""}
                                                        onChange={(e) => handleAttributeChange(field, e.target.value)}
                                                    />
                                                )}
                                                {field.helperText && (
                                                    <p className="text-[11px] text-muted-foreground">{field.helperText}</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="font-medium text-sm">Atributos adicionais (avançado)</p>
                                                <p className="text-xs text-muted-foreground">
                                                    Inclua atributos específicos da categoria (ex: BRAND, GENDER, PATTERN) para compatibilidade total.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-2">
                                            <Input
                                                placeholder="ID ML (ex: BRAND)"
                                                value={newAttribute.id}
                                                onChange={(e) => setNewAttribute(prev => ({ ...prev, id: e.target.value }))}
                                            />
                                            <Input
                                                placeholder="Nome de exibição (opcional)"
                                                value={newAttribute.name}
                                                onChange={(e) => setNewAttribute(prev => ({ ...prev, name: e.target.value }))}
                                            />
                                            <div className="flex gap-2">
                                                <Input
                                                    placeholder="Valor"
                                                    value={newAttribute.value}
                                                    onChange={(e) => setNewAttribute(prev => ({ ...prev, value: e.target.value }))}
                                                />
                                                <Button type="button" onClick={handleAddCustomAttribute}>
                                                    Adicionar
                                                </Button>
                                            </div>
                                        </div>

                                        {otherAttributes.length > 0 && (
                                            <div className="grid gap-2">
                                                {otherAttributes.map(attr => (
                                                    <div key={attr.id} className="flex items-center justify-between rounded-md border bg-white px-3 py-2">
                                                        <div>
                                                            <p className="text-sm font-medium">{attr.name || attr.id}</p>
                                                            <p className="text-xs text-muted-foreground">ID: {attr.id} • Valor: {attr.value_name}</p>
                                                        </div>
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => handleRemoveCustomAttribute(attr.id)}
                                                        >
                                                            Remover
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </TabsContent>

                            {/* MERCADO LIVRE */}
                            <TabsContent value="mercadolivre" className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="listing_type">Tipo de Anúncio</Label>
                                        <Select
                                            value={formData.ml_listing_type}
                                            onValueChange={(value) => setFormData({ ...formData, ml_listing_type: value })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecione" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="gold_special">Clássico (Exposição Alta)</SelectItem>
                                                <SelectItem value="gold_pro">Premium (Exposição Máxima + Parcelamento)</SelectItem>
                                                <SelectItem value="free">Grátis (Exposição Baixa)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-3 col-span-2">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="space-y-1">
                                                <Label htmlFor="category">Categoria Mercado Livre</Label>
                                                <p className="text-xs text-muted-foreground">
                                                    Use IA ou busque pelo nome/ID para acertar a categoria.
                                                </p>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="gap-2"
                                                onClick={handleAutoSuggestCategory}
                                                disabled={isLoadingCategories || !formData.title}
                                            >
                                                {isLoadingCategories ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Sparkles className="h-4 w-4" />
                                                )}
                                                {isLoadingCategories ? "Buscando..." : "Sugerir com título"}
                                            </Button>
                                        </div>

                                        {formData.ml_category_id && (
                                            <div className="flex items-center justify-between rounded-lg border bg-green-50 px-3 py-2">
                                                <div>
                                                    <p className="text-xs text-green-700">Categoria atual</p>
                                                    <p className="font-semibold text-green-900">{formData.ml_category_id}</p>
                                                </div>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => setFormData(prev => ({ ...prev, ml_category_id: "" }))}
                                                >
                                                    Trocar
                                                </Button>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-3 gap-2">
                                            <div className="col-span-2">
                                                <div className="relative">
                                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
                                                    <Input
                                                        id="category"
                                                        placeholder="Busque por nome ou cole um ID (ex: MLB1276)"
                                                        value={categorySearch}
                                                        onChange={(e) => handleCategorySearch(e.target.value)}
                                                        className="pl-10"
                                                    />
                                                </div>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                className="w-full h-full"
                                                onClick={() => handleCategorySearch(categorySearch)}
                                                disabled={!categorySearch || categorySearch.length < 2 || isLoadingCategories}
                                            >
                                                Buscar categoria
                                            </Button>
                                        </div>

                                        {categorySearch.trim().toUpperCase().startsWith("ML") && categorySearch.trim().length >= 4 && (
                                            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                                                <span>Tem o ID exato? Defina manualmente.</span>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => selectCategory({
                                                        id: categorySearch.trim(),
                                                        name: categorySearch.trim(),
                                                        probability: 1,
                                                        predicted: false
                                                    })}
                                                >
                                                    Usar {categorySearch.trim().toUpperCase()}
                                                </Button>
                                            </div>
                                        )}

                                        <div className="grid gap-2 rounded-lg border bg-white p-3 max-h-64 overflow-y-auto">
                                            {isLoadingCategories ? (
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    Buscando categorias recomendadas...
                                                </div>
                                            ) : suggestedCategories.length > 0 ? (
                                                suggestedCategories.map((category) => (
                                                    <button
                                                        key={`${category.id}-${category.name}`}
                                                        type="button"
                                                        onClick={() => selectCategory(category)}
                                                        className="flex items-center justify-between w-full p-3 rounded-md border text-left hover:border-primary hover:bg-primary/5 transition"
                                                    >
                                                        <div>
                                                            <div className="font-medium flex items-center gap-2">
                                                                {category.name}
                                                                {category.predicted && (
                                                                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                                                                        IA
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-muted-foreground">ID: {category.id}</p>
                                                        </div>
                                                        {typeof category.probability === "number" && (
                                                            <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-1 rounded">
                                                                {(category.probability * 100).toFixed(0)}%
                                                            </span>
                                                        )}
                                                    </button>
                                                ))
                                            ) : (
                                                <div className="space-y-3">
                                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                        <Target className="h-4 w-4" />
                                                        Nenhuma categoria sugerida. Busque ou use o título para obter sugestões.
                                                    </div>
                                                    {allCategories?.length > 0 && (
                                                        <div className="space-y-2">
                                                            <p className="text-xs font-medium text-muted-foreground">Categorias populares</p>
                                                            <div className="grid grid-cols-2 gap-2">
                                                                {allCategories.slice(0, 4).map((category: MLCategory) => (
                                                                    <button
                                                                        key={category.id}
                                                                        type="button"
                                                                        onClick={() => selectCategory({
                                                                            ...category,
                                                                            probability: category.probability || 0,
                                                                            predicted: category.predicted || false
                                                                        })}
                                                                        className="p-3 text-left rounded-md border hover:border-primary hover:bg-primary/5 transition"
                                                                    >
                                                                        <p className="font-medium">{category.name}</p>
                                                                        <p className="text-xs text-muted-foreground">ID: {category.id}</p>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>

                            {/* FRETE */}
                            <TabsContent value="shipping" className="space-y-4">
                                <div className="flex items-center space-x-2 mb-4">
                                    <Switch
                                        id="free-shipping"
                                        checked={formData.free_shipping}
                                        onCheckedChange={(checked) => setFormData({ ...formData, free_shipping: checked })}
                                    />
                                    <Label htmlFor="free-shipping">Oferecer Frete Grátis</Label>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="weight">Peso (kg)</Label>
                                        <Input
                                            id="weight"
                                            type="number"
                                            step="0.001"
                                            value={formData.weight_kg}
                                            onChange={(e) => setFormData({ ...formData, weight_kg: parseFloat(e.target.value) || 0 })}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="height">Altura (cm)</Label>
                                        <Input
                                            id="height"
                                            type="number"
                                            value={formData.height_cm}
                                            onChange={(e) => setFormData({ ...formData, height_cm: parseFloat(e.target.value) || 0 })}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="width">Largura (cm)</Label>
                                        <Input
                                            id="width"
                                            type="number"
                                            value={formData.width_cm}
                                            onChange={(e) => setFormData({ ...formData, width_cm: parseFloat(e.target.value) || 0 })}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="length">Comprimento (cm)</Label>
                                        <Input
                                            id="length"
                                            type="number"
                                            value={formData.length_cm}
                                            onChange={(e) => setFormData({ ...formData, length_cm: parseFloat(e.target.value) || 0 })}
                                        />
                                    </div>
                                </div>
                            </TabsContent>

                            {/* IMAGENS */}
                            <TabsContent value="images" className="space-y-4">
                                <div className="space-y-4">
                                    {/* Área de adicionar URL */}
                                    <div className="space-y-2">
                                        <Label htmlFor="image-url">URL da Imagem</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                id="image-url"
                                                placeholder="https://exemplo.com/imagem.jpg"
                                                value={imageUrl}
                                                onChange={(e) => setImageUrl(e.target.value)}
                                                onKeyPress={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        addImage();
                                                    }
                                                }}
                                            />
                                            <Button 
                                                type="button" 
                                                onClick={addImage} 
                                                variant="secondary"
                                                disabled={!imageUrl.trim()}
                                            >
                                                <Plus className="h-4 w-4 mr-2" />
                                                Adicionar
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Área de Upload */}
                                    <div className="space-y-3">
                                        {/* Input file oculto */}
                                        <input
                                            type="file"
                                            id="file-upload"
                                            multiple
                                            accept="image/*"
                                            onChange={handleFileSelect}
                                            className="hidden"
                                            disabled={isUploading}
                                        />
                                        
                                        {/* Área de Drag & Drop */}
                                        <div 
                                            className={`border-2 border-dashed rounded-lg p-6 text-center transition-all cursor-pointer ${
                                                dragActive 
                                                    ? 'border-primary bg-primary/5' 
                                                    : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                                            } ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
                                            onDragOver={handleDragOver}
                                            onDragEnter={handleDragEnter}
                                            onDragLeave={handleDragLeave}
                                            onDrop={handleDrop}
                                            onClick={() => document.getElementById('file-upload')?.click()}
                                        >
                                            {isUploading ? (
                                                <div className="flex flex-col items-center">
                                                    <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mb-2"></div>
                                                    <p className="text-sm text-muted-foreground">Fazendo upload...</p>
                                                </div>
                                            ) : (
                                                <>
                                                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                                                    <p className="text-sm font-medium mb-1">
                                                        Arraste imagens aqui ou clique para selecionar
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        JPEG, PNG, WebP, GIF - Máx. 5MB cada
                                                    </p>
                                                </>
                                            )}
                                        </div>

                                        {/* Botão alternativo */}
                                        <Button 
                                            type="button" 
                                            variant="outline" 
                                            className="w-full"
                                            onClick={() => document.getElementById('file-upload')?.click()}
                                            disabled={isUploading}
                                        >
                                            <Upload className="h-4 w-4 mr-2" />
                                            {isUploading ? 'Fazendo upload...' : 'Selecionar Imagens do Computador'}
                                        </Button>
                                    </div>

                                    {/* Grid de imagens */}
                                    <div className="grid grid-cols-3 gap-4 mt-4">
                                        {formData.images?.map((url, index) => (
                                            <div key={index} className="relative group border rounded-lg overflow-hidden aspect-square bg-muted">
                                                <img 
                                                    src={url} 
                                                    alt={`Imagem ${index + 1}`} 
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => {
                                                        const img = e.target as HTMLImageElement;
                                                        img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5YTNhZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkVycm8gYW8gY2FycmVnYXI8L3RleHQ+PC9zdmc+';
                                                    }}
                                                />
                                                <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                                                    {index + 1}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => removeImage(index)}
                                                    className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <Plus className="h-3 w-3 transform rotate-45" />
                                                </button>
                                            </div>
                                        ))}
                                        
                                        {/* Card para adicionar mais imagens */}
                                        {formData.images && formData.images.length > 0 && (
                                            <div 
                                                className="border-2 border-dashed border-muted-foreground/25 rounded-lg aspect-square flex flex-col items-center justify-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
                                                onClick={() => document.getElementById('image-url')?.focus()}
                                            >
                                                <Plus className="h-8 w-8 text-muted-foreground mb-2" />
                                                <p className="text-xs text-muted-foreground text-center">
                                                    Adicionar<br />mais imagens
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Estado vazio */}
                                    {(!formData.images || formData.images.length === 0) && (
                                        <div className="text-center py-8">
                                            <ImageIcon className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                                            <p className="text-muted-foreground mb-2">Nenhuma imagem adicionada</p>
                                            <p className="text-sm text-muted-foreground">
                                                Cole uma URL acima ou arraste imagens para adicionar
                                            </p>
                                        </div>
                                    )}

                                    {/* Dicas */}
                                    <div className="bg-muted/20 p-3 rounded-lg">
                                        <p className="text-xs text-muted-foreground">
                                            💡 <strong>Dicas:</strong> Use imagens de alta qualidade (min. 500x500px). 
                                            A primeira imagem será a principal. Máximo recomendado: 10 imagens.
                                        </p>
                                    </div>
                                </div>
                            </TabsContent>

                        </div>
                    </Tabs>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
                            {createMutation.isPending || updateMutation.isPending ? "Salvando..." : "Salvar Produto"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={!!productToDelete} onOpenChange={(open) => !open && setProductToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Deletar produto?</AlertDialogTitle>
                        <AlertDialogDescription>
                            O produto será removido da lista principal. Você poderá recuperá-lo depois se necessário.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                            Excluir
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Duplicate Product Dialog */}
            <Dialog open={!!productToDuplicate} onOpenChange={() => setProductToDuplicate(null)}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Copy className="h-5 w-5 text-blue-600" />
                            Duplicar Produto
                        </DialogTitle>
                        <DialogDescription>
                            Configure as opções para duplicar o produto "{productToDuplicate?.title}"
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* Título */}
                        <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="modify-title"
                                    checked={duplicateOptions.modifyTitle}
                                    onCheckedChange={(checked) => 
                                        setDuplicateOptions(prev => ({ ...prev, modifyTitle: !!checked }))
                                    }
                                />
                                <Label htmlFor="modify-title">Modificar título</Label>
                            </div>
                            {duplicateOptions.modifyTitle && (
                                <Input
                                    placeholder="Novo título do produto"
                                    value={duplicateOptions.title}
                                    onChange={(e) => setDuplicateOptions(prev => ({ ...prev, title: e.target.value }))}
                                />
                            )}
                        </div>

                        {/* SKU */}
                        <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="modify-sku"
                                    checked={duplicateOptions.modifySku}
                                    onCheckedChange={(checked) => 
                                        setDuplicateOptions(prev => ({ ...prev, modifySku: !!checked }))
                                    }
                                />
                                <Label htmlFor="modify-sku">Modificar SKU</Label>
                            </div>
                            {duplicateOptions.modifySku && (
                                <Input
                                    placeholder="Novo SKU (deixe vazio para gerar automaticamente)"
                                    value={duplicateOptions.sku}
                                    onChange={(e) => setDuplicateOptions(prev => ({ ...prev, sku: e.target.value }))}
                                />
                            )}
                        </div>

                        {/* Opções avançadas */}
                        <div className="space-y-3 pt-2 border-t">
                            <Label className="text-sm font-medium">Opções Avançadas:</Label>
                            
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="reset-stock"
                                    checked={duplicateOptions.resetStock}
                                    onCheckedChange={(checked) => 
                                        setDuplicateOptions(prev => ({ ...prev, resetStock: !!checked }))
                                    }
                                />
                                <Label htmlFor="reset-stock" className="text-sm">Zerar estoque (útil para variações)</Label>
                            </div>

                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="reset-images"
                                    checked={duplicateOptions.resetImages}
                                    onCheckedChange={(checked) => 
                                        setDuplicateOptions(prev => ({ ...prev, resetImages: !!checked }))
                                    }
                                />
                                <Label htmlFor="reset-images" className="text-sm">Remover imagens (adicionar novas depois)</Label>
                            </div>
                        </div>

                        <div className="bg-blue-50 p-3 rounded-lg">
                            <p className="text-xs text-blue-700">
                                💡 <strong>Dica:</strong> Para produtos com variações (dourado/prateado), 
                                modifique o título e zere o estoque para configurar depois.
                            </p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setProductToDuplicate(null)}>
                            Cancelar
                        </Button>
                        <Button 
                            onClick={confirmDuplicate} 
                            disabled={duplicateMutation.isPending}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            {duplicateMutation.isPending ? (
                                <>Duplicando...</>
                            ) : (
                                <>
                                    <Copy className="h-4 w-4 mr-2" />
                                    Duplicar Produto
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Trash Dialog */}
            <Dialog open={trashDialogOpen} onOpenChange={setTrashDialogOpen}>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Archive className="h-5 w-5 text-amber-600" />
                            Lixeira de Produtos
                        </DialogTitle>
                        <DialogDescription>
                            Produtos deletados que podem ser restaurados
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4">
                        {deletedProductsQuery.isLoading ? (
                            <div className="space-y-3">
                                {[...Array(3)].map((_, i) => (
                                    <div key={i} className="flex items-center space-x-4">
                                        <Skeleton className="h-16 w-16 rounded" />
                                        <div className="flex-1 space-y-2">
                                            <Skeleton className="h-4 w-3/4" />
                                            <Skeleton className="h-3 w-1/2" />
                                        </div>
                                        <Skeleton className="h-8 w-20" />
                                    </div>
                                ))}
                            </div>
                        ) : deletedProductsQuery.data?.products?.length === 0 ? (
                            <div className="text-center py-8">
                                <Archive className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                                <p className="text-lg font-medium text-muted-foreground mb-2">
                                    Lixeira vazia
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    Nenhum produto foi deletado ainda
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {deletedProductsQuery.data?.products?.map((product: any) => (
                                    <div key={product.id} className="flex items-center space-x-4 p-3 border rounded-lg">
                                        <div className="h-16 w-16 bg-muted rounded-lg flex items-center justify-center">
                                            {(() => {
                                                try {
                                                    const images = typeof product.images === 'string' ? JSON.parse(product.images) : product.images;
                                                    if (images && Array.isArray(images) && images.length > 0) {
                                                        return (
                                                            <img 
                                                                src={images[0]} 
                                                                alt={product.title}
                                                                className="h-full w-full object-cover rounded-lg"
                                                            />
                                                        );
                                                    }
                                                } catch (e) {
                                                    console.warn('Error parsing product images:', e);
                                                }
                                                return <Package className="h-8 w-8 text-muted-foreground" />;
                                            })()}
                                        </div>
                                        
                                        <div className="flex-1">
                                            <h4 className="font-medium">{product.title}</h4>
                                            <p className="text-sm text-muted-foreground">
                                                SKU: {product.sku || 'N/A'} • 
                                                Deletado em: {new Date(product.updated_at).toLocaleDateString('pt-BR')}
                                            </p>
                                            <p className="text-sm font-medium text-green-600">
                                                R$ {Number(product.price).toFixed(2)}
                                            </p>
                                        </div>
                                        
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            className="gap-2 text-green-600 border-green-600 hover:bg-green-50"
                                            onClick={() => handleRestoreProduct(product.id)}
                                            disabled={restoreMutation.isPending}
                                        >
                                            <RotateCcw className="h-4 w-4" />
                                            Restaurar
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setTrashDialogOpen(false)}>
                            Fechar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
