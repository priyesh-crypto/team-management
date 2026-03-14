import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testRls() {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'priyesh@scaletrix.ai',
        password: 'password123'
    });

    if (authError) {
        console.error("Auth error:", authError.message);
        return;
    }

    const { data: members, error: memError } = await supabase
        .from('organization_members')
        .select('*')
        .eq('user_id', authData.user.id);

    console.log("Members fetched with RLS:", members);
    console.log("RLS Error:", memError);
}

testRls();
