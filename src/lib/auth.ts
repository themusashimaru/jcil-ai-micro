import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/** Returns logged-in user's id, or "guest" if not signed in. */
export async function getUserIdOrGuest(): Promise<string> {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set() {},
          remove() {},
        },
      }
    );

    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user?.id) return "guest";
    return data.user.id;
  } catch {
    return "guest";
  }
}
