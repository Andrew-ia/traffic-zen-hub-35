import { Eye, MousePointer, TrendingUp, DollarSign } from "lucide-react";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import { CampaignsTable } from "@/components/campaigns/CampaignsTable";

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Acompanhe o desempenho das suas campanhas em tempo real
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Impressões"
          value="284.5K"
          change="+12.5% vs mês anterior"
          icon={Eye}
          trend="up"
        />
        <MetricCard
          title="Cliques"
          value="9.2K"
          change="+8.3% vs mês anterior"
          icon={MousePointer}
          trend="up"
        />
        <MetricCard
          title="Conversões"
          value="423"
          change="+15.2% vs mês anterior"
          icon={TrendingUp}
          trend="up"
        />
        <MetricCard
          title="ROAS"
          value="4.8x"
          change="-2.1% vs mês anterior"
          icon={DollarSign}
          trend="down"
        />
      </div>

      <PerformanceChart />

      <CampaignsTable />
    </div>
  );
}
