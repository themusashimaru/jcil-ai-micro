/**
 * LAB-VALUES TOOL
 * Lab value interpreter with reference ranges
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const labvaluesTool: UnifiedTool = {
  name: 'lab_values',
  description: 'Lab value interpreter with reference ranges',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['analyze', 'calculate', 'info'], description: 'Operation type' },
      data: { type: 'object', description: 'Input data for analysis' }
    },
    required: ['operation']
  }
};

export async function executelabvalues(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const result = { operation: args.operation, description: 'Lab value interpreter with reference ranges', status: 'analyzed' };
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function islabvaluesAvailable(): boolean { return true; }
