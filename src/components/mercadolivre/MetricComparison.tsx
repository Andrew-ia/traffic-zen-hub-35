import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MetricComparisonProps {
    title: string;
    currentValue: number;
    previousValue: number;
    format?: "currency" | "number" | "percentage";
    loading?: boolean;
    icon?: React.ReactNode;
}

export function MetricComparison({
    title,
    currentValue,
    previousValue,
    format = "number",
    loading,
    icon,
}: MetricComparisonProps) {
    if (loading) {
        return (
            <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-4 w-20" />
            </div>
        );
    }

    const difference = currentValue - previousValue;
    const percentageChange = previousValue !== 0 ? (difference / previousValue) * 100 : 0;
    const isPositive = difference > 0;
    const isNeutral = difference === 0;

    const formatValue = (value: number) => {
        if (format === "currency") {
            return new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
                maximumFractionDigits: 0,
            }).format(value);
        }
        if (format === "percentage") {
            return `${value.toFixed(2)}%`;
        }
        return new Intl.NumberFormat("pt-BR").format(value);
    };

    const getTrendIcon = () => {
        if (isNeutral) return <Minus className="h-4 w-4" />;
        return isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />;
    };

    const getTrendColor = () => {
        if (isNeutral) return "text-muted-foreground";
        return isPositive ? "text-success" : "text-destructive";
    };

    const getTrendBgColor = () => {
        if (isNeutral) return "bg-muted/30";
        return isPositive
            ? "bg-success/10"
            : "bg-destructive/10";
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {icon}
                <span>{title}</span>
            </div>
            <div className="text-xl font-bold">{formatValue(currentValue)}</div>
            <div className={`flex items-center gap-1.5 text-sm ${getTrendColor()}`}>
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${getTrendBgColor()}`}>
                    {getTrendIcon()}
                    <span className="font-medium">
                        {isNeutral ? "0%" : `${Math.abs(percentageChange).toFixed(1)}%`}
                    </span>
                </div>
                <span className="text-muted-foreground text-xs">vs período anterior</span>
            </div>
            <div className="text-xs text-muted-foreground">
                Anterior: {formatValue(previousValue)}
            </div>
        </div>
    );
}
