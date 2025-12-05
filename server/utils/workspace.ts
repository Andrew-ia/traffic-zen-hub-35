import type { Request } from 'express';

const ENV_FALLBACKS = [
  'WORKSPACE_ID',
  'META_WORKSPACE_ID',
  'SUPABASE_WORKSPACE_ID',
  'VITE_WORKSPACE_ID',
] as const;

export function resolveWorkspaceId(req: Request): { id: string | null; usedFallback: boolean } {
  const fromQuery = typeof req.query.workspaceId === 'string' ? req.query.workspaceId.trim() : '';
  const fromBody = typeof (req.body as any)?.workspaceId === 'string' ? (req.body as any).workspaceId.trim() : '';
  const fromHeader = typeof req.headers['x-workspace-id'] === 'string' ? req.headers['x-workspace-id'].trim() : '';

  const explicit = fromQuery || fromBody || fromHeader;
  if (explicit) return { id: explicit, usedFallback: false };

  for (const key of ENV_FALLBACKS) {
    const val = process.env[key];
    if (val && val.trim()) {
      return { id: val.trim(), usedFallback: true };
    }
  }

  return { id: null, usedFallback: false };
}
