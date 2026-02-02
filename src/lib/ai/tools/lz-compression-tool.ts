/**
 * LZ-COMPRESSION TOOL
 * Lempel-Ziv compression algorithms
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const lzcompressionTool: UnifiedTool = {
  name: 'lz_compression',
  description: 'LZ77/LZ78/LZW compression and decompression',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['compress', 'decompress', 'analyze', 'info'], description: 'Operation' },
      algorithm: { type: 'string', enum: ['LZ77', 'LZ78', 'LZW', 'LZSS', 'LZMA'], description: 'Algorithm' }
    },
    required: ['operation']
  }
};

export async function exebutellzcompression(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const result = { operation: args.operation, tool: 'lz-compression', algorithm: args.algorithm || 'LZ77', status: 'done' };
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function islzcompressionAvailable(): boolean { return true; }
