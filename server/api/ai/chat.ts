

import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import { getPool } from '../../config/database.js';
import { randomUUID } from 'crypto';

const router = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

async function buildContext(workspaceId: string): Promise<string> {
  const pool = getPool();

  // 1. Platform-specific Summary (Last 30 Days)
  const platformSummaryQuery = `
    SELECT 
      pa.platform_key,
      COALESCE(SUM(m.spend), 0) as spend,
      COALESCE(SUM(m.impressions), 0) as impressions,
      COALESCE(SUM(m.clicks), 0) as clicks,
      COALESCE(SUM(m.conversions), 0) as conversions
    FROM performance_metrics m
    JOIN campaigns c ON m.campaign_id = c.id
    JOIN platform_accounts pa ON c.account_id = pa.id
    WHERE c.workspace_id = $1
      AND m.metric_date >= NOW() - INTERVAL '30 days'
    GROUP BY pa.platform_key
    ORDER BY spend DESC
  `;

  // 2. Top 5 Campaigns (with platform)
  const campaignsQuery = `
    SELECT 
      c.name, 
      pa.platform_key,
      SUM(m.spend) as spend, 
      SUM(m.conversions) as conversions
    FROM campaigns c
    JOIN platform_accounts pa ON c.account_id = pa.id
    JOIN performance_metrics m ON c.id = m.campaign_id
    WHERE c.workspace_id = $1
      AND m.metric_date >= NOW() - INTERVAL '30 days'
    GROUP BY c.name, pa.platform_key
    ORDER BY spend DESC
    LIMIT 5
  `;

  // 3. Daily Metrics by Platform (Last 30 Days)
  const dailyByPlatformQuery = `
    SELECT 
      TO_CHAR(m.metric_date, 'YYYY-MM-DD') as date,
      pa.platform_key,
      COALESCE(SUM(m.spend), 0) as spend,
      COALESCE(SUM(m.conversions), 0) as conversions
    FROM performance_metrics m
    JOIN campaigns c ON m.campaign_id = c.id
    JOIN platform_accounts pa ON c.account_id = pa.id
    WHERE c.workspace_id = $1
      AND m.metric_date >= NOW() - INTERVAL '30 days'
    GROUP BY m.metric_date, pa.platform_key
    ORDER BY m.metric_date DESC, pa.platform_key
  `;

  try {
    const [platformSummaryRes, campaignsRes, dailyByPlatformRes] = await Promise.all([
      pool.query(platformSummaryQuery, [workspaceId]),
      pool.query(campaignsQuery, [workspaceId]),
      pool.query(dailyByPlatformQuery, [workspaceId])
    ]);

    const platformData = platformSummaryRes.rows;
    const campaigns = campaignsRes.rows;
    const dailyByPlatform = dailyByPlatformRes.rows;

    // Calculate overall totals
    const totalSpend = platformData.reduce((sum: number, p: any) => sum + parseFloat(p.spend), 0);
    const totalImpressions = platformData.reduce((sum: number, p: any) => sum + parseInt(p.impressions), 0);
    const totalClicks = platformData.reduce((sum: number, p: any) => sum + parseInt(p.clicks), 0);
    const totalConversions = platformData.reduce((sum: number, p: any) => sum + parseInt(p.conversions), 0);

    const overallCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0.00';
    const overallCpc = totalClicks > 0 ? (totalSpend / totalClicks).toFixed(2) : '0.00';
    const overallCpa = totalConversions > 0 ? (totalSpend / totalConversions).toFixed(2) : '0.00';

    let context = `
CURRENT PERFORMANCE CONTEXT (Last 30 Days):

OVERALL METRICS (All Platforms Combined):
- Total Spend: R$ ${totalSpend.toFixed(2)}
- Impressions: ${totalImpressions}
- Clicks: ${totalClicks}
- Conversions (Results): ${totalConversions}
- CTR: ${overallCtr}%
- CPC: R$ ${overallCpc}
- CPA (Cost per Result): R$ ${overallCpa}

BREAKDOWN BY PLATFORM:
`;

    // Add platform-specific data
    platformData.forEach((p: any) => {
      const platformName = p.platform_key === 'meta' ? 'Meta Ads (Facebook/Instagram)' :
        p.platform_key === 'google' ? 'Google Ads' : p.platform_key;
      const ctr = p.impressions > 0 ? ((p.clicks / p.impressions) * 100).toFixed(2) : '0.00';
      const cpc = p.clicks > 0 ? (p.spend / p.clicks).toFixed(2) : '0.00';
      const cpa = p.conversions > 0 ? (p.spend / p.conversions).toFixed(2) : '0.00';

      context += `
${platformName}:
  - Spend: R$ ${parseFloat(p.spend).toFixed(2)}
  - Impressions: ${p.impressions}
  - Clicks: ${p.clicks}
  - Conversions: ${p.conversions}
  - CTR: ${ctr}%
  - CPC: R$ ${cpc}
  - CPA: R$ ${cpa}
`;
    });

    context += `\nTOP 5 CAMPAIGNS (by Spend):\n`;
    campaigns.forEach((c: any, i: number) => {
      const platformLabel = c.platform_key === 'meta' ? '[Meta]' :
        c.platform_key === 'google' ? '[Google]' : `[${c.platform_key}]`;
      context += `${i + 1}. ${platformLabel} ${c.name} | Spend: R$ ${parseFloat(c.spend).toFixed(2)} | Results: ${c.conversions}\n`;
    });

    // Group daily data by date for easier reading
    const dailyByDate = dailyByPlatform.reduce((acc: any, row: any) => {
      if (!acc[row.date]) {
        acc[row.date] = {};
      }
      acc[row.date][row.platform_key] = {
        spend: parseFloat(row.spend),
        conversions: parseInt(row.conversions)
      };
      return acc;
    }, {});

    context += `\nDAILY BREAKDOWN BY PLATFORM (Last 7 Days):\n`;
    Object.entries(dailyByDate).slice(0, 7).forEach(([date, platforms]: [string, any]) => {
      context += `${date}:\n`;
      Object.entries(platforms).forEach(([platform, data]: [string, any]) => {
        const platformLabel = platform === 'meta' ? 'Meta' : platform === 'google' ? 'Google' : platform;
        context += `  - ${platformLabel}: R$ ${data.spend.toFixed(2)} | Results: ${data.conversions}\n`;
      });
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
    const userId = (req as any).user?.id || 'system'; // Fallback to 'system' if no auth

    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    if (!workspaceId) {
      return res.status(400).json({ success: false, error: 'Workspace ID is required' });
    }

    // Check for API key
    if (!process.env.OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY not configured');
      return res.status(500).json({
        success: false,
        error: 'AI service not configured. Please contact administrator.'
      });
    }

    const pool = getPool();
    let activeConversationId = conversationId;

    // Create conversation if not exists
    if (!activeConversationId) {
      const title = message.substring(0, 50) + (message.length > 50 ? '...' : '');
      const newConv = await pool.query(
        `INSERT INTO chat_conversations (id, workspace_id, user_id, title) 
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [randomUUID(), workspaceId, userId, title]
      );
      activeConversationId = newConv.rows[0].id;
    }

    // Save User Message
    await pool.query(
      `INSERT INTO chat_messages (id, conversation_id, role, content) 
       VALUES ($1, $2, 'user', $3)`,
      [randomUUID(), activeConversationId, message]
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

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: `You are an expert Digital Marketing Assistant for the "Traffic Zen Hub" platform.
Your goal is to help the user analyze their campaign performance and suggest optimizations.
You have access to the last 30 days of performance data below.
Use this data to answer the user's questions accurately.
If the user asks about something not in the data, say you don't have that information yet.
Be concise, professional, and helpful.
Format monetary values as R$ (BRL).

${context}`
      }
    ];

    historyRes.rows.forEach((row: any) => {
      messages.push({
        role: row.role === 'assistant' ? 'assistant' : 'user',
        content: row.content
      });
    });

    // Call OpenAI via fetch to avoid SDK connection issues and get better debugging
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API Error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      throw new Error(`OpenAI API Error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json() as any;
    const responseText = data.choices[0]?.message?.content || "Desculpe, não consegui gerar uma resposta.";

    // Save AI Response
    const aiMsgId = randomUUID();
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
    console.error('Error details:', {
      message: error instanceof Error ? error.message : String(error),
      hasOpenAIKey: !!process.env.OPENAI_API_KEY
    });

    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : String(error),
      stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
    });
  }
});

export default router;
