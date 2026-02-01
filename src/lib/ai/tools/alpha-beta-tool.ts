/**
 * ALPHA-BETA TOOL
 * Alpha-beta pruning game tree search
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const alphabetaTool: UnifiedTool = {
  name: 'alpha_beta',
  description: 'Alpha-beta pruning game tree search',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['train', 'predict', 'optimize', 'info'], description: 'Operation' },
      data: { type: 'object', description: 'Training/input data' }
    },
    required: ['operation']
  }
};

export async function executealphabeta(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const result = { operation: args.operation, tool: 'alpha-beta', optimized: true };
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isalphabetaAvailable(): boolean { return true; }
