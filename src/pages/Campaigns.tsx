import { useEffect, useState } from "react";
import { CampaignsTable } from "@/components/campaigns/CampaignsTable";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCampaigns, type CampaignStatusFilter } from "@/hooks/useCampaigns";

const PAGE_SIZE = 12;

export default function Campaigns() {
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
