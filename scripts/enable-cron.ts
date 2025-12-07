
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function enableCron() {
    const connectionString = process.env.SUPABASE_POOLER_URL || process.env.SUPABASE_DATABASE_URL;

    if (!connectionString) {
        console.error("Missing SUPABASE connection string in .env.local");
        process.exit(1);
    }

    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log("Connected to DB");

        // Enable extensions if not already enabled
        await client.query('CREATE EXTENSION IF NOT EXISTS pg_cron;');
        await client.query('CREATE EXTENSION IF NOT EXISTS pg_net;');

        const projectRef = "bichvnuepmgvdlrclmxb"; // Extracted from SUPABASE_URL
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!serviceRoleKey) {
            throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
        }

        const sql = `
      select
        cron.schedule(
          'check-ml-orders-every-10m',
          '*/10 * * * *',
          $$
          select
            net.http_post(
                url:='https://${projectRef}.supabase.co/functions/v1/check-ml-notifications',
                headers:='{"Content-Type": "application/json", "Authorization": "Bearer ${serviceRoleKey}"}'::jsonb
            ) as request_id;
          $$
        );
    `;

        console.log("Executing cron schedule SQL...");
        await client.query(sql);
        console.log("✅ Cron job scheduled successfully!");

    } catch (err) {
        console.error("Error scheduling cron:", err);
    } finally {
        await client.end();
    }
}

enableCron();
