/**
 * LASER TOOL
 * Laser processing calculations
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function spotSize(lambda: number, f: number, d: number): number { return 4 * lambda * f / (Math.PI * d); }
function powerDensity(p: number, r: number): number { return p / (Math.PI * r * r); }
function depthOfFocus(lambda: number, f: number, d: number): number { return 8 * lambda * f * f / (Math.PI * d * d); }
function cuttingSpeed(p: number, t: number, k: number): number { return p / (t * k); }
function keyhole(p: number, v: number, rho: number, cp: number, tm: number): number { return p / (v * rho * cp * tm); }
function haz(alpha: number, v: number): number { return Math.sqrt(4 * alpha / v); }
function absorptivity(n: number, k: number): number { return 4 * n / ((n + 1) * (n + 1) + k * k); }

export const laserTool: UnifiedTool = {
  name: 'laser',
  description: 'Laser: spot_size, power_density, dof, cutting_speed, keyhole, haz, absorptivity',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['spot_size', 'power_density', 'dof', 'cutting_speed', 'keyhole', 'haz', 'absorptivity'] }, lambda: { type: 'number' }, f: { type: 'number' }, d: { type: 'number' }, p: { type: 'number' }, r: { type: 'number' }, t: { type: 'number' }, k: { type: 'number' }, v: { type: 'number' }, rho: { type: 'number' }, cp: { type: 'number' }, tm: { type: 'number' }, alpha: { type: 'number' }, n: { type: 'number' } }, required: ['operation'] },
};

export async function executeLaser(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'spot_size': result = { um: spotSize(args.lambda || 1.06e-6, args.f || 100, args.d || 10) * 1e6 }; break;
      case 'power_density': result = { MW_cm2: powerDensity(args.p || 1000, args.r || 0.001) / 1e10 }; break;
      case 'dof': result = { mm: depthOfFocus(args.lambda || 1.06e-6, args.f || 100, args.d || 10) * 1000 }; break;
      case 'cutting_speed': result = { mm_s: cuttingSpeed(args.p || 1000, args.t || 5, args.k || 100) }; break;
      case 'keyhole': result = { depth_mm: keyhole(args.p || 1000, args.v || 0.01, args.rho || 7800, args.cp || 500, args.tm || 1500) * 1000 }; break;
      case 'haz': result = { mm: haz(args.alpha || 1e-5, args.v || 0.01) * 1000 }; break;
      case 'absorptivity': result = { percent: absorptivity(args.n || 3, args.k || 4) * 100 }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isLaserAvailable(): boolean { return true; }
