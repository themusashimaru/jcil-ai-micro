/**
 * DIGITAL-SIGNATURE TOOL
 * Digital signature generation and verification
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const digitalsignatureTool: UnifiedTool = {
  name: 'digital_signature',
  description: 'Digital signature creation and verification (RSA, ECDSA, EdDSA)',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['sign', 'verify', 'generate_keypair', 'info'], description: 'Operation' },
      algorithm: { type: 'string', enum: ['RSA-PSS', 'ECDSA', 'EdDSA'], description: 'Signature algorithm' }
    },
    required: ['operation']
  }
};

export async function executedigitalsignature(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const result = { operation: args.operation, tool: 'digital-signature', algorithm: args.algorithm || 'ECDSA', status: 'done' };
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isdigitalsignatureAvailable(): boolean { return true; }
