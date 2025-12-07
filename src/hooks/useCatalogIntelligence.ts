import { useState, useEffect } from 'react';
import { useWorkspace } from './useWorkspace';

export interface ProductCatalogData {
    mlb_id: string;
    title: string;
    permalink?: string;
    thumbnail: string;
    current_price: number;
    winner_price: number;
    price_to_win: number;
    catalog_position: number;
    is_catalog_winner: boolean;
    sales_120_days: number;
    visits_120_days: number;
    total_sold_historical: number;
    conversion_rate: number;
    status: 'winning' | 'losing' | 'competitive';
    boosters: {
        is_full: boolean;
        free_shipping: boolean;
        has_pickup: boolean;
        installments_no_interest: boolean;
        account_medal: string;
        account_quality_score: number;
    };
    can_win_with_boosters: boolean;
    suggested_price: number;
    profit_margin: number;
    category_name: string;
    winner_snapshot?: {
        id: string;
        title: string;
        price: number;
        sold_quantity: number;
        permalink?: string;
        thumbnail?: string;
        free_shipping?: boolean;
        listing_type?: string;
        seller_medal?: string | null;
        score?: number;
    } | null;
    competitive_gap?: {
        price_diff: number;
        price_diff_pct: number;
        shipping_gap: boolean;
        medal_gap: string | null;
        notes: string[];
    } | null;
}

export interface CatalogIntelligenceResult {
    products: ProductCatalogData[];
    category_analysis: {
        total_products: number;
        winners_count: number;
        opportunities_count: number;
        avg_conversion_rate: number;
        avg_sales_120d: number;
    };
    market_insights: {
        price_range: { min: number; max: number };
        avg_price: number;
        top_boosters: string[];
        competitive_threshold: number;
    };
}

export interface CatalogIntelligenceError {
    error: string;
    details: string;
    suggestions?: string[];
}

export function useCatalogIntelligence() {
    const { currentWorkspace } = useWorkspace();
    const [data, setData] = useState<CatalogIntelligenceResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<CatalogIntelligenceError | null>(null);
    const [lastAnalyzedAt, setLastAnalyzedAt] = useState<string | null>(null);

    const fetchCatalogIntelligence = async (forceRefresh = false) => {
        if (!currentWorkspace?.id) {
            setError({
                error: 'Workspace não selecionado',
                details: 'Selecione um workspace para visualizar a inteligência de catálogo'
            });
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const endpoint = forceRefresh 
                ? '/api/integrations/mercadolivre/catalog-intelligence/refresh'
                : '/api/integrations/mercadolivre/catalog-intelligence';

            const method = forceRefresh ? 'POST' : 'GET';
            const body = forceRefresh ? JSON.stringify({ workspaceId: currentWorkspace.id }) : undefined;

            const response = await fetch(endpoint + (forceRefresh ? '' : `?workspaceId=${currentWorkspace.id}`), {
                method,
                headers: {
                    'Content-Type': 'application/json',
                },
                ...(body && { body })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(JSON.stringify(errorData));
            }

            const result = await response.json();
            
            if (result.success) {
                setData(result.data);
                setLastAnalyzedAt(result.analyzed_at || result.refreshed_at);
            } else {
                throw new Error(result.error || 'Falha ao analisar catálogo');
            }

        } catch (error: any) {
            let errorData: CatalogIntelligenceError;

            try {
                const parsedError = JSON.parse(error.message);
                errorData = {
                    error: parsedError.error || 'Erro desconhecido',
                    details: parsedError.details || 'Falha na comunicação com o servidor',
                    suggestions: parsedError.suggestions || []
                };
            } catch {
                errorData = {
                    error: 'Erro de comunicação',
                    details: error.message || 'Falha ao conectar com o servidor',
                    suggestions: [
                        'Verifique sua conexão com a internet',
                        'Tente novamente em alguns minutos',
                        'Verifique se a integração do MercadoLivre está ativa'
                    ]
                };
            }

            setError(errorData);
            console.error('Erro ao buscar inteligência de catálogo:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const refreshData = () => {
        fetchCatalogIntelligence(true);
    };

    const clearError = () => {
        setError(null);
    };

    // Auto-load data when workspace changes
    useEffect(() => {
        if (currentWorkspace?.id) {
            fetchCatalogIntelligence();
        }
    }, [currentWorkspace?.id]);

    return {
        // Estado
        data,
        isLoading,
        error,
        lastAnalyzedAt,

        // Métodos
        fetchCatalogIntelligence,
        refreshData,
        clearError,

        // Computed properties
        hasData: !!data,
        isEmpty: data?.products.length === 0,
        totalProducts: data?.category_analysis.total_products || 0,
        winnersCount: data?.category_analysis.winners_count || 0,
        opportunitiesCount: data?.category_analysis.opportunities_count || 0,
    };
}
