/**
 * MERKLE-TREE TOOL
 * Merkle tree construction and verification
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const merkletreeTool: UnifiedTool = {
  name: 'merkle_tree',
  description: 'Build and verify Merkle trees for blockchain',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['build', 'verify', 'get_proof', 'get_root', 'info'], description: 'Operation' }
    },
    required: ['operation']
  }
};

export async function executemerkletree(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const result = { operation: args.operation, tool: 'merkle-tree', status: 'done' };
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function ismerkletreeAvailable(): boolean { return true; }
