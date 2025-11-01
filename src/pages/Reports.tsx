import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

const platformData = [
  { name: "Facebook", valor: 12500 },
  { name: "Google", valor: 18200 },
  { name: "Instagram", valor: 9800 },
  { name: "LinkedIn", valor: 6400 },
  { name: "TikTok", valor: 5200 },
];

export default function Reports() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Relatórios</h1>
        <p className="text-muted-foreground mt-1">
          Análise detalhada do desempenho das campanhas
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <PerformanceChart />

        <Card>
          <CardHeader>
            <CardTitle>Gastos por Plataforma</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={platformData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="name" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "var(--radius)",
                  }}
                />
                <Bar 
                  dataKey="valor" 
                  fill="hsl(var(--primary))" 
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Taxa de Conversão</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">4.6%</div>
            <p className="text-sm text-success mt-2">+0.8% vs período anterior</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>CPA Médio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">R$ 28.50</div>
            <p className="text-sm text-success mt-2">-12% vs período anterior</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>ROI</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">380%</div>
            <p className="text-sm text-success mt-2">+45% vs período anterior</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
