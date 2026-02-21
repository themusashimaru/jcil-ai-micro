/**
 * MCP SCOPE PERMISSIONS
 *
 * Full Claude Code-compatible scope-based permission system for MCP servers.
 *
 * Scope Hierarchy (highest to lowest priority):
 * 1. managed  - Organization/enterprise managed settings (cannot be overridden)
 * 2. user     - User-level settings (~/.claude/mcp.json)
 * 3. project  - Project-level settings (.claude/mcp.json)
 * 4. local    - Local/session-specific overrides
 *
 * Features:
 * - Allow/deny tool patterns per scope
 * - Auto-approve mode per server
 * - Hierarchical scope resolution (managed > user > project > local)
 * - Managed scope for enterprise control
 */

import { logger } from '@/lib/logger';
import { createClient as createSupabaseClient } from '@/lib/supabase/server';
import { untypedFrom } from '@/lib/supabase/workspace-client';

const log = logger('MCPScopes');

// ============================================================================
// TYPES
// ============================================================================

/**
 * Full Claude Code scope hierarchy
 * Priority: managed > user > project > local
 */
export type MCPScope = 'managed' | 'user' | 'project' | 'local';

/**
 * Legacy scope aliases for backwards compatibility
 */
export type LegacyMCPScope = 'global' | 'workspace' | 'session';

/**
 * Combined scope type for backwards compatibility
 */
export type MCPScopeAll = MCPScope | LegacyMCPScope;

export interface MCPServerPermission {
  serverId: string;
  scope: MCPScope;
  scopeId?: string;
  allowedTools: string[];
  deniedTools: string[];
  autoApprove: boolean;
  /** For managed scope: cannot be overridden by lower scopes */
  locked?: boolean;
  /** Source of the configuration */
  source?: 'database' | 'file' | 'managed';
}

export interface MCPToolCheck {
  allowed: boolean;
  reason: string;
  scope?: MCPScope;
  /** If true, this permission cannot be overridden */
  locked?: boolean;
}

/**
 * MCP server configuration from file (.claude/mcp.json)
 */
export interface MCPConfigFile {
  servers?: Record<
    string,
    {
      command: string;
      args?: string[];
      env?: Record<string, string>;
      enabled?: boolean;
      allowedTools?: string[];
      deniedTools?: string[];
      autoApprove?: boolean;
    }
  >;
}

/**
 * Scope resolution context
 */
export interface MCPScopeContext {
  userId: string;
  sessionId?: string;
  projectId?: string;
  organizationId?: string;
}

// ============================================================================
// PERMISSION MANAGER
// ============================================================================

export class MCPScopeManager {
  private permissions: Map<string, MCPServerPermission> = new Map();
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  private getKey(serverId: string, scope: MCPScope, scopeId?: string): string {
    return serverId + ':' + scope + ':' + (scopeId || 'global');
  }

  async loadPermissions(): Promise<void> {
    try {
      const supabase = await createSupabaseClient();
      const { data, error } = await untypedFrom(supabase, 'mcp_server_permissions')
        .select('*')
        .eq('user_id', this.userId);

      if (error) {
        log.error('Failed to load MCP permissions', { error });
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const row of (data || []) as any[]) {
        const perm: MCPServerPermission = {
          serverId: row.server_id,
          scope: row.scope as MCPScope,
          scopeId: row.scope_id,
          allowedTools: row.allowed_tools || [],
          deniedTools: row.denied_tools || [],
          autoApprove: row.auto_approve || false,
        };
        const key = this.getKey(perm.serverId, perm.scope, perm.scopeId);
        this.permissions.set(key, perm);
      }

      log.info('Loaded MCP permissions', { count: this.permissions.size });
    } catch (error) {
      log.error('Error loading MCP permissions', { error });
    }
  }

  /**
   * Check if a tool is allowed using full Claude Code scope hierarchy.
   *
   * Priority: managed > user > project > local
   * - managed: Organization-enforced settings (cannot be overridden)
   * - user: User-level preferences (~/.claude/mcp.json)
   * - project: Project settings (.claude/mcp.json)
   * - local: Session-specific overrides
   */
  checkTool(
    serverId: string,
    toolName: string,
    context?: {
      sessionId?: string;
      projectId?: string;
      organizationId?: string;
    }
  ): MCPToolCheck {
    const { sessionId, projectId, organizationId } = context || {};

    // Full Claude Code scope hierarchy (highest to lowest priority)
    const scopes: Array<{ scope: MCPScope; scopeId?: string }> = [
      // Managed scope - organization/enterprise (highest priority)
      { scope: 'managed', scopeId: organizationId },
      // User scope - user-level settings
      { scope: 'user', scopeId: this.userId },
      // Project scope - project-level settings
      { scope: 'project', scopeId: projectId },
      // Local scope - session-specific (lowest priority)
      { scope: 'local', scopeId: sessionId },
    ];

    for (const { scope, scopeId } of scopes) {
      // Skip scopes without IDs (except user which uses userId)
      if (!scopeId && scope !== 'user') continue;

      const key = this.getKey(serverId, scope, scopeId);
      const perm = this.permissions.get(key);

      if (!perm) continue;

      // Check denied tools first
      if (this.matchesPattern(toolName, perm.deniedTools)) {
        return {
          allowed: false,
          reason: `Tool denied at ${scope} scope`,
          scope,
          locked: perm.locked || scope === 'managed',
        };
      }

      // Check allowed tools
      if (perm.allowedTools.length > 0) {
        if (this.matchesPattern(toolName, perm.allowedTools)) {
          return {
            allowed: true,
            reason: `Tool allowed at ${scope} scope`,
            scope,
            locked: perm.locked || scope === 'managed',
          };
        }
        // If allowed list exists but doesn't match, continue to next scope
        // unless this is a managed scope with locked setting
        if (perm.locked || scope === 'managed') {
          return {
            allowed: false,
            reason: `Tool not in managed allowlist at ${scope} scope`,
            scope,
            locked: true,
          };
        }
        continue;
      }

      // Check auto-approve
      if (perm.autoApprove) {
        return {
          allowed: true,
          reason: `Auto-approved at ${scope} scope`,
          scope,
          locked: perm.locked || scope === 'managed',
        };
      }
    }

    return {
      allowed: false,
      reason: 'No permission configured - requires confirmation',
    };
  }

  /**
   * Legacy method for backwards compatibility
   */
  checkToolLegacy(
    serverId: string,
    toolName: string,
    sessionId?: string,
    workspaceId?: string
  ): MCPToolCheck {
    return this.checkTool(serverId, toolName, {
      sessionId,
      projectId: workspaceId,
    });
  }

  private matchesPattern(toolName: string, patterns: string[]): boolean {
    for (const pattern of patterns) {
      if (pattern === '*') return true;
      if (pattern === toolName) return true;

      if (pattern.includes('*')) {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
        if (regex.test(toolName)) return true;
      }
    }
    return false;
  }

  async setPermission(permission: MCPServerPermission): Promise<boolean> {
    try {
      const supabase = await createSupabaseClient();

      await untypedFrom(supabase, 'mcp_server_permissions').upsert(
        {
          user_id: this.userId,
          server_id: permission.serverId,
          scope: permission.scope,
          scope_id: permission.scopeId || null,
          allowed_tools: permission.allowedTools,
          denied_tools: permission.deniedTools,
          auto_approve: permission.autoApprove,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,server_id,scope,scope_id' }
      );

      const key = this.getKey(permission.serverId, permission.scope, permission.scopeId);
      this.permissions.set(key, permission);

      log.info('Set MCP permission', {
        serverId: permission.serverId,
        scope: permission.scope,
      });
      return true;
    } catch (error) {
      log.error('Failed to set MCP permission', { error });
      return false;
    }
  }

  getPermission(serverId: string, scope: MCPScope, scopeId?: string): MCPServerPermission | null {
    const key = this.getKey(serverId, scope, scopeId);
    return this.permissions.get(key) || null;
  }

  listPermissions(): MCPServerPermission[] {
    return Array.from(this.permissions.values());
  }

  async deletePermission(serverId: string, scope: MCPScope, scopeId?: string): Promise<boolean> {
    try {
      const supabase = await createSupabaseClient();

      let query = untypedFrom(supabase, 'mcp_server_permissions')
        .delete()
        .eq('user_id', this.userId)
        .eq('server_id', serverId)
        .eq('scope', scope);

      if (scopeId) {
        query = query.eq('scope_id', scopeId);
      } else {
        query = query.is('scope_id', null);
      }

      await query;

      const key = this.getKey(serverId, scope, scopeId);
      this.permissions.delete(key);

      return true;
    } catch (error) {
      log.error('Failed to delete MCP permission', { error });
      return false;
    }
  }
}

// ============================================================================
// SINGLETON FACTORY
// ============================================================================

const managers = new Map<string, MCPScopeManager>();

export function getMCPScopeManager(userId: string): MCPScopeManager {
  let manager = managers.get(userId);
  if (!manager) {
    manager = new MCPScopeManager(userId);
    managers.set(userId, manager);
  }
  return manager;
}

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

export function getMCPScopeTools(): Array<{
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
      name: 'mcp_scope_list',
      description: 'List all MCP server permissions across all scopes.',
      input_schema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'mcp_scope_set',
      description:
        'Set permissions for an MCP server at a specific scope. Scopes: managed (org-enforced), user, project, local.',
      input_schema: {
        type: 'object' as const,
        properties: {
          server_id: { type: 'string', description: 'MCP server ID' },
          scope: {
            type: 'string',
            enum: ['managed', 'user', 'project', 'local'],
            description: 'Permission scope. Priority: managed > user > project > local',
          },
          allowed_tools: {
            type: 'array',
            items: { type: 'string' },
            description: 'Tool patterns to allow (use * for all)',
          },
          denied_tools: {
            type: 'array',
            items: { type: 'string' },
            description: 'Tool patterns to deny',
          },
          auto_approve: {
            type: 'boolean',
            description: 'Auto-approve all tools not explicitly denied',
          },
          locked: {
            type: 'boolean',
            description: 'Lock this permission (cannot be overridden by lower scopes)',
          },
        },
        required: ['server_id', 'scope'],
      },
    },
    {
      name: 'mcp_scope_check',
      description: 'Check if a specific MCP tool is allowed using full scope hierarchy.',
      input_schema: {
        type: 'object' as const,
        properties: {
          server_id: { type: 'string', description: 'MCP server ID' },
          tool_name: { type: 'string', description: 'Tool name to check' },
        },
        required: ['server_id', 'tool_name'],
      },
    },
    {
      name: 'mcp_scope_delete',
      description: 'Delete permissions for an MCP server at a specific scope.',
      input_schema: {
        type: 'object' as const,
        properties: {
          server_id: { type: 'string', description: 'MCP server ID' },
          scope: {
            type: 'string',
            enum: ['managed', 'user', 'project', 'local'],
            description: 'Permission scope to delete',
          },
        },
        required: ['server_id', 'scope'],
      },
    },
    {
      name: 'mcp_scope_hierarchy',
      description: 'Show the MCP scope hierarchy and explain priority resolution.',
      input_schema: { type: 'object' as const, properties: {}, required: [] },
    },
  ];
}

export function isMCPScopeTool(name: string): boolean {
  return name.startsWith('mcp_scope_');
}

export async function executeMCPScopeTool(
  name: string,
  input: Record<string, unknown>,
  context: {
    userId: string;
    sessionId: string;
    workspaceId: string;
    organizationId?: string;
  }
): Promise<string> {
  const manager = getMCPScopeManager(context.userId);
  await manager.loadPermissions();

  switch (name) {
    case 'mcp_scope_list': {
      const permissions = manager.listPermissions();
      if (permissions.length === 0) {
        return 'No MCP permissions configured. All tools require confirmation by default.';
      }

      // Group by scope for better display
      const byScope: Record<MCPScope, MCPServerPermission[]> = {
        managed: [],
        user: [],
        project: [],
        local: [],
      };

      for (const perm of permissions) {
        byScope[perm.scope]?.push(perm);
      }

      const lines = ['# MCP Permissions\n'];
      const scopeOrder: MCPScope[] = ['managed', 'user', 'project', 'local'];
      const scopeLabels: Record<MCPScope, string> = {
        managed: '🔒 Managed (Organization)',
        user: '👤 User',
        project: '📁 Project',
        local: '💻 Local',
      };

      for (const scope of scopeOrder) {
        const perms = byScope[scope];
        if (perms.length === 0) continue;

        lines.push(`## ${scopeLabels[scope]}\n`);
        for (const perm of perms) {
          const lockIcon = perm.locked ? ' 🔒' : '';
          lines.push(`**${perm.serverId}**${lockIcon}`);

          if (perm.allowedTools.length > 0) {
            lines.push(`  ✓ Allowed: ${perm.allowedTools.join(', ')}`);
          }
          if (perm.deniedTools.length > 0) {
            lines.push(`  ✗ Denied: ${perm.deniedTools.join(', ')}`);
          }
          lines.push(`  Auto-approve: ${perm.autoApprove ? 'Yes' : 'No'}`);
          lines.push('');
        }
      }
      return lines.join('\n');
    }

    case 'mcp_scope_set': {
      const serverId = input.server_id as string;
      const scope = input.scope as MCPScope;
      const allowedTools = (input.allowed_tools as string[]) || [];
      const deniedTools = (input.denied_tools as string[]) || [];
      const autoApprove = (input.auto_approve as boolean) || false;
      const locked = (input.locked as boolean) || false;

      if (!serverId || !scope) {
        return 'Error: server_id and scope are required';
      }

      // Map scopes to IDs
      let scopeId: string | undefined;
      switch (scope) {
        case 'managed':
          scopeId = context.organizationId;
          break;
        case 'user':
          scopeId = context.userId;
          break;
        case 'project':
          scopeId = context.workspaceId;
          break;
        case 'local':
          scopeId = context.sessionId;
          break;
      }

      const success = await manager.setPermission({
        serverId,
        scope,
        scopeId,
        allowedTools,
        deniedTools,
        autoApprove,
        locked,
      });

      const lockNote = locked ? ' (locked - cannot be overridden)' : '';
      return success
        ? `Permissions set for **${serverId}** at ${scope} scope${lockNote}.`
        : 'Failed to set permissions.';
    }

    case 'mcp_scope_check': {
      const serverId = input.server_id as string;
      const toolName = input.tool_name as string;

      if (!serverId || !toolName) {
        return 'Error: server_id and tool_name are required';
      }

      const result = manager.checkTool(serverId, toolName, {
        sessionId: context.sessionId,
        projectId: context.workspaceId,
        organizationId: context.organizationId,
      });

      const icon = result.allowed ? '✓' : '✗';
      const lockIcon = result.locked ? ' 🔒' : '';
      let response = `${icon} **${serverId}:${toolName}**${lockIcon}\n\n${result.reason}`;
      if (result.scope) {
        response += ` (${result.scope} scope)`;
      }
      if (result.locked) {
        response += '\n\n*This permission is locked and cannot be overridden.*';
      }
      return response;
    }

    case 'mcp_scope_delete': {
      const serverId = input.server_id as string;
      const scope = input.scope as MCPScope;

      if (!serverId || !scope) {
        return 'Error: server_id and scope are required';
      }

      let scopeId: string | undefined;
      switch (scope) {
        case 'managed':
          scopeId = context.organizationId;
          break;
        case 'user':
          scopeId = context.userId;
          break;
        case 'project':
          scopeId = context.workspaceId;
          break;
        case 'local':
          scopeId = context.sessionId;
          break;
      }

      const success = await manager.deletePermission(serverId, scope, scopeId);
      return success
        ? `Permissions deleted for **${serverId}** at ${scope} scope.`
        : 'Failed to delete permissions.';
    }

    case 'mcp_scope_hierarchy': {
      return `# MCP Scope Hierarchy

MCP permissions are resolved using a 4-tier hierarchy, from highest to lowest priority:

## 🔒 1. Managed (Organization)
- Set by organization administrators
- Cannot be overridden by lower scopes
- Used for enterprise policy enforcement
- Location: Managed by admin console

## 👤 2. User
- User-level preferences
- Applies across all projects
- Location: \`~/.claude/mcp.json\`

## 📁 3. Project
- Project-specific settings
- Overrides user settings (unless locked)
- Location: \`.claude/mcp.json\`

## 💻 4. Local (Session)
- Session-specific overrides
- Lowest priority
- Temporary, cleared on session end

---

**Resolution Order:**
When checking a tool, the system checks scopes from highest to lowest priority.
The first matching rule is applied. Locked permissions at higher scopes
cannot be overridden by lower scopes.

**Example:**
If \`managed\` scope denies \`dangerous_tool\`, no lower scope can allow it.
If \`user\` scope allows \`file_*\`, that applies unless \`project\` denies a specific file tool.`;
    }

    default:
      return 'Unknown MCP scope tool: ' + name;
  }
}
