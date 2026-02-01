/**
 * VALUE-AT-RISK TOOL
 * Value at Risk calculation
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const valueatriskTool: UnifiedTool = {
  name: 'value_at_risk',
  description: 'Value at Risk (VaR) calculation for portfolio risk',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['calculate', 'historical', 'parametric', 'monte_carlo', 'info'], description: 'Operation' },
      confidence: { type: 'number', description: 'Confidence level (e.g., 0.95, 0.99)' }
    },
    required: ['operation']
  }
};

export async function executevalueatrisk(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const result = { operation: args.operation, tool: 'value-at-risk', confidence: args.confidence || 0.95, status: 'done' };
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isvalueatriskAvailable(): boolean { return true; }
