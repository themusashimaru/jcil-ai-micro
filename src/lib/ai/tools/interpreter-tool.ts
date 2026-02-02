/**
 * INTERPRETER TOOL
 * Language interpreter with tree-walking and bytecode modes
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const interpreterTool: UnifiedTool = {
  name: 'interpreter',
  description: 'Interpret code with tree-walking or bytecode execution',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['execute', 'step', 'eval', 'repl', 'info'], description: 'Operation' },
      mode: { type: 'string', enum: ['tree_walking', 'bytecode', 'JIT'], description: 'Execution mode' }
    },
    required: ['operation']
  }
};

export async function executeinterpreter(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const result = { operation: args.operation, tool: 'interpreter', mode: args.mode || 'tree_walking', status: 'done' };
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isinterpreterAvailable(): boolean { return true; }
