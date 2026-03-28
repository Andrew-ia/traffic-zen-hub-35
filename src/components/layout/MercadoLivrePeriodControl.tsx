import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useLocation, useSearchParams } from "react-router-dom";
import type { DateRange } from "react-day-picker";
import { format } from "date-fns";
import {
  ML_FROM_PARAM,
  ML_PERIOD_PARAM,
  ML_TO_PARAM,
  formatMercadoLivrePeriodLabel,
  getMercadoLivreBillingCycleRange,
  normalizeMercadoLivrePeriod,
  parseMercadoLivreCustomRange,
} from "@/lib/mercadolivre-period";

const PRESET_OPTIONS = [
  { value: "1", label: "Hoje" },
  { value: "7", label: "7 dias" },
  { value: "15", label: "15 dias" },
  { value: "30", label: "30 dias" },
  { value: "60", label: "60 dias" },
  { value: "90", label: "90 dias" },
  { value: "billing", label: "Ciclo fatura" },
] as const;

export function MercadoLivrePeriodControl() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  if (location.pathname !== "/") return null;

  const period = normalizeMercadoLivrePeriod(searchParams.get(ML_PERIOD_PARAM));
  const customRange = parseMercadoLivreCustomRange(searchParams);
  const label = formatMercadoLivrePeriodLabel(period, customRange);
  const customRangeSummary =
    period === "custom" && customRange?.from
      ? customRange.to
        ? `${format(customRange.from, "dd/MM/yyyy")} - ${format(customRange.to, "dd/MM/yyyy")}`
        : format(customRange.from, "dd/MM/yyyy")
      : "Selecione um intervalo";
  const billingRange = getMercadoLivreBillingCycleRange();
  const billingRangeSummary = `${format(billingRange.from ?? new Date(), "dd/MM/yyyy")} - ${format(billingRange.to ?? billingRange.from ?? new Date(), "dd/MM/yyyy")}`;

  const updateSearchParams = (nextRange: DateRange | undefined, nextPeriod: string) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set(ML_PERIOD_PARAM, nextPeriod);

    if (nextPeriod === "custom" && nextRange?.from) {
      const from = new Date(nextRange.from);
      from.setHours(0, 0, 0, 0);
      const to = new Date(nextRange.to ?? nextRange.from);
      to.setHours(0, 0, 0, 0);
      nextParams.set(ML_FROM_PARAM, from.toISOString().slice(0, 10));
      nextParams.set(ML_TO_PARAM, to.toISOString().slice(0, 10));
    } else if (nextPeriod === "billing" && billingRange.from) {
      nextParams.set(ML_FROM_PARAM, billingRange.from.toISOString().slice(0, 10));
      nextParams.set(ML_TO_PARAM, (billingRange.to ?? billingRange.from).toISOString().slice(0, 10));
    } else {
      nextParams.delete(ML_FROM_PARAM);
      nextParams.delete(ML_TO_PARAM);
    }

    setSearchParams(nextParams, { replace: true });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="hidden h-8 min-w-[172px] max-w-[220px] items-center justify-start gap-2 rounded-xl border-slate-200 bg-white px-3 text-xs font-medium md:flex"
        >
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          <span className="hidden lg:inline text-muted-foreground">Período</span>
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        collisionPadding={16}
        className="w-[320px] rounded-2xl border-slate-200 p-4 shadow-xl"
      >
        <div className="space-y-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Período
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {PRESET_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant={period === option.value ? "default" : "outline"}
                  className="h-8 text-xs"
                  onClick={() => updateSearchParams(undefined, option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Ciclo da Fatura
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
              {billingRangeSummary}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Personalizado
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
              {customRangeSummary}
            </div>
            <Calendar
              mode="range"
              selected={period === "custom" ? customRange : undefined}
              onSelect={(range) => updateSearchParams(range, "custom")}
              numberOfMonths={1}
              disabled={(date) => date > new Date()}
              className="mx-auto rounded-xl border border-slate-100 bg-white"
              initialFocus
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
