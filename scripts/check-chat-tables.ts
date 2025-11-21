
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config({ path: '.env.local' });

const pool = new Pool({
    connectionString: process.env.SUPABASE_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

async function checkChatTables() {
    const query = `
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('chat_conversations', 'chat_messages');
  `;

    try {
        const result = await pool.query(query);
        console.log('Found tables:', result.rows.map(r => r.table_name));
    } catch (error) {
        console.error('Query failed:', error);
    } finally {
        await pool.end();
    }
}

checkChatTables();
