import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  Facebook, 
  Instagram, 
  Linkedin, 
  Youtube,
  TrendingUp,
  Mail,
  Zap,
  BarChart3
} from "lucide-react";

const platforms = [
  {
    id: 1,
    name: "Meta Ads",
    description: "Facebook & Instagram",
    icon: Facebook,
    connected: true,
    accounts: 3,
    status: "Sincronizado há 5 min",
  },
  {
    id: 2,
    name: "Google Ads",
    description: "Search, Display & YouTube",
    icon: TrendingUp,
    connected: true,
    accounts: 2,
    status: "Sincronizado há 12 min",
  },
  {
    id: 3,
    name: "TikTok Ads",
    description: "TikTok for Business",
    icon: Instagram,
    connected: false,
    accounts: 0,
    status: "Não conectado",
  },
  {
    id: 4,
    name: "LinkedIn Ads",
    description: "LinkedIn Campaign Manager",
    icon: Linkedin,
    connected: true,
    accounts: 1,
    status: "Sincronizado há 1 hora",
  },
  {
    id: 5,
    name: "YouTube Ads",
    description: "Google Video Campaigns",
    icon: Youtube,
    connected: false,
    accounts: 0,
    status: "Não conectado",
  },
];

const analytics = [
  {
    id: 1,
    name: "Google Analytics 4",
    description: "Rastreamento e análise web",
    icon: BarChart3,
    connected: true,
    properties: 2,
  },
  {
    id: 2,
    name: "Google Tag Manager",
    description: "Gerenciamento de tags",
    icon: BarChart3,
    connected: true,
    containers: 3,
  },
  {
    id: 3,
    name: "Meta Pixel",
    description: "Rastreamento Facebook",
    icon: Facebook,
    connected: true,
    pixels: 2,
  },
];

const crm = [
  {
    id: 1,
    name: "HubSpot",
    description: "CRM e automação",
    icon: Mail,
    connected: false,
  },
  {
    id: 2,
    name: "WhatsApp Business",
    description: "Mensagens e leads",
    icon: Zap,
    connected: true,
    number: "+55 11 9****-1234",
  },
  {
    id: 3,
    name: "Salesforce",
    description: "CRM empresarial",
    icon: TrendingUp,
    connected: false,
  },
];

export default function Integrations() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Integrações</h1>
        <p className="text-muted-foreground mt-1">
          Conecte suas plataformas de anúncios, analytics e CRM
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Plataformas Conectadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
            <p className="text-xs text-muted-foreground mt-1">de 5 disponíveis</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Contas Sincronizadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">6</div>
            <p className="text-xs text-success mt-1">Todas ativas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Analytics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
            <p className="text-xs text-muted-foreground mt-1">Ferramentas ativas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Última Sincronização</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">5 min</div>
            <p className="text-xs text-success mt-1">Tudo sincronizado</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-4">Plataformas de Anúncios</h2>
        <div className="grid gap-4">
          {platforms.map((platform) => (
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
                      {platform.connected ? (
                        <>
                          <Badge variant="outline">{platform.accounts} contas</Badge>
                          <Badge variant="secondary">{platform.status}</Badge>
                        </>
                      ) : (
                        <Badge variant="secondary">{platform.status}</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {platform.connected ? (
                    <>
                      <Switch checked={true} />
                      <Button variant="outline">Configurar</Button>
                    </>
                  ) : (
                    <Button>Conectar</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-4">Analytics e Rastreamento</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {analytics.map((tool) => (
            <Card key={tool.id}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <tool.icon className="h-5 w-5 text-primary" />
                  </div>
                  <Switch checked={tool.connected} />
                </div>
                <p className="font-semibold mb-1">{tool.name}</p>
                <p className="text-sm text-muted-foreground mb-3">{tool.description}</p>
                {tool.properties && (
                  <Badge variant="outline">{tool.properties} propriedades</Badge>
                )}
                {tool.containers && (
                  <Badge variant="outline">{tool.containers} containers</Badge>
                )}
                {tool.pixels && (
                  <Badge variant="outline">{tool.pixels} pixels</Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-4">CRM e Comunicação</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {crm.map((tool) => (
            <Card key={tool.id}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <tool.icon className="h-5 w-5 text-primary" />
                  </div>
                  <Badge variant={tool.connected ? "default" : "secondary"}>
                    {tool.connected ? "Conectado" : "Desconectado"}
                  </Badge>
                </div>
                <p className="font-semibold mb-1">{tool.name}</p>
                <p className="text-sm text-muted-foreground mb-3">{tool.description}</p>
                {tool.number && (
                  <p className="text-sm font-mono mb-3">{tool.number}</p>
                )}
                <Button variant="outline" className="w-full">
                  {tool.connected ? "Configurar" : "Conectar"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
