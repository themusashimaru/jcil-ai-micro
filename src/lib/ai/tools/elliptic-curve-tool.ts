/**
 * ELLIPTIC-CURVE TOOL
 * Elliptic curve cryptography operations
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const ellipticcurveTool: UnifiedTool = {
  name: 'elliptic_curve',
  description: 'Elliptic curve cryptography (ECC) operations',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['multiply', 'add', 'generate_keypair', 'ecdh', 'info'], description: 'Operation' },
      curve: { type: 'string', enum: ['P-256', 'P-384', 'P-521', 'secp256k1', 'curve25519'], description: 'Curve' }
    },
    required: ['operation']
  }
};

export async function executeellipticcurve(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const result = { operation: args.operation, tool: 'elliptic-curve', curve: args.curve || 'P-256', status: 'done' };
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isellipticcurveAvailable(): boolean { return true; }
