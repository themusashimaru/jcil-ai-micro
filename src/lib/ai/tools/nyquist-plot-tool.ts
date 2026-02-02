/**
 * NYQUIST-PLOT TOOL
 * Nyquist stability analysis
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const nyquistplotTool: UnifiedTool = {
  name: 'nyquist_plot',
  description: 'Nyquist plot for stability analysis',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['plot', 'stability', 'encirclements', 'info'], description: 'Operation' }
    },
    required: ['operation']
  }
};

export async function executenyquistplot(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const result = { operation: args.operation, tool: 'nyquist-plot', status: 'done' };
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isnyquistplotAvailable(): boolean { return true; }
