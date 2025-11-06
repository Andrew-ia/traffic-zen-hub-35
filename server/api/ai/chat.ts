import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { generateAIResponse } from '../../services/aiService';

const router = Router();
const pool = new Pool({
  connectionString: process.env.SUPABASE_DATABASE_URL,
});

interface SendMessageBody {
  conversationId?: string;
  message: string;
  workspaceId: string;
}

/**
 * POST /api/ai/chat
 * Send a message and get AI response
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { conversationId, message, workspaceId }: SendMessageBody = req.body;

    if (!message || !workspaceId) {
      return res.status(400).json({
        success: false,
        error: 'Message and workspaceId are required',
      });
    }

    let convId = conversationId;

    // Create new conversation if needed
    if (!convId) {
      const result = await pool.query(
        `INSERT INTO chat_conversations (workspace_id, title)
         VALUES ($1, $2)
         RETURNING id`,
        [workspaceId, generateTitle(message)]
      );
      convId = result.rows[0].id;
    }

    // Save user message
    await pool.query(
      `INSERT INTO chat_messages (conversation_id, role, content)
       VALUES ($1, 'user', $2)`,
      [convId, message]
    );

    // Get conversation history
    const historyResult = await pool.query(
      `SELECT role, content
       FROM chat_messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC
       LIMIT 20`,
      [convId]
    );

    const history = historyResult.rows.slice(0, -1); // Exclude the message we just added

    // Generate AI response
    const aiResponse = await generateAIResponse(message, history, workspaceId);

    // Save AI message
    const metadata = aiResponse.dataContext ? { dataContext: aiResponse.dataContext } : {};
    const aiMessageResult = await pool.query(
      `INSERT INTO chat_messages (conversation_id, role, content, metadata)
       VALUES ($1, 'assistant', $2, $3::jsonb)
       RETURNING *`,
      [convId, aiResponse.content, JSON.stringify(metadata)]
    );

    return res.json({
      success: true,
      conversationId: convId,
      message: aiMessageResult.rows[0],
    });
  } catch (error) {
    console.error('Chat API Error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * Generate conversation title from first message
 */
function generateTitle(message: string): string {
  const truncated = message.substring(0, 50);
  return truncated.length < message.length ? `${truncated}...` : truncated;
}

export default router;
