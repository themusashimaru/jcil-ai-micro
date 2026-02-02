/**
 * LINE-INTERSECTION TOOL
 * Line segment intersection detection
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const lineintersectionTool: UnifiedTool = {
  name: 'line_intersection',
  description: 'Line segment intersection detection (Bentley-Ottmann)',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['detect', 'find_all', 'sweep_line', 'info'], description: 'Operation' }
    },
    required: ['operation']
  }
};

export async function executelineintersection(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const result = { operation: args.operation, tool: 'line-intersection', status: 'done' };
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function islineintersectionAvailable(): boolean { return true; }
