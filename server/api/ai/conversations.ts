import { Router, Request, Response } from 'express';
import { getPool } from '../../config/database.js';

const router = Router();
const pool = getPool();

/**
 * GET /api/ai/conversations?workspaceId=xxx
 * Get all conversations for a workspace
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { workspaceId } = req.query;

    if (!workspaceId) {
      return res.status(400).json({
        success: false,
        error: 'workspaceId is required',
      });
    }

    const result = await pool.query(
      `SELECT id, workspace_id, title, created_at, updated_at
       FROM chat_conversations
       WHERE workspace_id = $1
       ORDER BY updated_at DESC
       LIMIT 50`,
      [workspaceId]
    );

    return res.json({
      success: true,
      conversations: result.rows,
    });
  } catch (error) {
    console.error('Get Conversations Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/ai/conversations/:id
 * Get a specific conversation with all messages
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get conversation
    const convResult = await pool.query(
      `SELECT * FROM chat_conversations WHERE id = $1`,
      [id]
    );

    if (convResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found',
      });
    }

    // Get messages
    const messagesResult = await pool.query(
      `SELECT * FROM chat_messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC`,
      [id]
    );

    const conversation = {
      ...convResult.rows[0],
      messages: messagesResult.rows,
    };

    return res.json({
      success: true,
      conversation,
    });
  } catch (error) {
    console.error('Get Conversation Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * DELETE /api/ai/conversations/:id
 * Delete a conversation
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await pool.query(
      `DELETE FROM chat_conversations WHERE id = $1`,
      [id]
    );

    return res.json({
      success: true,
    });
  } catch (error) {
    console.error('Delete Conversation Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

export default router;
