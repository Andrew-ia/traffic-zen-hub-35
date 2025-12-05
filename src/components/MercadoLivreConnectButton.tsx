import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Loader2 } from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useToast } from "@/hooks/use-toast";

interface MercadoLivreConnectButtonProps {
    size?: "default" | "sm" | "lg" | "icon";
    variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
}

export default function MercadoLivreConnectButton({
    size = "default",
    variant = "default"
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

            // Usar URL de produção porque Mercado Livre exige HTTPS
            const productionUrl = "https://traffic-zen-hub-35.vercel.app";
            const authUrl = `https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=5043496307995752&redirect_uri=${encodeURIComponent(`${productionUrl}/integrations/mercadolivre/callback`)}&state=${currentWorkspace.id}`;

            // Redirecionar diretamente para a página de autorização do Mercado Livre
            window.location.href = authUrl;
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
