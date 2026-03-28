import { format, isSameYear } from "date-fns";
import type { DateRange } from "react-day-picker";

export const ML_PERIOD_PARAM = "ml_period";
export const ML_FROM_PARAM = "ml_from";
export const ML_TO_PARAM = "ml_to";

export const MERCADO_LIVRE_PERIOD_OPTIONS = ["1", "7", "15", "30", "60", "90", "billing", "custom"] as const;
export type MercadoLivrePeriodValue = (typeof MERCADO_LIVRE_PERIOD_OPTIONS)[number];

export function normalizeMercadoLivrePeriod(value: string | null | undefined): MercadoLivrePeriodValue {
    if (value && MERCADO_LIVRE_PERIOD_OPTIONS.includes(value as MercadoLivrePeriodValue)) {
        return value as MercadoLivrePeriodValue;
    }
    return "30";
}

function parseDateValue(value: string | null): Date | undefined {
    if (!value) return undefined;
    const date = new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) return undefined;
    date.setHours(0, 0, 0, 0);
    return date;
}

export function parseMercadoLivreCustomRange(searchParams: URLSearchParams): DateRange | undefined {
    const from = parseDateValue(searchParams.get(ML_FROM_PARAM));
    const to = parseDateValue(searchParams.get(ML_TO_PARAM));

    if (!from && !to) return undefined;
    if (from && to && from.getTime() > to.getTime()) {
        return { from: to, to: from };
    }

    return {
        from: from ?? to,
        to: to ?? from,
    };
}

export function getMercadoLivreBillingCycleRange(baseDate: Date = new Date()): DateRange {
    const to = new Date(baseDate);
    to.setHours(0, 0, 0, 0);

    const from = new Date(to);
    const currentDay = to.getDate();

    if (currentDay >= 20) {
        from.setDate(20);
    } else {
        from.setMonth(from.getMonth() - 1, 20);
    }

    from.setHours(0, 0, 0, 0);

    return { from, to };
}

export function formatMercadoLivrePeriodLabel(
    period: MercadoLivrePeriodValue,
    customRange?: DateRange
) {
    if (period !== "custom") {
        switch (period) {
            case "1":
                return "Hoje";
            case "7":
                return "Últimos 7 dias";
            case "15":
                return "Últimos 15 dias";
            case "30":
                return "Últimos 30 dias";
            case "60":
                return "Últimos 60 dias";
            case "90":
                return "Últimos 90 dias";
            case "billing": {
                const billingRange = getMercadoLivreBillingCycleRange();
                return `${format(billingRange.from, "dd/MM")} - ${format(billingRange.to ?? billingRange.from, "dd/MM")}`;
            }
            default:
                return "Últimos 30 dias";
        }
    }

    if (!customRange?.from) return "Período personalizado";
    const fromLabel = format(customRange.from, "dd/MM/yy");
    const toLabel = format(customRange.to ?? customRange.from, "dd/MM/yy");
    if (fromLabel === toLabel) return fromLabel;

    if (customRange.to && isSameYear(customRange.from, customRange.to)) {
        return `${format(customRange.from, "dd/MM")} - ${format(customRange.to, "dd/MM")}`;
    }

    return `${fromLabel} - ${toLabel}`;
}
