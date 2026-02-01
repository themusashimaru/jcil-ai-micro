/**
 * RENEWABLE ENERGY TOOL
 * Solar, wind, hydro energy calculations
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function solarPower(area: number, eff: number, irradiance: number): number { return area * eff * irradiance; }
function windPower(rho: number, a: number, v: number, cp: number): number { return 0.5 * rho * a * Math.pow(v, 3) * cp; }
function hydroPower(rho: number, g: number, h: number, q: number, eff: number): number { return rho * g * h * q * eff; }
function solarAngle(lat: number, day: number): number { const dec = 23.45 * Math.sin(2 * Math.PI * (284 + day) / 365); return 90 - lat + dec; }
function capacityFactor(actual: number, rated: number, hours: number): number { return actual / (rated * hours); }
function paybackPeriod(cost: number, annual: number): number { return cost / annual; }
function lcoe(capex: number, opex: number, gen: number, years: number, r: number): number { let totCost = capex; for(let i=1;i<=years;i++) totCost += opex/Math.pow(1+r,i); let totGen = 0; for(let i=1;i<=years;i++) totGen += gen/Math.pow(1+r,i); return totCost/totGen; }

export const renewableEnergyTool: UnifiedTool = {
  name: 'renewable_energy',
  description: 'Renewables: solar_power, wind_power, hydro_power, solar_angle, capacity_factor, payback, lcoe',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['solar_power', 'wind_power', 'hydro_power', 'solar_angle', 'capacity_factor', 'payback', 'lcoe'] }, area: { type: 'number' }, eff: { type: 'number' }, irradiance: { type: 'number' }, rho: { type: 'number' }, a: { type: 'number' }, v: { type: 'number' }, cp: { type: 'number' }, g: { type: 'number' }, h: { type: 'number' }, q: { type: 'number' }, lat: { type: 'number' }, day: { type: 'number' }, actual: { type: 'number' }, rated: { type: 'number' }, hours: { type: 'number' }, cost: { type: 'number' }, annual: { type: 'number' }, capex: { type: 'number' }, opex: { type: 'number' }, gen: { type: 'number' }, years: { type: 'number' }, r: { type: 'number' } }, required: ['operation'] },
};

export async function executeRenewableEnergy(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'solar_power': result = { power_W: solarPower(args.area || 10, args.eff || 0.2, args.irradiance || 1000) }; break;
      case 'wind_power': result = { power_W: windPower(args.rho || 1.225, args.a || 5000, args.v || 10, args.cp || 0.4) }; break;
      case 'hydro_power': result = { power_W: hydroPower(args.rho || 1000, args.g || 9.81, args.h || 50, args.q || 10, args.eff || 0.85) }; break;
      case 'solar_angle': result = { elevation_deg: solarAngle(args.lat || 40, args.day || 172) }; break;
      case 'capacity_factor': result = { cf: capacityFactor(args.actual || 2e6, args.rated || 5e6, args.hours || 8760) }; break;
      case 'payback': result = { years: paybackPeriod(args.cost || 15000, args.annual || 2000) }; break;
      case 'lcoe': result = { cents_kWh: lcoe(args.capex || 1e6, args.opex || 20000, args.gen || 2e6, args.years || 25, args.r || 0.05) * 100 }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isRenewableEnergyAvailable(): boolean { return true; }
