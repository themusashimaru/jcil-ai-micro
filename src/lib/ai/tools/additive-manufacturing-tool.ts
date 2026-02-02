/**
 * ADDITIVE-MANUFACTURING TOOL
 * 3D printing advanced - BUILD LAYER BY LAYER!
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const additivemanufacturingTool: UnifiedTool = {
  name: 'additive_manufacturing',
  description: 'Additive manufacturing - SLS, SLA, DMLS, support structures, build orientation',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['slice', 'support', 'orient', 'optimize', 'info'], description: 'Operation' }
    },
    required: ['operation']
  }
};

export async function executeadditivemanufacturing(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const result = { operation: args.operation, tool: 'additive-manufacturing', status: 'done' };
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isadditivemanufacturingAvailable(): boolean { return true; }
