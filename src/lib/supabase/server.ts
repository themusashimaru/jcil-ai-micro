import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL as string;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

// Server-side client (no session persistence; bypasses RLS with service role)
export const supabaseServer = createClient(url, service, {
  auth: { persistSession: false },
});
