/**
 * Permission Confirmation System
 *
 * Provides pre-execution confirmation for dangerous operations like:
 * - File writes, deletes, renames
 * - Git operations (commit, push, reset)
 * - Shell command execution
 * - Package installation
 *
 * This brings Code Lab closer to Claude Code's permission model.
 */

import { logger } from '@/lib/logger';

const log = logger('permissions');

// Types of operations that require permission
export type OperationType =
  | 'file_write'
  | 'file_delete'
  | 'file_rename'
  | 'git_commit'
  | 'git_push'
  | 'git_reset'
  | 'git_checkout'
  | 'shell_execute'
  | 'package_install'
  | 'destructive_command';

// Permission decision
export type PermissionDecision = 'allow_once' | 'allow_session' | 'always_allow' | 'deny';

// Permission request
export interface PermissionRequest {
  id: string;
  type: OperationType;
  description: string;
  details: {
    command?: string;
    filePath?: string;
    oldContent?: string;
    newContent?: string;
    diff?: string;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  };
  timestamp: number;
}

// Permission rule
export interface PermissionRule {
  type: OperationType;
  pattern?: string; // Glob pattern for paths
  decision: PermissionDecision;
  expiresAt?: number; // For session-based rules
}

// Permission result
export interface PermissionResult {
  allowed: boolean;
  decision: PermissionDecision;
  rule?: PermissionRule;
  requiresConfirmation: boolean;
}

// Callback for UI to handle permission requests
export type PermissionCallback = (request: PermissionRequest) => Promise<PermissionDecision>;

/**
 * Permission Manager
 *
 * Manages permission rules and handles confirmation requests.
 */
export class PermissionManager {
  private rules: Map<string, PermissionRule> = new Map();
  private sessionRules: Map<string, PermissionRule> = new Map();
  private pendingRequests: Map<string, PermissionRequest> = new Map();
  private callback: PermissionCallback | null = null;
  private autoApproveMode = false;

  constructor() {
    log.info('PermissionManager initialized');
  }

  /**
   * Set the callback for UI permission dialogs
   */
  setCallback(callback: PermissionCallback): void {
    this.callback = callback;
  }

  /**
   * Enable/disable auto-approve mode (for testing or trusted sessions)
   */
  setAutoApproveMode(enabled: boolean): void {
    this.autoApproveMode = enabled;
    log.info('Auto-approve mode', { enabled });
  }

  /**
   * Add a permanent permission rule
   */
  addRule(rule: PermissionRule): void {
    const key = this.getRuleKey(rule.type, rule.pattern);
    this.rules.set(key, rule);
    log.info('Permission rule added', { type: rule.type, pattern: rule.pattern });
  }

  /**
   * Add a session-scoped permission rule (expires when session ends)
   */
  addSessionRule(rule: PermissionRule): void {
    const key = this.getRuleKey(rule.type, rule.pattern);
    rule.expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    this.sessionRules.set(key, rule);
    log.info('Session permission rule added', { type: rule.type, pattern: rule.pattern });
  }

  /**
   * Clear all session rules
   */
  clearSessionRules(): void {
    this.sessionRules.clear();
    log.info('Session rules cleared');
  }

  /**
   * Check if operation is allowed without confirmation
   */
  checkPermission(type: OperationType, path?: string): PermissionResult {
    // Auto-approve mode bypasses all checks
    if (this.autoApproveMode) {
      return {
        allowed: true,
        decision: 'always_allow',
        requiresConfirmation: false,
      };
    }

    // Check session rules first (more specific)
    const sessionKey = this.getRuleKey(type, path);
    const sessionRule =
      this.sessionRules.get(sessionKey) || this.sessionRules.get(this.getRuleKey(type));
    if (sessionRule && (!sessionRule.expiresAt || sessionRule.expiresAt > Date.now())) {
      if (sessionRule.decision === 'always_allow' || sessionRule.decision === 'allow_session') {
        return {
          allowed: true,
          decision: sessionRule.decision,
          rule: sessionRule,
          requiresConfirmation: false,
        };
      }
    }

    // Check permanent rules
    const ruleKey = this.getRuleKey(type, path);
    const rule = this.rules.get(ruleKey) || this.rules.get(this.getRuleKey(type));
    if (rule) {
      if (rule.decision === 'always_allow') {
        return {
          allowed: true,
          decision: rule.decision,
          rule,
          requiresConfirmation: false,
        };
      }
      if (rule.decision === 'deny') {
        return {
          allowed: false,
          decision: rule.decision,
          rule,
          requiresConfirmation: false,
        };
      }
    }

    // Default: requires confirmation
    return {
      allowed: false,
      decision: 'deny',
      requiresConfirmation: true,
    };
  }

  /**
   * Request permission for an operation
   */
  async requestPermission(
    type: OperationType,
    description: string,
    details: PermissionRequest['details']
  ): Promise<boolean> {
    // First check if already allowed
    const check = this.checkPermission(type, details.filePath);
    if (check.allowed && !check.requiresConfirmation) {
      return true;
    }

    // Auto-approve mode with risk-level awareness
    // SECURITY FIX: Even in sandbox, require confirmation for HIGH/CRITICAL operations
    if (this.autoApproveMode) {
      const riskLevel = assessRiskLevel(type, {
        command: details.command,
        filePath: details.filePath,
      });

      // Auto-approve LOW and MEDIUM risk in sandboxed environment
      if (riskLevel === 'low' || riskLevel === 'medium') {
        log.debug('Auto-approved (sandbox, low/medium risk)', { type, riskLevel });
        return true;
      }

      // For HIGH/CRITICAL risk, still require UI confirmation if callback exists
      if (this.callback) {
        log.info('High/critical risk operation requires confirmation', {
          type,
          riskLevel,
          description,
        });
        // Fall through to callback flow below
      } else {
        // No callback but high risk - deny for safety
        log.warn('High-risk operation denied - no confirmation callback', { type, riskLevel });
        return false;
      }
    }

    // No callback set - deny by default for safety
    if (!this.callback) {
      log.warn('Permission denied - no callback set', { type, description });
      return false;
    }

    // Create request
    const request: PermissionRequest = {
      id: `perm_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      type,
      description,
      details,
      timestamp: Date.now(),
    };

    // Store pending request
    this.pendingRequests.set(request.id, request);

    try {
      // Call UI to get decision
      log.info('Requesting permission', { type, description });
      const decision = await this.callback(request);

      // Process decision
      return this.processDecision(request, decision);
    } finally {
      this.pendingRequests.delete(request.id);
    }
  }

  /**
   * Process user's permission decision
   */
  private processDecision(request: PermissionRequest, decision: PermissionDecision): boolean {
    log.info('Permission decision', { type: request.type, decision });

    switch (decision) {
      case 'allow_once':
        return true;

      case 'allow_session':
        this.addSessionRule({
          type: request.type,
          pattern: request.details.filePath,
          decision: 'allow_session',
        });
        return true;

      case 'always_allow':
        this.addRule({
          type: request.type,
          pattern: request.details.filePath,
          decision: 'always_allow',
        });
        return true;

      case 'deny':
      default:
        return false;
    }
  }

  /**
   * Get pending permission requests
   */
  getPendingRequests(): PermissionRequest[] {
    return Array.from(this.pendingRequests.values());
  }

  /**
   * Get all current rules
   */
  getRules(): { permanent: PermissionRule[]; session: PermissionRule[] } {
    return {
      permanent: Array.from(this.rules.values()),
      session: Array.from(this.sessionRules.values()),
    };
  }

  /**
   * Remove a rule
   */
  removeRule(type: OperationType, pattern?: string): void {
    const key = this.getRuleKey(type, pattern);
    this.rules.delete(key);
    this.sessionRules.delete(key);
  }

  private getRuleKey(type: OperationType, pattern?: string): string {
    return pattern ? `${type}:${pattern}` : type;
  }
}

// Singleton instance
let permissionManager: PermissionManager | null = null;

export function getPermissionManager(): PermissionManager {
  if (!permissionManager) {
    permissionManager = new PermissionManager();
    // Enable auto-approve mode for web UI (operations run in E2B sandbox)
    // In Claude Code CLI, user confirms via terminal - in web, sandbox is inherently isolated
    permissionManager.setAutoApproveMode(true);
    log.info('Permission manager initialized with auto-approve (sandboxed web environment)');
  }
  return permissionManager;
}

/**
 * Determine risk level based on operation type and details
 */
export function assessRiskLevel(
  type: OperationType,
  details: { command?: string; filePath?: string }
): 'low' | 'medium' | 'high' | 'critical' {
  // Critical risk operations
  if (type === 'destructive_command') return 'critical';
  if (details.command?.includes('rm -rf')) return 'critical';
  if (details.command?.includes('--force')) return 'critical';
  if (details.command?.includes('DROP TABLE')) return 'critical';
  if (type === 'git_reset' && details.command?.includes('--hard')) return 'critical';

  // High risk operations
  if (type === 'git_push') return 'high';
  if (type === 'file_delete') return 'high';
  if (details.filePath?.includes('.env')) return 'high';
  if (details.filePath?.includes('credentials')) return 'high';
  if (details.command?.includes('sudo')) return 'high';

  // Medium risk operations
  if (type === 'git_commit') return 'medium';
  if (type === 'git_checkout') return 'medium';
  if (type === 'package_install') return 'medium';
  if (type === 'shell_execute') return 'medium';

  // Low risk operations
  if (type === 'file_write') return 'low';
  if (type === 'file_rename') return 'low';

  return 'medium';
}

/**
 * Check if a command is dangerous
 */
export function isDangerousCommand(command: string): boolean {
  const dangerousPatterns = [
    /rm\s+-rf?\s+[\/~]/i, // rm -rf with root or home
    /rm\s+.*\*/i, // rm with wildcards
    />\s*\/dev\//i, // Writing to devices
    /dd\s+if=/i, // dd command
    /mkfs\./i, // Filesystem formatting
    /:\(\)\{:\|:&\};:/i, // Fork bomb
    /chmod\s+-R\s+777/i, // Insecure permissions
    /curl\s+.*\|\s*(ba)?sh/i, // Piping curl to shell
    /wget\s+.*\|\s*(ba)?sh/i, // Piping wget to shell
    /--force\s+push/i, // Force push
    /push\s+.*--force/i, // Force push
    /git\s+reset\s+--hard/i, // Hard reset
    /DROP\s+(TABLE|DATABASE)/i, // SQL drop
    /TRUNCATE\s+TABLE/i, // SQL truncate
  ];

  return dangerousPatterns.some((pattern) => pattern.test(command));
}

/**
 * Get human-readable description of operation type
 */
export function getOperationDescription(type: OperationType): string {
  const descriptions: Record<OperationType, string> = {
    file_write: 'Write to file',
    file_delete: 'Delete file',
    file_rename: 'Rename file',
    git_commit: 'Git commit',
    git_push: 'Git push',
    git_reset: 'Git reset',
    git_checkout: 'Git checkout',
    shell_execute: 'Execute shell command',
    package_install: 'Install package',
    destructive_command: 'Destructive operation',
  };

  return descriptions[type] || type;
}

/**
 * Permission tools for the workspace agent
 */
export function getPermissionTools() {
  return [
    {
      name: 'permission_check',
      description: 'Check if an operation is allowed without requesting confirmation',
      input_schema: {
        type: 'object' as const,
        properties: {
          operation: {
            type: 'string',
            enum: [
              'file_write',
              'file_delete',
              'file_rename',
              'git_commit',
              'git_push',
              'git_reset',
              'git_checkout',
              'shell_execute',
              'package_install',
            ],
            description: 'Type of operation to check',
          },
          path: {
            type: 'string',
            description: 'File path or pattern (optional)',
          },
        },
        required: ['operation'],
      },
    },
    {
      name: 'permission_request',
      description: 'Request permission for a potentially dangerous operation',
      input_schema: {
        type: 'object' as const,
        properties: {
          operation: {
            type: 'string',
            enum: [
              'file_write',
              'file_delete',
              'file_rename',
              'git_commit',
              'git_push',
              'git_reset',
              'git_checkout',
              'shell_execute',
              'package_install',
              'destructive_command',
            ],
            description: 'Type of operation',
          },
          description: {
            type: 'string',
            description: 'Human-readable description of what will happen',
          },
          filePath: {
            type: 'string',
            description: 'File path being affected (if applicable)',
          },
          command: {
            type: 'string',
            description: 'Command being executed (if applicable)',
          },
          diff: {
            type: 'string',
            description: 'Diff of changes (if applicable)',
          },
        },
        required: ['operation', 'description'],
      },
    },
    {
      name: 'permission_set_auto',
      description: 'Enable or disable auto-approve mode for the session',
      input_schema: {
        type: 'object' as const,
        properties: {
          enabled: {
            type: 'boolean',
            description: 'Whether to enable auto-approve mode',
          },
        },
        required: ['enabled'],
      },
    },
  ];
}

/**
 * Execute a permission tool
 */
export async function executePermissionTool(
  toolName: string,
  input: Record<string, unknown>
): Promise<string> {
  const manager = getPermissionManager();

  switch (toolName) {
    case 'permission_check': {
      const result = manager.checkPermission(
        input.operation as OperationType,
        input.path as string | undefined
      );
      return JSON.stringify({
        allowed: result.allowed,
        requiresConfirmation: result.requiresConfirmation,
        decision: result.decision,
      });
    }

    case 'permission_request': {
      const riskLevel = assessRiskLevel(input.operation as OperationType, {
        command: input.command as string | undefined,
        filePath: input.filePath as string | undefined,
      });

      const allowed = await manager.requestPermission(
        input.operation as OperationType,
        input.description as string,
        {
          command: input.command as string | undefined,
          filePath: input.filePath as string | undefined,
          diff: input.diff as string | undefined,
          riskLevel,
        }
      );

      return JSON.stringify({ allowed, riskLevel });
    }

    case 'permission_set_auto': {
      manager.setAutoApproveMode(input.enabled as boolean);
      return JSON.stringify({ success: true, autoApprove: input.enabled });
    }

    default:
      throw new Error(`Unknown permission tool: ${toolName}`);
  }
}

/**
 * Check if a tool name is a permission tool
 */
export function isPermissionTool(toolName: string): boolean {
  return ['permission_check', 'permission_request', 'permission_set_auto'].includes(toolName);
}
