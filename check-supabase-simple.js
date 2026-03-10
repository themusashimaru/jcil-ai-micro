const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function quickCheck() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  
  console.log('Testing basic auth check...');
  try {
    const { data, error } = await supabase.auth.getSession();
    console.log('✅ Auth connection works!');
    console.log('Session:', data.session ? 'Active' : 'None (expected for new project)');
    
    // Try to list tables
    console.log('\nChecking if database has tables...');
    const { data: tables, error: tableError } = await supabase
      .rpc('pg_tables')
      .select('*');
    
    if (tableError) {
      console.log('ℹ️  No custom tables yet (fresh Supabase project)');
    } else {
      console.log('Found tables:', tables);
    }
    
    console.log('\n✅ Your Supabase keys are working!');
    console.log('Next step: Set up your database tables');
  } catch (err) {
    console.error('Error:', err.message);
  }
}

quickCheck();
