import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  Eye,
  Copy,
  Edit,
  Trash2,
  MoreVertical,
  Filter,
  Download,
  Image as ImageIcon,
  Video,
} from "lucide-react";
import { useCampaignLibrary, type CampaignLibraryItem } from "@/hooks/useCampaignLibrary";
import { CampaignDetailsModal } from "@/components/campaigns/CampaignDetailsModal";
import { CampaignFormModal } from "@/components/campaigns/CampaignFormModal";
import { useToast } from "@/hooks/use-toast";

// Default workspace ID (replace with actual workspace management)
const DEFAULT_WORKSPACE_ID = "00000000-0000-0000-0000-000000000010";

export default function CampaignLibrary() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [objectiveFilter, setObjectiveFilter] = useState<string | undefined>();
  const [platformFilter, setPlatformFilter] = useState<string | undefined>();
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignLibraryItem | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<CampaignLibraryItem | null>(null);

  // Memoize filters to prevent infinite loop
  const filters = {
    search: searchQuery,
    status: statusFilter,
    objective: objectiveFilter,
    platform: platformFilter,
  };

  const {
    campaigns,
    loading,
    error,
    fetchCampaigns,
    deleteCampaign,
    copyCampaign,
  } = useCampaignLibrary(DEFAULT_WORKSPACE_ID, filters);

  const handleViewDetails = (campaign: CampaignLibraryItem) => {
    setSelectedCampaign(campaign);
    setIsDetailsOpen(true);
  };

  const handleEdit = (campaign: CampaignLibraryItem) => {
    setEditingCampaign(campaign);
    setIsFormOpen(true);
  };

  const handleCopy = async (campaign: CampaignLibraryItem) => {
    const copied = await copyCampaign(campaign.id, DEFAULT_WORKSPACE_ID);
    if (copied) {
      toast({
        title: "Campanha copiada!",
        description: `"${campaign.name}" foi copiada como rascunho.`,
      });
    } else {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar a campanha.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (campaign: CampaignLibraryItem) => {
    if (!confirm(`Tem certeza que deseja excluir "${campaign.name}"?`)) {
      return;
    }

    const success = await deleteCampaign(campaign.id);
    if (success) {
      toast({
        title: "Campanha excluída",
        description: `"${campaign.name}" foi removida da biblioteca.`,
      });
    } else {
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir a campanha.",
        variant: "destructive",
      });
    }
  };

  const handleCreateNew = () => {
    setEditingCampaign(null);
    setIsFormOpen(true);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingCampaign(null);
    fetchCampaigns();
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
      rascunho: "outline",
      ativo: "default",
      pausado: "secondary",
      arquivado: "destructive",
    };

    const labels: Record<string, string> = {
      rascunho: "Rascunho",
      ativo: "Ativo",
      pausado: "Pausado",
      arquivado: "Arquivado",
    };

    return (
      <Badge variant={variants[status] || "outline"}>
        {labels[status] || status}
      </Badge>
    );
  };

  const getCreativeIcon = (type: string | null) => {
    if (!type) return <ImageIcon className="h-4 w-4 text-muted-foreground" />;

    switch (type) {
      case "video":
        return <Video className="h-4 w-4 text-blue-500" />;
      case "image":
        return <ImageIcon className="h-4 w-4 text-green-500" />;
      default:
        return <ImageIcon className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const formatBudget = (budget: number | null, budgetType: string) => {
    if (!budget) return "-";
    const formatted = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(budget);
    return budgetType === "daily" ? `${formatted}/dia` : formatted;
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Biblioteca de Campanhas</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie templates e planeje suas campanhas de marketing
          </p>
        </div>
        <Button onClick={handleCreateNew}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Campanha
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar campanhas..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select
                value={statusFilter || "todos"}
                onValueChange={(value) => setStatusFilter(value === "todos" ? undefined : value)}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="rascunho">Rascunho</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="pausado">Pausado</SelectItem>
                  <SelectItem value="arquivado">Arquivado</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={objectiveFilter || "todos"}
                onValueChange={(value) => setObjectiveFilter(value === "todos" ? undefined : value)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Objetivo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="Engajamento">Engajamento</SelectItem>
                  <SelectItem value="Mensagens">Mensagens</SelectItem>
                  <SelectItem value="Conversões">Conversões</SelectItem>
                  <SelectItem value="Tráfego">Tráfego</SelectItem>
                  <SelectItem value="Reconhecimento">Reconhecimento</SelectItem>
                  <SelectItem value="Vendas">Vendas</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={platformFilter || "todos"}
                onValueChange={(value) => setPlatformFilter(value === "todos" ? undefined : value)}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Plataforma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  <SelectItem value="Meta">Meta</SelectItem>
                  <SelectItem value="Google">Google</SelectItem>
                  <SelectItem value="TikTok">TikTok</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="text-center py-8 text-muted-foreground">
              Carregando campanhas...
            </div>
          )}

          {error && (
            <div className="text-center py-8 text-destructive">
              Erro ao carregar campanhas: {error}
            </div>
          )}

          {!loading && !error && campaigns.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhuma campanha encontrada.</p>
              <Button onClick={handleCreateNew} variant="outline" className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                Criar primeira campanha
              </Button>
            </div>
          )}

          {!loading && !error && campaigns.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Objetivo</TableHead>
                  <TableHead>Público</TableHead>
                  <TableHead>Orçamento</TableHead>
                  <TableHead>Plataforma</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criativo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell className="font-medium">
                      <div>
                        <div>{campaign.name}</div>
                        {campaign.tags && campaign.tags.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {campaign.tags.slice(0, 2).map((tag) => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                            {campaign.tags.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{campaign.tags.length - 2}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{campaign.objective || "-"}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {campaign.audience || "-"}
                    </TableCell>
                    <TableCell>
                      {formatBudget(campaign.budget, campaign.budget_type)}
                    </TableCell>
                    <TableCell>{campaign.platform}</TableCell>
                    <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getCreativeIcon(campaign.creative_type)}
                        {campaign.creative_url && (
                          <a
                            href={campaign.creative_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline"
                          >
                            Ver
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewDetails(campaign)}>
                            <Eye className="mr-2 h-4 w-4" />
                            Ver Detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEdit(campaign)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleCopy(campaign)}>
                            <Copy className="mr-2 h-4 w-4" />
                            Copiar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(campaign)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      {selectedCampaign && (
        <CampaignDetailsModal
          campaign={selectedCampaign}
          isOpen={isDetailsOpen}
          onClose={() => {
            setIsDetailsOpen(false);
            setSelectedCampaign(null);
          }}
          onCopy={() => handleCopy(selectedCampaign)}
        />
      )}

      <CampaignFormModal
        isOpen={isFormOpen}
        onClose={handleFormClose}
        campaign={editingCampaign}
        workspaceId={DEFAULT_WORKSPACE_ID}
      />
    </div>
  );
}
