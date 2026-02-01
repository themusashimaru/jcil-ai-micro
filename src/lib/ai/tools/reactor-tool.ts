/**
 * REACTOR DESIGN TOOL
 * Chemical reactors
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function batchTime(ca0: number, ca: number, k: number, order: number): number { return order === 1 ? Math.log(ca0/ca)/k : (1/ca - 1/ca0)/(k * (order - 1)); }
function cstrVolume(fa0: number, x: number, rate: number): number { return fa0 * x / rate; }
function pfrVolume(fa0: number, x: number, rate: number): number { return fa0 * x / rate; }
function spaceTime(v: number, q: number): number { return v / q; }
function conversion(ca0: number, ca: number): number { return (ca0 - ca) / ca0; }
function selectivity(rd: number, ru: number): number { return rd / ru; }
function yield_r(rd: number, ca0: number, ca: number): number { return rd / (ca0 - ca); }

export const reactorTool: UnifiedTool = {
  name: 'reactor',
  description: 'Reactor: batch_time, cstr_volume, pfr_volume, space_time, conversion, selectivity, yield',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['batch_time', 'cstr_volume', 'pfr_volume', 'space_time', 'conversion', 'selectivity', 'yield'] }, ca0: { type: 'number' }, ca: { type: 'number' }, k: { type: 'number' }, order: { type: 'number' }, fa0: { type: 'number' }, x: { type: 'number' }, rate: { type: 'number' }, v: { type: 'number' }, q: { type: 'number' }, rd: { type: 'number' }, ru: { type: 'number' } }, required: ['operation'] },
};

export async function executeReactor(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'batch_time': result = { min: batchTime(args.ca0 || 1, args.ca || 0.1, args.k || 0.1, args.order || 1) }; break;
      case 'cstr_volume': result = { L: cstrVolume(args.fa0 || 100, args.x || 0.9, args.rate || 10) }; break;
      case 'pfr_volume': result = { L: pfrVolume(args.fa0 || 100, args.x || 0.9, args.rate || 10) }; break;
      case 'space_time': result = { min: spaceTime(args.v || 1000, args.q || 100) }; break;
      case 'conversion': result = { X: conversion(args.ca0 || 1, args.ca || 0.1) }; break;
      case 'selectivity': result = { S: selectivity(args.rd || 8, args.ru || 2) }; break;
      case 'yield': result = { Y: yield_r(args.rd || 8, args.ca0 || 1, args.ca || 0.1) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isReactorAvailable(): boolean { return true; }
