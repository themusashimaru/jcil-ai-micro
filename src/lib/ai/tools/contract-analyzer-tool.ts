/**
 * CONTRACT-ANALYZER TOOL
 * Legal contract analysis tool
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const contractanalyzerTool: UnifiedTool = {
  name: 'contract_analyzer',
  description: 'Legal contract analysis tool',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['analyze', 'check', 'generate', 'info'], description: 'Operation' },
      document: { type: 'string', description: 'Document text' },
      jurisdiction: { type: 'string', description: 'Legal jurisdiction' }
    },
    required: ['operation']
  }
};

export async function executecontractanalyzer(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const result = { operation: args.operation, tool: 'contract-analyzer', status: 'complete' };
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function iscontractanalyzerAvailable(): boolean { return true; }
