/**
 * EXPLANATION-GENERATOR TOOL
 * Generate clear explanations - MAKE THE COMPLEX SIMPLE!
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const explanationgeneratorTool: UnifiedTool = {
  name: 'explanation_generator',
  description: 'Explanation generator - simplification, analogies, visualizations, scaffolding',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['explain', 'simplify', 'analogize', 'scaffold', 'info'], description: 'Operation' }
    },
    required: ['operation']
  }
};

export async function executeexplanationgenerator(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const result = { operation: args.operation, tool: 'explanation-generator', status: 'done' };
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isexplanationgeneratorAvailable(): boolean { return true; }
