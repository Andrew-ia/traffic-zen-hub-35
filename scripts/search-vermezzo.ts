import 'dotenv/config';
import { getPool } from '../server/config/database';

async function searchVermezzo() {
    const pool = getPool();

    // Buscar workspaces com nome similar
    const workspaces = await pool.query(`
    SELECT id, name, created_at 
    FROM workspaces 
    WHERE LOWER(name) LIKE '%vermezzo%' OR LOWER(name) LIKE '%vermez%'
    ORDER BY created_at DESC
  `);

    console.log('🔍 Workspaces com "Vermezzo" no nome:');
    console.table(workspaces.rows);

    // Buscar todos os usuários
    const users = await pool.query(`
    SELECT id, email, full_name, created_at
    FROM users
    ORDER BY created_at DESC
    LIMIT 10
  `);

    console.log('\n👥 Usuários cadastrados:');
    console.table(users.rows);

    // Buscar todas as membership relationships
    const memberships = await pool.query(`
    SELECT w.name as workspace, u.email, wm.role, wm.created_at
    FROM workspace_members wm
    JOIN workspaces w ON w.id = wm.workspace_id
    JOIN users u ON u.id = wm.user_id
    ORDER BY wm.created_at DESC
    LIMIT 20
  `);

    console.log('\n🔗 Todas as associações workspace-usuário:');
    console.table(memberships.rows);

    process.exit(0);
}

searchVermezzo();
