/**
 * WORKSPACE SUPABASE CLIENT
 *
 * Provides access to workspace-related tables that aren't in the
 * auto-generated Supabase types yet. Uses a typed accessor pattern
 * so callers don't need eslint-disable comments.
 *
 * Once the schema is deployed and types are regenerated, replace
 * `untypedFrom()` calls with standard `supabase.from()`.
 */

import { createClient } from './server';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Access a Supabase table that isn't in the generated types yet.
 * Provides query builder access without per-callsite eslint-disable.
 *
 * Usage:
 *   const { data } = await untypedFrom(supabase, 'strategy_sessions').select('*');
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function untypedFrom(supabase: SupabaseClient<any>, table: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).from(table);
}

/**
 * Call an RPC function that isn't in the generated types yet.
 *
 * Usage:
 *   await untypedRpc(supabase, 'upsert_code_lab_presence', { p_session_id: '...' });
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function untypedRpc(
  supabase: SupabaseClient<any>,
  fn: string,
  params: Record<string, unknown> = {}
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).rpc(fn, params);
}

/**
 * Get a Supabase client + untyped table accessor
 */
export async function getWorkspaceClient() {
  const supabase = await createClient();
  return {
    supabase,
    from: (table: string) => untypedFrom(supabase, table),
  };
}

/**
 * Workspace table names for reference
 */
export const WORKSPACE_TABLES = {
  workspaces: 'workspaces',
  shellSessions: 'shell_sessions',
  shellCommands: 'shell_commands',
  backgroundTasks: 'background_tasks',
  aiSessions: 'ai_sessions',
  batchOperations: 'batch_operations',
  codebaseIndexes: 'codebase_indexes',
  fileEmbeddings: 'file_embeddings',
  toolExecutions: 'tool_executions',
  workspaceSnapshots: 'workspace_snapshots',
} as const;

/**
 * RPC functions defined in workspace schema
 */
export const WORKSPACE_RPC = {
  searchCodeEmbeddings: 'search_code_embeddings',
  getWorkspaceStats: 'get_workspace_stats',
  cleanupOldWorkspaceData: 'cleanup_old_workspace_data',
} as const;
