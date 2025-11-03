import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useIntegrationOverview } from "@/hooks/useIntegrationOverview";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import MetaSyncButton from "@/components/MetaSyncButton";
import GoogleAdsSyncButton from "@/components/GoogleAdsSyncButton";
import {
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
  TrendingUp,
  Mail,
  Zap,
  BarChart3,
  Copy,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react";

export default function Integrations() {
  const { data: overview, isLoading } = useIntegrationOverview();

  const metaIntegration = useMemo(
    () => overview?.integrations.find((integration) => integration.platform_key === "meta") ?? null,
    [overview],
  );

  const metaAccounts = useMemo(
    () => overview?.platformAccounts.filter((account) => account.platform_key === "meta") ?? [],
    [overview],
  );

  const metaStatusText = useMemo(() => {
    if (!metaIntegration) return "Não conectado";
    if (metaIntegration.last_synced_at) {
      return `Sincronizado ${formatDistanceToNow(new Date(metaIntegration.last_synced_at), {
        addSuffix: true,
        locale: ptBR,
      })}`;
    }
    return "Sincronização pendente";
  }, [metaIntegration]);

  const adsPlatforms = useMemo(() => {
    const metaCard = {
      id: 1,
      name: "Meta Ads",
      description: "Facebook & Instagram",
      icon: Facebook,
      connected: metaIntegration?.status === "active",
      accounts: metaAccounts.length,
      status: metaStatusText,
    };

    return [metaCard];
  }, [metaIntegration, metaAccounts.length, metaStatusText]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Integrações</h1>
        <p className="text-muted-foreground mt-1">
          Conecte suas plataformas de anúncios, analytics e CRM
        </p>
      </div>

      <ClientConfigurationCard />

      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Plataformas Conectadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview?.connectedCount ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Integradas ao workspace</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Contas Sincronizadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview?.activeAccountCount ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Contas ativas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Analytics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview?.analyticsCount ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Fontes de analytics conectadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Última Sincronização</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview?.lastSyncDescription ?? "Sem histórico"}</div>
            <p className="text-xs text-muted-foreground mt-1">Atualização mais recente</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-4">Plataformas de Anúncios</h2>
        <div className="grid gap-4">
        {adsPlatforms.map((platform) => (
          <Card key={platform.id}>
            <CardContent className="flex items-center justify-between p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <platform.icon className="h-6 w-6 text-primary" />
                </div>
                    <div>
                      <p className="font-semibold">{platform.name}</p>
                      <p className="text-sm text-muted-foreground">{platform.description}</p>
                      <div className="flex gap-2 mt-2">
                        {isLoading ? (
                          <Skeleton className="h-5 w-32" />
                        ) : platform.connected ? (
                          <>
                            {platform.accounts ? <Badge variant="outline">{platform.accounts} contas</Badge> : null}
                            <Badge variant="secondary">{platform.status}</Badge>
                          </>
                        ) : (
                          <Badge variant="secondary">{platform.status}</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                <div className="flex items-center gap-4">
                  {platform.id === 1 ? (
                    <>
                      {platform.connected && <MetaSyncButton />}
                      <MetaCredentialsDialog />
                    </>
                  ) : platform.connected ? (
                    <>
                      <Switch checked={true} disabled />
                      <Button variant="outline" disabled>
                        Em breve
                      </Button>
                    </>
                  ) : (
                    <Button disabled>Em breve</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-4">Outras Integrações</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {overview?.integrations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma integração cadastrada.</p>
          ) : (
            overview?.integrations
              .filter((integration) => integration.platform_key !== "meta")
              .map((integration) => {
                const accountCount = overview.platformAccounts.filter(
                  (account) => account.platform_key === integration.platform_key,
                ).length;

                const Icon =
                  integration.platform_key === "google_ads"
                    ? TrendingUp
                    : integration.platform_key === "linkedin"
                      ? Linkedin
                      : integration.platform_key === "tiktok"
                        ? Instagram
                        : BarChart3;

                return (
                  <Card key={integration.id}>
                    <CardContent className="p-6 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-semibold">
                              {integration.platform_display_name ?? integration.platform_key}
                            </p>
                            <p className="text-xs uppercase text-muted-foreground">
                              {integration.platform_category ?? "ADS"}
                            </p>
                          </div>
                        </div>
                        <Badge variant={integration.status === "active" ? "default" : "secondary"}>
                          {integration.status === "active" ? "Conectado" : "Inativo"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{accountCount} conta(s) vinculada(s)</span>
                        <span className="text-muted-foreground">
                          {integration.last_synced_at
                            ? `Sincronizado ${formatDistanceToNow(new Date(integration.last_synced_at), {
                                addSuffix: true,
                                locale: ptBR,
                              })}`
                            : "Sincronização pendente"}
                        </span>
                      </div>
                      {integration.platform_key === "google_ads" && integration.status === "active" && (
                        <div className="pt-2">
                          <GoogleAdsSyncButton variant="outline" size="sm" className="w-full" />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
          )}
        </div>
      </div>
    </div>
  );
}

const META_CREDENTIALS_KEY = "trafficpro.meta.credentials";

interface MetaCredentials {
  appId: string;
  appSecret: string;
  accessToken: string;
  adAccountId: string;
  workspaceId: string;
}

const defaultCredentials = (): MetaCredentials => ({
  appId: import.meta.env.VITE_META_APP_ID ?? "",
  appSecret: import.meta.env.VITE_META_APP_SECRET ?? "",
  accessToken: import.meta.env.VITE_META_ACCESS_TOKEN ?? "",
  adAccountId: import.meta.env.VITE_META_AD_ACCOUNT_ID ?? "",
  workspaceId: import.meta.env.VITE_WORKSPACE_ID ?? "",
});

function ClientConfigurationCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Configurações do Cliente</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl text-sm text-muted-foreground">
          Centralize aqui as credenciais exigidas pelas APIs de anúncios. As informações ficam armazenadas apenas no seu navegador e são usadas como referência para preencher o `.env.local` e rodar o `npm run sync:meta`.
        </div>
        <MetaCredentialsDialog />
      </CardContent>
    </Card>
  );
}

function MetaCredentialsDialog() {
  const [open, setOpen] = useState(false);
  const [credentials, setCredentials] = useState<MetaCredentials>(defaultCredentials);
  const [saved, setSaved] = useState(false);
  const [showAppSecret, setShowAppSecret] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(META_CREDENTIALS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as MetaCredentials;
        const defaults = defaultCredentials();
        const merged: MetaCredentials = {
          appId: parsed.appId || defaults.appId,
          appSecret: parsed.appSecret || defaults.appSecret,
          accessToken: parsed.accessToken || defaults.accessToken,
          adAccountId: parsed.adAccountId || defaults.adAccountId,
          workspaceId: parsed.workspaceId || defaults.workspaceId,
        };
        setCredentials(merged);
      } else {
        setCredentials(defaultCredentials());
      }
    } catch (error) {
      console.warn("Failed to load stored Meta credentials", error);
    }
  }, [open]);

  const envSnippet = useMemo(
    () =>
      `META_APP_ID=${credentials.appId}\nMETA_APP_SECRET=${credentials.appSecret}\nMETA_ACCESS_TOKEN=${credentials.accessToken}\nMETA_AD_ACCOUNT_ID=${credentials.adAccountId}\nMETA_WORKSPACE_ID=${credentials.workspaceId}\n\nVITE_META_APP_ID=${credentials.appId}\nVITE_META_APP_SECRET=${credentials.appSecret}\nVITE_META_ACCESS_TOKEN=${credentials.accessToken}\nVITE_META_AD_ACCOUNT_ID=${credentials.adAccountId}\nVITE_WORKSPACE_ID=${credentials.workspaceId}`,
    [credentials],
  );

  const handleChange = (field: keyof MetaCredentials) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setSaved(false);
    setCredentials((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(envSnippet);
    setSaved(true);
  };

  const handleSave = () => {
    localStorage.setItem(META_CREDENTIALS_KEY, JSON.stringify(credentials));
    setSaved(true);
    setOpen(false);
  };

  const handleReset = () => {
    localStorage.removeItem(META_CREDENTIALS_KEY);
    setCredentials(defaultCredentials());
    setSaved(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Configurar credenciais</Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Credenciais da Meta</DialogTitle>
          <DialogDescription>
            Preencha os dados do aplicativo Meta Business (ou atualize os valores existentes). Eles são salvos localmente e
            servem como referência para o `.env.local`.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="meta-app-id">App ID</Label>
            <Input id="meta-app-id" value={credentials.appId} onChange={handleChange("appId")} placeholder="1486406..." />
          </div>
          <div>
            <Label htmlFor="meta-app-secret">App Secret</Label>
            <div className="relative">
              <Input
                id="meta-app-secret"
                value={credentials.appSecret}
                onChange={handleChange("appSecret")}
                type={showAppSecret ? "text" : "password"}
                placeholder="••••••"
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute inset-y-0 right-0 my-1 mr-1 h-8 w-8"
                onClick={() => setShowAppSecret((prev) => !prev)}
              >
                {showAppSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Chave secreta do app criado no Meta for Developers. Clique no ícone para revelar/ocultar.
            </p>
          </div>
          <div>
            <Label htmlFor="meta-access-token">Access Token</Label>
            <Textarea
              id="meta-access-token"
              value={credentials.accessToken}
              onChange={handleChange("accessToken")}
              rows={3}
              placeholder="Access token de longa duração"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="meta-ad-account">Ad Account ID</Label>
              <Input id="meta-ad-account" value={credentials.adAccountId} onChange={handleChange("adAccountId")} placeholder="1234567890" />
            </div>
            <div>
              <Label htmlFor="meta-workspace">Workspace ID</Label>
              <Input id="meta-workspace" value={credentials.workspaceId} onChange={handleChange("workspaceId")} />
              <p className="mt-1 text-xs text-muted-foreground">
                ID do workspace no Supabase. Mantemos o valor padrão `0000...` do ambiente seed, altere caso use outra instância.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Snippet para .env.local</Label>
            <Textarea readOnly value={envSnippet} rows={6} />
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleCopy}>
                <Copy className="mr-2 h-4 w-4" /> Copiar snippet
              </Button>
              {saved && <span className="text-xs text-muted-foreground">Snippet copiado/salvo recentemente</span>}
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <Button variant="ghost" onClick={handleReset} className="justify-start">
            Limpar credenciais
          </Button>
          <Button onClick={handleSave}>Salvar no navegador</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
