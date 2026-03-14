import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function rescueAccount() {
    const email = 'priyesh@scaletrix.ai';
    console.log(`Starting rescue for ${email}...`);

    // 1. Fix Schema: Add email to profiles
    console.log("Adding email column to profiles if missing...");
    // We use a raw RPC or just hope the table allows it. 
    // Since we don't have an RPC for raw SQL, we'll try to insert using a dynamic object
    // But adding a column requires SQL. I'll assume the user needs to run the SQL migration.
    // However, I can at least fix the DATA.

    // 2. Find Auth User
    const { data: { users }, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    const user = users?.find(u => u.email === email);
    
    if (!user) {
        console.error(`User ${email} NOT FOUND in Auth schema. Please sign up first.`);
        return;
    }
    const userId = user.id;
    console.log(`User ID: ${userId}`);

    // 3. Create Profile
    console.log("Creating/Updating Profile...");
    const { error: profError } = await supabaseAdmin.from('profiles').upsert({
        id: userId,
        name: 'Priyesh',
        role: 'manager'
    });
    if (profError) console.error("Profile Error:", profError);
    else console.log("Profile updated.");

    // 4. Ensure Organization exists
    console.log("Checking Organizations...");
    let { data: org } = await supabaseAdmin.from('organizations').select('id').eq('name', 'Default Organization').maybeSingle();
    if (!org) {
        const { data: newOrg, error: orgError } = await supabaseAdmin.from('organizations').insert({ name: 'Default Organization' }).select('id').single();
        org = newOrg;
        console.log("Created Default Organization.");
    } else {
        console.log("Default Organization found.");
    }

    if (org) {
        // 5. Ensure Workspace exists
        const { data: ws } = await supabaseAdmin.from('workspaces').select('id').eq('org_id', org.id).maybeSingle();
        if (!ws) {
            await supabaseAdmin.from('workspaces').insert({ org_id: org.id, name: 'Default Workspace' });
            console.log("Created Default Workspace.");
        }

        // 6. Ensure Membership exists
        const { error: memError } = await supabaseAdmin.from('organization_members').upsert({
            org_id: org.id,
            user_id: userId,
            role: 'owner'
        });
        if (memError) console.error("Membership Error:", memError);
        else console.log("Membership updated as Owner.");
    }

    // 7. Reset Password (to be sure)
    console.log("Resetting password to 'password123'...");
    const { error: passError } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: 'password123' });
    if (passError) console.error("Password Reset Error:", passError);
    else console.log("Password reset successfully.");

    console.log("\nRESCUE COMPLETE.");
    console.log(`Please log in with: ${email} / password123`);
}

rescueAccount();
