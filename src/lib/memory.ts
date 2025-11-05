export type MinimalMsg = { role: 'user' | 'assistant'; content: string };

export async function getLongTermMemory(
  supabaseAdmin: any,
  user_id: string,
  excludeConversationId: string,
  limit: number = 50
): Promise<MinimalMsg[]> {
  if (!user_id) return [];

  const { data, error } = await supabaseAdmin
    .from('messages')
    .select('role, content, conversation_id, created_at')
    .eq('user_id', user_id)
    .neq('conversation_id', excludeConversationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  // Oldest first for better context
  return data.reverse().map((m: any) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content ?? '')
  }));
}


export async function saveMemoryExtract(user_id: string, extract: string) {
  try {
    const { supabaseAdmin } = await import("@/lib/supabase-admin");
    if (!user_id || !extract || !extract.trim()) return;
    await supabaseAdmin
      .from("long_memory")
      .insert({ user_id, extract: extract.trim() });
  } catch (_) {}
}
