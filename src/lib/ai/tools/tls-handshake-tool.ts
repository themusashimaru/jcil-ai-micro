/**
 * TLS-HANDSHAKE TOOL
 * TLS/SSL handshake simulation and protocol analysis
 * Educational implementation of TLS 1.2 and TLS 1.3 protocols
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const tlshandshakeTool: UnifiedTool = {
  name: 'tls_handshake',
  description: 'TLS/SSL handshake simulation and analysis',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['simulate', 'analyze', 'compare_versions', 'cipher_info', 'info'],
        description: 'Operation to perform'
      },
      version: {
        type: 'string',
        enum: ['TLS1.2', 'TLS1.3', 'TLS1.1', 'TLS1.0'],
        description: 'TLS version (default: TLS1.3)'
      },
      cipher_suite: {
        type: 'string',
        description: 'Specific cipher suite to analyze'
      },
      client_hello: {
        type: 'object',
        description: 'Custom ClientHello parameters'
      }
    },
    required: ['operation']
  }
};

// Cipher suite definitions
interface CipherSuite {
  name: string;
  code: string;
  keyExchange: string;
  authentication: string;
  encryption: string;
  mac: string;
  pfs: boolean;
  strength: 'weak' | 'medium' | 'strong';
  tlsVersions: string[];
}

const CIPHER_SUITES: Record<string, CipherSuite> = {
  // TLS 1.3 cipher suites (no key exchange specified - always ECDHE or DHE)
  'TLS_AES_256_GCM_SHA384': {
    name: 'TLS_AES_256_GCM_SHA384',
    code: '0x1302',
    keyExchange: 'ECDHE/DHE',
    authentication: 'Certificate',
    encryption: 'AES-256-GCM',
    mac: 'AEAD',
    pfs: true,
    strength: 'strong',
    tlsVersions: ['TLS1.3']
  },
  'TLS_AES_128_GCM_SHA256': {
    name: 'TLS_AES_128_GCM_SHA256',
    code: '0x1301',
    keyExchange: 'ECDHE/DHE',
    authentication: 'Certificate',
    encryption: 'AES-128-GCM',
    mac: 'AEAD',
    pfs: true,
    strength: 'strong',
    tlsVersions: ['TLS1.3']
  },
  'TLS_CHACHA20_POLY1305_SHA256': {
    name: 'TLS_CHACHA20_POLY1305_SHA256',
    code: '0x1303',
    keyExchange: 'ECDHE/DHE',
    authentication: 'Certificate',
    encryption: 'ChaCha20-Poly1305',
    mac: 'AEAD',
    pfs: true,
    strength: 'strong',
    tlsVersions: ['TLS1.3']
  },
  // TLS 1.2 cipher suites
  'TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384': {
    name: 'TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384',
    code: '0xC030',
    keyExchange: 'ECDHE',
    authentication: 'RSA',
    encryption: 'AES-256-GCM',
    mac: 'AEAD',
    pfs: true,
    strength: 'strong',
    tlsVersions: ['TLS1.2']
  },
  'TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256': {
    name: 'TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256',
    code: '0xC02F',
    keyExchange: 'ECDHE',
    authentication: 'RSA',
    encryption: 'AES-128-GCM',
    mac: 'AEAD',
    pfs: true,
    strength: 'strong',
    tlsVersions: ['TLS1.2']
  },
  'TLS_RSA_WITH_AES_256_CBC_SHA256': {
    name: 'TLS_RSA_WITH_AES_256_CBC_SHA256',
    code: '0x003D',
    keyExchange: 'RSA',
    authentication: 'RSA',
    encryption: 'AES-256-CBC',
    mac: 'SHA256',
    pfs: false,
    strength: 'medium',
    tlsVersions: ['TLS1.2', 'TLS1.1', 'TLS1.0']
  },
  'TLS_RSA_WITH_AES_128_CBC_SHA': {
    name: 'TLS_RSA_WITH_AES_128_CBC_SHA',
    code: '0x002F',
    keyExchange: 'RSA',
    authentication: 'RSA',
    encryption: 'AES-128-CBC',
    mac: 'SHA1',
    pfs: false,
    strength: 'medium',
    tlsVersions: ['TLS1.2', 'TLS1.1', 'TLS1.0']
  },
  'TLS_RSA_WITH_3DES_EDE_CBC_SHA': {
    name: 'TLS_RSA_WITH_3DES_EDE_CBC_SHA',
    code: '0x000A',
    keyExchange: 'RSA',
    authentication: 'RSA',
    encryption: '3DES-CBC',
    mac: 'SHA1',
    pfs: false,
    strength: 'weak',
    tlsVersions: ['TLS1.2', 'TLS1.1', 'TLS1.0']
  }
};

// Generate random hex string
function randomHex(length: number): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * 16));
  }
  return result;
}

// Simulate TLS 1.3 handshake
function simulateTLS13Handshake(): {
  messages: Array<{ direction: string; name: string; contents: Record<string, any> }>;
  timeline: string[];
  keySchedule: Record<string, string>;
} {
  const clientRandom = randomHex(64);
  const serverRandom = randomHex(64);
  const sessionId = randomHex(64);

  const messages: Array<{ direction: string; name: string; contents: Record<string, any> }> = [];
  const timeline: string[] = [];

  // Client Hello
  messages.push({
    direction: 'Client → Server',
    name: 'ClientHello',
    contents: {
      version: 'TLS 1.2 (for compatibility)',
      supported_versions: ['TLS 1.3'],
      random: clientRandom,
      session_id: sessionId,
      cipher_suites: [
        'TLS_AES_256_GCM_SHA384',
        'TLS_AES_128_GCM_SHA256',
        'TLS_CHACHA20_POLY1305_SHA256'
      ],
      compression_methods: ['null'],
      extensions: {
        supported_versions: ['TLS 1.3'],
        signature_algorithms: ['ecdsa_secp256r1_sha256', 'rsa_pss_rsae_sha256'],
        supported_groups: ['x25519', 'secp256r1'],
        key_share: {
          group: 'x25519',
          key_exchange: randomHex(64)
        },
        psk_key_exchange_modes: ['psk_dhe_ke']
      }
    }
  });
  timeline.push('1. Client sends ClientHello with key_share extension (0-RTT supported)');

  // Server Hello
  messages.push({
    direction: 'Server → Client',
    name: 'ServerHello',
    contents: {
      version: 'TLS 1.2 (for compatibility)',
      random: serverRandom,
      session_id: sessionId,
      cipher_suite: 'TLS_AES_256_GCM_SHA384',
      compression_method: 'null',
      extensions: {
        supported_versions: 'TLS 1.3',
        key_share: {
          group: 'x25519',
          key_exchange: randomHex(64)
        }
      }
    }
  });
  timeline.push('2. Server sends ServerHello with key_share (handshake keys derived)');

  // Server sends encrypted extensions
  messages.push({
    direction: 'Server → Client',
    name: 'EncryptedExtensions',
    contents: {
      encrypted: true,
      extensions: {
        server_name: 'acknowledged',
        alpn: 'h2'
      }
    }
  });
  timeline.push('3. Server sends EncryptedExtensions (encrypted with handshake key)');

  // Certificate
  messages.push({
    direction: 'Server → Client',
    name: 'Certificate',
    contents: {
      encrypted: true,
      certificate_request_context: '',
      certificate_list: [
        { cert: 'server_certificate.pem', extensions: {} },
        { cert: 'intermediate_ca.pem', extensions: {} }
      ]
    }
  });
  timeline.push('4. Server sends Certificate (encrypted)');

  // Certificate Verify
  messages.push({
    direction: 'Server → Client',
    name: 'CertificateVerify',
    contents: {
      encrypted: true,
      algorithm: 'ecdsa_secp256r1_sha256',
      signature: randomHex(128)
    }
  });
  timeline.push('5. Server sends CertificateVerify (proves certificate ownership)');

  // Server Finished
  messages.push({
    direction: 'Server → Client',
    name: 'Finished',
    contents: {
      encrypted: true,
      verify_data: randomHex(64)
    }
  });
  timeline.push('6. Server sends Finished (verifies handshake integrity)');

  // Client Finished
  messages.push({
    direction: 'Client → Server',
    name: 'Finished',
    contents: {
      encrypted: true,
      verify_data: randomHex(64)
    }
  });
  timeline.push('7. Client sends Finished (handshake complete!)');

  // Application Data
  timeline.push('8. Application data can now be sent (encrypted with application keys)');

  // Key schedule
  const keySchedule = {
    early_secret: 'Derived from PSK (or zero)',
    handshake_secret: 'HKDF-Extract(early_secret, ECDHE_shared_secret)',
    client_handshake_traffic_secret: 'Derive-Secret(handshake_secret, "c hs traffic", ClientHello...ServerHello)',
    server_handshake_traffic_secret: 'Derive-Secret(handshake_secret, "s hs traffic", ClientHello...ServerHello)',
    master_secret: 'HKDF-Extract(handshake_secret, 0)',
    client_application_traffic_secret: 'Derive-Secret(master_secret, "c ap traffic", ClientHello...Finished)',
    server_application_traffic_secret: 'Derive-Secret(master_secret, "s ap traffic", ClientHello...Finished)'
  };

  return { messages, timeline, keySchedule };
}

// Simulate TLS 1.2 handshake
function simulateTLS12Handshake(): {
  messages: Array<{ direction: string; name: string; contents: Record<string, any> }>;
  timeline: string[];
  roundTrips: number;
} {
  const clientRandom = randomHex(64);
  const serverRandom = randomHex(64);
  const sessionId = randomHex(64);
  const preMasterSecret = randomHex(96);

  const messages: Array<{ direction: string; name: string; contents: Record<string, any> }> = [];
  const timeline: string[] = [];

  // Client Hello
  messages.push({
    direction: 'Client → Server',
    name: 'ClientHello',
    contents: {
      version: 'TLS 1.2',
      random: clientRandom,
      session_id: '',
      cipher_suites: [
        'TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384',
        'TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256',
        'TLS_RSA_WITH_AES_256_CBC_SHA256'
      ],
      compression_methods: ['null'],
      extensions: {
        server_name: 'example.com',
        supported_groups: ['secp256r1', 'secp384r1'],
        ec_point_formats: ['uncompressed'],
        signature_algorithms: ['rsa_pkcs1_sha256', 'ecdsa_secp256r1_sha256']
      }
    }
  });
  timeline.push('1. Client → Server: ClientHello');

  // Server Hello
  messages.push({
    direction: 'Server → Client',
    name: 'ServerHello',
    contents: {
      version: 'TLS 1.2',
      random: serverRandom,
      session_id: sessionId,
      cipher_suite: 'TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384',
      compression_method: 'null',
      extensions: {
        renegotiation_info: ''
      }
    }
  });
  timeline.push('2. Server → Client: ServerHello');

  // Certificate
  messages.push({
    direction: 'Server → Client',
    name: 'Certificate',
    contents: {
      certificate_list: ['server.crt', 'intermediate.crt']
    }
  });
  timeline.push('3. Server → Client: Certificate');

  // Server Key Exchange (for ECDHE)
  messages.push({
    direction: 'Server → Client',
    name: 'ServerKeyExchange',
    contents: {
      curve_type: 'named_curve',
      named_curve: 'secp256r1',
      public_key: randomHex(130),
      signature_algorithm: 'rsa_pkcs1_sha256',
      signature: randomHex(512)
    }
  });
  timeline.push('4. Server → Client: ServerKeyExchange (ECDHE params)');

  // Server Hello Done
  messages.push({
    direction: 'Server → Client',
    name: 'ServerHelloDone',
    contents: {}
  });
  timeline.push('5. Server → Client: ServerHelloDone');

  // Client Key Exchange
  messages.push({
    direction: 'Client → Server',
    name: 'ClientKeyExchange',
    contents: {
      public_key: randomHex(130)
    }
  });
  timeline.push('6. Client → Server: ClientKeyExchange');

  // Change Cipher Spec (Client)
  messages.push({
    direction: 'Client → Server',
    name: 'ChangeCipherSpec',
    contents: {
      type: 1
    }
  });
  timeline.push('7. Client → Server: ChangeCipherSpec');

  // Finished (Client)
  messages.push({
    direction: 'Client → Server',
    name: 'Finished',
    contents: {
      verify_data: randomHex(24)
    }
  });
  timeline.push('8. Client → Server: Finished (encrypted)');

  // Change Cipher Spec (Server)
  messages.push({
    direction: 'Server → Client',
    name: 'ChangeCipherSpec',
    contents: {
      type: 1
    }
  });
  timeline.push('9. Server → Client: ChangeCipherSpec');

  // Finished (Server)
  messages.push({
    direction: 'Server → Client',
    name: 'Finished',
    contents: {
      verify_data: randomHex(24)
    }
  });
  timeline.push('10. Server → Client: Finished (encrypted)');

  timeline.push('11. Handshake complete - Application data can be sent');

  return { messages, timeline, roundTrips: 2 };
}

// Generate handshake diagram
function generateHandshakeDiagram(version: string): string {
  if (version === 'TLS1.3') {
    return [
      'TLS 1.3 Handshake (1-RTT)',
      '========================',
      '',
      'Client                                           Server',
      '  │                                                 │',
      '  │  ClientHello                                    │',
      '  │  + key_share                                    │',
      '  │  + signature_algorithms                         │',
      '  │  + supported_versions                           │',
      '  │ ─────────────────────────────────────────────▶  │',
      '  │                                                 │',
      '  │                            ServerHello          │',
      '  │                            + key_share          │',
      '  │                            + supported_versions │',
      '  │                    {EncryptedExtensions}        │',
      '  │                    {Certificate}                │',
      '  │                    {CertificateVerify}          │',
      '  │                    {Finished}                   │',
      '  │  ◀─────────────────────────────────────────────│',
      '  │                                                 │',
      '  │  {Finished}                                     │',
      '  │ ─────────────────────────────────────────────▶  │',
      '  │                                                 │',
      '  │  [Application Data]    ◀───────────────────▶    │',
      '  │                                                 │',
      '',
      'Legend: {} = encrypted with handshake keys',
      '        [] = encrypted with application keys',
      '',
      'Key insight: Server sends certificate encrypted!',
      'Total round trips: 1 (vs 2 in TLS 1.2)'
    ].join('\n');
  } else {
    return [
      'TLS 1.2 Handshake (2-RTT)',
      '========================',
      '',
      'Client                                           Server',
      '  │                                                 │',
      '  │  ClientHello                                    │',
      '  │ ─────────────────────────────────────────────▶  │',
      '  │                                                 │',
      '  │                              ServerHello        │',
      '  │                              Certificate        │',
      '  │                              ServerKeyExchange  │',
      '  │                              ServerHelloDone    │',
      '  │  ◀─────────────────────────────────────────────│',
      '  │                                                 │',
      '  │  ClientKeyExchange                              │',
      '  │  ChangeCipherSpec                               │',
      '  │  Finished                                       │',
      '  │ ─────────────────────────────────────────────▶  │',
      '  │                                                 │',
      '  │                              ChangeCipherSpec   │',
      '  │                              Finished           │',
      '  │  ◀─────────────────────────────────────────────│',
      '  │                                                 │',
      '  │  [Application Data]    ◀───────────────────▶    │',
      '  │                                                 │',
      '',
      'Note: Certificate sent in clear! (privacy concern)',
      'Total round trips: 2'
    ].join('\n');
  }
}

export async function executetlshandshake(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, version = 'TLS1.3', cipher_suite } = args;

    if (operation === 'info') {
      const info = {
        tool: 'tls_handshake',
        description: 'TLS (Transport Layer Security) handshake simulation and analysis',
        purpose: 'Establish secure encrypted connection between client and server',
        versions: {
          'TLS 1.3': {
            status: 'CURRENT - Recommended',
            rfc: 'RFC 8446 (2018)',
            round_trips: '1-RTT (0-RTT with resumption)',
            improvements: [
              'Faster handshake (1 round trip)',
              'Encrypted certificates (privacy)',
              'Removed insecure features (RSA key exchange, CBC, etc.)',
              'Simplified cipher suites',
              'Forward secrecy mandatory'
            ]
          },
          'TLS 1.2': {
            status: 'LEGACY - Still widely supported',
            rfc: 'RFC 5246 (2008)',
            round_trips: '2-RTT',
            notes: 'Disable RSA key exchange, use ECDHE only'
          },
          'TLS 1.1': {
            status: 'DEPRECATED - Do not use',
            rfc: 'RFC 4346 (2006)'
          },
          'TLS 1.0': {
            status: 'DEPRECATED - Do not use',
            rfc: 'RFC 2246 (1999)'
          }
        },
        handshake_goals: {
          authentication: 'Verify server (and optionally client) identity',
          key_exchange: 'Securely establish shared secret',
          cipher_negotiation: 'Agree on encryption algorithm',
          integrity: 'Verify handshake was not tampered'
        },
        key_concepts: {
          cipher_suite: 'Combination of key exchange, authentication, encryption, MAC',
          forward_secrecy: 'Compromised long-term key cannot decrypt past sessions',
          certificate_chain: 'Trust hierarchy from root CA to server certificate',
          session_resumption: 'Skip full handshake for repeated connections'
        },
        operations: ['simulate', 'analyze', 'compare_versions', 'cipher_info']
      };
      return { toolCallId: id, content: JSON.stringify(info, null, 2) };
    }

    if (operation === 'simulate') {
      let handshake;

      if (version === 'TLS1.3') {
        const sim = simulateTLS13Handshake();
        handshake = {
          version: 'TLS 1.3',
          round_trips: 1,
          messages: sim.messages,
          timeline: sim.timeline,
          key_schedule: sim.keySchedule,
          diagram: generateHandshakeDiagram('TLS1.3'),
          security_properties: {
            forward_secrecy: true,
            encrypted_certificate: true,
            0_rtt_support: true,
            downgrade_protection: true
          }
        };
      } else {
        const sim = simulateTLS12Handshake();
        handshake = {
          version: 'TLS 1.2',
          round_trips: sim.roundTrips,
          messages: sim.messages,
          timeline: sim.timeline,
          diagram: generateHandshakeDiagram('TLS1.2'),
          security_properties: {
            forward_secrecy: 'Only with ECDHE/DHE cipher suites',
            encrypted_certificate: false,
            session_resumption: true
          }
        };
      }

      const result = {
        operation: 'simulate',
        ...handshake
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    if (operation === 'compare_versions') {
      const comparison = {
        operation: 'compare_versions',
        versions: {
          'TLS 1.3': {
            handshake_round_trips: 1,
            zero_rtt: 'Yes (with PSK)',
            forward_secrecy: 'Mandatory',
            cipher_suites: '5 (all AEAD)',
            rsa_key_exchange: 'Removed',
            cbc_mode: 'Removed',
            compression: 'Removed',
            renegotiation: 'Removed',
            certificate_encryption: 'Encrypted',
            recommended: true
          },
          'TLS 1.2': {
            handshake_round_trips: 2,
            zero_rtt: 'No',
            forward_secrecy: 'Optional (ECDHE/DHE)',
            cipher_suites: '300+ (many insecure)',
            rsa_key_exchange: 'Available (not recommended)',
            cbc_mode: 'Available (vulnerable to BEAST/POODLE)',
            compression: 'Available (vulnerable to CRIME)',
            renegotiation: 'Available (security issues)',
            certificate_encryption: 'Plaintext',
            recommended: 'Only with ECDHE + AEAD'
          }
        },
        removed_in_tls13: [
          'RSA key exchange (no forward secrecy)',
          'Static DH/ECDH (no forward secrecy)',
          'CBC mode ciphers (padding oracle attacks)',
          'RC4, 3DES, MD5, SHA1 in cipher suites',
          'Compression (CRIME attack)',
          'Renegotiation (various attacks)',
          'ChangeCipherSpec message',
          'DSA certificates'
        ],
        latency_comparison: {
          description: 'Time to first application data byte',
          'TLS 1.2': '2 × RTT',
          'TLS 1.3': '1 × RTT',
          'TLS 1.3 0-RTT': '0 × RTT (with replay risk)',
          example: 'RTT = 100ms → TLS 1.2: 200ms, TLS 1.3: 100ms'
        },
        migration_recommendation: 'Enable TLS 1.3 while keeping TLS 1.2 for compatibility. Disable TLS 1.1 and below.'
      };

      return { toolCallId: id, content: JSON.stringify(comparison, null, 2) };
    }

    if (operation === 'cipher_info') {
      if (cipher_suite && CIPHER_SUITES[cipher_suite]) {
        const suite = CIPHER_SUITES[cipher_suite];
        const result = {
          operation: 'cipher_info',
          cipher_suite: suite,
          analysis: {
            forward_secrecy: suite.pfs ? '✓ Yes - past sessions safe if key compromised' : '✗ No - compromised key decrypts all sessions',
            strength_rating: suite.strength,
            recommendation: suite.strength === 'strong' ? 'Recommended' : suite.strength === 'medium' ? 'Use only if necessary' : 'Do not use'
          }
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      // List all cipher suites
      const suitesByStrength: Record<string, string[]> = { strong: [], medium: [], weak: [] };
      for (const [name, suite] of Object.entries(CIPHER_SUITES)) {
        suitesByStrength[suite.strength].push(name);
      }

      const result = {
        operation: 'cipher_info',
        cipher_suites_by_strength: suitesByStrength,
        all_suites: Object.entries(CIPHER_SUITES).map(([name, suite]) => ({
          name,
          code: suite.code,
          key_exchange: suite.keyExchange,
          encryption: suite.encryption,
          pfs: suite.pfs,
          strength: suite.strength,
          tls_versions: suite.tlsVersions
        })),
        recommended_order: [
          'TLS_AES_256_GCM_SHA384',
          'TLS_CHACHA20_POLY1305_SHA256',
          'TLS_AES_128_GCM_SHA256',
          'TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384',
          'TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256'
        ],
        cipher_suite_components: {
          key_exchange: {
            ECDHE: 'Elliptic Curve Diffie-Hellman Ephemeral (recommended)',
            DHE: 'Diffie-Hellman Ephemeral (good)',
            RSA: 'RSA key transport (no forward secrecy - avoid)'
          },
          authentication: {
            RSA: 'RSA signature',
            ECDSA: 'Elliptic Curve DSA',
            PSK: 'Pre-Shared Key'
          },
          encryption: {
            'AES-256-GCM': 'AES 256-bit Galois/Counter Mode (recommended)',
            'AES-128-GCM': 'AES 128-bit Galois/Counter Mode (recommended)',
            'ChaCha20-Poly1305': 'ChaCha20 stream cipher (recommended)',
            'AES-CBC': 'AES Cipher Block Chaining (legacy)',
            '3DES': 'Triple DES (deprecated)'
          },
          mac: {
            AEAD: 'Authenticated Encryption (built into GCM/Poly1305)',
            'SHA384': 'HMAC-SHA384',
            'SHA256': 'HMAC-SHA256',
            'SHA1': 'HMAC-SHA1 (deprecated)'
          }
        }
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    if (operation === 'analyze') {
      const result = {
        operation: 'analyze',
        version,
        analysis: {
          security_level: version === 'TLS1.3' ? 'HIGH' : version === 'TLS1.2' ? 'MEDIUM-HIGH' : 'LOW',
          forward_secrecy: version === 'TLS1.3' ? 'Mandatory' : 'Depends on cipher suite',
          known_vulnerabilities: version === 'TLS1.3' ? [] : [
            'BEAST (TLS 1.0 only)',
            'POODLE (TLS 1.0, CBC mode)',
            'LUCKY13 (CBC mode)',
            'Renegotiation attacks',
            'Compression attacks (CRIME, BREACH)'
          ].filter(v => version !== 'TLS1.2' || !v.includes('TLS 1.0 only')),
          recommendations: version === 'TLS1.3'
            ? ['Already using the most secure version', 'Consider 0-RTT carefully (replay risk)']
            : [
                'Upgrade to TLS 1.3 when possible',
                'Use only ECDHE key exchange',
                'Use only AEAD ciphers (GCM)',
                'Disable compression',
                'Disable renegotiation'
              ]
        },
        best_practices: {
          certificate: 'Use 2048-bit RSA or 256-bit ECDSA',
          protocol: 'Enable TLS 1.3, allow TLS 1.2, disable 1.1/1.0',
          ciphers: 'Prefer AEAD ciphers, require forward secrecy',
          hsts: 'Enable HTTP Strict Transport Security',
          ocsp_stapling: 'Enable for faster certificate validation'
        }
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    return {
      toolCallId: id,
      content: `Error: Unknown operation '${operation}'`,
      isError: true
    };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function istlshandshakeAvailable(): boolean { return true; }
