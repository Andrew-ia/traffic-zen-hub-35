

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

  // 2. Top 10 Campaigns (with platform and ROAS)
  const campaignsQuery = `
    SELECT 
      c.name, 
      c.status,
      pa.platform_key,
      SUM(m.spend) as spend, 
      SUM(m.conversions) as conversions,
      SUM(m.impressions) as impressions,
      SUM(m.clicks) as clicks,
      CASE WHEN SUM(m.spend) > 0 THEN SUM(m.conversions) / SUM(m.spend) ELSE 0 END as roas
    FROM campaigns c
    JOIN platform_accounts pa ON c.account_id = pa.id
    JOIN performance_metrics m ON c.id = m.campaign_id
    WHERE c.workspace_id = $1
      AND m.metric_date >= NOW() - INTERVAL '30 days'
    GROUP BY c.name, c.status, pa.platform_key
    ORDER BY spend DESC
    LIMIT 10
  `;

  // 3. Top 10 Creatives by Performance
  const creativesQuery = `
    SELECT 
      ca.name,
      ca.type,
      SUM(m.spend) as spend,
      SUM(m.conversions) as conversions,
      SUM(m.impressions) as impressions,
      SUM(m.clicks) as clicks,
      CASE WHEN SUM(m.impressions) > 0 THEN (SUM(m.clicks)::float / SUM(m.impressions) * 100) ELSE 0 END as ctr,
      CASE WHEN SUM(m.conversions) > 0 THEN SUM(m.spend) / SUM(m.conversions) ELSE 0 END as cpa
    FROM creative_assets ca
    JOIN ads a ON ca.id = a.creative_asset_id
    JOIN performance_metrics m ON a.id = m.ad_id
    JOIN ad_sets adset ON a.ad_set_id = adset.id
    JOIN campaigns c ON adset.campaign_id = c.id
    WHERE c.workspace_id = $1
      AND m.metric_date >= NOW() - INTERVAL '30 days'
    GROUP BY ca.name, ca.type
    ORDER BY conversions DESC
    LIMIT 10
  `;

  // 4. Week-over-Week Trends
  const trendsQuery = `
    SELECT 
      'Last 7 Days' as period,
      COALESCE(SUM(m.spend), 0) as spend,
      COALESCE(SUM(m.conversions), 0) as conversions,
      COALESCE(SUM(m.clicks), 0) as clicks
    FROM performance_metrics m
    JOIN campaigns c ON m.campaign_id = c.id
    WHERE c.workspace_id = $1
      AND m.metric_date >= NOW() - INTERVAL '7 days'
    UNION ALL
    SELECT 
      'Previous 7 Days' as period,
      COALESCE(SUM(m.spend), 0) as spend,
      COALESCE(SUM(m.conversions), 0) as conversions,
      COALESCE(SUM(m.clicks), 0) as clicks
    FROM performance_metrics m
    JOIN campaigns c ON m.campaign_id = c.id
    WHERE c.workspace_id = $1
      AND m.metric_date >= NOW() - INTERVAL '14 days'
      AND m.metric_date < NOW() - INTERVAL '7 days'
  `;

  // 5. Campaign Status Distribution
  const statusQuery = `
    SELECT 
      status,
      COUNT(*) as count
    FROM campaigns
    WHERE workspace_id = $1
    GROUP BY status
  `;

  // 6. Top 5 Ad Sets by Conversions
  const adSetsQuery = `
    SELECT 
      a.name,
      SUM(m.spend) as spend,
      SUM(m.conversions) as conversions,
      CASE WHEN SUM(m.conversions) > 0 THEN SUM(m.spend) / SUM(m.conversions) ELSE 0 END as cpa
    FROM ad_sets a
    JOIN campaigns c ON a.campaign_id = c.id
    JOIN performance_metrics m ON m.ad_set_id = a.id
    WHERE c.workspace_id = $1
      AND m.metric_date >= NOW() - INTERVAL '30 days'
    GROUP BY a.name
    ORDER BY conversions DESC
    LIMIT 5
  `;

  try {
    const [platformSummaryRes, campaignsRes, creativesRes, trendsRes, statusRes, adSetsRes] = await Promise.all([
      pool.query(platformSummaryQuery, [workspaceId]),
      pool.query(campaignsQuery, [workspaceId]),
      pool.query(creativesQuery, [workspaceId]),
      pool.query(trendsQuery, [workspaceId]),
      pool.query(statusQuery, [workspaceId]),
      pool.query(adSetsQuery, [workspaceId])
    ]);

    const platformData = platformSummaryRes.rows;
    const campaigns = campaignsRes.rows;
    const creatives = creativesRes.rows;
    const trends = trendsRes.rows;
    const statuses = statusRes.rows;
    const adSets = adSetsRes.rows;

    // Calculate overall totals
    const totalSpend = platformData.reduce((sum: number, p: any) => sum + parseFloat(p.spend), 0);
    const totalImpressions = platformData.reduce((sum: number, p: any) => sum + parseInt(p.impressions), 0);
    const totalClicks = platformData.reduce((sum: number, p: any) => sum + parseInt(p.clicks), 0);
    const totalConversions = platformData.reduce((sum: number, p: any) => sum + parseInt(p.conversions), 0);

    const overallCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0.00';
    const overallCpc = totalClicks > 0 ? (totalSpend / totalClicks).toFixed(2) : '0.00';
    const overallCpa = totalConversions > 0 ? (totalSpend / totalConversions).toFixed(2) : '0.00';

    let context = `
COMPREHENSIVE PERFORMANCE ANALYSIS (Last 30 Days):

═══════════════════════════════════════════════════════════════
OVERALL METRICS (All Platforms Combined):
═══════════════════════════════════════════════════════════════
- Total Spend: R$ ${totalSpend.toFixed(2)}
- Impressions: ${totalImpressions.toLocaleString()}
- Clicks: ${totalClicks.toLocaleString()}
- Conversions (Results): ${totalConversions}
- CTR: ${overallCtr}%
- CPC: R$ ${overallCpc}
- CPA (Cost per Result): R$ ${overallCpa}

═══════════════════════════════════════════════════════════════
BREAKDOWN BY PLATFORM:
═══════════════════════════════════════════════════════════════
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
  - Impressions: ${parseInt(p.impressions).toLocaleString()}
  - Clicks: ${parseInt(p.clicks).toLocaleString()}
  - Conversions: ${p.conversions}
  - CTR: ${ctr}%
  - CPC: R$ ${cpc}
  - CPA: R$ ${cpa}
`;
    });

    // Week-over-Week Trends
    if (trends.length === 2) {
      const lastWeek = trends.find((t: any) => t.period === 'Last 7 Days');
      const prevWeek = trends.find((t: any) => t.period === 'Previous 7 Days');

      const spendChange = prevWeek.spend > 0 ? (((lastWeek.spend - prevWeek.spend) / prevWeek.spend) * 100).toFixed(1) : 'N/A';
      const conversionsChange = prevWeek.conversions > 0 ? (((lastWeek.conversions - prevWeek.conversions) / prevWeek.conversions) * 100).toFixed(1) : 'N/A';

      context += `
═══════════════════════════════════════════════════════════════
WEEK-OVER-WEEK TRENDS:
═══════════════════════════════════════════════════════════════
Last 7 Days:
  - Spend: R$ ${parseFloat(lastWeek.spend).toFixed(2)}
  - Conversions: ${lastWeek.conversions}
  - Clicks: ${lastWeek.clicks}

Previous 7 Days:
  - Spend: R$ ${parseFloat(prevWeek.spend).toFixed(2)}
  - Conversions: ${prevWeek.conversions}
  - Clicks: ${prevWeek.clicks}

Change:
  - Spend: ${spendChange}%
  - Conversions: ${conversionsChange}%
`;
    }

    // Campaign Status Distribution
    context += `
═══════════════════════════════════════════════════════════════
CAMPAIGN STATUS DISTRIBUTION:
═══════════════════════════════════════════════════════════════
`;
    statuses.forEach((s: any) => {
      context += `- ${s.status}: ${s.count} campaigns\n`;
    });

    // Top 10 Campaigns
    context += `
═══════════════════════════════════════════════════════════════
TOP 10 CAMPAIGNS (by Spend):
═══════════════════════════════════════════════════════════════
`;
    campaigns.forEach((c: any, i: number) => {
      const platformLabel = c.platform_key === 'meta' ? '[Meta]' :
        c.platform_key === 'google' ? '[Google]' : `[${c.platform_key}]`;
      const ctr = c.impressions > 0 ? ((c.clicks / c.impressions) * 100).toFixed(2) : '0.00';
      const cpa = c.conversions > 0 ? (c.spend / c.conversions).toFixed(2) : '0.00';
      context += `${i + 1}. ${platformLabel} ${c.name} [${c.status}]
   Spend: R$ ${parseFloat(c.spend).toFixed(2)} | Results: ${c.conversions} | CTR: ${ctr}% | CPA: R$ ${cpa}\n`;
    });

    // Top 5 Ad Sets
    context += `
═══════════════════════════════════════════════════════════════
TOP 5 AD SETS (by Conversions):
═══════════════════════════════════════════════════════════════
`;
    adSets.forEach((a: any, i: number) => {
      context += `${i + 1}. ${a.name}
   Spend: R$ ${parseFloat(a.spend).toFixed(2)} | Results: ${a.conversions} | CPA: R$ ${parseFloat(a.cpa).toFixed(2)}\n`;
    });

    // Top 10 Creatives
    context += `
═══════════════════════════════════════════════════════════════
TOP 10 CREATIVES (by Conversions):
═══════════════════════════════════════════════════════════════
`;
    creatives.forEach((cr: any, i: number) => {
      context += `${i + 1}. ${cr.name} [${cr.type}]
   Spend: R$ ${parseFloat(cr.spend).toFixed(2)} | Results: ${cr.conversions} | CTR: ${parseFloat(cr.ctr).toFixed(2)}% | CPA: R$ ${parseFloat(cr.cpa).toFixed(2)}\n`;
    });

    // Best and Worst Performers
    const sortedByCpa = campaigns.filter((c: any) => c.conversions > 0).sort((a: any, b: any) => {
      const cpaA = a.spend / a.conversions;
      const cpaB = b.spend / b.conversions;
      return cpaA - cpaB;
    });

    if (sortedByCpa.length > 0) {
      context += `
═══════════════════════════════════════════════════════════════
PERFORMANCE INSIGHTS:
═══════════════════════════════════════════════════════════════
BEST PERFORMERS (Lowest CPA):
`;
      sortedByCpa.slice(0, 3).forEach((c: any, i: number) => {
        const cpa = (c.spend / c.conversions).toFixed(2);
        context += `${i + 1}. ${c.name} - CPA: R$ ${cpa}\n`;
      });

      context += `\nWORST PERFORMERS (Highest CPA):\n`;
      sortedByCpa.slice(-3).reverse().forEach((c: any, i: number) => {
        const cpa = (c.spend / c.conversions).toFixed(2);
        context += `${i + 1}. ${c.name} - CPA: R$ ${cpa}\n`;
      });
    }

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
        content: `You are an expert Digital Marketing Analyst and Strategist for the "Traffic Zen Hub" platform.

YOUR ROLE:
- Analyze campaign performance data and provide actionable insights
- Identify trends, anomalies, and optimization opportunities
- Suggest specific actions to improve ROAS, reduce CPA, and increase conversions
- Compare platforms (Meta vs Google) and recommend budget allocation
- Highlight underperforming campaigns/creatives that need attention

ANALYSIS APPROACH:
1. Always provide context and reasoning for your insights
2. Use specific numbers from the data to support your recommendations
3. Prioritize actionable advice over generic observations
4. When comparing, explain WHY one option is better
5. Identify both quick wins and long-term strategies

RESPONSE STYLE:
- Be concise but comprehensive
- Use bullet points for clarity
- Format monetary values as R$ (BRL)
- Highlight critical issues with emphasis
- End with clear next steps when appropriate

AVAILABLE DATA (Last 30 Days):
${context}

If the user asks about something not in the data, politely explain what data you DO have access to and offer to analyze that instead.`
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
