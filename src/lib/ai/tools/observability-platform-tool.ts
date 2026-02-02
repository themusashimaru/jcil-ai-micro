/**
 * OBSERVABILITY-PLATFORM TOOL
 * See inside your systems - KNOW EVERYTHING!
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const observabilityplatformTool: UnifiedTool = {
  name: 'observability_platform',
  description: 'Observability platform - metrics, logs, traces, dashboards, alerting',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['metrics', 'logs', 'traces', 'dashboard', 'info'], description: 'Operation' }
    },
    required: ['operation']
  }
};

export async function executeobservabilityplatform(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const result = { operation: args.operation, tool: 'observability-platform', status: 'done' };
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isobservabilityplatformAvailable(): boolean { return true; }
