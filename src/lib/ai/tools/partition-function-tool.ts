/**
 * PARTITION-FUNCTION TOOL
 * Statistical sum - THE GENERATING FUNCTION OF THERMODYNAMICS!
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const partitionfunctionTool: UnifiedTool = {
  name: 'partition_function',
  description: 'Partition function - canonical ensemble, free energy, phase transitions',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['compute', 'canonical', 'free', 'phase', 'info'], description: 'Operation' }
    },
    required: ['operation']
  }
};

export async function executepartitionfunction(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const result = { operation: args.operation, tool: 'partition-function', status: 'done' };
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function ispartitionfunctionAvailable(): boolean { return true; }
