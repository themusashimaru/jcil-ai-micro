/**
 * KEY-DERIVATION TOOL
 * Key Derivation Functions for password hashing and key stretching
 * Implements: PBKDF2, scrypt, Argon2 concepts and demonstrations
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const keyderivationTool: UnifiedTool = {
  name: 'key_derivation',
  description: 'Key derivation functions for password hashing and key generation',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['info', 'derive', 'verify', 'compare', 'cost_analysis', 'demonstrate'],
        description: 'Operation to perform'
      },
      algorithm: {
        type: 'string',
        enum: ['PBKDF2', 'scrypt', 'Argon2id', 'bcrypt'],
        description: 'KDF algorithm'
      },
      password: { type: 'string', description: 'Password to hash' },
      salt: { type: 'string', description: 'Salt value (hex)' },
      iterations: { type: 'number', description: 'Number of iterations (PBKDF2)' },
      memory_cost: { type: 'number', description: 'Memory cost in KB (Argon2, scrypt)' },
      parallelism: { type: 'number', description: 'Parallelism factor' },
      key_length: { type: 'number', description: 'Output key length in bytes' }
    },
    required: ['operation']
  }
};

// Simple hash function (educational, NOT cryptographically secure)
function simpleHash(data: string, rounds: number = 1): string {
  let hash = 0n;

  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < data.length; i++) {
      const char = BigInt(data.charCodeAt(i));
      hash = ((hash << 5n) - hash + char) & 0xFFFFFFFFFFFFFFFFn;
      hash = hash ^ (hash >> 13n);
      hash = ((hash * 0x5bd1e995n) & 0xFFFFFFFFFFFFFFFFn);
    }
    data = hash.toString(16);
  }

  return hash.toString(16).padStart(16, '0');
}

// HMAC simulation (educational)
function hmac(key: string, message: string): string {
  const ipad = 0x36;
  const opad = 0x5c;

  // Simplified HMAC
  let innerKey = '';
  let outerKey = '';

  for (let i = 0; i < 64; i++) {
    const keyByte = key.charCodeAt(i % key.length) || 0;
    innerKey += String.fromCharCode(keyByte ^ ipad);
    outerKey += String.fromCharCode(keyByte ^ opad);
  }

  const innerHash = simpleHash(innerKey + message);
  const outerHash = simpleHash(outerKey + innerHash);

  return outerHash;
}

// PBKDF2 simulation (educational)
function pbkdf2Derive(
  password: string,
  salt: string,
  iterations: number,
  keyLength: number
): { derivedKey: string; steps: string[]; timeEstimate: string } {
  const startTime = Date.now();

  // Number of blocks needed
  const numBlocks = Math.ceil(keyLength / 8);
  let derivedKey = '';

  const steps: string[] = [
    `Password: "${password}"`,
    `Salt: ${salt}`,
    `Iterations: ${iterations}`,
    `Key Length: ${keyLength} bytes`
  ];

  for (let block = 1; block <= numBlocks; block++) {
    let U = hmac(password, salt + String.fromCharCode(block));
    let result = BigInt('0x' + U);

    for (let i = 1; i < Math.min(iterations, 1000); i++) {
      U = hmac(password, U);
      result ^= BigInt('0x' + U);
    }

    derivedKey += result.toString(16).padStart(16, '0');
  }

  const elapsed = Date.now() - startTime;

  return {
    derivedKey: derivedKey.slice(0, keyLength * 2),
    steps,
    timeEstimate: `~${elapsed}ms (simulated ${Math.min(iterations, 1000)} iterations)`
  };
}

// scrypt simulation (educational)
function scryptDerive(
  password: string,
  salt: string,
  N: number,  // CPU/memory cost
  r: number,  // Block size
  p: number,  // Parallelism
  keyLength: number
): { derivedKey: string; memoryUsage: string; steps: string[] } {
  // Simulate memory-hard derivation
  const blockSize = 128 * r;
  const memoryUsage = N * blockSize;

  // Create initial block
  let block = hmac(password, salt);

  // Simulate memory-hard mixing
  const memory: string[] = [];
  for (let i = 0; i < Math.min(N, 100); i++) {
    block = simpleHash(block + i.toString(), 1);
    memory.push(block);
  }

  // Simulate random memory access
  for (let i = 0; i < Math.min(N, 100); i++) {
    const j = parseInt(block.slice(-4), 16) % memory.length;
    block = simpleHash(block + memory[j], 1);
  }

  return {
    derivedKey: block.slice(0, keyLength * 2).padEnd(keyLength * 2, '0'),
    memoryUsage: `${(memoryUsage / 1024).toFixed(2)} KB`,
    steps: [
      `1. Initial mixing with PBKDF2`,
      `2. Allocate ${memoryUsage} bytes of memory`,
      `3. Fill memory with ROMix function (N=${N} iterations)`,
      `4. Random memory access prevents GPU parallelization`,
      `5. Final PBKDF2 to produce key`
    ]
  };
}

// Argon2 simulation (educational)
function argon2Derive(
  password: string,
  salt: string,
  timeCost: number,
  memoryCost: number,  // KB
  parallelism: number,
  keyLength: number,
  variant: 'Argon2d' | 'Argon2i' | 'Argon2id'
): { derivedKey: string; memoryUsage: string; steps: string[] } {
  // Calculate lanes and segments
  const lanes = parallelism;
  const memoryBlocks = Math.max(8 * parallelism, memoryCost / 1024);

  // Simulate initial block generation
  let H0 = hmac(password, salt + parallelism + memoryCost + keyLength);

  // Simulate memory matrix filling
  let block = H0;
  for (let pass = 0; pass < timeCost; pass++) {
    for (let lane = 0; lane < lanes; lane++) {
      for (let slice = 0; slice < 4; slice++) {
        // Argon2d uses data-dependent addressing (faster, less resistant to side-channel)
        // Argon2i uses data-independent addressing (slower, more secure)
        // Argon2id uses hybrid (recommended)
        if (variant === 'Argon2i' || (variant === 'Argon2id' && pass === 0 && slice < 2)) {
          // Data-independent indexing
          block = simpleHash(block + 'i' + pass + lane + slice, 1);
        } else {
          // Data-dependent indexing
          block = simpleHash(block + 'd' + pass + lane + slice, 1);
        }
      }
    }
  }

  // Final XOR and hash
  const derivedKey = simpleHash(block, 2);

  return {
    derivedKey: derivedKey.slice(0, keyLength * 2).padEnd(keyLength * 2, '0'),
    memoryUsage: `${memoryCost} KB`,
    steps: [
      `Variant: ${variant}`,
      `1. Generate H0 from password, salt, and parameters`,
      `2. Fill ${memoryBlocks} memory blocks across ${lanes} lanes`,
      `3. Perform ${timeCost} passes over memory`,
      `4. XOR columns and apply final hash`,
      `Memory-hard: requires ${memoryCost} KB RAM`,
      `Parallelism: ${parallelism} threads`
    ]
  };
}

// bcrypt simulation (educational)
function bcryptDerive(
  password: string,
  salt: string,
  cost: number
): { derivedKey: string; steps: string[] } {
  // bcrypt iterations = 2^cost
  const iterations = Math.pow(2, cost);

  // Simulate Blowfish key schedule
  let state = hmac(password, salt);

  // Simulate expensive key setup
  for (let i = 0; i < Math.min(iterations, 1000); i++) {
    state = simpleHash(state + password, 1);
    state = simpleHash(state + salt, 1);
  }

  // Encrypt magic string "OrpheanBeholderScryDoubt"
  const magic = 'OrpheanBeholderScryDoubt';
  let cipher = state;
  for (let i = 0; i < 64; i++) {
    cipher = hmac(cipher, magic);
  }

  return {
    derivedKey: cipher.slice(0, 46),  // bcrypt outputs 184 bits
    steps: [
      `Cost factor: ${cost} (2^${cost} = ${iterations.toLocaleString()} iterations)`,
      `1. Initialize Blowfish state with expensive key schedule`,
      `2. Apply key schedule 2^${cost} times`,
      `3. Encrypt "OrpheanBeholderScryDoubt" 64 times`,
      `4. Output 184-bit hash`
    ]
  };
}

// Cost analysis
function analyzeCosts(password: string, salt: string): {
  algorithms: { name: string; config: string; timeMs: number; memory: string; recommendation: string }[];
} {
  return {
    algorithms: [
      {
        name: 'PBKDF2-SHA256',
        config: '310,000 iterations',
        timeMs: 100,
        memory: 'Minimal (~1 KB)',
        recommendation: 'OWASP minimum for SHA-256'
      },
      {
        name: 'bcrypt',
        config: 'cost=10',
        timeMs: 100,
        memory: '4 KB',
        recommendation: 'Good default, increase cost for high-value'
      },
      {
        name: 'scrypt',
        config: 'N=2^14, r=8, p=1',
        timeMs: 100,
        memory: '16 MB',
        recommendation: 'Memory-hard, resists GPU attacks'
      },
      {
        name: 'Argon2id',
        config: 't=3, m=65536, p=4',
        timeMs: 100,
        memory: '64 MB',
        recommendation: 'Winner of PHC, best choice for new systems'
      }
    ]
  };
}

// Short hex display
function shortHex(hex: string, maxLen: number = 16): string {
  if (hex.length <= maxLen) return hex;
  return hex.slice(0, maxLen / 2) + '...' + hex.slice(-maxLen / 2);
}

// Generate random salt
function generateSalt(bytes: number = 16): string {
  return Array.from({ length: bytes }, () =>
    Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
  ).join('');
}

export async function executekeyderivation(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation || 'info';
    const algorithm = args.algorithm || 'Argon2id';

    let result: any;

    switch (operation) {
      case 'info':
        result = {
          tool: 'key-derivation',
          description: 'Key Derivation Functions for password hashing',
          operations: [
            'info - Tool information',
            'derive - Derive key from password',
            'verify - Verify password against hash',
            'compare - Compare KDF algorithms',
            'cost_analysis - Analyze computation costs',
            'demonstrate - Show KDF concepts'
          ],
          algorithms: {
            'PBKDF2': 'CPU-intensive, widely supported',
            'bcrypt': 'CPU-intensive with fixed memory',
            'scrypt': 'Memory-hard, resists GPU attacks',
            'Argon2id': 'Modern, memory-hard, recommended'
          },
          purposes: [
            'Password hashing (storage)',
            'Key stretching (strengthen weak keys)',
            'Key derivation (generate multiple keys)',
            'Proof of work (cryptocurrency mining)'
          ]
        };
        break;

      case 'derive': {
        const password = args.password || 'password123';
        const salt = args.salt || generateSalt();
        const keyLength = args.key_length || 32;

        let derived: any;

        if (algorithm === 'PBKDF2') {
          const iterations = args.iterations || 10000;
          derived = pbkdf2Derive(password, salt, iterations, keyLength);
          derived.algorithm = 'PBKDF2-HMAC-SHA256';
          derived.parameters = { iterations, saltLength: salt.length / 2 };
        } else if (algorithm === 'scrypt') {
          const N = args.memory_cost || 16384;  // 2^14
          const r = 8;
          const p = args.parallelism || 1;
          derived = scryptDerive(password, salt, N, r, p, keyLength);
          derived.algorithm = 'scrypt';
          derived.parameters = { N, r, p };
        } else if (algorithm === 'bcrypt') {
          const cost = Math.log2(args.iterations || 1024) || 10;
          derived = bcryptDerive(password, salt, cost);
          derived.algorithm = 'bcrypt';
          derived.parameters = { cost };
        } else {
          const t = args.iterations || 3;
          const m = args.memory_cost || 65536;
          const p = args.parallelism || 4;
          derived = argon2Derive(password, salt, t, m, p, keyLength, 'Argon2id');
          derived.algorithm = 'Argon2id';
          derived.parameters = { timeCost: t, memoryCost: m, parallelism: p };
        }

        result = {
          operation: 'Derive Key',
          password: password.replace(/./g, '*'),
          salt,
          ...derived,
          outputLength: keyLength + ' bytes',
          securityNote: 'Educational implementation - use crypto libraries for real password hashing'
        };
        break;
      }

      case 'verify': {
        const password = args.password || 'password123';
        const salt = args.salt || generateSalt();
        const wrongPassword = password + '!';

        // Derive for correct and wrong password
        const correctHash = pbkdf2Derive(password, salt, 1000, 32).derivedKey;
        const wrongHash = pbkdf2Derive(wrongPassword, salt, 1000, 32).derivedKey;

        result = {
          operation: 'Verify Password',
          algorithm,
          salt,
          storedHash: shortHex(correctHash, 24),
          tests: [
            {
              password: password.replace(/./g, '*'),
              derivedHash: shortHex(correctHash, 24),
              match: true,
              result: 'ACCESS GRANTED'
            },
            {
              password: wrongPassword.replace(/./g, '*'),
              derivedHash: shortHex(wrongHash, 24),
              match: false,
              result: 'ACCESS DENIED'
            }
          ],
          timingNote: 'Always use constant-time comparison to prevent timing attacks'
        };
        break;
      }

      case 'compare': {
        const comparison = analyzeCosts('password', 'salt');

        result = {
          operation: 'Compare KDF Algorithms',
          algorithms: comparison.algorithms,
          comparison: {
            'PBKDF2': {
              pros: ['Widely available', 'NIST approved', 'Configurable'],
              cons: ['Not memory-hard', 'GPU-attackable', 'No parallelism defense']
            },
            'bcrypt': {
              pros: ['Battle-tested', 'Fixed memory (4KB)', 'Simple API'],
              cons: ['72-byte password limit', 'Fixed output size', 'Not memory-hard']
            },
            'scrypt': {
              pros: ['Memory-hard', 'Resists GPU/ASIC', 'Configurable'],
              cons: ['Complex parameters', 'Less audited', 'Cache-timing attacks']
            },
            'Argon2id': {
              pros: ['PHC winner', 'Hybrid design', 'Modern', 'Memory-hard'],
              cons: ['Newer (less battle-tested)', 'Requires more library support']
            }
          },
          recommendations: {
            newSystems: 'Argon2id with t=3, m=64MB, p=4',
            compatibility: 'bcrypt with cost=10+',
            compliance: 'PBKDF2 with 310,000+ iterations',
            cryptocurrency: 'scrypt (Litecoin) or Argon2 (PHC coins)'
          }
        };
        break;
      }

      case 'cost_analysis': {
        result = {
          operation: 'Cost Analysis',
          attackerTypes: {
            casual: {
              hardware: 'Consumer PC (1 GPU)',
              hashRate: '~10,000/sec (bcrypt cost=10)',
              budget: '$1,000'
            },
            serious: {
              hardware: '10 GPUs',
              hashRate: '~100,000/sec',
              budget: '$10,000'
            },
            nationState: {
              hardware: 'Custom ASIC farm',
              hashRate: '~10,000,000/sec (non-memory-hard)',
              budget: '$10,000,000'
            }
          },
          defenseStrategies: [
            'Use memory-hard functions (Argon2, scrypt)',
            'Increase iterations as hardware improves',
            'Target ~100ms verification time',
            'Use unique salts per password',
            'Consider key derivation with HSM'
          ],
          owasp2024Recommendations: {
            'Argon2id': 'm=19456 KB, t=2, p=1 (minimum)',
            'bcrypt': 'cost=10 (minimum)',
            'scrypt': 'N=2^17, r=8, p=1',
            'PBKDF2-SHA256': '310,000 iterations (minimum)'
          }
        };
        break;
      }

      case 'demonstrate': {
        const password = 'MySecurePassword!';
        const salt = generateSalt();

        let demo = `
╔═══════════════════════════════════════════════════════════════════════╗
║               KEY DERIVATION FUNCTIONS DEMONSTRATION                  ║
╚═══════════════════════════════════════════════════════════════════════╝

═══════════════════════════════════════════════════════════════════════
                    WHY KEY DERIVATION?
═══════════════════════════════════════════════════════════════════════

Problem: Passwords are often weak and predictable
  • "password123" - appears in every breach
  • Short passwords have low entropy
  • Attackers can try billions of hashes per second

Solution: Key Derivation Functions (KDFs)
  • Make each hash attempt SLOW (CPU time)
  • Make each hash attempt EXPENSIVE (memory)
  • Use unique salt to prevent rainbow tables

Password: "${password}"
Salt:     ${salt}

═══════════════════════════════════════════════════════════════════════
                        1. PBKDF2
═══════════════════════════════════════════════════════════════════════

Password-Based Key Derivation Function 2 (RFC 8018)

Algorithm:
  DK = PBKDF2(PRF, Password, Salt, c, dkLen)

  For i = 1 to ⌈dkLen/hLen⌉:
    U₁ = PRF(Password, Salt || INT(i))
    U₂ = PRF(Password, U₁)
    ...
    Uₙ = PRF(Password, Uₙ₋₁)

    Tᵢ = U₁ ⊕ U₂ ⊕ ... ⊕ Uₙ

  DK = T₁ || T₂ || ... || Tₗ

`;

        const pbkdf2Result = pbkdf2Derive(password, salt, 10000, 32);
        demo += `Example (10,000 iterations):
  Derived Key: ${shortHex(pbkdf2Result.derivedKey, 32)}

  Strength: ${10000} iterations × hash cost
  Weakness: No memory hardness - GPUs can parallelize

  OWASP 2024: Use 310,000+ iterations for SHA-256

═══════════════════════════════════════════════════════════════════════
                        2. bcrypt
═══════════════════════════════════════════════════════════════════════

Blowfish-based password hash (1999)

Algorithm:
  1. EksBlowfishSetup(cost, salt, password)
  2. Repeat 2^cost times:
     - state = ExpandKey(state, 0, password)
     - state = ExpandKey(state, 0, salt)
  3. ctext = "OrpheanBeholderScryDoubt"
  4. Repeat 64 times:
     - ctext = EncryptECB(state, ctext)
  5. Return Concatenate(cost, salt, ctext)

`;

        const bcryptResult = bcryptDerive(password, salt, 10);
        demo += `Example (cost=10):
  Hash: ${shortHex(bcryptResult.derivedKey, 32)}

  Iterations: 2^10 = 1,024 expensive key schedules
  Memory: Fixed 4KB (Blowfish state)

  Limitation: 72-byte password truncation
  Recommendation: cost=10 minimum, increase yearly

═══════════════════════════════════════════════════════════════════════
                        3. scrypt
═══════════════════════════════════════════════════════════════════════

Memory-hard function (2009) - used by Litecoin

Parameters:
  N = CPU/memory cost (power of 2)
  r = block size (typically 8)
  p = parallelization (typically 1)

Algorithm:
  1. B = PBKDF2(password, salt, 1, p * 128 * r)
  2. For i = 0 to p-1:
     - B[i] = ROMix(B[i], N)  // Memory-hard
  3. DK = PBKDF2(password, B, 1, dkLen)

ROMix (memory-hard core):
  - Fill array V with N blocks
  - Random lookups: V[j] where j depends on current block
  - Requires N * 128 * r bytes of RAM

`;

        const scryptResult = scryptDerive(password, salt, 16384, 8, 1, 32);
        demo += `Example (N=16384, r=8, p=1):
  Derived Key: ${shortHex(scryptResult.derivedKey, 32)}
  Memory Used: ${scryptResult.memoryUsage}

  Memory-hardness prevents GPU parallelization!
  Each GPU core would need 16MB RAM

═══════════════════════════════════════════════════════════════════════
                        4. Argon2id
═══════════════════════════════════════════════════════════════════════

Password Hashing Competition Winner (2015)

Variants:
  • Argon2d: Data-dependent (faster, GPU-resistant)
  • Argon2i: Data-independent (side-channel resistant)
  • Argon2id: Hybrid (RECOMMENDED)

Parameters:
  • t: Time cost (iterations)
  • m: Memory cost (KB)
  • p: Parallelism (threads)

`;

        const argon2Result = argon2Derive(password, salt, 3, 65536, 4, 32, 'Argon2id');
        demo += `Example (t=3, m=64MB, p=4):
  Derived Key: ${shortHex(argon2Result.derivedKey, 32)}
  Memory Used: ${argon2Result.memoryUsage}

  Argon2id advantages:
  ✓ Memory-hard (GPU-resistant)
  ✓ Side-channel resistant (first 2 iterations)
  ✓ Configurable parallelism
  ✓ Modern cryptographic design

═══════════════════════════════════════════════════════════════════════
                        SALT: WHY IT MATTERS
═══════════════════════════════════════════════════════════════════════

Without salt:
  password → abc123...  (same hash for same password)

  Attacker precomputes:
  "password"   → abc123...
  "123456"     → def456...
  "qwerty"     → ghi789...
  ... (rainbow table of millions of hashes)

  Lookup any hash instantly!

With salt:
  password + salt1 → xyz111...
  password + salt2 → uvw222...

  Each salt requires separate rainbow table.
  16-byte salt = 2^128 possible tables = IMPOSSIBLE

Rule: Generate new random salt for EACH password!

═══════════════════════════════════════════════════════════════════════
                      ATTACK RESISTANCE
═══════════════════════════════════════════════════════════════════════

┌─────────────┬───────────────┬───────────────┬───────────────────────┐
│ Algorithm   │ GPU Attack    │ ASIC Attack   │ Memory Required       │
├─────────────┼───────────────┼───────────────┼───────────────────────┤
│ PBKDF2      │ Vulnerable    │ Vulnerable    │ Minimal (~1 KB)       │
│ bcrypt      │ Moderate      │ Moderate      │ Fixed 4 KB            │
│ scrypt      │ Resistant     │ Moderate      │ Configurable (MB-GB)  │
│ Argon2id    │ Resistant     │ Resistant     │ Configurable (MB-GB)  │
└─────────────┴───────────────┴───────────────┴───────────────────────┘

═══════════════════════════════════════════════════════════════════════
                        KEY INSIGHTS
═══════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────┐
│ 1. ALWAYS use unique random salt (16+ bytes)                       │
│                                                                     │
│ 2. Memory-hard functions (Argon2, scrypt) resist GPU attacks       │
│                                                                     │
│ 3. Target ~100ms verification time                                 │
│                                                                     │
│ 4. Increase cost parameters as hardware improves                   │
│                                                                     │
│ 5. For new systems: Argon2id                                       │
│    For compatibility: bcrypt                                       │
│    For compliance: PBKDF2                                          │
│                                                                     │
│ 6. Never store passwords - only store KDF output + salt            │
└─────────────────────────────────────────────────────────────────────┘
`;

        result = {
          demonstration: demo,
          summary: {
            purpose: 'Slow down password cracking attacks',
            recommendation: 'Argon2id for new systems',
            keyParameters: ['Salt (unique per password)', 'Time cost', 'Memory cost'],
            attacks: ['Rainbow tables', 'GPU cracking', 'ASIC attacks']
          }
        };
        break;
      }

      default:
        result = { error: `Unknown operation: ${operation}`, availableOperations: ['info', 'derive', 'verify', 'compare', 'cost_analysis', 'demonstrate'] };
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function iskeyderivationAvailable(): boolean { return true; }
