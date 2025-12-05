import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
    RefreshCw, 
    AlertTriangle, 
    CheckCircle2, 
    Clock, 
    XCircle,
    ArrowLeftRight,
    Download,
    Upload
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
    Alert,
    AlertDescription,
    AlertTitle,
} from "@/components/ui/alert";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface ConflictProduct {
    id: string;
    title: string;
    sku?: string;
    ml_item_id?: string;
    sync_status: string;
    source_of_truth: string;
    updated_at: string;
    last_synced_at?: string;
    conflict_reason?: string;
    conflict_detected_at?: string;
}

interface PendingProduct {
    id: string;
    title: string;
    sku?: string;
    ml_item_id?: string;
    sync_action: 'needs_export' | 'needs_update' | 'needs_check';
    updated_at: string;
}

interface SyncStatus {
    statusBreakdown: Array<{
        sync_status: string;
        source_of_truth: string;
        count: string;
    }>;
    recentLogs: Array<{
        id: string;
        sync_type: string;
        status: string;
        title?: string;
        created_at: string;
        error_message?: string;
    }>;
    settings: any;
}

export default function ProductSync() {
    const { currentWorkspace } = useWorkspace();
    const workspaceId = currentWorkspace?.id || null;
    const { toast } = useToast();

    const [conflicts, setConflicts] = useState<ConflictProduct[]>([]);
    const [pending, setPending] = useState<PendingProduct[]>([]);
    const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedConflict, setSelectedConflict] = useState<ConflictProduct | null>(null);
    const [isResolvingConflict, setIsResolvingConflict] = useState(false);

    const fetchSyncData = useCallback(async () => {
        if (!workspaceId) return;
        
        setIsLoading(true);
        try {
            const [conflictsRes, pendingRes, statusRes] = await Promise.all([
                fetch(`/api/sync/conflicts/${workspaceId}`),
                fetch(`/api/sync/pending/${workspaceId}`),
                fetch(`/api/sync/status/${workspaceId}`)
            ]);

            if (conflictsRes.ok) {
                const conflictsData = await conflictsRes.json();
                setConflicts(conflictsData.conflicts || []);
            }

            if (pendingRes.ok) {
                const pendingData = await pendingRes.json();
                setPending(pendingData.pending || []);
            }

            if (statusRes.ok) {
                const statusData = await statusRes.json();
                setSyncStatus(statusData);
            }

        } catch (error) {
            toast({
                title: "Erro",
                description: "Falha ao carregar dados de sincronização",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    }, [workspaceId, toast]);

    const resolveConflict = async (productId: string, resolution: string) => {
        if (!workspaceId) return;

        setIsResolvingConflict(true);
        try {
            const response = await fetch(`/api/sync/resolve-conflict/${productId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resolution, workspaceId })
            });

            if (response.ok) {
                toast({
                    title: "Conflito resolvido!",
                    description: "O produto foi marcado para sincronização",
                });
                
                setSelectedConflict(null);
                await fetchSyncData(); // Recarregar dados
            } else {
                const error = await response.json();
                throw new Error(error.error);
            }
        } catch (error: any) {
            toast({
                title: "Erro",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setIsResolvingConflict(false);
        }
    };

    useEffect(() => {
        fetchSyncData();
    }, [fetchSyncData]);

    if (!workspaceId) {
        return (
            <div className="space-y-4">
                <h1 className="text-4xl font-bold">Sincronização</h1>
                <p className="text-muted-foreground">Selecione um workspace</p>
            </div>
        );
    }

    const getStatusBadge = (status: string) => {
        const variants: Record<string, any> = {
            synced: { variant: "default", icon: CheckCircle2, label: "Sincronizado" },
            pending: { variant: "secondary", icon: Clock, label: "Pendente" },
            conflict: { variant: "destructive", icon: AlertTriangle, label: "Conflito" },
            error: { variant: "destructive", icon: XCircle, label: "Erro" },
        };

        const config = variants[status] || variants.pending;
        const Icon = config.icon;

        return (
            <Badge variant={config.variant} className="gap-1">
                <Icon className="h-3 w-3" />
                {config.label}
            </Badge>
        );
    };

    const getSyncActionIcon = (action: string) => {
        switch (action) {
            case 'needs_export': return <Upload className="h-4 w-4 text-blue-500" />;
            case 'needs_update': return <ArrowLeftRight className="h-4 w-4 text-yellow-500" />;
            case 'needs_check': return <RefreshCw className="h-4 w-4 text-gray-500" />;
            default: return <Clock className="h-4 w-4" />;
        }
    };

    return (
        <div className="space-y-6 pb-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-4xl font-bold flex items-center gap-3">
                        <RefreshCw className="h-10 w-10 text-primary" />
                        Sincronização
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Gerencie a sincronização entre Traffic Pro e Mercado Livre
                    </p>
                </div>
                <Button onClick={fetchSyncData} disabled={isLoading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                    Atualizar
                </Button>
            </div>

            {/* Status Overview */}
            {syncStatus && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {syncStatus.statusBreakdown.map((item, index) => (
                        <Card key={index}>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2">
                                    {getStatusBadge(item.sync_status)}
                                    <span className="font-bold text-2xl">{item.count}</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {item.source_of_truth === 'traffic_pro' ? 'Traffic Pro' : 
                                     item.source_of_truth === 'mercado_livre' ? 'Mercado Livre' : 'Ambos'}
                                </p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <Tabs defaultValue="conflicts" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="conflicts" className="gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Conflitos ({conflicts.length})
                    </TabsTrigger>
                    <TabsTrigger value="pending" className="gap-2">
                        <Clock className="h-4 w-4" />
                        Pendentes ({pending.length})
                    </TabsTrigger>
                    <TabsTrigger value="logs" className="gap-2">
                        <RefreshCw className="h-4 w-4" />
                        Logs
                    </TabsTrigger>
                </TabsList>

                {/* Conflitos */}
                <TabsContent value="conflicts" className="space-y-4">
                    {conflicts.length === 0 ? (
                        <Card>
                            <CardContent className="p-8 text-center">
                                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
                                <h3 className="font-semibold mb-2">Nenhum conflito encontrado</h3>
                                <p className="text-muted-foreground">
                                    Todos os produtos estão sincronizados corretamente
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-3">
                            {conflicts.map((conflict) => (
                                <Card key={conflict.id} className="border-l-4 border-l-destructive">
                                    <CardContent className="p-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                                <h3 className="font-semibold">{conflict.title}</h3>
                                                <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                                                    {conflict.sku && <span>SKU: {conflict.sku}</span>}
                                                    {conflict.ml_item_id && <span>ML: {conflict.ml_item_id}</span>}
                                                </div>
                                                <p className="text-sm text-muted-foreground mt-2">
                                                    {conflict.conflict_reason || 'Produto alterado em ambas as plataformas'}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {getStatusBadge(conflict.sync_status)}
                                                <Button 
                                                    variant="outline" 
                                                    size="sm"
                                                    onClick={() => setSelectedConflict(conflict)}
                                                >
                                                    Resolver
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                {/* Pendentes */}
                <TabsContent value="pending" className="space-y-4">
                    {pending.length === 0 ? (
                        <Card>
                            <CardContent className="p-8 text-center">
                                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
                                <h3 className="font-semibold mb-2">Nenhum produto pendente</h3>
                                <p className="text-muted-foreground">
                                    Todos os produtos estão sincronizados
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-3">
                            {pending.map((product) => (
                                <Card key={product.id}>
                                    <CardContent className="p-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                                <h3 className="font-semibold">{product.title}</h3>
                                                <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                                                    {product.sku && <span>SKU: {product.sku}</span>}
                                                    <span>Atualizado: {new Date(product.updated_at).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {getSyncActionIcon(product.sync_action)}
                                                <span className="text-sm">
                                                    {product.sync_action === 'needs_export' && 'Exportar para ML'}
                                                    {product.sync_action === 'needs_update' && 'Atualizar no ML'}
                                                    {product.sync_action === 'needs_check' && 'Verificar status'}
                                                </span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                {/* Logs */}
                <TabsContent value="logs" className="space-y-4">
                    {syncStatus?.recentLogs.length === 0 ? (
                        <Card>
                            <CardContent className="p-8 text-center">
                                <RefreshCw className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                                <h3 className="font-semibold mb-2">Nenhum log encontrado</h3>
                                <p className="text-muted-foreground">
                                    Ainda não há atividade de sincronização
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card>
                            <CardHeader>
                                <CardTitle>Atividade Recente</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {syncStatus?.recentLogs.map((log) => (
                                        <div key={log.id} className="flex items-center gap-3 p-3 border rounded-lg">
                                            {getStatusBadge(log.status)}
                                            <div className="flex-1">
                                                <p className="font-medium">{log.title || 'Produto sem título'}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {log.sync_type} - {new Date(log.created_at).toLocaleString()}
                                                </p>
                                                {log.error_message && (
                                                    <p className="text-sm text-red-600 mt-1">{log.error_message}</p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>
            </Tabs>

            {/* Dialog de Resolução de Conflito */}
            <Dialog open={!!selectedConflict} onOpenChange={() => setSelectedConflict(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Resolver Conflito de Sincronização</DialogTitle>
                        <DialogDescription>
                            O produto foi modificado tanto no Traffic Pro quanto no Mercado Livre. 
                            Escolha qual versão deve prevalecer.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedConflict && (
                        <div className="space-y-4">
                            <Alert>
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>Produto em conflito: {selectedConflict.title}</AlertTitle>
                                <AlertDescription>
                                    {selectedConflict.conflict_reason || 'Ambas as versões foram modificadas desde a última sincronização'}
                                </AlertDescription>
                            </Alert>

                            <div className="grid grid-cols-2 gap-4">
                                <Card className="border-blue-200">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-sm text-blue-700">Traffic Pro (Local)</CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0">
                                        <p className="text-sm">Última modificação: {new Date(selectedConflict.updated_at).toLocaleString()}</p>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            Esta é a versão atual no Traffic Pro
                                        </p>
                                    </CardContent>
                                </Card>

                                <Card className="border-green-200">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-sm text-green-700">Mercado Livre (Remoto)</CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0">
                                        <p className="text-sm">Última sincronização: {selectedConflict.last_synced_at ? new Date(selectedConflict.last_synced_at).toLocaleString() : 'Nunca'}</p>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            Versão atual no Mercado Livre
                                        </p>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="gap-2">
                        <Button 
                            variant="outline" 
                            onClick={() => setSelectedConflict(null)}
                            disabled={isResolvingConflict}
                        >
                            Cancelar
                        </Button>
                        <Button 
                            variant="secondary" 
                            onClick={() => selectedConflict && resolveConflict(selectedConflict.id, 'use_mercado_livre')}
                            disabled={isResolvingConflict}
                        >
                            <Download className="h-4 w-4 mr-2" />
                            Usar Mercado Livre
                        </Button>
                        <Button 
                            onClick={() => selectedConflict && resolveConflict(selectedConflict.id, 'use_traffic_pro')}
                            disabled={isResolvingConflict}
                        >
                            <Upload className="h-4 w-4 mr-2" />
                            Usar Traffic Pro
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
