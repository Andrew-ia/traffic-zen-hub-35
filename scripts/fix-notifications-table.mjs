import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from project root
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const { Pool } = pg;

const SQL_FIX = `
-- Fix notifications table to reference correct users table
DROP TABLE IF EXISTS notifications CASCADE;

-- Create notifications table with correct foreign key
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('message', 'mention', 'task_assignment', 'reminder', 'system')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for faster queries
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- Grant permissions
GRANT ALL ON notifications TO postgres;
GRANT ALL ON notifications TO service_role;
`;

async function fixNotificationsTable() {
    const pool = new Pool({
        connectionString: process.env.SUPABASE_DATABASE_URL,
    });

    try {
        console.log('🔧 Connecting to database...');
        console.log('📝 Executing SQL fix script...\n');

        // Execute the script
        await pool.query(SQL_FIX);

        console.log('✅ Notifications table fixed successfully!\n');
        console.log('Verifying table structure...');

        // Verify the table structure
        const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'notifications'
      ORDER BY ordinal_position;
    `);

        console.log('\nTable columns:');
        console.table(result.rows);

    } catch (error) {
        console.error('❌ Error fixing notifications table:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

fixNotificationsTable();
