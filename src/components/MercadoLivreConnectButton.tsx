import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Loader2 } from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useToast } from "@/hooks/use-toast";

interface MercadoLivreConnectButtonProps {
    size?: "default" | "sm" | "lg" | "icon";
    variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
    className?: string;
}

export default function MercadoLivreConnectButton({
    size = "default",
    variant = "default",
    className
}: MercadoLivreConnectButtonProps) {
    const { currentWorkspace } = useWorkspace();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    const handleConnect = async () => {
        if (!currentWorkspace?.id) {
            toast({
                title: "Erro",
                description: "Selecione um workspace para conectar o Mercado Livre",
                variant: "destructive",
            });
            return;
        }

        try {
            setIsLoading(true);

            const response = await fetch(`/api/integrations/mercadolivre/auth/url?workspaceId=${currentWorkspace.id}`);
            const data = await response.json();

            if (!response.ok || !data?.authUrl) {
                throw new Error(data?.error || "Não foi possível gerar a URL de autorização do Mercado Livre");
            }

            // Redirecionar diretamente para a página de autorização do Mercado Livre
            window.location.href = data.authUrl;
        } catch (error: any) {
            console.error("Error connecting to Mercado Livre:", error);
            toast({
                title: "Erro ao conectar",
                description: error.message || "Não foi possível conectar ao Mercado Livre",
                variant: "destructive",
            });
            setIsLoading(false);
        }
    };

    return (
        <Button
            onClick={handleConnect}
            disabled={isLoading || !currentWorkspace?.id}
            size={size}
            variant={variant}
            className={className}
        >
            {isLoading ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Conectando...
                </>
            ) : (
                <>
                    <ShoppingBag className="mr-2 h-4 w-4" />
                    Conectar Mercado Livre
                </>
            )}
        </Button>
    );
}
