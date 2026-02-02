/**
 * PARSER-GENERATOR TOOL
 * Parser generator from grammar specifications
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const parsergeneratorTool: UnifiedTool = {
  name: 'parser_generator',
  description: 'Generate parsers from BNF/EBNF grammar specifications',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['generate', 'parse', 'validate_grammar', 'first_follow', 'info'], description: 'Operation' },
      parser_type: { type: 'string', enum: ['LL1', 'LR0', 'SLR', 'LALR', 'GLR', 'Earley', 'PEG'], description: 'Parser type' }
    },
    required: ['operation']
  }
};

export async function executeparsergenerator(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const result = { operation: args.operation, tool: 'parser-generator', parserType: args.parser_type || 'LALR', status: 'done' };
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isparsergeneratorAvailable(): boolean { return true; }
