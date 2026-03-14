import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    // Check tables and columns
    console.log("Checking tables...");
    
    // We can't easily check 'all' tables with RPC if it's not set up, 
    // but we can try to query profiles to see if the columns we expect are there.
    const { data: cols, error: colError } = await supabaseAdmin.from('tasks').select('*').limit(1);
    if (colError) console.error("Tasks Error:", colError);
    else console.log("Tasks Columns:", Object.keys(cols?.[0] || {}));

    const { data: subcols, error: subError } = await supabaseAdmin.from('subtasks').select('*').limit(1);
    if (subError) console.error("Subtasks Error:", subError);
    else console.log("Subtasks Columns:", Object.keys(subcols?.[0] || {}));

    // Check if RLS is effectively blocking something by trying to insert a task without org_id (as admin)
    // Wait, admin bypasses RLS, so that's not a good test for RLS.
}

checkSchema();
