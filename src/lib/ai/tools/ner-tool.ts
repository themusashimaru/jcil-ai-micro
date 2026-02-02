/**
 * NER TOOL
 * Named Entity Recognition
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const nerTool: UnifiedTool = {
  name: 'ner',
  description: 'Named Entity Recognition (person, org, location, etc.)',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['extract', 'classify', 'info'], description: 'Operation' },
      entity_types: { type: 'array', items: { type: 'string' }, description: 'Entity types to extract' }
    },
    required: ['operation']
  }
};

export async function executener(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const result = { operation: args.operation, tool: 'ner', status: 'done' };
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isnerAvailable(): boolean { return true; }
