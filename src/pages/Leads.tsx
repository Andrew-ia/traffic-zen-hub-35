import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, RefreshCw, Search, Edit, Trash2, Phone, Mail, Users, UserPlus, UserCheck, User } from "lucide-react";
import { useLeads, useUpdateLead, useDeleteLead, type Lead } from "@/hooks/useLeads";
import { LeadStatusBadge } from "@/components/LeadStatusBadge";
import { LeadEditModal } from "@/components/LeadEditModal";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/useWorkspace";

export default function Leads() {
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspace();
  const [filters, setFilters] = useState({
    status: '',
    origem: '',
    search: '',
    page: 1,
    limit: 20,
  });
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);

  const workspaceId = currentWorkspace?.id ?? null;
  const { data, isLoading, refetch } = useLeads(workspaceId, filters);
  const updateLead = useUpdateLead(workspaceId);
  const deleteLead = useDeleteLead(workspaceId);

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    try {
      await updateLead.mutateAsync({ id: leadId, data: { status: newStatus } });
      toast({
        title: "Status atualizado",
        description: "O status do lead foi atualizado com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao atualizar o status do lead.",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (lead: Lead) => {
    setSelectedLead(lead);
    setEditModalOpen(true);
  };

  const handleSave = async (id: string, data: Partial<Lead>) => {
    try {
      await updateLead.mutateAsync({ id, data });
      toast({
        title: "Lead atualizado",
        description: "As informações do lead foram atualizadas com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao atualizar o lead.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (leadId: string) => {
    if (!confirm("Tem certeza que deseja excluir este lead?")) return;

    try {
      await deleteLead.mutateAsync(leadId);
      toast({
        title: "Lead excluído",
        description: "O lead foi excluído com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao excluir o lead.",
        variant: "destructive",
      });
    }
  };

  const handleExport = () => {
    if (!data?.data) return;

    const csv = [
      ['Nome', 'Email', 'WhatsApp', 'Empresa', 'Status', 'Origem', 'Investimento', 'Data'].join(','),
      ...data.data.map(lead => [
        lead.name,
        lead.email || '',
        lead.whatsapp,
        lead.company,
        lead.status,
        lead.origem || '',
        lead.traffic_investment || '',
        new Date(lead.created_at).toLocaleDateString('pt-BR'),
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const stats = {
    total: data?.pagination.total || 0,
    new: data?.data.filter(l => l.status === 'new').length || 0,
    qualified: data?.data.filter(l => l.status === 'qualificado').length || 0,
    clients: data?.data.filter(l => l.status === 'cliente').length || 0,
  };

  if (!workspaceId) {
    return (
      <div className="space-y-4">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">CRM - Leads</h1>
        <p className="text-muted-foreground">
          Selecione um workspace no topo para carregar os leads do cliente.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight flex items-center">CRM - Leads</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Gerencie seus leads e acompanhe o funil de vendas
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} className="shadow-sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
          <Button onClick={handleExport} className="shadow-md hover:shadow-lg transition-all">
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card className="border-border/50 shadow-sm hover:shadow-md transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Leads</CardTitle>
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Users className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">{stats.total}</div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm hover:shadow-md transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Novos</CardTitle>
            <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <UserPlus className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-blue-600 dark:text-blue-400">{stats.new}</div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm hover:shadow-md transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Qualificados</CardTitle>
            <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400">
              <UserCheck className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-green-600 dark:text-green-400">{stats.qualified}</div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm hover:shadow-md transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Clientes</CardTitle>
            <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <User className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-purple-600 dark:text-purple-400">{stats.clients}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, email..."
                className="pl-10 h-10"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
              />
            </div>

            <Select
              value={filters.status || 'all'}
              onValueChange={(value) => setFilters({ ...filters, status: value === 'all' ? '' : value, page: 1 })}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="new">Novo</SelectItem>
                <SelectItem value="em_contato">Em Contato</SelectItem>
                <SelectItem value="qualificado">Qualificado</SelectItem>
                <SelectItem value="perdido">Perdido</SelectItem>
                <SelectItem value="cliente">Cliente</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.origem || 'all'}
              onValueChange={(value) => setFilters({ ...filters, origem: value === 'all' ? '' : value, page: 1 })}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Todas as origens" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="landing">Landing Page</SelectItem>
                <SelectItem value="facebook">Facebook</SelectItem>
                <SelectItem value="google">Google</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="organico">Orgânico</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.limit.toString()}
              onValueChange={(value) => setFilters({ ...filters, limit: parseInt(value), page: 1 })}
            >
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 por página</SelectItem>
                <SelectItem value="20">20 por página</SelectItem>
                <SelectItem value="50">50 por página</SelectItem>
                <SelectItem value="100">100 por página</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Leads Table */}
      <Card className="border-border/50 shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/30 border-b border-border/50">
          <CardTitle className="text-lg">Leads ({data?.pagination.total || 0})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Carregando leads...</div>
          ) : !data?.data.length ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum lead encontrado com os filtros atuais.
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border/50">
                    <TableHead className="w-[200px]">Nome</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Investimento</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.map((lead) => (
                    <TableRow key={lead.id} className="cursor-pointer hover:bg-muted/30 border-border/50 transition-colors">
                      <TableCell className="font-medium text-foreground">{lead.name}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                          {lead.email && (
                            <div className="flex items-center gap-2">
                              <Mail className="h-3 w-3" />
                              {lead.email}
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Phone className="h-3 w-3" />
                            {lead.whatsapp}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{lead.company}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                          {lead.origem || 'N/A'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={lead.status}
                          onValueChange={(value) => handleStatusChange(lead.id, value)}
                        >
                          <SelectTrigger className="w-[140px] h-8 border-none bg-transparent shadow-none p-0 hover:bg-transparent focus:ring-0">
                            <SelectValue>
                              <LeadStatusBadge status={lead.status} />
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new">Novo</SelectItem>
                            <SelectItem value="em_contato">Em Contato</SelectItem>
                            <SelectItem value="qualificado">Qualificado</SelectItem>
                            <SelectItem value="perdido">Perdido</SelectItem>
                            <SelectItem value="cliente">Cliente</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium text-muted-foreground">
                          {lead.traffic_investment || '-'}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            onClick={() => handleEdit(lead)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDelete(lead.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {data.pagination.pages > 1 && (
                <div className="flex items-center justify-between p-4 border-t border-border/50">
                  <div className="text-sm text-muted-foreground">
                    Página {data.pagination.page} de {data.pagination.pages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={data.pagination.page === 1}
                      onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
                      className="h-8"
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={data.pagination.page === data.pagination.pages}
                      onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                      className="h-8"
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <LeadEditModal
        lead={selectedLead}
        open={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setSelectedLead(null);
        }}
        onSave={handleSave}
      />
    </div>
  );
}
