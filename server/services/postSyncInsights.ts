import { getPool } from '../config/database.js';
import type { SyncContext } from '../../supabase/functions/_shared/db.js';
import {
  generatePostSyncInsights as generateSharedInsights,
  type SyncInsightsSummary,
} from '../../supabase/functions/_shared/postSyncInsights.js';

interface GenerateOptions {
  workspaceId: string;
  platformKey: string;
  days: number;
}

export async function generatePostSyncInsights(options: GenerateOptions): Promise<SyncInsightsSummary> {
  const pool = getPool();
  const ctx: SyncContext = {
    db: {
      query: (text: string, params?: any[]) => pool.query(text, params),
    },
  };

  return generateSharedInsights({
    workspaceId: options.workspaceId,
    platformKey: options.platformKey,
    days: options.days,
    ctx,
  });
}
