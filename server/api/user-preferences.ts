import { Request, Response } from 'express';
import { getPool } from '../config/database.js';

/**
 * Get user preferences
 */
export async function getUserPreferences(req: Request, res: Response) {
    const { userId } = req.params;

    try {
        const pool = getPool();
        const { rows } = await pool.query(
            'SELECT avatar_style, avatar_seed FROM user_preferences WHERE user_id = $1',
            [userId]
        );

        if (rows.length === 0) {
            return res.json({
                success: true,
                data: null
            });
        }

        return res.json({
            success: true,
            data: rows[0]
        });
    } catch (error) {
        console.error('Error fetching user preferences:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch user preferences'
        });
    }
}

/**
 * Update user preferences
 */
export async function updateUserPreferences(req: Request, res: Response) {
    const { userId } = req.params;
    const { avatar_style, avatar_seed } = req.body;

    try {
        const pool = getPool();
        const { rows } = await pool.query(
            `INSERT INTO user_preferences (user_id, avatar_style, avatar_seed, updated_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (user_id)
             DO UPDATE SET
                 avatar_style = $2,
                 avatar_seed = $3,
                 updated_at = NOW()
             RETURNING avatar_style, avatar_seed`,
            [userId, avatar_style, avatar_seed]
        );

        return res.json({
            success: true,
            data: rows[0]
        });
    } catch (error) {
        console.error('Error updating user preferences:', error);
        console.error('Error details:', {
            userId,
            avatar_style,
            avatar_seed,
            errorMessage: error instanceof Error ? error.message : String(error),
            errorStack: error instanceof Error ? error.stack : undefined
        });
        return res.status(500).json({
            success: false,
            error: 'Failed to update user preferences',
            details: error instanceof Error ? error.message : String(error)
        });
    }
}
