/**
 * TOXICOLOGY TOOL
 * Toxicity science
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function ld50(dose: number[], mortality: number[]): number { const mid = mortality.findIndex(m => m >= 50); return mid > 0 ? (dose[mid] + dose[mid - 1]) / 2 : dose[0]; }
function exposureMargin(noael: number, human: number): number { return noael / human; }
function hazardQuotient(exposure: number, reference: number): number { return exposure / reference; }
function bioconcentration(tissue: number, water: number): number { return tissue / water; }
function halfLife(c0: number, ct: number, t: number): number { return t * Math.log(2) / Math.log(c0 / ct); }
function doseResponse(d: number, ec50: number, n: number): number { return Math.pow(d, n) / (Math.pow(ec50, n) + Math.pow(d, n)) * 100; }
function adi(noael: number, sf: number): number { return noael / sf; }

export const toxicologyTool: UnifiedTool = {
  name: 'toxicology',
  description: 'Toxicology: ld50, exposure_margin, hazard_quotient, bcf, halflife, dose_response, adi',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['ld50', 'exposure_margin', 'hazard_quotient', 'bcf', 'halflife', 'dose_response', 'adi'] }, dose: { type: 'array' }, mortality: { type: 'array' }, noael: { type: 'number' }, human: { type: 'number' }, exposure: { type: 'number' }, reference: { type: 'number' }, tissue: { type: 'number' }, water: { type: 'number' }, c0: { type: 'number' }, ct: { type: 'number' }, t: { type: 'number' }, d: { type: 'number' }, ec50: { type: 'number' }, n: { type: 'number' }, sf: { type: 'number' } }, required: ['operation'] },
};

export async function executeToxicology(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'ld50': result = { mg_kg: ld50(args.dose || [10, 50, 100, 200], args.mortality || [0, 25, 60, 100]) }; break;
      case 'exposure_margin': result = { MoE: exposureMargin(args.noael || 100, args.human || 1) }; break;
      case 'hazard_quotient': result = { HQ: hazardQuotient(args.exposure || 0.5, args.reference || 1) }; break;
      case 'bcf': result = { BCF: bioconcentration(args.tissue || 100, args.water || 0.1) }; break;
      case 'halflife': result = { hours: halfLife(args.c0 || 100, args.ct || 50, args.t || 4) }; break;
      case 'dose_response': result = { effect_percent: doseResponse(args.d || 50, args.ec50 || 50, args.n || 1) }; break;
      case 'adi': result = { mg_kg_day: adi(args.noael || 10, args.sf || 100) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isToxicologyAvailable(): boolean { return true; }
