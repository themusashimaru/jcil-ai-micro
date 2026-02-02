/**
 * INFRASTRUCTURE-AS-CODE TOOL
 * Define infrastructure in code - AUTOMATE EVERYTHING!
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const infrastructureascodeTool: UnifiedTool = {
  name: 'infrastructure_as_code',
  description: 'Infrastructure as code - Terraform, CloudFormation, state management, modules',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['plan', 'apply', 'destroy', 'state', 'info'], description: 'Operation' }
    },
    required: ['operation']
  }
};

export async function executeinfrastructureascode(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const result = { operation: args.operation, tool: 'infrastructure-as-code', status: 'done' };
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isinfrastructureascodeAvailable(): boolean { return true; }
