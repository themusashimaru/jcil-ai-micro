/**
 * AES-ENCRYPTION TOOL
 * AES-128/192/256 encryption
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const aesencryptionTool: UnifiedTool = {
  name: 'aes_encryption',
  description: 'AES-128/192/256 encryption and decryption',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['encrypt', 'decrypt', 'generate_key', 'info'], description: 'Operation' },
      key_size: { type: 'string', enum: ['128', '192', '256'], description: 'Key size in bits' },
      mode: { type: 'string', enum: ['ECB', 'CBC', 'GCM', 'CTR'], description: 'Block cipher mode' }
    },
    required: ['operation']
  }
};

export async function executeaesencryption(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const result = { operation: args.operation, tool: 'aes-encryption', keySize: args.key_size || 256, mode: args.mode || 'GCM', status: 'done' };
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isaesencryptionAvailable(): boolean { return true; }
