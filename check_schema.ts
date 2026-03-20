import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl!, supabaseKey!);

async function checkSchema() {
    console.log("Checking column types for 'tasks'...");
    
    // We can use a raw SQL query if we have an exec_sql RPC,
    // or we can try to guess by looking at the data or using a clever query.
    // Let's try to use RPC 'exec_sql' if it exists.
    
    const { data, error } = await supabaseAdmin.rpc('exec_sql', { sql_query: `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'tasks';
    `});

    if (error) {
        console.error("RPC Error (exec_sql might not exist):", error.message);
        // Fallback: Just select one row and check types if possible (limited in JS)
        const { data: rows } = await supabaseAdmin.from('tasks').select('*').limit(1);
        console.log("Tasks sample row keys:", Object.keys(rows?.[0] || {}));
    } else {
        console.table(data);
    }
}

checkSchema();
