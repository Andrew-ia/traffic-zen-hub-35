import type { Request } from 'express';

const ENV_FALLBACKS = [
  'WORKSPACE_ID',
  'META_WORKSPACE_ID',
  'SUPABASE_WORKSPACE_ID',
  'VITE_WORKSPACE_ID',
] as const;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function resolveWorkspaceId(req: Request): { id: string | null; usedFallback: boolean } {
  const getParam = (val: any): string => {
    if (Array.isArray(val)) return val.length > 0 && typeof val[0] === 'string' ? val[0].trim() : '';
    return typeof val === 'string' ? val.trim() : '';
  };

  const fromQuery = getParam(req.query.workspaceId);
  const fromBody = getParam((req.body as any)?.workspaceId);
  const fromHeader = getParam(req.headers['x-workspace-id']);

  const explicit = fromQuery || fromBody || fromHeader;
  if (explicit && UUID_REGEX.test(explicit)) return { id: explicit, usedFallback: false };

  for (const key of ENV_FALLBACKS) {
    const val = process.env[key];
    if (val && val.trim()) {
      return { id: val.trim(), usedFallback: true };
    }
  }

  return { id: null, usedFallback: false };
}
