import React, { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MediaThumb } from "./MediaThumb";
import { type CreativeOverview } from "@/hooks/useCreativeLibrary";
import { Search } from "lucide-react";

interface CampaignCreativesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  campaignName?: string;
  creatives: CreativeOverview[];
}

export function CampaignCreativesModal({ open, onOpenChange, campaignId, campaignName, creatives }: CampaignCreativesModalProps) {
  const [activeTab, setActiveTab] = useState<"images" | "videos">("images");
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState<string | null>(null);

  const uniqueCreatives = useMemo(() => {
    const map = new Map<string, CreativeOverview>();
    for (const c of creatives) {
      if (!map.has(c.id)) map.set(c.id, c);
    }
    return Array.from(map.values());
  }, [creatives]);

  const platforms = useMemo(() => {
    const set = new Set<string>();
    for (const c of uniqueCreatives) {
      for (const p of c.metrics.platforms) set.add(p);
    }
    return Array.from(set.values());
  }, [uniqueCreatives]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return uniqueCreatives.filter((c) => {
      const matchesType = activeTab === "images"
        ? (c.type?.toLowerCase() === "image")
        : (c.type?.toLowerCase() === "video" && Boolean(c.storageUrl));
      const matchesSearch = !term || c.name.toLowerCase().includes(term) || (c.textContent ?? "").toLowerCase().includes(term);
      const matchesPlatform = !platformFilter || c.metrics.platforms.includes(platformFilter);
      return matchesType && matchesSearch && matchesPlatform;
    });
  }, [uniqueCreatives, activeTab, search, platformFilter]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px]">
        <DialogHeader>
          <DialogTitle>
            {campaignName ?? "Campanha"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:w-1/2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar criativos da campanha"
                className="pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {platforms.map((p) => (
                <Badge
                  key={p}
                  variant={platformFilter === p ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setPlatformFilter(platformFilter === p ? null : p)}
                >
                  {p}
                </Badge>
              ))}
              {platforms.length === 0 && (
                <Badge variant="outline">Sem plataforma</Badge>
              )}
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList>
              <TabsTrigger value="images">Imagens</TabsTrigger>
              <TabsTrigger value="videos">Vídeos</TabsTrigger>
            </TabsList>

            <TabsContent value="images">
              <ScrollArea className="max-h-[60vh]">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {filtered.map((c) => (
                    <MediaThumb
                      key={c.id}
                      thumbnailUrl={c.thumbnailUrl}
                      url={c.storageUrl}
                      type={c.type?.toLowerCase() === "video" ? "video" : "image"}
                      alt={c.name}
                      className="h-[120px] sm:h-[160px] md:h-[180px]"
                    />
                  ))}
                  {filtered.length === 0 && (
                    <p className="col-span-full text-center text-sm text-muted-foreground py-6">Nenhuma imagem encontrada para os filtros.</p>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="videos">
              <ScrollArea className="max-h-[60vh]">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {filtered.map((c) => (
                    <MediaThumb
                      key={c.id}
                      thumbnailUrl={c.thumbnailUrl}
                      url={c.storageUrl}
                      type="video"
                      alt={c.name}
                      className="h-[160px] sm:h-[180px] md:h-[200px]"
                    />
                  ))}
                  {filtered.length === 0 && (
                    <p className="col-span-full text-center text-sm text-muted-foreground py-6">Nenhum vídeo encontrado para os filtros.</p>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>

          <div className="text-xs text-muted-foreground">
            Campanha ID: {campaignId}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
