import { useState } from 'react';
import { useWorkspace } from './useWorkspace';

export interface OptimizationPayload {
    title?: string;
    model?: string;
    description?: string;
    attributes?: Record<string, string | null>;
}

export interface ApplyOptimizationsResult {
    success: boolean;
    message: string;
    changes_applied: string[];
    effective_changes?: string[];
    mlb_id: string;
    updated_fields: string[];
    applied_at: string;
    after_snapshot?: {
        title: string;
        model?: string;
        attributes?: any[];
        description?: string;
    };
}

export interface ApplyOptimizationsError {
    error: string;
    details: string;
    mlb_id: string;
    suggestions?: string[];
}

export function useMLBOptimizations() {
    const { currentWorkspace } = useWorkspace();
    const [isApplying, setIsApplying] = useState(false);
    const [error, setError] = useState<ApplyOptimizationsError | null>(null);
    const [lastApplication, setLastApplication] = useState<ApplyOptimizationsResult | null>(null);

    const applyOptimizations = async (
        mlbId: string,
        optimizations: OptimizationPayload
    ): Promise<ApplyOptimizationsResult | null> => {
        if (!currentWorkspace?.id) {
            setError({
                error: 'Workspace não encontrado',
                details: 'Conecte-se a um workspace antes de aplicar otimizações',
                mlb_id: mlbId,
            });
            return null;
        }

        setIsApplying(true);
        setError(null);

        try {
            const response = await fetch('/api/integrations/mercadolivre/apply-optimizations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    mlbId: mlbId,
                    workspaceId: currentWorkspace.id,
                    optimizations: optimizations
                })
            });

            if (!response.ok) {
                let errorData: ApplyOptimizationsError;
                try {
                    const json = await response.json();
                    errorData = {
                        error: json.error || 'Falha ao aplicar otimizações',
                        details: json.details || 'Erro desconhecido',
                        mlb_id: mlbId,
                        suggestions: json.suggestions || [],
                    };
                } catch {
                    errorData = {
                        error: 'Falha ao aplicar otimizações',
                        details: `HTTP ${response.status}`,
                        mlb_id: mlbId,
                    };
                }
                setError(errorData);
                return null;
            }

            const result: ApplyOptimizationsResult = await response.json();
            setLastApplication(result);
            return result;

        } catch (err) {
            const errorData: ApplyOptimizationsError = {
                error: err instanceof Error ? err.message : 'Erro desconhecido',
                details: 'Erro de comunicação com o servidor',
                mlb_id: mlbId,
            };
            setError(errorData);
            console.error('Erro ao aplicar otimizações:', err);
            return null;
        } finally {
            setIsApplying(false);
        }
    };

    const clearError = () => {
        setError(null);
    };

    const clearLastApplication = () => {
        setLastApplication(null);
    };

    return {
        // Estado
        isApplying,
        error,
        lastApplication,

        // Métodos
        applyOptimizations,
        clearError,
        clearLastApplication,

        // Dados derivados
        hasLastApplication: !!lastApplication,
        isSuccess: !!lastApplication?.success,
    };
}
