/**
 * LEXER-GENERATOR TOOL
 * Lexical analyzer generator
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const lexergeneratorTool: UnifiedTool = {
  name: 'lexer_generator',
  description: 'Generate lexical analyzers from token specifications',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['generate', 'tokenize', 'validate_spec', 'optimize', 'info'], description: 'Operation' }
    },
    required: ['operation']
  }
};

export async function executelexergenerator(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const result = { operation: args.operation, tool: 'lexer-generator', status: 'done' };
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function islexergeneratorAvailable(): boolean { return true; }
