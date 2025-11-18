import { Request, Response } from 'express';
import { getPool } from '../../config/database.js';

/**
 * Create a new reminder
 * POST /api/pm/reminders/:workspaceId/:listId
 */
export async function createReminder(req: Request, res: Response) {
  try {
    const { workspaceId, listId } = req.params;
    const {
      folder_id,
      name,
      description,
      due_date,
      notify_via = 'email',
      email,
      phone,
      telegram_chat_id,
      position,
      assignee_id,
    } = req.body;

    console.log('🔔 Creating reminder with body:', { folder_id, name, due_date, notify_via, email, phone });

    if (!workspaceId || !listId || !folder_id || !name || !due_date) {
      return res.status(400).json({
        success: false,
        error: 'Workspace ID, Folder ID, List ID, name, and due_date are required',
      });
    }

    // Validate notification channel has corresponding contact info
    if (notify_via === 'email' && !email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required when notify_via is "email"',
      });
    }
    if (notify_via === 'whatsapp' && !phone) {
      return res.status(400).json({
        success: false,
        error: 'Phone is required when notify_via is "whatsapp"',
      });
    }
    if (notify_via === 'telegram' && !telegram_chat_id) {
      return res.status(400).json({
        success: false,
        error: 'Telegram chat ID is required when notify_via is "telegram"',
      });
    }
    if (notify_via === 'all' && !email && !phone && !telegram_chat_id) {
      return res.status(400).json({
        success: false,
        error: 'At least one contact method is required when notify_via is "all"',
      });
    }

    const pool = getPool();

    // Get the next position if not provided
    let finalPosition = position;
    if (finalPosition === undefined) {
      const posResult = await pool.query(
        'SELECT COALESCE(MAX(position), 0) + 1 as next_position FROM pm_reminders WHERE list_id = $1',
        [listId]
      );
      finalPosition = posResult.rows[0].next_position;
    }

    const query = `
      INSERT INTO pm_reminders (
        workspace_id, folder_id, list_id,
        name, description, due_date,
        notify_via, email, phone, telegram_chat_id,
        position, assignee_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const result = await pool.query(query, [
      workspaceId,
      folder_id,
      listId,
      name,
      description || null,
      due_date,
      notify_via,
      email || null,
      phone || null,
      telegram_chat_id || null,
      finalPosition,
      assignee_id || null,
    ]);

    return res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error creating reminder:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create reminder',
    });
  }
}

/**
 * Get all reminders for a workspace or list
 * GET /api/pm/reminders/:workspaceId/:listId?
 */
export async function getReminders(req: Request, res: Response) {
  try {
    const { workspaceId, listId } = req.params;
    const { status } = req.query;

    const pool = getPool();

    let query;
    let params;

    if (listId) {
      if (status) {
        query = `
          SELECT r.*,
                 f.name as folder_name,
                 f.icon as folder_icon,
                 l.name as list_name,
                 l.icon as list_icon,
                 u.full_name as assignee_name,
                 u.email as assignee_email
          FROM pm_reminders r
          JOIN pm_folders f ON r.folder_id = f.id
          JOIN pm_lists l ON r.list_id = l.id
          LEFT JOIN users u ON r.assignee_id = u.id
          WHERE r.workspace_id = $1 AND r.list_id = $2 AND r.status = $3
          ORDER BY r.due_date ASC, r.position ASC
        `;
        params = [workspaceId, listId, status];
      } else {
        query = `
          SELECT r.*,
                 f.name as folder_name,
                 f.icon as folder_icon,
                 l.name as list_name,
                 l.icon as list_icon,
                 u.full_name as assignee_name,
                 u.email as assignee_email
          FROM pm_reminders r
          JOIN pm_folders f ON r.folder_id = f.id
          JOIN pm_lists l ON r.list_id = l.id
          LEFT JOIN users u ON r.assignee_id = u.id
          WHERE r.workspace_id = $1 AND r.list_id = $2
          ORDER BY r.due_date ASC, r.position ASC
        `;
        params = [workspaceId, listId];
      }
    } else {
      if (status) {
        query = `
          SELECT r.*,
                 f.name as folder_name,
                 f.icon as folder_icon,
                 l.name as list_name,
                 l.icon as list_icon,
                 u.full_name as assignee_name,
                 u.email as assignee_email
          FROM pm_reminders r
          JOIN pm_folders f ON r.folder_id = f.id
          JOIN pm_lists l ON r.list_id = l.id
          LEFT JOIN users u ON r.assignee_id = u.id
          WHERE r.workspace_id = $1 AND r.status = $2
          ORDER BY r.due_date ASC, r.position ASC
        `;
        params = [workspaceId, status];
      } else {
        query = `
          SELECT r.*,
                 f.name as folder_name,
                 f.icon as folder_icon,
                 l.name as list_name,
                 l.icon as list_icon,
                 u.full_name as assignee_name,
                 u.email as assignee_email
          FROM pm_reminders r
          JOIN pm_folders f ON r.folder_id = f.id
          JOIN pm_lists l ON r.list_id = l.id
          LEFT JOIN users u ON r.assignee_id = u.id
          WHERE r.workspace_id = $1
          ORDER BY r.due_date ASC, r.position ASC
        `;
        params = [workspaceId];
      }
    }

    const result = await pool.query(query, params);

    return res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Error fetching reminders:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch reminders',
    });
  }
}

/**
 * Get pending reminders that need to be sent
 * GET /api/pm/reminders/pending
 */
export async function getPendingReminders(req: Request, res: Response) {
  try {
    const pool = getPool();

    const query = `
      SELECT r.*,
             f.name as folder_name,
             l.name as list_name
      FROM pm_reminders r
      JOIN pm_folders f ON r.folder_id = f.id
      JOIN pm_lists l ON r.list_id = l.id
      WHERE r.status = 'pending'
        AND r.notification_sent = false
        AND r.due_date <= NOW()
      ORDER BY r.due_date ASC
      LIMIT 100
    `;

    const result = await pool.query(query);

    return res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Error fetching pending reminders:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch pending reminders',
    });
  }
}

/**
 * Mark reminder as sent
 * POST /api/pm/reminders/:reminderId/mark-sent
 */
export async function markReminderAsSent(req: Request, res: Response) {
  try {
    const { reminderId } = req.params;

    const pool = getPool();

    const query = `
      UPDATE pm_reminders
      SET notification_sent = true,
          notification_sent_at = NOW(),
          status = 'sent',
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(query, [reminderId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Reminder not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error marking reminder as sent:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to mark reminder as sent',
    });
  }
}
