import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Calendar } from "lucide-react";

interface PlatformFiltersProps {
  dateRange: string;
  onDateRangeChange: (value: string) => void;
  accountFilter: string;
  onAccountFilterChange: (value: string) => void;
  accounts?: Array<{ id: string; name: string }>;
  additionalFilter?: {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    options: Array<{ value: string; label: string }>;
  };
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
}

export function PlatformFilters({
  dateRange,
  onDateRangeChange,
  accountFilter,
  onAccountFilterChange,
  accounts = [],
  additionalFilter,
  statusFilter,
  onStatusFilterChange,
  search,
  onSearchChange,
  searchPlaceholder = "Buscar campanhas...",
}: PlatformFiltersProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Período */}
          <Select value={dateRange} onValueChange={onDateRangeChange}>
            <SelectTrigger>
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Hoje</SelectItem>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="15">Últimos 15 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>

          {/* Conta */}
          <Select value={accountFilter} onValueChange={onAccountFilterChange}>
            <SelectTrigger>
              <SelectValue placeholder="Conta de anúncios" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as contas</SelectItem>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Filtro Adicional (Objetivo ou Tipo de Campanha) */}
          {additionalFilter && (
            <Select value={additionalFilter.value} onValueChange={additionalFilter.onChange}>
              <SelectTrigger>
                <SelectValue placeholder={additionalFilter.placeholder} />
              </SelectTrigger>
              <SelectContent>
                {additionalFilter.options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Status */}
          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativas</SelectItem>
              <SelectItem value="paused">Pausadas</SelectItem>
              <SelectItem value="archived">Arquivadas</SelectItem>
            </SelectContent>
          </Select>

          {/* Busca */}
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
