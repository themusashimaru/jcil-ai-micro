/**
 * SHELL SESSION MANAGER
 *
 * Manages persistent shell sessions with state tracking.
 * Features:
 * - Session creation and lifecycle management
 * - Working directory tracking
 * - Environment variable persistence
 * - Session reconnection and state restoration
 * - Command history per session
 *
 * This provides REAL persistence, not just command logging.
 */

import { createClient } from '@supabase/supabase-js';
import { ContainerManager, ExecutionResult } from '@/lib/workspace/container';
import { logger } from '@/lib/logger';

const log = logger('ShellSessionManager');

// ============================================================================
// TYPES
// ============================================================================

export interface ShellSession {
  id: string;
  workspaceId: string;
  userId: string;
  name: string;
  status: 'active' | 'idle' | 'terminated';
  cwd: string;
  env: Record<string, string>;
  lastActivity: Date;
  createdAt: Date;
}

export interface SessionState {
  cwd: string;
  env: Record<string, string>;
  lastCommand?: string;
  lastOutput?: string;
  lastExitCode?: number;
}

export interface ExecuteOptions {
  timeout?: number;
  stream?: {
    onStdout?: (data: string) => void;
    onStderr?: (data: string) => void;
  };
}

// ============================================================================
// SHELL SESSION MANAGER
// ============================================================================

export class ShellSessionManager {
  private supabase;
  private container: ContainerManager;
  private sessionStates = new Map<string, SessionState>();

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    this.container = new ContainerManager();
  }

  /**
   * Create a new shell session
   */
  async createSession(workspaceId: string, userId: string, name?: string): Promise<ShellSession> {
    const sessionId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Default session state
    const initialState: SessionState = {
      cwd: '/workspace',
      env: {},
    };

    const { data, error } = await this.supabase
      .from('shell_sessions')
      .insert({
        id: sessionId,
        workspace_id: workspaceId,
        user_id: userId,
        name: name || `Shell ${new Date().toLocaleString()}`,
        status: 'active',
        cwd: initialState.cwd,
        env_vars: initialState.env,
        last_activity: now,
        created_at: now,
      })
      .select()
      .single();

    if (error) {
      log.error('Failed to create session', error);
      throw new Error(`Failed to create session: ${error.message}`);
    }

    // Store in memory for quick access
    this.sessionStates.set(sessionId, initialState);

    log.info('Session created', { sessionId, workspaceId });

    return this.mapDbSession(data);
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<ShellSession | null> {
    const { data, error } = await this.supabase
      .from('shell_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapDbSession(data);
  }

  /**
   * Get all sessions for a workspace
   */
  async getWorkspaceSessions(workspaceId: string): Promise<ShellSession[]> {
    const { data, error } = await this.supabase
      .from('shell_sessions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .neq('status', 'terminated')
      .order('last_activity', { ascending: false });

    if (error) {
      log.error('Failed to get sessions', error);
      return [];
    }

    return data.map(this.mapDbSession);
  }

  /**
   * Get or create default session for workspace
   */
  async getOrCreateDefaultSession(workspaceId: string, userId: string): Promise<ShellSession> {
    // Try to find an existing active session
    const { data: existing } = await this.supabase
      .from('shell_sessions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('last_activity', { ascending: false })
      .limit(1)
      .single();

    if (existing) {
      return this.mapDbSession(existing);
    }

    // Create a new session
    return this.createSession(workspaceId, userId, 'Default Shell');
  }

  /**
   * Execute a command in a session
   */
  async executeCommand(
    sessionId: string,
    command: string,
    options: ExecuteOptions = {}
  ): Promise<ExecutionResult> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Get current session state
    let state = this.sessionStates.get(sessionId);
    if (!state) {
      state = { cwd: session.cwd, env: session.env };
      this.sessionStates.set(sessionId, state);
    }

    log.debug('Executing command in session', {
      sessionId,
      command: command.substring(0, 50),
      cwd: state.cwd,
    });

    // Build environment string for commands that need it
    const envString = Object.entries(state.env)
      .map(([k, v]) => `export ${k}="${v}"`)
      .join(' && ');

    // Wrap command with cd to maintain cwd, and capture new cwd
    const wrappedCommand = `
      cd "${state.cwd}" 2>/dev/null || cd /workspace;
      ${envString ? envString + ' && ' : ''}
      ${command};
      EXIT_CODE=$?;
      echo "";
      echo "__CWD__=$(pwd)";
      exit $EXIT_CODE
    `.trim();

    // Execute command
    const result = await this.container.executeCommand(session.workspaceId, wrappedCommand, {
      timeout: options.timeout || 30000,
      stream: options.stream,
    });

    // Parse output to extract new cwd
    const cwdMatch = result.stdout.match(/__CWD__=(.+)$/m);
    if (cwdMatch) {
      const newCwd = cwdMatch[1].trim();
      if (newCwd && newCwd !== state.cwd) {
        state.cwd = newCwd;
        log.debug('Working directory changed', { sessionId, newCwd });
      }
      // Remove the cwd marker from output
      result.stdout = result.stdout.replace(/\n__CWD__=.+$/, '');
    }

    // Update state
    state.lastCommand = command;
    state.lastOutput = result.stdout.substring(0, 10000); // Limit stored output
    state.lastExitCode = result.exitCode;

    // Persist state to database
    await this.updateSessionState(sessionId, state);

    // Log command
    await this.logCommand(sessionId, session.workspaceId, command, result);

    return result;
  }

  /**
   * Update environment variables
   */
  async setEnvVar(sessionId: string, key: string, value: string): Promise<void> {
    let state = this.sessionStates.get(sessionId);
    if (!state) {
      const session = await this.getSession(sessionId);
      if (!session) throw new Error('Session not found');
      state = { cwd: session.cwd, env: session.env };
      this.sessionStates.set(sessionId, state);
    }

    state.env[key] = value;
    await this.updateSessionState(sessionId, state);
  }

  /**
   * Get session state (for restoration)
   */
  async getSessionState(sessionId: string): Promise<SessionState | null> {
    // Check memory first
    const memState = this.sessionStates.get(sessionId);
    if (memState) {
      return memState;
    }

    // Load from database
    const session = await this.getSession(sessionId);
    if (!session) {
      return null;
    }

    const state: SessionState = {
      cwd: session.cwd,
      env: session.env,
    };

    // Get last command for context
    const { data: lastCmd } = await this.supabase
      .from('shell_commands')
      .select('command, output, exit_code')
      .eq('session_id', sessionId)
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    if (lastCmd) {
      state.lastCommand = lastCmd.command;
      state.lastOutput = lastCmd.output?.substring(0, 1000);
      state.lastExitCode = lastCmd.exit_code;
    }

    // Cache in memory
    this.sessionStates.set(sessionId, state);

    return state;
  }

  /**
   * Get command history for a session
   */
  async getCommandHistory(
    sessionId: string,
    limit: number = 50
  ): Promise<
    Array<{
      command: string;
      output: string;
      exitCode: number;
      timestamp: Date;
    }>
  > {
    const { data, error } = await this.supabase
      .from('shell_commands')
      .select('command, output, exit_code, started_at')
      .eq('session_id', sessionId)
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error) {
      log.error('Failed to get command history', error);
      return [];
    }

    return data.map((row) => ({
      command: row.command,
      output: row.output || '',
      exitCode: row.exit_code,
      timestamp: new Date(row.started_at),
    }));
  }

  /**
   * Mark session as idle
   */
  async markIdle(sessionId: string): Promise<void> {
    await this.supabase.from('shell_sessions').update({ status: 'idle' }).eq('id', sessionId);
  }

  /**
   * Mark session as active
   */
  async markActive(sessionId: string): Promise<void> {
    await this.supabase
      .from('shell_sessions')
      .update({
        status: 'active',
        last_activity: new Date().toISOString(),
      })
      .eq('id', sessionId);
  }

  /**
   * Terminate a session
   */
  async terminateSession(sessionId: string): Promise<void> {
    await this.supabase.from('shell_sessions').update({ status: 'terminated' }).eq('id', sessionId);

    this.sessionStates.delete(sessionId);
    log.info('Session terminated', { sessionId });
  }

  /**
   * Clean up old sessions
   */
  async cleanupOldSessions(olderThanHours: number = 24): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);

    const { data, error } = await this.supabase
      .from('shell_sessions')
      .update({ status: 'terminated' })
      .lt('last_activity', cutoff.toISOString())
      .neq('status', 'terminated')
      .select('id');

    if (error) {
      log.error('Failed to cleanup sessions', error);
      return 0;
    }

    // Clear from memory
    for (const row of data || []) {
      this.sessionStates.delete(row.id);
    }

    log.info('Cleaned up old sessions', { count: data?.length || 0 });
    return data?.length || 0;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private async updateSessionState(sessionId: string, state: SessionState): Promise<void> {
    await this.supabase
      .from('shell_sessions')
      .update({
        cwd: state.cwd,
        env_vars: state.env,
        last_activity: new Date().toISOString(),
      })
      .eq('id', sessionId);
  }

  private async logCommand(
    sessionId: string,
    workspaceId: string,
    command: string,
    result: ExecutionResult
  ): Promise<void> {
    await this.supabase.from('shell_commands').insert({
      session_id: sessionId,
      workspace_id: workspaceId,
      command,
      output: result.stdout + (result.stderr ? `\n[stderr]\n${result.stderr}` : ''),
      exit_code: result.exitCode,
      duration_ms: result.executionTime,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });
  }

  private mapDbSession(row: Record<string, unknown>): ShellSession {
    return {
      id: row.id as string,
      workspaceId: row.workspace_id as string,
      userId: row.user_id as string,
      name: row.name as string,
      status: row.status as ShellSession['status'],
      cwd: (row.cwd as string) || '/workspace',
      env: (row.env_vars as Record<string, string>) || {},
      lastActivity: new Date(row.last_activity as string),
      createdAt: new Date(row.created_at as string),
    };
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let sessionManagerInstance: ShellSessionManager | null = null;

export function getShellSessionManager(): ShellSessionManager {
  if (!sessionManagerInstance) {
    sessionManagerInstance = new ShellSessionManager();
  }
  return sessionManagerInstance;
}
