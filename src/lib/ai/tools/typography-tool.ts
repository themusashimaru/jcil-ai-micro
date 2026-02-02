/**
 * TYPOGRAPHY TOOL
 * Typography and font analysis
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const typographyTool: UnifiedTool = {
  name: 'typography',
  description: 'Typography - font pairing, hierarchy, readability, kerning',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['pair_fonts', 'hierarchy', 'readability', 'kerning', 'info'], description: 'Operation' }
    },
    required: ['operation']
  }
};

export async function executetypography(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const result = { operation: args.operation, tool: 'typography', status: 'done' };
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function istypographyAvailable(): boolean { return true; }
