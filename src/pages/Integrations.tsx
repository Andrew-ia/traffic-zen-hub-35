import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/hooks/useWorkspace";
import { ShoppingBag, Loader2, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import MercadoLivreConnectButton from "@/components/MercadoLivreConnectButton";
import { MercadoLivreManualTokenDialog } from "@/components/MercadoLivreManualTokenDialog";
import { Separator } from "@/components/ui/separator";

export default function Integrations() {
    const { currentWorkspace } = useWorkspace();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [checkingStatus, setCheckingStatus] = useState(true);

    const checkConnection = useCallback(async () => {
        if (!currentWorkspace?.id) return;
        setCheckingStatus(true);
        try {
            const response = await fetch(`/api/integrations/mercadolivre/auth/status?workspaceId=${currentWorkspace.id}`);
            if (response.ok) {
                const data = await response.json();
                setIsConnected(!!data.connected);
            } else {
                setIsConnected(false);
            }
        } catch (error) {
            setIsConnected(false);
        } finally {
            setCheckingStatus(false);
        }
    }, [currentWorkspace?.id]);

    // Check connection status
    useEffect(() => {
        if (currentWorkspace?.id) {
            void checkConnection();
        }
    }, [currentWorkspace?.id, checkConnection]);

    const handleDisconnect = async () => {
        if (!currentWorkspace?.id) return;
        
        try {
            setIsLoading(true);
            const response = await fetch(`/api/integrations/mercadolivre/auth?workspaceId=${currentWorkspace.id}`, {
                method: 'DELETE',
            });
            
            if (!response.ok) {
                throw new Error("Falha ao desconectar");
            }
            
            setIsConnected(false);
            toast({
                title: "Desconectado",
                description: "Conta do Mercado Livre desconectada com sucesso.",
            });
        } catch (error) {
            console.error("Error disconnecting:", error);
            toast({
                title: "Erro",
                description: "Não foi possível desconectar a conta.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full px-4 md:px-6 py-8 space-y-8">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Integrações</h1>
                <p className="text-muted-foreground">
                    Gerencie suas conexões com plataformas externas.
                </p>
            </div>

            <div className="grid gap-6">
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <CardTitle className="flex items-center gap-2">
                                    <ShoppingBag className="h-5 w-5 text-yellow-500" />
                                    Mercado Livre
                                </CardTitle>
                                <CardDescription>
                                    Conecte sua conta para sincronizar produtos, gerenciar campanhas e visualizar métricas.
                                </CardDescription>
                            </div>
                            {checkingStatus ? (
                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            ) : isConnected ? (
                                <div className="flex items-center gap-2 text-green-600 bg-green-50 dark:bg-green-900/20 px-3 py-1 rounded-full text-sm font-medium">
                                    <CheckCircle2 className="h-4 w-4" />
                                    Conectado
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-muted-foreground bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full text-sm font-medium">
                                    <AlertCircle className="h-4 w-4" />
                                    Desconectado
                                </div>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-muted-foreground">
                                {isConnected 
                                    ? "Sua conta está sincronizando dados automaticamente." 
                                    : "Clique no botão para iniciar a conexão com o Mercado Livre."}
                            </div>
                            
                            {isConnected ? (
                                <Button 
                                    variant="destructive" 
                                    onClick={handleDisconnect}
                                    disabled={isLoading}
                                >
                                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                    Desconectar
                                </Button>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <MercadoLivreManualTokenDialog 
                                        onSuccess={checkConnection} 
                                    />
                                    <MercadoLivreConnectButton />
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Placeholder for future integrations */}
                <Card className="opacity-60 cursor-not-allowed">
                    <CardHeader>
                        <CardTitle className="text-muted-foreground">Shopee (Em breve)</CardTitle>
                        <CardDescription>Integração em desenvolvimento.</CardDescription>
                    </CardHeader>
                </Card>
            </div>
        </div>
    );
}
