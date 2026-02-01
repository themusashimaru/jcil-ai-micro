/**
 * BIOMEDICAL TOOL
 * Biomedical engineering calculations
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function heartRate(rr: number): number { return 60000 / rr; }
function cardiacOutput(sv: number, hr: number): number { return sv * hr / 1000; }
function bloodPressure(q: number, r: number): number { return q * r; }
function oxygenSaturation(hbO2: number, hb: number): number { return (hbO2 / (hbO2 + hb)) * 100; }
function bmi(weight: number, height: number): number { return weight / (height * height); }
function gfr(creatinine: number, age: number, weight: number): number { return (140 - age) * weight / (72 * creatinine); }
function drugHalfLife(t: number, c0: number, ct: number): number { return t * Math.log(2) / Math.log(c0 / ct); }

export const biomedicalTool: UnifiedTool = {
  name: 'biomedical',
  description: 'Biomedical: heart_rate, cardiac_output, blood_pressure, oxygen_sat, bmi, gfr, drug_halflife',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['heart_rate', 'cardiac_output', 'blood_pressure', 'oxygen_sat', 'bmi', 'gfr', 'drug_halflife'] }, rr: { type: 'number' }, sv: { type: 'number' }, hr: { type: 'number' }, q: { type: 'number' }, r: { type: 'number' }, hbO2: { type: 'number' }, hb: { type: 'number' }, weight: { type: 'number' }, height: { type: 'number' }, creatinine: { type: 'number' }, age: { type: 'number' }, t: { type: 'number' }, c0: { type: 'number' }, ct: { type: 'number' } }, required: ['operation'] },
};

export async function executeBiomedical(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'heart_rate': result = { bpm: heartRate(args.rr || 800) }; break;
      case 'cardiac_output': result = { CO_L_min: cardiacOutput(args.sv || 70, args.hr || 70) }; break;
      case 'blood_pressure': result = { pressure_mmHg: bloodPressure(args.q || 5, args.r || 20) }; break;
      case 'oxygen_sat': result = { SpO2_percent: oxygenSaturation(args.hbO2 || 97, args.hb || 3) }; break;
      case 'bmi': result = { bmi: bmi(args.weight || 70, args.height || 1.75) }; break;
      case 'gfr': result = { gfr_mL_min: gfr(args.creatinine || 1, args.age || 40, args.weight || 70) }; break;
      case 'drug_halflife': result = { halflife_hr: drugHalfLife(args.t || 4, args.c0 || 100, args.ct || 50) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isBiomedicalAvailable(): boolean { return true; }
