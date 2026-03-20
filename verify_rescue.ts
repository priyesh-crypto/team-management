import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function verifyState() {
    const email = 'priyesh@scaletrix.ai';
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
    const user = users?.find(u => u.email === email);
    
    if (!user) {
        console.log("User not found.");
        return;
    }

    console.log("User ID:", user.id);

    const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', user.id).maybeSingle();
    console.log("Profile:", profile);

    const { data: members } = await supabaseAdmin.from('organization_members').select('*, organizations(name)').eq('user_id', user.id);
    console.log("Memberships:", members);

    const { data: orgs } = await supabaseAdmin.from('organizations').select('*');
    console.log("Total Organizations:", orgs?.length);
    console.log("Orgs:", orgs);
}

verifyState();
