import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";

interface ExportReportButtonProps {
    workspaceId: string;
    dateRangeDays: string;
    dateFrom?: string;
    dateTo?: string;
}

export function ExportReportButton({ workspaceId, dateRangeDays, dateFrom, dateTo }: ExportReportButtonProps) {
    const [isExporting, setIsExporting] = useState(false);

    const buildParams = () => {
        const params = new URLSearchParams({
            workspaceId,
            days: dateRangeDays,
        });
        if (dateFrom) params.append("dateFrom", dateFrom);
        if (dateTo) params.append("dateTo", dateTo);
        return params.toString();
    };

    const handleExportPDF = async () => {
        setIsExporting(true);
        try {
            const response = await fetch(`/api/integrations/mercadolivre/export/pdf?${buildParams()}`);

            if (!response.ok) {
                throw new Error("Falha ao exportar PDF");
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `relatorio-mercadolivre-${new Date().toISOString().split("T")[0]}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            toast({
                title: "Relatório exportado!",
                description: "O PDF foi baixado com sucesso.",
            });
        } catch (error) {
            toast({
                title: "Erro ao exportar",
                description: "Não foi possível gerar o relatório PDF.",
                variant: "destructive",
            });
        } finally {
            setIsExporting(false);
        }
    };

    const handleExportExcel = async () => {
        setIsExporting(true);
        try {
            const response = await fetch(`/api/integrations/mercadolivre/export/excel?${buildParams()}`);

            if (!response.ok) {
                throw new Error("Falha ao exportar Excel");
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `relatorio-mercadolivre-${new Date().toISOString().split("T")[0]}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            toast({
                title: "Relatório exportado!",
                description: "O Excel foi baixado com sucesso.",
            });
        } catch (error) {
            toast({
                title: "Erro ao exportar",
                description: "Não foi possível gerar o relatório Excel.",
                variant: "destructive",
            });
        } finally {
            setIsExporting(false);
        }
    };

    const handleExportCSV = () => {
        const params = new URLSearchParams(buildParams());
        params.set("mlFeePercent", String(16.5));
        params.set("taxPercent", String(0));
        params.set("packagingCost", String(0));
        params.set("shippingCostPerOrder", String(0));
        const url = `/api/integrations/mercadolivre/export/csv?${params.toString()}`;
        window.open(url, "_blank");

        toast({
            title: "Exportando CSV...",
            description: "O arquivo será baixado em breve.",
        });
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    disabled={isExporting}
                >
                    {isExporting ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Exportando...
                        </>
                    ) : (
                        <>
                            <Download className="h-4 w-4" />
                            Exportar Relatório
                        </>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Formato do Relatório</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleExportPDF} disabled={isExporting}>
                    <FileText className="h-4 w-4 mr-2" />
                    Exportar como PDF
                    <span className="ml-auto text-xs text-muted-foreground">Resumo</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportExcel} disabled={isExporting}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Exportar como Excel
                    <span className="ml-auto text-xs text-muted-foreground">Completo</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportCSV} disabled={isExporting}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Exportar como CSV
                    <span className="ml-auto text-xs text-muted-foreground">Dados brutos</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
