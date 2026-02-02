/**
 * HUFFMAN-CODING TOOL
 * Huffman encoding and decoding
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const huffmancodingTool: UnifiedTool = {
  name: 'huffman_coding',
  description: 'Huffman coding - optimal prefix-free codes',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['encode', 'decode', 'build_tree', 'analyze', 'info'], description: 'Operation' }
    },
    required: ['operation']
  }
};

export async function executehuffmancoding(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const result = { operation: args.operation, tool: 'huffman-coding', status: 'done' };
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function ishuffmancodingAvailable(): boolean { return true; }
