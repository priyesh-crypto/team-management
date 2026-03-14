import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing supabase env vars");
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function debugDatabase() {
    console.log("--- Auth Users ---");
    const { data: { users }, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    if (authError) console.error("Auth Error:", authError);
    else users.forEach(u => console.log(`ID: ${u.id}, Email: ${u.email}, Created: ${u.created_at}`));

    console.log("\n--- Profiles ---");
    const { data: profiles, error: profError } = await supabaseAdmin.from('profiles').select('*');
    if (profError) console.error("Profiles Error:", profError);
    else profiles.forEach(p => console.log(`ID: ${p.id}, Name: ${p.name}, Role: ${p.role}`));

    console.log("\n--- Organizations ---");
    const { data: orgs, error: orgError } = await supabaseAdmin.from('organizations').select('*');
    if (orgError) console.error("Orgs Error:", orgError);
    else orgs.forEach(o => console.log(`ID: ${o.id}, Name: ${o.name}`));

    console.log("\n--- Organization Members ---");
    const { data: members, error: memError } = await supabaseAdmin.from('organization_members').select('*, organizations(name)');
    if (memError) console.error("Members Error:", memError);
    else members.forEach(m => console.log(`User: ${m.user_id}, Org: ${m.org_id} (${(m as any).organizations?.name}), Role: ${m.role}`));
}

debugDatabase();
