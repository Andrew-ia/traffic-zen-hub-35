import { getPool } from '../server/config/database';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const pool = getPool();
  try {
    const res = await pool.query('SELECT id, name FROM workspaces LIMIT 5');
    console.log('Workspaces:', res.rows);
  } catch (err) {
    console.error('Error listing workspaces:', err);
  } finally {
    await pool.end();
  }
}

main();
