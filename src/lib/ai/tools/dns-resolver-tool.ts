/**
 * DNS-RESOLVER TOOL
 * Comprehensive DNS resolution simulation with caching, DNSSEC, and zone analysis
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// DNS Record types
type RecordType = 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'NS' | 'SOA' | 'PTR' | 'SRV' | 'CAA' | 'DNSKEY' | 'DS' | 'RRSIG';

interface DNSRecord {
  name: string;
  type: RecordType;
  ttl: number;
  value: string;
  priority?: number; // For MX records
  weight?: number;   // For SRV records
  port?: number;     // For SRV records
}

// Simulated DNS zones
const DNS_ZONES: Record<string, DNSRecord[]> = {
  'example.com': [
    { name: 'example.com', type: 'A', ttl: 3600, value: '93.184.216.34' },
    { name: 'example.com', type: 'AAAA', ttl: 3600, value: '2606:2800:220:1:248:1893:25c8:1946' },
    { name: 'example.com', type: 'NS', ttl: 86400, value: 'ns1.example.com' },
    { name: 'example.com', type: 'NS', ttl: 86400, value: 'ns2.example.com' },
    { name: 'example.com', type: 'MX', ttl: 3600, value: 'mail.example.com', priority: 10 },
    { name: 'example.com', type: 'MX', ttl: 3600, value: 'backup.mail.example.com', priority: 20 },
    { name: 'example.com', type: 'TXT', ttl: 3600, value: 'v=spf1 include:_spf.example.com ~all' },
    { name: 'example.com', type: 'SOA', ttl: 86400, value: 'ns1.example.com hostmaster.example.com 2024010101 7200 3600 1209600 86400' },
    { name: 'www.example.com', type: 'CNAME', ttl: 3600, value: 'example.com' },
    { name: 'mail.example.com', type: 'A', ttl: 3600, value: '93.184.216.35' },
    { name: 'ns1.example.com', type: 'A', ttl: 86400, value: '93.184.216.1' },
    { name: 'ns2.example.com', type: 'A', ttl: 86400, value: '93.184.216.2' },
    { name: '_dmarc.example.com', type: 'TXT', ttl: 3600, value: 'v=DMARC1; p=reject; rua=mailto:dmarc@example.com' },
    { name: 'example.com', type: 'CAA', ttl: 3600, value: '0 issue "letsencrypt.org"' }
  ],
  'google.com': [
    { name: 'google.com', type: 'A', ttl: 300, value: '142.250.80.46' },
    { name: 'google.com', type: 'AAAA', ttl: 300, value: '2607:f8b0:4004:800::200e' },
    { name: 'google.com', type: 'NS', ttl: 86400, value: 'ns1.google.com' },
    { name: 'google.com', type: 'NS', ttl: 86400, value: 'ns2.google.com' },
    { name: 'google.com', type: 'MX', ttl: 600, value: 'smtp.google.com', priority: 10 },
    { name: 'www.google.com', type: 'A', ttl: 300, value: '142.250.80.68' },
    { name: '_sip._tcp.google.com', type: 'SRV', ttl: 300, value: 'sip.google.com', priority: 10, weight: 100, port: 5060 }
  ],
  'cloudflare.com': [
    { name: 'cloudflare.com', type: 'A', ttl: 300, value: '104.16.132.229' },
    { name: 'cloudflare.com', type: 'A', ttl: 300, value: '104.16.133.229' },
    { name: 'cloudflare.com', type: 'AAAA', ttl: 300, value: '2606:4700::6810:84e5' },
    { name: 'cloudflare.com', type: 'NS', ttl: 86400, value: 'ns3.cloudflare.com' },
    { name: 'cloudflare.com', type: 'NS', ttl: 86400, value: 'ns4.cloudflare.com' }
  ]
};

// Root servers
const ROOT_SERVERS: { name: string; ipv4: string; ipv6: string; operator: string }[] = [
  { name: 'a.root-servers.net', ipv4: '198.41.0.4', ipv6: '2001:503:ba3e::2:30', operator: 'Verisign' },
  { name: 'b.root-servers.net', ipv4: '170.247.170.2', ipv6: '2801:1b8:10::b', operator: 'USC-ISI' },
  { name: 'c.root-servers.net', ipv4: '192.33.4.12', ipv6: '2001:500:2::c', operator: 'Cogent' },
  { name: 'd.root-servers.net', ipv4: '199.7.91.13', ipv6: '2001:500:2d::d', operator: 'UMD' },
  { name: 'e.root-servers.net', ipv4: '192.203.230.10', ipv6: '2001:500:a8::e', operator: 'NASA' },
  { name: 'f.root-servers.net', ipv4: '192.5.5.241', ipv6: '2001:500:2f::f', operator: 'ISC' },
  { name: 'g.root-servers.net', ipv4: '192.112.36.4', ipv6: '2001:500:12::d0d', operator: 'Defense Information Systems Agency' },
  { name: 'h.root-servers.net', ipv4: '198.97.190.53', ipv6: '2001:500:1::53', operator: 'US Army' },
  { name: 'i.root-servers.net', ipv4: '192.36.148.17', ipv6: '2001:7fe::53', operator: 'Netnod' },
  { name: 'j.root-servers.net', ipv4: '192.58.128.30', ipv6: '2001:503:c27::2:30', operator: 'Verisign' },
  { name: 'k.root-servers.net', ipv4: '193.0.14.129', ipv6: '2001:7fd::1', operator: 'RIPE NCC' },
  { name: 'l.root-servers.net', ipv4: '199.7.83.42', ipv6: '2001:500:9f::42', operator: 'ICANN' },
  { name: 'm.root-servers.net', ipv4: '202.12.27.33', ipv6: '2001:dc3::35', operator: 'WIDE Project' }
];

// TLD servers
const TLD_SERVERS: Record<string, string[]> = {
  'com': ['a.gtld-servers.net', 'b.gtld-servers.net', 'c.gtld-servers.net'],
  'org': ['a0.org.afilias-nst.info', 'b0.org.afilias-nst.org', 'c0.org.afilias-nst.info'],
  'net': ['a.gtld-servers.net', 'b.gtld-servers.net', 'c.gtld-servers.net'],
  'io': ['ns-a1.io', 'ns-a2.io', 'ns-a3.io'],
  'dev': ['ns-tld1.charlestonroadregistry.com', 'ns-tld2.charlestonroadregistry.com']
};

// DNS cache simulation
interface CacheEntry {
  record: DNSRecord;
  expiresAt: number;
  hits: number;
}

// DNSSEC record types
interface DNSSECInfo {
  signed: boolean;
  algorithm: string;
  keyTag: number;
  digestType: string;
  validationStatus: 'secure' | 'insecure' | 'bogus' | 'indeterminate';
}

export const dnsresolverTool: UnifiedTool = {
  name: 'dns_resolver',
  description: 'Comprehensive DNS resolution simulation - recursive/iterative resolution, caching, zone transfers, DNSSEC validation',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['resolve', 'cache', 'zone_transfer', 'dnssec', 'trace', 'reverse', 'root_servers', 'info', 'examples'],
        description: 'Operation type'
      },
      domain: { type: 'string', description: 'Domain name to resolve' },
      record_type: { type: 'string', enum: ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SOA', 'PTR', 'SRV', 'CAA', 'ANY'], description: 'DNS record type' },
      mode: { type: 'string', enum: ['recursive', 'iterative'], description: 'Resolution mode' },
      ip_address: { type: 'string', description: 'IP address for reverse lookup' },
      use_cache: { type: 'boolean', description: 'Whether to use cached results' },
      nameserver: { type: 'string', description: 'Specific nameserver to query' }
    },
    required: ['operation']
  }
};

export async function executednsresolver(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'resolve':
        result = resolveDomain(args);
        break;

      case 'cache':
        result = simulateCache(args);
        break;

      case 'zone_transfer':
        result = simulateZoneTransfer(args);
        break;

      case 'dnssec':
        result = checkDNSSEC(args);
        break;

      case 'trace':
        result = traceDNS(args);
        break;

      case 'reverse':
        result = reverseLookup(args);
        break;

      case 'root_servers':
        result = getRootServers();
        break;

      case 'examples':
        result = getExamples();
        break;

      case 'info':
      default:
        result = getInfo();
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

function resolveDomain(args: Record<string, unknown>): Record<string, unknown> {
  const domain = (args.domain as string) || 'example.com';
  const recordType = (args.record_type as RecordType) || 'A';
  const mode = (args.mode as string) || 'recursive';
  const useCache = args.use_cache !== false;

  // Extract zone from domain
  const parts = domain.split('.');
  const zone = parts.slice(-2).join('.');

  const records = DNS_ZONES[zone] || [];
  const matchingRecords = records.filter(r =>
    r.name === domain && (recordType === 'ANY' || r.type === recordType)
  );

  // Handle CNAME chains
  const cnameRecords = records.filter(r => r.name === domain && r.type === 'CNAME');
  let resolvedRecords = [...matchingRecords];
  const cnameChain: string[] = [];

  if (cnameRecords.length > 0 && recordType !== 'CNAME') {
    const cname = cnameRecords[0];
    cnameChain.push(`${domain} -> ${cname.value}`);

    // Resolve the CNAME target
    const targetRecords = records.filter(r =>
      r.name === cname.value && r.type === recordType
    );
    resolvedRecords = [...resolvedRecords, ...targetRecords];
  }

  // Calculate response time simulation
  const baseLatency = mode === 'recursive' ? 20 : 80;
  const responseTime = baseLatency + Math.random() * 30;

  return {
    operation: 'resolve',
    query: {
      domain,
      type: recordType,
      class: 'IN',
      mode
    },
    answers: resolvedRecords.map(r => ({
      name: r.name,
      type: r.type,
      ttl: r.ttl,
      value: r.value,
      ...(r.priority !== undefined && { priority: r.priority }),
      ...(r.port !== undefined && { port: r.port })
    })),
    cname_chain: cnameChain.length > 0 ? cnameChain : undefined,
    authority: records
      .filter(r => r.type === 'NS')
      .slice(0, 2)
      .map(r => ({ name: zone, type: 'NS', ttl: r.ttl, value: r.value })),
    statistics: {
      response_time_ms: Number(responseTime.toFixed(2)),
      cache_hit: useCache && Math.random() > 0.5,
      recursion_available: mode === 'recursive',
      queries_made: mode === 'recursive' ? 1 : 3
    },
    flags: {
      qr: true,  // Query Response
      aa: false, // Authoritative Answer
      tc: false, // Truncated
      rd: true,  // Recursion Desired
      ra: mode === 'recursive', // Recursion Available
      ad: false, // Authenticated Data (DNSSEC)
      cd: false  // Checking Disabled
    }
  };
}

function simulateCache(args: Record<string, unknown>): Record<string, unknown> {
  const domain = (args.domain as string) || 'example.com';

  // Simulate cache entries
  const cacheEntries: CacheEntry[] = [];
  const now = Date.now();

  // Generate simulated cache from zones
  for (const [_zone, records] of Object.entries(DNS_ZONES)) {
    for (const record of records) {
      if (Math.random() > 0.3) { // 70% chance of being cached
        const timeInCache = Math.floor(Math.random() * record.ttl * 1000);
        cacheEntries.push({
          record,
          expiresAt: now + (record.ttl * 1000) - timeInCache,
          hits: Math.floor(Math.random() * 100)
        });
      }
    }
  }

  // Filter for requested domain if specified
  const filteredCache = domain
    ? cacheEntries.filter(e => e.record.name.includes(domain))
    : cacheEntries;

  // Calculate cache statistics
  const totalEntries = cacheEntries.length;
  const expiredCount = cacheEntries.filter(e => e.expiresAt < now).length;
  const avgTTL = cacheEntries.reduce((sum, e) => sum + e.record.ttl, 0) / totalEntries || 0;
  const totalHits = cacheEntries.reduce((sum, e) => sum + e.hits, 0);

  return {
    operation: 'cache',
    filter: domain || 'all',
    cache_entries: filteredCache.slice(0, 20).map(e => ({
      name: e.record.name,
      type: e.record.type,
      value: e.record.value,
      ttl_remaining: Math.max(0, Math.floor((e.expiresAt - now) / 1000)),
      hits: e.hits,
      expired: e.expiresAt < now
    })),
    statistics: {
      total_entries: totalEntries,
      active_entries: totalEntries - expiredCount,
      expired_entries: expiredCount,
      average_ttl_seconds: Math.round(avgTTL),
      total_cache_hits: totalHits,
      hit_rate_percent: Number(((totalHits / (totalHits + 100)) * 100).toFixed(1)),
      memory_usage_kb: Math.round(totalEntries * 0.2)
    },
    cache_policy: {
      max_entries: 10000,
      min_ttl: 60,
      max_ttl: 86400,
      negative_cache_ttl: 300,
      eviction_policy: 'LRU'
    }
  };
}

function simulateZoneTransfer(args: Record<string, unknown>): Record<string, unknown> {
  const domain = (args.domain as string) || 'example.com';

  // Extract zone
  const parts = domain.split('.');
  const zone = parts.slice(-2).join('.');

  const records = DNS_ZONES[zone];

  if (!records) {
    return {
      operation: 'zone_transfer',
      zone: zone,
      status: 'refused',
      error: 'Zone transfer refused or zone not found',
      security_note: 'Zone transfers (AXFR) should be restricted to authorized secondary nameservers'
    };
  }

  // Simulate AXFR response
  const soaRecord = records.find(r => r.type === 'SOA');

  return {
    operation: 'zone_transfer',
    transfer_type: 'AXFR',
    zone: zone,
    status: 'success',
    soa: soaRecord ? {
      mname: soaRecord.value.split(' ')[0],
      rname: soaRecord.value.split(' ')[1],
      serial: parseInt(soaRecord.value.split(' ')[2]),
      refresh: parseInt(soaRecord.value.split(' ')[3]),
      retry: parseInt(soaRecord.value.split(' ')[4]),
      expire: parseInt(soaRecord.value.split(' ')[5]),
      minimum: parseInt(soaRecord.value.split(' ')[6])
    } : null,
    records: records.map(r => ({
      name: r.name,
      type: r.type,
      ttl: r.ttl,
      value: r.value,
      ...(r.priority !== undefined && { priority: r.priority })
    })),
    statistics: {
      total_records: records.length,
      record_types: [...new Set(records.map(r => r.type))],
      transfer_size_bytes: JSON.stringify(records).length * 2
    },
    security: {
      tsig_signed: false,
      source_ip: '10.0.0.1',
      recommendation: 'Enable TSIG authentication for zone transfers'
    }
  };
}

function checkDNSSEC(args: Record<string, unknown>): Record<string, unknown> {
  const domain = (args.domain as string) || 'example.com';

  // Simulate DNSSEC validation
  const isSignedDomain = ['cloudflare.com', 'google.com'].some(d => domain.includes(d));

  const dnssecInfo: DNSSECInfo = isSignedDomain ? {
    signed: true,
    algorithm: 'ECDSAP256SHA256',
    keyTag: Math.floor(Math.random() * 65535),
    digestType: 'SHA-256',
    validationStatus: 'secure'
  } : {
    signed: false,
    algorithm: 'N/A',
    keyTag: 0,
    digestType: 'N/A',
    validationStatus: 'insecure'
  };

  return {
    operation: 'dnssec',
    domain,
    dnssec_enabled: dnssecInfo.signed,
    validation: {
      status: dnssecInfo.validationStatus,
      chain_of_trust: dnssecInfo.signed ? [
        { zone: '.', status: 'secure', key_tag: 20326 },
        { zone: 'com.', status: 'secure', key_tag: 30909 },
        { zone: domain, status: dnssecInfo.validationStatus, key_tag: dnssecInfo.keyTag }
      ] : [],
      authenticated_data: dnssecInfo.signed
    },
    keys: dnssecInfo.signed ? {
      ksk: {
        flags: 257,
        protocol: 3,
        algorithm: dnssecInfo.algorithm,
        key_tag: dnssecInfo.keyTag,
        key_type: 'Key Signing Key'
      },
      zsk: {
        flags: 256,
        protocol: 3,
        algorithm: dnssecInfo.algorithm,
        key_tag: dnssecInfo.keyTag + 1,
        key_type: 'Zone Signing Key'
      }
    } : null,
    ds_record: dnssecInfo.signed ? {
      key_tag: dnssecInfo.keyTag,
      algorithm: 13,
      digest_type: 2,
      digest: 'E06D44B80B8F1D39A95C0B0D7C65D08458E880409BBC683457104237C7F8EC8D'
    } : null,
    recommendations: dnssecInfo.signed ? [
      'DNSSEC is properly configured',
      'Consider implementing DANE for email security'
    ] : [
      'Enable DNSSEC to protect against DNS spoofing',
      'Generate KSK and ZSK key pairs',
      'Publish DS record in parent zone'
    ]
  };
}

function traceDNS(args: Record<string, unknown>): Record<string, unknown> {
  const domain = (args.domain as string) || 'www.example.com';
  const recordType = (args.record_type as RecordType) || 'A';

  const parts = domain.split('.');
  const tld = parts[parts.length - 1];
  const zone = parts.slice(-2).join('.');

  // Simulate iterative resolution trace
  const trace: { step: number; server: string; query: string; response: string; time_ms: number }[] = [];

  // Step 1: Query root server
  const rootServer = ROOT_SERVERS[Math.floor(Math.random() * ROOT_SERVERS.length)];
  trace.push({
    step: 1,
    server: `${rootServer.name} (${rootServer.ipv4})`,
    query: `${domain} ${recordType}`,
    response: `Referral to ${tld}. TLD servers`,
    time_ms: 15 + Math.random() * 10
  });

  // Step 2: Query TLD server
  const tldServers = TLD_SERVERS[tld] || ['unknown.tld-servers.net'];
  trace.push({
    step: 2,
    server: tldServers[0],
    query: `${domain} ${recordType}`,
    response: `Referral to ${zone} authoritative servers`,
    time_ms: 20 + Math.random() * 15
  });

  // Step 3: Query authoritative server
  const records = DNS_ZONES[zone] || [];
  const answer = records.find(r => r.name === domain && r.type === recordType);
  const nsRecord = records.find(r => r.type === 'NS');

  trace.push({
    step: 3,
    server: nsRecord?.value || `ns1.${zone}`,
    query: `${domain} ${recordType}`,
    response: answer ? `${answer.type} ${answer.value}` : 'NXDOMAIN',
    time_ms: 10 + Math.random() * 10
  });

  const totalTime = trace.reduce((sum, t) => sum + t.time_ms, 0);

  return {
    operation: 'trace',
    query: {
      domain,
      type: recordType
    },
    trace: trace.map(t => ({
      ...t,
      time_ms: Number(t.time_ms.toFixed(2))
    })),
    summary: {
      total_queries: trace.length,
      total_time_ms: Number(totalTime.toFixed(2)),
      final_answer: answer ? answer.value : 'NXDOMAIN',
      path: [
        'Root Server',
        `${tld.toUpperCase()} TLD Server`,
        `${zone} Authoritative Server`
      ]
    },
    explanation: `Iterative DNS resolution queries each level of the DNS hierarchy: root servers, TLD servers, and authoritative nameservers for the target domain.`
  };
}

function reverseLookup(args: Record<string, unknown>): Record<string, unknown> {
  const ip = (args.ip_address as string) || '93.184.216.34';

  // Generate reverse DNS name
  const isIPv6 = ip.includes(':');
  let ptrName: string;

  if (isIPv6) {
    // Expand IPv6 and reverse
    const expanded = expandIPv6(ip);
    const nibbles = expanded.replace(/:/g, '').split('').reverse().join('.');
    ptrName = `${nibbles}.ip6.arpa`;
  } else {
    const octets = ip.split('.').reverse().join('.');
    ptrName = `${octets}.in-addr.arpa`;
  }

  // Simulate PTR lookup
  const knownPTR: Record<string, string> = {
    '93.184.216.34': 'example.com',
    '142.250.80.46': 'lhr25s34-in-f14.1e100.net',
    '104.16.132.229': 'cloudflare.com',
    '8.8.8.8': 'dns.google',
    '1.1.1.1': 'one.one.one.one'
  };

  const hostname = knownPTR[ip];

  return {
    operation: 'reverse',
    query: {
      ip_address: ip,
      ptr_name: ptrName
    },
    result: hostname ? {
      hostname,
      verified: true,
      forward_confirmed: true
    } : {
      hostname: null,
      verified: false,
      error: 'No PTR record found'
    },
    fcrdns: hostname ? {
      forward_lookup: ip,
      reverse_lookup: hostname,
      match: true,
      status: 'Forward-confirmed reverse DNS (FCrDNS) validated'
    } : null,
    use_cases: [
      'Email server verification (SPF/DKIM)',
      'Security logging and forensics',
      'Network troubleshooting',
      'Anti-spam measures'
    ]
  };
}

function expandIPv6(ip: string): string {
  // Simple IPv6 expansion (handles :: notation)
  const parts = ip.split('::');
  if (parts.length === 1) {
    return ip;
  }

  const left = parts[0] ? parts[0].split(':') : [];
  const right = parts[1] ? parts[1].split(':') : [];
  const missing = 8 - left.length - right.length;
  const middle = Array(missing).fill('0000');

  return [...left, ...middle, ...right]
    .map(p => p.padStart(4, '0'))
    .join(':');
}

function getRootServers(): Record<string, unknown> {
  return {
    operation: 'root_servers',
    description: 'The 13 DNS root servers form the foundation of the DNS hierarchy',
    root_servers: ROOT_SERVERS.map(s => ({
      ...s,
      anycast: true,
      instances: Math.floor(Math.random() * 50) + 10
    })),
    statistics: {
      total_root_servers: 13,
      total_anycast_instances: '1500+',
      queries_per_day: '2+ trillion',
      governance: 'IANA/ICANN'
    },
    root_hints_file: 'named.root',
    priming_query: 'A query for . (root) to bootstrap resolver'
  };
}

function getExamples(): Record<string, unknown> {
  return {
    operation: 'examples',
    examples: [
      {
        name: 'Resolve A record',
        call: { operation: 'resolve', domain: 'example.com', record_type: 'A' }
      },
      {
        name: 'Get MX records',
        call: { operation: 'resolve', domain: 'google.com', record_type: 'MX' }
      },
      {
        name: 'DNS trace',
        call: { operation: 'trace', domain: 'www.example.com', record_type: 'A' }
      },
      {
        name: 'Check DNSSEC',
        call: { operation: 'dnssec', domain: 'cloudflare.com' }
      },
      {
        name: 'Reverse lookup',
        call: { operation: 'reverse', ip_address: '8.8.8.8' }
      },
      {
        name: 'View cache',
        call: { operation: 'cache', domain: 'example.com' }
      },
      {
        name: 'Zone transfer',
        call: { operation: 'zone_transfer', domain: 'example.com' }
      }
    ]
  };
}

function getInfo(): Record<string, unknown> {
  return {
    operation: 'info',
    tool: 'dns_resolver',
    description: 'Comprehensive DNS resolution simulation and analysis tool',
    capabilities: [
      'Domain name resolution (recursive and iterative)',
      'Multiple record types (A, AAAA, MX, TXT, NS, SOA, SRV, etc.)',
      'DNS trace showing resolution path',
      'DNSSEC validation simulation',
      'Reverse DNS (PTR) lookups',
      'DNS cache simulation and statistics',
      'Zone transfer (AXFR) simulation',
      'Root server information'
    ],
    record_types: ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SOA', 'PTR', 'SRV', 'CAA', 'DNSKEY', 'DS', 'RRSIG'],
    resolution_modes: {
      recursive: 'Server handles full resolution, returns final answer',
      iterative: 'Server returns referrals, client follows chain'
    },
    simulated_zones: Object.keys(DNS_ZONES),
    references: [
      'RFC 1034/1035 - Domain Names',
      'RFC 4033-4035 - DNSSEC',
      'RFC 5936 - AXFR Zone Transfer',
      'RFC 8484 - DNS over HTTPS'
    ]
  };
}

export function isdnsresolverAvailable(): boolean {
  return true;
}
