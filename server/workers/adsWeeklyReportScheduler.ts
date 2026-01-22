import { getPool } from "../config/database.js";
import { MercadoAdsAutomationService } from "../services/mercadolivre/ads-automation.service.js";

const CHECK_INTERVAL_MS = 60 * 60 * 1000;
const BRAZIL_TIME_ZONE = "America/Sao_Paulo";

const weekdayMap: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BRAZIL_TIME_ZONE,
  weekday: "short",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
});

const getBrazilParts = (date: Date) => {
  const parts = dateFormatter.formatToParts(date);
  const map = new Map(parts.map((p) => [p.type, p.value]));
  return {
    weekday: map.get("weekday") || "Mon",
    year: map.get("year") || "1970",
    month: map.get("month") || "01",
    day: map.get("day") || "01",
    hour: Number(map.get("hour") || 0),
  };
};

const getBrazilDateKey = (date: Date) => {
  const parts = getBrazilParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
};

export function startAdsWeeklyReportScheduler() {
  console.log("[Ads Weekly Report] Scheduler started");
  checkAndSend();
  setInterval(checkAndSend, CHECK_INTERVAL_MS);
}

async function checkAndSend() {
  const pool = getPool();
  const now = new Date();
  const { weekday, hour } = getBrazilParts(now);
  const todayKey = getBrazilDateKey(now);
  const dayNumber = weekdayMap[weekday] ?? 1;

  try {
    const { rows } = await pool.query(
      `select *
         from ml_ads_weekly_report_settings
        where enabled = true`
    );

    if (!rows.length) return;

    const automation = new MercadoAdsAutomationService();

    for (const row of rows) {
      const sendDay = Number(row.send_day ?? 1);
      const sendHour = Number(row.send_hour ?? 9);
      if (dayNumber !== sendDay || hour < sendHour) continue;

      const lastSent = row.last_sent_at ? new Date(row.last_sent_at) : null;
      const lastSentKey = lastSent ? getBrazilDateKey(lastSent) : null;
      if (lastSentKey === todayKey) continue;

      try {
        await automation.sendWeeklyReport(String(row.workspace_id));
        console.log(`[Ads Weekly Report] Report sent for workspace ${row.workspace_id}`);
      } catch (err) {
        console.error(`[Ads Weekly Report] Failed for workspace ${row.workspace_id}:`, err);
      }
    }
  } catch (err) {
    console.error("[Ads Weekly Report] Scheduler error:", err);
  }
}
