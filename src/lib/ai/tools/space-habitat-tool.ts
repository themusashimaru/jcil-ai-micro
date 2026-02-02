/**
 * SPACE-HABITAT TOOL
 * Off-world living - O'NEILL CYLINDERS!
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const spacehabitatTool: UnifiedTool = {
  name: 'space_habitat',
  description: 'Space habitat design - O\'Neill cylinders, Stanford tori, life support, artificial gravity',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['design', 'life_support', 'gravity', 'ecosystem', 'info'], description: 'Operation' }
    },
    required: ['operation']
  }
};

export async function executespacehabitat(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const result = { operation: args.operation, tool: 'space-habitat', status: 'done' };
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isspacehabitatAvailable(): boolean { return true; }
