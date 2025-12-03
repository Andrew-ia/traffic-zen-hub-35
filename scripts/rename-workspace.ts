import 'dotenv/config';
import { getPool } from '../server/config/database';

async function renameWorkspace() {
    const pool = getPool();

    const result = await pool.query(`
    UPDATE workspaces 
    SET name = 'Vermezzo', 
        slug = 'vermezzo',
        updated_at = NOW()
    WHERE id = '00000000-0000-0000-0000-000000000010'
    RETURNING id, name, slug
  `);

    console.log('✅ Workspace renomeado:');
    console.table(result.rows);

    process.exit(0);
}

renameWorkspace();
