
import dotenv from 'dotenv';
import { exec } from 'child_process';
import path from 'path';

// Load environment variables from .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseDbUrl = process.env.SUPABASE_DATABASE_URL;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey || !supabaseDbUrl) {
  console.error('Missing Supabase environment variables. Make sure they are defined in .env.local');
  process.exit(1);
}

const command = `npx @aliyun-rds/supabase-mcp-server --url "${supabaseUrl}" --anon-key "${supabaseAnonKey}" --service-key "${supabaseServiceKey}" --db-url "${supabaseDbUrl}"`;

console.log('Starting Supabase MCP server with command:');
console.log(command);

const child = exec(command);

child.stdout?.on('data', (data) => {
  console.log(`stdout: ${data}`);
});

child.stderr?.on('data', (data) => {
  console.error(`stderr: ${data}`);
});

child.on('close', (code) => {
  console.log(`child process exited with code ${code}`);
});
