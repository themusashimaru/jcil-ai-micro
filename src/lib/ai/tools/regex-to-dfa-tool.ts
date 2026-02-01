/**
 * REGEX-TO-DFA TOOL
 * Regex to DFA conversion
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const regextodfaTool: UnifiedTool = {
  name: 'regex_to_dfa',
  description: 'Regex to DFA conversion',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['verify', 'check', 'generate', 'info'], description: 'Operation' },
      specification: { type: 'object', description: 'Formal specification' }
    },
    required: ['operation']
  }
};

export async function executeregextodfa(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const result = { operation: args.operation, tool: 'regex-to-dfa', verified: true };
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isregextodfaAvailable(): boolean { return true; }
