import { useEffect, useState } from "react";
import { CampaignsTable } from "@/components/campaigns/CampaignsTable";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCampaigns, type CampaignStatusFilter } from "@/hooks/useCampaigns";

const PAGE_SIZE = 12;

export default function Campaigns() {
  const [tab, setTab] = useState<CampaignStatusFilter>("all");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [tab, debouncedSearch]);

  const { data, isLoading, error } = useCampaigns({ status: tab, search: debouncedSearch, page, pageSize: PAGE_SIZE });
  const campaigns = data?.campaigns ?? [];
  const total = data?.total ?? campaigns.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Campanhas</h1>
          <p className="text-muted-foreground mt-1">Gerencie todas as suas campanhas de tráfego</p>
        </div>
        <div className="w-full md:w-80">
          <Input placeholder="Buscar campanhas..." value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
      </div>

      {error && (
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

        <TabsContent value={tab} className="space-y-4">
          <CampaignsTable
            campaigns={campaigns}
            isLoading={isLoading}
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            onPageChange={setPage}
            showCreateButton={false}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
