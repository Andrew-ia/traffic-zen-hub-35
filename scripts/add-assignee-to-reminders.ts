
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config({ path: '.env.local' });

const pool = new Pool({
    connectionString: process.env.SUPABASE_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

async function addAssigneeColumn() {
    console.log('Adding assignee_id column to pm_reminders...');

    const query = `
    ALTER TABLE pm_reminders
    ADD COLUMN IF NOT EXISTS assignee_id UUID REFERENCES users(id);
  `;

    try {
        await pool.query(query);
        console.log('Successfully added assignee_id column!');
    } catch (error) {
        console.error('Failed to add column:', error);
    } finally {
        await pool.end();
    }
}

addAssigneeColumn();
