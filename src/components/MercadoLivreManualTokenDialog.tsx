import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Loader2, KeyRound } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface MercadoLivreManualTokenDialogProps {
    children?: React.ReactNode;
    onSuccess?: () => void;
}

export function MercadoLivreManualTokenDialog({ children, onSuccess }: MercadoLivreManualTokenDialogProps) {
    const [open, setOpen] = useState(false);
    const [accessToken, setAccessToken] = useState("");
    const [refreshToken, setRefreshToken] = useState("");
    const [userId, setUserId] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    
    const { currentWorkspace } = useWorkspace();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!currentWorkspace?.id) {
            toast({
                title: "Erro",
                description: "Selecione um workspace primeiro",
                variant: "destructive",
            });
            return;
        }

        if (!accessToken || !refreshToken || !userId) {
            toast({
                title: "Campos obrigatórios",
                description: "Por favor, preencha todos os campos",
                variant: "destructive",
            });
            return;
        }

        try {
            setIsLoading(true);

            const response = await fetch("/api/integrations/mercadolivre/manual-credentials", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    workspaceId: currentWorkspace.id,
                    accessToken,
                    refreshToken,
                    userId,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Falha ao salvar credenciais");
            }

            toast({
                title: "Sucesso",
                description: "Credenciais salvas com sucesso!",
            });

            // Invalidate auth status query to refresh the UI
            queryClient.invalidateQueries({
                queryKey: ["mercadolivre", "auth-status", currentWorkspace.id],
            });

            if (onSuccess) {
                onSuccess();
            }

            setOpen(false);
            setAccessToken("");
            setRefreshToken("");
            setUserId("");

        } catch (error: any) {
            console.error("Erro ao salvar tokens:", error);
            toast({
                title: "Erro",
                description: error.message || "Falha ao salvar tokens",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children || (
                    <Button variant="outline" size="sm">
                        <KeyRound className="mr-2 h-4 w-4" />
                        Inserir Tokens Manualmente
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Inserir Tokens Manualmente</DialogTitle>
                    <DialogDescription>
                        Cole os tokens obtidos no ambiente de produção. Isso permitirá que o localhost se conecte à sua conta.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="accessToken">Access Token</Label>
                        <Input
                            id="accessToken"
                            value={accessToken}
                            onChange={(e) => setAccessToken(e.target.value)}
                            placeholder="APP_USR-..."
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="refreshToken">Refresh Token</Label>
                        <Input
                            id="refreshToken"
                            value={refreshToken}
                            onChange={(e) => setRefreshToken(e.target.value)}
                            placeholder="TG-..."
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="userId">User ID</Label>
                        <Input
                            id="userId"
                            value={userId}
                            onChange={(e) => setUserId(e.target.value)}
                            placeholder="123456789"
                        />
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Salvar Credenciais
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
