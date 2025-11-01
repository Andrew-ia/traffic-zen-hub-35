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
  dailyBudget?: number | null;
  lifetimeBudget?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  updatedAt?: string | null;
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
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <CardTitle>{title}</CardTitle>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {headerActions}
          {showCreateButton && <Button>Nova Campanha</Button>}
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Conta</TableHead>
              <TableHead>Objetivo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Orçamento Diário</TableHead>
              <TableHead>Orçamento Vitalício</TableHead>
              <TableHead>Início</TableHead>
              <TableHead>Término</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                  Carregando campanhas...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && !hasData && (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                  Nenhuma campanha encontrada para esta conta.
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              hasData &&
              campaigns.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell className="font-medium">{campaign.name}</TableCell>
                  <TableCell>{campaign.platformAccount ?? "-"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{campaign.objective ?? "-"}</TableCell>
                  <TableCell>
                    <Badge variant={campaign.status.toLowerCase() === "active" ? "default" : "secondary"}>
                      {formatStatus(campaign.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatCurrency(campaign.dailyBudget)}</TableCell>
                  <TableCell>{formatCurrency(campaign.lifetimeBudget)}</TableCell>
                  <TableCell>{formatDate(campaign.startDate)}</TableCell>
                  <TableCell>{formatDate(campaign.endDate)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        {campaign.status.toLowerCase() === "active" ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover">
                          <DropdownMenuItem onSelect={() => navigate(`/campaigns/${campaign.id}`)}>
                            Visualizar
                          </DropdownMenuItem>
                          <DropdownMenuItem>Duplicar</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">Arquivar</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>

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
