import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envText = fs.readFileSync('.env', 'utf8');
function getEnv(key) {
  const line = envText.split(/\r?\n/).find(l => l.startsWith(key + '='));
  if (!line) return '';
  return line.substring(key.length + 1).split('#')[0].trim();
}

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

const adminClient = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  const { data: usersData, error: usersError } = await adminClient.auth.admin.listUsers();
  if (usersError) {
    console.error('Error listing users:', usersError.message);
    return;
  }

  console.log('Total auth users:', usersData.users.length);
  const userList = [];
  for (const u of usersData.users) {
    const { data: profile } = await adminClient
      .from('profiles')
      .select('role, full_name, is_active')
      .eq('id', u.id)
      .single();
    userList.push({
      id: u.id,
      email: u.email,
      role: profile?.role || 'none',
      name: profile?.full_name || 'unknown',
      confirmed: !!u.email_confirmed_at,
      active: profile?.is_active
    });
  }
  console.log('Users:', JSON.stringify(userList, null, 2));
}

main().catch(console.error);
