import { getPool } from '../config/database.js';

import { generateInsightFromPrompt } from '../services/genai.js';

export async function generatePromptInsight(
  aiAgentId: string,
  executionId: string,
  workspaceId: string,
  prompt: string,
  config: Record<string, any> = {}
) {
  const pool = getPool();

  // Build minimal context (can be extended with metrics if needed)
  const context: Record<string, any> = {
    workspaceId,
    config,
  };

  const result = await generateInsightFromPrompt(prompt, context);

  const insertQuery = `
    INSERT INTO ai_insights (
      ai_agent_id,
      execution_id,
      workspace_id,
      insight_type,
      severity,
      title,
      description,
      recommendation,
      metrics,
      expires_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW() + INTERVAL '14 days')
    RETURNING id
  `;

  const params = [
    aiAgentId,
    executionId,
    workspaceId,
    result.insight_type || 'info',
    result.severity || 'medium',
    result.title,
    result.description,
    result.recommendation ?? null,
    JSON.stringify({ prompt, context, source: result.source || 'fallback' }),
  ];

  await pool.query(insertQuery, params);

  return 1; // number of insights created
}
