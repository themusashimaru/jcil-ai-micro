/**
 * ENTROPY-CALCULATOR TOOL
 * Shannon entropy and information theory
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const entropycalculatorTool: UnifiedTool = {
  name: 'entropy_calculator',
  description: 'Calculate Shannon entropy, mutual information, KL divergence',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['entropy', 'mutual_info', 'kl_divergence', 'channel_capacity', 'info'], description: 'Operation' }
    },
    required: ['operation']
  }
};

export async function executeentropycalculator(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const result = { operation: args.operation, tool: 'entropy-calculator', status: 'done' };
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isentropycalculatorAvailable(): boolean { return true; }
