
import { createDatabaseClient } from '../server/config/database';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function checkNotifications() {
  const client = await createDatabaseClient();
  try {
    console.log('--- Notification Settings ---');
    const settings = await client.query('SELECT * FROM notification_settings');
    console.table(settings.rows);

    console.log('\n--- Notification Logs (Last 48 hours) ---');
    const logs = await client.query(`
      SELECT created_at, platform, notification_type, status, error_message 
      FROM notification_logs 
      WHERE created_at > NOW() - INTERVAL '48 hours'
      ORDER BY created_at DESC
      LIMIT 20
    `);
    console.table(logs.rows);

    if (logs.rows.length === 0) {
        console.log('No notifications found in the last 48 hours.');
    }

  } catch (error) {
    console.error('Error checking notifications:', error);
  } finally {
    await client.end();
  }
}

checkNotifications();
