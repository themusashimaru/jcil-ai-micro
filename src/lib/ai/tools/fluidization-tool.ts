/**
 * FLUIDIZATION TOOL
 * Fluidized bed engineering
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function minFluidVel(dp: number, rhos: number, rhog: number, mu: number, g: number): number { return dp * dp * (rhos - rhog) * g / (1650 * mu); }
function terminalVel(dp: number, rhos: number, rhog: number, mu: number, g: number): number { const cd = 24 / (dp * rhog * 10 / mu); return Math.sqrt(4 * g * dp * (rhos - rhog) / (3 * cd * rhog)); }
function voidage(u: number, umf: number): number { return Math.pow(u / umf, 0.22) * 0.4; }
function bedExpansion(h0: number, eps: number, eps0: number): number { return h0 * (1 - eps0) / (1 - eps); }
function bubbleSize(u: number, umf: number, h: number): number { return 0.54 * Math.pow(u - umf, 0.4) * Math.pow(h + 4 * Math.sqrt((u - umf) / 0.711), 0.8) / Math.pow(9.81, 0.2); }
function elutriation(ki: number, a: number, u: number): number { return ki * a * u; }
function solidCirc(gs: number, a: number): number { return gs * a; }

export const fluidizationTool: UnifiedTool = {
  name: 'fluidization',
  description: 'Fluidization: min_vel, terminal_vel, voidage, expansion, bubble_size, elutriation, solid_circ',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['min_vel', 'terminal_vel', 'voidage', 'expansion', 'bubble_size', 'elutriation', 'solid_circ'] }, dp: { type: 'number' }, rhos: { type: 'number' }, rhog: { type: 'number' }, mu: { type: 'number' }, g: { type: 'number' }, u: { type: 'number' }, umf: { type: 'number' }, h0: { type: 'number' }, eps: { type: 'number' }, eps0: { type: 'number' }, h: { type: 'number' }, ki: { type: 'number' }, a: { type: 'number' }, gs: { type: 'number' } }, required: ['operation'] },
};

export async function executeFluidization(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'min_vel': result = { m_s: minFluidVel(args.dp || 0.0001, args.rhos || 2500, args.rhog || 1.2, args.mu || 1.8e-5, args.g || 9.81) }; break;
      case 'terminal_vel': result = { m_s: terminalVel(args.dp || 0.0001, args.rhos || 2500, args.rhog || 1.2, args.mu || 1.8e-5, args.g || 9.81) }; break;
      case 'voidage': result = { eps: voidage(args.u || 0.5, args.umf || 0.1) }; break;
      case 'expansion': result = { m: bedExpansion(args.h0 || 1, args.eps || 0.6, args.eps0 || 0.45) }; break;
      case 'bubble_size': result = { m: bubbleSize(args.u || 0.5, args.umf || 0.1, args.h || 1) }; break;
      case 'elutriation': result = { kg_s: elutriation(args.ki || 0.01, args.a || 1, args.u || 0.5) }; break;
      case 'solid_circ': result = { kg_s: solidCirc(args.gs || 50, args.a || 1) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isFluidizationAvailable(): boolean { return true; }
