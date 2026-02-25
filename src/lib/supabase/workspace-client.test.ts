import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

const mockFrom = vi.fn().mockReturnValue({ select: vi.fn() });
const mockRpc = vi.fn().mockReturnValue({ data: null });
const mockSupabase = { from: mockFrom, rpc: mockRpc };

vi.mock('./server-auth', () => ({
  createServerSupabaseClient: vi.fn().mockResolvedValue({
    from: vi.fn().mockReturnValue({ select: vi.fn() }),
    rpc: vi.fn().mockReturnValue({ data: null }),
  }),
}));

vi.mock('./server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn().mockReturnValue({ select: vi.fn() }),
    rpc: vi.fn().mockReturnValue({ data: null }),
  }),
}));

import {
  untypedFrom,
  untypedRpc,
  getWorkspaceClient,
  WORKSPACE_TABLES,
  WORKSPACE_RPC,
} from './workspace-client';

// ============================================================================
// untypedFrom
// ============================================================================

describe('untypedFrom', () => {
  it('should call supabase.from with the given table name', () => {
    untypedFrom(mockSupabase as never, 'workspaces');
    expect(mockFrom).toHaveBeenCalledWith('workspaces');
  });

  it('should return the query builder from supabase.from', () => {
    const result = untypedFrom(mockSupabase as never, 'shell_sessions');
    expect(result).toBeDefined();
  });

  it('should work with any table name string', () => {
    untypedFrom(mockSupabase as never, 'custom_table');
    expect(mockFrom).toHaveBeenCalledWith('custom_table');
  });
});

// ============================================================================
// untypedRpc
// ============================================================================

describe('untypedRpc', () => {
  it('should call supabase.rpc with function name and params', () => {
    untypedRpc(mockSupabase as never, 'search_code_embeddings', { query: 'test' });
    expect(mockRpc).toHaveBeenCalledWith('search_code_embeddings', { query: 'test' });
  });

  it('should default params to empty object', () => {
    untypedRpc(mockSupabase as never, 'get_workspace_stats');
    expect(mockRpc).toHaveBeenCalledWith('get_workspace_stats', {});
  });

  it('should return the rpc result', () => {
    const result = untypedRpc(mockSupabase as never, 'cleanup_old_workspace_data');
    expect(result).toBeDefined();
  });
});

// ============================================================================
// getWorkspaceClient
// ============================================================================

describe('getWorkspaceClient', () => {
  it('should return an object with supabase and from properties', async () => {
    const client = await getWorkspaceClient();
    expect(client).toHaveProperty('supabase');
    expect(client).toHaveProperty('from');
  });

  it('should have from as a function', async () => {
    const client = await getWorkspaceClient();
    expect(typeof client.from).toBe('function');
  });
});

// ============================================================================
// WORKSPACE_TABLES
// ============================================================================

describe('WORKSPACE_TABLES', () => {
  it('should have workspaces table', () => {
    expect(WORKSPACE_TABLES.workspaces).toBe('workspaces');
  });

  it('should have shellSessions table', () => {
    expect(WORKSPACE_TABLES.shellSessions).toBe('shell_sessions');
  });

  it('should have shellCommands table', () => {
    expect(WORKSPACE_TABLES.shellCommands).toBe('shell_commands');
  });

  it('should have backgroundTasks table', () => {
    expect(WORKSPACE_TABLES.backgroundTasks).toBe('background_tasks');
  });

  it('should have aiSessions table', () => {
    expect(WORKSPACE_TABLES.aiSessions).toBe('ai_sessions');
  });

  it('should have batchOperations table', () => {
    expect(WORKSPACE_TABLES.batchOperations).toBe('batch_operations');
  });

  it('should have codebaseIndexes table', () => {
    expect(WORKSPACE_TABLES.codebaseIndexes).toBe('codebase_indexes');
  });

  it('should have fileEmbeddings table', () => {
    expect(WORKSPACE_TABLES.fileEmbeddings).toBe('file_embeddings');
  });

  it('should have toolExecutions table', () => {
    expect(WORKSPACE_TABLES.toolExecutions).toBe('tool_executions');
  });

  it('should have workspaceSnapshots table', () => {
    expect(WORKSPACE_TABLES.workspaceSnapshots).toBe('workspace_snapshots');
  });

  it('should have exactly 10 table entries', () => {
    expect(Object.keys(WORKSPACE_TABLES)).toHaveLength(10);
  });
});

// ============================================================================
// WORKSPACE_RPC
// ============================================================================

describe('WORKSPACE_RPC', () => {
  it('should have searchCodeEmbeddings rpc', () => {
    expect(WORKSPACE_RPC.searchCodeEmbeddings).toBe('search_code_embeddings');
  });

  it('should have getWorkspaceStats rpc', () => {
    expect(WORKSPACE_RPC.getWorkspaceStats).toBe('get_workspace_stats');
  });

  it('should have cleanupOldWorkspaceData rpc', () => {
    expect(WORKSPACE_RPC.cleanupOldWorkspaceData).toBe('cleanup_old_workspace_data');
  });

  it('should have exactly 3 rpc entries', () => {
    expect(Object.keys(WORKSPACE_RPC)).toHaveLength(3);
  });
});
