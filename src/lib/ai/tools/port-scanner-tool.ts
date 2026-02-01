/**
 * PORT SCANNER TOOL
 * Port analysis utilities (educational, no actual scanning)
 */
/* eslint-disable @typescript-eslint/no-unused-vars */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

const WELL_KNOWN_PORTS: Record<number, { service: string; protocol: string; risk: string }> = {
  20: { service: 'FTP Data', protocol: 'TCP', risk: 'medium' },
  21: { service: 'FTP Control', protocol: 'TCP', risk: 'high' },
  22: { service: 'SSH', protocol: 'TCP', risk: 'medium' },
  23: { service: 'Telnet', protocol: 'TCP', risk: 'critical' },
  25: { service: 'SMTP', protocol: 'TCP', risk: 'medium' },
  53: { service: 'DNS', protocol: 'TCP/UDP', risk: 'medium' },
  80: { service: 'HTTP', protocol: 'TCP', risk: 'medium' },
  110: { service: 'POP3', protocol: 'TCP', risk: 'high' },
  135: { service: 'RPC', protocol: 'TCP', risk: 'high' },
  139: { service: 'NetBIOS', protocol: 'TCP', risk: 'high' },
  143: { service: 'IMAP', protocol: 'TCP', risk: 'medium' },
  443: { service: 'HTTPS', protocol: 'TCP', risk: 'low' },
  445: { service: 'SMB', protocol: 'TCP', risk: 'critical' },
  1433: { service: 'MSSQL', protocol: 'TCP', risk: 'high' },
  1521: { service: 'Oracle', protocol: 'TCP', risk: 'high' },
  3306: { service: 'MySQL', protocol: 'TCP', risk: 'high' },
  3389: { service: 'RDP', protocol: 'TCP', risk: 'critical' },
  5432: { service: 'PostgreSQL', protocol: 'TCP', risk: 'high' },
  5900: { service: 'VNC', protocol: 'TCP', risk: 'critical' },
  6379: { service: 'Redis', protocol: 'TCP', risk: 'high' },
  8080: { service: 'HTTP Alt', protocol: 'TCP', risk: 'medium' },
  27017: { service: 'MongoDB', protocol: 'TCP', risk: 'high' }
};

function identifyPort(port: number): { service: string; protocol: string; risk: string; category: string } {
  const info = WELL_KNOWN_PORTS[port];
  let category = 'Dynamic';
  if (port < 1024) category = 'Well-known';
  else if (port < 49152) category = 'Registered';
  return { service: info?.service || 'Unknown', protocol: info?.protocol || 'Unknown', risk: info?.risk || 'unknown', category };
}

function getHighRiskPorts(): number[] {
  return Object.entries(WELL_KNOWN_PORTS).filter(([_, v]) => v.risk === 'critical' || v.risk === 'high').map(([k]) => parseInt(k));
}

function portRange(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export const portScannerTool: UnifiedTool = {
  name: 'port_scanner',
  description: 'Port analysis: identify, high_risk, common_ports, port_range (educational)',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['identify', 'high_risk', 'common_ports', 'port_range'] }, port: { type: 'number' }, start: { type: 'number' }, end: { type: 'number' } }, required: ['operation'] },
};

export async function executePortScanner(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'identify': result = identifyPort(args.port || 80); break;
      case 'high_risk': result = { ports: getHighRiskPorts() }; break;
      case 'common_ports': result = { ports: WELL_KNOWN_PORTS }; break;
      case 'port_range': result = { ports: portRange(args.start || 1, Math.min(args.end || 1024, 65535)) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isPortScannerAvailable(): boolean { return true; }
