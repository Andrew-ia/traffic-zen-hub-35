import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, ChevronRight, Loader2, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface PMTask {
    id: string;
    name: string;
    folder_id: string;
    status: string;
    metadata?: {
        campaign_data?: {
            campaignName?: string;
            objective?: string;
            budget?: string;
            startDate?: string;
            endDate?: string;
            ageMin?: number;
            ageMax?: number;
            interests?: string;
            adSets?: Array<{
                id: string;
                name: string;
                creatives?: Array<{
                    id: string;
                    headline?: string;
                    primaryText?: string;
                    description?: string;
                    creativeUrl?: string;
                }>;
            }>;
        };
    };
}

const WORKSPACE_ID = (import.meta.env.VITE_WORKSPACE_ID as string | undefined)?.trim();
const INVALID_WS_ID = '00000000-0000-0000-0000-000000000010';
const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : '');

const STEPS = [
    { id: 1, title: "Campanha", description: "Defina o objetivo e nome" },
    { id: 2, title: "Estrutura", description: "Conjuntos de Anúncios e Anúncios" },
    { id: 3, title: "Revisão", description: "Confirme os dados" },
];

interface Ad {
    id: string; // Temporary ID for UI
    name: string;
    creative_id: string;
    status: string;
    // UI only fields
    headline?: string;
    primary_text?: string;
    description?: string;
}

interface AdSet {
    id: string; // Temporary ID for UI
    name: string;
    billing_event: string;
    optimization_goal: string;
    daily_budget: string; // string for input, parsed to cents
    status: string;
    destination_type?: string; // 'MESSAGING_APP', 'ON_AD', 'WEBSITE', or empty
    publisher_platforms?: string[]; // ['facebook'], ['instagram'], or ['facebook', 'instagram']
    targeting: {
        geo_locations: { countries: string[] };
        age_min: number;
        age_max: number;
        genders?: number[];
        publisher_platforms?: string[];
        facebook_positions?: string[];
        instagram_positions?: string[];
        device_platforms?: string[];
        interests?: string;
        custom_audiences?: string;
    };
    ads: Ad[];
}

export default function CreateMetaCampaign() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { user } = useAuth();
    const [currentStep, setCurrentStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [isSimpleMode, setIsSimpleMode] = useState(false);
    const [selectedTaskId, setSelectedTaskId] = useState<string>("");

    // Form State
    const [campaign, setCampaign] = useState({
        name: "",
        objective: "OUTCOME_LEADS",
        status: "PAUSED",
        special_ad_categories: [] as string[],
    });

    const initialAdSetState: AdSet = {
        id: crypto.randomUUID(),
        name: "Conjunto #1",
        billing_event: "IMPRESSIONS",
        optimization_goal: "POST_ENGAGEMENT", // Default to POST_ENGAGEMENT as it's safer/more common
        daily_budget: "5000", // 50 BRL
        status: "PAUSED",
        destination_type: "ON_AD", // Default to ON_AD (which maps to ON_POST/ON_VIDEO etc)
        publisher_platforms: ["facebook", "instagram"],
        targeting: {
            geo_locations: {
                countries: ["BR"],
            },
            age_min: 18,
            age_max: 65,
            genders: [1, 2],
            publisher_platforms: ["facebook", "instagram"],
            facebook_positions: ["feed"],
            instagram_positions: ["stream"],
            device_platforms: ["mobile", "desktop"],
        },
        ads: [
            {
                id: crypto.randomUUID(),
                name: "Anúncio #1",
                creative_id: "",
                status: "PAUSED",
            }
        ],
    };

    const [adSets, setAdSets] = useState<AdSet[]>([initialAdSetState]);

    // Update ad sets when campaign objective changes
    useEffect(() => {
        if (campaign.objective === 'OUTCOME_ENGAGEMENT') {
            setAdSets(prev => prev.map(adSet => ({
                ...adSet,
                optimization_goal: 'POST_ENGAGEMENT',
                destination_type: 'ON_AD'
            })));
        }
    }, [campaign.objective]);

    // Fetch Tasks for selection
    const { data: tasks } = useQuery({
        queryKey: ['pm-tasks', WORKSPACE_ID],
        queryFn: async () => {
            if (!WORKSPACE_ID) return [];
            const response = await fetch(`${API_BASE}/api/pm/tasks/${WORKSPACE_ID}`);
            const data = await response.json();
            return data.success ? (data.data as PMTask[]) : [];
        },
        enabled: !!WORKSPACE_ID
    });

    const workspaceId = user?.workspace_id || WORKSPACE_ID;

    // Auto-ajuste caso o destino atual fique inválido ao mudar objetivo/otimização
    function ensureValidDestinations() {
        setAdSets(prev => prev.map(s => {
            const obj = campaign.objective;
            const opt = s.optimization_goal;
            const options: string[] = getAllowedDestinations(obj, opt);
            const filtered = options.filter(v => {
                if (v === 'ON_AD') return opt === 'POST_ENGAGEMENT' || opt === 'LEAD_GENERATION';
                return true;
            });
            if (!s.destination_type || filtered.includes(s.destination_type)) return s;
            return { ...s, destination_type: undefined };
        }));
    }

    // Chamado quando objetivo muda
    function updateCampaign<K extends keyof typeof campaign>(key: K, value: (typeof campaign)[K]) {
        setCampaign(prev => ({ ...prev, [key]: value }));
        setTimeout(ensureValidDestinations, 0);
    }

    function getAllowedDestinations(objective: string, optimization: string) {
      const obj = objective.toUpperCase();
      const opt = optimization.toUpperCase();

      if (obj === 'OUTCOME_ENGAGEMENT') {
        if (opt === 'MESSAGES') {
          return ['MESSAGING_APP']; // WhatsApp/Messenger/IG Direct
        }
        // Para engajamento, sempre usar Instagram ou Facebook (não "No seu anúncio")
        return ['INSTAGRAM_OR_FACEBOOK'];
      }

        if (obj === 'OUTCOME_LEADS') {
            return ['WHATSAPP'];
        }
      if (obj === 'OUTCOME_SALES' || obj === 'OUTCOME_TRAFFIC') {
          return ['WEBSITE'];
      }

        return ['WEBSITE'];
    }

    const handleTaskSelect = (taskId: string) => {
        setSelectedTaskId(taskId);
        const task = tasks?.find(t => t.id === taskId);
        if (!task || !task.metadata?.campaign_data) {
            toast({
                title: "Dados incompletos",
                description: "Esta tarefa não possui dados de campanha configurados.",
                variant: "destructive"
            });
            return;
        }

        const data = task.metadata.campaign_data;

        // Map objective from various formats (PT/EN) to Meta codes
        const normalize = (s?: string) => (s || '').trim().toLowerCase();
        const obj = normalize(data.objective);
        const objectiveMap: Record<string, string> = {
            'reconhecimento': 'OUTCOME_AWARENESS',
            'awareness': 'OUTCOME_AWARENESS',
            'tráfego': 'OUTCOME_TRAFFIC',
            'trafego': 'OUTCOME_TRAFFIC',
            'traffic': 'OUTCOME_TRAFFIC',
            'engajamento': 'OUTCOME_ENGAGEMENT',
            'engagement': 'OUTCOME_ENGAGEMENT',
            'leads': 'OUTCOME_LEADS',
            'lead': 'OUTCOME_LEADS',
            'vendas': 'OUTCOME_SALES',
            'sales': 'OUTCOME_SALES',
            'conversions': 'OUTCOME_SALES',
            'promoção de app': 'OUTCOME_APP_PROMOTION',
            'app promotion': 'OUTCOME_APP_PROMOTION',
            'mensagens': 'MESSAGES',
            'messages': 'MESSAGES',
        };

        const mappedObjective = objectiveMap[obj] || 'OUTCOME_ENGAGEMENT';

        console.log('[Campaign Import] Original objective:', data.objective);
        console.log('[Campaign Import] Mapped objective:', mappedObjective);

        // 1. Map Campaign
        setCampaign(prev => ({
            ...prev,
            name: data.campaignName || task.name,
            objective: mappedObjective,
        }));

        // 2. Map Ad Sets
        if (data.adSets && data.adSets.length > 0) {
            // Método Andromeda: Divide budget equally across all ad sets (ABO)
            const totalBudgetCents = data.budget ? parseInt(data.budget) * 100 : 2000;
            const budgetPerAdSet = Math.floor(totalBudgetCents / data.adSets.length);

            const newAdSets: AdSet[] = data.adSets.map(importedAdSet => ({
                id: crypto.randomUUID(),
                name: importedAdSet.name,
                billing_event: "IMPRESSIONS",
                optimization_goal: (() => {
                    switch (mappedObjective) {
                        case 'OUTCOME_LEADS': return 'LEAD_GENERATION';
                        case 'OUTCOME_TRAFFIC': return 'LINK_CLICKS';
                        case 'OUTCOME_ENGAGEMENT': return 'POST_ENGAGEMENT';
                        case 'OUTCOME_SALES': return 'OFFSITE_CONVERSIONS';
                        case 'MESSAGES': return 'MESSAGES';
                        default: return 'LINK_CLICKS';
                    }
                })(),
                daily_budget: String(budgetPerAdSet), // Budget divided equally (Método Andromeda)
                status: "PAUSED",
                destination_type: (() => {
                    switch (mappedObjective) {
                        case 'OUTCOME_TRAFFIC': return 'WEBSITE';
                        case 'MESSAGES': return 'MESSAGES_DESTINATIONS';
                        case 'OUTCOME_SALES': return 'WEBSITE';
                        case 'OUTCOME_LEADS': return 'WHATSAPP';
                        case 'OUTCOME_ENGAGEMENT': return undefined;
                        default: return undefined;
                    }
                })(),
                targeting: {
                    geo_locations: { countries: ["BR"] },
                    age_min: data.ageMin || 18,
                    age_max: data.ageMax || 65,
                    interests: undefined,
                    custom_audiences: undefined
                },
                ads: importedAdSet.creatives?.map(creative => ({
                    id: crypto.randomUUID(),
                    name: creative.headline || "Anúncio Sem Título",
                    creative_id: creative.id, // Assuming this maps to Meta Creative ID or we handle it later
                    status: "PAUSED",
                    headline: creative.headline,
                    primary_text: creative.primaryText,
                    description: creative.description
                })) || []
            }));
            setAdSets(newAdSets);
        }


        toast({
            title: "Dados importados",
            description: `Estrutura da campanha importada de: ${task.name}. Orçamento dividido igualmente entre ${data.adSets.length} conjunto(s) - Método Andromeda (ABO).`
        });
    };

    const handleNext = () => {
        if (currentStep < STEPS.length) {
            setCurrentStep(currentStep + 1);
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleSubmit = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`${API_BASE}/api/integrations/meta/create-campaign`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    workspaceId: WORKSPACE_ID,
                    campaign: campaign,
                    adSets: adSets.map(adSet => {
                        // FORÇA POST_ENGAGEMENT para campanhas de engajamento
                        const finalOptimizationGoal =
                            campaign.objective === 'OUTCOME_ENGAGEMENT'
                                ? 'POST_ENGAGEMENT'
                                : (campaign.objective === 'OUTCOME_LEADS' ? 'CONVERSATIONS' : adSet.optimization_goal);

                        // REMOVE destination_type completamente para engajamento (backend infere)
                        const shouldRemoveDestination = campaign.objective === 'OUTCOME_ENGAGEMENT';

                        return {
                            ...adSet,
                            optimization_goal: finalOptimizationGoal,
                            daily_budget: parseInt(adSet.daily_budget),
                            // NÃO enviar destination_type para engajamento
                            ...(shouldRemoveDestination ? {} : {
                                destination_type: (adSet.destination_type === 'INSTAGRAM_OR_FACEBOOK' || !adSet.destination_type)
                                    ? undefined
                                    : adSet.destination_type
                            }),
                            targeting: {
                                ...adSet.targeting,
                                publisher_platforms: adSet.publisher_platforms || ['facebook', 'instagram']
                            },
                            ads: isSimpleMode ? [] : adSet.ads.map(ad => ({
                                ...ad,
                                creative_id: ad.creative_id,
                                status: 'PAUSED'
                            }))
                        };
                    }),
                }),
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || "Erro ao criar campanha");
            }

            toast({
                title: "Campanha criada com sucesso!",
                description: "Sua campanha foi enviada para o Meta Ads.",
            });

            navigate("/meta-ads");
        } catch (error) {
            console.error(error);
            toast({
                title: "Erro ao criar campanha",
                description: error instanceof Error ? error.message : "Ocorreu um erro inesperado.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const updateAdSet = (id: string, field: keyof AdSet, value: any) => {
        setAdSets(prev => prev.map(adSet =>
            adSet.id === id ? { ...adSet, [field]: value } : adSet
        ));
        if (field === 'optimization_goal' || field === 'destination_type') {
            setTimeout(ensureValidDestinations, 0);
        }
    };

    const updateAd = (adSetId: string, adId: string, field: keyof Ad, value: any) => {
        setAdSets(prev => prev.map(adSet => {
            if (adSet.id !== adSetId) return adSet;
            return {
                ...adSet,
                ads: adSet.ads.map(ad => ad.id === adId ? { ...ad, [field]: value } : ad)
            };
        }));
    };

    return (
        <div className="container mx-auto py-6 max-w-4xl">
            <div className="mb-6 flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">Nova Campanha Meta Ads</h1>
                    <p className="text-muted-foreground">Crie campanhas, conjuntos e anúncios de forma simplificada</p>
                </div>
            </div>

            {/* Steps Indicator */}
            <div className="mb-8">
                <div className="flex items-center justify-between relative">
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-muted -z-10" />
                    {STEPS.map((step) => (
                        <div
                            key={step.id}
                            className={`flex flex-col items-center gap-2 bg-background px-2 ${step.id <= currentStep ? "text-primary" : "text-muted-foreground"
                                }`}
                        >
                            <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${step.id <= currentStep
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-muted-foreground bg-background"
                                    }`}
                            >
                                {step.id < currentStep ? <Check className="h-4 w-4" /> : step.id}
                            </div>
                            <span className="text-xs font-medium hidden sm:block">{step.title}</span>
                        </div>
                    ))}
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{STEPS[currentStep - 1].title}</CardTitle>
                    <CardDescription>{STEPS[currentStep - 1].description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Step 1: Campaign */}
                    {currentStep === 1 && ( // Added conditional rendering for Step 1
                        <div className="space-y-6">
                            {/* Task Import */}
                            <div className="space-y-2">
                                <Label>Importar de Tarefa/Projeto (Opcional)</Label>
                                <Select value={selectedTaskId} onValueChange={handleTaskSelect}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione uma tarefa para preencher dados..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {tasks?.map((task) => (
                                            <SelectItem key={task.id} value={task.id}>
                                                {task.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Campaign Name */}
                            <div className="space-y-2">
                                <Label>Nome da Campanha</Label>
                                <Input
                                    placeholder="Ex: Campanha Black Friday 2024"
                                    value={campaign.name}
                                    onChange={(e) => setCampaign(prev => ({ ...prev, name: e.target.value }))}
                                />
                            </div>

                            {/* Objective */}
                            <div className="space-y-2">
                                <Label>Objetivo</Label>
                                <Select
                                    value={campaign.objective}
                                    onValueChange={(v) => updateCampaign('objective', v)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione o objetivo" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="OUTCOME_LEADS">Leads</SelectItem>
                                        <SelectItem value="OUTCOME_SALES">Vendas</SelectItem>
                                        <SelectItem value="OUTCOME_TRAFFIC">Tráfego</SelectItem>
                                        <SelectItem value="OUTCOME_ENGAGEMENT">Engajamento</SelectItem>
                                        <SelectItem value="OUTCOME_AWARENESS">Reconhecimento</SelectItem>
                                        <SelectItem value="OUTCOME_APP_PROMOTION">Promoção do App</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Status */}
                            <div className="space-y-2">
                                <Label>Status Inicial</Label>
                                <Select
                                    value={campaign.status}
                                    onValueChange={(v) => setCampaign(prev => ({ ...prev, status: v }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ACTIVE">Ativa</SelectItem>
                                        <SelectItem value="PAUSED">Pausada</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Simple Mode */}
                            <div className="flex items-center space-x-2 pt-4 border-t">
                                <Switch
                                    id="simple-mode"
                                    checked={isSimpleMode}
                                    onCheckedChange={setIsSimpleMode}
                                />
                                <Label htmlFor="simple-mode" className="font-medium cursor-pointer">
                                    Modo Simplificado (Recomendado para teste)
                                </Label>
                            </div>
                            {isSimpleMode && (
                                <div className="bg-blue-50 text-blue-800 p-3 rounded-md text-sm">
                                    <p><strong>Modo Simplificado Ativado:</strong></p>
                                    <ul className="list-disc pl-4 mt-1 space-y-1">
                                        <li>Cria apenas a Campanha e os Conjuntos de Anúncios.</li>
                                        <li>Ignora Interesses e Segmentações complexas.</li>
                                        <li><strong>Não cria anúncios</strong> (você deve adicioná-los depois no Gerenciador).</li>
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 2: Ad Sets & Ads */}
                    {
                        currentStep === 2 && (
                            <div className="space-y-6">
                                {adSets.map((adSet, index) => (
                                    <Card key={adSet.id} className="border-l-4 border-l-primary">
                                        <CardHeader className="pb-2">
                                            <div className="flex items-center justify-between">
                                                <CardTitle className="text-lg">Conjunto #{index + 1}</CardTitle>
                                                <Button variant="ghost" size="sm" onClick={() => {
                                                    setAdSets(prev => prev.filter(s => s.id !== adSet.id));
                                                }}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="space-y-2">
                                                <Label>Nome do Conjunto</Label>
                                                <Input
                                                    value={adSet.name}
                                                    onChange={(e) => updateAdSet(adSet.id, "name", e.target.value)}
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>Orçamento (Centavos)</Label>
                                                    <Input
                                                        type="number"
                                                        value={adSet.daily_budget}
                                                        onChange={(e) => updateAdSet(adSet.id, "daily_budget", e.target.value)}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Otimização</Label>
                                                    <Select
                                                        value={adSet.optimization_goal}
                                                        onValueChange={(v) => updateAdSet(adSet.id, "optimization_goal", v)}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="LEAD_GENERATION">Geração de Leads</SelectItem>
                                                            <SelectItem value="OFFSITE_CONVERSIONS">Conversões</SelectItem>
                                                            <SelectItem value="LINK_CLICKS">Cliques no Link</SelectItem>
                                                            <SelectItem value="POST_ENGAGEMENT">Engajamentos</SelectItem>
                                                            <SelectItem value="MESSAGES">Mensagens</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 gap-4">
                                                {/* Hide destination type selector for engagement campaigns */}
                                                {campaign.objective !== 'OUTCOME_ENGAGEMENT' && (
                                                    <div className="space-y-2">
                                                        <Label>Local da Conversão</Label>
                                                        <Select
                                                            value={adSet.destination_type || ''}
                                                            onValueChange={(v) => updateAdSet(adSet.id, "destination_type", v)}
                                                        >
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Selecione" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {getAllowedDestinations(campaign.objective, adSet.optimization_goal).map((v) => (
                                                                    <SelectItem key={v} value={v}>
                                                                        {v === 'MESSAGES_DESTINATIONS' ? 'Destinos das mensagens'
                                                                            : v === 'ON_AD' ? 'No seu anúncio'
                                                                                : v === 'CALLS' ? 'Ligações'
                                                                                    : v === 'WEBSITE' ? 'Site'
                                                                                        : v === 'APP' ? 'App'
                                                                                            : 'Instagram ou Facebook'}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                )}

                                                {/* Publisher Platforms Selection for Generic Engagement */}
                                                {campaign.objective === 'OUTCOME_ENGAGEMENT' && (
                                                    <div className="space-y-2">
                                                        <Label>Plataformas de Publicação</Label>
                                                        <p className="text-xs text-muted-foreground mb-2">
                                                            Local de conversão: Instagram ou Facebook (padrão)
                                                        </p>
                                                        <div className="flex gap-4">
                                                            <label className="flex items-center gap-2 cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={adSet.publisher_platforms?.includes('facebook') ?? true}
                                                                    onChange={(e) => {
                                                                        const current = adSet.publisher_platforms || [];
                                                                        const updated = e.target.checked
                                                                            ? [...current.filter(p => p !== 'facebook'), 'facebook']
                                                                            : current.filter(p => p !== 'facebook');
                                                                        updateAdSet(adSet.id, 'publisher_platforms', updated);
                                                                    }}
                                                                    className="w-4 h-4"
                                                                />
                                                                <span>Facebook</span>
                                                            </label>
                                                            <label className="flex items-center gap-2 cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={adSet.publisher_platforms?.includes('instagram') ?? true}
                                                                    onChange={(e) => {
                                                                        const current = adSet.publisher_platforms || [];
                                                                        const updated = e.target.checked
                                                                            ? [...current.filter(p => p !== 'instagram'), 'instagram']
                                                                            : current.filter(p => p !== 'instagram');
                                                                        updateAdSet(adSet.id, 'publisher_platforms', updated);
                                                                    }}
                                                                    className="w-4 h-4"
                                                                />
                                                                <span>Instagram</span>
                                                            </label>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="space-y-2 mt-4">
                                                <Label>Segmentação por Interesses</Label>
                                                <Select
                                                    value={adSet.targeting.interests || 'open'}
                                                    onValueChange={(v) => setAdSets(prev => prev.map(s => {
                                                        if (s.id !== adSet.id) return s;
                                                        return {
                                                            ...s,
                                                            targeting: { ...s.targeting, interests: v === 'open' ? undefined : (v === 'custom' ? '' : v) }
                                                        };
                                                    }))}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="open">🎯 Aberto (Método Andromeda - Recomendado)</SelectItem>
                                                        <SelectItem value="custom">📝 Personalizado (IDs de Interesses)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                {adSet.targeting.interests !== undefined && adSet.targeting.interests !== 'open' && (
                                                    <div className="space-y-1">
                                                        <Input
                                                            value={adSet.targeting.interests || ''}
                                                            onChange={(e) => setAdSets(prev => prev.map(s => {
                                                                if (s.id !== adSet.id) return s;
                                                                return {
                                                                    ...s,
                                                                    targeting: { ...s.targeting, interests: e.target.value }
                                                                };
                                                            }))}
                                                            placeholder="Ex: 6003139266461, 6003352872391"
                                                        />
                                                        <p className="text-xs text-muted-foreground">IDs de interesses separados por vírgula</p>
                                                    </div>
                                                )}
                                            </div>


                                            {/* Ads Section */}
                                            <div className="mt-4 pt-4 border-t">
                                                <h4 className="text-sm font-semibold mb-3">Anúncios ({adSet.ads.length})</h4>
                                                <div className="space-y-3">
                                                    {adSet.ads.map((ad, adIndex) => (
                                                        <div key={ad.id} className="bg-muted/30 p-3 rounded-md space-y-3">
                                                            <div className="flex justify-between items-start">
                                                                <Badge variant="outline" className="mb-2">Anúncio #{adIndex + 1}</Badge>
                                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                                                                    setAdSets(prev => prev.map(s => {
                                                                        if (s.id !== adSet.id) return s;
                                                                        return { ...s, ads: s.ads.filter(a => a.id !== ad.id) };
                                                                    }));
                                                                }}>
                                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                                </Button>
                                                            </div>

                                                            <div className="grid grid-cols-2 gap-3">
                                                                <div className="space-y-1">
                                                                    <Label className="text-xs">Nome do Anúncio</Label>
                                                                    <Input
                                                                        value={ad.name}
                                                                        onChange={(e) => updateAd(adSet.id, ad.id, "name", e.target.value)}
                                                                        className="h-8"
                                                                    />
                                                                </div>
                                                                <div className="space-y-1">
                                                                    <Label className="text-xs">ID Criativo (Meta)</Label>
                                                                    <Input
                                                                        value={ad.creative_id}
                                                                        onChange={(e) => updateAd(adSet.id, ad.id, "creative_id", e.target.value)}
                                                                        className="h-8"
                                                                        placeholder="123456789"
                                                                    />
                                                                </div>
                                                            </div>

                                                            {(ad.headline || ad.primary_text) && (
                                                                <div className="bg-background p-2 rounded border text-xs space-y-1">
                                                                    <p className="font-semibold text-muted-foreground">Prévia do Conteúdo</p>
                                                                    {ad.headline && <p><span className="font-medium">Título:</span> {ad.headline}</p>}
                                                                    {ad.primary_text && <p><span className="font-medium">Texto:</span> {ad.primary_text.substring(0, 100)}{ad.primary_text.length > 100 ? '...' : ''}</p>}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                    <Button variant="outline" size="sm" className="w-full" onClick={() => {
                                                        setAdSets(prev => prev.map(s => {
                                                            if (s.id !== adSet.id) return s;
                                                            return {
                                                                ...s,
                                                                ads: [...s.ads, {
                                                                    id: crypto.randomUUID(),
                                                                    name: `Anúncio #${s.ads.length + 1}`,
                                                                    creative_id: "",
                                                                    status: "PAUSED"
                                                                }]
                                                            };
                                                        }));
                                                    }}>
                                                        <Plus className="h-3 w-3 mr-2" /> Adicionar Anúncio
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                                <Button variant="outline" className="w-full border-dashed" onClick={() => {
                                    setAdSets(prev => [...prev, {
                                        id: crypto.randomUUID(),
                                        name: `Conjunto #${prev.length + 1}`,
                                        billing_event: "IMPRESSIONS",
                                        optimization_goal: "LEAD_GENERATION",
                                        daily_budget: "2000",
                                        status: "PAUSED",
                                        destination_type: undefined,
                                        publisher_platforms: ['facebook', 'instagram'],
                                        targeting: {
                                            geo_locations: { countries: ["BR"] },
                                            age_min: 18,
                                            age_max: 65,
                                        },
                                        ads: []
                                    }]);
                                }}>
                                    <Plus className="h-4 w-4 mr-2" /> Adicionar Conjunto de Anúncios
                                </Button>
                            </div>
                        )
                    }

                    {/* Step 3: Review */}
                    {
                        currentStep === 3 && (
                            <div className="space-y-4">
                                <div className="rounded-lg border p-4 space-y-4">
                                    <div>
                                        <h3 className="font-medium text-lg">Campanha</h3>
                                        <p className="text-sm text-muted-foreground">Nome: {campaign.name}</p>
                                        <p className="text-sm text-muted-foreground">Objetivo: {campaign.objective}</p>
                                    </div>
                                    <div className="border-t pt-4 space-y-4">
                                        <h3 className="font-medium">Estrutura ({adSets.length} Conjuntos)</h3>
                                        {adSets.map((adSet, idx) => (
                                            <div key={adSet.id} className="bg-muted/30 p-3 rounded-md space-y-2">
                                                <div className="flex justify-between">
                                                    <span className="font-medium text-sm">{adSet.name}</span>
                                                    <Badge variant="outline">{(parseInt(adSet.daily_budget) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</Badge>
                                                </div>
                                                <div className="pl-4 border-l-2 border-muted">
                                                    <p className="text-xs text-muted-foreground mb-2">{adSet.ads.length} Anúncios</p>
                                                    {adSet.ads.map(ad => (
                                                        <div key={ad.id} className="text-xs flex justify-between">
                                                            <span>{ad.name}</span>
                                                            <span className="font-mono text-muted-foreground">{ad.creative_id}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )
                    }

                    <div className="flex justify-between pt-4">
                        <Button variant="outline" onClick={handleBack} disabled={currentStep === 1 || isLoading}>
                            Voltar
                        </Button>
                        {currentStep < STEPS.length ? (
                            <Button onClick={handleNext}>Próximo <ChevronRight className="ml-2 h-4 w-4" /></Button>
                        ) : (
                            <Button onClick={handleSubmit} disabled={isLoading}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Publicar Campanha
                            </Button>
                        )}
                    </div>
                </CardContent >
            </Card >
        </div >
    );
}
