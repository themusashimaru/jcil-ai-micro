/**
 * ROCKET-EQUATION TOOL
 * Tsiolkovsky rocket equation
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const rocketequationTool: UnifiedTool = {
  name: 'rocket_equation',
  description: 'Tsiolkovsky rocket equation and staging calculations',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['delta_v', 'mass_ratio', 'staging', 'info'], description: 'Operation' }
    },
    required: ['operation']
  }
};

export async function executerocketequation(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const result = { operation: args.operation, tool: 'rocket-equation', status: 'done' };
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isrocketequationAvailable(): boolean { return true; }
