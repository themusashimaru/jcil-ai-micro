#!/usr/bin/env node
/**
 * SUPABASE CONNECTION TEST
 *
 * This script tests all three Supabase environment keys:
 * 1. NEXT_PUBLIC_SUPABASE_URL
 * 2. NEXT_PUBLIC_SUPABASE_ANON_KEY (public/client key)
 * 3. SUPABASE_SERVICE_ROLE_KEY (admin key)
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

console.log('\n🔍 TESTING SUPABASE CONNECTION...\n');

// Step 1: Check environment variables are set
console.log('📋 Step 1: Checking environment variables...');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL is not set');
  process.exit(1);
}
if (!anonKey) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY is not set');
  process.exit(1);
}
if (!serviceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY is not set');
  process.exit(1);
}

console.log('✅ NEXT_PUBLIC_SUPABASE_URL:', url);
console.log('✅ NEXT_PUBLIC_SUPABASE_ANON_KEY:', anonKey.substring(0, 20) + '...');
console.log('✅ SUPABASE_SERVICE_ROLE_KEY:', serviceKey.substring(0, 20) + '...');

// Step 2: Test Anon Key (Client) connection
console.log('\n📋 Step 2: Testing ANON KEY (client connection)...');
const clientSupabase = createClient(url, anonKey);

async function testAnonKey() {
  try {
    // Test basic connection by querying Supabase API
    const { data, error } = await clientSupabase
      .from('_test_connection')
      .select('*')
      .limit(1);

    if (error) {
      // Expected error for non-existent table, but connection works
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        console.log('✅ Anon key connected successfully (no tables yet, but auth works)');
        return true;
      }
      console.log('⚠️  Anon key connection issue:', error.message);
      return false;
    }
    console.log('✅ Anon key connected successfully');
    return true;
  } catch (err) {
    console.error('❌ Anon key connection failed:', err.message);
    return false;
  }
}

// Step 3: Test Service Role Key (Admin) connection
console.log('\n📋 Step 3: Testing SERVICE ROLE KEY (admin connection)...');
const adminSupabase = createClient(url, serviceKey);

async function testServiceKey() {
  try {
    const { data, error } = await adminSupabase
      .from('_test_connection')
      .select('*')
      .limit(1);

    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        console.log('✅ Service role key connected successfully (no tables yet, but auth works)');
        return true;
      }
      console.log('⚠️  Service role key connection issue:', error.message);
      return false;
    }
    console.log('✅ Service role key connected successfully');
    return true;
  } catch (err) {
    console.error('❌ Service role key connection failed:', err.message);
    return false;
  }
}

// Step 4: Test Auth functionality
console.log('\n📋 Step 4: Testing Auth API...');
async function testAuth() {
  try {
    const { data, error } = await clientSupabase.auth.getSession();
    if (error) {
      console.log('⚠️  Auth check:', error.message);
      return false;
    }
    console.log('✅ Auth API accessible (no active session, as expected)');
    return true;
  } catch (err) {
    console.error('❌ Auth API failed:', err.message);
    return false;
  }
}

// Run all tests
(async () => {
  const anonTest = await testAnonKey();
  const serviceTest = await testServiceKey();
  const authTest = await testAuth();

  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST RESULTS:');
  console.log('='.repeat(60));
  console.log(`Environment Variables: ✅ All set`);
  console.log(`Anon Key Connection:   ${anonTest ? '✅ Working' : '❌ Failed'}`);
  console.log(`Service Key Connection: ${serviceTest ? '✅ Working' : '❌ Failed'}`);
  console.log(`Auth API:              ${authTest ? '✅ Working' : '❌ Failed'}`);
  console.log('='.repeat(60));

  if (anonTest && serviceTest && authTest) {
    console.log('\n🎉 SUCCESS! All Supabase keys are working correctly!\n');
    console.log('Next steps:');
    console.log('  1. Create your database tables in Supabase');
    console.log('  2. Set up Row Level Security (RLS) policies');
    console.log('  3. Configure authentication providers\n');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Please check your keys in .env.local\n');
    process.exit(1);
  }
})();
