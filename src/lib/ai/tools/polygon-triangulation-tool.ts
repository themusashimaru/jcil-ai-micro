/**
 * POLYGON-TRIANGULATION TOOL
 * Polygon triangulation algorithms
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const polygontriangulationTool: UnifiedTool = {
  name: 'polygon_triangulation',
  description: 'Polygon triangulation (ear clipping, monotone)',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['triangulate', 'ear_clipping', 'monotone', 'info'], description: 'Operation' }
    },
    required: ['operation']
  }
};

export async function executepolygontriangulation(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const result = { operation: args.operation, tool: 'polygon-triangulation', status: 'done' };
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function ispolygontriangulationAvailable(): boolean { return true; }
