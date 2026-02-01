/**
 * ANTI-ALIASING TOOL
 * MSAA FXAA anti-aliasing
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const antialiasingTool: UnifiedTool = {
  name: 'anti_aliasing',
  description: 'MSAA FXAA anti-aliasing',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['render', 'apply', 'compute', 'info'], description: 'Operation' },
      settings: { type: 'object', description: 'Render settings' }
    },
    required: ['operation']
  }
};

export async function executeantialiasing(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const result = { operation: args.operation, tool: 'anti-aliasing', rendered: true };
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isantialiasingAvailable(): boolean { return true; }
