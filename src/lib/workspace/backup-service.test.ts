import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  storeBackup,
  getBackup,
  listBackups,
  deleteBackup,
  clearOldBackups,
  restoreFromBackup,
  _internal,
} from './backup-service';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock supabase
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: () => ({
      insert: () => Promise.resolve({}),
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: { message: 'not found' } }),
        }),
      }),
      delete: () => ({
        eq: () => Promise.resolve({}),
      }),
      order: () => ({
        limit: () => Promise.resolve({ data: [], error: null }),
      }),
    }),
  }),
}));

beforeEach(() => {
  _internal.clearCache();
});

// -------------------------------------------------------------------
// storeBackup
// -------------------------------------------------------------------
describe('storeBackup', () => {
  it('should store a backup in memory cache', async () => {
    const backup = await storeBackup('b1', 'ws1', 'file.ts', 'content here');
    expect(backup.id).toBe('b1');
    expect(backup.workspaceId).toBe('ws1');
    expect(backup.filePath).toBe('file.ts');
    expect(backup.content).toBe('content here');
    expect(backup.createdAt).toBeInstanceOf(Date);
  });

  it('should store with optional fields', async () => {
    const backup = await storeBackup('b2', 'ws1', 'file.ts', 'content', {
      editDescription: 'Fixed bug',
      userId: 'u1',
    });
    expect(backup.editDescription).toBe('Fixed bug');
    expect(backup.userId).toBe('u1');
  });

  it('should be retrievable from cache after storing', async () => {
    await storeBackup('b3', 'ws1', 'file.ts', 'cached content');
    const retrieved = await getBackup('b3');
    expect(retrieved).not.toBeNull();
    expect(retrieved!.content).toBe('cached content');
  });
});

// -------------------------------------------------------------------
// getBackup
// -------------------------------------------------------------------
describe('getBackup', () => {
  it('should return null for non-existent backup', async () => {
    const result = await getBackup('nonexistent');
    expect(result).toBeNull();
  });

  it('should return cached backup', async () => {
    await storeBackup('b4', 'ws1', 'a.ts', 'data');
    const result = await getBackup('b4');
    expect(result!.filePath).toBe('a.ts');
  });
});

// -------------------------------------------------------------------
// listBackups
// -------------------------------------------------------------------
describe('listBackups', () => {
  it('should list backups for a workspace', async () => {
    await storeBackup('lb1', 'ws2', 'a.ts', 'a');
    await storeBackup('lb2', 'ws2', 'b.ts', 'b');
    await storeBackup('lb3', 'ws-other', 'c.ts', 'c');

    const results = await listBackups('ws2');
    expect(results).toHaveLength(2);
  });

  it('should filter by file path', async () => {
    await storeBackup('lbf1', 'ws3', 'target.ts', 'content');
    await storeBackup('lbf2', 'ws3', 'other.ts', 'content');

    const results = await listBackups('ws3', 'target.ts');
    expect(results).toHaveLength(1);
    expect(results[0].filePath).toBe('target.ts');
  });

  it('should include content preview', async () => {
    await storeBackup('lbp1', 'ws4', 'file.ts', 'short');
    const results = await listBackups('ws4');
    expect(results[0].contentPreview).toBe('short');
  });

  it('should truncate long content preview', async () => {
    const longContent = 'x'.repeat(200);
    await storeBackup('lbp2', 'ws5', 'file.ts', longContent);
    const results = await listBackups('ws5');
    expect(results[0].contentPreview).toHaveLength(103); // 100 + '...'
  });

  it('should return empty for unknown workspace', async () => {
    const results = await listBackups('unknown-ws');
    expect(results).toHaveLength(0);
  });
});

// -------------------------------------------------------------------
// deleteBackup
// -------------------------------------------------------------------
describe('deleteBackup', () => {
  it('should delete from cache', async () => {
    await storeBackup('del1', 'ws1', 'file.ts', 'data');
    const result = await deleteBackup('del1');
    expect(result).toBe(true);
    const retrieved = await getBackup('del1');
    expect(retrieved).toBeNull();
  });
});

// -------------------------------------------------------------------
// clearOldBackups
// -------------------------------------------------------------------
describe('clearOldBackups', () => {
  it('should clear old backups from cache', async () => {
    // Store a backup and manually set its date to be old
    await storeBackup('old1', 'wsc1', 'file.ts', 'old data');
    const cached = _internal.backupCache.get('old1');
    if (cached) {
      cached.createdAt = new Date(Date.now() - 10 * 60 * 60 * 1000); // 10 hours ago
    }

    await storeBackup('new1', 'wsc1', 'file2.ts', 'new data');

    const deleted = await clearOldBackups('wsc1', new Date(Date.now() - 60 * 60 * 1000)); // 1 hour ago
    expect(deleted).toBeGreaterThanOrEqual(1);

    // Old should be gone, new should remain
    expect(await getBackup('old1')).toBeNull();
    expect(await getBackup('new1')).not.toBeNull();
  });
});

// -------------------------------------------------------------------
// restoreFromBackup
// -------------------------------------------------------------------
describe('restoreFromBackup', () => {
  it('should restore file from backup', async () => {
    await storeBackup('rest1', 'ws1', 'restore.ts', 'original content');
    const writeFile = vi.fn();

    const result = await restoreFromBackup('rest1', writeFile);
    expect(result.success).toBe(true);
    expect(result.backup!.content).toBe('original content');
    expect(writeFile).toHaveBeenCalledWith('ws1', 'restore.ts', 'original content');
  });

  it('should return error for non-existent backup', async () => {
    const writeFile = vi.fn();
    const result = await restoreFromBackup('nonexistent', writeFile);
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('should handle write error', async () => {
    await storeBackup('rest2', 'ws1', 'file.ts', 'data');
    const writeFile = vi.fn().mockRejectedValue(new Error('write failed'));

    const result = await restoreFromBackup('rest2', writeFile);
    expect(result.success).toBe(false);
    expect(result.error).toContain('write failed');
  });
});

// -------------------------------------------------------------------
// _internal
// -------------------------------------------------------------------
describe('_internal', () => {
  it('should expose cache for testing', () => {
    expect(_internal.backupCache).toBeInstanceOf(Map);
  });

  it('should clear cache', async () => {
    await storeBackup('int1', 'ws1', 'f.ts', 'data');
    _internal.clearCache();
    expect(_internal.backupCache.size).toBe(0);
  });

  it('should stop cleanup interval', () => {
    // Just ensure it doesn't throw
    _internal.stopCleanup();
  });
});
