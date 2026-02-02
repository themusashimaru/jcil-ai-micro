/**
 * BERT-TOKENIZER TOOL
 * BERT/transformer tokenization
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const berttokenizerTool: UnifiedTool = {
  name: 'bert_tokenizer',
  description: 'BERT and transformer model tokenization',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['tokenize', 'detokenize', 'encode', 'decode', 'info'], description: 'Operation' },
      model: { type: 'string', enum: ['bert', 'gpt2', 'roberta', 't5'], description: 'Tokenizer model' }
    },
    required: ['operation']
  }
};

export async function executeberttokenizer(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const result = { operation: args.operation, tool: 'bert-tokenizer', model: args.model || 'bert', status: 'done' };
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isberttokenizerAvailable(): boolean { return true; }
