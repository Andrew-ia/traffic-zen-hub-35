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
import { MoreVertical, Play, Pause } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const campaigns = [
  {
    id: 1,
    name: "Campanha Black Friday",
    status: "Ativa",
    budget: "R$ 5.000",
    spent: "R$ 3.200",
    impressions: "125.5K",
    clicks: "4.2K",
    conversions: "156",
    ctr: "3.35%",
  },
  {
    id: 2,
    name: "Lançamento Produto X",
    status: "Ativa",
    budget: "R$ 3.000",
    spent: "R$ 2.100",
    impressions: "89.2K",
    clicks: "2.8K",
    conversions: "98",
    ctr: "3.14%",
  },
  {
    id: 3,
    name: "Remarketing Site",
    status: "Pausada",
    budget: "R$ 2.000",
    spent: "R$ 890",
    impressions: "45.1K",
    clicks: "1.2K",
    conversions: "45",
    ctr: "2.66%",
  },
];

export function CampaignsTable() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Campanhas Ativas</CardTitle>
        <Button>Nova Campanha</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Orçamento</TableHead>
              <TableHead>Gasto</TableHead>
              <TableHead>Impressões</TableHead>
              <TableHead>Cliques</TableHead>
              <TableHead>Conversões</TableHead>
              <TableHead>CTR</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.map((campaign) => (
              <TableRow key={campaign.id}>
                <TableCell className="font-medium">{campaign.name}</TableCell>
                <TableCell>
                  <Badge
                    variant={campaign.status === "Ativa" ? "default" : "secondary"}
                  >
                    {campaign.status}
                  </Badge>
                </TableCell>
                <TableCell>{campaign.budget}</TableCell>
                <TableCell>{campaign.spent}</TableCell>
                <TableCell>{campaign.impressions}</TableCell>
                <TableCell>{campaign.clicks}</TableCell>
                <TableCell>{campaign.conversions}</TableCell>
                <TableCell>{campaign.ctr}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                    >
                      {campaign.status === "Ativa" ? (
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
                        <DropdownMenuItem>Editar</DropdownMenuItem>
                        <DropdownMenuItem>Duplicar</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
