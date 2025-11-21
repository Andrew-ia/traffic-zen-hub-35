
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, TrendingUp, MousePointerClick, DollarSign, Target, Sparkles } from "lucide-react";
import { resolveApiBase } from "@/lib/apiBase";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";

const API_BASE = resolveApiBase();

interface CreativePerformance {
  id: string;
  name: string;
  thumbnail_url: string | null;
  storage_url: string | null;
  type: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversion_value: number;
  ctr: number;
  cpc: number;
  cpa: number;
  roas: number;
}

export default function MetaCreativeAnalysis() {
  const [days, setDays] = useState("30");
  const [selectedCreative, setSelectedCreative] = useState<CreativePerformance | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const workspaceId = import.meta.env.VITE_WORKSPACE_ID;

  const { data: creatives, isLoading, error } = useQuery({
    queryKey: ["creative-performance", days, workspaceId],
    queryFn: async () => {
      const response = await fetch(
        `${API_BASE}/api/analytics/creative-performance?workspaceId=${workspaceId}&days=${days}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch creative performance");
      }
      const json = await response.json();
      return json.data as CreativePerformance[];
    },
    enabled: !!workspaceId,
  });

  const handleAnalyze = async (creative: CreativePerformance) => {
    setSelectedCreative(creative);
    setAnalysisResult(null);
    setIsDialogOpen(true);
    setIsAnalyzing(true);

    try {
      // Only use storage_url (Supabase) to avoid 403 errors from expired Facebook URLs
      const imageUrl = creative.storage_url;
      if (!imageUrl) {
        throw new Error("No image URL available for analysis");
      }

      const response = await fetch(`${API_BASE}/api/ai/analyze-creative`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl,
          creativeName: creative.name,
          metrics: {
            spend: creative.spend,
            impressions: creative.impressions,
            clicks: creative.clicks,
            ctr: creative.ctr.toFixed(2),
            cpc: creative.cpc.toFixed(2),
            roas: creative.roas.toFixed(2),
            cpa: creative.cpa.toFixed(2),
          },
        }),
      });

      const json = await response.json();
      if (!json.success) {
        throw new Error(json.error || "Failed to analyze creative");
      }

      setAnalysisResult(json.analysis);
    } catch (error) {
      console.error("Analysis failed:", error);
      setAnalysisResult("Falha ao analisar criativo. Tente novamente.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "percent",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value / 100);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Análise de Criativos Meta</h1>
          <p className="text-muted-foreground mt-1">
            Visualize o desempenho dos seus criativos e use IA para gerar insights.
          </p>
        </div>
        <div className="w-[180px]">
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger>
              <SelectValue placeholder="Período" />
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
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="p-8 text-center text-red-500">
          Erro ao carregar dados: {(error as Error).message}
        </div>
      ) : !creatives?.length ? (
        <div className="p-8 text-center text-muted-foreground">
          Nenhum criativo encontrado para este período.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {creatives.map((creative) => (
            <Card key={creative.id} className="overflow-hidden flex flex-col">
              <div className="aspect-square relative bg-muted group">
                {creative.storage_url ? (
                  <img
                    src={creative.storage_url}
                    alt={creative.name}
                    className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex items-center justify-center w-full h-full text-muted-foreground">
                    Sem imagem
                  </div>
                )}
                <div className="absolute top-2 right-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="opacity-90 hover:opacity-100 shadow-sm"
                    onClick={() => handleAnalyze(creative)}
                  >
                    <Sparkles className="w-3 h-3 mr-1.5 text-purple-500" />
                    Analisar
                  </Button>
                </div>
              </div>

              <CardContent className="p-4 flex-1 flex flex-col gap-3">
                <div className="min-h-[40px]">
                  <h3 className="font-medium text-sm line-clamp-2" title={creative.name}>
                    {creative.name}
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex flex-col gap-0.5 p-2 rounded bg-muted/30">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <DollarSign className="w-3 h-3" /> Investimento
                    </span>
                    <span className="font-semibold">{formatCurrency(creative.spend)}</span>
                  </div>
                  <div className="flex flex-col gap-0.5 p-2 rounded bg-muted/30">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" /> ROAS
                    </span>
                    <span className="font-semibold">{creative.roas.toFixed(2)}x</span>
                  </div>
                  <div className="flex flex-col gap-0.5 p-2 rounded bg-muted/30">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <MousePointerClick className="w-3 h-3" /> CTR
                    </span>
                    <span className="font-semibold">{formatPercent(creative.ctr)}</span>
                  </div>
                  <div className="flex flex-col gap-0.5 p-2 rounded bg-muted/30">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Target className="w-3 h-3" /> CPA
                    </span>
                    <span className="font-semibold">{formatCurrency(creative.cpa)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              Análise de IA
            </DialogTitle>
            <DialogDescription>
              Insights gerados com base na performance e visual do criativo.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col gap-4">
            {selectedCreative && (
              <div className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg">
                <div className="h-16 w-16 rounded overflow-hidden flex-shrink-0">
                  <img
                    src={selectedCreative.storage_url || ""}
                    className="w-full h-full object-cover"
                    alt="Thumbnail"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{selectedCreative.name}</p>
                  <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                    <span>ROAS: {selectedCreative.roas.toFixed(2)}x</span>
                    <span>CTR: {formatPercent(selectedCreative.ctr)}</span>
                    <span>Spend: {formatCurrency(selectedCreative.spend)}</span>
                  </div>
                </div>
              </div>
            )}

            <ScrollArea className="flex-1 p-4 border rounded-md bg-card">
              {isAnalyzing ? (
                <div className="flex flex-col items-center justify-center h-40 gap-3 text-muted-foreground">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                  <p>Analisando criativo...</p>
                </div>
              ) : analysisResult ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{analysisResult}</ReactMarkdown>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  Aguardando análise...
                </div>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
