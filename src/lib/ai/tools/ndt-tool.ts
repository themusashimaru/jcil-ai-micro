/**
 * NDT TOOL
 * Non-destructive testing
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function utVelocity(e: number, rho: number, nu: number): number { return Math.sqrt(e * (1 - nu) / (rho * (1 + nu) * (1 - 2 * nu))); }
function utDepth(t: number, v: number): number { return v * t / 2; }
function rtExposure(i: number, t: number, d: number): number { return i * t / (d * d); }
function mtSensitivity(field: number, crack: number): number { return field * crack / 100; }
function ptDwellTime(visc: number, crack: number): number { return visc * crack / 10; }
function etLiftoff(freq: number, cond: number): number { return 1 / Math.sqrt(Math.PI * freq * 4e-7 * Math.PI * cond); }
function vtMagnification(fl: number, distance: number): number { return fl / (fl - distance); }

export const ndtTool: UnifiedTool = {
  name: 'ndt',
  description: 'NDT: ut_velocity, ut_depth, rt_exposure, mt_sensitivity, pt_dwell, et_liftoff, vt_magnification',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['ut_velocity', 'ut_depth', 'rt_exposure', 'mt_sensitivity', 'pt_dwell', 'et_liftoff', 'vt_magnification'] }, e: { type: 'number' }, rho: { type: 'number' }, nu: { type: 'number' }, t: { type: 'number' }, v: { type: 'number' }, i: { type: 'number' }, d: { type: 'number' }, field: { type: 'number' }, crack: { type: 'number' }, visc: { type: 'number' }, freq: { type: 'number' }, cond: { type: 'number' }, fl: { type: 'number' }, distance: { type: 'number' } }, required: ['operation'] },
};

export async function executeNdt(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'ut_velocity': result = { m_s: utVelocity(args.e || 2e11, args.rho || 7800, args.nu || 0.3) }; break;
      case 'ut_depth': result = { mm: utDepth(args.t || 50e-6, args.v || 5900) * 1000 }; break;
      case 'rt_exposure': result = { mA_min: rtExposure(args.i || 5, args.t || 2, args.d || 0.5) }; break;
      case 'mt_sensitivity': result = { gauss: mtSensitivity(args.field || 30, args.crack || 0.5) }; break;
      case 'pt_dwell': result = { min: ptDwellTime(args.visc || 10, args.crack || 0.3) }; break;
      case 'et_liftoff': result = { mm: etLiftoff(args.freq || 100000, args.cond || 1e7) * 1000 }; break;
      case 'vt_magnification': result = { x: vtMagnification(args.fl || 50, args.distance || 40) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isNdtAvailable(): boolean { return true; }
