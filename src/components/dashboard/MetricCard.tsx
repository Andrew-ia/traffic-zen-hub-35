import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string;
  change: string;
  icon: LucideIcon;
  trend: "up" | "down";
}

export function MetricCard({ title, value, change, icon: Icon, trend }: MetricCardProps) {
  return (
    <Card className="overflow-hidden transition-all duration-300 hover:shadow-lg">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="mt-2 text-3xl font-bold">{value}</p>
            <p
              className={cn(
                "mt-2 text-sm font-medium flex items-center gap-1",
                trend === "up" ? "text-success" : "text-destructive"
              )}
            >
              {change}
            </p>
          </div>
          <div
            className={cn(
              "rounded-full p-3",
              trend === "up" ? "bg-success/10" : "bg-destructive/10"
            )}
          >
            <Icon
              className={cn(
                "h-6 w-6",
                trend === "up" ? "text-success" : "text-destructive"
              )}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
