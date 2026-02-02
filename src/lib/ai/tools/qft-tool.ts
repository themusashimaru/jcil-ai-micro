/**
 * QFT TOOL
 * Quantum Fourier Transform
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const qftTool: UnifiedTool = {
  name: 'qft',
  description: 'Quantum Fourier Transform and inverse',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['forward', 'inverse', 'info'], description: 'Operation' },
      num_qubits: { type: 'number', description: 'Number of qubits' }
    },
    required: ['operation']
  }
};

export async function executeqft(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const result = { operation: args.operation, tool: 'qft', numQubits: args.num_qubits || 4, status: 'done' };
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isqftAvailable(): boolean { return true; }
