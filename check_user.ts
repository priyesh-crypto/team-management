import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing supabase env vars");
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function checkUser(email: string) {
    const { data: { users }, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    const user = users?.find(u => u.email === email);
    
    if (!user) {
        console.log(`User ${email} not found in Auth.`);
        return;
    }

    console.log(`User ${email} found: ${user.id}`);
    
    const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', user.id).maybeSingle();
    console.log("Profile:", profile);

    const { data: members } = await supabaseAdmin.from('organization_members').select('*, organizations(name)').eq('user_id', user.id);
    console.log("Memberships:", members);
}

checkUser('alice@orga.com');
