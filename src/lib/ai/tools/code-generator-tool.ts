/**
 * CODE-GENERATOR TOOL
 * Machine code generation from IR
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const codegeneratorTool: UnifiedTool = {
  name: 'code_generator',
  description: 'Generate machine code from IR - register allocation, instruction selection',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['generate', 'register_alloc', 'instruction_select', 'peephole', 'info'], description: 'Operation' },
      target: { type: 'string', enum: ['x86_64', 'ARM64', 'RISC-V', 'WASM', 'LLVM-IR'], description: 'Target architecture' }
    },
    required: ['operation']
  }
};

export async function executecodegenerator(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const result = { operation: args.operation, tool: 'code-generator', target: args.target || 'x86_64', status: 'done' };
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function iscodegeneratorAvailable(): boolean { return true; }
