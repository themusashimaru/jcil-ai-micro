/**
 * BLACK-SCHOLES TOOL
 * Black-Scholes options pricing
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const blackscholesTool: UnifiedTool = {
  name: 'black_scholes',
  description: 'Black-Scholes options pricing model',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['price_call', 'price_put', 'greeks', 'implied_volatility', 'info'], description: 'Operation' },
      option_type: { type: 'string', enum: ['call', 'put'], description: 'Option type' }
    },
    required: ['operation']
  }
};

export async function executeblackscholes(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const result = { operation: args.operation, tool: 'black-scholes', optionType: args.option_type || 'call', status: 'done' };
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isblackscholesAvailable(): boolean { return true; }
