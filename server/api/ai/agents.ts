import type { Request, Response } from 'express';
import { getPool } from '../../config/database.js';
import { analyzeCampaignPerformance } from '../../agents/campaignPerformanceAnalyzer.js';
import { analyzeCreativePerformance } from '../../agents/creativeOptimizer.js';
import { resolveWorkspaceId } from '../../utils/workspace.js';

// GET /api/ai/agents - Listar todos os agentes
export async function getAgents(req: Request, res: Response) {
  try {
    const { id: workspaceId } = resolveWorkspaceId(req);
    if (!workspaceId) return res.status(400).json({ error: 'Missing workspace id. Send workspaceId in query/body/header.' });
    const pool = getPool();

    const { status } = req.query;

    let query = `
      SELECT * FROM v_ai_agents_dashboard
      WHERE workspace_id = $1
    `;
    const params: any[] = [workspaceId];

    if (status && status !== 'all') {
      query += ` AND status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY agent_type, name`;

    const result = await pool.query(query, params);

    return res.json({
      agents: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.error('Error in getAgents:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /api/ai/agents/:id - Detalhes de um agente específico
export async function getAgentById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { id: workspaceId } = resolveWorkspaceId(req);
    if (!workspaceId) return res.status(400).json({ error: 'Missing workspace id. Send workspaceId in query/body/header.' });
    const pool = getPool();

    const result = await pool.query(
      `SELECT * FROM v_ai_agents_dashboard WHERE id = $1 AND workspace_id = $2`,
      [id, workspaceId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Error in getAgentById:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /api/ai/agents - Criar novo agente
export async function createAgent(req: Request, res: Response) {
  try {
    const { id: workspaceId } = resolveWorkspaceId(req);
    if (!workspaceId) return res.status(400).json({ error: 'Missing workspace id. Send workspaceId in query/body/header.' });
    const pool = getPool();

    const { agent_type, name, description, schedule_frequency, config } = req.body;

    if (!agent_type || !name || !schedule_frequency) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await pool.query(
      `INSERT INTO ai_agents (workspace_id, agent_type, name, description, schedule_frequency, config)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [workspaceId, agent_type, name, description, schedule_frequency, config || {}]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error in createAgent:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// PUT /api/ai/agents/:id - Atualizar configuração do agente
export async function updateAgent(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { id: workspaceId } = resolveWorkspaceId(req);
    if (!workspaceId) return res.status(400).json({ error: 'Missing workspace id. Send workspaceId in query/body/header.' });
    const pool = getPool();

    const { name, description, status, schedule_frequency, config } = req.body;

    const result = await pool.query(
      `UPDATE ai_agents
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           status = COALESCE($3, status),
           schedule_frequency = COALESCE($4, schedule_frequency),
           config = COALESCE($5, config),
           updated_at = NOW()
       WHERE id = $6 AND workspace_id = $7
       RETURNING *`,
      [name, description, status, schedule_frequency, config, id, workspaceId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Error in updateAgent:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// DELETE /api/ai/agents/:id - Deletar agente
export async function deleteAgent(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { id: workspaceId } = resolveWorkspaceId(req);
    if (!workspaceId) return res.status(400).json({ error: 'Missing workspace id. Send workspaceId in query/body/header.' });
    const pool = getPool();

    const result = await pool.query(
      `DELETE FROM ai_agents WHERE id = $1 AND workspace_id = $2 RETURNING *`,
      [id, workspaceId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    return res.json({ message: 'Agent deleted successfully' });
  } catch (error) {
    console.error('Error in deleteAgent:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /api/ai/agents/:id/run - Executar manualmente
export async function runAgent(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { id: workspaceId } = resolveWorkspaceId(req);
    if (!workspaceId) return res.status(400).json({ error: 'Missing workspace id. Send workspaceId in query/body/header.' });
    const pool = getPool();
    const { prompt } = (req.body || {}) as { prompt?: string };

    // Verificar se o agente existe
    const agentResult = await pool.query(
      `SELECT * FROM ai_agents WHERE id = $1 AND workspace_id = $2`,
      [id, workspaceId]
    );

    if (agentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const agent = agentResult.rows[0];

    // Criar nova execução
    const executionResult = await pool.query(
      `INSERT INTO ai_agent_executions (ai_agent_id, workspace_id, status)
       VALUES ($1, $2, 'running')
       RETURNING *`,
      [id, workspaceId]
    );

    const execution = executionResult.rows[0];

    // Atualizar last_run_at do agente
    await pool.query(
      `UPDATE ai_agents SET last_run_at = NOW() WHERE id = $1`,
      [id]
    );

    // Executar análise do agente em background
    (async () => {
      const startTime = Date.now();
      let totalInsights = 0;
      let status: 'completed' | 'failed' = 'completed';
      let errorMessage: string | null = null;

      try {
        console.log(`\n🤖 Executando agente: ${agent.name} (${agent.agent_type})`);

        // Executar lógica específica do agente
        // Gerar sempre pelo menos 1 insight via LLM (com prompt definido ou padrão),
        // e depois executar a lógica específica do agente quando aplicável.
        const promptText =
          // Prioriza prompt enviado na requisição
          prompt ||
          // Em seguida, prompt configurado no agente
          (agent.config && (agent.config as any).prompt) ||
          // Se não houver, usa a descrição do agente como prompt
          agent.description ||
          // Por fim, um prompt padrão genérico
          `Gere um insight acionável para o agente "${agent.name}" com base nas métricas do workspace.`;

        const { generatePromptInsight } = await import('../../agents/promptInsightGenerator.js');
        let llmInsights = 0;
        try {
          llmInsights = await generatePromptInsight(
            id,
            execution.id,
            workspaceId,
            String(promptText),
            agent.config || {}
          );
        } catch (e) {
          console.warn('⚠️ Falha ao gerar insight via LLM. Seguindo com análise específica do agente.', e);
        }

        totalInsights = llmInsights;

        // Em seguida, executar lógica específica do agente (se houver)
        switch (agent.agent_type) {
          case 'campaign_performance': {
            const n = await analyzeCampaignPerformance(
              id,
              execution.id,
              workspaceId,
              agent.config || {}
            );
            totalInsights += n;
            break;
          }

          case 'creative_optimizer': {
            const n = await analyzeCreativePerformance(
              id,
              execution.id,
              workspaceId,
              agent.config || {}
            );
            totalInsights += n;
            break;
          }

          // Outros agentes serão implementados aqui
          default:
            console.log(`ℹ️ Agente ${agent.agent_type} sem lógica específica adicional.`);
        }

        console.log(`✅ Execução concluída: ${totalInsights} insights gerados`);
      } catch (error: any) {
        console.error('❌ Erro na execução do agente:', error);
        status = 'failed';
        errorMessage = error.message;
      }

      // Atualizar execução no banco
      try {
        const executionTime = Date.now() - startTime;
        await pool.query(
          `UPDATE ai_agent_executions
           SET status = $1,
               finished_at = NOW(),
               execution_time_ms = $2,
               total_insights = $3,
               error_message = $4
           WHERE id = $5`,
          [status, executionTime, totalInsights, errorMessage, execution.id]
        );
      } catch (error) {
        console.error('Error updating execution:', error);
      }
    })();

    return res.json({
      message: 'Agent execution started',
      execution: execution,
    });
  } catch (error) {
    console.error('Error in runAgent:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /api/ai/agents/:id/pause - Pausar agente
export async function pauseAgent(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { id: workspaceId } = resolveWorkspaceId(req);
    if (!workspaceId) return res.status(400).json({ error: 'Missing workspace id. Send workspaceId in query/body/header.' });
    const pool = getPool();

    const result = await pool.query(
      `UPDATE ai_agents
       SET status = 'paused', updated_at = NOW()
       WHERE id = $1 AND workspace_id = $2
       RETURNING *`,
      [id, workspaceId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Error in pauseAgent:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /api/ai/agents/:id/resume - Retomar agente
export async function resumeAgent(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { id: workspaceId } = resolveWorkspaceId(req);
    if (!workspaceId) return res.status(400).json({ error: 'Missing workspace id. Send workspaceId in query/body/header.' });
    const pool = getPool();

    const result = await pool.query(
      `UPDATE ai_agents
       SET status = 'active', updated_at = NOW()
       WHERE id = $1 AND workspace_id = $2
       RETURNING *`,
      [id, workspaceId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Error in resumeAgent:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /api/ai/agents/:id/executions - Histórico de execuções
export async function getAgentExecutions(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { id: workspaceId } = resolveWorkspaceId(req);
    if (!workspaceId) return res.status(400).json({ error: 'Missing workspace id. Send workspaceId in query/body/header.' });
    const pool = getPool();

    const { limit = 20, offset = 0 } = req.query;

    const result = await pool.query(
      `SELECT * FROM ai_agent_executions
       WHERE ai_agent_id = $1 AND workspace_id = $2
       ORDER BY started_at DESC
       LIMIT $3 OFFSET $4`,
      [id, workspaceId, limit, offset]
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM ai_agent_executions WHERE ai_agent_id = $1 AND workspace_id = $2`,
      [id, workspaceId]
    );

    return res.json({
      executions: result.rows,
      total: parseInt(countResult.rows[0].count),
    });
  } catch (error) {
    console.error('Error in getAgentExecutions:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /api/ai/executions/:id - Detalhes de execução específica
export async function getExecutionById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { id: workspaceId } = resolveWorkspaceId(req);
    if (!workspaceId) return res.status(400).json({ error: 'Missing workspace id. Send workspaceId in query/body/header.' });
    const pool = getPool();

    const result = await pool.query(
      `SELECT * FROM ai_agent_executions WHERE id = $1 AND workspace_id = $2`,
      [id, workspaceId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Execution not found' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Error in getExecutionById:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
