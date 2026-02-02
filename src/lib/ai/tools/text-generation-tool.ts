/**
 * TEXT-GENERATION TOOL
 * Language model text generation
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const textgenerationTool: UnifiedTool = {
  name: 'text_generation',
  description: 'Language model text generation with various sampling strategies',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['generate', 'complete', 'beam_search', 'info'], description: 'Operation' },
      sampling: { type: 'string', enum: ['greedy', 'top_k', 'top_p', 'temperature'], description: 'Sampling strategy' }
    },
    required: ['operation']
  }
};

export async function executetextgeneration(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const result = { operation: args.operation, tool: 'text-generation', sampling: args.sampling || 'top_p', status: 'done' };
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function istextgenerationAvailable(): boolean { return true; }
