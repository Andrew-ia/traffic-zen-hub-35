import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const workspaceId = process.env.WORKSPACE_ID!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUsers() {
  console.log('Checking users in workspace:', workspaceId);

  const { data, error } = await supabase
    .from('workspace_members')
    .select(`
      user_id,
      role,
      invitation_status,
      users:users!workspace_members_user_id_fkey (
        id,
        email,
        full_name
      )
    `)
    .eq('workspace_id', workspaceId)
    .order('role', { ascending: true });

  if (error) {
    console.error('Error fetching users:', error);
    return;
  }

  console.log('\nWorkspace Members:');
  console.log('==================');
  data?.forEach((member: any) => {
    console.log(`
User ID: ${member.user_id}
Email: ${member.users?.email || 'N/A'}
Name: ${member.users?.full_name || 'N/A'}
Role: ${member.role}
Status: ${member.invitation_status}
---`);
  });

  console.log(`\nTotal members: ${data?.length || 0}`);
}

checkUsers().catch(console.error);
