import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.local') });

const { Pool } = pg;

async function checkAuth() {
  const pool = new Pool({
    connectionString: process.env.SUPABASE_DATABASE_URL,
  });

  try {
    console.log('🔍 Checking authentication setup...\n');

    // Check users
    console.log('📋 Users in database:');
    const usersResult = await pool.query(
      'SELECT id, email, full_name, status, auth_provider FROM users LIMIT 5'
    );
    console.table(usersResult.rows);

    // Check workspace members
    console.log('\n👥 Workspace members:');
    const workspaceId = process.env.VITE_WORKSPACE_ID || '00000000-0000-0000-0000-000000000010';
    const membersResult = await pool.query(
      `SELECT wm.workspace_id, wm.user_id, wm.role, wm.invitation_status, u.email
       FROM workspace_members wm
       JOIN users u ON u.id = wm.user_id
       WHERE wm.workspace_id = $1`,
      [workspaceId]
    );
    console.table(membersResult.rows);

    // Check password hash for admin user
    console.log('\n🔐 Checking admin user password:');
    const adminEmail = process.env.ADMIN_EMAIL || 'founder@trafficpro.dev';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    const adminCheck = await pool.query(
      `SELECT id, email,
              (password_hash IS NOT NULL) as has_password,
              (crypt($2, password_hash) = password_hash) as password_valid
       FROM users
       WHERE email = $1`,
      [adminEmail, adminPassword]
    );

    if (adminCheck.rows.length > 0) {
      console.log(`✅ Admin user found: ${adminEmail}`);
      console.log(`   Has password hash: ${adminCheck.rows[0].has_password}`);
      console.log(`   Password valid: ${adminCheck.rows[0].password_valid}`);
    } else {
      console.log(`❌ Admin user not found: ${adminEmail}`);
    }

    // Test login query
    console.log('\n🧪 Testing login query:');
    const loginTest = await pool.query(
      `SELECT u.id, u.email, u.full_name,
              wm.role as workspace_role
       FROM users u
       LEFT JOIN workspace_members wm ON wm.user_id = u.id AND wm.workspace_id = $3
       WHERE u.email = $1
         AND u.status = 'active'
         AND crypt($2, u.password_hash) = u.password_hash
       LIMIT 1`,
      [adminEmail, adminPassword, workspaceId]
    );

    if (loginTest.rows.length > 0) {
      console.log('✅ Login query successful!');
      console.table(loginTest.rows);
    } else {
      console.log('❌ Login query failed - no matching user');
    }

    // Check environment variables
    console.log('\n⚙️  Environment variables:');
    console.log(`   WORKSPACE_ID: ${process.env.WORKSPACE_ID || process.env.VITE_WORKSPACE_ID || 'NOT SET'}`);
    console.log(`   AUTH_SECRET: ${process.env.AUTH_SECRET || process.env.VITE_AUTH_SECRET ? '***' : 'NOT SET'}`);
    console.log(`   ADMIN_EMAIL: ${process.env.ADMIN_EMAIL || 'using default'}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

checkAuth();
