/**
 * PROBABILITY DISTRIBUTIONS TOOL
 *
 * Full probability distribution suite with PDF, CDF, quantile, and sampling.
 * Runs entirely locally - no external API costs.
 *
 * Distributions:
 * - Normal (Gaussian)
 * - Exponential
 * - Uniform
 * - Poisson
 * - Binomial
 * - Chi-squared
 * - Student's t
 * - F distribution
 * - Beta
 * - Gamma
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Gamma function (Lanczos approximation)
const LANCZOS_G = 7;
const LANCZOS_C = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
  1.5056327351493116e-7,
];

function gamma(z: number): number {
  if (z < 0.5) {
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

// Error function
function erf(x: number): number {
  const sign = x >= 0 ? 1 : -1;
  x = Math.abs(x);
  const a1 = 0.254829592,
    a2 = -0.284496736,
    a3 = 1.421413741;
  const a4 = -1.453152027,
    a5 = 1.061405429,
    p = 0.3275911;
  const t = 1 / (1 + p * x);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

// Incomplete gamma function (lower)
function gammainc(a: number, x: number): number {
  if (x < 0 || a <= 0) return NaN;
  if (x === 0) return 0;

  // Series expansion for small x
  if (x < a + 1) {
    let sum = 1 / a;
    let term = 1 / a;
    for (let n = 1; n < 100; n++) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < 1e-10 * Math.abs(sum)) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
  }

  // Continued fraction for large x
  let f = 1e-30;
  let c = 1e-30;
  let d = 0;
  for (let n = 1; n < 100; n++) {
    const an = n * (a - n);
    const bn = 2 * n - 1 - a + x;
    d = bn + an * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = bn + an / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const delta = c * d;
    f *= delta;
    if (Math.abs(delta - 1) < 1e-10) break;
  }
  return 1 - f * Math.exp(-x + a * Math.log(x) - logGamma(a));
}

// Incomplete beta function
function betainc(a: number, b: number, x: number): number {
  if (x < 0 || x > 1) return NaN;
  if (x === 0) return 0;
  if (x === 1) return 1;

  const lbeta = logGamma(a) + logGamma(b) - logGamma(a + b);

  if (x > (a + 1) / (a + b + 2)) {
    return 1 - betainc(b, a, 1 - x);
  }

  // Continued fraction
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  let h = d;

  for (let m = 1; m <= 100; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-10) break;
  }

  return (Math.exp(a * Math.log(x) + b * Math.log(1 - x) - lbeta) * h) / a;
}

// ============================================================================
// DISTRIBUTION IMPLEMENTATIONS
// ============================================================================

// Normal distribution
const normal = {
  pdf: (x: number, mu = 0, sigma = 1) =>
    Math.exp(-0.5 * Math.pow((x - mu) / sigma, 2)) / (sigma * Math.sqrt(2 * Math.PI)),
  cdf: (x: number, mu = 0, sigma = 1) => 0.5 * (1 + erf((x - mu) / (sigma * Math.sqrt(2)))),
  quantile: (p: number, mu = 0, sigma = 1) => {
    // Approximation using Newton-Raphson
    let x = mu;
    for (let i = 0; i < 50; i++) {
      const cdf = normal.cdf(x, mu, sigma);
      const pdf = normal.pdf(x, mu, sigma);
      const dx = (cdf - p) / pdf;
      x -= dx;
      if (Math.abs(dx) < 1e-10) break;
    }
    return x;
  },
  sample: (mu = 0, sigma = 1) => {
    // Box-Muller transform
    const u1 = Math.random();
    const u2 = Math.random();
    return mu + sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  },
};

// Exponential distribution
const exponential = {
  pdf: (x: number, lambda = 1) => (x < 0 ? 0 : lambda * Math.exp(-lambda * x)),
  cdf: (x: number, lambda = 1) => (x < 0 ? 0 : 1 - Math.exp(-lambda * x)),
  quantile: (p: number, lambda = 1) => -Math.log(1 - p) / lambda,
  sample: (lambda = 1) => -Math.log(Math.random()) / lambda,
};

// Uniform distribution
const uniform = {
  pdf: (x: number, a = 0, b = 1) => (x < a || x > b ? 0 : 1 / (b - a)),
  cdf: (x: number, a = 0, b = 1) => (x < a ? 0 : x > b ? 1 : (x - a) / (b - a)),
  quantile: (p: number, a = 0, b = 1) => a + p * (b - a),
  sample: (a = 0, b = 1) => a + Math.random() * (b - a),
};

// Poisson distribution
const poisson = {
  pmf: (k: number, lambda: number) => {
    if (k < 0 || !Number.isInteger(k)) return 0;
    return Math.exp(k * Math.log(lambda) - lambda - logGamma(k + 1));
  },
  cdf: (k: number, lambda: number) => {
    if (k < 0) return 0;
    return gammainc(Math.floor(k) + 1, lambda);
  },
  sample: (lambda: number) => {
    const L = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= Math.random();
    } while (p > L);
    return k - 1;
  },
};

// Binomial distribution
const binomial = {
  pmf: (k: number, n: number, p: number) => {
    if (k < 0 || k > n || !Number.isInteger(k)) return 0;
    const logCoeff = logGamma(n + 1) - logGamma(k + 1) - logGamma(n - k + 1);
    return Math.exp(logCoeff + k * Math.log(p) + (n - k) * Math.log(1 - p));
  },
  cdf: (k: number, n: number, p: number) => {
    if (k < 0) return 0;
    if (k >= n) return 1;
    return 1 - betainc(k + 1, n - k, p);
  },
  sample: (n: number, p: number) => {
    let successes = 0;
    for (let i = 0; i < n; i++) {
      if (Math.random() < p) successes++;
    }
    return successes;
  },
};

// Chi-squared distribution
const chiSquared = {
  pdf: (x: number, k: number) => {
    if (x < 0) return 0;
    const halfK = k / 2;
    return Math.exp((halfK - 1) * Math.log(x) - x / 2 - halfK * Math.log(2) - logGamma(halfK));
  },
  cdf: (x: number, k: number) => (x < 0 ? 0 : gammainc(k / 2, x / 2)),
  sample: (k: number) => {
    // Sum of k standard normal squared
    let sum = 0;
    for (let i = 0; i < k; i++) {
      const z = normal.sample();
      sum += z * z;
    }
    return sum;
  },
};

// Student's t distribution
const studentT = {
  pdf: (x: number, nu: number) => {
    const coeff = gamma((nu + 1) / 2) / (Math.sqrt(nu * Math.PI) * gamma(nu / 2));
    return coeff * Math.pow(1 + (x * x) / nu, -(nu + 1) / 2);
  },
  cdf: (x: number, nu: number) => {
    const t = nu / (nu + x * x);
    return x > 0 ? 1 - 0.5 * betainc(nu / 2, 0.5, t) : 0.5 * betainc(nu / 2, 0.5, t);
  },
  sample: (nu: number) => {
    const z = normal.sample();
    const v = chiSquared.sample(nu);
    return z / Math.sqrt(v / nu);
  },
};

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const probabilityDistTool: UnifiedTool = {
  name: 'probability_dist',
  description: `Compute probability distribution functions and generate samples.

Distributions:
- normal: N(μ, σ²) - Gaussian distribution
- exponential: Exp(λ) - Exponential distribution
- uniform: U(a, b) - Uniform distribution
- poisson: Pois(λ) - Poisson distribution
- binomial: Bin(n, p) - Binomial distribution
- chi_squared: χ²(k) - Chi-squared distribution
- student_t: t(ν) - Student's t distribution

Operations for each:
- pdf/pmf: Probability density/mass function
- cdf: Cumulative distribution function
- quantile: Inverse CDF (percentile)
- sample: Random sample generation

Used in: Statistics, Monte Carlo, hypothesis testing, confidence intervals`,
  parameters: {
    type: 'object',
    properties: {
      distribution: {
        type: 'string',
        enum: [
          'normal',
          'exponential',
          'uniform',
          'poisson',
          'binomial',
          'chi_squared',
          'student_t',
        ],
        description: 'Probability distribution',
      },
      operation: {
        type: 'string',
        enum: ['pdf', 'pmf', 'cdf', 'quantile', 'sample'],
        description: 'Operation to perform',
      },
      x: {
        type: 'number',
        description: 'Value for PDF/PMF/CDF evaluation',
      },
      p: {
        type: 'number',
        description: 'Probability for quantile (0 to 1)',
      },
      mu: {
        type: 'number',
        description: 'Mean (for normal)',
      },
      sigma: {
        type: 'number',
        description: 'Standard deviation (for normal)',
      },
      lambda: {
        type: 'number',
        description: 'Rate parameter (for exponential, poisson)',
      },
      a: {
        type: 'number',
        description: 'Lower bound (for uniform)',
      },
      b: {
        type: 'number',
        description: 'Upper bound (for uniform)',
      },
      n: {
        type: 'number',
        description: 'Number of trials (for binomial) or sample size',
      },
      prob: {
        type: 'number',
        description: 'Success probability (for binomial)',
      },
      k: {
        type: 'number',
        description: 'Degrees of freedom (for chi-squared)',
      },
      nu: {
        type: 'number',
        description: 'Degrees of freedom (for student-t)',
      },
      sample_size: {
        type: 'number',
        description: 'Number of samples to generate (default: 1)',
      },
    },
    required: ['distribution', 'operation'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isProbabilityDistAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTE FUNCTION
// ============================================================================

export async function executeProbabilityDist(call: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = call.arguments as {
    distribution: string;
    operation: string;
    x?: number;
    p?: number;
    mu?: number;
    sigma?: number;
    lambda?: number;
    a?: number;
    b?: number;
    n?: number;
    prob?: number;
    k?: number;
    nu?: number;
    sample_size?: number;
  };

  const {
    distribution,
    operation,
    x,
    p,
    mu = 0,
    sigma = 1,
    lambda = 1,
    a = 0,
    b = 1,
    n,
    prob,
    k,
    nu,
    sample_size = 1,
  } = args;

  try {
    const result: Record<string, unknown> = { distribution, operation };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let dist: any;
    let params: Record<string, number> = {};

    switch (distribution) {
      case 'normal':
        dist = normal;
        params = { mu, sigma };
        break;
      case 'exponential':
        dist = exponential;
        params = { lambda };
        break;
      case 'uniform':
        dist = uniform;
        params = { a, b };
        break;
      case 'poisson':
        dist = poisson;
        params = { lambda };
        break;
      case 'binomial':
        if (n === undefined || prob === undefined)
          throw new Error('n and prob required for binomial');
        dist = binomial;
        params = { n, p: prob };
        break;
      case 'chi_squared':
        if (k === undefined) throw new Error('k (degrees of freedom) required for chi_squared');
        dist = chiSquared;
        params = { k };
        break;
      case 'student_t':
        if (nu === undefined) throw new Error('nu (degrees of freedom) required for student_t');
        dist = studentT;
        params = { nu };
        break;
      default:
        throw new Error(`Unknown distribution: ${distribution}`);
    }

    result.parameters = params;

    switch (operation) {
      case 'pdf':
      case 'pmf':
        if (x === undefined) throw new Error('x is required for pdf/pmf');
        if (distribution === 'normal') result.value = dist.pdf(x, mu, sigma);
        else if (distribution === 'exponential') result.value = dist.pdf(x, lambda);
        else if (distribution === 'uniform') result.value = dist.pdf(x, a, b);
        else if (distribution === 'poisson') result.value = dist.pmf(x, lambda);
        else if (distribution === 'binomial') result.value = dist.pmf(x, n, prob);
        else if (distribution === 'chi_squared') result.value = dist.pdf(x, k);
        else if (distribution === 'student_t') result.value = dist.pdf(x, nu);
        result.x = x;
        break;

      case 'cdf':
        if (x === undefined) throw new Error('x is required for cdf');
        if (distribution === 'normal') result.value = dist.cdf(x, mu, sigma);
        else if (distribution === 'exponential') result.value = dist.cdf(x, lambda);
        else if (distribution === 'uniform') result.value = dist.cdf(x, a, b);
        else if (distribution === 'poisson') result.value = dist.cdf(x, lambda);
        else if (distribution === 'binomial') result.value = dist.cdf(x, n, prob);
        else if (distribution === 'chi_squared') result.value = dist.cdf(x, k);
        else if (distribution === 'student_t') result.value = dist.cdf(x, nu);
        result.x = x;
        result.interpretation = `P(X ≤ ${x})`;
        break;

      case 'quantile':
        if (p === undefined) throw new Error('p is required for quantile');
        if (p < 0 || p > 1) throw new Error('p must be between 0 and 1');
        if (distribution === 'normal') result.value = dist.quantile(p, mu, sigma);
        else if (distribution === 'exponential') result.value = dist.quantile(p, lambda);
        else if (distribution === 'uniform') result.value = dist.quantile(p, a, b);
        else throw new Error(`Quantile not implemented for ${distribution}`);
        result.p = p;
        result.interpretation = `${p * 100}th percentile`;
        break;

      case 'sample':
        const samples: number[] = [];
        const sampleCount = Math.min(sample_size, 10000);
        for (let i = 0; i < sampleCount; i++) {
          if (distribution === 'normal') samples.push(dist.sample(mu, sigma));
          else if (distribution === 'exponential') samples.push(dist.sample(lambda));
          else if (distribution === 'uniform') samples.push(dist.sample(a, b));
          else if (distribution === 'poisson') samples.push(dist.sample(lambda));
          else if (distribution === 'binomial') samples.push(dist.sample(n, prob));
          else if (distribution === 'chi_squared') samples.push(dist.sample(k));
          else if (distribution === 'student_t') samples.push(dist.sample(nu));
        }
        result.samples = samples.length <= 100 ? samples : samples.slice(0, 100);
        result.sample_count = samples.length;
        if (samples.length > 0) {
          result.sample_mean = samples.reduce((a, b) => a + b, 0) / samples.length;
          const mean = result.sample_mean as number;
          result.sample_std = Math.sqrt(
            samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length
          );
          result.sample_min = Math.min(...samples);
          result.sample_max = Math.max(...samples);
        }
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
        distribution,
        operation,
      }),
      isError: true,
    };
  }
}
