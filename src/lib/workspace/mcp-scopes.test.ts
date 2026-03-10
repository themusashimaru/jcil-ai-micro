import { describe, it, expect, vi } from 'vitest';
import {
  MCPScopeManager,
  getMCPScopeManager,
  getMCPScopeTools,
  isMCPScopeTool,
} from './mcp-scopes';

// Mock dependencies
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/supabase/workspace-client', () => ({
  untypedFrom: () => ({
    select: () => ({
      eq: () => Promise.resolve({ data: [], error: null }),
    }),
    upsert: () => Promise.resolve({}),
    delete: () => ({
      eq: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => Promise.resolve({}),
            is: () => Promise.resolve({}),
          }),
        }),
      }),
    }),
  }),
}));

// -------------------------------------------------------------------
// MCPScopeManager
// -------------------------------------------------------------------
describe('MCPScopeManager', () => {
  describe('checkTool - no permissions', () => {
    it('should deny by default', () => {
      const mgr = new MCPScopeManager('u1');
      const result = mgr.checkTool('server1', 'tool1');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('No permission configured');
    });
  });

  describe('checkTool - with permissions', () => {
    function createMgrWithPerms() {
      const mgr = new MCPScopeManager('u1');
      // Manually set permissions via in-memory state
      // Use the private permissions map accessed through setPermission
      return mgr;
    }

    it('should allow tool in allowed list', async () => {
      const mgr = createMgrWithPerms();
      await mgr.setPermission({
        serverId: 'srv1',
        scope: 'user',
        scopeId: 'u1',
        allowedTools: ['read_*', 'write_file'],
        deniedTools: [],
        autoApprove: false,
      });

      const result = mgr.checkTool('srv1', 'write_file', { sessionId: 's1' });
      expect(result.allowed).toBe(true);
    });

    it('should deny tool in denied list', async () => {
      const mgr = new MCPScopeManager('u1');
      await mgr.setPermission({
        serverId: 'srv1',
        scope: 'user',
        scopeId: 'u1',
        allowedTools: [],
        deniedTools: ['dangerous_*'],
        autoApprove: false,
      });

      const result = mgr.checkTool('srv1', 'dangerous_delete', { sessionId: 's1' });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('denied');
    });

    it('should match wildcard patterns', async () => {
      const mgr = new MCPScopeManager('u1');
      await mgr.setPermission({
        serverId: 'srv1',
        scope: 'user',
        scopeId: 'u1',
        allowedTools: ['file_*'],
        deniedTools: [],
        autoApprove: false,
      });

      expect(mgr.checkTool('srv1', 'file_read').allowed).toBe(true);
      expect(mgr.checkTool('srv1', 'file_write').allowed).toBe(true);
      expect(mgr.checkTool('srv1', 'db_query').allowed).toBe(false);
    });

    it('should match * wildcard for all tools', async () => {
      const mgr = new MCPScopeManager('u1');
      await mgr.setPermission({
        serverId: 'srv1',
        scope: 'user',
        scopeId: 'u1',
        allowedTools: ['*'],
        deniedTools: [],
        autoApprove: false,
      });

      expect(mgr.checkTool('srv1', 'anything').allowed).toBe(true);
    });

    it('should auto-approve when enabled', async () => {
      const mgr = new MCPScopeManager('u1');
      await mgr.setPermission({
        serverId: 'srv1',
        scope: 'user',
        scopeId: 'u1',
        allowedTools: [],
        deniedTools: [],
        autoApprove: true,
      });

      const result = mgr.checkTool('srv1', 'any_tool');
      expect(result.allowed).toBe(true);
      expect(result.reason).toContain('Auto-approved');
    });

    it('should prioritize deny over allow', async () => {
      const mgr = new MCPScopeManager('u1');
      await mgr.setPermission({
        serverId: 'srv1',
        scope: 'user',
        scopeId: 'u1',
        allowedTools: ['*'],
        deniedTools: ['dangerous'],
        autoApprove: false,
      });

      expect(mgr.checkTool('srv1', 'dangerous').allowed).toBe(false);
    });
  });

  describe('scope hierarchy', () => {
    it('should prioritize managed over user scope', async () => {
      const mgr = new MCPScopeManager('u1');

      // User scope allows
      await mgr.setPermission({
        serverId: 'srv1',
        scope: 'user',
        scopeId: 'u1',
        allowedTools: ['*'],
        deniedTools: [],
        autoApprove: false,
      });

      // Managed scope denies
      await mgr.setPermission({
        serverId: 'srv1',
        scope: 'managed',
        scopeId: 'org1',
        allowedTools: [],
        deniedTools: ['blocked_tool'],
        autoApprove: false,
        locked: true,
      });

      const result = mgr.checkTool('srv1', 'blocked_tool', { organizationId: 'org1' });
      expect(result.allowed).toBe(false);
      expect(result.scope).toBe('managed');
      expect(result.locked).toBe(true);
    });
  });

  describe('getPermission / listPermissions', () => {
    it('should return null for unknown permission', () => {
      const mgr = new MCPScopeManager('u1');
      expect(mgr.getPermission('unknown', 'user')).toBeNull();
    });

    it('should list all permissions', async () => {
      const mgr = new MCPScopeManager('u1');
      await mgr.setPermission({
        serverId: 'srv1',
        scope: 'user',
        scopeId: 'u1',
        allowedTools: ['*'],
        deniedTools: [],
        autoApprove: false,
      });
      expect(mgr.listPermissions()).toHaveLength(1);
    });
  });

  describe('checkToolLegacy', () => {
    it('should work as backwards-compatible wrapper', async () => {
      const mgr = new MCPScopeManager('u1');
      await mgr.setPermission({
        serverId: 'srv1',
        scope: 'user',
        scopeId: 'u1',
        allowedTools: ['*'],
        deniedTools: [],
        autoApprove: false,
      });

      const result = mgr.checkToolLegacy('srv1', 'any_tool', 's1', 'ws1');
      expect(result.allowed).toBe(true);
    });
  });
});

// -------------------------------------------------------------------
// getMCPScopeManager
// -------------------------------------------------------------------
describe('getMCPScopeManager', () => {
  it('should return same instance for same userId', () => {
    expect(getMCPScopeManager('u1')).toBe(getMCPScopeManager('u1'));
  });

  it('should return different instances for different users', () => {
    expect(getMCPScopeManager('u1')).not.toBe(getMCPScopeManager('u2'));
  });
});

// -------------------------------------------------------------------
// getMCPScopeTools
// -------------------------------------------------------------------
describe('getMCPScopeTools', () => {
  it('should return 5 tools', () => {
    const tools = getMCPScopeTools();
    expect(tools).toHaveLength(5);
    expect(tools.map((t) => t.name)).toEqual([
      'mcp_scope_list',
      'mcp_scope_set',
      'mcp_scope_check',
      'mcp_scope_delete',
      'mcp_scope_hierarchy',
    ]);
  });
});

// -------------------------------------------------------------------
// isMCPScopeTool
// -------------------------------------------------------------------
describe('isMCPScopeTool', () => {
  it('should return true for mcp_scope_ prefixed tools', () => {
    expect(isMCPScopeTool('mcp_scope_list')).toBe(true);
    expect(isMCPScopeTool('mcp_scope_set')).toBe(true);
  });

  it('should return false for non-mcp tools', () => {
    expect(isMCPScopeTool('other')).toBe(false);
  });
});
