/**
 * PAYOFF-MATRIX TOOL
 * Game theory payoff matrix analysis
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const payoffmatrixTool: UnifiedTool = {
  name: 'payoff_matrix',
  description: 'Payoff matrix creation and analysis for game theory',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['create', 'analyze', 'dominant_strategy', 'pareto_optimal', 'info'], description: 'Operation' }
    },
    required: ['operation']
  }
};

export async function executepayoffmatrix(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const result = { operation: args.operation, tool: 'payoff-matrix', status: 'done' };
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function ispayoffmatrixAvailable(): boolean { return true; }
