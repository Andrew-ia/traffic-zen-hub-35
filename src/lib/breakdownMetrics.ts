interface BreakdownIdentity {
  metric_date?: string | null;
  breakdown_value_key?: string | null;
  granularity?: string | null;
  ad_set_id?: string | null;
  ad_id?: string | null;
  synced_at?: string | null;
}

function parseSyncedAt(value?: string | null): number {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

/**
 * Deduplicates Meta breakdown rows that share the same identity but were synced multiple times.
 * Keeps the row with the most recent `synced_at` timestamp for each identity.
 */
export function keepLatestBreakdownRows<T extends BreakdownIdentity>(rows: T[]): T[] {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }

  const latestByKey = new Map<string, T>();
  for (const row of rows) {
    const key = [
      row.metric_date ?? "unknown-date",
      row.breakdown_value_key ?? "unknown-breakdown",
      row.granularity ?? "unknown-granularity",
      row.ad_set_id ?? "no-adset",
      row.ad_id ?? "no-ad",
    ].join("|");

    const existing = latestByKey.get(key);
    if (!existing) {
      latestByKey.set(key, row);
      continue;
    }

    if (parseSyncedAt(row.synced_at) >= parseSyncedAt(existing.synced_at)) {
      latestByKey.set(key, row);
    }
  }

  return Array.from(latestByKey.values());
}
