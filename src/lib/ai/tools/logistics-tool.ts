/**
 * LOGISTICS TOOL
 * Supply chain and logistics calculations
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function eoq(d: number, s: number, h: number): number { return Math.sqrt(2 * d * s / h); }
function safetyStock(z: number, sigma: number, lt: number): number { return z * sigma * Math.sqrt(lt); }
function reorderPoint(d: number, lt: number, ss: number): number { return d * lt + ss; }
function inventoryTurnover(cogs: number, avgInv: number): number { return cogs / avgInv; }
function warehouseCapacity(l: number, w: number, h: number, util: number): number { return l * w * h * util; }
function orderFillRate(filled: number, total: number): number { return (filled / total) * 100; }
function daysOfSupply(inv: number, dailyDemand: number): number { return inv / dailyDemand; }

export const logisticsTool: UnifiedTool = {
  name: 'logistics',
  description: 'Logistics: eoq, safety_stock, reorder_point, turnover, warehouse_capacity, fill_rate, days_supply',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['eoq', 'safety_stock', 'reorder_point', 'turnover', 'warehouse_capacity', 'fill_rate', 'days_supply'] }, d: { type: 'number' }, s: { type: 'number' }, h: { type: 'number' }, z: { type: 'number' }, sigma: { type: 'number' }, lt: { type: 'number' }, ss: { type: 'number' }, cogs: { type: 'number' }, avgInv: { type: 'number' }, l: { type: 'number' }, w: { type: 'number' }, util: { type: 'number' }, filled: { type: 'number' }, total: { type: 'number' }, inv: { type: 'number' }, dailyDemand: { type: 'number' } }, required: ['operation'] },
};

export async function executeLogistics(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'eoq': result = { eoq_units: eoq(args.d || 10000, args.s || 50, args.h || 2) }; break;
      case 'safety_stock': result = { units: safetyStock(args.z || 1.65, args.sigma || 20, args.lt || 7) }; break;
      case 'reorder_point': result = { units: reorderPoint(args.d || 100, args.lt || 7, args.ss || 50) }; break;
      case 'turnover': result = { turns_yr: inventoryTurnover(args.cogs || 1000000, args.avgInv || 100000) }; break;
      case 'warehouse_capacity': result = { cubic_ft: warehouseCapacity(args.l || 100, args.w || 50, args.h || 20, args.util || 0.85) }; break;
      case 'fill_rate': result = { percent: orderFillRate(args.filled || 95, args.total || 100) }; break;
      case 'days_supply': result = { days: daysOfSupply(args.inv || 500, args.dailyDemand || 50) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isLogisticsAvailable(): boolean { return true; }
