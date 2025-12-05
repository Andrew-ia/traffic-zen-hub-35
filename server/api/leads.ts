import { Router, Request, Response } from 'express';
import { getPool } from '../config/database.js';
import { resolveWorkspaceId } from '../utils/workspace.js';

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
  hasOrigem: boolean;
  hasCampanha: boolean;
  hasObservacoes: boolean;
  hasAnnouncesOnline: boolean;
  hasTrafficInvestment: boolean;
};

let cachedSchema: LeadSchema | null = null;

async function loadLeadSchema(): Promise<LeadSchema> {
  if (cachedSchema) return cachedSchema;

  const pool = getPool();
  const { rows } = await pool.query<{ column_name: string }>(
    `select column_name
     from information_schema.columns
     where table_schema = 'public'
       and table_name = 'leads'`
  );
  const cols = rows.map((r: { column_name: string }) => r.column_name);
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
    hasOrigem: cols.includes('origem'),
    hasCampanha: cols.includes('campanha'),
    hasObservacoes: cols.includes('observacoes'),
    hasAnnouncesOnline: cols.includes('announces_online'),
    hasTrafficInvestment: cols.includes('traffic_investment'),
  };
  return cachedSchema;
}

function normalizePhone(value: string): string {
  return value.replace(/[^\d+]/g, '');
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

// POST /api/leads - Create new lead
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, whatsapp, company, revenue_range, announces_online, traffic_investment, email, workspace_id } = req.body || {};

    if (!name || !whatsapp || !company) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const schema = await loadLeadSchema();
    const pool = getPool();
    const { id: workspaceId } = resolveWorkspaceId(req);

    if (schema.hasWorkspaceId && !workspaceId) {
      return res.status(400).json({ error: 'workspace_id é obrigatório' });
    }

    const insertCols: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    // Map name to full_name
    if (schema.hasFullName) {
      insertCols.push('full_name');
      values.push(name);
      paramCount++;
    }

    // Map whatsapp to phone
    if (schema.hasPhone) {
      insertCols.push('phone');
      values.push(normalizePhone(String(whatsapp)));
      paramCount++;
    }

    // Company field
    if (schema.hasCompany) {
      insertCols.push('company');
      values.push(company);
      paramCount++;
    }

    // Optional fields
    if (revenue_range) {
      insertCols.push('revenue_range');
      values.push(revenue_range);
      paramCount++;
    }

    if (schema.hasEmail && email) {
      insertCols.push('email');
      values.push(normalizeEmail(email));
      paramCount++;
    }

    if (schema.hasAnnouncesOnline && announces_online) {
      insertCols.push('announces_online');
      values.push(announces_online);
      paramCount++;
    }

    if (schema.hasTrafficInvestment && traffic_investment) {
      insertCols.push('traffic_investment');
      values.push(traffic_investment);
      paramCount++;
    }

    if (schema.hasOrigem) {
      insertCols.push('origem');
      values.push('landing');
      paramCount++;
    }

    if (schema.hasSourcePlatform) {
      insertCols.push('source_platform');
      values.push('landing');
      paramCount++;
    }

    if (schema.hasStatus) {
      insertCols.push('status');
      values.push('new');
      paramCount++;
    }

    if (schema.hasWorkspaceId && workspaceId) {
      insertCols.push('workspace_id');
      values.push(workspaceId);
      paramCount++;
    }

    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const sql = `
      insert into leads (${insertCols.join(', ')})
      values (${placeholders})
      returning id
    `;

    const result = await pool.query(sql, values);
    return res.status(200).json({ success: true, id: result.rows[0].id });
  } catch (error) {
    console.error('Error saving lead:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/leads - List leads with filtering and pagination
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      workspace_id,
      status,
      origem,
      search,
      page = '1',
      limit = '20',
      sort_by = 'created_at',
      sort_order = 'desc'
    } = req.query;

    const pool = getPool();
    const { id: resolvedWorkspaceId } = resolveWorkspaceId(req);
    const workspaceId = (workspace_id as string | undefined) || resolvedWorkspaceId;
    const schema = await loadLeadSchema();

    if (schema.hasWorkspaceId && !workspaceId) {
      return res.status(400).json({ error: 'workspace_id é obrigatório' });
    }

    const conditions: string[] = [];
    const params: any[] = [];
    let paramCount = 0;

    if (workspaceId) {
      paramCount++;
      conditions.push(`workspace_id = $${paramCount}`);
      params.push(workspaceId);
    }

    if (status) {
      paramCount++;
      conditions.push(`status = $${paramCount}`);
      params.push(status);
    }

    if (origem) {
      paramCount++;
      conditions.push(`origem = $${paramCount}`);
      params.push(origem);
    }

    if (search) {
      const likeValue = `%${search}%`;
      const searchColumns: string[] = [];
      if (schema.hasFullName) searchColumns.push('full_name');
      if (schema.hasName) searchColumns.push('name');
      if (schema.hasEmail) searchColumns.push('email');
      if (schema.hasPhone) searchColumns.push('phone');
      if (schema.hasCompany) searchColumns.push('company');

      if (searchColumns.length > 0) {
        paramCount++;
        const orConditions = searchColumns.map((col) => `${col} ILIKE $${paramCount}`).join(' OR ');
        conditions.push(`(${orConditions})`);
        params.push(likeValue);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Validate sort fields to prevent SQL injection
    const validSortFields = ['created_at', 'name', 'company', 'status', 'origem'];
    const sortField = validSortFields.includes(sort_by as string) ? sort_by : 'created_at';
    const sortDirection = sort_order === 'asc' ? 'ASC' : 'DESC';

    // Get total count
    const countSql = `SELECT COUNT(*) as total FROM leads ${whereClause}`;
    const countResult = await pool.query(countSql, params);
    const total = parseInt(countResult.rows[0].total);

    // Get paginated results
    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)));
    const offset = (pageNum - 1) * limitNum;

    // Determine column names based on schema
    const nameCol = schema.hasFullName ? 'full_name as name' : (schema.hasName ? 'name' : "'' as name");
    const phoneCol = schema.hasPhone ? 'phone as whatsapp' : "'' as whatsapp";

    const dataSql = `
      SELECT 
        id,
        ${nameCol},
        email,
        ${phoneCol},
        company,
        origem,
        campanha,
        status,
        revenue_range,
        announces_online,
        traffic_investment,
        observacoes,
        created_at,
        ultima_atualizacao
      FROM leads
      ${whereClause}
      ORDER BY ${sortField} ${sortDirection}
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    const dataResult = await pool.query(dataSql, [...params, limitNum, offset]);

    return res.status(200).json({
      success: true,
      data: dataResult.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching leads:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PUT /api/leads/:id - Update lead
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      email,
      whatsapp,
      company,
      status,
      origem,
      campanha,
      observacoes,
      revenue_range,
      announces_online,
      traffic_investment
    } = req.body;

    const pool = getPool();
    const schema = await loadLeadSchema();

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    if (name !== undefined && schema.hasName) {
      paramCount++;
      updates.push(`name = $${paramCount}`);
      values.push(name);
    }

    if (email !== undefined && schema.hasEmail) {
      paramCount++;
      updates.push(`email = $${paramCount}`);
      values.push(email ? normalizeEmail(email) : null);
    }

    if (whatsapp !== undefined) {
      paramCount++;
      updates.push(`whatsapp = $${paramCount}`);
      values.push(normalizePhone(String(whatsapp)));
    }

    if (company !== undefined && schema.hasCompany) {
      paramCount++;
      updates.push(`company = $${paramCount}`);
      values.push(company);
    }

    if (status !== undefined && schema.hasStatus) {
      // Validate status
      const validStatuses = ['new', 'em_contato', 'qualificado', 'perdido', 'cliente'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status value' });
      }
      paramCount++;
      updates.push(`status = $${paramCount}`);
      values.push(status);
    }

    if (origem !== undefined && schema.hasOrigem) {
      paramCount++;
      updates.push(`origem = $${paramCount}`);
      values.push(origem);
    }

    if (campanha !== undefined && schema.hasCampanha) {
      paramCount++;
      updates.push(`campanha = $${paramCount}`);
      values.push(campanha);
    }

    if (observacoes !== undefined && schema.hasObservacoes) {
      paramCount++;
      updates.push(`observacoes = $${paramCount}`);
      values.push(observacoes);
    }

    if (revenue_range !== undefined) {
      paramCount++;
      updates.push(`revenue_range = $${paramCount}`);
      values.push(revenue_range);
    }

    if (announces_online !== undefined && schema.hasAnnouncesOnline) {
      paramCount++;
      updates.push(`announces_online = $${paramCount}`);
      values.push(announces_online);
    }

    if (traffic_investment !== undefined && schema.hasTrafficInvestment) {
      paramCount++;
      updates.push(`traffic_investment = $${paramCount}`);
      values.push(traffic_investment);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    paramCount++;
    values.push(id);

    const sql = `
      UPDATE leads
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(sql, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    return res.status(200).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error updating lead:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE /api/leads/:id - Delete lead
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    const sql = 'DELETE FROM leads WHERE id = $1 RETURNING id';
    const result = await pool.query(sql, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    return res.status(200).json({ success: true, id: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting lead:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
