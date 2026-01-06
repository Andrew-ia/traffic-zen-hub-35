import { useWorkspace } from "@/hooks/useWorkspace";
import { useMercadoAdsPreview } from "@/hooks/useMercadoAds";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, AlertCircle, Copy, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

export default function MercadoAdsManual() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id || null;
  const { data, isLoading, error } = useMercadoAdsPreview(workspaceId);
  const { toast } = useToast();
  const navigate = useNavigate();

  const items = data?.items || [];
  const summary = data?.summary || { A: 0, B: 0, C: 0 };

  const groupedItems = {
    A: items.filter((i) => i.curve === "A"),
    B: items.filter((i) => i.curve === "B"),
    C: items.filter((i) => i.curve === "C"),
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado", description: "Código copiado para a área de transferência." });
  };

  const curveColor = (curve: string) => {
    const map: Record<string, string> = {
      A: "bg-emerald-100 text-emerald-800 border-emerald-200",
      B: "bg-amber-100 text-amber-800 border-amber-200",
      C: "bg-blue-100 text-blue-800 border-blue-200",
    };
    return map[curve] || "bg-gray-100 text-gray-800";
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-[200px]" />
        <Skeleton className="h-[200px]" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Erro ao carregar dados</AlertTitle>
        <AlertDescription>
          Não foi possível carregar a classificação dos produtos. Tente novamente mais tarde.
          <br />
          {(error as Error)?.message}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Classificação Manual de Campanhas</h1>
          <p className="text-muted-foreground">
            Veja abaixo quais produtos devem ser colocados em cada campanha com base nas regras de automação.
          </p>
        </div>
      </div>

      <Alert className="bg-blue-50 border-blue-200">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertTitle className="text-blue-800">Como usar esta página</AlertTitle>
        <AlertDescription className="text-blue-700">
          Como a automação automática está enfrentando problemas de permissão, utilize esta lista para mover seus produtos
          manualmente no painel do Mercado Livre Ads. Copie o ID do anúncio (MLB...) e busque no painel do ML.
        </AlertDescription>
      </Alert>

      {["A", "B", "C"].map((curve) => {
        const products = groupedItems[curve as "A" | "B" | "C"];
        const count = summary[curve] || 0;

        if (products.length === 0) return null;

        return (
          <Card key={curve} className="border-l-4" style={{ borderLeftColor: curve === "A" ? "#10b981" : curve === "B" ? "#f59e0b" : "#3b82f6" }}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-3">
                  <Badge className={`text-base px-3 py-1 ${curveColor(curve)}`}>
                    Curva {curve}
                  </Badge>
                  <span className="text-muted-foreground text-sm font-normal">
                    {curve === "A" ? "Alta Performance (Rentabilidade)" : curve === "B" ? "Otimização (Crescimento)" : "Teste / Cauda Longa"}
                  </span>
                </CardTitle>
                <Badge variant="outline">{count} produtos</Badge>
              </div>
              <CardDescription>
                Produtos com {curve === "A" ? "alto volume de vendas e bom ACOS" : curve === "B" ? "vendas moderadas e potencial de crescimento" : "poucas vendas ou em fase de teste"}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>Métricas (30d)</TableHead>
                    <TableHead>ACOS</TableHead>
                    <TableHead>Motivo da Classificação</TableHead>
                    <TableHead className="w-[100px]">ID ML</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((item) => (
                    <TableRow key={item.productId}>
                      <TableCell className="font-medium max-w-[300px]">
                        <div className="truncate" title={item.title || ""}>{item.title}</div>
                        <div className="text-xs text-muted-foreground">{item.sku}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {item.sales30d} vendas
                          <br />
                          R$ {item.revenue30d?.toFixed(2)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.acos && item.acos > 0.3 ? "destructive" : "secondary"}>
                          {item.acos ? (item.acos * 100).toFixed(1) : 0}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px]">
                        {item.reason}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1"
                          onClick={() => copyToClipboard(item.mlItemId)}
                        >
                          <Copy className="h-3 w-3" />
                          {item.mlItemId}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
