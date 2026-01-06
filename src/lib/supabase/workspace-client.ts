/**
 * WORKSPACE SUPABASE CLIENT
 *
 * This module provides type-safe access to workspace-related tables.
 * These tables are created by the workspace schema (src/lib/workspace/schema.sql)
 * and are not included in the auto-generated Supabase types.
 *
 * Once the schema is deployed and types are regenerated, this can be removed.
 */

import { createClient } from './server';

/**
 * Get a Supabase client with workspace table access
 * Bypasses type checking for workspace tables until schema is deployed
 */
export async function getWorkspaceClient() {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase as any;
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
