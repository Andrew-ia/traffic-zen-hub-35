import { Router, Request, Response } from 'express';
import { getPool } from '../config/database.js';

const router = Router();

type WorkspaceRow = {
  id: string;
  name: string;
  slug: string | null;
  status: string;
  plan: string;
  timezone: string;
  currency: string;
  created_at: string;
  updated_at: string;
};

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 80);
}

async function ensureUniqueSlug(baseSlug: string): Promise<string> {
  const pool = getPool();
  let candidate = baseSlug || 'workspace';
  let suffix = 1;

  // Try to find a free slug, with a reasonable cap to avoid infinite loops
  while (suffix < 50) {
    const { rows } = await pool.query<{ exists: boolean }>(
      'select exists(select 1 from workspaces where slug = $1) as exists',
      [candidate]
    );
    if (!rows[0]?.exists) return candidate;
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
  // Fallback to a timestamped slug if everything failed
  return `${baseSlug}-${Date.now()}`;
}

router.get('/', async (_req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { rows } = await pool.query<WorkspaceRow>(
      `select id, name, slug, status, plan, timezone, currency, created_at, updated_at
       from workspaces
       order by created_at desc`
    );
    res.json({ workspaces: rows });
  } catch (error) {
    console.error('Error listing workspaces', error);
    res.status(500).json({ error: 'Failed to list workspaces' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, slug, plan, timezone, currency } = req.body || {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Nome do workspace é obrigatório.' });
    }

    const baseSlug = slugify(slug || name);
    const uniqueSlug = await ensureUniqueSlug(baseSlug);
    const pool = getPool();

    const { rows } = await pool.query<WorkspaceRow>(
      `insert into workspaces (name, slug, plan, timezone, currency)
       values ($1, $2, coalesce($3, 'personal'), coalesce($4, 'America/Sao_Paulo'), coalesce($5, 'BRL'))
       returning id, name, slug, status, plan, timezone, currency, created_at, updated_at`,
      [name.trim(), uniqueSlug, plan, timezone, currency]
    );

    res.status(201).json({ workspace: rows[0] });
  } catch (error: any) {
    console.error('Error creating workspace', error);
    res.status(500).json({ error: 'Failed to create workspace' });
  }
});

export default router;
