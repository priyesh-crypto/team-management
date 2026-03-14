import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseKey, { auth: { autoRefreshToken: false, persistSession: false } });

async function testCreateOrg() {
    console.log("Creating organization...");
    const { data: org, error: orgError } = await supabaseAdmin.from('organizations').insert({ name: 'Test Org Creation' }).select('id').single();
    
    if (orgError) {
        console.error("Org Error:", orgError);
        return;
    }
    console.log("Org Created:", org);

    const { error: wsError } = await supabaseAdmin.from('workspaces').insert({ org_id: org.id, name: 'Default Workspace' });
    if (wsError) console.error("Workspace Error:", wsError);

    // Hardcode my user id
    const userId = '0535927c-b683-4426-8025-5c35f1fec13a';
    
    const { error: memError } = await supabaseAdmin.from('organization_members').insert({
      org_id: org.id,
      user_id: userId,
      role: 'owner'
    });
    if (memError) console.error("Member Error:", memError);
    else console.log("Member created");
}

testCreateOrg();
