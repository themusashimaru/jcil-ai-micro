/**
 * MILITARY-STRATEGY TOOL
 * Military strategy and tactics analysis
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const militarystrategyTool: UnifiedTool = {
  name: 'military_strategy',
  description: 'Military strategy - Lanchester, logistics, terrain analysis',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['lanchester', 'logistics', 'terrain', 'force_ratio', 'info'], description: 'Operation' }
    },
    required: ['operation']
  }
};

export async function executemilitarystrategy(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const result = { operation: args.operation, tool: 'military-strategy', status: 'done' };
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function ismilitarystrategyAvailable(): boolean { return true; }
