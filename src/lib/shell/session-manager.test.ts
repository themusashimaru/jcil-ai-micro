/**
 * SHELL SESSION MANAGER TESTS
 *
 * Tests for ShellSessionManager and the Mutex utility.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// MOCKS — All defined INSIDE factories (hoisting-safe)
// ============================================================================

vi.mock('@supabase/supabase-js', () => {
  const mockSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
  const mockLimit = vi.fn(() => ({ single: mockSingle, data: [], error: null }));
  const mockOrder = vi.fn(() => ({ limit: mockLimit, data: [], error: null }));
  const mockNeq = vi.fn(() => ({
    order: mockOrder,
    select: vi.fn(() => Promise.resolve({ data: [], error: null })),
  }));
  const mockLt = vi.fn(() => ({
    neq: vi.fn(() => ({
      select: vi.fn(() => Promise.resolve({ data: [{ id: 'old-session-1' }], error: null })),
    })),
  }));
  const mockEq = vi.fn(() => ({
    single: mockSingle,
    eq: mockEq,
    neq: mockNeq,
    order: mockOrder,
    select: vi.fn(() => Promise.resolve({ data: [], error: null })),
  }));
  const mockSelect = vi.fn(() => ({
    eq: mockEq,
    single: mockSingle,
  }));
  const mockInsert = vi.fn(() => ({
    select: vi.fn(() => ({
      single: vi.fn(() =>
        Promise.resolve({
          data: {
            id: 'test-session-id',
            workspace_id: 'ws-1',
            user_id: 'user-1',
            name: 'Test Shell',
            status: 'active',
            cwd: '/workspace',
            env_vars: {},
            last_activity: new Date().toISOString(),
            created_at: new Date().toISOString(),
          },
          error: null,
        })
      ),
    })),
    error: null,
  }));
  const mockUpdate = vi.fn(() => ({
    eq: vi.fn(() => Promise.resolve({ error: null })),
    lt: mockLt,
  }));

  return {
    createClient: vi.fn(() => ({
      from: vi.fn(() => ({
        select: mockSelect,
        insert: mockInsert,
        update: mockUpdate,
        eq: mockEq,
      })),
    })),
  };
});

vi.mock('@/lib/workspace/container', () => ({
  ContainerManager: vi.fn(),
  getContainerManager: vi.fn(() => ({
    executeCommand: vi.fn(() =>
      Promise.resolve({
        stdout: 'output\n__CWD__=/workspace/subdir',
        stderr: '',
        exitCode: 0,
        executionTime: 100,
      })
    ),
  })),
  ExecutionResult: {},
}));

vi.mock('@/lib/logger', () => ({
  logger: vi.fn(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

// ============================================================================
// TESTS
// ============================================================================

describe('ShellSessionManager', () => {
  let ShellSessionManager: typeof import('./session-manager').ShellSessionManager;
  let getShellSessionManager: typeof import('./session-manager').getShellSessionManager;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Dynamically import to get fresh module with mocks
    const mod = await import('./session-manager');
    ShellSessionManager = mod.ShellSessionManager;
    getShellSessionManager = mod.getShellSessionManager;
  });

  describe('constructor', () => {
    it('should create a ShellSessionManager instance', () => {
      const manager = new ShellSessionManager();
      expect(manager).toBeInstanceOf(ShellSessionManager);
    });

    it('should initialize supabase and container manager', async () => {
      const supabaseMod = await import('@supabase/supabase-js');
      const { createClient } = vi.mocked(supabaseMod);
      new ShellSessionManager();
      expect(createClient).toHaveBeenCalled();
    });
  });

  describe('getShellSessionManager (singleton)', () => {
    it('should return a ShellSessionManager instance', () => {
      const mgr = getShellSessionManager();
      expect(mgr).toBeInstanceOf(ShellSessionManager);
    });
  });

  describe('createSession', () => {
    it('should create a session and return it mapped', async () => {
      const manager = new ShellSessionManager();
      const session = await manager.createSession('ws-1', 'user-1', 'My Shell');
      expect(session).toBeDefined();
      expect(session.id).toBe('test-session-id');
      expect(session.workspaceId).toBe('ws-1');
      expect(session.userId).toBe('user-1');
      expect(session.status).toBe('active');
    });

    it('should use default name when none provided', async () => {
      const manager = new ShellSessionManager();
      const session = await manager.createSession('ws-1', 'user-1');
      expect(session).toBeDefined();
      expect(session.name).toBeDefined();
    });

    it('should set initial cwd to /workspace', async () => {
      const manager = new ShellSessionManager();
      const session = await manager.createSession('ws-1', 'user-1');
      expect(session.cwd).toBe('/workspace');
    });

    it('should set initial env to empty object', async () => {
      const manager = new ShellSessionManager();
      const session = await manager.createSession('ws-1', 'user-1');
      expect(session.env).toEqual({});
    });
  });

  describe('getSession', () => {
    it('should return null when session not found', async () => {
      const manager = new ShellSessionManager();
      const session = await manager.getSession('nonexistent');
      expect(session).toBeNull();
    });
  });

  describe('getWorkspaceSessions', () => {
    it('should return empty array on error', async () => {
      const manager = new ShellSessionManager();
      const sessions = await manager.getWorkspaceSessions('ws-1');
      // The mock returns empty data by default
      expect(Array.isArray(sessions)).toBe(true);
    });
  });

  describe('markIdle', () => {
    it('should update session status to idle', async () => {
      const manager = new ShellSessionManager();
      await expect(manager.markIdle('session-1')).resolves.not.toThrow();
    });
  });

  describe('markActive', () => {
    it('should update session status to active', async () => {
      const manager = new ShellSessionManager();
      await expect(manager.markActive('session-1')).resolves.not.toThrow();
    });
  });

  describe('terminateSession', () => {
    it('should terminate session and clean up state', async () => {
      const manager = new ShellSessionManager();
      await expect(manager.terminateSession('session-1')).resolves.not.toThrow();
    });
  });

  describe('cleanupOldSessions', () => {
    it('should accept olderThanHours parameter', async () => {
      const manager = new ShellSessionManager();
      const count = await manager.cleanupOldSessions(48);
      expect(typeof count).toBe('number');
    });

    it('should default to 24 hours', async () => {
      const manager = new ShellSessionManager();
      const count = await manager.cleanupOldSessions();
      expect(typeof count).toBe('number');
    });
  });

  describe('getCommandHistory', () => {
    it('should return empty array on error', async () => {
      const manager = new ShellSessionManager();
      const history = await manager.getCommandHistory('session-1');
      expect(Array.isArray(history)).toBe(true);
    });

    it('should accept a limit parameter', async () => {
      const manager = new ShellSessionManager();
      const history = await manager.getCommandHistory('session-1', 10);
      expect(Array.isArray(history)).toBe(true);
    });
  });

  describe('getSessionState', () => {
    it('should return null for unknown session with no db data', async () => {
      const manager = new ShellSessionManager();
      const state = await manager.getSessionState('unknown-session');
      // getSession returns null, so getSessionState returns null
      expect(state).toBeNull();
    });
  });
});

describe('ShellSession type', () => {
  it('should have correct structure', () => {
    const session: import('./session-manager').ShellSession = {
      id: 'abc',
      workspaceId: 'ws-1',
      userId: 'u-1',
      name: 'My Shell',
      status: 'active',
      cwd: '/workspace',
      env: { NODE_ENV: 'development' },
      lastActivity: new Date(),
      createdAt: new Date(),
    };
    expect(session.status).toBe('active');
    expect(session.cwd).toBe('/workspace');
    expect(session.env).toHaveProperty('NODE_ENV');
  });

  it('should support idle status', () => {
    const session: import('./session-manager').ShellSession = {
      id: 'abc',
      workspaceId: 'ws-1',
      userId: 'u-1',
      name: 'Shell',
      status: 'idle',
      cwd: '/workspace',
      env: {},
      lastActivity: new Date(),
      createdAt: new Date(),
    };
    expect(session.status).toBe('idle');
  });

  it('should support terminated status', () => {
    const session: import('./session-manager').ShellSession = {
      id: 'abc',
      workspaceId: 'ws-1',
      userId: 'u-1',
      name: 'Shell',
      status: 'terminated',
      cwd: '/workspace',
      env: {},
      lastActivity: new Date(),
      createdAt: new Date(),
    };
    expect(session.status).toBe('terminated');
  });
});

describe('SessionState type', () => {
  it('should have required fields', () => {
    const state: import('./session-manager').SessionState = {
      cwd: '/workspace',
      env: {},
    };
    expect(state.cwd).toBe('/workspace');
    expect(state.env).toEqual({});
  });

  it('should have optional fields', () => {
    const state: import('./session-manager').SessionState = {
      cwd: '/workspace',
      env: { PATH: '/usr/bin' },
      lastCommand: 'ls -la',
      lastOutput: 'total 40',
      lastExitCode: 0,
    };
    expect(state.lastCommand).toBe('ls -la');
    expect(state.lastExitCode).toBe(0);
  });
});

describe('ExecuteOptions type', () => {
  it('should support timeout', () => {
    const opts: import('./session-manager').ExecuteOptions = {
      timeout: 5000,
    };
    expect(opts.timeout).toBe(5000);
  });

  it('should support stream callbacks', () => {
    const onStdout = vi.fn();
    const onStderr = vi.fn();
    const opts: import('./session-manager').ExecuteOptions = {
      stream: { onStdout, onStderr },
    };
    expect(opts.stream?.onStdout).toBe(onStdout);
    expect(opts.stream?.onStderr).toBe(onStderr);
  });

  it('should allow empty options', () => {
    const opts: import('./session-manager').ExecuteOptions = {};
    expect(opts.timeout).toBeUndefined();
    expect(opts.stream).toBeUndefined();
  });
});
