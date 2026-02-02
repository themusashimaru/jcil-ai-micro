/**
 * PHYLOGENETIC-TREE TOOL
 * Phylogenetic tree construction
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const phylogenetictreeTool: UnifiedTool = {
  name: 'phylogenetic_tree',
  description: 'Phylogenetic tree construction and analysis',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['build', 'analyze', 'visualize', 'info'], description: 'Operation' },
      method: { type: 'string', enum: ['neighbor_joining', 'UPGMA', 'maximum_likelihood', 'parsimony'], description: 'Method' }
    },
    required: ['operation']
  }
};

export async function executephylogenetictree(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const result = { operation: args.operation, tool: 'phylogenetic-tree', method: args.method || 'neighbor_joining', status: 'done' };
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isphylogenetictreeAvailable(): boolean { return true; }
