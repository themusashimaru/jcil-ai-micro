/**
 * CRYSTALLIZATION TOOL
 * Crystal engineering
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function supersaturation(c: number, cs: number): number { return (c - cs) / cs; }
function nucleationRate(a: number, b: number, s: number, t: number): number { return a * Math.exp(-b / (Math.pow(Math.log(1 + s), 2) * t * t)); }
function growthRate(kg: number, s: number, g: number): number { return kg * Math.pow(s, g); }
function crystalSize(g: number, tau: number): number { return 3 * g * tau; }
function populationDensity(n0: number, l: number, g: number, tau: number): number { return n0 * Math.exp(-l / (g * tau)); }
function magma(mt: number, v: number): number { return mt / v; }
function yield_c(ci: number, cf: number, mi: number): number { return (ci - cf) * mi / ci; }

export const crystallizationTool: UnifiedTool = {
  name: 'crystallization',
  description: 'Crystallization: supersaturation, nucleation, growth, size, population, magma, yield',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['supersaturation', 'nucleation', 'growth', 'size', 'population', 'magma', 'yield'] }, c: { type: 'number' }, cs: { type: 'number' }, a: { type: 'number' }, b: { type: 'number' }, s: { type: 'number' }, t: { type: 'number' }, kg: { type: 'number' }, g: { type: 'number' }, tau: { type: 'number' }, n0: { type: 'number' }, l: { type: 'number' }, mt: { type: 'number' }, v: { type: 'number' }, ci: { type: 'number' }, cf: { type: 'number' }, mi: { type: 'number' } }, required: ['operation'] },
};

export async function executeCrystallization(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'supersaturation': result = { S: supersaturation(args.c || 150, args.cs || 100) }; break;
      case 'nucleation': result = { per_m3_s: nucleationRate(args.a || 1e20, args.b || 10, args.s || 0.5, args.t || 300) }; break;
      case 'growth': result = { m_s: growthRate(args.kg || 1e-7, args.s || 0.5, args.g || 1.5) }; break;
      case 'size': result = { um: crystalSize(args.g || 1e-8, args.tau || 3600) * 1e6 }; break;
      case 'population': result = { per_m4: populationDensity(args.n0 || 1e12, args.l || 100e-6, args.g || 1e-8, args.tau || 3600) }; break;
      case 'magma': result = { kg_m3: magma(args.mt || 100, args.v || 1) }; break;
      case 'yield': result = { percent: yield_c(args.ci || 150, args.cf || 100, args.mi || 1000) / 10 }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isCrystallizationAvailable(): boolean { return true; }
