/**
 * TELECOMMUNICATIONS TOOL
 * Telecom and networking calculations
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function freeSpaceLoss(d: number, f: number): number { return 20 * Math.log10(d) + 20 * Math.log10(f) + 20 * Math.log10(4 * Math.PI / 3e8); }
function linkBudget(pt: number, gt: number, fsl: number, gr: number): number { return pt + gt - fsl + gr; }
function channelCapacity(b: number, snr: number): number { return b * Math.log2(1 + snr); }
function bitErrorRate(ebNo: number): number { return 0.5 * (1 - Math.sqrt(1 - Math.exp(-ebNo))); }
function dataRate(bandwidth: number, bits: number): number { return bandwidth * bits; }
function latency(distance: number, speed: number): number { return distance / speed * 1000; }
function throughput(packetSize: number, rtt: number, loss: number): number { return packetSize * 8 / (rtt * Math.sqrt(loss || 0.01)); }

export const telecommunicationsTool: UnifiedTool = {
  name: 'telecommunications',
  description: 'Telecom: free_space_loss, link_budget, shannon_capacity, ber, data_rate, latency, throughput',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['free_space_loss', 'link_budget', 'shannon_capacity', 'ber', 'data_rate', 'latency', 'throughput'] }, d: { type: 'number' }, f: { type: 'number' }, pt: { type: 'number' }, gt: { type: 'number' }, fsl: { type: 'number' }, gr: { type: 'number' }, b: { type: 'number' }, snr: { type: 'number' }, ebNo: { type: 'number' }, bandwidth: { type: 'number' }, bits: { type: 'number' }, distance: { type: 'number' }, speed: { type: 'number' }, packetSize: { type: 'number' }, rtt: { type: 'number' }, loss: { type: 'number' } }, required: ['operation'] },
};

export async function executeTelecommunications(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'free_space_loss': result = { loss_dB: freeSpaceLoss(args.d || 1000, args.f || 2.4e9) }; break;
      case 'link_budget': result = { rx_power_dBm: linkBudget(args.pt || 30, args.gt || 10, args.fsl || 100, args.gr || 10) }; break;
      case 'shannon_capacity': result = { capacity_bps: channelCapacity(args.b || 20e6, args.snr || 100) }; break;
      case 'ber': result = { ber: bitErrorRate(args.ebNo || 10) }; break;
      case 'data_rate': result = { rate_bps: dataRate(args.bandwidth || 20e6, args.bits || 6) }; break;
      case 'latency': result = { latency_ms: latency(args.distance || 1000, args.speed || 2e8) }; break;
      case 'throughput': result = { throughput_bps: throughput(args.packetSize || 1500, args.rtt || 0.1, args.loss || 0.01) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isTelecommunicationsAvailable(): boolean { return true; }
