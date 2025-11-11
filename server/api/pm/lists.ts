import type { Request, Response } from 'express';
import { getPool } from '../../config/database.js';

/**
 * PM Lists API endpoints
 * Manages lists within folders
 */

export interface PMList {
  id: string;
  workspace_id: string;
  folder_id: string;
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
 * Get all lists for a folder
 * GET /api/pm/lists/:workspaceId/:folderId
 */
export async function getLists(req: Request, res: Response) {
  try {
    const { workspaceId, folderId } = req.params;
    const { status = 'active' } = req.query;

    if (!workspaceId || !folderId) {
      return res.status(400).json({
        success: false,
        error: 'Workspace ID and Folder ID are required',
      });
    }

    const pool = getPool();
    const query = `
      SELECT *
      FROM pm_lists
      WHERE workspace_id = $1
        AND folder_id = $2
        AND status = $3
      ORDER BY position ASC, created_at ASC
    `;

    const result = await pool.query(query, [workspaceId, folderId, status]);

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Error fetching lists:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch lists',
    });
  }
}

/**
 * Get all lists for a workspace (across all folders)
 * GET /api/pm/lists/:workspaceId
 */
export async function getAllListsForWorkspace(req: Request, res: Response) {
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
      FROM pm_lists
      WHERE workspace_id = $1
        AND status = $2
      ORDER BY folder_id, position ASC, created_at ASC
    `;

    const result = await pool.query(query, [workspaceId, status]);

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Error fetching lists:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch lists',
    });
  }
}

/**
 * Get list by ID
 * GET /api/pm/lists/:workspaceId/:folderId/:listId
 */
export async function getListById(req: Request, res: Response) {
  try {
    const { workspaceId, listId } = req.params;

    if (!workspaceId || !listId) {
      return res.status(400).json({
        success: false,
        error: 'Workspace ID and List ID are required',
      });
    }

    const pool = getPool();
    const query = `
      SELECT *
      FROM pm_lists
      WHERE id = $1 AND workspace_id = $2
    `;

    const result = await pool.query(query, [listId, workspaceId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'List not found',
      });
    }

    return res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error fetching list:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch list',
    });
  }
}

/**
 * Create a new list
 * POST /api/pm/lists/:workspaceId/:folderId
 */
export async function createList(req: Request, res: Response) {
  try {
    const { workspaceId, folderId } = req.params;
    const { name, icon, color, description, position } = req.body;

    if (!workspaceId || !folderId || !name) {
      return res.status(400).json({
        success: false,
        error: 'Workspace ID, Folder ID, and name are required',
      });
    }

    const pool = getPool();

    // Get the next position if not provided
    let finalPosition = position;
    if (finalPosition === undefined) {
      const posResult = await pool.query(
        'SELECT COALESCE(MAX(position), 0) + 1 as next_position FROM pm_lists WHERE folder_id = $1',
        [folderId]
      );
      finalPosition = posResult.rows[0].next_position;
    }

    const query = `
      INSERT INTO pm_lists (workspace_id, folder_id, name, icon, color, description, position)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const result = await pool.query(query, [
      workspaceId,
      folderId,
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
    console.error('Error creating list:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create list',
    });
  }
}

/**
 * Update a list
 * PUT /api/pm/lists/:workspaceId/:listId
 */
export async function updateList(req: Request, res: Response) {
  try {
    const { workspaceId, listId } = req.params;
    const { name, icon, color, description, position, status } = req.body;

    if (!workspaceId || !listId) {
      return res.status(400).json({
        success: false,
        error: 'Workspace ID and List ID are required',
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

    values.push(listId, workspaceId);

    const query = `
      UPDATE pm_lists
      SET ${updates.join(', ')}, updated_at = now()
      WHERE id = $${paramCount++} AND workspace_id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'List not found',
      });
    }

    return res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error updating list:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update list',
    });
  }
}

/**
 * Delete a list
 * DELETE /api/pm/lists/:workspaceId/:listId
 */
export async function deleteList(req: Request, res: Response) {
  try {
    const { workspaceId, listId } = req.params;

    if (!workspaceId || !listId) {
      return res.status(400).json({
        success: false,
        error: 'Workspace ID and List ID are required',
      });
    }

    const pool = getPool();
    const query = `
      DELETE FROM pm_lists
      WHERE id = $1 AND workspace_id = $2
      RETURNING *
    `;

    const result = await pool.query(query, [listId, workspaceId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'List not found',
      });
    }

    return res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error deleting list:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete list',
    });
  }
}
