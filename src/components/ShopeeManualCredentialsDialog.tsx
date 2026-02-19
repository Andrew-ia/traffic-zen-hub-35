import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, KeyRound } from "lucide-react";
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

interface ShopeeManualCredentialsDialogProps {
  children?: React.ReactNode;
  onSuccess?: () => void;
}

export function ShopeeManualCredentialsDialog({ children, onSuccess }: ShopeeManualCredentialsDialogProps) {
  const [open, setOpen] = useState(false);
  const [partnerId, setPartnerId] = useState("");
  const [partnerKey, setPartnerKey] = useState("");
  const [shopId, setShopId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [apiBase, setApiBase] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!currentWorkspace?.id) {
      toast({
        title: "Erro",
        description: "Selecione um workspace primeiro",
        variant: "destructive",
      });
      return;
    }

    if (!shopId || !accessToken) {
      toast({
        title: "Campos obrigatórios",
        description: "Shop ID e Access Token são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch("/api/integrations/shopee/manual-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: currentWorkspace.id,
          partnerId: partnerId || undefined,
          partnerKey: partnerKey || undefined,
          shopId,
          accessToken,
          refreshToken: refreshToken || undefined,
          apiBase: apiBase || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || data.message || "Falha ao salvar credenciais");
      }

      toast({
        title: "Sucesso",
        description: "Credenciais Shopee salvas com sucesso!",
      });

      queryClient.invalidateQueries({ queryKey: ["shopee", "auth-status", currentWorkspace.id] });

      if (onSuccess) {
        onSuccess();
      }

      setOpen(false);
      setPartnerId("");
      setPartnerKey("");
      setShopId("");
      setAccessToken("");
      setRefreshToken("");
      setApiBase("");
    } catch (error: any) {
      console.error("Erro ao salvar credenciais Shopee:", error);
      toast({
        title: "Erro",
        description: error?.message || "Falha ao salvar credenciais",
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
            Inserir Credenciais
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Conectar Shopee</DialogTitle>
          <DialogDescription>
            Informe as credenciais da API Shopee. Shop ID e Access Token são obrigatórios.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="partnerId">Partner ID (opcional)</Label>
            <Input
              id="partnerId"
              value={partnerId}
              onChange={(event) => setPartnerId(event.target.value)}
              placeholder="123456"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="partnerKey">Partner Key (opcional)</Label>
            <Input
              id="partnerKey"
              value={partnerKey}
              onChange={(event) => setPartnerKey(event.target.value)}
              placeholder="sua-chave"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="shopId">Shop ID</Label>
            <Input
              id="shopId"
              value={shopId}
              onChange={(event) => setShopId(event.target.value)}
              placeholder="000000"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="accessToken">Access Token</Label>
            <Input
              id="accessToken"
              value={accessToken}
              onChange={(event) => setAccessToken(event.target.value)}
              placeholder="token..."
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="refreshToken">Refresh Token (opcional)</Label>
            <Input
              id="refreshToken"
              value={refreshToken}
              onChange={(event) => setRefreshToken(event.target.value)}
              placeholder="refresh..."
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="apiBase">API Base URL (opcional)</Label>
            <Input
              id="apiBase"
              value={apiBase}
              onChange={(event) => setApiBase(event.target.value)}
              placeholder="https://api.shopee.com.br"
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
