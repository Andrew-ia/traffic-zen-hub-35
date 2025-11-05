import type { Request, Response } from 'express';
import { getPool } from '../../config/database.js';

/**
 * Campaign Library API endpoints
 * Manages marketing campaign templates for planning and reuse
 */

export interface CampaignLibraryItem {
  id: string;
  workspace_id: string;
  name: string;
  objective: string;
  schedule_days: string | null;
  audience: string | null;
  budget: number | null;
  budget_type: string;
  copy_primary: string | null;
  copy_title: string | null;
  cta: string | null;
  creative_url: string | null;
  creative_type: string | null;
  status: string;
  notes: string | null;
  tags: string[] | null;
  platform: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  last_used_at: string | null;
}

/**
 * Get all campaigns for a workspace
 * GET /api/campaigns/library/:workspaceId
 */
export async function getCampaignLibrary(req: Request, res: Response) {
  try {
    const { workspaceId } = req.params;
    const { status, objective, platform, tags, search } = req.query;

    if (!workspaceId) {
      return res.status(400).json({
        success: false,
        error: 'Workspace ID is required',
      });
    }

    const pool = getPool();
    let query = `
      SELECT *
      FROM campaign_library
      WHERE workspace_id = $1
    `;
    const params: any[] = [workspaceId];
    let paramCount = 1;

    // Apply filters
    if (status) {
      paramCount++;
      query += ` AND status = $${paramCount}`;
      params.push(status);
    }

    if (objective) {
      paramCount++;
      query += ` AND objective = $${paramCount}`;
      params.push(objective);
    }

    if (platform) {
      paramCount++;
      query += ` AND platform = $${paramCount}`;
      params.push(platform);
    }

    if (tags && typeof tags === 'string') {
      paramCount++;
      query += ` AND tags && $${paramCount}::text[]`;
      params.push(tags.split(','));
    }

    if (search && typeof search === 'string') {
      paramCount++;
      query += ` AND (
        name ILIKE $${paramCount} OR
        copy_primary ILIKE $${paramCount} OR
        copy_title ILIKE $${paramCount} OR
        notes ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
    }

    query += ' ORDER BY updated_at DESC';

    const result = await pool.query(query, params);

    return res.json({
      success: true,
      campaigns: result.rows,
      total: result.rows.length,
    });
  } catch (error: any) {
    console.error('Error fetching campaign library:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to fetch campaigns',
    });
  }
}

/**
 * Get a single campaign by ID
 * GET /api/campaigns/library/item/:id
 */
export async function getCampaignById(req: Request, res: Response) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Campaign ID is required',
      });
    }

    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM campaign_library WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found',
      });
    }

    return res.json({
      success: true,
      campaign: result.rows[0],
    });
  } catch (error: any) {
    console.error('Error fetching campaign:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to fetch campaign',
    });
  }
}

/**
 * Create a new campaign
 * POST /api/campaigns/library
 */
export async function createCampaign(req: Request, res: Response) {
  try {
    const {
      workspace_id,
      name,
      objective,
      schedule_days,
      audience,
      budget,
      budget_type,
      copy_primary,
      copy_title,
      cta,
      creative_url,
      creative_type,
      status,
      notes,
      tags,
      platform,
      created_by,
    } = req.body;

    if (!workspace_id || !name) {
      return res.status(400).json({
        success: false,
        error: 'Workspace ID and campaign name are required',
      });
    }

    const pool = getPool();
    const result = await pool.query(
      `
      INSERT INTO campaign_library (
        workspace_id,
        name,
        objective,
        schedule_days,
        audience,
        budget,
        budget_type,
        copy_primary,
        copy_title,
        cta,
        creative_url,
        creative_type,
        status,
        notes,
        tags,
        platform,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *
      `,
      [
        workspace_id,
        name,
        objective || null,
        schedule_days || null,
        audience || null,
        budget || null,
        budget_type || 'total',
        copy_primary || null,
        copy_title || null,
        cta || null,
        creative_url || null,
        creative_type || null,
        status || 'rascunho',
        notes || null,
        tags || null,
        platform || 'Meta',
        created_by || null,
      ]
    );

    console.log(`✅ Created campaign: ${result.rows[0].name}`);

    return res.status(201).json({
      success: true,
      campaign: result.rows[0],
      message: 'Campanha criada com sucesso',
    });
  } catch (error: any) {
    console.error('Error creating campaign:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to create campaign',
    });
  }
}

/**
 * Update a campaign
 * PUT /api/campaigns/library/:id
 */
export async function updateCampaign(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const {
      name,
      objective,
      schedule_days,
      audience,
      budget,
      budget_type,
      copy_primary,
      copy_title,
      cta,
      creative_url,
      creative_type,
      status,
      notes,
      tags,
      platform,
    } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Campaign ID is required',
      });
    }

    const pool = getPool();

    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    const fields = {
      name,
      objective,
      schedule_days,
      audience,
      budget,
      budget_type,
      copy_primary,
      copy_title,
      cta,
      creative_url,
      creative_type,
      status,
      notes,
      tags,
      platform,
    };

    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        paramCount++;
        updates.push(`${key} = $${paramCount}`);
        values.push(value);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update',
      });
    }

    paramCount++;
    values.push(id);

    const query = `
      UPDATE campaign_library
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found',
      });
    }

    console.log(`✅ Updated campaign: ${result.rows[0].name}`);

    return res.json({
      success: true,
      campaign: result.rows[0],
      message: 'Campanha atualizada com sucesso',
    });
  } catch (error: any) {
    console.error('Error updating campaign:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to update campaign',
    });
  }
}

/**
 * Delete a campaign
 * DELETE /api/campaigns/library/:id
 */
export async function deleteCampaign(req: Request, res: Response) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Campaign ID is required',
      });
    }

    const pool = getPool();
    const result = await pool.query(
      'DELETE FROM campaign_library WHERE id = $1 RETURNING name',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found',
      });
    }

    console.log(`✅ Deleted campaign: ${result.rows[0].name}`);

    return res.json({
      success: true,
      message: 'Campanha excluída com sucesso',
    });
  } catch (error: any) {
    console.error('Error deleting campaign:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to delete campaign',
    });
  }
}

/**
 * Copy a campaign (creates a duplicate with draft status)
 * POST /api/campaigns/library/:id/copy
 */
export async function copyCampaign(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { workspace_id } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Campaign ID is required',
      });
    }

    const pool = getPool();

    // Get original campaign
    const original = await pool.query(
      'SELECT * FROM campaign_library WHERE id = $1',
      [id]
    );

    if (original.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found',
      });
    }

    const campaign = original.rows[0];

    // Create copy with new name and draft status
    const result = await pool.query(
      `
      INSERT INTO campaign_library (
        workspace_id,
        name,
        objective,
        schedule_days,
        audience,
        budget,
        budget_type,
        copy_primary,
        copy_title,
        cta,
        creative_url,
        creative_type,
        status,
        notes,
        tags,
        platform
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
      `,
      [
        workspace_id || campaign.workspace_id,
        `${campaign.name} (Cópia)`,
        campaign.objective,
        campaign.schedule_days,
        campaign.audience,
        campaign.budget,
        campaign.budget_type,
        campaign.copy_primary,
        campaign.copy_title,
        campaign.cta,
        campaign.creative_url,
        campaign.creative_type,
        'rascunho', // Always set copies to draft
        campaign.notes ? `${campaign.notes}\n\n[Copiado da campanha original]` : '[Copiado da campanha original]',
        campaign.tags,
        campaign.platform,
      ]
    );

    // Update last_used_at on original campaign
    await pool.query(
      'UPDATE campaign_library SET last_used_at = now() WHERE id = $1',
      [id]
    );

    console.log(`✅ Copied campaign: ${campaign.name} -> ${result.rows[0].name}`);

    return res.status(201).json({
      success: true,
      campaign: result.rows[0],
      message: 'Campanha copiada com sucesso',
    });
  } catch (error: any) {
    console.error('Error copying campaign:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to copy campaign',
    });
  }
}

/**
 * Upload creative file to Supabase Storage
 * POST /api/campaigns/library/upload
 */
export async function uploadCreative(req: Request, res: Response) {
  try {
    const { file, filename, contentType, workspaceId } = req.body;

    if (!file || !filename || !workspaceId) {
      return res.status(400).json({
        success: false,
        error: 'File, filename, and workspace ID are required',
      });
    }

    // In a production setup, you would upload to Supabase Storage here
    // For now, we'll return the file data URL
    // This will be implemented in the frontend using Supabase client

    return res.json({
      success: true,
      message: 'File upload should be handled via Supabase client in frontend',
      url: file, // Return the data URL for now
    });
  } catch (error: any) {
    console.error('Error uploading creative:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to upload creative',
    });
  }
}
