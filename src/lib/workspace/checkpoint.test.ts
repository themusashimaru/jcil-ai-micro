import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CheckpointManager,
  getCheckpointManager,
  resetCheckpointManager,
  getCheckpointTools,
  isCheckpointTool,
} from './checkpoint';

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
    insert: () => Promise.resolve({}),
    select: () => ({
      eq: () => ({
        single: () => Promise.resolve({ data: null, error: { message: 'not found' } }),
      }),
    }),
    delete: () => ({
      eq: () => Promise.resolve({}),
    }),
  }),
}));

vi.mock('./backup-service', () => ({
  storeBackup: vi.fn().mockResolvedValue({}),
  getBackup: vi.fn().mockResolvedValue(null),
}));

// -------------------------------------------------------------------
// CheckpointManager
// -------------------------------------------------------------------
describe('CheckpointManager', () => {
  let mgr: CheckpointManager;

  beforeEach(() => {
    mgr = new CheckpointManager();
  });

  describe('createCheckpoint', () => {
    it('should create a checkpoint with files', async () => {
      const cp = await mgr.createCheckpoint('s1', 'ws1', 'u1', {
        files: [{ path: 'a.ts', content: 'const a = 1;' }],
        messageCount: 5,
        context: { cwd: '/workspace' },
      });

      expect(cp.id).toMatch(/^cp_/);
      expect(cp.sessionId).toBe('s1');
      expect(cp.workspaceId).toBe('ws1');
      expect(cp.files).toHaveLength(1);
      expect(cp.files[0].path).toBe('a.ts');
      expect(cp.files[0].hash).toBeTruthy();
      expect(cp.messageCount).toBe(5);
    });

    it('should use default type and label', async () => {
      const cp = await mgr.createCheckpoint('s1', 'ws1', 'u1', {
        files: [],
        messageCount: 0,
        context: {},
      });
      expect(cp.type).toBe('manual');
      expect(cp.label).toContain('Checkpoint');
    });

    it('should use custom type and label', async () => {
      const cp = await mgr.createCheckpoint('s1', 'ws1', 'u1', {
        label: 'Before deploy',
        type: 'pre_deploy',
        files: [],
        messageCount: 10,
        context: {},
      });
      expect(cp.type).toBe('pre_deploy');
      expect(cp.label).toBe('Before deploy');
    });

    it('should enforce max checkpoints per session', async () => {
      // Create 51 checkpoints (default max is 50)
      for (let i = 0; i < 51; i++) {
        await mgr.createCheckpoint('s1', 'ws1', 'u1', {
          files: [],
          messageCount: i,
          context: {},
        });
      }

      const list = await mgr.listCheckpoints('s1', { limit: 100 });
      expect(list.length).toBeLessThanOrEqual(50);
    });
  });

  describe('getCheckpoint', () => {
    it('should return checkpoint by ID', async () => {
      const cp = await mgr.createCheckpoint('s1', 'ws1', 'u1', {
        files: [{ path: 'f.ts', content: 'x' }],
        messageCount: 1,
        context: {},
      });
      const retrieved = await mgr.getCheckpoint(cp.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(cp.id);
    });

    it('should return null for unknown checkpoint', async () => {
      const result = await mgr.getCheckpoint('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('listCheckpoints', () => {
    it('should list checkpoints for a session', async () => {
      await mgr.createCheckpoint('s1', 'ws1', 'u1', {
        files: [],
        messageCount: 1,
        context: {},
      });
      await mgr.createCheckpoint('s1', 'ws1', 'u1', {
        files: [{ path: 'a.ts', content: 'a' }],
        messageCount: 2,
        context: {},
      });
      await mgr.createCheckpoint('s2', 'ws1', 'u1', {
        files: [],
        messageCount: 1,
        context: {},
      });

      const list = await mgr.listCheckpoints('s1');
      expect(list).toHaveLength(2);
    });

    it('should filter by type', async () => {
      await mgr.createCheckpoint('s1', 'ws1', 'u1', {
        type: 'manual',
        files: [],
        messageCount: 1,
        context: {},
      });
      await mgr.createCheckpoint('s1', 'ws1', 'u1', {
        type: 'auto_milestone',
        files: [],
        messageCount: 2,
        context: {},
      });

      const list = await mgr.listCheckpoints('s1', { type: 'manual' });
      expect(list).toHaveLength(1);
    });

    it('should support pagination', async () => {
      for (let i = 0; i < 5; i++) {
        await mgr.createCheckpoint('s1', 'ws1', 'u1', {
          files: [],
          messageCount: i,
          context: {},
        });
      }

      const page = await mgr.listCheckpoints('s1', { limit: 2, offset: 1 });
      expect(page).toHaveLength(2);
    });

    it('should return empty for unknown session', async () => {
      expect(await mgr.listCheckpoints('unknown')).toHaveLength(0);
    });
  });

  describe('rewindToCheckpoint', () => {
    it('should restore files', async () => {
      const cp = await mgr.createCheckpoint('s1', 'ws1', 'u1', {
        files: [
          { path: 'a.ts', content: 'original a' },
          { path: 'b.ts', content: 'original b' },
        ],
        messageCount: 5,
        context: {},
      });

      const writeFile = vi.fn();
      const result = await mgr.rewindToCheckpoint(cp.id, writeFile);

      expect(result.success).toBe(true);
      expect(result.filesRestored).toHaveLength(2);
      expect(writeFile).toHaveBeenCalledTimes(2);
    });

    it('should return error for unknown checkpoint', async () => {
      const writeFile = vi.fn();
      const result = await mgr.rewindToCheckpoint('nonexistent', writeFile);
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should handle write errors', async () => {
      const cp = await mgr.createCheckpoint('s1', 'ws1', 'u1', {
        files: [{ path: 'a.ts', content: 'data' }],
        messageCount: 1,
        context: {},
      });

      const writeFile = vi.fn().mockRejectedValue(new Error('disk full'));
      const result = await mgr.rewindToCheckpoint(cp.id, writeFile);
      expect(result.success).toBe(false);
      expect(result.error).toContain('disk full');
    });
  });

  describe('diffCheckpoints', () => {
    it('should detect added files', async () => {
      const cp1 = await mgr.createCheckpoint('s1', 'ws1', 'u1', {
        files: [{ path: 'a.ts', content: 'a' }],
        messageCount: 1,
        context: {},
      });
      const cp2 = await mgr.createCheckpoint('s1', 'ws1', 'u1', {
        files: [
          { path: 'a.ts', content: 'a' },
          { path: 'b.ts', content: 'b' },
        ],
        messageCount: 2,
        context: {},
      });

      const diff = await mgr.diffCheckpoints(cp1.id, cp2.id);
      expect(diff).not.toBeNull();
      expect(diff!.added).toContain('b.ts');
      expect(diff!.unchanged).toContain('a.ts');
    });

    it('should detect modified files', async () => {
      const cp1 = await mgr.createCheckpoint('s1', 'ws1', 'u1', {
        files: [{ path: 'a.ts', content: 'version 1' }],
        messageCount: 1,
        context: {},
      });
      const cp2 = await mgr.createCheckpoint('s1', 'ws1', 'u1', {
        files: [{ path: 'a.ts', content: 'version 2' }],
        messageCount: 2,
        context: {},
      });

      const diff = await mgr.diffCheckpoints(cp1.id, cp2.id);
      expect(diff!.modified).toContain('a.ts');
    });

    it('should detect deleted files', async () => {
      const cp1 = await mgr.createCheckpoint('s1', 'ws1', 'u1', {
        files: [
          { path: 'a.ts', content: 'a' },
          { path: 'b.ts', content: 'b' },
        ],
        messageCount: 1,
        context: {},
      });
      const cp2 = await mgr.createCheckpoint('s1', 'ws1', 'u1', {
        files: [{ path: 'a.ts', content: 'a' }],
        messageCount: 2,
        context: {},
      });

      const diff = await mgr.diffCheckpoints(cp1.id, cp2.id);
      expect(diff!.deleted).toContain('b.ts');
    });

    it('should return null for unknown checkpoints', async () => {
      const diff = await mgr.diffCheckpoints('cp1', 'cp2');
      expect(diff).toBeNull();
    });
  });

  describe('deleteCheckpoint', () => {
    it('should delete a checkpoint', async () => {
      const cp = await mgr.createCheckpoint('s1', 'ws1', 'u1', {
        files: [],
        messageCount: 1,
        context: {},
      });
      expect(await mgr.deleteCheckpoint(cp.id)).toBe(true);
      expect(await mgr.getCheckpoint(cp.id)).toBeNull();
    });

    it('should return false for unknown checkpoint', async () => {
      expect(await mgr.deleteCheckpoint('nonexistent')).toBe(false);
    });
  });

  describe('autoCheckpoint', () => {
    it('should create auto checkpoint', async () => {
      const cp = await mgr.autoCheckpoint('s1', 'ws1', 'u1', 'tests passed', {
        files: [],
        messageCount: 10,
        context: {},
        status: { testsPassing: true },
      });
      expect(cp).not.toBeNull();
      expect(cp!.type).toBe('auto_milestone');
    });

    it('should create error checkpoint on error trigger', async () => {
      const cp = await mgr.autoCheckpoint('s1', 'ws1', 'u1', 'build error', {
        files: [],
        messageCount: 10,
        context: {},
      });
      expect(cp!.type).toBe('auto_error');
      expect(cp!.label).toContain('Before error');
    });

    it('should create deploy checkpoint on deploy trigger', async () => {
      const cp = await mgr.autoCheckpoint('s1', 'ws1', 'u1', 'deploy to production', {
        files: [],
        messageCount: 10,
        context: {},
      });
      expect(cp!.type).toBe('pre_deploy');
    });

    it('should return null when auto-checkpoint disabled', async () => {
      mgr.setAutoCheckpoint(false);
      const cp = await mgr.autoCheckpoint('s1', 'ws1', 'u1', 'trigger', {
        files: [],
        messageCount: 1,
        context: {},
      });
      expect(cp).toBeNull();
    });
  });

  describe('setAutoCheckpoint / isAutoCheckpointEnabled', () => {
    it('should be enabled by default', () => {
      expect(mgr.isAutoCheckpointEnabled()).toBe(true);
    });

    it('should toggle auto-checkpoint', () => {
      mgr.setAutoCheckpoint(false);
      expect(mgr.isAutoCheckpointEnabled()).toBe(false);
      mgr.setAutoCheckpoint(true);
      expect(mgr.isAutoCheckpointEnabled()).toBe(true);
    });
  });

  describe('clearSessionCheckpoints', () => {
    it('should clear all checkpoints for a session', async () => {
      await mgr.createCheckpoint('s1', 'ws1', 'u1', {
        files: [],
        messageCount: 1,
        context: {},
      });
      await mgr.createCheckpoint('s1', 'ws1', 'u1', {
        files: [],
        messageCount: 2,
        context: {},
      });

      const count = await mgr.clearSessionCheckpoints('s1');
      expect(count).toBe(2);
      expect(await mgr.listCheckpoints('s1')).toHaveLength(0);
    });
  });

  describe('clear', () => {
    it('should clear all data', async () => {
      await mgr.createCheckpoint('s1', 'ws1', 'u1', {
        files: [],
        messageCount: 1,
        context: {},
      });
      mgr.clear();
      expect(await mgr.listCheckpoints('s1')).toHaveLength(0);
    });
  });
});

// -------------------------------------------------------------------
// getCheckpointManager / resetCheckpointManager
// -------------------------------------------------------------------
describe('getCheckpointManager', () => {
  it('should return same instance', () => {
    resetCheckpointManager();
    const a = getCheckpointManager();
    const b = getCheckpointManager();
    expect(a).toBe(b);
  });
});

// -------------------------------------------------------------------
// getCheckpointTools
// -------------------------------------------------------------------
describe('getCheckpointTools', () => {
  it('should return 5 tools', () => {
    const tools = getCheckpointTools();
    expect(tools).toHaveLength(5);
    expect(tools.map((t) => t.name)).toEqual([
      'checkpoint_create',
      'checkpoint_list',
      'checkpoint_rewind',
      'checkpoint_diff',
      'checkpoint_delete',
    ]);
  });
});

// -------------------------------------------------------------------
// isCheckpointTool
// -------------------------------------------------------------------
describe('isCheckpointTool', () => {
  it('should return true for checkpoint tools', () => {
    expect(isCheckpointTool('checkpoint_create')).toBe(true);
    expect(isCheckpointTool('checkpoint_rewind')).toBe(true);
  });

  it('should return false for non-checkpoint tools', () => {
    expect(isCheckpointTool('other')).toBe(false);
  });
});
