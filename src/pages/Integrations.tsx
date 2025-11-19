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
import MetaSyncButton from "@/components/MetaSyncButton";
import GoogleAdsSyncButton from "@/components/GoogleAdsSyncButton";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Integrations() {
  const { data: overview, isLoading } = useIntegrationOverview();
  const [metaDays, setMetaDays] = useState<number>(7);
  const [googleAdsDays, setGoogleAdsDays] = useState<number>(7);


  const metaIntegration = useMemo(
    () => overview?.integrations.find((integration) => integration.platform_key === "meta") ?? null,
    [overview],
  );

  const metaAccounts = useMemo(
    () => overview?.platformAccounts.filter((account) => account.platform_key === "meta") ?? [],
    [overview],
  );

  const googleAdsIntegration = useMemo(
    () => overview?.integrations.find((integration) => integration.platform_key === "google_ads") ?? null,
    [overview],
  );

  const googleAdsAccounts = useMemo(
    () => overview?.platformAccounts.filter((account) => account.platform_key === "google_ads") ?? [],
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

  const googleAdsStatusText = useMemo(() => {
    if (!googleAdsIntegration) return "Não conectado";
    if (googleAdsIntegration.last_synced_at) {
      return `Sincronizado ${formatDistanceToNow(new Date(googleAdsIntegration.last_synced_at), {
        addSuffix: true,
        locale: ptBR,
      })}`;
    }
    return "Sincronização pendente";
  }, [googleAdsIntegration]);



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

    const googleAdsCard = {
      id: 2,
      name: "Google Ads",
      description: "Google Search & Display",
      icon: TrendingUp,
      connected: googleAdsIntegration?.status === "active",
      accounts: googleAdsAccounts.length,
      status: googleAdsStatusText,
    };

    return [metaCard, googleAdsCard];
  }, [metaIntegration, metaAccounts.length, metaStatusText, googleAdsIntegration, googleAdsAccounts.length, googleAdsStatusText]);

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
                    <div className="flex items-center gap-2">
                      <div className="w-40">
                        <Select value={String(metaDays)} onValueChange={(v) => setMetaDays(Number(v))}>
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Últimos 7 dias" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="7">Últimos 7 dias</SelectItem>
                            <SelectItem value="14">Últimos 14 dias</SelectItem>
                            <SelectItem value="30">Últimos 30 dias</SelectItem>
                            <SelectItem value="60">Últimos 60 dias</SelectItem>
                            <SelectItem value="90">Últimos 90 dias</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <MetaSyncButton size="sm" days={metaDays} />
                      <MetaCredentialsDialog />
                    </div>
                  ) : platform.id === 2 ? (
                    <div className="flex items-center gap-2">
                      <div className="w-40">
                        <Select value={String(googleAdsDays)} onValueChange={(v) => setGoogleAdsDays(Number(v))}>
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Últimos 7 dias" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="7">Últimos 7 dias</SelectItem>
                            <SelectItem value="14">Últimos 14 dias</SelectItem>
                            <SelectItem value="30">Últimos 30 dias</SelectItem>
                            <SelectItem value="60">Últimos 60 dias</SelectItem>
                            <SelectItem value="90">Últimos 90 dias</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <GoogleAdsSyncButton size="sm" days={googleAdsDays} />
                      <GoogleAdsCredentialsDialog />
                    </div>
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
  const [serverStatus, setServerStatus] = useState<string>("");
  const WORKSPACE_ID = (import.meta.env.VITE_WORKSPACE_ID as string | undefined)?.trim() || "00000000-0000-0000-0000-000000000010";

  useEffect(() => {
    let base = defaultCredentials();
    try {
      const stored = localStorage.getItem(META_CREDENTIALS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as MetaCredentials;
        base = {
          appId: parsed.appId || base.appId,
          appSecret: parsed.appSecret || base.appSecret,
          accessToken: parsed.accessToken || base.accessToken,
          adAccountId: parsed.adAccountId || base.adAccountId,
          workspaceId: parsed.workspaceId || base.workspaceId,
        };
      }
      setCredentials(base);
    } catch (error) {
      console.warn("Failed to load stored Meta credentials", error);
      setCredentials(base);
    }
    (async () => {
      try {
        const resp = await fetch(`/api/integrations/credentials/${WORKSPACE_ID}/meta`, { credentials: "include" });
        if (resp.ok) {
          const json = await resp.json();
          const serverCred = json?.data?.credentials || {};
          const merged: MetaCredentials = {
            appId: serverCred.appId || base.appId,
            appSecret: serverCred.appSecret || base.appSecret,
            accessToken: serverCred.accessToken || base.accessToken,
            adAccountId: serverCred.adAccountId || base.adAccountId,
            workspaceId: base.workspaceId || WORKSPACE_ID,
          };
          setCredentials(merged);
          setServerStatus("Credenciais do servidor carregadas");
        } else if (resp.status === 404) {
          setServerStatus("Sem credenciais salvas no servidor");
        }
      } catch {
        setServerStatus("");
      }
    })();
  }, [open, WORKSPACE_ID]);

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

  const handleSaveServer = async () => {
    const payload = {
      workspaceId: WORKSPACE_ID,
      platformKey: "meta",
      credentials: {
        appId: credentials.appId,
        appSecret: credentials.appSecret,
        accessToken: credentials.accessToken,
        adAccountId: credentials.adAccountId,
      },
    };
    const resp = await fetch(`/api/integrations/credentials`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (resp.ok) {
      setServerStatus("Credenciais salvas no servidor");
      setSaved(true);
    }
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
              {serverStatus && <span className="text-xs text-muted-foreground">{serverStatus}</span>}
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <Button variant="ghost" onClick={handleReset} className="justify-start">
            Limpar credenciais
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSaveServer}>Salvar no servidor</Button>
            <Button onClick={handleSave}>Salvar no navegador</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


const GOOGLE_ADS_CREDENTIALS_KEY = "trafficpro.googleads.credentials";

interface GoogleAdsCredentials {
  clientId: string;
  clientSecret: string;
  developerToken: string;
  refreshToken: string;
  customerId: string;
  loginCustomerId: string;
  workspaceId: string;
}

const defaultGoogleAdsCredentials = (): GoogleAdsCredentials => ({
  clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "",
  clientSecret: import.meta.env.VITE_GOOGLE_CLIENT_SECRET ?? "",
  developerToken: import.meta.env.VITE_GOOGLE_ADS_DEVELOPER_TOKEN ?? "",
  refreshToken: import.meta.env.VITE_GOOGLE_ADS_REFRESH_TOKEN ?? "",
  customerId: import.meta.env.VITE_GOOGLE_ADS_CUSTOMER_ID ?? "",
  loginCustomerId: import.meta.env.VITE_GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? "",
  workspaceId: import.meta.env.VITE_WORKSPACE_ID ?? "",
});

function GoogleAdsCredentialsDialog() {
  const [open, setOpen] = useState(false);
  const [credentials, setCredentials] = useState<GoogleAdsCredentials>(defaultGoogleAdsCredentials);
  const [saved, setSaved] = useState(false);
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [showDeveloperToken, setShowDeveloperToken] = useState(false);
  const [serverStatus, setServerStatus] = useState<string>("");
  const WORKSPACE_ID = (import.meta.env.VITE_WORKSPACE_ID as string | undefined)?.trim() || "00000000-0000-0000-0000-000000000010";

  useEffect(() => {
    let base = defaultGoogleAdsCredentials();
    try {
      const stored = localStorage.getItem(GOOGLE_ADS_CREDENTIALS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as GoogleAdsCredentials;
        base = {
          clientId: parsed.clientId || base.clientId,
          clientSecret: parsed.clientSecret || base.clientSecret,
          developerToken: parsed.developerToken || base.developerToken,
          refreshToken: parsed.refreshToken || base.refreshToken,
          customerId: parsed.customerId || base.customerId,
          loginCustomerId: parsed.loginCustomerId || base.loginCustomerId,
          workspaceId: parsed.workspaceId || base.workspaceId,
        };
      }
      setCredentials(base);
    } catch (error) {
      console.warn("Failed to load stored Google Ads credentials", error);
      setCredentials(base);
    }
    (async () => {
      try {
        const resp = await fetch(`/api/integrations/credentials/${WORKSPACE_ID}/google_ads`, { credentials: "include" });
        if (resp.ok) {
          const json = await resp.json();
          const serverCred = json?.data?.credentials || {};
          const merged: GoogleAdsCredentials = {
            clientId: serverCred.clientId || base.clientId,
            clientSecret: serverCred.clientSecret || base.clientSecret,
            developerToken: serverCred.developerToken || base.developerToken,
            refreshToken: serverCred.refreshToken || base.refreshToken,
            customerId: serverCred.customerId || base.customerId,
            loginCustomerId: serverCred.loginCustomerId || base.loginCustomerId,
            workspaceId: base.workspaceId || WORKSPACE_ID,
          };
          setCredentials(merged);
          setServerStatus("Credenciais do servidor carregadas");
        } else if (resp.status === 404) {
          setServerStatus("Sem credenciais salvas no servidor");
        }
      } catch {
        setServerStatus("");
      }
    })();
  }, [open, WORKSPACE_ID]);

  const envSnippet = useMemo(
    () =>
      `GOOGLE_CLIENT_ID=${credentials.clientId}
GOOGLE_CLIENT_SECRET=${credentials.clientSecret}
GOOGLE_ADS_DEVELOPER_TOKEN=${credentials.developerToken}
GOOGLE_ADS_REFRESH_TOKEN=${credentials.refreshToken}
GOOGLE_ADS_CUSTOMER_ID=${credentials.customerId}
GOOGLE_ADS_LOGIN_CUSTOMER_ID=${credentials.loginCustomerId}
WORKSPACE_ID=${credentials.workspaceId}

VITE_GOOGLE_CLIENT_ID=${credentials.clientId}
VITE_GOOGLE_CLIENT_SECRET=${credentials.clientSecret}
VITE_GOOGLE_ADS_DEVELOPER_TOKEN=${credentials.developerToken}
VITE_GOOGLE_ADS_REFRESH_TOKEN=${credentials.refreshToken}
VITE_GOOGLE_ADS_CUSTOMER_ID=${credentials.customerId}
VITE_GOOGLE_ADS_LOGIN_CUSTOMER_ID=${credentials.loginCustomerId}
VITE_WORKSPACE_ID=${credentials.workspaceId}`,
    [credentials],
  );

  const handleChange = (field: keyof GoogleAdsCredentials) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setSaved(false);
    setCredentials((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(envSnippet);
    setSaved(true);
  };

  const handleSave = () => {
    localStorage.setItem(GOOGLE_ADS_CREDENTIALS_KEY, JSON.stringify(credentials));
    setSaved(true);
    setOpen(false);
  };

  const handleSaveServer = async () => {
    const payload = {
      workspaceId: WORKSPACE_ID,
      platformKey: "google_ads",
      credentials: {
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
        developerToken: credentials.developerToken,
        refreshToken: credentials.refreshToken,
        customerId: credentials.customerId,
        loginCustomerId: credentials.loginCustomerId,
      },
    };
    const resp = await fetch(`/api/integrations/credentials`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (resp.ok) {
      setServerStatus("Credenciais salvas no servidor");
      setSaved(true);
    }
  };

  const handleReset = () => {
    localStorage.removeItem(GOOGLE_ADS_CREDENTIALS_KEY);
    setCredentials(defaultGoogleAdsCredentials());
    setSaved(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Configurar credenciais</Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Credenciais do Google Ads</DialogTitle>
          <DialogDescription>
            Preencha os dados da API do Google Ads. Eles são salvos localmente e servem como referência para o `.env.local`.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="google-client-id">Client ID</Label>
            <Input id="google-client-id" value={credentials.clientId} onChange={handleChange("clientId")} placeholder="123456789..." />
          </div>
          <div>
            <Label htmlFor="google-client-secret">Client Secret</Label>
            <div className="relative">
              <Input
                id="google-client-secret"
                value={credentials.clientSecret}
                onChange={handleChange("clientSecret")}
                type={showClientSecret ? "text" : "password"}
                placeholder="••••••"
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute inset-y-0 right-0 my-1 mr-1 h-8 w-8"
                onClick={() => setShowClientSecret((prev) => !prev)}
              >
                {showClientSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div>
            <Label htmlFor="google-developer-token">Developer Token</Label>
            <div className="relative">
              <Input
                id="google-developer-token"
                value={credentials.developerToken}
                onChange={handleChange("developerToken")}
                type={showDeveloperToken ? "text" : "password"}
                placeholder="••••••"
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute inset-y-0 right-0 my-1 mr-1 h-8 w-8"
                onClick={() => setShowDeveloperToken((prev) => !prev)}
              >
                {showDeveloperToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div>
            <Label htmlFor="google-refresh-token">Refresh Token</Label>
            <Textarea
              id="google-refresh-token"
              value={credentials.refreshToken}
              onChange={handleChange("refreshToken")}
              rows={3}
              placeholder="Refresh token de longa duração"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="google-customer-id">Customer ID</Label>
              <Input id="google-customer-id" value={credentials.customerId} onChange={handleChange("customerId")} placeholder="1234567890" />
            </div>
            <div>
              <Label htmlFor="google-login-customer-id">Login Customer ID</Label>
              <Input id="google-login-customer-id" value={credentials.loginCustomerId} onChange={handleChange("loginCustomerId")} placeholder="1234567890" />
            </div>
          </div>
          <div>
            <Label htmlFor="google-workspace">Workspace ID</Label>
            <Input id="google-workspace" value={credentials.workspaceId} onChange={handleChange("workspaceId")} />
            <p className="mt-1 text-xs text-muted-foreground">
              ID do workspace no Supabase. Mantemos o valor padrão `0000...` do ambiente seed, altere caso use outra instância.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Snippet para .env.local</Label>
            <Textarea readOnly value={envSnippet} rows={8} />
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleCopy}>
                <Copy className="mr-2 h-4 w-4" /> Copiar snippet
              </Button>
              {saved && <span className="text-xs text-muted-foreground">Snippet copiado/salvo recentemente</span>}
              {serverStatus && <span className="text-xs text-muted-foreground">{serverStatus}</span>}
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <Button variant="ghost" onClick={handleReset} className="justify-start">
            Limpar credenciais
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSaveServer}>Salvar no servidor</Button>
            <Button onClick={handleSave}>Salvar no navegador</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

