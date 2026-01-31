/**
 * SPECIAL MATHEMATICAL FUNCTIONS TOOL
 *
 * Mathematical special functions essential for physics and engineering.
 * Runs entirely locally - no external API costs.
 *
 * Functions:
 * - Gamma function, Beta function
 * - Error function (erf, erfc)
 * - Bessel functions (J, Y, I, K)
 * - Legendre polynomials
 * - Spherical harmonics
 * - Factorial, double factorial
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// GAMMA FUNCTION AND RELATED
// ============================================================================

// Lanczos approximation coefficients
const LANCZOS_G = 7;
const LANCZOS_C = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
  1.5056327351493116e-7,
];

// Gamma function using Lanczos approximation
function gamma(z: number): number {
  if (z < 0.5) {
    // Reflection formula
    return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
  }

  z -= 1;
  let x = LANCZOS_C[0];
  for (let i = 1; i < LANCZOS_G + 2; i++) {
    x += LANCZOS_C[i] / (z + i);
  }

  const t = z + LANCZOS_G + 0.5;
  return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
}

// Log-gamma function
function logGamma(z: number): number {
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  }

  z -= 1;
  let x = LANCZOS_C[0];
  for (let i = 1; i < LANCZOS_G + 2; i++) {
    x += LANCZOS_C[i] / (z + i);
  }

  const t = z + LANCZOS_G + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

// Beta function
function beta(a: number, b: number): number {
  return Math.exp(logGamma(a) + logGamma(b) - logGamma(a + b));
}

// Factorial
function factorial(n: number): number {
  if (n < 0 || !Number.isInteger(n)) {
    return gamma(n + 1);
  }
  if (n <= 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) {
    result *= i;
  }
  return result;
}

// Double factorial
function doubleFactorial(n: number): number {
  if (n <= 0) return 1;
  let result = 1;
  for (let i = n; i > 0; i -= 2) {
    result *= i;
  }
  return result;
}

// Binomial coefficient
function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  return Math.exp(logGamma(n + 1) - logGamma(k + 1) - logGamma(n - k + 1));
}

// ============================================================================
// ERROR FUNCTION
// ============================================================================

// Error function using Taylor series and asymptotic expansion
function erf(x: number): number {
  const sign = x >= 0 ? 1 : -1;
  x = Math.abs(x);

  // Constants
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const t = 1 / (1 + p * x);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return sign * y;
}

// Complementary error function
function erfc(x: number): number {
  return 1 - erf(x);
}

// Inverse error function (approximation)
function erfinv(x: number): number {
  const a = 0.147;
  const sign = x >= 0 ? 1 : -1;
  x = Math.abs(x);

  const ln1mx2 = Math.log(1 - x * x);
  const term1 = 2 / (Math.PI * a) + ln1mx2 / 2;
  const term2 = ln1mx2 / a;

  return sign * Math.sqrt(Math.sqrt(term1 * term1 - term2) - term1);
}

// ============================================================================
// BESSEL FUNCTIONS
// ============================================================================

// Bessel function of first kind J_n(x)
function besselJ(n: number, x: number): number {
  if (n < 0) {
    return Math.pow(-1, n) * besselJ(-n, x);
  }

  if (Math.abs(x) < 1e-10) {
    return n === 0 ? 1 : 0;
  }

  // Series expansion for small x
  if (Math.abs(x) < 10) {
    let sum = 0;
    for (let k = 0; k <= 50; k++) {
      const term =
        (Math.pow(-1, k) * Math.pow(x / 2, n + 2 * k)) / (factorial(k) * gamma(n + k + 1));
      sum += term;
      if (Math.abs(term) < 1e-15 * Math.abs(sum)) break;
    }
    return sum;
  }

  // Asymptotic expansion for large x
  const phase = x - (n / 2 + 0.25) * Math.PI;
  return Math.sqrt(2 / (Math.PI * x)) * Math.cos(phase);
}

// Bessel function of second kind Y_n(x)
function besselY(n: number, x: number): number {
  if (x <= 0) return NaN;

  // For integer n
  if (Number.isInteger(n)) {
    // Use relation with J
    const eps = 1e-10;
    return (
      (besselJ(n + eps, x) * Math.cos((n + eps) * Math.PI) - besselJ(-(n + eps), x)) /
      Math.sin((n + eps) * Math.PI)
    );
  }

  // For non-integer n
  return (besselJ(n, x) * Math.cos(n * Math.PI) - besselJ(-n, x)) / Math.sin(n * Math.PI);
}

// Modified Bessel function of first kind I_n(x)
function besselI(n: number, x: number): number {
  if (Math.abs(x) < 1e-10) {
    return n === 0 ? 1 : 0;
  }

  let sum = 0;
  for (let k = 0; k <= 50; k++) {
    const term = Math.pow(x / 2, n + 2 * k) / (factorial(k) * gamma(n + k + 1));
    sum += term;
    if (Math.abs(term) < 1e-15 * Math.abs(sum)) break;
  }
  return sum;
}

// ============================================================================
// LEGENDRE POLYNOMIALS
// ============================================================================

// Legendre polynomial P_n(x)
function legendreP(n: number, x: number): number {
  if (n === 0) return 1;
  if (n === 1) return x;

  let pPrev = 1;
  let pCurr = x;

  for (let k = 2; k <= n; k++) {
    const pNext = ((2 * k - 1) * x * pCurr - (k - 1) * pPrev) / k;
    pPrev = pCurr;
    pCurr = pNext;
  }

  return pCurr;
}

// Associated Legendre polynomial P_n^m(x)
function associatedLegendreP(n: number, m: number, x: number): number {
  if (m > n) return 0;
  if (m < 0) {
    return (
      ((Math.pow(-1, -m) * factorial(n + m)) / factorial(n - m)) * associatedLegendreP(n, -m, x)
    );
  }

  // Start with P_m^m
  let pmm = 1;
  if (m > 0) {
    const somx2 = Math.sqrt((1 - x) * (1 + x));
    let fact = 1;
    for (let i = 1; i <= m; i++) {
      pmm *= -fact * somx2;
      fact += 2;
    }
  }

  if (n === m) return pmm;

  // Compute P_{m+1}^m
  let pmmp1 = x * (2 * m + 1) * pmm;
  if (n === m + 1) return pmmp1;

  // Recurrence relation
  let pll = 0;
  for (let l = m + 2; l <= n; l++) {
    pll = (x * (2 * l - 1) * pmmp1 - (l + m - 1) * pmm) / (l - m);
    pmm = pmmp1;
    pmmp1 = pll;
  }

  return pll;
}

// ============================================================================
// SPHERICAL HARMONICS
// ============================================================================

// Spherical harmonic Y_l^m(theta, phi) - real part
function sphericalHarmonicReal(l: number, m: number, theta: number, phi: number): number {
  const factor = Math.sqrt(
    ((2 * l + 1) * factorial(l - Math.abs(m))) / (4 * Math.PI * factorial(l + Math.abs(m)))
  );

  const plm = associatedLegendreP(l, Math.abs(m), Math.cos(theta));

  if (m > 0) {
    return factor * plm * Math.cos(m * phi) * Math.sqrt(2);
  } else if (m < 0) {
    return factor * plm * Math.sin(-m * phi) * Math.sqrt(2);
  } else {
    return factor * plm;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const specialFunctionsTool: UnifiedTool = {
  name: 'special_functions',
  description: `Compute special mathematical functions used in physics and engineering.

Available functions:
- gamma, loggamma: Gamma function and its logarithm
- beta: Beta function B(a,b)
- factorial, double_factorial: n! and n!!
- binomial: Binomial coefficient C(n,k)
- erf, erfc, erfinv: Error functions
- bessel_j, bessel_y, bessel_i: Bessel functions
- legendre, assoc_legendre: Legendre polynomials
- spherical_harmonic: Spherical harmonics Y_l^m

Used in: Quantum mechanics, electromagnetics, heat transfer, statistics`,
  parameters: {
    type: 'object',
    properties: {
      function: {
        type: 'string',
        enum: [
          'gamma',
          'loggamma',
          'beta',
          'factorial',
          'double_factorial',
          'binomial',
          'erf',
          'erfc',
          'erfinv',
          'bessel_j',
          'bessel_y',
          'bessel_i',
          'legendre',
          'assoc_legendre',
          'spherical_harmonic',
        ],
        description: 'Special function to compute',
      },
      x: {
        type: 'number',
        description: 'Primary argument',
      },
      n: {
        type: 'number',
        description: 'Order parameter (for Bessel, Legendre)',
      },
      m: {
        type: 'number',
        description: 'Secondary order (for associated Legendre, spherical harmonics)',
      },
      a: {
        type: 'number',
        description: 'First parameter (for beta, binomial)',
      },
      b: {
        type: 'number',
        description: 'Second parameter (for beta)',
      },
      theta: {
        type: 'number',
        description: 'Polar angle in radians (for spherical harmonics)',
      },
      phi: {
        type: 'number',
        description: 'Azimuthal angle in radians (for spherical harmonics)',
      },
    },
    required: ['function'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isSpecialFunctionsAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTE FUNCTION
// ============================================================================

export async function executeSpecialFunctions(call: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = call.arguments as {
    function: string;
    x?: number;
    n?: number;
    m?: number;
    a?: number;
    b?: number;
    theta?: number;
    phi?: number;
  };

  const { function: fn, x, n, m, a, b, theta, phi } = args;

  try {
    let result: number;
    const details: Record<string, unknown> = { function: fn };

    switch (fn) {
      case 'gamma':
        if (x === undefined) throw new Error('x is required for gamma');
        result = gamma(x);
        details.formula = 'Γ(x)';
        break;

      case 'loggamma':
        if (x === undefined) throw new Error('x is required for loggamma');
        result = logGamma(x);
        details.formula = 'ln(Γ(x))';
        break;

      case 'beta':
        if (a === undefined || b === undefined) throw new Error('a and b required for beta');
        result = beta(a, b);
        details.formula = 'B(a,b) = Γ(a)Γ(b)/Γ(a+b)';
        details.a = a;
        details.b = b;
        break;

      case 'factorial':
        if (x === undefined) throw new Error('x is required for factorial');
        result = factorial(x);
        details.formula = 'n!';
        break;

      case 'double_factorial':
        if (x === undefined) throw new Error('x is required for double_factorial');
        result = doubleFactorial(x);
        details.formula = 'n!!';
        break;

      case 'binomial':
        if (a === undefined || b === undefined)
          throw new Error('a (n) and b (k) required for binomial');
        result = binomial(a, b);
        details.formula = 'C(n,k) = n!/(k!(n-k)!)';
        details.n = a;
        details.k = b;
        break;

      case 'erf':
        if (x === undefined) throw new Error('x is required for erf');
        result = erf(x);
        details.formula = 'erf(x) = (2/√π)∫₀ˣ e^(-t²) dt';
        break;

      case 'erfc':
        if (x === undefined) throw new Error('x is required for erfc');
        result = erfc(x);
        details.formula = 'erfc(x) = 1 - erf(x)';
        break;

      case 'erfinv':
        if (x === undefined) throw new Error('x is required for erfinv');
        if (Math.abs(x) >= 1) throw new Error('erfinv requires |x| < 1');
        result = erfinv(x);
        details.formula = 'erf⁻¹(x)';
        break;

      case 'bessel_j':
        if (x === undefined || n === undefined) throw new Error('x and n required for bessel_j');
        result = besselJ(n, x);
        details.formula = `J_${n}(x)`;
        details.order = n;
        break;

      case 'bessel_y':
        if (x === undefined || n === undefined) throw new Error('x and n required for bessel_y');
        result = besselY(n, x);
        details.formula = `Y_${n}(x)`;
        details.order = n;
        break;

      case 'bessel_i':
        if (x === undefined || n === undefined) throw new Error('x and n required for bessel_i');
        result = besselI(n, x);
        details.formula = `I_${n}(x)`;
        details.order = n;
        break;

      case 'legendre':
        if (x === undefined || n === undefined) throw new Error('x and n required for legendre');
        result = legendreP(n, x);
        details.formula = `P_${n}(x)`;
        details.order = n;
        break;

      case 'assoc_legendre':
        if (x === undefined || n === undefined || m === undefined) {
          throw new Error('x, n, and m required for assoc_legendre');
        }
        result = associatedLegendreP(n, m, x);
        details.formula = `P_${n}^${m}(x)`;
        details.n = n;
        details.m = m;
        break;

      case 'spherical_harmonic':
        if (theta === undefined || phi === undefined || n === undefined || m === undefined) {
          throw new Error('theta, phi, n (l), and m required for spherical_harmonic');
        }
        result = sphericalHarmonicReal(n, m, theta, phi);
        details.formula = `Y_${n}^${m}(θ,φ)`;
        details.l = n;
        details.m = m;
        details.theta = theta;
        details.phi = phi;
        break;

      default:
        throw new Error(`Unknown function: ${fn}`);
    }

    return {
      toolCallId: call.id,
      content: JSON.stringify(
        {
          result,
          input: { x, n, m, a, b, theta, phi },
          ...details,
        },
        null,
        2
      ),
    };
  } catch (error) {
    return {
      toolCallId: call.id,
      content: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        function: fn,
      }),
      isError: true,
    };
  }
}
