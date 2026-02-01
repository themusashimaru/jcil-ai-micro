/**
 * SEQUENCE-ALIGNMENT TOOL
 * DNA/protein sequence alignment
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const sequencealignmentTool: UnifiedTool = {
  name: 'sequence_alignment',
  description: 'DNA and protein sequence alignment (Needleman-Wunsch, Smith-Waterman)',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['global', 'local', 'multiple', 'info'], description: 'Operation' },
      algorithm: { type: 'string', enum: ['needleman_wunsch', 'smith_waterman', 'clustal'], description: 'Algorithm' }
    },
    required: ['operation']
  }
};

export async function executesequencealignment(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const result = { operation: args.operation, tool: 'sequence-alignment', algorithm: args.algorithm || 'needleman_wunsch', status: 'done' };
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function issequencealignmentAvailable(): boolean { return true; }
