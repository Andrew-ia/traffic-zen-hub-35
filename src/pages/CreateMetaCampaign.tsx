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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCreativeLibrary } from "@/hooks/useCreativeLibrary";


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
const ENV_PAGE_ID = (import.meta.env.VITE_META_PAGE_ID as string | undefined)?.trim() || "";
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
    creative_asset_id?: string;
}

interface AdSet {
  id: string; // Temporary ID for UI
  name: string;
  billing_event: string;
  optimization_goal: string;
  daily_budget: string; // string for input, parsed to cents
  status: string;
  destination_type?: string; // 'MESSAGING_APP', 'ON_AD', 'WEBSITE', or empty
  destination_subtype?: string; // For messages
  conversion_event?: string; // For WEBSITE
  publisher_platforms?: string[]; // ['facebook'], ['instagram'], or ['facebook', 'instagram']
  start_time?: string; // ISO string (YYYY-MM-DDTHH:mm:ssZ)
  end_time?: string;   // ISO string (YYYY-MM-DDTHH:mm:ssZ)
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
    settings?: {
      audience?: {
        temperature?: 'frio' | 'morno' | 'quente';
        theme?: string;
        region?: string;
      };
      destination?: {
        type?: string;
        subtype?: string;
        platform?: 'instagram' | 'facebook';
        event?: string;
      };
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
    const [pageId, setPageId] = useState<string>(ENV_PAGE_ID);
    const [pageInfo, setPageInfo] = useState<{ id?: string; name?: string } | null>(null);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [pickerContext, setPickerContext] = useState<{ adSetId: string; adId: string } | null>(null);
    const [pickerSearch, setPickerSearch] = useState("");
    const [mirroring, setMirroring] = useState<string | null>(null);

    // Form State
    const [campaign, setCampaign] = useState({
        name: "",
        objective: "OUTCOME_LEADS",
        status: "PAUSED",
        special_ad_categories: [] as string[],
        daily_budget_cents: 0 as number,
    });

  const initialAdSetState: AdSet = {
      id: crypto.randomUUID(),
      name: "Conjunto #1",
      billing_event: "IMPRESSIONS",
      optimization_goal: "POST_ENGAGEMENT", // Default to POST_ENGAGEMENT as it's safer/more common
      daily_budget: "5000", // 50 BRL
      status: "PAUSED",
      destination_type: "ON_AD", // Default to ON_AD (which maps to ON_POST/ON_VIDEO etc)
      destination_subtype: "",
      conversion_event: "",
      publisher_platforms: ["facebook", "instagram"],
      targeting: {
        geo_locations: {
          countries: ["BR"],
        },
            age_min: 18,
            age_max: 65,
            genders: [2],
            publisher_platforms: ["facebook", "instagram"],
            facebook_positions: ["feed"],
            instagram_positions: ["stream"],
            device_platforms: ["mobile", "desktop"],
        },
        settings: { audience: { temperature: 'frio', theme: '', region: '' } },
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
    const [instagramActorId, setInstagramActorId] = useState<string | null>(null);

    // Update ad sets when campaign objective changes
    useEffect(() => {
        if (campaign.objective === 'OUTCOME_ENGAGEMENT') {
            setAdSets(prev => prev.map(adSet => ({
                ...adSet,
                optimization_goal: 'POST_ENGAGEMENT',
                destination_type: 'ON_AD',
                publisher_platforms: Array.from(new Set([...(adSet.publisher_platforms || []), 'instagram']))
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
    const { data: driveCreatives } = useCreativeLibrary({ days: 90, onlyType: 'video', limit: 200 });
    const { data: audiences } = useQuery({
        queryKey: ['meta-custom-audiences', WORKSPACE_ID],
        enabled: !!WORKSPACE_ID,
        queryFn: async () => {
            const resp = await fetch(`${API_BASE}/api/integrations/meta/custom-audiences/${WORKSPACE_ID}`);
            const data = await resp.json();
            return data.success ? (data.data?.audiences || []) : [];
        }
    });

    const apiDiagnostics = {
        apiBase: API_BASE,
        isProd: !import.meta.env.DEV,
        hasAudiences: Array.isArray(audiences) && audiences.length > 0,
        likelyMisconfigured: (!import.meta.env.DEV && !API_BASE),
    };

    const isMetaCampaignTask = (task: PMTask) => {
        const cd = task.metadata?.campaign_data;
        if (!cd) return false;
        const raw = String(cd.objective || '').trim();
        const obj = raw.toUpperCase();
        // aceitar sinônimos legados e normalizar
        const synonyms: Record<string, string> = {
            'ENGAGEMENT': 'OUTCOME_ENGAGEMENT',
            'CONVERSIONS': 'OUTCOME_SALES',
            'SALES': 'OUTCOME_SALES',
            'LEADS': 'OUTCOME_LEADS',
            'TRAFFIC': 'OUTCOME_TRAFFIC',
            'AWARENESS': 'OUTCOME_AWARENESS',
            'APP_PROMOTION': 'OUTCOME_APP_PROMOTION',
        };
        const normalized = synonyms[obj] || obj;
        const valid = new Set([
            'OUTCOME_LEADS',
            'OUTCOME_SALES',
            'OUTCOME_TRAFFIC',
            'OUTCOME_ENGAGEMENT',
            'OUTCOME_AWARENESS',
            'OUTCOME_APP_PROMOTION',
            'LEAD_GENERATION',
            'LINK_CLICKS',
            'POST_ENGAGEMENT',
            'CONVERSIONS',
            'MESSAGES'
        ]);
        const hasSets = Array.isArray(cd.adSets) && cd.adSets.length > 0;
        return valid.has(normalized) && hasSets;
    };

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
            // Ajusta automaticamente para o primeiro destino válido do objetivo atual
            return { ...s, destination_type: filtered[0] };
        }));
    }

    // Chamado quando objetivo muda
    function updateCampaign<K extends keyof typeof campaign>(key: K, value: (typeof campaign)[K]) {
        setCampaign(prev => ({ ...prev, [key]: value }));
        setTimeout(ensureValidDestinations, 0);
        setTimeout(() => {
            setAdSets(prev => prev.map(s => {
                const allowed = getAllowedOptimizations(String((key === 'objective' ? value : campaign.objective)));
                return allowed.includes(s.optimization_goal) ? s : { ...s, optimization_goal: allowed[0] };
            }));
        }, 0);
    }

    function getAllowedDestinations(objective: string, optimization: string) {
        const obj = objective.toUpperCase();
        const opt = optimization.toUpperCase();

        if (obj === 'OUTCOME_ENGAGEMENT') {
            // Engajamento: mensagens, no anúncio, ou Instagram/Facebook
            return ['MESSAGES_DESTINATIONS', 'ON_AD', 'INSTAGRAM_OR_FACEBOOK'];
        }

        if (obj === 'OUTCOME_LEADS') {
            // Leads: permitir WhatsApp, Messenger, Instagram/Facebook e Site
            return ['WHATSAPP', 'MESSENGER', 'INSTAGRAM_OR_FACEBOOK', 'WEBSITE'];
        }
        if (obj === 'OUTCOME_SALES') {
            return ['WEBSITE', 'WHATSAPP'];
        }
        if (obj === 'OUTCOME_TRAFFIC') {
            // Disponibiliza os mesmos destinos que o Meta UI: Site, App, Mensagens, Instagram ou Facebook, Ligações
            return ['WEBSITE', 'APP', 'MESSAGES_DESTINATIONS', 'INSTAGRAM_OR_FACEBOOK', 'CALLS'];
        }

        if (obj === 'OUTCOME_AWARENESS') {
            // Reconhecimento: opções de interação no anúncio ou perfil/página
            return ['ON_AD', 'INSTAGRAM_OR_FACEBOOK'];
        }

        return ['WEBSITE'];
    }

    function getAllowedOptimizations(objective: string) {
        const obj = String(objective || '').toUpperCase();
        if (obj === 'OUTCOME_TRAFFIC') return ['LINK_CLICKS'];
        if (obj === 'OUTCOME_LEADS') return ['LEAD_GENERATION'];
        if (obj === 'OUTCOME_SALES') return ['OFFSITE_CONVERSIONS'];
        if (obj === 'OUTCOME_ENGAGEMENT') return ['POST_ENGAGEMENT'];
        if (obj === 'OUTCOME_AWARENESS') return ['REACH'];
        return ['LINK_CLICKS'];
    }

    useEffect(() => {
        const destinationKey = adSets.map(s => String(s.destination_type || '')).join('|');
        const hasTrafficDestNeedingPage = adSets.some(s => ['MESSAGES_DESTINATIONS', 'INSTAGRAM_OR_FACEBOOK'].includes(String(s.destination_type)));
        const hasSalesMessages = adSets.some(s => ['WHATSAPP', 'MESSENGER'].includes(String(s.destination_type)));
        const needsPage = (
            campaign.objective === 'OUTCOME_ENGAGEMENT' ||
            campaign.objective === 'OUTCOME_LEADS' ||
            (campaign.objective === 'OUTCOME_TRAFFIC' && hasTrafficDestNeedingPage) ||
            (campaign.objective === 'OUTCOME_SALES' && hasSalesMessages)
        );
        if (needsPage && (!pageId || !instagramActorId)) {
            (async () => {
                try {
                    const resp = await fetch(`${API_BASE}/api/integrations/meta/page-info/${WORKSPACE_ID}`);
                    const data = await resp.json();
                    if (data?.success && data?.data?.page_id) {
                        setPageId(data.data.page_id);
                        setPageInfo({ id: data.data.page_id, name: data.data.page_name });
                    }
                    if (data?.success && data?.data?.instagram_actor_id) {
                        setInstagramActorId(String(data.data.instagram_actor_id));
                    }
                } catch (e) {
                    console.warn('Failed to fetch page info', e);
                }
            })();
        }
    }, [campaign.objective, pageId, adSets, instagramActorId]);

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
        const toIsoStart = (d?: string) => {
            if (!d) return undefined;
            try { return new Date(`${d}T00:00:00Z`).toISOString(); } catch { return undefined; }
        };
        const toIsoEnd = (d?: string) => {
            if (!d) return undefined;
            try { return new Date(`${d}T23:59:59Z`).toISOString(); } catch { return undefined; }
        };

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
            setCampaign(prev => ({ ...prev, daily_budget_cents: totalBudgetCents }));

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
                    const src = String((importedAdSet as any)?.destinationType || (task.metadata?.campaign_data as any)?.destinationType || '').toUpperCase();
                    const obj = String(mappedObjective || '').toUpperCase();
                    const allowed = obj === 'OUTCOME_ENGAGEMENT'
                        ? ['MESSAGES_DESTINATIONS', 'ON_AD', 'INSTAGRAM_OR_FACEBOOK']
                        : obj === 'OUTCOME_LEADS'
                            ? ['WHATSAPP', 'MESSENGER', 'INSTAGRAM_OR_FACEBOOK', 'WEBSITE']
                            : obj === 'OUTCOME_SALES'
                                ? ['WEBSITE']
                                : obj === 'OUTCOME_TRAFFIC'
                                    ? ['WEBSITE', 'APP', 'MESSAGES_DESTINATIONS', 'INSTAGRAM_OR_FACEBOOK', 'CALLS']
                                    : obj === 'OUTCOME_AWARENESS'
                                        ? ['ON_AD', 'INSTAGRAM_OR_FACEBOOK']
                                        : ['WEBSITE'];
                    if (src && allowed.includes(src)) return src;
                    if (obj === 'OUTCOME_TRAFFIC') return undefined;
                    if (obj === 'OUTCOME_SALES') return 'WEBSITE';
                    if (obj === 'OUTCOME_LEADS') return 'WHATSAPP';
                    if (obj === 'OUTCOME_ENGAGEMENT') return 'INSTAGRAM_OR_FACEBOOK';
                    return undefined;
                })(),
                start_time: toIsoStart(data.startDate),
                end_time: toIsoEnd(data.endDate),
                targeting: {
                    geo_locations: { countries: ["BR"] },
                    age_min: data.ageMin || 18,
                    age_max: data.ageMax || 65,
                    genders: [2],
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
            if (campaign.objective === 'OUTCOME_TRAFFIC') {
                const missingDest = adSets.filter(s => !s.destination_type);
                if (missingDest.length > 0) {
                    toast({
                        title: "Defina o Local da Conversão",
                        description: "Selecione Site, App, Mensagens, Instagram/Facebook ou Ligações em todos os conjuntos.",
                        variant: "destructive",
                    });
                    setIsLoading(false);
                    return;
                }
                const missingSub = adSets.some(s => s.destination_type === 'MESSAGES_DESTINATIONS' && !s.destination_subtype);
                if (missingSub) {
                    toast({
                        title: "Selecione o Canal de Mensagem",
                        description: "Escolha WhatsApp, Messenger ou Instagram Direct para todos os conjuntos com destino Mensagens.",
                        variant: "destructive",
                    });
                    setIsLoading(false);
                    return;
                }
                // Para Instagram/Facebook usamos as plataformas de publicação (checkboxes)
                const instagramOnlySets = adSets.filter(s => String(s.destination_type) === 'INSTAGRAM_OR_FACEBOOK' && Array.isArray(s.publisher_platforms) && s.publisher_platforms.includes('instagram') && !s.publisher_platforms.includes('facebook'));
                const missingIgCreative = instagramOnlySets.some(s => (s.ads || []).some(ad => !ad.creative_asset_id));
                if (campaign.objective === 'OUTCOME_ENGAGEMENT' && missingIgCreative) {
                    toast({
                        title: "Selecione um criativo para Instagram",
                        description: "Para publicar somente no Instagram, escolha um vídeo/imagem no Drive para cada anúncio.",
                        variant: "destructive",
                    });
                    setIsLoading(false);
                    return;
                }
                const missingEvent = adSets.some(s => s.destination_type === 'WEBSITE' && !s.conversion_event);
                if (missingEvent) {
                    toast({
                        title: "Selecione o Evento de Conversão",
                        description: "Defina o evento (ex.: Compra, Lead, Page View) para conjuntos com destino Site.",
                        variant: "destructive",
                    });
                    setIsLoading(false);
                    return;
                }
                const needsPage = adSets.some(s => ['MESSAGES_DESTINATIONS', 'INSTAGRAM_OR_FACEBOOK'].includes(String(s.destination_type)));
                if (needsPage && !pageId) {
                    // Tenta resolver automaticamente, mas não bloqueia: backend possui fallback (META_PAGE_ID/credenciais)
                    try {
                        const resp = await fetch(`${API_BASE}/api/integrations/meta/page-info/${WORKSPACE_ID}`);
                        const data = await resp.json();
                        if (data?.success && data?.data?.page_id) {
                            setPageId(data.data.page_id);
                        }
                    } catch { void 0; }
                }
            }
            const response = await fetch(`${API_BASE}/api/integrations/meta/create-campaign`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    workspaceId: WORKSPACE_ID,
                    campaign: { ...campaign, daily_budget: campaign.daily_budget_cents && campaign.daily_budget_cents > 0 ? String(campaign.daily_budget_cents) : undefined },
                    adSets: adSets.map(adSet => {
                        // FORÇA POST_ENGAGEMENT para campanhas de engajamento
                        const finalOptimizationGoal =
                            campaign.objective === 'OUTCOME_ENGAGEMENT'
                                ? 'POST_ENGAGEMENT'
                                : adSet.optimization_goal;

                        // REMOVE destination_type completamente para engajamento (backend infere)
                        const shouldRemoveDestination = false;

                        const baseSet = {
                            ...adSet,
                            optimization_goal: finalOptimizationGoal,
                            // NÃO enviar destination_type para engajamento
                            ...(shouldRemoveDestination ? {} : {
                                destination_type: adSet.destination_type
                            }),
                            settings: {
                                ...(adSet.settings || {}),
                                destination: {
                                    type: adSet.destination_type,
                                    subtype: adSet.destination_subtype,
                                    platform: adSet.destination_platform,
                                    event: adSet.conversion_event,
                                },
                            },
                            ...(adSet.start_time ? { start_time: adSet.start_time } : {}),
                            ...(adSet.end_time ? { end_time: adSet.end_time } : {}),
                            targeting: {
                                ...adSet.targeting,
                                publisher_platforms: adSet.publisher_platforms || ['facebook', 'instagram']
                            },
                            ads: isSimpleMode ? [] : adSet.ads.map(ad => ({
                                ...ad,
                                creative_id: campaign.objective === 'OUTCOME_ENGAGEMENT' ? '' : (ad.creative_id || ''),
                                creative_asset_id: ad.creative_asset_id,
                                status: 'paused'
                            }))
                        };
                        // CBO ativo: não enviar daily_budget nos ad sets
                        if (campaign.daily_budget_cents && campaign.daily_budget_cents > 0) {
                            const { daily_budget, ...rest } = baseSet as any;
                            return rest;
                        }
                        // Sem CBO: manter daily_budget nos ad sets
                        return { ...baseSet, daily_budget: parseInt(adSet.daily_budget) };
                    }),
                    pageId: pageId || undefined,
                }),
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || "Erro ao criar campanha");
            }

            const errors = Array.isArray(data?.data?.errors) ? data.data.errors : [];
            const adSetErrors = errors.filter((e: any) => e && e.name && !e.adSetName);
            const adErrors = errors.filter((e: any) => e && e.adSetName);
            if (errors.length > 0) {
                toast({
                    title: "Campanha criada com avisos",
                    description: `Falhas: ${adSetErrors.length} conjunto(s), ${adErrors.length} anúncio(s). Verifique no Meta Ads.`,
                    variant: "default",
                });
            } else {
                toast({
                    title: "Campanha criada com sucesso!",
                    description: "Sua campanha foi enviada para o Meta Ads.",
                });
            }

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
        setAdSets(prev => {
            const next = prev.map(adSet => {
                if (adSet.id !== id) return adSet;
                const updated: AdSet = { ...adSet, [field]: value };
                if (field === 'destination_type') {
                    updated.destination_subtype = '';
                    updated.destination_platform = undefined;
                    updated.conversion_event = '';
                }
                const dest = {
                    type: updated.destination_type,
                    subtype: updated.destination_subtype,
                    platform: updated.destination_platform,
                    event: updated.conversion_event,
                };
                updated.settings = { ...(updated.settings || {}), destination: dest };
                return updated;
            });
            // Propagar destino escolhido para todos os conjuntos quando objetivo é Tráfego
            if (field === 'destination_type' && campaign.objective === 'OUTCOME_TRAFFIC') {
                const chosen = String(value || '').trim();
                return next.map(s => ({ ...s, destination_type: chosen, destination_subtype: '', destination_platform: undefined, conversion_event: '' }));
            }
            return next;
        });
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
                                        {tasks?.filter(isMetaCampaignTask).map((task) => (
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
                            {/* Campaign Budget (CBO) */}
                            <div className="space-y-2">
                                <Label>Orçamento diário da campanha (centavos) — CBO</Label>
                                <Input
                                    type="number"
                                    placeholder="Ex: 2000 (R$ 20,00)"
                                    value={campaign.daily_budget_cents}
                                    onChange={(e) => setCampaign(prev => ({ ...prev, daily_budget_cents: Number(e.target.value || 0) }))}
                                />
                                <p className="text-xs text-muted-foreground">Com CBO ativo, o Meta distribui automaticamente entre conjuntos e anúncios.</p>
                            </div>
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
                                                    <Label>Orçamento</Label>
                                                    <div className="text-xs text-muted-foreground">CBO ativo: orçamento definido na campanha.</div>
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
                                                            {getAllowedOptimizations(campaign.objective).map((opt) => (
                                                                <SelectItem key={opt} value={opt}>
                                                                    {opt === 'LINK_CLICKS' ? 'Cliques no Link'
                                                                        : opt === 'LEAD_GENERATION' ? 'Geração de Leads'
                                                                            : opt === 'OFFSITE_CONVERSIONS' ? 'Conversões'
                                                                                : opt === 'POST_ENGAGEMENT' ? 'Engajamentos'
                                                                                    : 'Alcance'}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 gap-4">
                                                {/* Hide destination type selector for engagement campaigns */}
                                                {(
                                                    campaign.objective === 'OUTCOME_ENGAGEMENT' ||
                                                    campaign.objective === 'OUTCOME_TRAFFIC' ||
                                                    campaign.objective === 'OUTCOME_LEADS' ||
                                                    campaign.objective === 'OUTCOME_SALES' ||
                                                    campaign.objective === 'OUTCOME_AWARENESS'
                                                ) && (
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
                                                                                                : v === 'WHATSAPP' ? 'WhatsApp'
                                                                                                    : v === 'MESSENGER' ? 'Messenger'
                                                                                                        : 'Instagram ou Facebook'}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    )}

                                                    {/* Subcampo: Mensagens -> canal específico */}
                                                    {adSet.destination_type === 'MESSAGES_DESTINATIONS' && (
                                                        <div className="space-y-2">
                                                            <Label>Canal de Mensagem</Label>
                                                            <Select
                                                                value={adSet.destination_subtype || ''}
                                                                onValueChange={(v) => updateAdSet(adSet.id, 'destination_subtype', v)}
                                                            >
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Selecione o canal" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                                                                    <SelectItem value="MESSENGER">Messenger</SelectItem>
                                                                    <SelectItem value="INSTAGRAM_DM">Instagram Direct</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    )}

                                                    {/* Campo de plataforma removido; usar checkboxes de plataformas de publicação abaixo */}

                                                    {/* Subcampo: Website -> evento de conversão */}
                                                    {adSet.destination_type === 'WEBSITE' && (
                                                        <div className="space-y-2">
                                                            <Label>Evento de Conversão</Label>
                                                            <Select
                                                                value={adSet.conversion_event || ''}
                                                                onValueChange={(v) => updateAdSet(adSet.id, 'conversion_event', v)}
                                                            >
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Selecione o evento" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {(() => {
                                                                        const obj = String(campaign.objective || '').toUpperCase();
                                                                        const opts = obj === 'OUTCOME_SALES'
                                                                            ? [
                                                                                { v: 'PURCHASE', l: 'Compra' },
                                                                                { v: 'INITIATE_CHECKOUT', l: 'Início de Checkout' },
                                                                                { v: 'ADD_TO_CART', l: 'Adicionar ao Carrinho' },
                                                                            ]
                                                                            : obj === 'OUTCOME_LEADS'
                                                                                ? [
                                                                                    { v: 'LEAD', l: 'Lead' },
                                                                                    { v: 'COMPLETE_REGISTRATION', l: 'Cadastro Concluído' },
                                                                                ]
                                                                                : [
                                                                                    { v: 'VIEW_CONTENT', l: 'Visualização de Conteúdo' },
                                                                                    { v: 'PAGE_VIEW', l: 'Page View' },
                                                                                ];
                                                                        return opts.map(({ v, l }) => (
                                                                            <SelectItem key={v} value={v}>{l}</SelectItem>
                                                                        ));
                                                                    })()}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    )}

                                                {(campaign.objective === 'OUTCOME_ENGAGEMENT' ||
                                                    (campaign.objective === 'OUTCOME_TRAFFIC' && (adSet.destination_type === 'MESSAGES_DESTINATIONS' || adSet.destination_type === 'INSTAGRAM_OR_FACEBOOK')) ||
                                                    campaign.objective === 'OUTCOME_LEADS' ||
                                                    (campaign.objective === 'OUTCOME_SALES' && (adSet.destination_type === 'WHATSAPP' || adSet.destination_type === 'MESSENGER'))) && (
                                                    <div className="space-y-2">
                                                        <Label>Page ID (Facebook)</Label>
                                                            {pageId ? (
                                                                <div className="bg-green-50 text-green-800 p-3 rounded-md text-sm border border-green-200">
                                                                    <p><strong>✓ Configurado automaticamente:</strong></p>
                                                                    <p className="font-mono mt-1">{pageId}</p>
                                                                    {pageInfo?.name && (
                                                                        <p className="text-xs mt-1">Página: {pageInfo.name}</p>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <Input
                                                                        placeholder="Ex: 123456789012345"
                                                                        value={pageId}
                                                                        onChange={(e) => setPageId(e.target.value)}
                                                                    />
                                                                    <p className="text-xs text-amber-600">⚠️ Page ID não encontrado. Configure VITE_META_PAGE_ID no .env.local</p>
                                                                </>
                                                            )}
                                                        </div>
                                                    )}

                                                {campaign.objective === 'OUTCOME_ENGAGEMENT' && (
                                                    <div className="space-y-2">
                                                        <Label>Conta do Instagram</Label>
                                                        {instagramActorId ? (
                                                            <div className="bg-green-50 text-green-800 p-3 rounded-md text-sm border border-green-200">
                                                                <p><strong>✓ Selecionada automaticamente:</strong></p>
                                                                <p className="font-mono mt-1">{instagramActorId}</p>
                                                                <p className="text-xs mt-1">Origem: página conectada</p>
                                                            </div>
                                                        ) : (
                                                            <div className="bg-amber-50 text-amber-800 p-3 rounded-md text-sm border border-amber-200">
                                                                <p><strong>Conta não detectada</strong></p>
                                                                <p className="text-xs mt-1">Conecte um perfil Instagram à sua Página do Facebook para seleção automática.</p>
                                                            </div>
                                                        )}
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
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label>Temperatura do Público</Label>
                                                        <Select
                                                            value={adSet.settings?.audience?.temperature || 'frio'}
                                                            onValueChange={(v) => {
                                                                const s = adSet.settings || { audience: {} };
                                                                const a = { ...(s.audience || {}), temperature: v as any };
                                                                const settings = { ...s, audience: a };
                                                                const name = `${a.temperature || ''}${adSet.targeting.genders?.length === 1 ? `, ${adSet.targeting.genders?.[0] === 2 ? 'feminino' : 'masculino'}` : ''}, ${adSet.targeting.age_min} a ${adSet.targeting.age_max} anos`.trim();
                                                                setAdSets(prev => prev.map(s0 => s0.id === adSet.id ? { ...s0, settings, name } : s0));
                                                            }}
                                                        >
                                                            <SelectTrigger>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="frio">Frio</SelectItem>
                                                                <SelectItem value="morno">Morno</SelectItem>
                                                                <SelectItem value="quente">Quente</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Faixa Etária</Label>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <Input
                                                                type="number"
                                                                value={adSet.targeting.age_min}
                                                                onChange={(e) => setAdSets(prev => prev.map(s0 => s0.id === adSet.id ? { ...s0, targeting: { ...s0.targeting, age_min: Number(e.target.value) } } : s0))}
                                                            />
                                                            <Input
                                                                type="number"
                                                                value={adSet.targeting.age_max}
                                                                onChange={(e) => setAdSets(prev => prev.map(s0 => s0.id === adSet.id ? { ...s0, targeting: { ...s0.targeting, age_max: Number(e.target.value) } } : s0))}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Sexo</Label>
                                                        <div className="flex gap-4">
                                                            <label className="flex items-center gap-2 cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={(adSet.targeting.genders || []).includes(2)}
                                                                    onChange={(e) => {
                                                                        const g = new Set(adSet.targeting.genders || []);
                                                                        if (e.target.checked) g.add(2); else g.delete(2);
                                                                        setAdSets(prev => prev.map(s0 => s0.id === adSet.id ? { ...s0, targeting: { ...s0.targeting, genders: Array.from(g) } } : s0));
                                                                    }}
                                                                    className="w-4 h-4"
                                                                />
                                                                <span>Feminino</span>
                                                            </label>
                                                            <label className="flex items-center gap-2 cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={(adSet.targeting.genders || []).includes(1)}
                                                                    onChange={(e) => {
                                                                        const g = new Set(adSet.targeting.genders || []);
                                                                        if (e.target.checked) g.add(1); else g.delete(1);
                                                                        setAdSets(prev => prev.map(s0 => s0.id === adSet.id ? { ...s0, targeting: { ...s0.targeting, genders: Array.from(g) } } : s0));
                                                                    }}
                                                                    className="w-4 h-4"
                                                                />
                                                                <span>Masculino</span>
                                                            </label>
                                                        </div>
                                                    </div>
                                                </div>
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

                                            {/* Custom Audiences */}
                                            <div className="space-y-2 mt-4">
                                                <Label>Públicos personalizados (Meta)</Label>
                                                <p className="text-xs text-muted-foreground">Selecione um ou mais IDs. Busca por nome disponível.</p>
                                                {!apiDiagnostics.hasAudiences && apiDiagnostics.isProd && (
                                                    <div className="rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                                                        API não retornou públicos. Verifique a variável VITE_API_URL e credenciais Meta no ambiente de produção.
                                                    </div>
                                                )}
                                                <div className="border rounded p-2">
                                                    <Input
                                                        placeholder="Buscar público..."
                                                        value={pickerSearch}
                                                        onChange={(e) => setPickerSearch(e.target.value)}
                                                        className="mb-2"
                                                    />
                                                    <ScrollArea className="h-40">
                                                        <div className="space-y-1">
                                                            {(audiences || [])
                                                                .filter((a: any) => !pickerSearch || String(a.name).toLowerCase().includes(pickerSearch.toLowerCase()))
                                                                .map((a: any) => {
                                                                    const selectedIds = (adSet.targeting.custom_audiences || '').split(',').map(s => s.trim()).filter(Boolean);
                                                                    const checked = selectedIds.includes(String(a.id));
                                                                    return (
                                                                        <label key={a.id} className="flex items-center justify-between gap-2 text-sm py-1">
                                                                            <div className="flex items-center gap-2">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={checked}
                                                                                    onChange={(e) => {
                                                                                        const setIds = new Set(selectedIds);
                                                                                        if (e.target.checked) setIds.add(String(a.id)); else setIds.delete(String(a.id));
                                                                                        const next = Array.from(setIds).join(',');
                                                                                        setAdSets(prev => prev.map(s0 => s0.id === adSet.id ? { ...s0, targeting: { ...s0.targeting, custom_audiences: next } } : s0));
                                                                                    }}
                                                                                    className="w-4 h-4"
                                                                                />
                                                                                <span>{a.name}</span>
                                                                            </div>
                                                                            <span className="text-xs text-muted-foreground">{a.subtype}</span>
                                                                        </label>
                                                                    );
                                                                })}
                                                        </div>
                                                    </ScrollArea>
                                                    {adSet.targeting.custom_audiences && (
                                                        <p className="text-xs text-muted-foreground mt-2">Selecionados: {(adSet.targeting.custom_audiences || '').split(',').filter(Boolean).length}</p>
                                                    )}
                                                </div>
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
                                                                {/* Campo de ID do Criativo (Meta) removido — usar seleção de Drive */}
                                                                <div className="col-span-2 flex items-center gap-2">
                                                                    <Button variant="outline" size="sm" onClick={() => { setPickerContext({ adSetId: adSet.id, adId: ad.id }); setPickerOpen(true); }}>
                                                                        Escolher criativo do Drive (vídeo)
                                                                    </Button>
                                                                    {ad.creative_asset_id && (
                                                                        <Badge variant="secondary">Selecionado: {ad.creative_asset_id}</Badge>
                                                                    )}
                                                                    {ad.creative_asset_id && (
                                                                        <Button
                                                                            variant="secondary"
                                                                            size="sm"
                                                                            disabled={mirroring === ad.creative_asset_id}
                                                                            onClick={async () => {
                                                                                try {
                                                                                    setMirroring(ad.creative_asset_id!);
                                                                                    const url = `${API_BASE}/api/creatives/mirror/${WORKSPACE_ID}/${ad.creative_asset_id}`;
                                                                                    const resp = await fetch(url, { method: 'POST' });
                                                                                    const data = await resp.json();
                                                                                    if (!data?.success) throw new Error(String(data?.error || 'Falha ao espelhar'));
                                                                                    toast({ title: 'Criativo espelhado', description: 'URL pública do Supabase preparada.' });
                                                                                } catch (e: any) {
                                                                                    toast({ title: 'Falha ao espelhar', description: String(e?.message || e), variant: 'destructive' });
                                                                                } finally {
                                                                                    setMirroring(null);
                                                                                }
                                                                            }}
                                                                        >
                                                                            {mirroring === ad.creative_asset_id ? 'Espelhando...' : 'Espelhar para Supabase'}
                                                                        </Button>
                                                                    )}
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
                                        daily_budget: "0",
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
                                                    <Badge variant="outline">CBO</Badge>
                                                </div>
                                            <div className="pl-4 border-l-2 border-muted">
                                                <p className="text-xs text-muted-foreground">Local da Conversão: {(() => {
                                                    const v = String(adSet.destination_type || '').toUpperCase();
                                                    return v === 'WHATSAPP' ? 'WhatsApp'
                                                        : v === 'MESSENGER' ? 'Messenger'
                                                        : v === 'INSTAGRAM_OR_FACEBOOK' ? 'Instagram ou Facebook'
                                                        : v === 'MESSAGES_DESTINATIONS' ? 'Mensagens'
                                                        : v === 'ON_AD' ? 'No anúncio'
                                                        : v === 'ON_POST' ? 'No post'
                                                        : v === 'WEBSITE' ? 'Site'
                                                        : v === 'APP' ? 'App'
                                                        : v === 'CALLS' ? 'Ligações'
                                                        : '-';
                                                })()}</p>
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
            <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Selecionar criativo do Drive</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <Input value={pickerSearch} onChange={(e) => setPickerSearch(e.target.value)} placeholder="Buscar por nome" />
                        <ScrollArea className="h-[420px]">
                            <div className="grid grid-cols-2 gap-3">
                                {(driveCreatives || [])
                                    .filter((c: any) => !pickerSearch || String(c.name || '').toLowerCase().includes(pickerSearch.toLowerCase()))
                                    .map((c: any) => (
                                        <Card key={c.id} onClick={() => {
                                            if (!pickerContext) return;
                                            setAdSets(prev => prev.map(s => {
                                                if (s.id !== pickerContext.adSetId) return s;
                                                return {
                                                    ...s,
                                                    ads: s.ads.map(a => a.id === pickerContext.adId ? { ...a, creative_asset_id: c.id } : a)
                                                };
                                            }));
                                            setPickerOpen(false);
                                        }} className="cursor-pointer">
                                            <CardContent className="p-3 space-y-2">
                                                <div className="aspect-video rounded bg-muted overflow-hidden">
                                                    {c.thumbnailUrl ? (
                                                        <img src={c.thumbnailUrl} alt={c.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full" />
                                                    )}
                                                </div>
                                                <div className="text-xs truncate">{c.name}</div>
                                            </CardContent>
                                        </Card>
                                    ))}
                            </div>
                        </ScrollArea>
                    </div>
                </DialogContent>
            </Dialog>
        </div >
    );
}
