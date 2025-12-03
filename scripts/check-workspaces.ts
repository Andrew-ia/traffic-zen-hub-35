import 'dotenv/config';
import { getPool } from '../server/config/database';

async function checkWorkspaces() {
    const pool = getPool();

    const result = await pool.query(`
    SELECT id, name, created_at 
    FROM workspaces 
    ORDER BY created_at DESC 
    LIMIT 10
  `);

    console.log('📋 Workspaces encontrados:');
    console.table(result.rows);

    const userWorkspaces = await pool.query(`
    SELECT w.id, w.name, u.email, wm.role
    FROM workspaces w
    JOIN workspace_members wm ON w.id = wm.workspace_id
    JOIN users u ON wm.user_id = u.id
    WHERE u.email = 'founder@trafficpro.dev'
  `);

    console.log('\n👤 Workspaces do usuário founder@trafficpro.dev:');
    console.table(userWorkspaces.rows);

    process.exit(0);
}

checkWorkspaces();
