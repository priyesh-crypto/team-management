import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Using Service Role Key for Admin API

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing supabase env vars");
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function provisionTestUsers() {
    // We create them as 'managers' internally to mimic the initial signup flow
    const users = [
        { email: 'alice_verified@orga.com', password: 'password123', name: 'Alice Founder', orgName: 'Organization A' },
        { email: 'bob_verified@orgb.com', password: 'password123', name: 'Bob Builder', orgName: 'Organization B' }
    ];

    for (const u of users) {
        console.log(`Provisioning ${u.email}...`);
        
        // 1. Create User
        const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
            email: u.email,
            password: u.password,
            email_confirm: true,
            user_metadata: { name: u.name, role: 'manager' }
        });

        if (userError) {
            console.error(`Error creating user ${u.email}:`, userError);
            continue;
        }

        const userId = userData.user.id;
        console.log(`Created user ${userId}`);

        // 2. Create Organization
        const { data: org, error: orgError } = await supabaseAdmin
            .from('organizations')
            .insert({ name: u.orgName })
            .select('id')
            .single();
            
        if (orgError || !org) {
            console.error("Org Error:", orgError);
            continue;
        }
        
        // 3. Create Default Workspace
        await supabaseAdmin.from('workspaces').insert({ org_id: org.id, name: 'Default Workspace' });

        // 4. Add to Org Members
        await supabaseAdmin.from('organization_members').insert({
            org_id: org.id,
            user_id: userId,
            role: 'owner'
        });

        // 5. Ensure Profile has right role
        await supabaseAdmin.from('profiles').update({ role: 'manager' }).eq('id', userId);
        
        console.log(`Successfully provisioned ${u.name} for ${u.orgName}`);
    }
}

provisionTestUsers().then(() => console.log('Done'));
