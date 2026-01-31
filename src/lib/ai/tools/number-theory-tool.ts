/**
 * NUMBER THEORY TOOL
 *
 * Number theory operations using big-integer for large numbers.
 * Runs entirely locally - no external API costs.
 *
 * Functions:
 * - Prime testing (Miller-Rabin)
 * - Prime factorization
 * - GCD, LCM, extended Euclidean
 * - Modular arithmetic
 * - Totient function
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let bigInt: any = null;

async function initBigInt(): Promise<boolean> {
  if (bigInt) return true;
  try {
    const mod = await import('big-integer');
    bigInt = mod.default || mod;
    return true;
  } catch {
    return false;
  }
}

// Simple primality test for small numbers
function isPrimeSimple(n: number): boolean {
  if (n < 2) return false;
  if (n === 2) return true;
  if (n % 2 === 0) return false;
  for (let i = 3; i * i <= n; i += 2) {
    if (n % i === 0) return false;
  }
  return true;
}

// Sieve of Eratosthenes
function sievePrimes(limit: number): number[] {
  const sieve = new Array(limit + 1).fill(true);
  sieve[0] = sieve[1] = false;
  for (let i = 2; i * i <= limit; i++) {
    if (sieve[i]) {
      for (let j = i * i; j <= limit; j += i) {
        sieve[j] = false;
      }
    }
  }
  return sieve.map((v, i) => (v ? i : -1)).filter((v) => v > 0);
}

// Prime factorization for regular numbers
function factorize(n: number): { prime: number; exponent: number }[] {
  const factors: { prime: number; exponent: number }[] = [];
  let d = 2;
  while (d * d <= n) {
    let exp = 0;
    while (n % d === 0) {
      exp++;
      n /= d;
    }
    if (exp > 0) {
      factors.push({ prime: d, exponent: exp });
    }
    d++;
  }
  if (n > 1) {
    factors.push({ prime: n, exponent: 1 });
  }
  return factors;
}

// GCD using Euclidean algorithm
function gcd(a: number, b: number): number {
  while (b !== 0) {
    const t = b;
    b = a % b;
    a = t;
  }
  return Math.abs(a);
}

// LCM
function lcm(a: number, b: number): number {
  return Math.abs(a * b) / gcd(a, b);
}

// Extended Euclidean algorithm
function extendedGcd(a: number, b: number): { gcd: number; x: number; y: number } {
  if (b === 0) {
    return { gcd: a, x: 1, y: 0 };
  }
  const result = extendedGcd(b, a % b);
  return {
    gcd: result.gcd,
    x: result.y,
    y: result.x - Math.floor(a / b) * result.y,
  };
}

// Euler's totient function
function totient(n: number): number {
  let result = n;
  let temp = n;
  for (let p = 2; p * p <= temp; p++) {
    if (temp % p === 0) {
      while (temp % p === 0) {
        temp /= p;
      }
      result -= result / p;
    }
  }
  if (temp > 1) {
    result -= result / temp;
  }
  return result;
}

// Modular exponentiation
function modPow(base: number, exp: number, mod: number): number {
  let result = 1;
  base = base % mod;
  while (exp > 0) {
    if (exp % 2 === 1) {
      result = (result * base) % mod;
    }
    exp = Math.floor(exp / 2);
    base = (base * base) % mod;
  }
  return result;
}

// Modular inverse
function modInverse(a: number, m: number): number | null {
  const result = extendedGcd(a, m);
  if (result.gcd !== 1) return null; // No inverse
  return ((result.x % m) + m) % m;
}

// Legendre symbol (a/p)
function legendreSymbol(a: number, p: number): number {
  if (a % p === 0) return 0;
  const result = modPow(a, (p - 1) / 2, p);
  return result === p - 1 ? -1 : result;
}

// Check if n is a perfect power (n = a^b for some a, b > 1)
function isPerfectPower(n: number): { base: number; exponent: number } | null {
  if (n <= 1) return null;
  for (let b = 2; b <= Math.log2(n); b++) {
    const a = Math.round(Math.pow(n, 1 / b));
    if (Math.pow(a, b) === n) {
      return { base: a, exponent: b };
    }
    // Check neighbors due to floating point
    if (Math.pow(a - 1, b) === n) {
      return { base: a - 1, exponent: b };
    }
    if (Math.pow(a + 1, b) === n) {
      return { base: a + 1, exponent: b };
    }
  }
  return null;
}

// Number of divisors
function divisorCount(n: number): number {
  const factors = factorize(n);
  return factors.reduce((acc, f) => acc * (f.exponent + 1), 1);
}

// Sum of divisors
function divisorSum(n: number): number {
  const factors = factorize(n);
  return factors.reduce((acc, f) => {
    const sum = (Math.pow(f.prime, f.exponent + 1) - 1) / (f.prime - 1);
    return acc * sum;
  }, 1);
}

// All divisors
function divisors(n: number): number[] {
  const result: number[] = [];
  for (let i = 1; i * i <= n; i++) {
    if (n % i === 0) {
      result.push(i);
      if (i !== n / i) {
        result.push(n / i);
      }
    }
  }
  return result.sort((a, b) => a - b);
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const numberTheoryTool: UnifiedTool = {
  name: 'number_theory',
  description: `Perform number-theoretic computations and tests.

Available operations:
- is_prime: Miller-Rabin primality test
- factorize: Prime factorization
- sieve: Generate primes up to limit
- gcd, lcm: Greatest common divisor, least common multiple
- extended_gcd: Extended Euclidean algorithm (Bezout coefficients)
- totient: Euler's totient function φ(n)
- mod_pow: Modular exponentiation a^b mod m
- mod_inverse: Modular multiplicative inverse
- legendre: Legendre symbol (quadratic residue)
- divisors: All divisors of n
- divisor_count: Number of divisors τ(n)
- divisor_sum: Sum of divisors σ(n)
- is_perfect_power: Check if n = a^b

Used in: Cryptography, coding theory, mathematical research`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'is_prime',
          'factorize',
          'sieve',
          'gcd',
          'lcm',
          'extended_gcd',
          'totient',
          'mod_pow',
          'mod_inverse',
          'legendre',
          'divisors',
          'divisor_count',
          'divisor_sum',
          'is_perfect_power',
        ],
        description: 'Number theory operation',
      },
      n: {
        type: 'number',
        description: 'Primary number input',
      },
      a: {
        type: 'number',
        description: 'First number (for gcd, lcm, mod operations)',
      },
      b: {
        type: 'number',
        description: 'Second number (for gcd, lcm, mod operations)',
      },
      m: {
        type: 'number',
        description: 'Modulus (for modular operations)',
      },
      limit: {
        type: 'number',
        description: 'Upper limit (for sieve)',
      },
    },
    required: ['operation'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isNumberTheoryAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTE FUNCTION
// ============================================================================

export async function executeNumberTheory(call: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = call.arguments as {
    operation: string;
    n?: number;
    a?: number;
    b?: number;
    m?: number;
    limit?: number;
  };

  const { operation, n, a, b, m, limit } = args;

  try {
    await initBigInt(); // Initialize for potential big number operations

    const result: Record<string, unknown> = { operation };

    switch (operation) {
      case 'is_prime':
        if (n === undefined) throw new Error('n is required');
        if (bigInt && n > Number.MAX_SAFE_INTEGER) {
          const bi = bigInt(n.toString());
          result.is_prime = bi.isPrime();
        } else {
          result.is_prime = isPrimeSimple(n);
        }
        result.n = n;
        break;

      case 'factorize':
        if (n === undefined) throw new Error('n is required');
        const factors = factorize(n);
        result.factors = factors;
        result.n = n;
        result.factored_form = factors
          .map((f) => (f.exponent === 1 ? f.prime.toString() : `${f.prime}^${f.exponent}`))
          .join(' × ');
        break;

      case 'sieve':
        const sieveLimit = limit ?? n ?? 100;
        if (sieveLimit > 10000000) throw new Error('Limit too large (max 10,000,000)');
        const primes = sievePrimes(sieveLimit);
        result.primes = primes.slice(0, 1000); // Limit output
        result.count = primes.length;
        result.limit = sieveLimit;
        if (primes.length > 1000) {
          result.note = 'Output limited to first 1000 primes';
        }
        break;

      case 'gcd':
        if (a === undefined || b === undefined) throw new Error('a and b required');
        result.gcd = gcd(a, b);
        result.a = a;
        result.b = b;
        break;

      case 'lcm':
        if (a === undefined || b === undefined) throw new Error('a and b required');
        result.lcm = lcm(a, b);
        result.a = a;
        result.b = b;
        break;

      case 'extended_gcd':
        if (a === undefined || b === undefined) throw new Error('a and b required');
        const egcd = extendedGcd(a, b);
        result.gcd = egcd.gcd;
        result.x = egcd.x;
        result.y = egcd.y;
        result.a = a;
        result.b = b;
        result.identity = `${a} × ${egcd.x} + ${b} × ${egcd.y} = ${egcd.gcd}`;
        break;

      case 'totient':
        if (n === undefined) throw new Error('n is required');
        result.totient = totient(n);
        result.n = n;
        result.description = `Count of integers 1 ≤ k ≤ ${n} coprime to ${n}`;
        break;

      case 'mod_pow':
        if (a === undefined || b === undefined || m === undefined) {
          throw new Error('a, b, and m required for mod_pow');
        }
        result.result = modPow(a, b, m);
        result.expression = `${a}^${b} mod ${m}`;
        break;

      case 'mod_inverse':
        if (a === undefined || m === undefined) {
          throw new Error('a and m required for mod_inverse');
        }
        const inv = modInverse(a, m);
        if (inv === null) {
          result.error = `No modular inverse exists (gcd(${a}, ${m}) ≠ 1)`;
        } else {
          result.inverse = inv;
          result.verification = `${a} × ${inv} ≡ 1 (mod ${m})`;
        }
        result.a = a;
        result.m = m;
        break;

      case 'legendre':
        if (a === undefined || n === undefined) throw new Error('a and n (prime p) required');
        if (!isPrimeSimple(n)) throw new Error('n must be an odd prime');
        result.legendre = legendreSymbol(a, n);
        result.a = a;
        result.p = n;
        result.interpretation =
          result.legendre === 1
            ? 'quadratic residue'
            : result.legendre === -1
              ? 'quadratic non-residue'
              : 'divisible by p';
        break;

      case 'divisors':
        if (n === undefined) throw new Error('n is required');
        const divs = divisors(n);
        result.divisors = divs;
        result.count = divs.length;
        result.n = n;
        break;

      case 'divisor_count':
        if (n === undefined) throw new Error('n is required');
        result.tau = divisorCount(n);
        result.n = n;
        break;

      case 'divisor_sum':
        if (n === undefined) throw new Error('n is required');
        result.sigma = divisorSum(n);
        result.n = n;
        const sigma = divisorSum(n);
        result.is_perfect = sigma === 2 * n;
        result.is_abundant = sigma > 2 * n;
        result.is_deficient = sigma < 2 * n;
        break;

      case 'is_perfect_power':
        if (n === undefined) throw new Error('n is required');
        const power = isPerfectPower(n);
        if (power) {
          result.is_perfect_power = true;
          result.base = power.base;
          result.exponent = power.exponent;
          result.expression = `${power.base}^${power.exponent} = ${n}`;
        } else {
          result.is_perfect_power = false;
        }
        result.n = n;
        break;

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return {
      toolCallId: call.id,
      content: JSON.stringify(result, null, 2),
    };
  } catch (error) {
    return {
      toolCallId: call.id,
      content: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        operation,
      }),
      isError: true,
    };
  }
}
