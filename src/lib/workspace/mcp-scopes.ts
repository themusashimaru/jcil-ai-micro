/**
 * MCP SCOPE PERMISSIONS
 *
 * Scope-based permission system for MCP servers and tools.
 * Supports global, workspace, and session scopes.
 *
 * Claude Code Parity:
 * - Allow/deny tool patterns per scope
 * - Auto-approve mode per server
 * - Hierarchical scope resolution (session > workspace > global)
 */

import { logger } from '@/lib/logger';
import { createClient as createSupabaseClient } from '@/lib/supabase/server';

const log = logger('MCPScopes');

// ============================================================================
// TYPES
// ============================================================================

export type MCPScope = 'global' | 'workspace' | 'session';

export interface MCPServerPermission {
  serverId: string;
  scope: MCPScope;
  scopeId?: string;
  allowedTools: string[];
  deniedTools: string[];
  autoApprove: boolean;
}

export interface MCPToolCheck {
  allowed: boolean;
  reason: string;
  scope?: MCPScope;
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('mcp_server_permissions') as any)
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

  checkTool(
    serverId: string,
    toolName: string,
    sessionId?: string,
    workspaceId?: string
  ): MCPToolCheck {
    const scopes: Array<{ scope: MCPScope; scopeId?: string }> = [
      { scope: 'session', scopeId: sessionId },
      { scope: 'workspace', scopeId: workspaceId },
      { scope: 'global' },
    ];

    for (const { scope, scopeId } of scopes) {
      if (!scopeId && scope !== 'global') continue;

      const key = this.getKey(serverId, scope, scopeId);
      const perm = this.permissions.get(key);

      if (!perm) continue;

      if (this.matchesPattern(toolName, perm.deniedTools)) {
        return {
          allowed: false,
          reason: 'Tool denied at ' + scope + ' scope',
          scope,
        };
      }

      if (perm.allowedTools.length > 0) {
        if (this.matchesPattern(toolName, perm.allowedTools)) {
          return {
            allowed: true,
            reason: 'Tool allowed at ' + scope + ' scope',
            scope,
          };
        }
        continue;
      }

      if (perm.autoApprove) {
        return {
          allowed: true,
          reason: 'Auto-approved at ' + scope + ' scope',
          scope,
        };
      }
    }

    return {
      allowed: false,
      reason: 'No permission configured - requires confirmation',
    };
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('mcp_server_permissions') as any).upsert(
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase.from('mcp_server_permissions') as any)
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
      description: 'Set permissions for an MCP server at a specific scope.',
      input_schema: {
        type: 'object' as const,
        properties: {
          server_id: { type: 'string', description: 'MCP server ID' },
          scope: {
            type: 'string',
            enum: ['global', 'workspace', 'session'],
            description: 'Permission scope',
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
        },
        required: ['server_id', 'scope'],
      },
    },
    {
      name: 'mcp_scope_check',
      description: 'Check if a specific MCP tool is allowed.',
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
            enum: ['global', 'workspace', 'session'],
            description: 'Permission scope to delete',
          },
        },
        required: ['server_id', 'scope'],
      },
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

      const lines = ['**MCP Permissions:**\n'];
      for (const perm of permissions) {
        const scopeInfo = perm.scopeId ? perm.scope + ': ' + perm.scopeId : perm.scope;
        lines.push('**' + perm.serverId + '** (' + scopeInfo + ')');

        if (perm.allowedTools.length > 0) {
          lines.push('  ✓ Allowed: ' + perm.allowedTools.join(', '));
        }
        if (perm.deniedTools.length > 0) {
          lines.push('  ✗ Denied: ' + perm.deniedTools.join(', '));
        }
        lines.push('  Auto-approve: ' + (perm.autoApprove ? 'Yes' : 'No'));
        lines.push('');
      }
      return lines.join('\n');
    }

    case 'mcp_scope_set': {
      const serverId = input.server_id as string;
      const scope = input.scope as MCPScope;
      const allowedTools = (input.allowed_tools as string[]) || [];
      const deniedTools = (input.denied_tools as string[]) || [];
      const autoApprove = (input.auto_approve as boolean) || false;

      if (!serverId || !scope) {
        return 'Error: server_id and scope are required';
      }

      let scopeId: string | undefined;
      if (scope === 'session') scopeId = context.sessionId;
      else if (scope === 'workspace') scopeId = context.workspaceId;

      const success = await manager.setPermission({
        serverId,
        scope,
        scopeId,
        allowedTools,
        deniedTools,
        autoApprove,
      });

      return success
        ? 'Permissions set for **' + serverId + '** at ' + scope + ' scope.'
        : 'Failed to set permissions.';
    }

    case 'mcp_scope_check': {
      const serverId = input.server_id as string;
      const toolName = input.tool_name as string;

      if (!serverId || !toolName) {
        return 'Error: server_id and tool_name are required';
      }

      const result = manager.checkTool(serverId, toolName, context.sessionId, context.workspaceId);

      const icon = result.allowed ? '✓' : '✗';
      let response = icon + ' **' + serverId + ':' + toolName + '**\n\n' + result.reason;
      if (result.scope) {
        response += ' (' + result.scope + ' scope)';
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
      if (scope === 'session') scopeId = context.sessionId;
      else if (scope === 'workspace') scopeId = context.workspaceId;

      const success = await manager.deletePermission(serverId, scope, scopeId);
      return success
        ? 'Permissions deleted for **' + serverId + '** at ' + scope + ' scope.'
        : 'Failed to delete permissions.';
    }

    default:
      return 'Unknown MCP scope tool: ' + name;
  }
}
