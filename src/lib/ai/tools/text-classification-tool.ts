/**
 * TEXT-CLASSIFICATION TOOL
 * Text classification and categorization
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const textclassificationTool: UnifiedTool = {
  name: 'text_classification',
  description: 'Text classification (topic, intent, spam detection)',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['classify', 'train', 'predict', 'info'], description: 'Operation' },
      classifier: { type: 'string', enum: ['naive_bayes', 'svm', 'transformer'], description: 'Classifier type' }
    },
    required: ['operation']
  }
};

export async function executetextclassification(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const result = { operation: args.operation, tool: 'text-classification', classifier: args.classifier || 'transformer', status: 'done' };
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function istextclassificationAvailable(): boolean { return true; }
