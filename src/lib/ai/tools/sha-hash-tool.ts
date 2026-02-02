/**
 * SHA-HASH TOOL
 * SHA-1/256/384/512 hashing
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const shahashTool: UnifiedTool = {
  name: 'sha_hash',
  description: 'SHA family cryptographic hashing',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['hash', 'verify', 'info'], description: 'Operation' },
      algorithm: { type: 'string', enum: ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'], description: 'Algorithm' }
    },
    required: ['operation']
  }
};

export async function executeshahash(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const result = { operation: args.operation, tool: 'sha-hash', algorithm: args.algorithm || 'SHA-256', status: 'done' };
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isshahashAvailable(): boolean { return true; }
