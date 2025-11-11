import type { Request, Response } from 'express';
import { getPool } from '../../config/database.js';

/**
 * PM Folders API endpoints
 * Manages folders within workspaces
 */

export interface PMFolder {
  id: string;
  workspace_id: string;
  name: string;
  icon?: string;
  color?: string;
  description?: string;
  position: number;
  status: 'active' | 'archived';
  created_by?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Get all folders for a workspace
 * GET /api/pm/folders/:workspaceId
 */
export async function getFolders(req: Request, res: Response) {
  try {
    const { workspaceId } = req.params;
    const { status = 'active' } = req.query;

    if (!workspaceId) {
      return res.status(400).json({
        success: false,
        error: 'Workspace ID is required',
      });
    }

    const pool = getPool();
    const query = `
      SELECT *
      FROM pm_folders
      WHERE workspace_id = $1
        AND status = $2
      ORDER BY position ASC, created_at ASC
    `;

    const result = await pool.query(query, [workspaceId, status]);

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Error fetching folders:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch folders',
    });
  }
}

/**
 * Get folder by ID
 * GET /api/pm/folders/:workspaceId/:folderId
 */
export async function getFolderById(req: Request, res: Response) {
  try {
    const { workspaceId, folderId } = req.params;

    if (!workspaceId || !folderId) {
      return res.status(400).json({
        success: false,
        error: 'Workspace ID and Folder ID are required',
      });
    }

    const pool = getPool();
    const query = `
      SELECT *
      FROM pm_folders
      WHERE id = $1 AND workspace_id = $2
    `;

    const result = await pool.query(query, [folderId, workspaceId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Folder not found',
      });
    }

    return res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error fetching folder:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch folder',
    });
  }
}

/**
 * Create a new folder
 * POST /api/pm/folders/:workspaceId
 */
export async function createFolder(req: Request, res: Response) {
  try {
    const { workspaceId } = req.params;
    const { name, icon, color, description, position } = req.body;

    if (!workspaceId || !name) {
      return res.status(400).json({
        success: false,
        error: 'Workspace ID and name are required',
      });
    }

    const pool = getPool();

    // Get the next position if not provided
    let finalPosition = position;
    if (finalPosition === undefined) {
      const posResult = await pool.query(
        'SELECT COALESCE(MAX(position), 0) + 1 as next_position FROM pm_folders WHERE workspace_id = $1',
        [workspaceId]
      );
      finalPosition = posResult.rows[0].next_position;
    }

    const query = `
      INSERT INTO pm_folders (workspace_id, name, icon, color, description, position)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const result = await pool.query(query, [
      workspaceId,
      name,
      icon || null,
      color || null,
      description || null,
      finalPosition,
    ]);

    return res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error creating folder:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create folder',
    });
  }
}

/**
 * Update a folder
 * PUT /api/pm/folders/:workspaceId/:folderId
 */
export async function updateFolder(req: Request, res: Response) {
  try {
    const { workspaceId, folderId } = req.params;
    const { name, icon, color, description, position, status } = req.body;

    if (!workspaceId || !folderId) {
      return res.status(400).json({
        success: false,
        error: 'Workspace ID and Folder ID are required',
      });
    }

    const pool = getPool();
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (icon !== undefined) {
      updates.push(`icon = $${paramCount++}`);
      values.push(icon);
    }
    if (color !== undefined) {
      updates.push(`color = $${paramCount++}`);
      values.push(color);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (position !== undefined) {
      updates.push(`position = $${paramCount++}`);
      values.push(position);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update',
      });
    }

    values.push(folderId, workspaceId);

    const query = `
      UPDATE pm_folders
      SET ${updates.join(', ')}, updated_at = now()
      WHERE id = $${paramCount++} AND workspace_id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Folder not found',
      });
    }

    return res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error updating folder:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update folder',
    });
  }
}

/**
 * Delete a folder
 * DELETE /api/pm/folders/:workspaceId/:folderId
 */
export async function deleteFolder(req: Request, res: Response) {
  try {
    const { workspaceId, folderId } = req.params;

    if (!workspaceId || !folderId) {
      return res.status(400).json({
        success: false,
        error: 'Workspace ID and Folder ID are required',
      });
    }

    const pool = getPool();
    const query = `
      DELETE FROM pm_folders
      WHERE id = $1 AND workspace_id = $2
      RETURNING *
    `;

    const result = await pool.query(query, [folderId, workspaceId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Folder not found',
      });
    }

    return res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error deleting folder:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete folder',
    });
  }
}
