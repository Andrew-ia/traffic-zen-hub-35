import { Router, Request, Response } from 'express';
import { getPool } from '../config/database.js';

const router = Router();

type LeadSchema = {
  hasWorkspaceId: boolean;
  hasFullName: boolean;
  hasName: boolean;
  hasPhone: boolean;
  hasEmail: boolean;
  hasCompany: boolean;
  hasSourcePlatform: boolean;
  hasSourceDetail: boolean;
  hasStatus: boolean;
  hasValue: boolean;
  hasCurrency: boolean;
};

let cachedSchema: LeadSchema | null = null;

function getWorkspaceId(): string | null {
  return (
    process.env.WORKSPACE_ID ||
    process.env.META_WORKSPACE_ID ||
    process.env.SUPABASE_WORKSPACE_ID ||
    process.env.VITE_WORKSPACE_ID ||
    null
  );
}

async function loadLeadSchema(): Promise<LeadSchema> {
  if (cachedSchema) return cachedSchema;

  const pool = getPool();
  const { rows } = await pool.query<{ column_name: string }>(
    `select column_name
     from information_schema.columns
     where table_schema = 'public'
       and table_name = 'leads'`
  );
  const cols = rows.map((r) => r.column_name);
  cachedSchema = {
    hasWorkspaceId: cols.includes('workspace_id'),
    hasFullName: cols.includes('full_name'),
    hasName: cols.includes('name'),
    hasPhone: cols.includes('phone'),
    hasEmail: cols.includes('email'),
    hasCompany: cols.includes('company'),
    hasSourcePlatform: cols.includes('source_platform'),
    hasSourceDetail: cols.includes('source_detail'),
    hasStatus: cols.includes('status'),
    hasValue: cols.includes('value'),
    hasCurrency: cols.includes('currency'),
  };
  return cachedSchema;
}

function normalizePhone(value: string): string {
  return value.replace(/[^\d+]/g, '');
}

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, whatsapp, company, revenue_range } = req.body || {};

    if (!name || !whatsapp || !company) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const schema = await loadLeadSchema();
    const pool = getPool();
    const workspaceId = getWorkspaceId();

    // Variant 1: CRM-style schema (workspace_id + detailed columns)
    const isCrmSchema = schema.hasFullName || schema.hasSourcePlatform || schema.hasPhone || schema.hasEmail;
    if (isCrmSchema) {
      if (schema.hasWorkspaceId && !workspaceId) {
        return res.status(500).json({ error: 'Workspace ID not configured on server' });
      }

      const phone = schema.hasPhone ? normalizePhone(String(whatsapp)) : null;
      const insertCols = [];
      const values: any[] = [];

      if (schema.hasWorkspaceId) {
        insertCols.push('workspace_id');
        values.push(workspaceId);
      }
      if (schema.hasFullName) {
        insertCols.push('full_name');
        values.push(name);
      }
      if (schema.hasPhone) {
        insertCols.push('phone');
        values.push(phone);
      }
      if (schema.hasStatus) {
        insertCols.push('status');
        values.push('new');
      }
      if (schema.hasSourcePlatform) {
        insertCols.push('source_platform');
        values.push('landing');
      }
      if (schema.hasSourceDetail) {
        insertCols.push('source_detail');
        values.push(company);
      }
      if (schema.hasValue) {
        insertCols.push('value');
        values.push(null);
      }
      if (schema.hasCurrency) {
        insertCols.push('currency');
        values.push(null);
      }

      if (insertCols.length === 0) {
        return res.status(500).json({ error: 'Leads table schema not supported' });
      }

      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
      const sql = `
        insert into leads (${insertCols.join(', ')})
        values (${placeholders})
        returning id
      `;

      const result = await pool.query(sql, values);
      return res.status(200).json({ success: true, id: result.rows[0].id });
    }

    // Variant 2: Lightweight landing schema (name/whatsapp/company)
    const insertCols = ['name', 'whatsapp', 'company', 'revenue_range'];
    const values = [
      name,
      normalizePhone(String(whatsapp)),
      company,
      revenue_range || null,
    ];

    if (schema.hasWorkspaceId) {
      insertCols.push('workspace_id');
      values.push(workspaceId);
    }

    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const sql = `
      insert into leads (${insertCols.join(', ')}, status)
      values (${placeholders}, 'new')
      returning id
    `;
    const result = await pool.query(sql, values);

    return res.status(200).json({ success: true, id: result.rows[0].id });
  } catch (error) {
    console.error('Error saving lead:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
