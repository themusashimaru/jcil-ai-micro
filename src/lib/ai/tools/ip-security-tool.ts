/**
 * IP SECURITY TOOL
 * IP address security analysis
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

const PRIVATE_RANGES = [
  { start: '10.0.0.0', end: '10.255.255.255', name: 'Class A Private' },
  { start: '172.16.0.0', end: '172.31.255.255', name: 'Class B Private' },
  { start: '192.168.0.0', end: '192.168.255.255', name: 'Class C Private' },
  { start: '127.0.0.0', end: '127.255.255.255', name: 'Loopback' },
  { start: '169.254.0.0', end: '169.254.255.255', name: 'Link-Local' }
];

function ipToLong(ip: string): number { return ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct), 0) >>> 0; }
function longToIp(num: number): string { return [(num >>> 24) & 255, (num >>> 16) & 255, (num >>> 8) & 255, num & 255].join('.'); }
function isPrivate(ip: string): boolean { const n = ipToLong(ip); return PRIVATE_RANGES.some(r => n >= ipToLong(r.start) && n <= ipToLong(r.end)); }
function isValidIp(ip: string): boolean { const parts = ip.split('.'); return parts.length === 4 && parts.every(p => { const n = parseInt(p); return n >= 0 && n <= 255 && p === n.toString(); }); }
function ipRange(cidr: string): { start: string; end: string; count: number } { const [ip, mask] = cidr.split('/'); const m = parseInt(mask); const n = ipToLong(ip); const hostBits = 32 - m; const netMask = (0xFFFFFFFF << hostBits) >>> 0; const network = n & netMask; const broadcast = network | ((1 << hostBits) - 1); return { start: longToIp(network + 1), end: longToIp(broadcast - 1), count: (1 << hostBits) - 2 }; }
export function ipInRange(ip: string, cidr: string): boolean { const [base, mask] = cidr.split('/'); const m = parseInt(mask); return (ipToLong(ip) >>> (32 - m)) === (ipToLong(base) >>> (32 - m)); }

export const ipSecurityTool: UnifiedTool = {
  name: 'ip_security',
  description: 'IP security: validate, is_private, cidr_range, ip_to_long',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['validate', 'is_private', 'cidr_range', 'ip_to_long', 'long_to_ip', 'private_ranges'] }, ip: { type: 'string' }, cidr: { type: 'string' }, num: { type: 'number' } }, required: ['operation'] },
};

export async function executeIpSecurity(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'validate': result = { valid: isValidIp(args.ip || '') }; break;
      case 'is_private': result = { private: isPrivate(args.ip || '') }; break;
      case 'cidr_range': result = ipRange(args.cidr || '192.168.1.0/24'); break;
      case 'ip_to_long': result = { long: ipToLong(args.ip || '0.0.0.0') }; break;
      case 'long_to_ip': result = { ip: longToIp(args.num || 0) }; break;
      case 'private_ranges': result = { ranges: PRIVATE_RANGES }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isIpSecurityAvailable(): boolean { return true; }
