import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CampaignsTable } from "@/components/campaigns/CampaignsTable";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useCampaigns, type CampaignStatusFilter } from "@/hooks/useCampaigns";

const PAGE_SIZE = 12;

export default function Campaigns() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<CampaignStatusFilter>("all");
  const [metaPage, setMetaPage] = useState(1);
  const [googlePage, setGooglePage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    setMetaPage(1);
    setGooglePage(1);
  }, [tab, debouncedSearch]);

  const { data: metaData, isLoading: metaLoading, error: metaError } = useCampaigns({
    status: tab,
    search: debouncedSearch,
    page: metaPage,
    pageSize: PAGE_SIZE,
    platform: "meta"
  });

  const { data: googleData, isLoading: googleLoading, error: googleError } = useCampaigns({
    status: tab,
    search: debouncedSearch,
    page: googlePage,
    pageSize: PAGE_SIZE,
    platform: "google_ads"
  });

  const metaCampaigns = metaData?.campaigns ?? [];
  const metaTotal = metaData?.total ?? metaCampaigns.length;

  const googleCampaigns = googleData?.campaigns ?? [];
  const googleTotal = googleData?.total ?? googleCampaigns.length;

  function exportCampaignsCsv() {
    try {
      const sections: Array<{ title: string; rows: any[] }> = [
        { title: "Meta Ads", rows: metaCampaigns },
        { title: "Google Ads", rows: googleCampaigns },
      ];

      const escape = (v: unknown) => {
        if (v === null || v === undefined) return "";
        const s = String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}` : s;
      };

      const lines: string[] = [];
      lines.push("Relatório de Campanhas");
      lines.push(`Status: ${tab}`);
      lines.push(`Busca: ${debouncedSearch || "(vazio)"}`);
      lines.push("");

      for (const section of sections) {
        lines.push(section.title);
        lines.push("Nome,Conta,Plataforma,Objetivo,Status,Resultado,Qtd,Investimento,Custo/Resultado,ROAS");
        for (const c of section.rows) {
          lines.push([
            c.name,
            c.platformAccount ?? "",
            c.platformKey ?? "",
            c.objective ?? "",
            c.status,
            c.resultLabel ?? "Resultados",
            c.resultValue ?? 0,
            c.spend ?? 0,
            c.costPerResult ?? 0,
            c.roas ?? "",
          ].map(escape).join(","));
        }
        lines.push("");
      }

      const csv = lines.join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `campanhas_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Falha ao exportar CSV de campanhas", e);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Campanhas</h1>
          <p className="text-muted-foreground mt-1">Gerencie todas as suas campanhas de tráfego</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Input
            className="w-full md:w-80"
            placeholder="Buscar campanhas..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Button onClick={exportCampaignsCsv} disabled={(metaCampaigns.length + googleCampaigns.length) === 0}>
            Exportar CSV
          </Button>
          <Button onClick={() => navigate("/campaigns/new/meta")}>
            Nova Campanha
          </Button>
        </div>
      </div>

      {(metaError || googleError) && (
        <Card>
          <CardContent className="py-6">
            <p className="text-destructive">
              Não foi possível carregar as campanhas. Verifique suas permissões no Supabase.
            </p>
          </CardContent>
        </Card>
      )}

      <Tabs value={tab} onValueChange={(value) => setTab(value as CampaignStatusFilter)} className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">Todas</TabsTrigger>
          <TabsTrigger value="active">Ativas</TabsTrigger>
          <TabsTrigger value="paused">Pausadas</TabsTrigger>
          <TabsTrigger value="archived">Arquivadas</TabsTrigger>
          <TabsTrigger value="completed">Concluídas</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="space-y-6">
          <CampaignsTable
            title="Meta Ads"
            campaigns={metaCampaigns}
            isLoading={metaLoading}
            page={metaPage}
            pageSize={PAGE_SIZE}
            total={metaTotal}
            onPageChange={setMetaPage}
            showCreateButton={false}
          />

          <CampaignsTable
            title="Google Ads"
            campaigns={googleCampaigns}
            isLoading={googleLoading}
            page={googlePage}
            pageSize={PAGE_SIZE}
            total={googleTotal}
            onPageChange={setGooglePage}
            showCreateButton={false}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
