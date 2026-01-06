import { Card } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

interface PremiumKPICardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    trend?: string;
    trendUp?: boolean;
    chartData?: any[];
    tone?: "primary" | "info" | "success" | "warning" | "danger" | "muted";
    loading?: boolean;
}

export function PremiumKPICard({
    title,
    value,
    icon: Icon,
    trend,
    trendUp,
    chartData = [
        { value: 400 },
        { value: 300 },
        { value: 500 },
        { value: 450 },
        { value: 600 },
        { value: 550 },
        { value: 700 },
    ],
    tone = "primary",
    loading
}: PremiumKPICardProps) {
    const toneStyles: Record<NonNullable<PremiumKPICardProps["tone"]>, { text: string; bg: string; stroke: string }> = {
        primary: { text: "text-primary", bg: "bg-primary/10", stroke: "hsl(var(--chart-1))" },
        info: { text: "text-info", bg: "bg-info/10", stroke: "hsl(var(--chart-2))" },
        success: { text: "text-success", bg: "bg-success/10", stroke: "hsl(var(--success))" },
        warning: { text: "text-warning", bg: "bg-warning/10", stroke: "hsl(var(--warning))" },
        danger: { text: "text-destructive", bg: "bg-destructive/10", stroke: "hsl(var(--destructive))" },
        muted: { text: "text-muted-foreground", bg: "bg-muted/40", stroke: "hsl(var(--muted-foreground))" },
    };
    const palette = toneStyles[tone];

    if (loading) {
        return (
            <Card className="p-6 overflow-hidden border-border/40 bg-card/50 backdrop-blur-sm">
                <div className="flex justify-between items-start mb-4">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-10 w-10 rounded-xl" />
                </div>
                <Skeleton className="h-8 w-32 mb-2" />
                <Skeleton className="h-4 w-20" />
            </Card>
        );
    }

    return (
        <Card className="relative p-6 overflow-hidden border-border/40 bg-card/50 backdrop-blur-md shadow-lg transition-all duration-300 hover:shadow-xl hover:translate-y-[-2px] group">
            {/* Background Pattern */}
            <div className="absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 bg-gradient-to-br from-primary/5 to-transparent rounded-full blur-3xl group-hover:from-primary/10 transition-colors" />

            <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                    <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
                    <div className={`p-2.5 rounded-xl ${palette.bg} ${palette.text} ring-1 ring-border/60`}>
                        <Icon className="h-5 w-5" />
                    </div>
                </div>

                <div className="space-y-1">
                    <h3 className="text-3xl font-bold tracking-tight">{value}</h3>
                    {trend && (
                        <div className="flex items-center gap-1.5 pt-1">
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${trendUp ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                                {trendUp ? "+" : ""}{trend}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">vs período anterior</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Mini Chart */}
            <div className="absolute inset-x-0 bottom-0 h-16 opacity-30 group-hover:opacity-50 transition-opacity">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                        <defs>
                            <linearGradient id={`gradient-${tone}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={palette.stroke} stopOpacity={0.8} />
                                <stop offset="95%" stopColor={palette.stroke} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <Area
                            type="monotone"
                            dataKey="value"
                            stroke={palette.stroke}
                            strokeWidth={2}
                            fillOpacity={1}
                            fill={`url(#gradient-${tone})`}
                            isAnimationActive={true}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
}
