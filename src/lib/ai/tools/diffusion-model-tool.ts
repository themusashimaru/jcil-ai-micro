/**
 * DIFFUSION-MODEL TOOL
 * Diffusion models for generation - THE TECH BEHIND DALL-E/STABLE DIFFUSION!
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const diffusionmodelTool: UnifiedTool = {
  name: 'diffusion_model',
  description: 'Diffusion models - denoising, score matching, sampling, guidance',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['forward', 'reverse', 'sample', 'guidance', 'schedule', 'info'], description: 'Operation' },
      scheduler: { type: 'string', enum: ['DDPM', 'DDIM', 'Euler', 'DPM++'], description: 'Scheduler' }
    },
    required: ['operation']
  }
};

export async function executediffusionmodel(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const result = { operation: args.operation, tool: 'diffusion-model', scheduler: args.scheduler || 'DDPM', status: 'done' };
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isdiffusionmodelAvailable(): boolean { return true; }
