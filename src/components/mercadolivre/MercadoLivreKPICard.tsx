import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface MercadoLivreKPICardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    trend?: string;
    trendUp?: boolean;
    trendValue?: string;
    iconColor?: "primary" | "info" | "success" | "warning" | "muted";
    loading?: boolean;
}

export function MercadoLivreKPICard({
    title,
    value,
    icon: Icon,
    trend,
    trendUp,
    trendValue,
    iconColor = "primary",
    loading
}: MercadoLivreKPICardProps) {

    const iconStyles: Record<NonNullable<MercadoLivreKPICardProps["iconColor"]>, { bg: string; text: string }> = {
        primary: { bg: "bg-primary/10", text: "text-primary" },
        info: { bg: "bg-info/10", text: "text-info" },
        success: { bg: "bg-success/10", text: "text-success" },
        warning: { bg: "bg-warning/10", text: "text-warning" },
        muted: { bg: "bg-muted/40", text: "text-muted-foreground" },
    };

    const colors = iconStyles[iconColor];

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
        <Card className="border-border/40 bg-card/50 shadow-md h-[120px] relative overflow-hidden">
            <CardContent className="p-6 h-full flex flex-col justify-between relative z-10">
                <div className="flex justify-between items-start">
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">{title}</p>
                        <div className="text-2xl font-bold tracking-tight text-foreground">
                            {value}
                        </div>
                    </div>
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center ring-1 ring-border/40 ${colors.bg} ${colors.text}`}>
                        <Icon className="h-5 w-5" />
                    </div>
                </div>

                {trend && (
                    <div className="flex items-center gap-2 text-sm mt-1">
                        <span className={`font-semibold flex items-center ${trendUp ? "text-success" : "text-destructive"}`}>
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
