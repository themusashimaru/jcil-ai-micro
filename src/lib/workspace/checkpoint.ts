/**
 * WORKSPACE CHECKPOINT SYSTEM
 *
 * Unified checkpoint/rewind system for full workspace state recovery.
 * Combines file snapshots with session state for complete rollback capability.
 *
 * Claude Code Parity Features:
 * - Create checkpoint at any point
 * - Rewind to previous checkpoint
 * - Auto-checkpoint on milestones
 * - List checkpoint history
 * - Checkpoint branching
 */

import crypto from 'crypto';
import { logger } from '@/lib/logger';
import { createClient as createSupabaseClient } from '@/lib/supabase/server';
import { storeBackup, getBackup } from './backup-service';

const log = logger('Checkpoint');

// ============================================================================
// TYPES
// ============================================================================

export interface WorkspaceCheckpoint {
  /** Unique checkpoint ID */
  id: string;

  /** Session this checkpoint belongs to */
  sessionId: string;

  /** Workspace ID */
  workspaceId: string;

  /** User who created the checkpoint */
  userId: string;

  /** Human-readable label */
  label: string;

  /** Checkpoint type for filtering */
  type: CheckpointType;

  /** When checkpoint was created */
  createdAt: Date;

  /** Message count at checkpoint time */
  messageCount: number;

  /** Files included in this checkpoint */
  files: CheckpointFile[];

  /** Session context at checkpoint time */
  context: CheckpointContext;

  /** Optional metadata */
  metadata?: CheckpointMetadata;
}

export type CheckpointType =
  | 'manual' // User-requested checkpoint
  | 'auto_milestone' // Auto-created on milestone (test pass, build success)
  | 'auto_error' // Auto-created before dangerous operation
  | 'pre_deploy' // Before deployment
  | 'fork_point'; // Session fork point

export interface CheckpointFile {
  /** Relative path from workspace root */
  path: string;

  /** File content at checkpoint time */
  content: string;

  /** Content hash for change detection */
  hash: string;

  /** File size in bytes */
  size: number;

  /** Backup ID if stored separately */
  backupId?: string;
}

export interface CheckpointContext {
  /** Current working directory */
  cwd: string;

  /** Active files being edited */
  activeFiles: string[];

  /** Git branch at checkpoint */
  gitBranch?: string;

  /** Git commit SHA at checkpoint */
  gitSha?: string;

  /** Environment variables (non-sensitive only) */
  envVars?: Record<string, string>;

  /** Tool permissions state */
  toolPermissions?: string[];

  /** Plan state if active */
  planState?: {
    planId: string;
    currentStep: number;
    totalSteps: number;
  };

  /** Custom context data */
  custom?: Record<string, unknown>;
}

export interface CheckpointMetadata {
  /** Trigger that caused the checkpoint */
  trigger?: string;

  /** Description of what happened */
  description?: string;

  /** Files changed since last checkpoint */
  filesChanged?: string[];

  /** Commands executed since last checkpoint */
  commandsExecuted?: string[];

  /** Build/test status at checkpoint */
  status?: {
    buildPassing?: boolean;
    testsPassing?: boolean;
    errorCount?: number;
  };
}

export interface CheckpointListItem {
  id: string;
  label: string;
  type: CheckpointType;
  createdAt: Date;
  messageCount: number;
  fileCount: number;
  description?: string;
}

export interface RewindResult {
  success: boolean;
  checkpoint?: WorkspaceCheckpoint;
  filesRestored: string[];
  error?: string;
}

export interface CheckpointDiff {
  added: string[];
  modified: string[];
  deleted: string[];
  unchanged: string[];
}

// ============================================================================
// CHECKPOINT MANAGER
// ============================================================================

export class CheckpointManager {
  private checkpoints: Map<string, WorkspaceCheckpoint> = new Map();
  private sessionCheckpoints: Map<string, string[]> = new Map();
  private autoCheckpointEnabled: boolean = true;
  private maxCheckpointsPerSession: number = 50;

  constructor() {
    log.info('CheckpointManager initialized');
  }

  /**
   * Generate unique checkpoint ID
   */
  private generateId(): string {
    return `cp_${crypto.randomUUID().slice(0, 12)}`;
  }

  /**
   * Calculate content hash for change detection
   */
  private hashContent(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
  }

  /**
   * Create a workspace checkpoint
   */
  async createCheckpoint(
    sessionId: string,
    workspaceId: string,
    userId: string,
    options: {
      label?: string;
      type?: CheckpointType;
      files: Array<{ path: string; content: string }>;
      messageCount: number;
      context: Partial<CheckpointContext>;
      metadata?: CheckpointMetadata;
      persistToDb?: boolean;
    }
  ): Promise<WorkspaceCheckpoint> {
    const id = this.generateId();

    // Process files
    const checkpointFiles: CheckpointFile[] = await Promise.all(
      options.files.map(async (file) => {
        const hash = this.hashContent(file.content);

        // Store large files as backups
        let backupId: string | undefined;
        if (file.content.length > 50000 && options.persistToDb) {
          backupId = `backup_${id}_${hash.slice(0, 8)}`;
          await storeBackup(backupId, workspaceId, file.path, file.content, {
            editDescription: `Checkpoint ${id}`,
            userId,
            persistToDb: true,
          });
        }

        return {
          path: file.path,
          content: backupId ? '' : file.content, // Don't duplicate large files
          hash,
          size: file.content.length,
          backupId,
        };
      })
    );

    const checkpoint: WorkspaceCheckpoint = {
      id,
      sessionId,
      workspaceId,
      userId,
      label: options.label || `Checkpoint ${new Date().toLocaleTimeString()}`,
      type: options.type || 'manual',
      createdAt: new Date(),
      messageCount: options.messageCount,
      files: checkpointFiles,
      context: {
        cwd: options.context.cwd || '/workspace',
        activeFiles: options.context.activeFiles || [],
        gitBranch: options.context.gitBranch,
        gitSha: options.context.gitSha,
        envVars: options.context.envVars,
        toolPermissions: options.context.toolPermissions,
        planState: options.context.planState,
        custom: options.context.custom,
      },
      metadata: options.metadata,
    };

    // Store in memory
    this.checkpoints.set(id, checkpoint);

    // Track per session
    const sessionCps = this.sessionCheckpoints.get(sessionId) || [];
    sessionCps.push(id);

    // Enforce max checkpoints
    if (sessionCps.length > this.maxCheckpointsPerSession) {
      const toRemove = sessionCps.shift();
      if (toRemove) {
        this.checkpoints.delete(toRemove);
      }
    }

    this.sessionCheckpoints.set(sessionId, sessionCps);

    // Persist to database if requested
    if (options.persistToDb) {
      await this.persistCheckpoint(checkpoint);
    }

    log.info('Checkpoint created', {
      id,
      sessionId,
      type: checkpoint.type,
      fileCount: checkpointFiles.length,
    });

    return checkpoint;
  }

  /**
   * Auto-checkpoint on milestone (test pass, build success, etc.)
   */
  async autoCheckpoint(
    sessionId: string,
    workspaceId: string,
    userId: string,
    trigger: string,
    options: {
      files: Array<{ path: string; content: string }>;
      messageCount: number;
      context: Partial<CheckpointContext>;
      status?: CheckpointMetadata['status'];
    }
  ): Promise<WorkspaceCheckpoint | null> {
    if (!this.autoCheckpointEnabled) {
      return null;
    }

    // Determine checkpoint type based on trigger
    let type: CheckpointType = 'auto_milestone';
    let label = `Auto: ${trigger}`;

    if (trigger.includes('error') || trigger.includes('fail')) {
      type = 'auto_error';
      label = `Before error: ${trigger}`;
    } else if (trigger.includes('deploy')) {
      type = 'pre_deploy';
      label = `Pre-deploy: ${trigger}`;
    }

    return this.createCheckpoint(sessionId, workspaceId, userId, {
      label,
      type,
      files: options.files,
      messageCount: options.messageCount,
      context: options.context,
      metadata: {
        trigger,
        status: options.status,
      },
      persistToDb: true,
    });
  }

  /**
   * Get a checkpoint by ID
   */
  async getCheckpoint(checkpointId: string): Promise<WorkspaceCheckpoint | null> {
    // Try memory first
    const cached = this.checkpoints.get(checkpointId);
    if (cached) {
      return cached;
    }

    // Try database
    return this.loadCheckpoint(checkpointId);
  }

  /**
   * List checkpoints for a session
   */
  async listCheckpoints(
    sessionId: string,
    options: {
      type?: CheckpointType;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<CheckpointListItem[]> {
    const { type, limit = 20, offset = 0 } = options;

    // Get from memory
    const sessionCps = this.sessionCheckpoints.get(sessionId) || [];
    let checkpoints = sessionCps
      .map((id) => this.checkpoints.get(id))
      .filter((cp): cp is WorkspaceCheckpoint => cp !== undefined);

    // Filter by type if specified
    if (type) {
      checkpoints = checkpoints.filter((cp) => cp.type === type);
    }

    // Sort by date descending
    checkpoints.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Apply pagination
    const paginated = checkpoints.slice(offset, offset + limit);

    return paginated.map((cp) => ({
      id: cp.id,
      label: cp.label,
      type: cp.type,
      createdAt: cp.createdAt,
      messageCount: cp.messageCount,
      fileCount: cp.files.length,
      description: cp.metadata?.description,
    }));
  }

  /**
   * Rewind workspace to a checkpoint
   */
  async rewindToCheckpoint(
    checkpointId: string,
    writeFile: (path: string, content: string) => Promise<void>
  ): Promise<RewindResult> {
    const checkpoint = await this.getCheckpoint(checkpointId);
    if (!checkpoint) {
      return {
        success: false,
        filesRestored: [],
        error: `Checkpoint not found: ${checkpointId}`,
      };
    }

    const filesRestored: string[] = [];
    const errors: string[] = [];

    // Restore each file
    for (const file of checkpoint.files) {
      try {
        // Get content (from backup if needed)
        let content = file.content;
        if (file.backupId && !content) {
          const backup = await getBackup(file.backupId);
          if (backup) {
            content = backup.content;
          } else {
            errors.push(`Backup not found for ${file.path}`);
            continue;
          }
        }

        await writeFile(file.path, content);
        filesRestored.push(file.path);
      } catch (error) {
        errors.push(
          `Failed to restore ${file.path}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    if (errors.length > 0) {
      log.warn('Rewind completed with errors', { checkpointId, errors });
    }

    log.info('Rewind completed', {
      checkpointId,
      filesRestored: filesRestored.length,
      errors: errors.length,
    });

    return {
      success: errors.length === 0,
      checkpoint,
      filesRestored,
      error: errors.length > 0 ? errors.join('; ') : undefined,
    };
  }

  /**
   * Compare two checkpoints
   */
  async diffCheckpoints(
    checkpointId1: string,
    checkpointId2: string
  ): Promise<CheckpointDiff | null> {
    const cp1 = await this.getCheckpoint(checkpointId1);
    const cp2 = await this.getCheckpoint(checkpointId2);

    if (!cp1 || !cp2) {
      return null;
    }

    const files1 = new Map(cp1.files.map((f) => [f.path, f.hash]));
    const files2 = new Map(cp2.files.map((f) => [f.path, f.hash]));

    const added: string[] = [];
    const modified: string[] = [];
    const deleted: string[] = [];
    const unchanged: string[] = [];

    // Check files in cp2 vs cp1
    for (const [path, hash] of files2) {
      const hash1 = files1.get(path);
      if (!hash1) {
        added.push(path);
      } else if (hash1 !== hash) {
        modified.push(path);
      } else {
        unchanged.push(path);
      }
    }

    // Check for deleted files
    for (const path of files1.keys()) {
      if (!files2.has(path)) {
        deleted.push(path);
      }
    }

    return { added, modified, deleted, unchanged };
  }

  /**
   * Delete a checkpoint
   */
  async deleteCheckpoint(checkpointId: string): Promise<boolean> {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) {
      return false;
    }

    // Remove from session tracking
    const sessionCps = this.sessionCheckpoints.get(checkpoint.sessionId) || [];
    const index = sessionCps.indexOf(checkpointId);
    if (index !== -1) {
      sessionCps.splice(index, 1);
      this.sessionCheckpoints.set(checkpoint.sessionId, sessionCps);
    }

    this.checkpoints.delete(checkpointId);

    // Delete from database
    await this.deletePersistedCheckpoint(checkpointId);

    log.info('Checkpoint deleted', { checkpointId });
    return true;
  }

  /**
   * Enable/disable auto-checkpointing
   */
  setAutoCheckpoint(enabled: boolean): void {
    this.autoCheckpointEnabled = enabled;
    log.info('Auto-checkpoint toggled', { enabled });
  }

  /**
   * Get auto-checkpoint status
   */
  isAutoCheckpointEnabled(): boolean {
    return this.autoCheckpointEnabled;
  }

  /**
   * Clear all checkpoints for a session
   */
  async clearSessionCheckpoints(sessionId: string): Promise<number> {
    const sessionCps = this.sessionCheckpoints.get(sessionId) || [];
    const count = sessionCps.length;

    for (const id of sessionCps) {
      this.checkpoints.delete(id);
      await this.deletePersistedCheckpoint(id);
    }

    this.sessionCheckpoints.delete(sessionId);
    log.info('Session checkpoints cleared', { sessionId, count });
    return count;
  }

  // ============================================================================
  // DATABASE PERSISTENCE
  // ============================================================================

  private async persistCheckpoint(checkpoint: WorkspaceCheckpoint): Promise<void> {
    try {
      const supabase = await createSupabaseClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('workspace_checkpoints') as any).insert({
        id: checkpoint.id,
        session_id: checkpoint.sessionId,
        workspace_id: checkpoint.workspaceId,
        user_id: checkpoint.userId,
        label: checkpoint.label,
        type: checkpoint.type,
        message_count: checkpoint.messageCount,
        files: checkpoint.files,
        context: checkpoint.context,
        metadata: checkpoint.metadata,
        created_at: checkpoint.createdAt.toISOString(),
      });
    } catch (error) {
      log.warn('Failed to persist checkpoint', { id: checkpoint.id, error });
    }
  }

  private async loadCheckpoint(checkpointId: string): Promise<WorkspaceCheckpoint | null> {
    try {
      const supabase = await createSupabaseClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('workspace_checkpoints') as any)
        .select('*')
        .eq('id', checkpointId)
        .single();

      if (error || !data) {
        return null;
      }

      const checkpoint: WorkspaceCheckpoint = {
        id: data.id,
        sessionId: data.session_id,
        workspaceId: data.workspace_id,
        userId: data.user_id,
        label: data.label,
        type: data.type as CheckpointType,
        createdAt: new Date(data.created_at),
        messageCount: data.message_count,
        files: data.files as CheckpointFile[],
        context: data.context as CheckpointContext,
        metadata: data.metadata as CheckpointMetadata | undefined,
      };

      // Cache it
      this.checkpoints.set(checkpointId, checkpoint);
      return checkpoint;
    } catch (error) {
      log.error('Failed to load checkpoint', { checkpointId, error });
      return null;
    }
  }

  private async deletePersistedCheckpoint(checkpointId: string): Promise<void> {
    try {
      const supabase = await createSupabaseClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('workspace_checkpoints') as any).delete().eq('id', checkpointId);
    } catch (error) {
      log.warn('Failed to delete persisted checkpoint', { checkpointId, error });
    }
  }

  /**
   * Clear in-memory cache (for testing)
   */
  clear(): void {
    this.checkpoints.clear();
    this.sessionCheckpoints.clear();
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let checkpointManagerInstance: CheckpointManager | null = null;

export function getCheckpointManager(): CheckpointManager {
  if (!checkpointManagerInstance) {
    checkpointManagerInstance = new CheckpointManager();
  }
  return checkpointManagerInstance;
}

export function resetCheckpointManager(): void {
  checkpointManagerInstance = null;
}

// ============================================================================
// TOOL DEFINITIONS (for workspace agent)
// ============================================================================

export function getCheckpointTools(): Array<{
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}> {
  return [
    {
      name: 'checkpoint_create',
      description:
        'Create a checkpoint to save the current workspace state. Use before making risky changes or at important milestones.',
      input_schema: {
        type: 'object' as const,
        properties: {
          label: {
            type: 'string',
            description: 'Human-readable label for this checkpoint',
          },
          description: {
            type: 'string',
            description: 'Optional description of what this checkpoint represents',
          },
        },
        required: [],
      },
    },
    {
      name: 'checkpoint_list',
      description: 'List all checkpoints for the current session.',
      input_schema: {
        type: 'object' as const,
        properties: {
          type: {
            type: 'string',
            enum: ['manual', 'auto_milestone', 'auto_error', 'pre_deploy', 'fork_point'],
            description: 'Filter by checkpoint type',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of checkpoints to return (default: 20)',
          },
        },
        required: [],
      },
    },
    {
      name: 'checkpoint_rewind',
      description:
        'Rewind the workspace to a previous checkpoint. This will restore all files to their state at that checkpoint.',
      input_schema: {
        type: 'object' as const,
        properties: {
          checkpoint_id: {
            type: 'string',
            description: 'ID of the checkpoint to rewind to',
          },
        },
        required: ['checkpoint_id'],
      },
    },
    {
      name: 'checkpoint_diff',
      description: 'Compare two checkpoints to see what files changed between them.',
      input_schema: {
        type: 'object' as const,
        properties: {
          checkpoint_id_1: {
            type: 'string',
            description: 'First checkpoint ID',
          },
          checkpoint_id_2: {
            type: 'string',
            description: 'Second checkpoint ID',
          },
        },
        required: ['checkpoint_id_1', 'checkpoint_id_2'],
      },
    },
    {
      name: 'checkpoint_delete',
      description: 'Delete a checkpoint.',
      input_schema: {
        type: 'object' as const,
        properties: {
          checkpoint_id: {
            type: 'string',
            description: 'ID of the checkpoint to delete',
          },
        },
        required: ['checkpoint_id'],
      },
    },
  ];
}

/**
 * Check if a tool name is a checkpoint tool
 */
export function isCheckpointTool(name: string): boolean {
  return name.startsWith('checkpoint_');
}

/**
 * Execute a checkpoint tool
 */
export async function executeCheckpointTool(
  name: string,
  input: Record<string, unknown>,
  context: {
    sessionId: string;
    workspaceId: string;
    userId: string;
    getFiles: () => Promise<Array<{ path: string; content: string }>>;
    writeFile: (path: string, content: string) => Promise<void>;
    messageCount: number;
    workspaceContext: Partial<CheckpointContext>;
  }
): Promise<string> {
  const manager = getCheckpointManager();

  switch (name) {
    case 'checkpoint_create': {
      const label = (input.label as string) || undefined;
      const description = (input.description as string) || undefined;

      const files = await context.getFiles();
      const checkpoint = await manager.createCheckpoint(
        context.sessionId,
        context.workspaceId,
        context.userId,
        {
          label,
          type: 'manual',
          files,
          messageCount: context.messageCount,
          context: context.workspaceContext,
          metadata: description ? { description } : undefined,
          persistToDb: true,
        }
      );

      return `**Checkpoint Created**

- **ID:** \`${checkpoint.id}\`
- **Label:** ${checkpoint.label}
- **Files:** ${checkpoint.files.length}
- **Created:** ${checkpoint.createdAt.toLocaleString()}

Use \`checkpoint_rewind\` with this ID to restore to this state.`;
    }

    case 'checkpoint_list': {
      const type = input.type as CheckpointType | undefined;
      const limit = (input.limit as number) || 20;

      const checkpoints = await manager.listCheckpoints(context.sessionId, { type, limit });

      if (checkpoints.length === 0) {
        return 'No checkpoints found for this session.';
      }

      const lines = ['**Checkpoints:**\n'];
      for (const cp of checkpoints) {
        const typeIcon =
          cp.type === 'manual'
            ? '📍'
            : cp.type === 'auto_milestone'
              ? '✓'
              : cp.type === 'auto_error'
                ? '⚠️'
                : cp.type === 'pre_deploy'
                  ? '🚀'
                  : '🔀';

        lines.push(`${typeIcon} **${cp.label}** (\`${cp.id}\`)`);
        lines.push(
          `   Files: ${cp.fileCount} | Messages: ${cp.messageCount} | ${cp.createdAt.toLocaleString()}`
        );
        if (cp.description) {
          lines.push(`   ${cp.description}`);
        }
        lines.push('');
      }

      return lines.join('\n');
    }

    case 'checkpoint_rewind': {
      const checkpointId = input.checkpoint_id as string;
      if (!checkpointId) {
        return 'Error: checkpoint_id is required';
      }

      const result = await manager.rewindToCheckpoint(checkpointId, context.writeFile);

      if (!result.success) {
        return `**Rewind Failed**\n\nError: ${result.error}`;
      }

      return `**Workspace Rewound**

- **Checkpoint:** \`${result.checkpoint?.id}\`
- **Label:** ${result.checkpoint?.label}
- **Files Restored:** ${result.filesRestored.length}
  - ${result.filesRestored.slice(0, 10).join('\n  - ')}${result.filesRestored.length > 10 ? `\n  - ... and ${result.filesRestored.length - 10} more` : ''}

The workspace has been restored to its state at this checkpoint.`;
    }

    case 'checkpoint_diff': {
      const id1 = input.checkpoint_id_1 as string;
      const id2 = input.checkpoint_id_2 as string;

      if (!id1 || !id2) {
        return 'Error: Both checkpoint_id_1 and checkpoint_id_2 are required';
      }

      const diff = await manager.diffCheckpoints(id1, id2);
      if (!diff) {
        return 'Error: One or both checkpoints not found';
      }

      const lines = ['**Checkpoint Diff**\n'];

      if (diff.added.length > 0) {
        lines.push(`**Added (${diff.added.length}):**`);
        diff.added.forEach((f) => lines.push(`  + ${f}`));
        lines.push('');
      }

      if (diff.modified.length > 0) {
        lines.push(`**Modified (${diff.modified.length}):**`);
        diff.modified.forEach((f) => lines.push(`  ~ ${f}`));
        lines.push('');
      }

      if (diff.deleted.length > 0) {
        lines.push(`**Deleted (${diff.deleted.length}):**`);
        diff.deleted.forEach((f) => lines.push(`  - ${f}`));
        lines.push('');
      }

      lines.push(`**Unchanged:** ${diff.unchanged.length} files`);

      return lines.join('\n');
    }

    case 'checkpoint_delete': {
      const checkpointId = input.checkpoint_id as string;
      if (!checkpointId) {
        return 'Error: checkpoint_id is required';
      }

      const success = await manager.deleteCheckpoint(checkpointId);
      return success
        ? `Checkpoint \`${checkpointId}\` deleted.`
        : `Checkpoint \`${checkpointId}\` not found.`;
    }

    default:
      return `Unknown checkpoint tool: ${name}`;
  }
}
