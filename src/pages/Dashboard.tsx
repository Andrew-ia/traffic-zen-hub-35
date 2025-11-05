import { useEffect, useMemo, useState } from "react";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import { usePerformanceMetrics } from "@/hooks/usePerformanceMetrics";
import { ObjectivePerformanceSection } from "@/components/dashboard/ObjectivePerformance";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Dashboard() {
  const [periodDays, setPeriodDays] = useState(30);

  const { data: performance, isLoading: isLoadingMetrics } = usePerformanceMetrics(periodDays);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header Section - Responsive */}
      <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Visão geral das suas campanhas e performance
          </p>
        </div>

        <Select value={periodDays.toString()} onValueChange={(value) => setPeriodDays(Number(value))}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="14">Últimos 14 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="60">Últimos 60 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <PerformanceChart data={performance?.points ?? []} isLoading={isLoadingMetrics} />

      <ObjectivePerformanceSection days={periodDays} />
    </div>
  );
}
