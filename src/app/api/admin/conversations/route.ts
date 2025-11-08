/**
 * ADMIN CONVERSATIONS API ROUTE
 *
 * Purpose: Fetch all conversations with enriched user details for admin panel
 *
 * Why this is complex:
 * - User emails are stored in auth.users (not directly accessible)
 * - We need to join data from multiple tables: conversations, messages, auth.users
 * - We use a SECURITY DEFINER function to safely access auth.users
 *
 * Flow:
 * 1. Verify admin authentication
 * 2. Fetch all users via secure RPC function (gets emails from auth.users)
 * 3. Create lookup Map for fast user email/tier resolution
 * 4. Fetch conversations from database
 * 5. Enrich each conversation with user details, message count, latest message
 * 6. Apply optional search filtering
 * 7. Return JSON response
 *
 * Query Parameters:
 * - userId (optional): Filter conversations by specific user
 * - search (optional): Search by email, title, or message content
 */

import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const supabase = await createClient();

  // Check authentication
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('is_admin')
    .eq('id', session.user.id)
    .single();

  if (!profile?.is_admin) {
    return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
  }

  // Create service role client to access auth.users directly (bypasses RLS)
  const supabaseAdmin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  try {
    // Parse query parameters from the request URL
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId'); // Optional: filter by specific user
    const searchQuery = searchParams.get('search') || ''; // Optional: search filter

    // STEP 1: Fetch all users directly from auth.users using service role client
    // This bypasses PostgREST and RPC completely
    const { data: authUsers, error: authUsersError } = await supabaseAdmin.auth.admin.listUsers();

    if (authUsersError) {
      console.error('Error fetching auth users:', authUsersError);
      throw authUsersError;
    }

    // STEP 2: Fetch user_profiles to get subscription tiers
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('user_profiles')
      .select('id, subscription_tier');

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      throw profilesError;
    }

    // Create profile lookup map
    const profileMap = new Map(
      (profiles || []).map((p: any) => [p.id, p.subscription_tier])
    );

    // Combine auth users with their tiers
    const allUsers = (authUsers?.users || []).map((u: any) => ({
      id: u.id,
      email: u.email,
      subscription_tier: profileMap.get(u.id) || 'free'
    }));

    // STEP 3: Create a lookup Map for fast user email/tier resolution
    // Why Map? O(1) lookup performance vs O(n) with array.find()
    // Structure: Map<user_id, { email, tier }>
    const userLookup = new Map(
      (allUsers || []).map((u: any) => [u.id, { email: u.email, tier: u.subscription_tier }])
    );

    // STEP 3: Query conversations from the database
    // Note: We only select the fields we need from the conversations table
    // User email is NOT in this table - that's why we need the lookup map above
    let conversationsQuery = supabase
      .from('conversations')
      .select(`
        id,
        title,
        created_at,
        updated_at,
        user_id
      `)
      .order('updated_at', { ascending: false })
      .limit(100); // Limit to most recent 100 conversations for performance

    // Optional: Filter by specific user if userId parameter was provided
    if (userId) {
      conversationsQuery = conversationsQuery.eq('user_id', userId);
    }

    const { data: conversations, error: convsError } = await conversationsQuery;

    if (convsError) {
      console.error('Error fetching conversations:', convsError);
      throw convsError;
    }

    // STEP 4: Enrich each conversation with additional details
    // For each conversation, we need to:
    // 1. Get the user email/tier from our lookup map
    // 2. Count the total messages in the conversation
    // 3. Fetch the latest message for preview
    const conversationsWithDetails = await Promise.all(
      (conversations || []).map(async (conv) => {
        // Lookup user details from the Map we created earlier
        // TypeScript note: Map.get() can return undefined, so we cast with 'as' after the || fallback
        const userDetails = (userLookup.get(conv.user_id) || { email: 'Unknown', tier: 'free' }) as { email: string; tier: string };

        // Count messages in this conversation (head: true = don't return data, just count)
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', conv.id);

        // Get the most recent message for preview
        const { data: latestMessage } = await supabase
          .from('messages')
          .select('content, created_at, role')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        // Return enriched conversation object
        return {
          id: conv.id,
          title: conv.title,
          created_at: conv.created_at,
          updated_at: conv.updated_at,
          user_id: conv.user_id,
          user_email: userDetails.email, // From lookup map
          user_tier: userDetails.tier,   // From lookup map
          message_count: count || 0,
          latest_message: latestMessage ? {
            content: latestMessage.content?.substring(0, 150) + (latestMessage.content?.length > 150 ? '...' : ''),
            created_at: latestMessage.created_at,
            role: latestMessage.role,
          } : null,
        };
      })
    );

    // STEP 5: Apply client-side search filtering if search query was provided
    // We filter on: user email, conversation title, or message content
    let filteredConversations = conversationsWithDetails;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredConversations = conversationsWithDetails.filter(conv =>
        conv.user_email.toLowerCase().includes(query) ||
        conv.title?.toLowerCase().includes(query) ||
        conv.latest_message?.content?.toLowerCase().includes(query)
      );
    }

    return NextResponse.json({
      conversations: filteredConversations,
      total: filteredConversations.length,
    });
  } catch (error: any) {
    console.error('Conversations fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversations', details: error.message },
      { status: 500 }
    );
  }
}
