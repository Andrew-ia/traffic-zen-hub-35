import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

const budgetItems = [
  { name: "Facebook Ads", budget: 8000, spent: 6400, percentage: 80 },
  { name: "Google Ads", budget: 12000, spent: 8400, percentage: 70 },
  { name: "Instagram Ads", budget: 5000, spent: 4200, percentage: 84 },
  { name: "LinkedIn Ads", budget: 4000, spent: 2000, percentage: 50 },
];

export default function Budget() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestão de Orçamento</h1>
          <p className="text-muted-foreground mt-1">
            Controle e otimize seus investimentos em mídia
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Orçamento
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Orçamento Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ 29.000</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total Gasto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ 21.000</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Disponível</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">R$ 8.000</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">% Utilizado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">72.4%</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Orçamento por Plataforma</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {budgetItems.map((item) => (
            <div key={item.name} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{item.name}</span>
                <span className="text-muted-foreground">
                  R$ {item.spent.toLocaleString()} / R$ {item.budget.toLocaleString()}
                </span>
              </div>
              <Progress value={item.percentage} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {item.percentage}% do orçamento utilizado
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
