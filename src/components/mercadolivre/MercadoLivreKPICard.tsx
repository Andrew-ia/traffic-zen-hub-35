import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface MercadoLivreKPICardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    trend?: string;
    trendUp?: boolean;
    trendValue?: string;
    iconColor?: "green" | "blue" | "purple" | "orange";
    loading?: boolean;
}

export function MercadoLivreKPICard({
    title,
    value,
    icon: Icon,
    trend,
    trendUp,
    trendValue,
    iconColor = "blue",
    loading
}: MercadoLivreKPICardProps) {

    const getColors = (color: string) => {
        switch (color) {
            case "green": return { bg: "bg-green-500", text: "text-white" };
            case "blue": return { bg: "bg-blue-500", text: "text-white" };
            case "purple": return { bg: "bg-purple-500", text: "text-white" };
            case "orange": return { bg: "bg-orange-500", text: "text-white" };
            default: return { bg: "bg-blue-500", text: "text-white" };
        }
    };

    const colors = getColors(iconColor);

    if (loading) {
        return (
            <Card className="border-none shadow-sm h-[120px]">
                <CardContent className="p-6 h-full flex flex-col justify-between">
                    <div className="h-4 bg-muted animate-pulse rounded w-24" />
                    <div className="flex items-center justify-between">
                        <div className="h-8 bg-muted animate-pulse rounded w-32" />
                        <div className="h-10 w-10 bg-muted animate-pulse rounded-lg" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-none shadow-md bg-white dark:bg-card h-[120px] relative overflow-hidden">
            <CardContent className="p-6 h-full flex flex-col justify-between relative z-10">
                <div className="flex justify-between items-start">
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">{title}</p>
                        <div className="text-2xl font-bold tracking-tight text-foreground">
                            {value}
                        </div>
                    </div>
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center shadow-lg ${colors.bg} ${colors.text}`}>
                        <Icon className="h-5 w-5" />
                    </div>
                </div>

                {trend && (
                    <div className="flex items-center gap-2 text-sm mt-1">
                        <span className={`font-semibold flex items-center ${trendUp ? "text-green-500" : "text-red-500"}`}>
                            {trendUp ? "↑" : "↓"} {trendValue || trend}
                        </span>
                        <span className="text-muted-foreground text-xs">
                            vs. semana anterior
                        </span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
