
import { Router, Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getPool } from '../../config/database.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

interface ChatMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

async function buildContext(workspaceId: string): Promise<string> {
  const pool = getPool();

  // 1. KPI Summary (Last 30 Days)
  const summaryQuery = `
    SELECT 
      COALESCE(SUM(spend), 0) as spend,
      COALESCE(SUM(impressions), 0) as impressions,
      COALESCE(SUM(clicks), 0) as clicks,
      COALESCE(SUM(conversions), 0) as conversions,
      COALESCE(SUM(conversations_started), 0) as conversations
    FROM metrics
    WHERE date >= NOW() - INTERVAL '30 days'
  `;

  // 2. Top 5 Campaigns
  const campaignsQuery = `
    SELECT c.name, SUM(m.spend) as spend, SUM(m.conversions) as conversions, SUM(m.conversations_started) as conversations
    FROM campaigns c
    JOIN metrics m ON c.id = m.campaign_id
    WHERE m.date >= NOW() - INTERVAL '30 days'
    GROUP BY c.name
    ORDER BY spend DESC
    LIMIT 5
  `;

  try {
    const [summaryRes, campaignsRes] = await Promise.all([
      pool.query(summaryQuery),
      pool.query(campaignsQuery)
    ]);

    const s = summaryRes.rows[0];
    const campaigns = campaignsRes.rows;

    const ctr = s.impressions > 0 ? ((s.clicks / s.impressions) * 100).toFixed(2) : '0.00';
    const cpc = s.clicks > 0 ? (s.spend / s.clicks).toFixed(2) : '0.00';
    const cpa = s.conversions > 0 ? (s.spend / s.conversions).toFixed(2) : '0.00';
    const costPerConversation = s.conversations > 0 ? (s.spend / s.conversations).toFixed(2) : '0.00';

    let context = `
CURRENT PERFORMANCE CONTEXT (Last 30 Days):

OVERALL METRICS:
- Total Spend: R$ ${s.spend}
- Impressions: ${s.impressions}
- Clicks: ${s.clicks}
- Conversions (Results): ${s.conversions}
- Conversations Started: ${s.conversations}
- CTR: ${ctr}%
- CPC: R$ ${cpc}
- CPA (Cost per Result): R$ ${cpa}
- Cost per Conversation: R$ ${costPerConversation}

TOP 5 CAMPAIGNS (by Spend):
`;

    campaigns.forEach((c, i) => {
      context += `${i + 1}. ${c.name} | Spend: R$ ${c.spend} | Results: ${c.conversions} | Conversations: ${c.conversations}\n`;
    });

    return context;
  } catch (error) {
    console.error('Error building context:', error);
    return "Error fetching performance data.";
  }
}

router.post('/', async (req: Request, res: Response) => {
  try {
    const { message, conversationId, workspaceId } = req.body;
    const userId = (req as any).user?.id; // Assuming auth middleware populates this

    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    const pool = getPool();
    let activeConversationId = conversationId;

    // Create conversation if not exists
    if (!activeConversationId) {
      const title = message.substring(0, 50) + (message.length > 50 ? '...' : '');
      const newConv = await pool.query(
        `INSERT INTO chat_conversations (id, workspace_id, user_id, title) 
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [uuidv4(), workspaceId, userId, title]
      );
      activeConversationId = newConv.rows[0].id;
    }

    // Save User Message
    await pool.query(
      `INSERT INTO chat_messages (id, conversation_id, role, content) 
       VALUES ($1, $2, 'user', $3)`,
      [uuidv4(), activeConversationId, message]
    );

    // Build Context
    const context = await buildContext(workspaceId);

    // Fetch History (Last 10 messages)
    const historyRes = await pool.query(
      `SELECT role, content FROM chat_messages 
       WHERE conversation_id = $1 
       ORDER BY created_at ASC 
       LIMIT 10`,
      [activeConversationId]
    );

    const history: ChatMessage[] = historyRes.rows.map(row => ({
      role: row.role === 'user' ? 'user' : 'model',
      parts: [{ text: row.content }]
    }));

    // Call Gemini
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: `You are an expert Digital Marketing Assistant for the "Traffic Zen Hub" platform.
Your goal is to help the user analyze their campaign performance and suggest optimizations.
You have access to the last 30 days of performance data below.
Use this data to answer the user's questions accurately.
If the user asks about something not in the data, say you don't have that information yet.
Be concise, professional, and helpful.
Format monetary values as R$ (BRL).

${context}`
    });

    const chat = model.startChat({
      history: history.slice(0, -1) // Exclude current message if it was added to history (it wasn't in this logic, but just safe keeping)
    });

    const result = await chat.sendMessage(message);
    const responseText = result.response.text();

    // Save AI Response
    const aiMsgId = uuidv4();
    await pool.query(
      `INSERT INTO chat_messages (id, conversation_id, role, content) 
       VALUES ($1, $2, 'assistant', $3) RETURNING *`,
      [aiMsgId, activeConversationId, responseText]
    );

    return res.status(200).json({
      success: true,
      conversationId: activeConversationId,
      message: {
        id: aiMsgId,
        conversation_id: activeConversationId,
        role: 'assistant',
        content: responseText,
        created_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Chat API Error:', error);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

export default router;
