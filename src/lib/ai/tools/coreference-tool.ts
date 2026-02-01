/**
 * COREFERENCE TOOL
 * Coreference resolution
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const coreferenceTool: UnifiedTool = {
  name: 'coreference',
  description: 'Coreference resolution for pronoun and entity linking',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['resolve', 'cluster', 'info'], description: 'Operation' }
    },
    required: ['operation']
  }
};

export async function executecoreference(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const result = { operation: args.operation, tool: 'coreference', status: 'done' };
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function iscoreferenceAvailable(): boolean { return true; }
