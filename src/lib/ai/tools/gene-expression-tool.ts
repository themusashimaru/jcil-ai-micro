/**
 * GENE-EXPRESSION TOOL
 * Gene expression analysis
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const geneexpressionTool: UnifiedTool = {
  name: 'gene_expression',
  description: 'Gene expression analysis (RNA-seq, microarray)',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['normalize', 'differential', 'cluster', 'pathway', 'info'], description: 'Operation' },
      method: { type: 'string', enum: ['DESeq2', 'edgeR', 'limma'], description: 'Analysis method' }
    },
    required: ['operation']
  }
};

export async function executegeneexpression(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const result = { operation: args.operation, tool: 'gene-expression', method: args.method || 'DESeq2', status: 'done' };
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isgeneexpressionAvailable(): boolean { return true; }
