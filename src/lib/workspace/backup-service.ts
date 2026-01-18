/**
 * FILE BACKUP SERVICE
 *
 * Stores and retrieves file backups for surgical edit rollback.
 * Uses in-memory cache with optional Supabase persistence.
 */

import { logger } from '@/lib/logger';
import { createClient as createSupabaseClient } from '@/lib/supabase/server';

const log = logger('BackupService');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

// ============================================================================
// TYPES
// ============================================================================

export interface FileBackup {
  id: string;
  workspaceId: string;
  filePath: string;
  content: string;
  createdAt: Date;
  editDescription?: string;
  userId?: string;
}

export interface BackupListItem {
  id: string;
  filePath: string;
  createdAt: Date;
  editDescription?: string;
  contentPreview: string; // First 100 chars
}

// ============================================================================
// IN-MEMORY CACHE
// ============================================================================

// In-memory backup cache (for fast access within session)
// Key: backupId, Value: FileBackup
const backupCache = new Map<string, FileBackup>();

// Cleanup old backups periodically (keep last 2 hours)
const BACKUP_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
let cleanupInterval: NodeJS.Timeout | null = null;

function startCleanup() {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(
    () => {
      const cutoff = new Date(Date.now() - BACKUP_TTL_MS);
      for (const [id, backup] of backupCache.entries()) {
        if (backup.createdAt < cutoff) {
          backupCache.delete(id);
          log.debug('Expired backup removed from cache', { id });
        }
      }
    },
    5 * 60 * 1000
  ); // Check every 5 minutes
}

// ============================================================================
// BACKUP OPERATIONS
// ============================================================================

/**
 * Store a file backup
 */
export async function storeBackup(
  backupId: string,
  workspaceId: string,
  filePath: string,
  content: string,
  options: {
    editDescription?: string;
    userId?: string;
    persistToDb?: boolean;
  } = {}
): Promise<FileBackup> {
  startCleanup();

  const backup: FileBackup = {
    id: backupId,
    workspaceId,
    filePath,
    content,
    createdAt: new Date(),
    editDescription: options.editDescription,
    userId: options.userId,
  };

  // Store in memory cache
  backupCache.set(backupId, backup);

  // Optionally persist to database
  if (options.persistToDb) {
    try {
      const supabase = await createSupabaseClient();
      await (supabase.from('file_backups') as AnySupabase).insert({
        id: backupId,
        workspace_id: workspaceId,
        file_path: filePath,
        content,
        edit_description: options.editDescription,
        user_id: options.userId,
        created_at: backup.createdAt.toISOString(),
      });
      log.info('Backup persisted to database', { backupId, filePath });
    } catch (error) {
      log.warn('Failed to persist backup to database', { backupId, error });
      // Continue - in-memory backup still works
    }
  }

  log.info('Backup stored', { backupId, filePath, contentLength: content.length });
  return backup;
}

/**
 * Retrieve a file backup
 */
export async function getBackup(backupId: string): Promise<FileBackup | null> {
  // Try memory cache first
  const cached = backupCache.get(backupId);
  if (cached) {
    log.debug('Backup retrieved from cache', { backupId });
    return cached;
  }

  // Try database
  try {
    const supabase = await createSupabaseClient();
    const { data, error } = await (supabase.from('file_backups') as AnySupabase)
      .select('*')
      .eq('id', backupId)
      .single();

    if (error || !data) {
      log.debug('Backup not found', { backupId });
      return null;
    }

    // Convert to FileBackup and cache it
    const backup: FileBackup = {
      id: data.id,
      workspaceId: data.workspace_id,
      filePath: data.file_path,
      content: data.content,
      createdAt: new Date(data.created_at),
      editDescription: data.edit_description,
      userId: data.user_id,
    };

    backupCache.set(backupId, backup);
    log.debug('Backup retrieved from database', { backupId });
    return backup;
  } catch (error) {
    log.error('Error retrieving backup', { backupId, error });
    return null;
  }
}

/**
 * List backups for a workspace/file
 */
export async function listBackups(
  workspaceId: string,
  filePath?: string,
  limit: number = 20
): Promise<BackupListItem[]> {
  const results: BackupListItem[] = [];

  // First, get from memory cache
  for (const backup of backupCache.values()) {
    if (backup.workspaceId === workspaceId) {
      if (!filePath || backup.filePath === filePath) {
        results.push({
          id: backup.id,
          filePath: backup.filePath,
          createdAt: backup.createdAt,
          editDescription: backup.editDescription,
          contentPreview: backup.content.slice(0, 100) + (backup.content.length > 100 ? '...' : ''),
        });
      }
    }
  }

  // Then try database
  try {
    const supabase = await createSupabaseClient();
    let query = (supabase.from('file_backups') as AnySupabase)
      .select('id, file_path, created_at, edit_description, content')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (filePath) {
      query = query.eq('file_path', filePath);
    }

    const { data, error } = await query;

    if (!error && data) {
      for (const row of data as AnySupabase[]) {
        // Skip if already in results from cache
        if (!results.some((r) => r.id === row.id)) {
          results.push({
            id: row.id,
            filePath: row.file_path,
            createdAt: new Date(row.created_at),
            editDescription: row.edit_description,
            contentPreview: row.content.slice(0, 100) + (row.content.length > 100 ? '...' : ''),
          });
        }
      }
    }
  } catch (error) {
    log.warn('Failed to list backups from database', { workspaceId, error });
  }

  // Sort by date descending and limit
  return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
}

/**
 * Delete a backup
 */
export async function deleteBackup(backupId: string): Promise<boolean> {
  // Remove from cache
  const deleted = backupCache.delete(backupId);

  // Remove from database
  try {
    const supabase = await createSupabaseClient();
    await (supabase.from('file_backups') as AnySupabase).delete().eq('id', backupId);
    log.info('Backup deleted', { backupId });
    return true;
  } catch (error) {
    log.warn('Failed to delete backup from database', { backupId, error });
    return deleted;
  }
}

/**
 * Clear old backups for a workspace
 */
export async function clearOldBackups(workspaceId: string, olderThan: Date): Promise<number> {
  let deleted = 0;

  // Clear from cache
  for (const [id, backup] of backupCache.entries()) {
    if (backup.workspaceId === workspaceId && backup.createdAt < olderThan) {
      backupCache.delete(id);
      deleted++;
    }
  }

  // Clear from database
  try {
    const supabase = await createSupabaseClient();
    const { count } = await (supabase.from('file_backups') as AnySupabase)
      .delete({ count: 'exact' })
      .eq('workspace_id', workspaceId)
      .lt('created_at', olderThan.toISOString());

    if (count) {
      deleted += count;
    }
  } catch (error) {
    log.warn('Failed to clear old backups from database', { workspaceId, error });
  }

  log.info('Old backups cleared', { workspaceId, deleted });
  return deleted;
}

// ============================================================================
// RESTORE OPERATIONS
// ============================================================================

/**
 * Restore a file from backup
 * Returns the restore operation details
 */
export async function restoreFromBackup(
  backupId: string,
  writeFile: (workspaceId: string, filePath: string, content: string) => Promise<void>
): Promise<{
  success: boolean;
  backup?: FileBackup;
  error?: string;
}> {
  // Get the backup
  const backup = await getBackup(backupId);
  if (!backup) {
    return {
      success: false,
      error: `Backup not found: ${backupId}`,
    };
  }

  try {
    // Write the backup content to the file
    await writeFile(backup.workspaceId, backup.filePath, backup.content);

    log.info('File restored from backup', {
      backupId,
      filePath: backup.filePath,
      workspaceId: backup.workspaceId,
    });

    return {
      success: true,
      backup,
    };
  } catch (error) {
    log.error('Failed to restore from backup', { backupId, error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to restore file',
    };
  }
}

// ============================================================================
// EXPORTS FOR TESTING
// ============================================================================

export const _internal = {
  backupCache,
  stopCleanup: () => {
    if (cleanupInterval) {
      clearInterval(cleanupInterval);
      cleanupInterval = null;
    }
  },
  clearCache: () => {
    backupCache.clear();
  },
};
