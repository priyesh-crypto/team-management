import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function finalCheck() {
    const { data: cols, error: colError } = await supabaseAdmin.from('profiles').select('*').limit(1);
    if (colError) console.error("Profiles Error:", colError);
    else console.log("Profiles Columns:", Object.keys(cols?.[0] || {}));

    const { data: user } = await supabaseAdmin.from('profiles').select('*').eq('email', 'priyesh@scaletrix.ai').maybeSingle();
    console.log("Priyesh Profile:", user);
}

finalCheck();
