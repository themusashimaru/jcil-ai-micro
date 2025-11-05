import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

// ✅ FIXED - Made async to handle Next.js 15+ cookies API
export async function createClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies(); // ✅ Added await

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // Handle edge cases where set might fail
            console.error('Failed to set cookie:', error);
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set({ name, value: '', ...options, maxAge: 0 });
          } catch (error) {
            console.error('Failed to remove cookie:', error);
          }
        },
      },
    }
  ) as unknown as SupabaseClient;
}