import 'dotenv/config';
import { getPool } from '../server/config/database';

async function checkConversions() {
    const pool = getPool();
    const workspaceId = '00000000-0000-0000-0000-000000000010';
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const result = await pool.query(`
    SELECT 
      SUM(conversations_started) as total_conversations_started,
      SUM(messaging_connections) as total_messaging_connections,
      SUM(conversions) as total_conversions
    FROM vw_performance_daily
    WHERE workspace_id = $1
      AND metric_date >= $2
  `, [workspaceId, since.toISOString().slice(0, 10)]);

    console.log('📊 Métricas de conversão dos últimos 30 dias:');
    console.table(result.rows);

    process.exit(0);
}

checkConversions();
