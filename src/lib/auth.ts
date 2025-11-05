import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Server-side Supabase client that reads/writes auth via Next.js cookies.
 * Uses the public anon key (never the service role key) for user auth context.
 */
export async function getSupabaseServerClient() {
  const jar = await cookies(); // Next.js 16: cookies() is async

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return jar.get(name)?.value;
        },
        set() {
          // no-op for API routes; mutate in route handlers if needed
        },
        remove() {
          // no-op for API routes; mutate in route handlers if needed
        },
      },
    }
  );

  return supabase;
}

/**
 * Returns the signed-in user's id, or "guest" if not authenticated.
 */
export async function getUserIdOrGuest(): Promise<string> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    // Soft-fail to guest if there's no session
    return "guest";
  }
  return data?.user?.id ?? "guest";
}
