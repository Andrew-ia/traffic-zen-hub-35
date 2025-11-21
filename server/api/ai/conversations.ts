
import { Router, Request, Response } from 'express';
import { getPool } from '../../config/database.js';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { workspaceId } = req.query;
    const userId = (req as any).user?.id;

    if (!workspaceId) {
      return res.status(400).json({ success: false, error: 'Workspace ID is required' });
    }

    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM chat_conversations 
       WHERE workspace_id = $1 AND user_id = $2 
       ORDER BY updated_at DESC`,
      [workspaceId, userId]
    );

    return res.status(200).json({
      success: true,
      conversations: result.rows
    });
  } catch (error) {
    console.error('Get Conversations Error:', error);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    const convResult = await pool.query(
      `SELECT * FROM chat_conversations WHERE id = $1`,
      [id]
    );

    if (convResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    const msgsResult = await pool.query(
      `SELECT * FROM chat_messages WHERE conversation_id = $1 ORDER BY created_at ASC`,
      [id]
    );

    return res.status(200).json({
      success: true,
      conversation: {
        ...convResult.rows[0],
        messages: msgsResult.rows
      }
    });
  } catch (error) {
    console.error('Get Conversation Error:', error);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    await pool.query(`DELETE FROM chat_messages WHERE conversation_id = $1`, [id]);
    await pool.query(`DELETE FROM chat_conversations WHERE id = $1`, [id]);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Delete Conversation Error:', error);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

export default router;
