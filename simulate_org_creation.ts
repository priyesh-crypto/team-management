import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

async function simulateOrgSignup() {
    const email = `test_org_${Date.now()}@scaletrix.ai`;
    const password = 'password123';
    
    console.log(`1. Signing up user: ${email}`);
    // Use admin client to directly auto-confirm
    const { data: user, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name: 'Test Org Creator', role: 'manager' }
    });

    if (signUpError) {
        console.error("Signup Error:", signUpError);
        return;
    }
    
    console.log("User created:", user.user.id);
    const userId = user.user.id;

    console.log("2. Simulating createOrganization logic...");

    // 1. Create Org using Service Role
    const name = "Shiny New Org";
    const { data: org, error: orgError } = await supabaseAdmin.from('organizations').insert({ name }).select('id').single();
    if (orgError || !org) {
        console.error("Org Creation Error:", orgError);
        return;
    }
    console.log("Org created:", org.id);

    // 2. Create Default Workspace
    const { error: wsError } = await supabaseAdmin.from('workspaces').insert({ org_id: org.id, name: 'Default Workspace' });
    if (wsError) {
        console.error("Workspace Creation Error:", wsError);
        return;
    }
    console.log("Workspace created.");

    // 3. Add to Organization Members as Owner
    const { error: memError } = await supabaseAdmin.from('organization_members').insert({
      org_id: org.id,
      user_id: userId,
      role: 'owner'
    });
    if (memError) {
        console.error("Member Creation Error:", memError);
        return;
    }
    console.log("Membership created.");

    // 4. Update legacy Profile role to manager
    const { error: profError } = await supabaseAdmin.from('profiles').update({ role: 'manager' }).eq('id', userId);
    if (profError) {
        console.error("Profile Update Error (MIGHT FAIL IF TRIGGER DIDNT CREATE PROFILE FAST ENOUGH):", profError);
        // It's possible the profile is 'null' or error here.
    } else {
        console.log("Profile updated.");
    }
    
    console.log("SUCCESS!");
}

simulateOrgSignup();
