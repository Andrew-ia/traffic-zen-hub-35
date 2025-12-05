import { type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, Pause, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getCampaignObjectiveLabel } from "@/constants/campaignObjectives";

export interface CampaignTableRow {
  id: string;
  name: string;
  status: string;
  objective?: string | null;
  platformAccount?: string | null;
  platformKey?: string | null;
  dailyBudget?: number | null;
  lifetimeBudget?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  updatedAt?: string | null;

  // KPI metrics based on objective
  resultLabel?: string;
  resultValue?: number;
  costPerResult?: number | null;
  spend?: number;
  roas?: number | null;
  instagramFollows?: number;
}

interface CampaignsTableProps {
  campaigns: CampaignTableRow[];
  isLoading?: boolean;
  title?: string;
  headerActions?: ReactNode;
  showCreateButton?: boolean;
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
}

function formatCurrency(value?: number | null, currency = "BRL") {
  if (value === null || value === undefined) return "-";
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return value.toFixed(0);
  }
}

function formatStatus(status: string) {
  switch (status.toLowerCase()) {
    case "active":
      return "Ativa";
    case "paused":
      return "Pausada";
    case "archived":
      return "Arquivada";
    case "completed":
      return "Concluída";
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const [datePart] = value.split("T");
  const match = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatPlatform(platformKey?: string | null) {
  switch (platformKey) {
    case "meta":
      return "Meta Ads";
    case "google_ads":
      return "Google Ads";
    default:
      return platformKey ?? "-";
  }
}

function getPlatformBadgeVariant(platformKey?: string | null): "default" | "secondary" | "outline" {
  switch (platformKey) {
    case "meta":
      return "default";
    case "google_ads":
      return "outline";
    default:
      return "secondary";
  }
}

export function CampaignsTable({
  campaigns,
  isLoading,
  title = "Campanhas",
  headerActions,
  showCreateButton = false,
  page,
  pageSize,
  total,
  onPageChange,
}: CampaignsTableProps) {
  const hasData = campaigns.length > 0;
  const hasPagination = Boolean(pageSize && total && total > (pageSize ?? 0));
  const currentPage = page ?? 1;
  const resolvedPageSize = (pageSize ?? campaigns.length) || 1;
  const totalItems = total ?? campaigns.length;
  const totalPages = hasPagination ? Math.ceil(totalItems / resolvedPageSize) : 1;
  const fromItem = hasPagination ? (currentPage - 1) * resolvedPageSize + 1 : 1;
  const toItem = hasPagination ? Math.min(currentPage * resolvedPageSize, totalItems) : campaigns.length;

  const navigate = useNavigate();

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between pb-4 border-b border-border/50 bg-muted/20">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {headerActions}
          {showCreateButton && <Button className="w-full sm:w-auto shadow-sm">Nova Campanha</Button>}
        </div>
      </CardHeader>
      <CardContent className="p-0 sm:p-6">
        {/* Container responsivo sem forçar largura mínima */}
        <div className="overflow-x-auto -mx-2">
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px] px-2">Nome</TableHead>
                <TableHead className="w-[100px] px-2">Conta</TableHead>
                <TableHead className="hidden sm:table-cell w-[100px] px-2">Objetivo</TableHead>
                <TableHead className="w-[70px] px-2">Status</TableHead>
                <TableHead className="hidden md:table-cell w-[80px] px-2">Resultado</TableHead>
                <TableHead className="text-right hidden md:table-cell w-[60px] px-2">Qtd</TableHead>
                <TableHead className="text-right hidden lg:table-cell w-[70px] px-2">Seguid.</TableHead>
                <TableHead className="text-right w-[80px] px-2">Invest.</TableHead>
                <TableHead className="text-right hidden lg:table-cell w-[70px] px-2">Custo/R</TableHead>
                <TableHead className="text-right hidden lg:table-cell w-[60px] px-2">ROAS</TableHead>
                <TableHead className="text-right w-[50px] px-2">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                    Carregando campanhas...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && !hasData && (
                <TableRow>
                  <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                    Nenhuma campanha encontrada para esta conta.
                  </TableCell>
                </TableRow>
              )}
              {!isLoading &&
                hasData &&
                campaigns.map((campaign) => (
                  <TableRow
                    key={campaign.id}
                    onClick={() => navigate(`/campaigns/${campaign.id}`)}
                    className="cursor-pointer transition hover:bg-muted/50"
                  >
                    <TableCell className="px-2">
                      <div className="font-medium text-xs truncate">{campaign.name}</div>
                    </TableCell>
                    <TableCell className="px-2">
                      <div className="flex flex-col gap-0.5">
                        <Badge
                          variant={getPlatformBadgeVariant(campaign.platformKey)}
                          className="text-[9px] px-1 py-0 w-fit"
                        >
                          {formatPlatform(campaign.platformKey)}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground truncate">
                          {campaign.platformAccount ?? "-"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell px-2">
                      <span className="text-[10px] truncate block">{getCampaignObjectiveLabel(campaign.objective) || "-"}</span>
                    </TableCell>
                    <TableCell className="px-2">
                      <Badge
                        variant={campaign.status.toLowerCase() === "active" ? "default" : "secondary"}
                        className="text-[9px] px-1 py-0"
                      >
                        {formatStatus(campaign.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell px-2">
                      <span className="text-[10px] truncate block">{campaign.resultLabel ?? "Resultados"}</span>
                    </TableCell>
                    <TableCell className="text-right hidden md:table-cell px-2">
                      <span className="text-[10px]">
                        {campaign.resultValue != null ? new Intl.NumberFormat("pt-BR").format(campaign.resultValue) : "-"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right hidden lg:table-cell px-2">
                      <span className="text-[10px]">
                        {campaign.instagramFollows != null && campaign.instagramFollows > 0
                          ? new Intl.NumberFormat("pt-BR").format(campaign.instagramFollows)
                          : "-"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right px-2">
                      <span className="text-[11px] font-medium">{formatCurrency(campaign.spend)}</span>
                    </TableCell>
                    <TableCell className="text-right hidden lg:table-cell px-2">
                      <span className="text-[10px]">{formatCurrency(campaign.costPerResult)}</span>
                    </TableCell>
                    <TableCell className="text-right hidden lg:table-cell px-2">
                      <span className="text-[10px] font-medium">
                        {campaign.roas != null ? `${campaign.roas.toFixed(2)}x` : "-"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right px-1" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-6 w-6 p-0">
                            <span className="sr-only">Abrir menu</span>
                            <MoreVertical className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => navigate(`/campaigns/${campaign.id}`)}>
                            Ver detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem>Editar</DropdownMenuItem>
                          <DropdownMenuItem>Pausar</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>

        {hasPagination && (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Mostrando {fromItem}-{toItem} de {totalItems} campanhas
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange?.(currentPage - 1)}
                disabled={currentPage <= 1 || !onPageChange}
              >
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground">
                Página {currentPage} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange?.(currentPage + 1)}
                disabled={currentPage >= totalPages || !onPageChange}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
