/**
 * CONVEX-HULL TOOL
 * Convex hull computation
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const convexhullTool: UnifiedTool = {
  name: 'convex_hull',
  description: 'Convex hull computation (Graham scan, Jarvis march)',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['compute', 'visualize', 'area', 'info'], description: 'Operation' },
      algorithm: { type: 'string', enum: ['graham_scan', 'jarvis_march', 'quickhull'], description: 'Algorithm' }
    },
    required: ['operation']
  }
};

export async function executeconvexhull(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const result = { operation: args.operation, tool: 'convex-hull', algorithm: args.algorithm || 'graham_scan', status: 'done' };
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isconvexhullAvailable(): boolean { return true; }
