import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { Client } from 'pg';
import { getPool, getDatabaseUrl } from '../config/database.js';
import { resolveWorkspaceId } from '../utils/workspace.js';

/**
 * Simple HMAC-based token utilities (no external deps)
 */
const AUTH_SECRET = process.env.AUTH_SECRET || process.env.VITE_AUTH_SECRET || 'dev-secret-change-me';
let pagePermsTableEnsured = false;

interface TokenPayload {
  sub: string;
  email: string;
  role: 'adm' | 'basico' | 'simples';
  exp: number; // epoch seconds
}

function signToken(payload: TokenPayload): string {
  const json = JSON.stringify(payload);
  const b64 = Buffer.from(json).toString('base64url');
  const sig = crypto.createHmac('sha256', AUTH_SECRET).update(b64).digest('hex');
  return `${b64}.${sig}`;
}

function verifyToken(token: string): TokenPayload | null {
  const [b64, sig] = token.split('.');
  if (!b64 || !sig) return null;
  const expected = crypto.createHmac('sha256', AUTH_SECRET).update(b64).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  try {
    const payload = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8')) as TokenPayload;
    if (typeof payload.exp !== 'number' || Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'missing_token' });
  }
  const token = header.substring('Bearer '.length);
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ success: false, error: 'invalid_token' });
  (req as any).user = payload;
  next();
}

function mapWorkspaceRoleToAppRole(workspaceRole?: string | null): 'adm' | 'basico' | 'simples' {
  switch ((workspaceRole || '').toLowerCase()) {
    case 'owner':
    case 'admin':
      return 'adm';
    case 'manager':
    case 'analyst':
      return 'basico';
    default:
      return 'simples';
  }
}


export async function login(req: Request, res: Response) {
  // Use getPool() to ensure correct SSL/connection settings for the environment
  const pool = getPool();

  try {
    const { email, username, password } = req.body || {};
    const identifier = email || username;

    if (!identifier || !password) {
      return res.status(400).json({ success: false, error: 'missing_credentials' });
    }

    const { id: workspaceId } = resolveWorkspaceId(req);
    const WORKSPACE_ID = workspaceId || (process.env.WORKSPACE_ID || process.env.VITE_WORKSPACE_ID || '').trim();
    if (!WORKSPACE_ID) {
      return res.status(400).json({ success: false, error: 'missing_workspace' });
    }

    // Validate password using pgcrypto's crypt() against stored hash
    // Allow login with either email or full_name (username)
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.full_name,
              wm.role as workspace_role
         FROM users u
         LEFT JOIN workspace_members wm ON wm.user_id = u.id AND wm.workspace_id = $3
        WHERE (LOWER(u.email) = LOWER($1) OR LOWER(u.full_name) = LOWER($1))
          AND u.status = 'active'
          AND crypt($2, u.password_hash) = u.password_hash
        LIMIT 1`,
      [identifier, password, WORKSPACE_ID]
    );

    if (!rows.length) {
      return res.status(401).json({ success: false, error: 'invalid_login' });
    }

    const user = rows[0];
    const appRole = mapWorkspaceRoleToAppRole(user.workspace_role);
    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      role: appRole,
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
    };
    const token = signToken(payload);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.full_name,
        role: appRole,
        workspace_id: WORKSPACE_ID
      }
    });
  } catch (err) {
    console.error('Login error', err);
    res.status(500).json({ success: false, error: 'server_error' });
  }
}

export async function me(req: Request, res: Response) {
  const payload = (req as any).user as TokenPayload | undefined;
  if (!payload) return res.status(401).json({ success: false, error: 'invalid_token' });

  // We need to return the workspace_id here too. 
  // Ideally it should be in the token, but for now let's use the env var as the source of truth for the current context
  const { id: workspaceId } = resolveWorkspaceId(req);
  const WORKSPACE_ID = workspaceId || (process.env.WORKSPACE_ID || process.env.VITE_WORKSPACE_ID || '').trim();

  res.json({
    success: true,
    user: {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      workspace_id: WORKSPACE_ID || null
    }
  });
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const payload = (req as any).user as TokenPayload | undefined;
  if (!payload || payload.role !== 'adm') {
    return res.status(403).json({ success: false, error: 'forbidden' });
  }
  next();
}

async function ensurePagePermissionsTable(pool: ReturnType<typeof getPool>) {
  if (pagePermsTableEnsured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS workspace_page_permissions (
      workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      target_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      path_prefix TEXT NOT NULL,
      allowed BOOLEAN NOT NULL DEFAULT true,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (workspace_id, target_user_id, path_prefix)
    );
  `);
  pagePermsTableEnsured = true;
}

export async function createUser(req: Request, res: Response) {
  try {
    const { email, fullName, password, role } = req.body || {};
    if (!email || !password || !role) {
      return res.status(400).json({ success: false, error: 'missing_fields' });
    }
    const appRole: 'adm' | 'basico' | 'simples' = role;
    const workspaceRole = appRole === 'adm' ? 'admin' : appRole === 'basico' ? 'manager' : 'viewer';

    const { id: workspaceId } = resolveWorkspaceId(req);
    const WORKSPACE_ID = workspaceId || (process.env.WORKSPACE_ID || process.env.VITE_WORKSPACE_ID || '').trim();

    const pool = getPool();
    // Hash password using pgcrypto
    const { rows } = await pool.query(
      `INSERT INTO users (email, full_name, password_hash, status)
       VALUES ($1, $2, crypt($3, gen_salt('bf')), 'active')
       ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
       RETURNING id`,
      [email, fullName || null, password]
    );
    const userId = rows[0]?.id;
    if (!userId) {
      return res.status(500).json({ success: false, error: 'create_failed' });
    }

    if (!WORKSPACE_ID) {
      return res.status(400).json({ success: false, error: 'workspace_not_configured' });
    }
    // Upsert membership
    await pool.query(
      `INSERT INTO workspace_members (workspace_id, user_id, role, invitation_status)
       VALUES ($1, $2, $3, 'accepted')
       ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role, updated_at = now()`,
      [WORKSPACE_ID, userId, workspaceRole]
    );

    res.json({ success: true, message: 'user_created', userId });
  } catch (err) {
    console.error('Create user error', err);
    res.status(500).json({ success: false, error: 'server_error' });
  }
}

// Route-level middlewares for admin-only
export const adminOnly = [authMiddleware, requireAdmin];

// Get page permissions for a target user (users can access their own, admins can access any)
export async function getPagePermissions(req: Request, res: Response) {
  try {
    const payload = (req as any).user as TokenPayload | undefined;
    if (!payload) return res.status(401).json({ success: false, error: 'invalid_token' });

    const { id: workspaceId } = resolveWorkspaceId(req);
    const WORKSPACE_ID = workspaceId || (process.env.WORKSPACE_ID || process.env.VITE_WORKSPACE_ID || '').trim();

    const pool = getPool();
    await ensurePagePermissionsTable(pool);

    const targetUserId = req.params.userId;
    if (!targetUserId) return res.status(400).json({ success: false, error: 'missing_user' });
    if (!WORKSPACE_ID) return res.status(500).json({ success: false, error: 'workspace_not_configured' });

    // Users can only access their own permissions, unless they're admin
    if (payload.role !== 'adm' && payload.sub !== targetUserId) {
      return res.status(403).json({ success: false, error: 'forbidden' });
    }

    const { rows } = await pool.query(
      `SELECT path_prefix AS prefix, allowed
         FROM workspace_page_permissions
        WHERE workspace_id = $1 AND target_user_id = $2`,
      [WORKSPACE_ID, targetUserId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('getPagePermissions error', err);
    res.status(500).json({ success: false, error: 'server_error' });
  }
}

// Upsert page permissions for a target user (admin-only)
export async function setPagePermissions(req: Request, res: Response) {
  try {
    const { permissions } = req.body || {};
    const targetUserId = req.params.userId;

    if (!targetUserId || !Array.isArray(permissions)) {
      return res.status(400).json({ success: false, error: 'invalid_payload' });
    }

    const { id: workspaceId } = resolveWorkspaceId(req);
    const WORKSPACE_ID = workspaceId || (process.env.WORKSPACE_ID || process.env.VITE_WORKSPACE_ID || '').trim();

    if (!WORKSPACE_ID) return res.status(500).json({ success: false, error: 'workspace_not_configured' });

    const pool = getPool();
    await ensurePagePermissionsTable(pool);

    await pool.query('BEGIN');
    await pool.query(
      `DELETE FROM workspace_page_permissions
        WHERE workspace_id = $1 AND target_user_id = $2`,
      [WORKSPACE_ID, targetUserId]
    );

    for (const perm of permissions) {
      if (!perm || typeof perm.prefix !== 'string') continue;
      const allowed = !!perm.allowed;
      await pool.query(
        `INSERT INTO workspace_page_permissions (workspace_id, target_user_id, path_prefix, allowed)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (workspace_id, target_user_id, path_prefix)
         DO UPDATE SET allowed = EXCLUDED.allowed, updated_at = now()`,
        [WORKSPACE_ID, targetUserId, perm.prefix, allowed]
      );
    }
    await pool.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    console.error('setPagePermissions error', err);
    try { await getPool().query('ROLLBACK'); } catch { void 0; }
    res.status(500).json({ success: false, error: 'server_error' });
  }
}
