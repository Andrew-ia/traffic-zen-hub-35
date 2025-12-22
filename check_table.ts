
import { getPool } from './server/config/database';

async function check() {
    try {
        const pool = getPool();
        const result = await pool.query("SELECT to_regclass('public.products')");
        console.log("Result:", result.rows[0]);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

check();
