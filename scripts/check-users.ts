import { getPool } from '../server/config/database.js';

async function checkUsers() {
    const pool = getPool();

    const result = await pool.query(`
    SELECT id, email, full_name, status 
    FROM users 
    WHERE email LIKE '%founder%' OR email LIKE '%admin%' 
    LIMIT 10
  `);

    console.log('\n👥 Usuários encontrados:');
    console.table(result.rows);

    process.exit(0);
}

checkUsers();
