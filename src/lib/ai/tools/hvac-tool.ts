/**
 * HVAC TOOL
 * Heating, ventilation, air conditioning calculations
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function sensibleHeat(_Q: number, m: number, cp: number, dT: number): number { return m * cp * dT; }
function latentHeat(m: number, hfg: number): number { return m * hfg; }
function coolingLoad(U: number, A: number, dT: number): number { return U * A * dT; }
function cfm(volume: number, ach: number): number { return volume * ach / 60; }
function tonnage(Q: number): number { return Q / 12000; }
function seer(cooling: number, power: number): number { return cooling / power; }
function dewPointFromRH(T: number, RH: number): number { const a = 17.27, b = 237.7; const alpha = (a * T) / (b + T) + Math.log(RH / 100); return (b * alpha) / (a - alpha); }

export const hvacTool: UnifiedTool = {
  name: 'hvac',
  description: 'HVAC: sensible_heat, latent_heat, cooling_load, airflow_cfm, tonnage, seer, dew_point',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['sensible_heat', 'latent_heat', 'cooling_load', 'airflow_cfm', 'tonnage', 'seer', 'dew_point'] }, m: { type: 'number' }, cp: { type: 'number' }, dT: { type: 'number' }, hfg: { type: 'number' }, U: { type: 'number' }, A: { type: 'number' }, volume: { type: 'number' }, ach: { type: 'number' }, Q: { type: 'number' }, cooling: { type: 'number' }, power: { type: 'number' }, T: { type: 'number' }, RH: { type: 'number' } }, required: ['operation'] },
};

export async function executeHvac(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'sensible_heat': result = { Q_W: sensibleHeat(0, args.m || 1, args.cp || 1005, args.dT || 10) }; break;
      case 'latent_heat': result = { Q_W: latentHeat(args.m || 0.01, args.hfg || 2450000) }; break;
      case 'cooling_load': result = { Q_W: coolingLoad(args.U || 2, args.A || 100, args.dT || 15) }; break;
      case 'airflow_cfm': result = { cfm: cfm(args.volume || 5000, args.ach || 6) }; break;
      case 'tonnage': result = { tons: tonnage(args.Q || 36000) }; break;
      case 'seer': result = { seer: seer(args.cooling || 36000, args.power || 3000) }; break;
      case 'dew_point': result = { dew_point_C: Math.round(dewPointFromRH(args.T || 25, args.RH || 50) * 10) / 10 }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isHvacAvailable(): boolean { return true; }
