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
    color?: string;
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
    color = "blue",
    loading
}: PremiumKPICardProps) {
    const colorClasses: Record<string, string> = {
        blue: "text-[#3483FA] bg-[#3483FA]/10",
        green: "text-[#00A650] bg-[#00A650]/10",
        orange: "text-[#FF7733] bg-[#FF7733]/10",
        purple: "text-[#A855F7] bg-[#A855F7]/10",
        yellow: "text-[#FFD100] bg-[#FFD100]/10",
        red: "text-[#F52F41] bg-[#F52F41]/10",
    };

    const gradientColors: Record<string, string> = {
        blue: "#3483FA",
        green: "#00A650",
        orange: "#FF7733",
        purple: "#A855F7",
        yellow: "#FFD100",
        red: "#F52F41",
    };

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
                    <div className={`p-2.5 rounded-xl ${colorClasses[color]} ring-1 ring-white/10`}>
                        <Icon className="h-5 w-5" />
                    </div>
                </div>

                <div className="space-y-1">
                    <h3 className="text-3xl font-bold tracking-tight">{value}</h3>
                    {trend && (
                        <div className="flex items-center gap-1.5 pt-1">
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${trendUp ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"}`}>
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
                            <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={gradientColors[color]} stopOpacity={0.8} />
                                <stop offset="95%" stopColor={gradientColors[color]} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <Area
                            type="monotone"
                            dataKey="value"
                            stroke={gradientColors[color]}
                            strokeWidth={2}
                            fillOpacity={1}
                            fill={`url(#gradient-${color})`}
                            isAnimationActive={true}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
}
