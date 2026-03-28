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
    const toneStyles: Record<NonNullable<PremiumKPICardProps["tone"]>, { text: string; bg: string; stroke: string; glow: string; ring: string; line: string }> = {
        primary: { text: "text-blue-700", bg: "bg-blue-50", stroke: "hsl(var(--chart-1))", glow: "from-blue-300/25 via-blue-200/10 to-transparent", ring: "ring-blue-100", line: "from-blue-600 via-sky-400 to-transparent" },
        info: { text: "text-cyan-700", bg: "bg-cyan-50", stroke: "hsl(var(--chart-2))", glow: "from-cyan-300/20 via-cyan-200/10 to-transparent", ring: "ring-cyan-100", line: "from-cyan-600 via-sky-400 to-transparent" },
        success: { text: "text-emerald-700", bg: "bg-emerald-50", stroke: "hsl(var(--success))", glow: "from-emerald-300/20 via-emerald-200/10 to-transparent", ring: "ring-emerald-100", line: "from-emerald-600 via-emerald-300 to-transparent" },
        warning: { text: "text-amber-700", bg: "bg-amber-50", stroke: "hsl(var(--warning))", glow: "from-amber-300/20 via-amber-200/10 to-transparent", ring: "ring-amber-100", line: "from-amber-500 via-yellow-300 to-transparent" },
        danger: { text: "text-rose-700", bg: "bg-rose-50", stroke: "hsl(var(--destructive))", glow: "from-rose-300/20 via-rose-200/10 to-transparent", ring: "ring-rose-100", line: "from-rose-600 via-pink-300 to-transparent" },
        muted: { text: "text-slate-600", bg: "bg-slate-100", stroke: "hsl(var(--muted-foreground))", glow: "from-slate-300/15 via-slate-200/10 to-transparent", ring: "ring-slate-200", line: "from-slate-500 via-slate-300 to-transparent" },
    };
    const palette = toneStyles[tone];

    if (loading) {
        return (
            <Card className="h-full overflow-hidden border border-slate-200/80 bg-white/85 p-6 shadow-[0_18px_40px_rgba(15,23,42,0.07)] backdrop-blur-sm">
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
        <Card className="group relative h-full overflow-hidden border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] p-6 shadow-[0_20px_45px_rgba(15,23,42,0.08)] backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_28px_60px_rgba(15,23,42,0.12)]">
            {/* Background Pattern */}
            <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${palette.line}`} />
            <div className={`absolute right-0 top-0 h-32 w-32 -mt-8 -mr-8 rounded-full bg-gradient-to-br ${palette.glow} blur-3xl transition-colors`} />

            <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                    <p className="text-sm font-medium uppercase tracking-wider text-slate-500">{title}</p>
                    <div className={`rounded-xl p-2.5 ring-1 ${palette.bg} ${palette.text} ${palette.ring}`}>
                        <Icon className="h-5 w-5" />
                    </div>
                </div>

                <div className="space-y-1">
                    <h3 className="text-3xl font-bold tracking-tight text-slate-950">{value}</h3>
                    {trend && (
                        <div className="flex items-center gap-1.5 pt-1">
                            <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${trendUp ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                                {trendUp ? "+" : ""}{trend}
                            </span>
                            <span className="text-[10px] font-medium uppercase tracking-tighter text-slate-400">vs período anterior</span>
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
