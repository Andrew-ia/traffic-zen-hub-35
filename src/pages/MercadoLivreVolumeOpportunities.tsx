import { useNavigate } from "react-router-dom";
import { Flame, FileText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SalesBoostBoard } from "@/components/mercadolivre/SalesBoostBoard";
import { useWorkspace } from "@/hooks/useWorkspace";

export default function MercadoLivreVolumeOpportunities() {
    const navigate = useNavigate();
    const { currentWorkspace } = useWorkspace();
    const workspaceId = currentWorkspace?.id || null;

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                            <Flame className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold">Oportunidades de Volume</h1>
                            <p className="text-sm text-muted-foreground">
                                Itens com alta visita e baixa conversão para acelerar vendas.
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Dica: se o Mercado Livre abrir com erro, use “Copiar link” e cole em aba anônima.
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => navigate("/mercado-livre/relatorio-executivo")}
                    >
                        <FileText className="h-4 w-4 mr-2" />
                        Relatório Executivo
                    </Button>
                    <Button variant="outline" onClick={() => navigate("/mercado-livre-analyzer")}
                    >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Analisador MLB
                    </Button>
                </div>
            </div>

            <SalesBoostBoard workspaceId={workspaceId} limit={20} showFilters />
        </div>
    );
}
