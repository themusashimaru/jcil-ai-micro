/**
 * HYDROLOGY TOOL
 * Water resources and hydrological calculations
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function rationalMethod(C: number, i: number, A: number): number { return C * i * A / 360; }
function manningFlow(n: number, A: number, R: number, S: number): number { return (1/n) * A * Math.pow(R, 2/3) * Math.sqrt(S); }
function darcyFlow(K: number, A: number, dh: number, dl: number): number { return K * A * (dh / dl); }
function unitHydrograph(tp: number, Qp: number, t: number): number { return Qp * Math.pow(t/tp, 3) * Math.exp(3 * (1 - t/tp)); }
function reservoirStorage(inflow: number, outflow: number, dt: number): number { return (inflow - outflow) * dt; }
function evapotranspiration(Tmax: number, Tmin: number, Ra: number): number { return 0.0023 * Ra * Math.sqrt(Tmax - Tmin) * ((Tmax + Tmin) / 2 + 17.8); }
function curveNumber(P: number, CN: number): number { const S = (25400/CN) - 254; const Ia = 0.2 * S; return P > Ia ? Math.pow(P - Ia, 2) / (P - Ia + S) : 0; }

export const hydrologyTool: UnifiedTool = {
  name: 'hydrology',
  description: 'Hydrology: rational_method, manning, darcy, unit_hydrograph, storage, ET, runoff_CN',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['rational_method', 'manning', 'darcy', 'unit_hydrograph', 'storage', 'evapotranspiration', 'runoff_cn'] }, C: { type: 'number' }, i: { type: 'number' }, A: { type: 'number' }, n: { type: 'number' }, R: { type: 'number' }, S: { type: 'number' }, K: { type: 'number' }, dh: { type: 'number' }, dl: { type: 'number' }, tp: { type: 'number' }, Qp: { type: 'number' }, t: { type: 'number' }, inflow: { type: 'number' }, outflow: { type: 'number' }, dt: { type: 'number' }, Tmax: { type: 'number' }, Tmin: { type: 'number' }, Ra: { type: 'number' }, P: { type: 'number' }, CN: { type: 'number' } }, required: ['operation'] },
};

export async function executeHydrology(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'rational_method': result = { Q_m3_s: rationalMethod(args.C || 0.7, args.i || 50, args.A || 10) }; break;
      case 'manning': result = { Q_m3_s: manningFlow(args.n || 0.03, args.A || 5, args.R || 0.5, args.S || 0.001) }; break;
      case 'darcy': result = { Q_m3_s: darcyFlow(args.K || 1e-5, args.A || 100, args.dh || 10, args.dl || 100) }; break;
      case 'unit_hydrograph': result = { Q_m3_s: unitHydrograph(args.tp || 2, args.Qp || 100, args.t || 1) }; break;
      case 'storage': result = { dS_m3: reservoirStorage(args.inflow || 100, args.outflow || 80, args.dt || 3600) }; break;
      case 'evapotranspiration': result = { ET_mm_day: evapotranspiration(args.Tmax || 30, args.Tmin || 15, args.Ra || 20) }; break;
      case 'runoff_cn': result = { Q_mm: curveNumber(args.P || 50, args.CN || 75) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isHydrologyAvailable(): boolean { return true; }
