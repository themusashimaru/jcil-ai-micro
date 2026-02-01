/**
 * FOOD SCIENCE TOOL
 * Food processing and safety
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function waterActivity(p: number, p0: number): number { return p / p0; }
function ph(h: number): number { return -Math.log10(h); }
function pasteurization(d: number, t: number, logred: number): number { return d * logred * Math.pow(10, (t - 72) / 6); }
function shelfLife(k: number, t: number, q0: number, qmin: number): number { return Math.log(q0 / qmin) / (k * Math.exp(0.1 * (t - 4))); }
function calories(protein: number, fat: number, carbs: number): number { return protein * 4 + fat * 9 + carbs * 4; }
function brix(sugar: number, total: number): number { return sugar / total * 100; }
function freezingPoint(s: number, mw: number): number { return -1.86 * (s / mw) / (1 - s / 100); }

export const foodScienceTool: UnifiedTool = {
  name: 'food_science',
  description: 'Food: water_activity, ph, pasteurization, shelf_life, calories, brix, freezing_point',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['water_activity', 'ph', 'pasteurization', 'shelf_life', 'calories', 'brix', 'freezing_point'] }, p: { type: 'number' }, p0: { type: 'number' }, h: { type: 'number' }, d: { type: 'number' }, t: { type: 'number' }, logred: { type: 'number' }, k: { type: 'number' }, q0: { type: 'number' }, qmin: { type: 'number' }, protein: { type: 'number' }, fat: { type: 'number' }, carbs: { type: 'number' }, sugar: { type: 'number' }, total: { type: 'number' }, s: { type: 'number' }, mw: { type: 'number' } }, required: ['operation'] },
};

export async function executeFoodScience(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'water_activity': result = { aw: waterActivity(args.p || 23, args.p0 || 24) }; break;
      case 'ph': result = { pH: ph(args.h || 1e-7) }; break;
      case 'pasteurization': result = { time_sec: pasteurization(args.d || 0.25, args.t || 72, args.logred || 12) }; break;
      case 'shelf_life': result = { days: shelfLife(args.k || 0.1, args.t || 4, args.q0 || 100, args.qmin || 10) }; break;
      case 'calories': result = { kcal: calories(args.protein || 20, args.fat || 10, args.carbs || 50) }; break;
      case 'brix': result = { degrees: brix(args.sugar || 12, args.total || 100) }; break;
      case 'freezing_point': result = { celsius: freezingPoint(args.s || 10, args.mw || 342) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isFoodScienceAvailable(): boolean { return true; }
