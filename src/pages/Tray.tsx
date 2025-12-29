import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Loader2 } from "lucide-react";

export default function Tray() {
    const { workspaceId } = useWorkspace();
    const [storeUrl, setStoreUrl] = useState("");
    const [loading, setLoading] = useState(false);

    const handleConnect = async () => {
        if (!storeUrl) return;
        setLoading(true);
        try {
            const response = await fetch(`/api/integrations/tray/auth/url?workspaceId=${workspaceId}&storeUrl=${encodeURIComponent(storeUrl)}`);
            const data = await response.json();
            if (data.authUrl) {
                window.location.href = data.authUrl;
            } else {
                alert("Erro ao gerar URL de autenticação: " + (data.error || "Desconhecido"));
            }
        } catch (error) {
            console.error(error);
            alert("Erro ao conectar com o servidor");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container py-8 space-y-8">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Tray Commerce</h1>
            </div>
            
            <Card className="max-w-xl">
                <CardHeader>
                    <CardTitle>Conectar Loja</CardTitle>
                    <CardDescription>
                        Para integrar sua loja Tray, insira a URL da sua loja abaixo (ex: www.sualoja.com.br) e clique em conectar.
                        Você será redirecionado para autorizar o aplicativo Traffic Pro.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid w-full items-center gap-1.5">
                        <Label htmlFor="storeUrl">URL da Loja</Label>
                        <Input 
                            type="text" 
                            id="storeUrl" 
                            placeholder="www.sualoja.com.br" 
                            value={storeUrl}
                            onChange={(e) => setStoreUrl(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">Insira apenas o domínio, sem https:// ou barras no final.</p>
                    </div>
                    <Button onClick={handleConnect} disabled={loading || !storeUrl} className="w-full">
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Conectar com Tray
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
