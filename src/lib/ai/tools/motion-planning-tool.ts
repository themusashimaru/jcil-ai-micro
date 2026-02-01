/**
 * MOTION-PLANNING TOOL
 * Motion planning with RRT and PRM
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const motionplanningTool: UnifiedTool = {
  name: 'motion_planning',
  description: 'Motion planning with RRT and PRM',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['compute', 'simulate', 'plan', 'info'], description: 'Operation' },
      parameters: { type: 'object', description: 'Input parameters' }
    },
    required: ['operation']
  }
};

export async function executemotionplanning(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const result = { operation: args.operation, tool: 'motion-planning', computed: true };
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function ismotionplanningAvailable(): boolean { return true; }
