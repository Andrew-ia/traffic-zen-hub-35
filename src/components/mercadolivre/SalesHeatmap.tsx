import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "lucide-react";

interface SalesHeatmapProps {
    data: Array<{
        date: string;
        sales: number;
        revenue: number;
    }>;
    loading?: boolean;
}

export function SalesHeatmap({ data, loading }: SalesHeatmapProps) {
    if (loading) {
        return (
            <Card className="border-border/50 shadow-sm">
                <CardHeader className="border-b border-border/50 bg-muted/20">
                    <CardTitle className="text-base font-semibold">Heatmap de Vendas</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                    <Skeleton className="h-64 w-full" />
                </CardContent>
            </Card>
        );
    }

    // Processar dados para criar heatmap
    const heatmapData: { [key: string]: { [key: number]: number } } = {
        "Dom": {},
        "Seg": {},
        "Ter": {},
        "Qua": {},
        "Qui": {},
        "Sex": {},
        "Sáb": {},
    };

    const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

    // Agrupar vendas por dia da semana e hora
    data.forEach((item) => {
        const date = new Date(item.date);
        const dayOfWeek = dayNames[date.getDay()];
        const hour = date.getHours();

        if (!heatmapData[dayOfWeek][hour]) {
            heatmapData[dayOfWeek][hour] = 0;
        }
        heatmapData[dayOfWeek][hour] += item.sales;
    });

    // Encontrar valor máximo para normalização
    let maxSales = 0;
    Object.values(heatmapData).forEach((dayData) => {
        Object.values(dayData).forEach((sales) => {
            if (sales > maxSales) maxSales = sales;
        });
    });

    // Função para obter cor baseada na intensidade
    const getColor = (sales: number) => {
        if (sales === 0) return "bg-muted/20";
        const intensity = sales / maxSales;
        if (intensity > 0.75) return "bg-green-600 dark:bg-green-500";
        if (intensity > 0.5) return "bg-green-500 dark:bg-green-600";
        if (intensity > 0.25) return "bg-green-400 dark:bg-green-700";
        return "bg-green-300 dark:bg-green-800";
    };

    // Horas do dia (0-23)
    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
        <Card className="border-border/50 shadow-sm">
            <CardHeader className="border-b border-border/50 bg-muted/20">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Heatmap de Vendas - Dia da Semana x Hora
                </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
                {data.length > 0 ? (
                    <div className="space-y-4">
                        {/* Legenda */}
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Menos vendas</span>
                            <div className="flex items-center gap-1">
                                <div className="w-4 h-4 rounded bg-muted/20 border border-border/50" />
                                <div className="w-4 h-4 rounded bg-green-300 dark:bg-green-800" />
                                <div className="w-4 h-4 rounded bg-green-400 dark:bg-green-700" />
                                <div className="w-4 h-4 rounded bg-green-500 dark:bg-green-600" />
                                <div className="w-4 h-4 rounded bg-green-600 dark:bg-green-500" />
                            </div>
                            <span>Mais vendas</span>
                        </div>

                        {/* Heatmap Grid */}
                        <div className="overflow-x-auto">
                            <div className="inline-block min-w-full">
                                {/* Header com horas */}
                                <div className="flex items-center mb-2">
                                    <div className="w-12 flex-shrink-0" /> {/* Espaço para labels dos dias */}
                                    <div className="flex gap-0.5">
                                        {hours.map((hour) => (
                                            <div
                                                key={hour}
                                                className="w-6 text-center text-xs text-muted-foreground"
                                                title={`${hour}h`}
                                            >
                                                {hour % 3 === 0 ? hour : ""}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Linhas por dia da semana */}
                                {dayNames.map((day) => (
                                    <div key={day} className="flex items-center mb-0.5">
                                        <div className="w-12 flex-shrink-0 text-xs font-medium text-muted-foreground">
                                            {day}
                                        </div>
                                        <div className="flex gap-0.5">
                                            {hours.map((hour) => {
                                                const sales = heatmapData[day][hour] || 0;
                                                return (
                                                    <div
                                                        key={hour}
                                                        className={`w-6 h-6 rounded ${getColor(sales)} border border-border/20 hover:ring-2 hover:ring-primary/50 transition-all cursor-pointer`}
                                                        title={`${day} ${hour}h: ${sales} ${sales === 1 ? "venda" : "vendas"}`}
                                                    />
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Insights */}
                        <div className="mt-4 pt-4 border-t border-border/50">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div className="p-3 rounded-lg bg-muted/30">
                                    <div className="text-xs text-muted-foreground mb-1">Horário de Pico</div>
                                    <div className="font-semibold">
                                        {(() => {
                                            let maxHour = 0;
                                            let maxHourSales = 0;
                                            hours.forEach((hour) => {
                                                let totalSales = 0;
                                                dayNames.forEach((day) => {
                                                    totalSales += heatmapData[day][hour] || 0;
                                                });
                                                if (totalSales > maxHourSales) {
                                                    maxHourSales = totalSales;
                                                    maxHour = hour;
                                                }
                                            });
                                            return `${maxHour}h - ${maxHour + 1}h`;
                                        })()}
                                    </div>
                                </div>
                                <div className="p-3 rounded-lg bg-muted/30">
                                    <div className="text-xs text-muted-foreground mb-1">Melhor Dia</div>
                                    <div className="font-semibold">
                                        {(() => {
                                            let maxDay = "";
                                            let maxDaySales = 0;
                                            dayNames.forEach((day) => {
                                                let totalSales = 0;
                                                hours.forEach((hour) => {
                                                    totalSales += heatmapData[day][hour] || 0;
                                                });
                                                if (totalSales > maxDaySales) {
                                                    maxDaySales = totalSales;
                                                    maxDay = day;
                                                }
                                            });
                                            return maxDay || "-";
                                        })()}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-64 text-muted-foreground">
                        Dados insuficientes para gerar heatmap
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
