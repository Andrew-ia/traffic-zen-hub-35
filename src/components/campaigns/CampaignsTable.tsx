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
    <Card>
      <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <CardTitle className="text-lg sm:text-xl">{title}</CardTitle>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {headerActions}
          {showCreateButton && <Button className="w-full sm:w-auto">Nova Campanha</Button>}
        </div>
      </CardHeader>
      <CardContent className="p-0 sm:p-6">
        {/* Container responsivo sem forçar largura mínima */}
        <div className="overflow-x-auto">
          <Table className="w-full">
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Conta</TableHead>
                <TableHead className="hidden sm:table-cell">Objetivo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Resultado</TableHead>
                <TableHead className="text-right hidden md:table-cell">Qtd</TableHead>
                <TableHead className="text-right">Investimento</TableHead>
                <TableHead className="text-right hidden lg:table-cell">Custo/Resultado</TableHead>
                <TableHead className="text-right hidden lg:table-cell">ROAS</TableHead>
                <TableHead className="text-right">Ações</TableHead>
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
                  <TableCell>
                    <div className="font-medium text-sm sm:text-base">{campaign.name}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={getPlatformBadgeVariant(campaign.platformKey)}
                        className="text-[10px] sm:text-xs px-1.5 py-0.5"
                      >
                        {formatPlatform(campaign.platformKey)}
                      </Badge>
                      <span className="text-xs sm:text-sm text-muted-foreground truncate">
                        {campaign.platformAccount ?? "-"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <span className="text-sm">{campaign.objective ?? "-"}</span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={campaign.status.toLowerCase() === "active" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {formatStatus(campaign.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span className="text-sm">{campaign.resultLabel ?? "Resultados"}</span>
                  </TableCell>
                  <TableCell className="text-right hidden md:table-cell">
                    <span className="text-sm">
                      {campaign.resultValue != null ? new Intl.NumberFormat("pt-BR").format(campaign.resultValue) : "-"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-sm font-medium">{formatCurrency(campaign.spend)}</span>
                  </TableCell>
                  <TableCell className="text-right hidden lg:table-cell">
                    <span className="text-sm">{formatCurrency(campaign.costPerResult)}</span>
                  </TableCell>
                  <TableCell className="text-right hidden lg:table-cell">
                    <span className="text-sm font-medium">
                      {campaign.roas != null ? `${campaign.roas.toFixed(2)}x` : "-"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-7 w-7 sm:h-8 sm:w-8 p-0">
                          <span className="sr-only">Abrir menu</span>
                          <MoreVertical className="h-3 w-3 sm:h-4 sm:w-4" />
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
