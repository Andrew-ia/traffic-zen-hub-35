import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { getPool } from '../config/database.js';

/**
 * Simple HMAC-based token utilities (no external deps)
 */
const AUTH_SECRET = process.env.AUTH_SECRET || process.env.VITE_AUTH_SECRET || 'dev-secret-change-me';

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

const WORKSPACE_ID = process.env.WORKSPACE_ID || process.env.VITE_WORKSPACE_ID || '';

export async function login(req: Request, res: Response) {
  try {
    const { email, username, password } = req.body || {};
    const identifier = email || username;

    if (!identifier || !password) {
      return res.status(400).json({ success: false, error: 'missing_credentials' });
    }

    const pool = getPool();
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

    res.json({ success: true, token, user: { id: user.id, email: user.email, name: user.full_name, role: appRole } });
  } catch (err) {
    console.error('Login error', err);
    res.status(500).json({ success: false, error: 'server_error' });
  }
}

export async function me(req: Request, res: Response) {
  const payload = (req as any).user as TokenPayload | undefined;
  if (!payload) return res.status(401).json({ success: false, error: 'invalid_token' });
  res.json({ success: true, user: { id: payload.sub, email: payload.email, role: payload.role } });
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const payload = (req as any).user as TokenPayload | undefined;
  if (!payload || payload.role !== 'adm') {
    return res.status(403).json({ success: false, error: 'forbidden' });
  }
  next();
}

export async function createUser(req: Request, res: Response) {
  try {
    const { email, fullName, password, role } = req.body || {};
    if (!email || !password || !role) {
      return res.status(400).json({ success: false, error: 'missing_fields' });
    }
    const appRole: 'adm' | 'basico' | 'simples' = role;
    const workspaceRole = appRole === 'adm' ? 'admin' : appRole === 'basico' ? 'manager' : 'viewer';

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
      return res.status(500).json({ success: false, error: 'workspace_not_configured' });
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

