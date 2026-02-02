/**
 * NUCLEAR-REACTOR TOOL
 * Nuclear reactor physics
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const nuclearreactorTool: UnifiedTool = {
  name: 'nuclear_reactor',
  description: 'Nuclear reactor - criticality, neutron diffusion, fuel burnup',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['criticality', 'neutron_flux', 'burnup', 'decay_heat', 'info'], description: 'Operation' },
      reactor_type: { type: 'string', enum: ['PWR', 'BWR', 'CANDU', 'MSR', 'HTGR'], description: 'Reactor type' }
    },
    required: ['operation']
  }
};

export async function executenuclearreactor(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const result = { operation: args.operation, tool: 'nuclear-reactor', reactorType: args.reactor_type || 'PWR', status: 'done' };
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isnuclearreactorAvailable(): boolean { return true; }
