
import { getPool } from '../server/config/database.js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function checkCreatives() {
  const pool = getPool();
  try {
    console.log('Checking creative_assets table...');
    const countResult = await pool.query('SELECT COUNT(*) FROM creative_assets');
    console.log(`Total creatives: ${countResult.rows[0].count}`);

    if (parseInt(countResult.rows[0].count) > 0) {
      const sampleResult = await pool.query('SELECT * FROM creative_assets LIMIT 5');
      console.log('Sample creatives:', JSON.stringify(sampleResult.rows, null, 2));
    } else {
      console.log('No creatives found. Sync might be needed.');
    }
  } catch (error) {
    console.error('Error checking creatives:', error);
  } finally {
    process.exit();
  }
}

checkCreatives();
