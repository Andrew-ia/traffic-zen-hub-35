
import { getPool } from './server/config/database';

async function checkColumns() {
    try {
        const pool = getPool();
        const result = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'products'
        `);
        console.log("Columns:", result.rows.map(r => r.column_name));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkColumns();
