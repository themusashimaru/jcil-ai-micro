import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

const GUEST_ID = "00000000-0000-0000-0000-000000000000";

export async function getUserIdOrGuest() {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
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
  if (error || !data?.user?.id) return GUEST_ID;
  return data.user.id;
}
