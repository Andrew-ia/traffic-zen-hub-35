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
  const [instagramDays, setInstagramDays] = useState<number>(7);

  const metaIntegration = useMemo(
    () => overview?.integrations.find((integration) => integration.platform_key === "meta") ?? null,
    [overview],
  );

  const metaAccounts = useMemo(
    () => overview?.platformAccounts.filter((account) => account.platform_key === "meta") ?? [],
    [overview],
  );

  const instagramIntegration = useMemo(
    () => overview?.integrations.find((integration) => integration.platform_key === "instagram") ?? null,
    [overview],
  );

  const instagramAccounts = useMemo(
    () => overview?.platformAccounts.filter((account) => account.platform_key === "instagram") ?? [],
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

  const instagramStatusText = useMemo(() => {
    if (!instagramIntegration) return "Não conectado";
    if (instagramIntegration.last_synced_at) {
      return `Sincronizado ${formatDistanceToNow(new Date(instagramIntegration.last_synced_at), {
        addSuffix: true,
        locale: ptBR,
      })}`;
    }
    return "Sincronização pendente";
  }, [instagramIntegration]);

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

    const instagramCard = {
      id: 2,
      name: "Instagram Insights",
      description: "Métricas do Instagram Business",
      icon: Instagram,
      connected: instagramIntegration?.status === "active",
      accounts: instagramAccounts.length,
      status: instagramStatusText,
    };

    return [metaCard, instagramCard];
  }, [metaIntegration, metaAccounts.length, metaStatusText, instagramIntegration, instagramAccounts.length, instagramStatusText]);

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
                        <Select value={String(instagramDays)} onValueChange={(v) => setInstagramDays(Number(v))}>
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
                      <InstagramSyncButton size="sm" days={instagramDays} />
                      <InstagramCredentialsDialog />
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
const INSTAGRAM_CREDENTIALS_KEY = "trafficpro.instagram.credentials";

interface MetaCredentials {
  appId: string;
  appSecret: string;
  accessToken: string;
  adAccountId: string;
  workspaceId: string;
}

interface InstagramCredentials {
  igUserId: string;
  accessToken: string;
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

const defaultInstagramCredentials = (): InstagramCredentials => ({
  igUserId: import.meta.env.VITE_IG_USER_ID ?? "",
  accessToken: import.meta.env.VITE_META_ACCESS_TOKEN ?? "",
  workspaceId: import.meta.env.VITE_WORKSPACE_ID ?? "",
});

function InstagramCredentialsDialog() {
  const [open, setOpen] = useState(false);
  const [credentials, setCredentials] = useState<InstagramCredentials>(defaultInstagramCredentials);
  const [saved, setSaved] = useState(false);
  const [serverTokenMasked, setServerTokenMasked] = useState<string>("");
  const WORKSPACE_ID = (import.meta.env.VITE_WORKSPACE_ID as string | undefined)?.trim() || "00000000-0000-0000-0000-000000000010";

  const maskToken = (t: string) => {
    const s = (t || "").trim();
    if (s.length < 12) return s ? `${s.slice(0, 4)}••••${s.slice(-2)}` : "";
    return `${s.slice(0, 6)}••••••••${s.slice(-4)}`;
  };

  useEffect(() => {
    try {
      const stored = localStorage.getItem(INSTAGRAM_CREDENTIALS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as InstagramCredentials;
        const defaults = defaultInstagramCredentials();
        const merged: InstagramCredentials = {
          igUserId: parsed.igUserId || defaults.igUserId,
          accessToken: parsed.accessToken || defaults.accessToken,
          workspaceId: parsed.workspaceId || defaults.workspaceId,
        };
        setCredentials(merged);
      } else {
        setCredentials(defaultInstagramCredentials());
      }
    } catch (error) {
      console.warn("Failed to load stored Instagram credentials", error);
    }
    // Fetch server-side credentials (masked)
    (async () => {
      try {
        const resp = await fetch(`/api/integrations/credentials/${WORKSPACE_ID}/instagram`, { credentials: "include" });
        if (resp.ok) {
          const json = await resp.json();
          const token = json?.data?.credentials?.accessToken || "";
          if (token) setServerTokenMasked(maskToken(String(token)));
        }
      } catch {
        void 0;
      }
    })();
  }, [open, WORKSPACE_ID]);

  const envSnippet = useMemo(
    () =>
      `IG_USER_ID=${credentials.igUserId}\nIG_ACCESS_TOKEN=${credentials.accessToken || serverTokenMasked}\nIG_WORKSPACE_ID=${credentials.workspaceId}\n\nVITE_IG_USER_ID=${credentials.igUserId}`,
    [credentials, serverTokenMasked],
  );

  const handleChange = (field: keyof InstagramCredentials) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setSaved(false);
    setCredentials((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(envSnippet);
    setSaved(true);
  };

  const handleSave = () => {
    localStorage.setItem(INSTAGRAM_CREDENTIALS_KEY, JSON.stringify(credentials));
    setSaved(true);
    setOpen(false);
  };

  const handleReset = () => {
    localStorage.removeItem(INSTAGRAM_CREDENTIALS_KEY);
    setCredentials(defaultInstagramCredentials());
    setSaved(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Configurar Instagram</Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Credenciais do Instagram</DialogTitle>
          <DialogDescription>
            Configure o Instagram Business Account ID. O Access Token é o mesmo usado no Meta Ads.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-blue-100 p-2">
                <svg
                  className="w-5 h-5 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-sm mb-1 text-orange-600">⚠️ IMPORTANTE: Use o Instagram Business Account ID, não o Page ID</h4>
                <p className="text-xs text-muted-foreground mb-2">
                  <strong>Método 1 - Via Graph API Explorer (recomendado):</strong>
                </p>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside ml-2">
                  <li>Acesse <a href="https://developers.facebook.com/tools/explorer" target="_blank" rel="noopener noreferrer" className="underline text-blue-600">Graph API Explorer</a></li>
                  <li>Cole sua Facebook Page ID e adicione <code className="bg-white px-1 py-0.5 rounded">?fields=instagram_business_account</code></li>
                  <li>Clique em "Submit". O ID do Instagram aparecerá na resposta</li>
                </ol>
                <p className="text-xs text-muted-foreground mt-2 mb-1">
                  <strong>Método 2 - Via Business Suite:</strong>
                </p>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside ml-2">
                  <li>Acesse <a href="https://business.facebook.com" target="_blank" rel="noopener noreferrer" className="underline text-blue-600">business.facebook.com</a></li>
                  <li>Vá em "Instagram accounts" (não "Pages"!)</li>
                  <li>Clique na sua conta do Instagram</li>
                  <li>O <strong>Instagram Business Account ID</strong> aparece na URL</li>
                </ol>
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="ig-user-id">Instagram Business Account ID</Label>
            <Input
              id="ig-user-id"
              value={credentials.igUserId}
              onChange={handleChange("igUserId")}
              placeholder="211443329551349"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              O ID numérico da sua conta Instagram Business conectada ao Facebook Page
            </p>
          </div>

          <div>
            <Label htmlFor="ig-access-token">Access Token (mesmo do Meta Ads)</Label>
            <Textarea
              id="ig-access-token"
              value={credentials.accessToken}
              onChange={handleChange("accessToken")}
              rows={3}
              placeholder="Access token de longa duração do Meta"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Use o mesmo Access Token configurado no Meta Ads. No servidor, o token está {serverTokenMasked ? `configurado (${serverTokenMasked})` : "configurado"}.
            </p>
          </div>

          <div>
            <Label htmlFor="ig-workspace">Workspace ID</Label>
            <Input
              id="ig-workspace"
              value={credentials.workspaceId}
              onChange={handleChange("workspaceId")}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              ID do workspace no Supabase (geralmente o mesmo do Meta Ads)
            </p>
          </div>

          <div className="space-y-2">
            <Label>Snippet para .env.local</Label>
            <Textarea readOnly value={envSnippet} rows={4} />
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
