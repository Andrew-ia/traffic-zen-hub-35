import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useShopeeAuthStatus } from "@/hooks/useShopee";
import { ShopeeManualCredentialsDialog } from "@/components/ShopeeManualCredentialsDialog";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Clock,
  Loader2,
  Package,
  ShoppingCart,
  Sparkles,
  Truck,
  Zap,
} from "lucide-react";

const modules = [
  {
    title: "Catálogo e preços",
    description: "Sincronize SKUs, variações, preços e promoções com o Hub.",
    icon: Package,
  },
  {
    title: "Pedidos e logística",
    description: "Acompanhe pedidos, status, SLA e rastreios em um só lugar.",
    icon: Truck,
  },
  {
    title: "Performance e Ads",
    description: "Dashboards por canal, ROAS e alertas de queda.",
    icon: BarChart3,
  },
];

const readinessChecklist = [
  "Conta Shopee ativa e com acesso administrativo.",
  "Catálogo organizado no Product Hub para facilitar o mapeamento.",
  "Políticas de preço e estoque alinhadas com a operação.",
];

const deliveryHighlights = [
  "Conexão segura com múltiplas lojas.",
  "Mapeamento inteligente de categorias e atributos.",
  "Alertas de ruptura e mudanças de preço.",
];

const formatTimestamp = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
};

export default function ShopeeAgora() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId =
    currentWorkspace?.id || (import.meta.env.VITE_WORKSPACE_ID as string | undefined)?.trim() || null;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: authStatus, isLoading: authStatusLoading } = useShopeeAuthStatus(workspaceId);
  const isConnected = Boolean(authStatus?.connected);

  const handleDisconnect = async () => {
    if (!workspaceId) {
      toast({
        title: "Workspace não selecionado",
        description: "Selecione um workspace antes de desconectar.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(`/api/integrations/shopee/auth?workspaceId=${workspaceId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || data.message || "Falha ao desconectar");
      }

      toast({
        title: "Desconectado",
        description: "Credenciais Shopee removidas com sucesso.",
      });

      queryClient.invalidateQueries({ queryKey: ["shopee", "auth-status", workspaceId] });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error?.message || "Não foi possível desconectar.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-8 pb-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShoppingCart className="h-4 w-4" />
            Marketplace
          </div>
          <h1 className="text-4xl font-bold tracking-tight">Shopee Agora</h1>
          <p className="max-w-2xl text-muted-foreground">
            Página dedicada para consolidar integração, operação e performance da Shopee em um só lugar.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {authStatusLoading ? (
            <Badge variant="secondary" className="gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Verificando conexão
            </Badge>
          ) : isConnected ? (
            <Badge variant="secondary" className="gap-2 text-green-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Shopee conectada
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-2 text-muted-foreground">
              <AlertCircle className="h-3.5 w-3.5" />
              Shopee desconectada
            </Badge>
          )}
          <Badge variant="outline" className="gap-2">
            <Sparkles className="h-3.5 w-3.5" />
            Roadmap ativo
          </Badge>
          {isConnected ? (
            <Button variant="destructive" onClick={handleDisconnect}>
              Desconectar
            </Button>
          ) : (
            <ShopeeManualCredentialsDialog />
          )}
          <Button variant="outline" asChild>
            <Link to="/integrations">Ver integrações</Link>
          </Button>
        </div>
      </header>

      <Separator />

      <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Status da conexão
            </CardTitle>
            <CardDescription>Visão geral da integração ativa no workspace atual.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Status</span>
              {authStatusLoading ? (
                <Badge variant="secondary">Carregando</Badge>
              ) : isConnected ? (
                <Badge variant="secondary" className="text-green-700">Conectado</Badge>
              ) : (
                <Badge variant="outline">Desconectado</Badge>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span>Shop ID</span>
              <span className="font-medium text-foreground">{authStatus?.shopId || "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Atualizado em</span>
              <span className="font-medium text-foreground">{formatTimestamp(authStatus?.updatedAt)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pronto para integrar</CardTitle>
            <CardDescription>Checklist rápido para ativar sincronizações.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {readinessChecklist.map((item) => (
              <div key={item} className="flex items-start gap-3">
                <div className="mt-1 h-2 w-2 rounded-full bg-primary/70" />
                <span>{item}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              O que o Shopee Agora vai entregar
            </CardTitle>
            <CardDescription>
              Foco em velocidade operacional, dados acionáveis e controle de catálogo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {deliveryHighlights.map((item) => (
              <div key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
                <div className="mt-1 h-2 w-2 rounded-full bg-primary/70" />
                <span>{item}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status da integração</CardTitle>
            <CardDescription>
              Roadmap focado em catálogo, pedidos e performance.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Catálogo</span>
              <Badge variant="secondary">Em construção</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Pedidos</span>
              <Badge variant="secondary">Em construção</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Performance</span>
              <Badge variant="outline">Planejado</Badge>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Módulos planejados</h2>
          <Badge variant="outline">Em breve</Badge>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {modules.map((module) => (
            <Card key={module.title} className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <module.icon className="h-4 w-4 text-primary" />
                  {module.title}
                </CardTitle>
                <CardDescription>{module.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Badge variant="secondary">Em breve</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Próximos passos</CardTitle>
            <CardDescription>Se quiser priorizar, fale com o time.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Compartilhe o escopo desejado e as metas da operação Shopee para alinharmos o roadmap.
            </p>
            <Button variant="secondary" asChild>
              <Link to="/integrations">Solicitar priorização</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Atualizações planejadas</CardTitle>
            <CardDescription>Após a conexão, liberaremos os módulos abaixo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Sincronização de catálogo</span>
              <Badge variant="secondary">Em breve</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Pedidos e logística</span>
              <Badge variant="secondary">Em breve</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Relatórios e alertas</span>
              <Badge variant="outline">Planejado</Badge>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
