import type { Request, Response } from 'express';
import { getPool } from '../../config/database.js';
import { createNotification } from '../notifications.js';

/**
 * PM Tasks API endpoints
 * Manages tasks within lists
 */

export type TaskStatus = 'pendente' | 'em_andamento' | 'concluido' | 'bloqueado' | 'cancelado';
export type TaskPriority = 'baixa' | 'media' | 'alta' | 'urgente';

export interface PMTask {
  id: string;
  workspace_id: string;
  folder_id: string;
  list_id: string;
  parent_task_id?: string;
  name: string;
  description?: string;
  status: TaskStatus;
  priority?: TaskPriority;
  assignee_id?: string;
  due_date?: string;
  start_date?: string;
  completed_at?: string;
  position: number;
  tags?: string[];
  metadata?: Record<string, any>;
  estimated_hours?: number;
  actual_hours?: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Get all tasks for a list
 * GET /api/pm/tasks/:workspaceId/:listId
 */
export async function getTasks(req: Request, res: Response) {
  try {
    const { workspaceId, listId } = req.params;
    const { status, priority, assignee_id } = req.query;

    if (!workspaceId || !listId) {
      return res.status(400).json({
        success: false,
        error: 'Workspace ID and List ID are required',
      });
    }

    const pool = getPool();
    let query = `
      SELECT *
      FROM pm_tasks_full
      WHERE workspace_id = $1 AND list_id = $2
    `;

    const params: any[] = [workspaceId, listId];
    let paramCount = 3;

    if (status) {
      query += ` AND status = $${paramCount++}`;
      params.push(status);
    }

    if (priority) {
      query += ` AND priority = $${paramCount++}`;
      params.push(priority);
    }

    if (assignee_id) {
      query += ` AND assignee_id = $${paramCount++}`;
      params.push(assignee_id);
    }

    query += ` ORDER BY position ASC, created_at ASC`;

    const result = await pool.query(query, params);

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch tasks',
    });
  }
}

/**
 * Get all tasks for a workspace (across all lists)
 * GET /api/pm/tasks/:workspaceId
 */
export async function getAllTasksForWorkspace(req: Request, res: Response) {
  try {
    const { workspaceId } = req.params;
    const { status, priority, assignee_id, folder_id } = req.query;

    if (!workspaceId) {
      return res.status(400).json({
        success: false,
        error: 'Workspace ID is required',
      });
    }

    const pool = getPool();
    let query = `
      SELECT *
      FROM pm_tasks_full
      WHERE workspace_id = $1
    `;

    const params: any[] = [workspaceId];
    let paramCount = 2;

    if (status) {
      query += ` AND status = $${paramCount++}`;
      params.push(status);
    }

    if (priority) {
      query += ` AND priority = $${paramCount++}`;
      params.push(priority);
    }

    if (assignee_id) {
      query += ` AND assignee_id = $${paramCount++}`;
      params.push(assignee_id);
    }

    if (folder_id) {
      query += ` AND folder_id = $${paramCount++}`;
      params.push(folder_id);
    }

    query += ` ORDER BY list_id, position ASC, created_at ASC`;

    const result = await pool.query(query, params);

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch tasks',
    });
  }
}

/**
 * Get task by ID
 * GET /api/pm/tasks/:workspaceId/:taskId/details
 */
export async function getTaskById(req: Request, res: Response) {
  try {
    const { workspaceId, taskId } = req.params;

    if (!workspaceId || !taskId) {
      return res.status(400).json({
        success: false,
        error: 'Workspace ID and Task ID are required',
      });
    }

    const pool = getPool();
    const query = `
      SELECT *
      FROM pm_tasks_full
      WHERE id = $1 AND workspace_id = $2
    `;

    const result = await pool.query(query, [taskId, workspaceId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    return res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error fetching task:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch task',
    });
  }
}

/**
 * Create a new task
 * POST /api/pm/tasks/:workspaceId/:listId
 */
export async function createTask(req: Request, res: Response) {
  try {
    const { workspaceId, listId } = req.params;
    const {
      folder_id,
      name,
      description,
      status = 'pendente',
      priority = 'media',
      assignee_id,
      due_date,
      start_date,
      position,
      tags,
      metadata,
      estimated_hours,
      parent_task_id,
      created_by,
    } = req.body;

    console.log('📝 Creating task with body:', { folder_id, name, description, status, priority });

    if (!workspaceId || !listId || !folder_id || !name) {
      return res.status(400).json({
        success: false,
        error: 'Workspace ID, Folder ID, List ID, and name are required',
      });
    }

    const pool = getPool();

    // Get the next position if not provided
    let finalPosition = position;
    if (finalPosition === undefined) {
      const posResult = await pool.query(
        'SELECT COALESCE(MAX(position), 0) + 1 as next_position FROM pm_tasks WHERE list_id = $1',
        [listId]
      );
      finalPosition = posResult.rows[0].next_position;
    }

    const query = `
      INSERT INTO pm_tasks (
        workspace_id, folder_id, list_id, parent_task_id,
        name, description, status, priority,
        assignee_id, due_date, start_date, position,
        tags, metadata, estimated_hours, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `;

    const result = await pool.query(query, [
      workspaceId,
      folder_id,
      listId,
      parent_task_id || null,
      name,
      description || null,
      status,
      priority,
      assignee_id || null,
      due_date || null,
      start_date || null,
      finalPosition,
      tags || [],
      metadata || {},
      estimated_hours || null,
      created_by || null,
    ]);

    // Log activity
    await pool.query(
      `INSERT INTO pm_task_activity (task_id, user_id, action, metadata)
       VALUES ($1, $2, 'created', $3)`,
      [result.rows[0].id, created_by || null, { task_name: name }]
    );

    // Create notification for assignee if different from creator
    if (assignee_id && assignee_id !== created_by) {
      await createNotification(
        assignee_id,
        'task_assignment',
        'Nova tarefa atribuída',
        `Você foi atribuído à tarefa "${name}"`,
        `/project-management?taskId=${result.rows[0].id}`,
        { taskId: result.rows[0].id, taskName: name }
      );
    }

    return res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error creating task:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create task',
    });
  }
}

/**
 * Update a task
 * PUT /api/pm/tasks/:workspaceId/:taskId
 */
export async function updateTask(req: Request, res: Response) {
  try {
    const { workspaceId, taskId } = req.params;
    const {
      name,
      description,
      status,
      priority,
      assignee_id,
      due_date,
      start_date,
      completed_at,
      position,
      tags,
      metadata,
      estimated_hours,
      actual_hours,
    } = req.body;

    if (!workspaceId || !taskId) {
      return res.status(400).json({
        success: false,
        error: 'Workspace ID and Task ID are required',
      });
    }

    const pool = getPool();

    // Get current task data for activity logging
    const currentTask = await pool.query(
      'SELECT * FROM pm_tasks WHERE id = $1 AND workspace_id = $2',
      [taskId, workspaceId]
    );

    if (currentTask.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);

      // Auto-set completed_at if status changed to 'concluido'
      if (status === 'concluido' && !currentTask.rows[0].completed_at) {
        updates.push(`completed_at = now()`);
      }
    }
    if (priority !== undefined) {
      updates.push(`priority = $${paramCount++}`);
      values.push(priority);
    }
    if (assignee_id !== undefined) {
      updates.push(`assignee_id = $${paramCount++}`);
      values.push(assignee_id);
    }
    if (due_date !== undefined) {
      updates.push(`due_date = $${paramCount++}`);
      values.push(due_date);
    }
    if (start_date !== undefined) {
      updates.push(`start_date = $${paramCount++}`);
      values.push(start_date);
    }
    if (completed_at !== undefined) {
      updates.push(`completed_at = $${paramCount++}`);
      values.push(completed_at);
    }
    if (position !== undefined) {
      updates.push(`position = $${paramCount++}`);
      values.push(position);
    }
    if (tags !== undefined) {
      updates.push(`tags = $${paramCount++}`);
      values.push(tags);
    }
    if (metadata !== undefined) {
      updates.push(`metadata = $${paramCount++}`);
      values.push(metadata);
    }
    if (estimated_hours !== undefined) {
      updates.push(`estimated_hours = $${paramCount++}`);
      values.push(estimated_hours);
    }
    if (actual_hours !== undefined) {
      updates.push(`actual_hours = $${paramCount++}`);
      values.push(actual_hours);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update',
      });
    }

    values.push(taskId, workspaceId);

    const query = `
      UPDATE pm_tasks
      SET ${updates.join(', ')}, updated_at = now()
      WHERE id = $${paramCount++} AND workspace_id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    // Log activity for status changes
    if (status !== undefined && status !== currentTask.rows[0].status) {
      await pool.query(
        `INSERT INTO pm_task_activity (task_id, user_id, action, field_name, old_value, new_value)
         VALUES ($1, $2, 'status_changed', 'status', $3, $4)`,
        [taskId, assignee_id || null, currentTask.rows[0].status, status]
      );

      // Notify assignee about status change
      const currentAssignee = assignee_id || currentTask.rows[0].assignee_id;
      if (currentAssignee) {
        await createNotification(
          currentAssignee,
          'task_assignment',
          'Status da tarefa atualizado',
          `A tarefa "${currentTask.rows[0].name}" mudou para ${status}`,
          `/project-management?taskId=${taskId}`,
          { taskId, taskName: currentTask.rows[0].name, oldStatus: currentTask.rows[0].status, newStatus: status }
        );
      }
    }

    // Notify new assignee
    if (assignee_id && assignee_id !== currentTask.rows[0].assignee_id) {
      await createNotification(
        assignee_id,
        'task_assignment',
        'Nova tarefa atribuída',
        `Você foi atribuído à tarefa "${currentTask.rows[0].name}"`,
        `/project-management?taskId=${taskId}`,
        { taskId, taskName: currentTask.rows[0].name }
      );
    }

    return res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error updating task:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update task',
    });
  }
}

/**
 * Delete a task
 * DELETE /api/pm/tasks/:workspaceId/:taskId
 */
export async function deleteTask(req: Request, res: Response) {
  try {
    const { workspaceId, taskId } = req.params;

    if (!workspaceId || !taskId) {
      return res.status(400).json({
        success: false,
        error: 'Workspace ID and Task ID are required',
      });
    }

    const pool = getPool();
    const query = `
      DELETE FROM pm_tasks
      WHERE id = $1 AND workspace_id = $2
      RETURNING *
    `;

    const result = await pool.query(query, [taskId, workspaceId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    return res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error deleting task:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete task',
    });
  }
}

/**
 * Upload attachment to task
 * POST /api/pm/tasks/:taskId/attachments
 */
export async function uploadTaskAttachment(req: Request, res: Response) {
  try {
    const { taskId } = req.params;
    const { file_name, file_url, file_type, file_size } = req.body;

    if (!taskId) {
      return res.status(400).json({ success: false, error: 'Task ID is required' });
    }
    if (!file_name || !file_url) {
      return res.status(400).json({ success: false, error: 'file_name and file_url are required' });
    }

    const pool = getPool();

    // Determine the user to attribute the upload to
    // First, check if user_id is provided in request body
    let userId = (req.body as any).user_id || null;

    // If not provided, try to get from task
    if (!userId) {
      const taskUserResult = await pool.query(
        'SELECT created_by, assignee_id FROM pm_tasks WHERE id = $1',
        [taskId]
      );
      const taskUserRow = taskUserResult.rows[0];
      userId = taskUserRow?.created_by || taskUserRow?.assignee_id || null;
    }

    // user_id can be null if task has no creator/assignee and user doesn't provide one
    // This is acceptable for system-created tasks

    const query = `
      INSERT INTO pm_task_attachments (task_id, user_id, file_name, file_url, file_type, file_size)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const result = await pool.query(query, [
      taskId,
      userId,
      file_name,
      file_url,
      file_type || null,
      file_size || null,
    ]);

    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error uploading task attachment:', error);
    return res.status(500).json({ success: false, error: 'Failed to upload task attachment' });
  }
}

/**
 * Get attachments for a task
 * GET /api/pm/tasks/:taskId/attachments
 */
export async function getTaskAttachments(req: Request, res: Response) {
  try {
    const { taskId } = req.params;

    if (!taskId) {
      return res.status(400).json({ success: false, error: 'Task ID is required' });
    }

    const pool = getPool();
    const query = `
      SELECT *
      FROM pm_task_attachments
      WHERE task_id = $1
      ORDER BY uploaded_at DESC
    `;
    const result = await pool.query(query, [taskId]);

    return res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching task attachments:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch task attachments' });
  }
}

/**
 * Delete attachment from task
 * DELETE /api/pm/tasks/:taskId/attachments/:attachmentId
 */
export async function deleteTaskAttachment(req: Request, res: Response) {
  try {
    const { taskId, attachmentId } = req.params as { taskId?: string; attachmentId?: string };

    if (!taskId || !attachmentId) {
      return res.status(400).json({ success: false, error: 'Task ID and Attachment ID are required' });
    }

    const pool = getPool();
    const query = `
      DELETE FROM pm_task_attachments
      WHERE id = $1 AND task_id = $2
      RETURNING *
    `;

    const result = await pool.query(query, [attachmentId, taskId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Attachment not found for this task' });
    }

    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error deleting task attachment:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete task attachment' });
  }
}
