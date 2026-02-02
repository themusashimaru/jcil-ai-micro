/**
 * BLAST TOOL
 * Basic Local Alignment Search Tool
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const blastTool: UnifiedTool = {
  name: 'blast',
  description: 'BLAST sequence database search',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['blastn', 'blastp', 'blastx', 'tblastn', 'info'], description: 'Operation' },
      database: { type: 'string', description: 'Database to search' }
    },
    required: ['operation']
  }
};

export async function executeblast(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const result = { operation: args.operation, tool: 'blast', database: args.database || 'nr', status: 'done' };
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isblastAvailable(): boolean { return true; }
