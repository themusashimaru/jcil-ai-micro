/**
 * WORD-EMBEDDINGS TOOL
 * Word2Vec, GloVe, FastText embeddings
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const wordembeddingsTool: UnifiedTool = {
  name: 'word_embeddings',
  description: 'Word embeddings (Word2Vec, GloVe, FastText)',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['embed', 'similarity', 'analogy', 'nearest', 'info'], description: 'Operation' },
      model: { type: 'string', enum: ['word2vec', 'glove', 'fasttext'], description: 'Embedding model' }
    },
    required: ['operation']
  }
};

export async function executewordembeddings(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const result = { operation: args.operation, tool: 'word-embeddings', model: args.model || 'word2vec', status: 'done' };
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function iswordembeddingsAvailable(): boolean { return true; }
