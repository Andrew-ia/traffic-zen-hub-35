import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
// Visão principal por campanhas, sem abas
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
// Dropdown removido na visão principal
import { useCreativeLibrary } from "@/hooks/useCreativeLibrary";
import { Search, Folder, AlertCircle } from "lucide-react";
import { CampaignCreativesModal } from "@/components/creatives/CampaignCreativesModal";
import { MediaThumb } from "@/components/creatives/MediaThumb";
import { useCampaigns } from "@/hooks/useCampaigns";

// Types
// A visão foi simplificada para focar em campanhas

// Utility functions
function formatBytes(bytes: number | null) {
  if (!bytes || !Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

// Creative Thumbnail Component
// Removido: thumbnail com ações de WhatsApp/Instagram para simplificar a visão principal

// Main Component
export default function CreativesV3() {
  const [searchTerm, setSearchTerm] = useState("");
  const [openCampaignId, setOpenCampaignId] = useState<string | null>(null);
  const { data: creativeData, isLoading, error } = useCreativeLibrary({ days: 30 });
  const { data: campaignsResult } = useCampaigns({ pageSize: 0 });

  // Mapear criativos por campanha (sem duplicações)
  const byCampaign = useMemo(() => {
    const map = new Map<string, { creatives: any[]; sample?: any }>();
    if (!creativeData) return map;
    for (const c of creativeData) {
      for (const campaignId of c.campaignIds) {
        const existing = map.get(campaignId) ?? { creatives: [], sample: undefined };
        if (!existing.creatives.find((x) => x.id === c.id)) {
          existing.creatives.push(c);
        }
        if (!existing.sample && (c.thumbnailUrl || c.storageUrl)) {
          existing.sample = c;
        }
        map.set(campaignId, existing);
      }
    }
    return map;
  }, [creativeData]);

  // Construir cartões de campanhas
  const campaignCards = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    const items: Array<{ id: string; name: string; count: number; sample?: any }> = [];
    for (const [campaignId, info] of byCampaign.entries()) {
      const name = campaignsResult?.campaigns.find((c: any) => c.id === campaignId)?.name ?? "Campanha sem nome";
      const matchesSearch = !search || name.toLowerCase().includes(search);
      if (matchesSearch) {
        items.push({ id: campaignId, name, count: info.creatives.length, sample: info.sample });
      }
    }
    return items.sort((a, b) => b.count - a.count);
  }, [byCampaign, campaignsResult, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Criativos por Campanha</h1>
          <p className="mt-1 text-muted-foreground">Navegue por campanhas, sem criativos repetidos na visão principal.</p>
        </div>
      </div>

      {/* Busca por campanha */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar campanhas..."
          className="pl-10"
        />
      </div>

      {/* Estado de erro */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro ao carregar criativos</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      {/* Grid de campanhas */}
      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="mb-3 h-5 w-2/3" />
                <Skeleton className="h-[140px] sm:h-[160px] md:h-[180px] w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {!isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {campaignCards.map((campaign) => (
            <Card key={campaign.id} className="cursor-pointer" onClick={() => setOpenCampaignId(campaign.id)}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Folder className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium truncate" title={campaign.name}>{campaign.name}</span>
                  </div>
                  <span className="rounded bg-muted px-2 py-0.5 text-xs flex-shrink-0">{campaign.count}</span>
                </div>
                <div className="mt-3">
                  {campaign.sample ? (
                    <MediaThumb
                      thumbnailUrl={campaign.sample.thumbnailUrl}
                      url={campaign.sample.storageUrl}
                      type={campaign.sample.type?.toLowerCase() === "video" ? "video" : "image"}
                      className="h-[140px] sm:h-[160px] md:h-[180px]"
                    />
                  ) : (
                    <div className="h-[140px] sm:h-[160px] md:h-[180px] rounded-md bg-muted" />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de criativos por campanha */}
      {openCampaignId && (
        <CampaignCreativesModal
          open={Boolean(openCampaignId)}
          onOpenChange={(open) => setOpenCampaignId(open ? openCampaignId : null)}
          campaignId={openCampaignId}
          campaignName={campaignCards.find((c) => c.id === openCampaignId)?.name}
          creatives={byCampaign.get(openCampaignId)?.creatives ?? []}
        />
      )}
    </div>
  );
}
