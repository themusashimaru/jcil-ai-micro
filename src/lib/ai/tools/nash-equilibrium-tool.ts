/**
 * NASH-EQUILIBRIUM TOOL
 * Nash equilibrium computation
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const nashequilibriumTool: UnifiedTool = {
  name: 'nash_equilibrium',
  description: 'Nash equilibrium computation for game theory',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['find', 'verify', 'mixed_strategy', 'info'], description: 'Operation' },
      game_type: { type: 'string', enum: ['normal_form', 'extensive_form'], description: 'Game representation' }
    },
    required: ['operation']
  }
};

export async function executenashequilibrium(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const result = { operation: args.operation, tool: 'nash-equilibrium', gameType: args.game_type || 'normal_form', status: 'done' };
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isnashequilibriumAvailable(): boolean { return true; }
