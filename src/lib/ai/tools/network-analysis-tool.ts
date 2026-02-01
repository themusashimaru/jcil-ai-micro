/**
 * NETWORK ANALYSIS TOOL
 *
 * Network calculations: IP addressing, subnetting, CIDR,
 * bandwidth, latency, and protocol analysis.
 *
 * Part of TIER CYBERSECURITY - Ultimate Tool Arsenal
 */
/* eslint-disable @typescript-eslint/no-unused-vars */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// IP ADDRESS UTILITIES
// ============================================================================

function ipToLong(ip: string): number {
  const parts = ip.split('.').map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function longToIp(long: number): string {
  return [
    (long >>> 24) & 255,
    (long >>> 16) & 255,
    (long >>> 8) & 255,
    long & 255,
  ].join('.');
}

function isValidIPv4(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  return parts.every(part => {
    const num = parseInt(part, 10);
    return !isNaN(num) && num >= 0 && num <= 255 && part === num.toString();
  });
}

// ============================================================================
// SUBNET CALCULATIONS
// ============================================================================

function cidrToSubnetMask(cidr: number): string {
  const mask = cidr === 0 ? 0 : (0xFFFFFFFF << (32 - cidr)) >>> 0;
  return longToIp(mask);
}

function subnetMaskToCidr(mask: string): number {
  const long = ipToLong(mask);
  let cidr = 0;
  let bit = 0x80000000;
  while (bit & long) {
    cidr++;
    bit >>>= 1;
  }
  return cidr;
}

function calculateSubnet(ip: string, cidr: number): {
  network: string;
  broadcast: string;
  firstHost: string;
  lastHost: string;
  totalHosts: number;
  usableHosts: number;
  subnetMask: string;
} {
  const ipLong = ipToLong(ip);
  const mask = cidr === 0 ? 0 : (0xFFFFFFFF << (32 - cidr)) >>> 0;
  const network = ipLong & mask;
  const broadcast = network | (~mask >>> 0);
  const totalHosts = Math.pow(2, 32 - cidr);
  const usableHosts = Math.max(0, totalHosts - 2);

  return {
    network: longToIp(network),
    broadcast: longToIp(broadcast),
    firstHost: longToIp(network + 1),
    lastHost: longToIp(broadcast - 1),
    totalHosts,
    usableHosts,
    subnetMask: cidrToSubnetMask(cidr),
  };
}

function _ipInSubnet(ip: string, network: string, cidr: number): boolean {
  const ipLong = ipToLong(ip);
  const netLong = ipToLong(network);
  const mask = cidr === 0 ? 0 : (0xFFFFFFFF << (32 - cidr)) >>> 0;
  return (ipLong & mask) === (netLong & mask);
}

// ============================================================================
// IP CLASSIFICATION
// ============================================================================

function classifyIP(ip: string): { class: string; type: string; purpose: string } {
  const first = parseInt(ip.split('.')[0], 10);
  const ipLong = ipToLong(ip);

  // Private ranges
  if (ipLong >= ipToLong('10.0.0.0') && ipLong <= ipToLong('10.255.255.255')) {
    return { class: 'A', type: 'Private', purpose: 'Large private networks (RFC 1918)' };
  }
  if (ipLong >= ipToLong('172.16.0.0') && ipLong <= ipToLong('172.31.255.255')) {
    return { class: 'B', type: 'Private', purpose: 'Medium private networks (RFC 1918)' };
  }
  if (ipLong >= ipToLong('192.168.0.0') && ipLong <= ipToLong('192.168.255.255')) {
    return { class: 'C', type: 'Private', purpose: 'Small private networks (RFC 1918)' };
  }
  if (ipLong >= ipToLong('127.0.0.0') && ipLong <= ipToLong('127.255.255.255')) {
    return { class: 'A', type: 'Loopback', purpose: 'Local host loopback' };
  }
  if (ipLong >= ipToLong('169.254.0.0') && ipLong <= ipToLong('169.254.255.255')) {
    return { class: 'B', type: 'Link-local', purpose: 'APIPA / Zeroconf' };
  }

  // Public classes
  if (first <= 127) return { class: 'A', type: 'Public', purpose: 'Large networks' };
  if (first <= 191) return { class: 'B', type: 'Public', purpose: 'Medium networks' };
  if (first <= 223) return { class: 'C', type: 'Public', purpose: 'Small networks' };
  if (first <= 239) return { class: 'D', type: 'Multicast', purpose: 'Multicast groups' };
  return { class: 'E', type: 'Reserved', purpose: 'Experimental' };
}

// ============================================================================
// BANDWIDTH CALCULATIONS
// ============================================================================

function transferTime(fileSize: number, bandwidth: number): number {
  // fileSize in bytes, bandwidth in Mbps, result in seconds
  const bitsPerSecond = bandwidth * 1000000;
  const fileBits = fileSize * 8;
  return fileBits / bitsPerSecond;
}

function _throughput(dataTransferred: number, time: number): number {
  // Returns Mbps
  return (dataTransferred * 8) / (time * 1000000);
}

function latencyImpact(bandwidth: number, latency: number, windowSize: number): number {
  // Effective throughput with TCP windowing
  // BDP = bandwidth * latency
  // BDP calculation: (bandwidth * 1000000 / 8) * (latency / 1000) bytes
  const effectiveBandwidth = Math.min(bandwidth, (windowSize * 8) / (latency / 1000) / 1000000);
  return effectiveBandwidth;
}

// ============================================================================
// PORT ANALYSIS
// ============================================================================

const COMMON_PORTS: Record<number, { service: string; protocol: string }> = {
  20: { service: 'FTP Data', protocol: 'TCP' },
  21: { service: 'FTP Control', protocol: 'TCP' },
  22: { service: 'SSH', protocol: 'TCP' },
  23: { service: 'Telnet', protocol: 'TCP' },
  25: { service: 'SMTP', protocol: 'TCP' },
  53: { service: 'DNS', protocol: 'TCP/UDP' },
  67: { service: 'DHCP Server', protocol: 'UDP' },
  68: { service: 'DHCP Client', protocol: 'UDP' },
  80: { service: 'HTTP', protocol: 'TCP' },
  110: { service: 'POP3', protocol: 'TCP' },
  143: { service: 'IMAP', protocol: 'TCP' },
  443: { service: 'HTTPS', protocol: 'TCP' },
  445: { service: 'SMB', protocol: 'TCP' },
  3306: { service: 'MySQL', protocol: 'TCP' },
  3389: { service: 'RDP', protocol: 'TCP' },
  5432: { service: 'PostgreSQL', protocol: 'TCP' },
  6379: { service: 'Redis', protocol: 'TCP' },
  8080: { service: 'HTTP Proxy', protocol: 'TCP' },
  27017: { service: 'MongoDB', protocol: 'TCP' },
};

function identifyPort(port: number): { service: string; protocol: string; category: string } {
  const info = COMMON_PORTS[port];
  let category = 'Dynamic/Private';
  if (port < 1024) category = 'Well-known';
  else if (port < 49152) category = 'Registered';

  return {
    service: info?.service || 'Unknown',
    protocol: info?.protocol || 'TCP/UDP',
    category,
  };
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const networkAnalysisTool: UnifiedTool = {
  name: 'network_analysis',
  description: `Network analysis and IP calculations.

Operations:
- subnet: Calculate subnet details from IP/CIDR
- classify: Classify IP address (class, type)
- bandwidth: Bandwidth and transfer calculations
- port: Port number identification
- convert: IP address conversions`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['subnet', 'classify', 'bandwidth', 'port', 'convert'],
        description: 'Network operation',
      },
      ip: { type: 'string', description: 'IP address' },
      cidr: { type: 'number', description: 'CIDR prefix length' },
      subnet_mask: { type: 'string', description: 'Subnet mask' },
      file_size: { type: 'number', description: 'File size in bytes' },
      bandwidth: { type: 'number', description: 'Bandwidth in Mbps' },
      latency: { type: 'number', description: 'Latency in milliseconds' },
      port: { type: 'number', description: 'Port number' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeNetworkAnalysis(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'subnet': {
        const { ip = '192.168.1.100', cidr = 24 } = args;

        if (!isValidIPv4(ip)) {
          throw new Error(`Invalid IPv4 address: ${ip}`);
        }

        const subnet = calculateSubnet(ip, cidr);
        const classification = classifyIP(ip);

        result = {
          operation: 'subnet',
          input: { ip, cidr },
          subnet_details: {
            network_address: subnet.network,
            broadcast_address: subnet.broadcast,
            subnet_mask: subnet.subnetMask,
            first_usable_host: subnet.firstHost,
            last_usable_host: subnet.lastHost,
            total_addresses: subnet.totalHosts,
            usable_hosts: subnet.usableHosts,
          },
          ip_classification: classification,
          cidr_notation: `${subnet.network}/${cidr}`,
        };
        break;
      }

      case 'classify': {
        const { ip = '8.8.8.8' } = args;

        if (!isValidIPv4(ip)) {
          throw new Error(`Invalid IPv4 address: ${ip}`);
        }

        const classification = classifyIP(ip);
        const ipLong = ipToLong(ip);

        result = {
          operation: 'classify',
          ip: ip,
          ip_decimal: ipLong,
          ip_binary: ipLong.toString(2).padStart(32, '0').match(/.{8}/g)?.join('.'),
          classification: classification,
          is_private: classification.type === 'Private',
          is_routable: classification.type === 'Public',
        };
        break;
      }

      case 'bandwidth': {
        const { file_size = 1073741824, bandwidth = 100, latency = 50 } = args; // 1GB default

        const transferSec = transferTime(file_size, bandwidth);
        const windowSize = 65535; // Default TCP window
        const effectiveBw = latencyImpact(bandwidth, latency, windowSize);

        const formatSize = (bytes: number): string => {
          if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
          if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(2)} MB`;
          if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(2)} KB`;
          return `${bytes} bytes`;
        };

        const formatTime = (sec: number): string => {
          if (sec >= 3600) return `${(sec / 3600).toFixed(2)} hours`;
          if (sec >= 60) return `${(sec / 60).toFixed(2)} minutes`;
          return `${sec.toFixed(2)} seconds`;
        };

        result = {
          operation: 'bandwidth',
          file_size: formatSize(file_size),
          file_size_bytes: file_size,
          bandwidth_mbps: bandwidth,
          theoretical_transfer_time: formatTime(transferSec),
          latency_ms: latency,
          bandwidth_delay_product_bytes: Math.round((bandwidth * 1000000 / 8) * (latency / 1000)),
          effective_bandwidth_with_latency_mbps: Math.round(effectiveBw * 100) / 100,
          tcp_window_size_bytes: windowSize,
          recommendation: latency > 100 ? 'High latency - consider TCP window scaling' : 'Normal latency',
        };
        break;
      }

      case 'port': {
        const { port = 443 } = args;

        if (port < 0 || port > 65535) {
          throw new Error('Port must be between 0 and 65535');
        }

        const portInfo = identifyPort(port);

        result = {
          operation: 'port',
          port: port,
          service: portInfo.service,
          protocol: portInfo.protocol,
          category: portInfo.category,
          port_range: port < 1024 ? 'Well-known (0-1023)' : port < 49152 ? 'Registered (1024-49151)' : 'Dynamic/Private (49152-65535)',
          common_ports: Object.entries(COMMON_PORTS).slice(0, 10).map(([p, info]) => ({
            port: Number(p),
            service: info.service,
          })),
        };
        break;
      }

      case 'convert': {
        const { ip = '192.168.1.1', subnet_mask } = args;

        if (!isValidIPv4(ip)) {
          throw new Error(`Invalid IPv4 address: ${ip}`);
        }

        const ipLong = ipToLong(ip);
        const ipBinary = ipLong.toString(2).padStart(32, '0');
        const ipHex = ipLong.toString(16).padStart(8, '0');

        const convertResult: Record<string, unknown> = {
          operation: 'convert',
          ip: ip,
          decimal: ipLong,
          binary: ipBinary.match(/.{8}/g)?.join('.'),
          hexadecimal: `0x${ipHex}`,
          octets: ip.split('.').map(Number),
        };

        if (subnet_mask) {
          convertResult.subnet_mask = {
            dotted_decimal: subnet_mask,
            cidr: subnetMaskToCidr(subnet_mask),
          };
        }

        result = convertResult;
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (error) {
    return { toolCallId: id, content: `Network Analysis Error: ${error instanceof Error ? error.message : 'Unknown'}`, isError: true };
  }
}

export function isNetworkAnalysisAvailable(): boolean { return true; }

// ESLint unused function references
void _ipInSubnet; void _throughput;
