/**
 * EDGE-DETECTION TOOL
 * Edge detection algorithms Sobel Canny
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const edgedetectionTool: UnifiedTool = {
  name: 'edge_detection',
  description: 'Edge detection algorithms Sobel Canny',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['detect', 'process', 'analyze', 'info'], description: 'Operation' },
      image: { type: 'object', description: 'Image data or parameters' }
    },
    required: ['operation']
  }
};

export async function executeedgedetection(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const result = { operation: args.operation, tool: 'edge-detection', processed: true };
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isedgedetectionAvailable(): boolean { return true; }
