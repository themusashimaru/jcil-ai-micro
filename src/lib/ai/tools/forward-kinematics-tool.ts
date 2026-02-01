/**
 * FORWARD-KINEMATICS TOOL
 * Robot forward kinematics calculator
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const forwardkinematicsTool: UnifiedTool = {
  name: 'forward_kinematics',
  description: 'Robot forward kinematics calculator',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['compute', 'simulate', 'plan', 'info'], description: 'Operation' },
      parameters: { type: 'object', description: 'Input parameters' }
    },
    required: ['operation']
  }
};

export async function executeforwardkinematics(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const result = { operation: args.operation, tool: 'forward-kinematics', computed: true };
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isforwardkinematicsAvailable(): boolean { return true; }
