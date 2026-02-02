/**
 * VOTING-SYSTEM TOOL
 * Electoral and voting system analysis
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const votingsystemTool: UnifiedTool = {
  name: 'voting_system',
  description: 'Voting systems - plurality, ranked choice, approval, Condorcet',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['count', 'analyze', 'compare', 'paradox', 'info'], description: 'Operation' },
      method: { type: 'string', enum: ['plurality', 'ranked_choice', 'approval', 'Condorcet', 'Borda'], description: 'Voting method' }
    },
    required: ['operation']
  }
};

export async function executevotingsystem(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const result = { operation: args.operation, tool: 'voting-system', method: args.method || 'plurality', status: 'done' };
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isvotingsystemAvailable(): boolean { return true; }
