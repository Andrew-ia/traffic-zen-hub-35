import type { Request, Response } from 'express';
import { getPool } from '../../config/database.js';
import { resolveWorkspaceId } from '../../utils/workspace.js';

// GET /api/ai/insights - Listar insights com filtros
export async function getInsights(req: Request, res: Response) {
  try {
    const { id: workspaceId } = resolveWorkspaceId(req);
    if (!workspaceId) return res.status(400).json({ error: 'Missing workspace id. Send workspaceId in query/body/header.' });
    const pool = getPool();

    const {
      status,
      insight_type,
      severity,
      agent_id,
      campaign_id,
      limit = 50,
      offset = 0,
    } = req.query;

    let query = `
      SELECT * FROM v_ai_insights_detailed
      WHERE workspace_id = $1
    `;
    const params: any[] = [workspaceId];

    if (status && status !== 'all') {
      query += ` AND status = $${params.length + 1}`;
      params.push(status);
    }

    if (insight_type && insight_type !== 'all') {
      query += ` AND insight_type = $${params.length + 1}`;
      params.push(insight_type);
    }

    if (severity && severity !== 'all') {
      query += ` AND severity = $${params.length + 1}`;
      params.push(severity);
    }

    if (agent_id) {
      query += ` AND ai_agent_id = $${params.length + 1}`;
      params.push(agent_id);
    }

    if (campaign_id) {
      query += ` AND campaign_id = $${params.length + 1}`;
      params.push(campaign_id);
    }

    query += ` ORDER BY
      CASE severity
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
      END,
      created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Contar total
    let countQuery = `SELECT COUNT(*) FROM ai_insights WHERE workspace_id = $1`;
    const countParams: any[] = [workspaceId];
    let paramIndex = 2;

    if (status && status !== 'all') {
      countQuery += ` AND status = $${paramIndex}`;
      countParams.push(status);
      paramIndex++;
    }

    if (insight_type && insight_type !== 'all') {
      countQuery += ` AND insight_type = $${paramIndex}`;
      countParams.push(insight_type);
      paramIndex++;
    }

    if (severity && severity !== 'all') {
      countQuery += ` AND severity = $${paramIndex}`;
      countParams.push(severity);
      paramIndex++;
    }

    if (agent_id) {
      countQuery += ` AND ai_agent_id = $${paramIndex}`;
      countParams.push(agent_id);
      paramIndex++;
    }

    if (campaign_id) {
      countQuery += ` AND campaign_id = $${paramIndex}`;
      countParams.push(campaign_id);
    }

    const countResult = await pool.query(countQuery, countParams);

    return res.json({
      insights: result.rows,
      total: parseInt(countResult.rows[0].count),
    });
  } catch (error) {
    console.error('Error in getInsights:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /api/ai/insights/:id - Detalhes de um insight
export async function getInsightById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { id: workspaceId } = resolveWorkspaceId(req);
    if (!workspaceId) return res.status(400).json({ error: 'Missing workspace id. Send workspaceId in query/body/header.' });
    const pool = getPool();

    const result = await pool.query(
      `SELECT * FROM v_ai_insights_detailed WHERE id = $1 AND workspace_id = $2`,
      [id, workspaceId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Insight not found' });
    }

    // Buscar ações disponíveis
    const actionsResult = await pool.query(
      `SELECT * FROM ai_insight_actions WHERE ai_insight_id = $1`,
      [id]
    );

    return res.json({
      ...result.rows[0],
      actions: actionsResult.rows,
    });
  } catch (error) {
    console.error('Error in getInsightById:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// PUT /api/ai/insights/:id/status - Atualizar status do insight
export async function updateInsightStatus(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { id: workspaceId } = resolveWorkspaceId(req);
    if (!workspaceId) return res.status(400).json({ error: 'Missing workspace id. Send workspaceId in query/body/header.' });
    const pool = getPool();

    const { status, action_taken, actioned_by } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const result = await pool.query(
      `UPDATE ai_insights
       SET status = $1,
           actioned_at = CASE WHEN $1 = 'actioned' THEN NOW() ELSE actioned_at END,
           actioned_by = COALESCE($2, actioned_by),
           action_taken = COALESCE($3, action_taken)
       WHERE id = $4 AND workspace_id = $5
       RETURNING *`,
      [status, actioned_by, action_taken, id, workspaceId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Insight not found' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Error in updateInsightStatus:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /api/ai/insights/:id/action - Aplicar ação recomendada
export async function applyInsightAction(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { id: workspaceId } = resolveWorkspaceId(req);
    if (!workspaceId) return res.status(400).json({ error: 'Missing workspace id. Send workspaceId in query/body/header.' });
    const pool = getPool();

    const { action_id, actioned_by } = req.body;

    if (!action_id) {
      return res.status(400).json({ error: 'Action ID is required' });
    }

    // Buscar a ação
    const actionResult = await pool.query(
      `SELECT * FROM ai_insight_actions WHERE id = $1 AND ai_insight_id = $2`,
      [action_id, id]
    );

    if (actionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Action not found' });
    }

    const action = actionResult.rows[0];

    // TODO: Aqui você implementaria a lógica para aplicar a ação
    // Por exemplo, aumentar orçamento, pausar campanha, etc.
    // Por enquanto, vamos apenas marcar o insight como actioned

    const result = await pool.query(
      `UPDATE ai_insights
       SET status = 'actioned',
           actioned_at = NOW(),
           actioned_by = $1,
           action_taken = $2
       WHERE id = $3 AND workspace_id = $4
       RETURNING *`,
      [actioned_by, action.action_label, id, workspaceId]
    );

    return res.json({
      message: 'Action applied successfully',
      insight: result.rows[0],
    });
  } catch (error) {
    console.error('Error in applyInsightAction:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /api/ai/insights/stats - Estatísticas de insights
export async function getInsightsStats(req: Request, res: Response) {
  try {
    const { id: workspaceId } = resolveWorkspaceId(req);
    if (!workspaceId) return res.status(400).json({ error: 'Missing workspace id. Send workspaceId in query/body/header.' });
    const pool = getPool();

    // Total de insights por status
    const statusResult = await pool.query(
      `SELECT status, COUNT(*) as count
       FROM ai_insights
       WHERE workspace_id = $1
       GROUP BY status`,
      [workspaceId]
    );

    // Total de insights por severidade (apenas novos)
    const severityResult = await pool.query(
      `SELECT severity, COUNT(*) as count
       FROM ai_insights
       WHERE workspace_id = $1 AND status = 'new'
       GROUP BY severity`,
      [workspaceId]
    );

    // Total de insights por tipo (apenas novos)
    const typeResult = await pool.query(
      `SELECT insight_type, COUNT(*) as count
       FROM ai_insights
       WHERE workspace_id = $1 AND status = 'new'
       GROUP BY insight_type`,
      [workspaceId]
    );

    // Total de insights por agente (apenas novos)
    const agentResult = await pool.query(
      `SELECT ai.ai_agent_id, aa.name as agent_name, COUNT(*) as count
       FROM ai_insights ai
       JOIN ai_agents aa ON aa.id = ai.ai_agent_id
       WHERE ai.workspace_id = $1 AND ai.status = 'new'
       GROUP BY ai.ai_agent_id, aa.name`,
      [workspaceId]
    );

    // Insights criados nos últimos 7 dias
    const recentResult = await pool.query(
      `SELECT DATE(created_at) as date, COUNT(*) as count
       FROM ai_insights
       WHERE workspace_id = $1 AND created_at >= NOW() - INTERVAL '7 days'
       GROUP BY DATE(created_at)
       ORDER BY date`,
      [workspaceId]
    );

    return res.json({
      by_status: statusResult.rows,
      by_severity: severityResult.rows,
      by_type: typeResult.rows,
      by_agent: agentResult.rows,
      recent_insights: recentResult.rows,
    });
  } catch (error) {
    console.error('Error in getInsightsStats:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /api/ai/dashboard - Dashboard geral de IA
export async function getAIDashboard(req: Request, res: Response) {
  try {
    const { id: workspaceId } = resolveWorkspaceId(req);
    if (!workspaceId) return res.status(400).json({ error: 'Missing workspace id. Send workspaceId in query/body/header.' });
    const pool = getPool();

    // Total de agentes ativos
    const activeAgentsResult = await pool.query(
      `SELECT COUNT(*) FROM ai_agents WHERE workspace_id = $1 AND status = 'active'`,
      [workspaceId]
    );

    // Total de insights novos
    const newInsightsResult = await pool.query(
      `SELECT COUNT(*) FROM ai_insights WHERE workspace_id = $1 AND status = 'new'`,
      [workspaceId]
    );

    // Total de insights críticos
    const criticalInsightsResult = await pool.query(
      `SELECT COUNT(*) FROM ai_insights WHERE workspace_id = $1 AND status = 'new' AND severity = 'critical'`,
      [workspaceId]
    );

    // Última execução
    const lastExecutionResult = await pool.query(
      `SELECT ae.*, aa.name as agent_name
       FROM ai_agent_executions ae
       JOIN ai_agents aa ON aa.id = ae.ai_agent_id
       WHERE ae.workspace_id = $1
       ORDER BY ae.started_at DESC
       LIMIT 1`,
      [workspaceId]
    );

    // Próximas execuções
    const nextExecutionsResult = await pool.query(
      `SELECT id, name, agent_type, next_run_at
       FROM ai_agents
       WHERE workspace_id = $1 AND status = 'active' AND next_run_at IS NOT NULL
       ORDER BY next_run_at
       LIMIT 5`,
      [workspaceId]
    );

    return res.json({
      active_agents: parseInt(activeAgentsResult.rows[0].count),
      new_insights: parseInt(newInsightsResult.rows[0].count),
      critical_insights: parseInt(criticalInsightsResult.rows[0].count),
      last_execution: lastExecutionResult.rows[0] || null,
      next_executions: nextExecutionsResult.rows,
    });
  } catch (error) {
    console.error('Error in getAIDashboard:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
