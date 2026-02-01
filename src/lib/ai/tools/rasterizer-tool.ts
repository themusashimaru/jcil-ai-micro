/**
 * RASTERIZER TOOL
 * Triangle rasterization engine
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const rasterizerTool: UnifiedTool = {
  name: 'rasterizer',
  description: 'Triangle rasterization engine',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['render', 'apply', 'compute', 'info'], description: 'Operation' },
      settings: { type: 'object', description: 'Render settings' }
    },
    required: ['operation']
  }
};

export async function executerasterizer(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const result = { operation: args.operation, tool: 'rasterizer', rendered: true };
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function israsterizerAvailable(): boolean { return true; }
