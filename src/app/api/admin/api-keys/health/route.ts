/**
 * API KEY HEALTH CHECK ENDPOINT
 *
 * Returns status and statistics for the API key pool
 * Admin-only endpoint for monitoring load balancing system
 */

import { createClient } from "@/lib/supabase/server";
import { getHealthStatus, getKeyPoolStats } from "@/lib/api-key-pool";

export async function GET(req: Request) {
  const supabase = await createClient();

  // Get authenticated user
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;

  if (!userId) {
    return new Response(
      JSON.stringify({ ok: false, error: "Authentication required" }),
      { status: 401, headers: { "content-type": "application/json" } }
    );
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('is_admin')
    .eq('id', userId)
    .single();

  if (!profile?.is_admin) {
    return new Response(
      JSON.stringify({ ok: false, error: "Admin access required" }),
      { status: 403, headers: { "content-type": "application/json" } }
    );
  }

  try {
    // Get health status from API key pool
    const health = getHealthStatus();
    const stats = getKeyPoolStats();

    // Get database stats for each key group
    const { data: dbStats, error } = await supabase
      .rpc('get_api_key_stats');

    if (error) {
      console.error('Error fetching API key stats from database:', error);
    }

    // Create a complete list of all key groups based on detected keys
    const completeStats = stats.keyGroups.map((keyGroup) => {
      const existing = dbStats?.find((s: any) => s.key_group === keyGroup);
      return existing || {
        key_group: keyGroup,
        user_count: 0,
        total_requests: 0,
        total_tokens: 0,
        last_request_at: null,
      };
    });

    console.log(`📊 Health Check: ${stats.totalKeys} keys detected, returning stats for ${completeStats.length} key groups`);

    return new Response(
      JSON.stringify({
        ok: true,
        health,
        stats,
        keyGroupStats: completeStats,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: {
          "content-type": "application/json",
          "cache-control": "no-cache, no-store, must-revalidate",
        },
      }
    );
  } catch (error: any) {
    console.error('Health check error:', error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Failed to get health status",
        details: error?.message || "Unknown error",
      }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}
