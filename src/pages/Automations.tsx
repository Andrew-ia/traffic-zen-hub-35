import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Zap, TrendingUp, TrendingDown, DollarSign } from "lucide-react";

const automations = [
  {
    id: 1,
    name: "Pausar anúncios com CPM alto",
    condition: "CPM > R$ 50",
    action: "Pausar anúncio",
    campaigns: 12,
    triggered: 8,
    status: true,
  },
  {
    id: 2,
    name: "Aumentar orçamento com CPA baixo",
    condition: "CPA < R$ 25",
    action: "Aumentar orçamento em 20%",
    campaigns: 8,
    triggered: 15,
    status: true,
  },
  {
    id: 3,
    name: "Alertar sobre queda de impressões",
    condition: "Impressões caem 30%",
    action: "Enviar notificação",
    campaigns: 20,
    triggered: 3,
    status: true,
  },
  {
    id: 4,
    name: "Redistribuir orçamento ROAS",
    condition: "ROAS > 4.0",
    action: "Aumentar orçamento em 30%",
    campaigns: 5,
    triggered: 12,
    status: false,
  },
];

const strategies = [
  {
    id: 1,
    name: "CPA Target",
    description: "Otimizar para custo por aquisição alvo",
    campaigns: 15,
    avgCPA: "R$ 28,50",
    icon: DollarSign,
  },
  {
    id: 2,
    name: "ROAS Target",
    description: "Maximizar retorno sobre investimento",
    campaigns: 8,
    avgROAS: "4.2x",
    icon: TrendingUp,
  },
  {
    id: 3,
    name: "Budget Pacing",
    description: "Distribuição uniforme do orçamento",
    campaigns: 23,
    spent: "87% do orçamento",
    icon: TrendingDown,
  },
];

export default function Automations() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Automações e Regras</h1>
          <p className="text-muted-foreground mt-1">
            Configure regras automáticas para otimizar suas campanhas
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nova Regra
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Regras Ativas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24</div>
            <p className="text-xs text-muted-foreground mt-1">+3 este mês</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Acionamentos Hoje</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">156</div>
            <p className="text-xs text-success mt-1">+28% vs ontem</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Economia Gerada</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ 8.4K</div>
            <p className="text-xs text-muted-foreground mt-1">Este mês</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Regras Configuradas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {automations.map((automation) => (
            <div
              key={automation.id}
              className="flex items-center justify-between p-4 rounded-lg border"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{automation.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Se {automation.condition} → {automation.action}
                  </p>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="outline">{automation.campaigns} campanhas</Badge>
                    <Badge variant="secondary">{automation.triggered} acionamentos</Badge>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Switch checked={automation.status} />
                <Button variant="ghost" size="sm">Editar</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div>
        <h2 className="text-2xl font-bold mb-4">Estratégias de Otimização</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {strategies.map((strategy) => (
            <Card key={strategy.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{strategy.name}</CardTitle>
                  <strategy.icon className="h-5 w-5 text-primary" />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{strategy.description}</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Campanhas</span>
                    <span className="font-medium">{strategy.campaigns}</span>
                  </div>
                  {strategy.avgCPA && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">CPA Médio</span>
                      <span className="font-medium">{strategy.avgCPA}</span>
                    </div>
                  )}
                  {strategy.avgROAS && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">ROAS Médio</span>
                      <span className="font-medium">{strategy.avgROAS}</span>
                    </div>
                  )}
                  {strategy.spent && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Utilizado</span>
                      <span className="font-medium">{strategy.spent}</span>
                    </div>
                  )}
                </div>
                <Button variant="outline" className="w-full">Configurar</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
