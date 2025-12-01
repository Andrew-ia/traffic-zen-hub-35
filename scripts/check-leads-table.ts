import 'dotenv/config';
import { Pool } from 'pg';

const connectionString = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
    console.error('❌ DATABASE_URL not found');
    process.exit(1);
}

const pool = new Pool({ connectionString });

async function checkTableStructure() {
    try {
        console.log('🔍 Checking leads table structure...\n');

        const result = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'leads'
      ORDER BY ordinal_position
    `);

        console.log('📋 Columns in leads table:');
        console.log('─'.repeat(80));
        result.rows.forEach((row: any) => {
            console.log(`  ${row.column_name.padEnd(25)} ${row.data_type.padEnd(30)} ${row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
        });
        console.log('─'.repeat(80));

        // Check if there are any leads
        const countResult = await pool.query('SELECT COUNT(*) as total FROM leads');
        console.log(`\n📊 Total leads in database: ${countResult.rows[0].total}`);

        // Show sample data
        const sampleResult = await pool.query('SELECT * FROM leads ORDER BY created_at DESC LIMIT 1');
        if (sampleResult.rows.length > 0) {
            console.log('\n📝 Sample lead (most recent):');
            console.log(JSON.stringify(sampleResult.rows[0], null, 2));
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await pool.end();
    }
}

checkTableStructure();
