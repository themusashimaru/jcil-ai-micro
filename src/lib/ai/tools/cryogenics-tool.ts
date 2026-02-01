/**
 * CRYOGENICS TOOL
 * Low temperature science
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function boiloffRate(q: number, hv: number, rho: number): number { return q / (hv * rho); }
function heatLeak(k: number, a: number, dt: number, l: number): number { return k * a * dt / l; }
function thermalContraction(l: number, alpha: number, dt: number): number { return l * alpha * dt; }
function vaporizationPressure(p0: number, hv: number, r: number, t: number, t0: number): number { return p0 * Math.exp(-hv / r * (1/t - 1/t0)); }
function jouleThomson(cp: number, v: number, alpha: number, t: number): number { return (v / cp) * (alpha * t - 1); }
function magneticCooling(b1: number, b2: number, t1: number): number { return t1 * (b2 / b1); }
function superfluidDensity(t: number, tc: number): number { return Math.pow(1 - Math.pow(t/tc, 5.6), 1); }

export const cryogenicsTool: UnifiedTool = {
  name: 'cryogenics',
  description: 'Cryogenics: boiloff, heat_leak, contraction, vapor_pressure, joule_thomson, magnetic_cool, superfluid',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['boiloff', 'heat_leak', 'contraction', 'vapor_pressure', 'joule_thomson', 'magnetic_cool', 'superfluid'] }, q: { type: 'number' }, hv: { type: 'number' }, rho: { type: 'number' }, k: { type: 'number' }, a: { type: 'number' }, dt: { type: 'number' }, l: { type: 'number' }, alpha: { type: 'number' }, p0: { type: 'number' }, r: { type: 'number' }, t: { type: 'number' }, t0: { type: 'number' }, cp: { type: 'number' }, v: { type: 'number' }, b1: { type: 'number' }, b2: { type: 'number' }, t1: { type: 'number' }, tc: { type: 'number' } }, required: ['operation'] },
};

export async function executeCryogenics(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'boiloff': result = { L_hr: boiloffRate(args.q || 100, args.hv || 20900, args.rho || 70.8) * 3600 }; break;
      case 'heat_leak': result = { W: heatLeak(args.k || 0.01, args.a || 1, args.dt || 200, args.l || 0.1) }; break;
      case 'contraction': result = { mm: thermalContraction(args.l || 1, args.alpha || 1.2e-5, args.dt || 200) * 1000 }; break;
      case 'vapor_pressure': result = { Pa: vaporizationPressure(args.p0 || 101325, args.hv || 20900, args.r || 8.314, args.t || 77, args.t0 || 87) }; break;
      case 'joule_thomson': result = { K_MPa: jouleThomson(args.cp || 1000, args.v || 0.001, args.alpha || 0.003, args.t || 300) }; break;
      case 'magnetic_cool': result = { K: magneticCooling(args.b1 || 5, args.b2 || 0.1, args.t1 || 4) }; break;
      case 'superfluid': result = { fraction: superfluidDensity(args.t || 1.5, args.tc || 2.17) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isCryogenicsAvailable(): boolean { return true; }
