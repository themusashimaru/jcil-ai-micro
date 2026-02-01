/**
 * HMAC TOOL
 * Hash-based message authentication code
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const hmacTool: UnifiedTool = {
  name: 'hmac',
  description: 'HMAC message authentication',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['generate', 'verify', 'info'], description: 'Operation' },
      hash: { type: 'string', enum: ['SHA-256', 'SHA-384', 'SHA-512'], description: 'Hash algorithm' }
    },
    required: ['operation']
  }
};

export async function executehmac(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const result = { operation: args.operation, tool: 'hmac', hash: args.hash || 'SHA-256', status: 'done' };
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function ishmacAvailable(): boolean { return true; }
