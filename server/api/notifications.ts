import type { Request, Response } from 'express';
import { getPool } from '../config/database.js';

/**
 * Notifications API endpoints
 */

export interface Notification {
    id: string;
    user_id: string;
    type: 'message' | 'mention' | 'task_assignment' | 'reminder' | 'system';
    title: string;
    message: string;
    link?: string;
    read: boolean;
    created_at: string;
    metadata?: Record<string, any>;
}

/**
 * Get unread notifications for a user
 * GET /api/notifications/:userId
 */
export async function getUnreadNotifications(req: Request, res: Response) {
    try {
        const { userId } = req.params;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'User ID is required',
            });
        }

        const pool = getPool();
        const query = `
      SELECT *
      FROM notifications
      WHERE user_id = $1 AND read = false
      ORDER BY created_at DESC
      LIMIT 50
    `;

        const result = await pool.query(query, [userId]);

        return res.json({
            success: true,
            data: result.rows,
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch notifications',
        });
    }
}

/**
 * Mark notification as read
 * PUT /api/notifications/:id/read
 */
export async function markAsRead(req: Request, res: Response) {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'Notification ID is required',
            });
        }

        const pool = getPool();
        const query = `
      UPDATE notifications
      SET read = true
      WHERE id = $1
      RETURNING *
    `;

        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Notification not found',
            });
        }

        return res.json({
            success: true,
            data: result.rows[0],
        });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to update notification',
        });
    }
}

/**
 * Helper to create a notification (internal use)
 */
export async function createNotification(
    userId: string,
    type: Notification['type'],
    title: string,
    message: string,
    link?: string,
    metadata?: Record<string, any>
) {
    try {
        const pool = getPool();
        const query = `
      INSERT INTO notifications (user_id, type, title, message, link, metadata)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

        console.log('[createNotification] Creating notification:', {
            userId,
            type,
            title,
            message,
            link,
            metadata
        });

        const result = await pool.query(query, [
            userId,
            type,
            title,
            message,
            link || null,
            metadata ? JSON.stringify(metadata) : '{}',
        ]);

        console.log('[createNotification] Notification created successfully:', result.rows[0]);
        return result.rows[0];
    } catch (error) {
        console.error('[createNotification] Error creating notification:', error);
        console.error('[createNotification] Error details:', {
            userId,
            type,
            title,
            message,
            link,
            metadata,
            errorMessage: error instanceof Error ? error.message : String(error),
            errorStack: error instanceof Error ? error.stack : undefined
        });
        throw error; // Throw instead of returning null so we can see the actual error
    }
}

/**
 * Create a notification (API endpoint)
 * POST /api/notifications
 */
export async function createNotificationHandler(req: Request, res: Response) {
    try {
        const { userId, type, title, message, link, metadata } = req.body;

        if (!userId || !type || !title || !message) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields',
            });
        }

        const notification = await createNotification(userId, type, title, message, link, metadata);

        if (!notification) {
            return res.status(500).json({
                success: false,
                error: 'Failed to create notification',
            });
        }

        return res.status(201).json({
            success: true,
            data: notification,
        });
    } catch (error) {
        console.error('Error creating notification:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to create notification',
        });
    }
}

