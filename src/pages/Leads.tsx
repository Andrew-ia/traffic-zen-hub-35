import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, Mail, Phone } from "lucide-react";

const leads = [
  {
    id: 1,
    name: "João Silva",
    email: "joao@email.com",
    phone: "(11) 99999-9999",
    source: "Facebook Ads",
    campaign: "Black Friday",
    status: "Novo",
    value: "R$ 1.200",
    date: "01/11/2025",
  },
  {
    id: 2,
    name: "Maria Santos",
    email: "maria@email.com",
    phone: "(11) 98888-8888",
    source: "Google Ads",
    campaign: "Lançamento Produto X",
    status: "Contatado",
    value: "R$ 850",
    date: "02/11/2025",
  },
  {
    id: 3,
    name: "Pedro Oliveira",
    email: "pedro@email.com",
    phone: "(11) 97777-7777",
    source: "Instagram Ads",
    campaign: "Remarketing",
    status: "Qualificado",
    value: "R$ 2.400",
    date: "03/11/2025",
  },
];

export default function Leads() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Leads e Conversões</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie seus leads e acompanhe conversões
          </p>
        </div>
        <Button>
          <Download className="mr-2 h-4 w-4" />
          Exportar Leads
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total de Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,248</div>
            <p className="text-sm text-success mt-1">+18% vs mês anterior</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Leads Qualificados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">432</div>
            <p className="text-sm text-success mt-1">+12% vs mês anterior</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Taxa de Conversão</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">34.6%</div>
            <p className="text-sm text-success mt-1">+5% vs mês anterior</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Valor Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ 42.8K</div>
            <p className="text-sm text-success mt-1">+22% vs mês anterior</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Leads Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Campanha</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell className="font-medium">{lead.name}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 text-sm">
                      <div className="flex items-center gap-2">
                        <Mail className="h-3 w-3" />
                        {lead.email}
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-3 w-3" />
                        {lead.phone}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{lead.source}</TableCell>
                  <TableCell>{lead.campaign}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        lead.status === "Novo"
                          ? "default"
                          : lead.status === "Contatado"
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {lead.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{lead.value}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {lead.date}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
