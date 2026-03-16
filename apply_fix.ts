import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Manual .env.local parser
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env: Record<string, string> = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) env[key.trim()] = value.trim();
});

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = env['NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Service Role Key in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
    const filePath = path.resolve(process.cwd(), 'update_rls_policy.sql');
    const sql = fs.readFileSync(filePath, 'utf8');
    
    console.log('Executing migration to fix task RLS...');
    
    // We try to use the same RPC as run_migration.ts
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
        console.error('Error executing migration via RPC:', error.message);
        console.log('\n--- SQL TO RUN MANUALLY IN SUPABASE SQL EDITOR ---\n');
        console.log(sql);
        console.log('\n-------------------------------------------------\n');
        process.exit(1);
    } else {
        console.log('Migration executed successfully. Employees can now create tasks.');
    }
}

runMigration();
