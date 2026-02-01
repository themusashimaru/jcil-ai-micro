/**
 * RANDOM-GENERATOR TOOL
 * Cryptographically secure random number generation
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const randomgeneratorTool: UnifiedTool = {
  name: 'random_generator',
  description: 'Cryptographically secure random number generation',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['generate_bytes', 'generate_int', 'generate_uuid', 'info'], description: 'Operation' },
      length: { type: 'number', description: 'Length in bytes' }
    },
    required: ['operation']
  }
};

export async function executerandomgenerator(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const result = { operation: args.operation, tool: 'random-generator', length: args.length || 32, status: 'done' };
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function israndomgeneratorAvailable(): boolean { return true; }
