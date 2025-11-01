import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Plus, FlaskConical, TrendingUp, Users } from "lucide-react";

const experiments = [
  {
    id: 1,
    name: "Teste CTA - Comprar vs Saiba Mais",
    type: "A/B Test",
    status: "Ativo",
    traffic: 50,
    variants: 2,
    winner: null,
    confidence: 87,
    improvement: "+12.4%",
  },
  {
    id: 2,
    name: "Teste Headlines - 3 Variações",
    type: "Multivariate",
    status: "Ativo",
    traffic: 33,
    variants: 3,
    winner: "Variação B",
    confidence: 95,
    improvement: "+18.2%",
  },
  {
    id: 3,
    name: "Teste Criativos - Vídeo vs Imagem",
    type: "A/B Test",
    status: "Concluído",
    traffic: 50,
    variants: 2,
    winner: "Vídeo",
    confidence: 98,
    improvement: "+24.8%",
  },
];

export default function Experiments() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Testes e Experimentos</h1>
          <p className="text-muted-foreground mt-1">
            Configure e analise experimentos A/B e multivariados
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Novo Experimento
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Experimentos Ativos</CardTitle>
            <FlaskConical className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground mt-1">+3 este mês</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Concluídos</CardTitle>
            <FlaskConical className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">45</div>
            <p className="text-xs text-success mt-1">89% com winners</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Uplift Médio</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+16.8%</div>
            <p className="text-xs text-muted-foreground mt-1">Performance gain</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tráfego em Teste</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">28.4K</div>
            <p className="text-xs text-muted-foreground mt-1">Usuários</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Experimentos em Andamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {experiments.map((exp) => (
            <div
              key={exp.id}
              className="p-6 rounded-lg border space-y-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold">{exp.name}</h3>
                    <Badge variant={exp.status === "Ativo" ? "default" : "secondary"}>
                      {exp.status}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline">{exp.type}</Badge>
                    <Badge variant="outline">{exp.variants} variações</Badge>
                    <Badge variant="outline">{exp.traffic}% tráfego</Badge>
                  </div>
                </div>
                <Button variant="outline" size="sm">Ver Detalhes</Button>
              </div>

              {exp.winner ? (
                <div className="flex items-center justify-between p-4 rounded-lg bg-success/10">
                  <div>
                    <p className="text-sm font-medium">Vencedor: {exp.winner}</p>
                    <p className="text-sm text-muted-foreground">
                      Melhoria de {exp.improvement} com {exp.confidence}% de confiança
                    </p>
                  </div>
                  <Button>Implementar</Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Nível de confiança</span>
                    <span className="font-medium">{exp.confidence}%</span>
                  </div>
                  <Progress value={exp.confidence} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {exp.confidence >= 95 
                      ? "Pronto para análise final" 
                      : `${95 - exp.confidence}% até significância estatística`}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">CTR</p>
                  <p className="text-lg font-bold">3.8%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Conversões</p>
                  <p className="text-lg font-bold">1,245</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">CPA</p>
                  <p className="text-lg font-bold">R$ 24,50</p>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Criar Novo Experimento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Button variant="outline" className="h-32 flex flex-col gap-3">
              <FlaskConical className="h-8 w-8" />
              <div className="text-center">
                <p className="font-semibold">Teste A/B</p>
                <p className="text-xs text-muted-foreground">2 variações</p>
              </div>
            </Button>
            <Button variant="outline" className="h-32 flex flex-col gap-3">
              <FlaskConical className="h-8 w-8" />
              <div className="text-center">
                <p className="font-semibold">Teste Multivariado</p>
                <p className="text-xs text-muted-foreground">3+ variações</p>
              </div>
            </Button>
            <Button variant="outline" className="h-32 flex flex-col gap-3">
              <FlaskConical className="h-8 w-8" />
              <div className="text-center">
                <p className="font-semibold">Split Test</p>
                <p className="text-xs text-muted-foreground">Divisão de tráfego</p>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
