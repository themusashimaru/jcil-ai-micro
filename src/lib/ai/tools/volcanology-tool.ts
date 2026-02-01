/**
 * VOLCANOLOGY TOOL
 * Volcanic science
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function vei(volume: number): number { return Math.floor(Math.log10(volume * 1e9) - 3); }
function lavaFlow(visc: number, slope: number, thick: number): number { return 9.81 * 2700 * thick * thick * Math.sin(slope * Math.PI / 180) / (3 * visc); }
function tephra(height: number): number { return Math.pow(height / 1000, 4) * 1e6; }
function pyroclasticDensity(_temp: number, gas: number): number { return 2500 * (1 - gas) + 0.5 * gas; }
function magmaViscosity(t: number, sio2: number, water: number): number { return Math.pow(10, (sio2 / 10 - water * 10 + 3000 / (t + 273) - 5)); }
function eruptionEnergy(mass: number, velocity: number): number { return 0.5 * mass * velocity * velocity; }
function lahaarVolume(rain: number, ash: number, area: number): number { return (rain + ash * 0.5) * area; }

export const volcanologyTool: UnifiedTool = {
  name: 'volcanology',
  description: 'Volcanology: vei, lava_flow, tephra, pyroclastic, viscosity, eruption_energy, lahaar',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['vei', 'lava_flow', 'tephra', 'pyroclastic', 'viscosity', 'eruption_energy', 'lahaar'] }, volume: { type: 'number' }, visc: { type: 'number' }, slope: { type: 'number' }, thick: { type: 'number' }, height: { type: 'number' }, temp: { type: 'number' }, gas: { type: 'number' }, t: { type: 'number' }, sio2: { type: 'number' }, water: { type: 'number' }, mass: { type: 'number' }, velocity: { type: 'number' }, rain: { type: 'number' }, ash: { type: 'number' }, area: { type: 'number' } }, required: ['operation'] },
};

export async function executeVolcanology(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'vei': result = { VEI: vei(args.volume || 1) }; break;
      case 'lava_flow': result = { m_s: lavaFlow(args.visc || 1000, args.slope || 10, args.thick || 5) }; break;
      case 'tephra': result = { m3: tephra(args.height || 15) }; break;
      case 'pyroclastic': result = { kg_m3: pyroclasticDensity(args.temp || 400, args.gas || 0.3) }; break;
      case 'viscosity': result = { Pa_s: magmaViscosity(args.t || 1100, args.sio2 || 60, args.water || 2) }; break;
      case 'eruption_energy': result = { J: eruptionEnergy(args.mass || 1e10, args.velocity || 200) }; break;
      case 'lahaar': result = { m3: lahaarVolume(args.rain || 0.1, args.ash || 0.5, args.area || 1e6) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isVolcanologyAvailable(): boolean { return true; }
