/**
 * ROOT-LOCUS TOOL
 * Root locus analysis for control system design
 *
 * Implements root locus plotting and analysis for understanding
 * how closed-loop pole locations vary with gain K.
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Complex number operations
interface Complex {
  real: number;
  imag: number;
}

function complexAdd(a: Complex, b: Complex): Complex {
  return { real: a.real + b.real, imag: a.imag + b.imag };
}

function complexSubtract(a: Complex, b: Complex): Complex {
  return { real: a.real - b.real, imag: a.imag - b.imag };
}

function complexMultiply(a: Complex, b: Complex): Complex {
  return {
    real: a.real * b.real - a.imag * b.imag,
    imag: a.real * b.imag + a.imag * b.real
  };
}

function complexDivide(a: Complex, b: Complex): Complex {
  const denom = b.real * b.real + b.imag * b.imag;
  if (denom === 0) return { real: Infinity, imag: Infinity };
  return {
    real: (a.real * b.real + a.imag * b.imag) / denom,
    imag: (a.imag * b.real - a.real * b.imag) / denom
  };
}

function complexMagnitude(c: Complex): number {
  return Math.sqrt(c.real * c.real + c.imag * c.imag);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function complexPhase(c: Complex): number {
  return Math.atan2(c.imag, c.real);
}

function complexFromPolar(mag: number, phase: number): Complex {
  return { real: mag * Math.cos(phase), imag: mag * Math.sin(phase) };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function complexScale(c: Complex, s: number): Complex {
  return { real: c.real * s, imag: c.imag * s };
}

// Polynomial operations
function evaluatePolynomial(coeffs: number[], s: Complex): Complex {
  let result: Complex = { real: 0, imag: 0 };
  for (const coeff of coeffs) {
    result = complexMultiply(result, s);
    result = complexAdd(result, { real: coeff, imag: 0 });
  }
  return result;
}

// Polynomial derivative
function polynomialDerivative(coeffs: number[]): number[] {
  if (coeffs.length <= 1) return [0];
  const result: number[] = [];
  for (let i = 0; i < coeffs.length - 1; i++) {
    result.push(coeffs[i] * (coeffs.length - 1 - i));
  }
  return result;
}

// Add two polynomials (same format: highest degree first)
function addPolynomials(a: number[], b: number[]): number[] {
  const maxLen = Math.max(a.length, b.length);
  const result: number[] = Array(maxLen).fill(0);
  for (let i = 0; i < a.length; i++) {
    result[maxLen - a.length + i] += a[i];
  }
  for (let i = 0; i < b.length; i++) {
    result[maxLen - b.length + i] += b[i];
  }
  return result;
}

// Multiply polynomial by scalar
function scalePolynomial(coeffs: number[], scalar: number): number[] {
  return coeffs.map(c => c * scalar);
}

// Multiply two polynomials
function multiplyPolynomials(a: number[], b: number[]): number[] {
  const result: number[] = Array(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      result[i + j] += a[i] * b[j];
    }
  }
  return result;
}

// Find roots of polynomial using Durand-Kerner method
function findPolynomialRoots(coeffs: number[]): Complex[] {
  if (coeffs.length <= 1) return [];

  // Normalize by leading coefficient
  const lead = coeffs[0];
  if (lead === 0) return findPolynomialRoots(coeffs.slice(1));

  const normalized = coeffs.map(c => c / lead);

  if (normalized.length === 2) {
    return [{ real: -normalized[1], imag: 0 }];
  }

  if (normalized.length === 3) {
    const a = 1, b = normalized[1], c = normalized[2];
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const sqrtDisc = Math.sqrt(disc);
      return [
        { real: (-b + sqrtDisc) / 2, imag: 0 },
        { real: (-b - sqrtDisc) / 2, imag: 0 }
      ];
    } else {
      const realPart = -b / 2;
      const imagPart = Math.sqrt(-disc) / 2;
      return [
        { real: realPart, imag: imagPart },
        { real: realPart, imag: -imagPart }
      ];
    }
  }

  const n = normalized.length - 1;
  const roots: Complex[] = [];

  // Initialize with evenly spaced points on a circle
  const maxCoeff = Math.max(...normalized.map(Math.abs));
  const radius = 1 + maxCoeff;

  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n + 0.1;
    roots.push(complexFromPolar(radius, angle));
  }

  // Iterate Durand-Kerner
  for (let iter = 0; iter < 200; iter++) {
    let maxChange = 0;
    for (let i = 0; i < n; i++) {
      const p = evaluatePolynomial(normalized, roots[i]);
      let denom: Complex = { real: 1, imag: 0 };
      for (let j = 0; j < n; j++) {
        if (i !== j) {
          denom = complexMultiply(denom, complexSubtract(roots[i], roots[j]));
        }
      }
      if (complexMagnitude(denom) > 1e-15) {
        const delta = complexDivide(p, denom);
        roots[i] = complexSubtract(roots[i], delta);
        maxChange = Math.max(maxChange, complexMagnitude(delta));
      }
    }
    if (maxChange < 1e-12) break;
  }

  return roots;
}

// Find closed-loop poles for a given K
// Characteristic equation: D(s) + K*N(s) = 0
function findClosedLoopPoles(numerator: number[], denominator: number[], K: number): Complex[] {
  const charPoly = addPolynomials(denominator, scalePolynomial(numerator, K));
  return findPolynomialRoots(charPoly);
}

// Calculate asymptotes of root locus
function calculateAsymptotes(
  poles: Complex[],
  zeros: Complex[]
): { angles: number[]; centroid: Complex } {
  const n = poles.length;
  const m = zeros.length;
  const numAsymptotes = n - m;

  if (numAsymptotes <= 0) {
    return { angles: [], centroid: { real: 0, imag: 0 } };
  }

  // Centroid = (sum of poles - sum of zeros) / (n - m)
  let sumPoles: Complex = { real: 0, imag: 0 };
  for (const p of poles) {
    sumPoles = complexAdd(sumPoles, p);
  }

  let sumZeros: Complex = { real: 0, imag: 0 };
  for (const z of zeros) {
    sumZeros = complexAdd(sumZeros, z);
  }

  const centroid: Complex = {
    real: (sumPoles.real - sumZeros.real) / numAsymptotes,
    imag: 0  // Centroid is always on real axis for real coefficients
  };

  // Angles = (2k + 1) * 180° / (n - m) for k = 0, 1, ..., n-m-1
  const angles: number[] = [];
  for (let k = 0; k < numAsymptotes; k++) {
    angles.push((2 * k + 1) * 180 / numAsymptotes);
  }

  return { angles, centroid };
}

// Calculate angle contribution at a point
function angleContribution(point: Complex, poleOrZero: Complex): number {
  const diff = complexSubtract(point, poleOrZero);
  return Math.atan2(diff.imag, diff.real) * 180 / Math.PI;
}

// Check if a point is on the root locus using angle criterion
function checkAngleCriterion(
  point: Complex,
  poles: Complex[],
  zeros: Complex[]
): { sumAngles: number; isOnLocus: boolean } {
  let sumZeroAngles = 0;
  for (const z of zeros) {
    sumZeroAngles += angleContribution(point, z);
  }

  let sumPoleAngles = 0;
  for (const p of poles) {
    sumPoleAngles += angleContribution(point, p);
  }

  // Angle criterion: sum(zero angles) - sum(pole angles) = (2k+1) * 180°
  let totalAngle = sumZeroAngles - sumPoleAngles;

  // Normalize to -180 to 180
  while (totalAngle > 180) totalAngle -= 360;
  while (totalAngle < -180) totalAngle += 360;

  // Check if close to ±180° (within tolerance)
  const isOnLocus = Math.abs(Math.abs(totalAngle) - 180) < 5;

  return { sumAngles: totalAngle, isOnLocus };
}

// Find breakaway/break-in points on real axis
function findBreakawayPoints(
  numerator: number[],
  denominator: number[]
): Complex[] {
  // Breakaway points occur where dK/ds = 0
  // K = -D(s)/N(s), so dK/ds = 0 where N(s)*D'(s) - D(s)*N'(s) = 0

  const Nd = polynomialDerivative(numerator);
  const Dd = polynomialDerivative(denominator);

  // N(s)*D'(s)
  const term1 = multiplyPolynomials(numerator, Dd);
  // D(s)*N'(s)
  const term2 = multiplyPolynomials(denominator, Nd);
  // N(s)*D'(s) - D(s)*N'(s)
  const breakPoly = addPolynomials(term1, scalePolynomial(term2, -1));

  const candidates = findPolynomialRoots(breakPoly);

  // Filter for real-axis points that are on root locus
  const poles = findPolynomialRoots(denominator);
  const zeros = findPolynomialRoots(numerator);

  const breakawayPoints: Complex[] = [];

  for (const candidate of candidates) {
    // Only consider points very close to real axis
    if (Math.abs(candidate.imag) < 0.01) {
      // Check if on root locus segment of real axis
      // Point is on real-axis root locus if odd number of poles+zeros to its right
      let countToRight = 0;
      for (const p of poles) {
        if (Math.abs(p.imag) < 1e-6 && p.real > candidate.real) countToRight++;
      }
      for (const z of zeros) {
        if (Math.abs(z.imag) < 1e-6 && z.real > candidate.real) countToRight++;
      }

      if (countToRight % 2 === 1) {
        breakawayPoints.push({ real: candidate.real, imag: 0 });
      }
    }
  }

  return breakawayPoints;
}

// Calculate K value for a given point on root locus
function calculateKAtPoint(
  point: Complex,
  numerator: number[],
  denominator: number[]
): number {
  const numVal = evaluatePolynomial(numerator, point);
  const denVal = evaluatePolynomial(denominator, point);

  if (complexMagnitude(numVal) < 1e-15) return Infinity;

  // K = -D(s)/N(s) at point on locus, magnitude gives K
  const ratio = complexDivide(denVal, numVal);
  return complexMagnitude(ratio);
}

// Calculate angles of departure from complex poles
function calculateDepartureAngles(
  poles: Complex[],
  zeros: Complex[]
): { pole: Complex; angle: number }[] {
  const results: { pole: Complex; angle: number }[] = [];

  for (let i = 0; i < poles.length; i++) {
    const pole = poles[i];
    // Only for complex poles
    if (Math.abs(pole.imag) > 1e-6) {
      // Angle criterion: sum(zero angles) - sum(other pole angles) - departure = (2k+1)*180
      let sumZeroAngles = 0;
      for (const z of zeros) {
        sumZeroAngles += angleContribution(pole, z);
      }

      let sumOtherPoleAngles = 0;
      for (let j = 0; j < poles.length; j++) {
        if (i !== j) {
          sumOtherPoleAngles += angleContribution(pole, poles[j]);
        }
      }

      // departure = sum(zero angles) - sum(other pole angles) - 180
      let departure = sumZeroAngles - sumOtherPoleAngles - 180;
      while (departure > 180) departure -= 360;
      while (departure < -180) departure += 360;

      results.push({ pole, angle: departure });
    }
  }

  return results;
}

// Calculate angles of arrival at complex zeros
function calculateArrivalAngles(
  poles: Complex[],
  zeros: Complex[]
): { zero: Complex; angle: number }[] {
  const results: { zero: Complex; angle: number }[] = [];

  for (let i = 0; i < zeros.length; i++) {
    const zero = zeros[i];
    // Only for complex zeros
    if (Math.abs(zero.imag) > 1e-6) {
      // Angle criterion: sum(other zero angles) - sum(pole angles) + arrival = (2k+1)*180
      let sumPoleAngles = 0;
      for (const p of poles) {
        sumPoleAngles += angleContribution(zero, p);
      }

      let sumOtherZeroAngles = 0;
      for (let j = 0; j < zeros.length; j++) {
        if (i !== j) {
          sumOtherZeroAngles += angleContribution(zero, zeros[j]);
        }
      }

      // arrival = 180 + sum(pole angles) - sum(other zero angles)
      let arrival = 180 + sumPoleAngles - sumOtherZeroAngles;
      while (arrival > 180) arrival -= 360;
      while (arrival < -180) arrival += 360;

      results.push({ zero, angle: arrival });
    }
  }

  return results;
}

// Generate root locus plot data
function generateRootLocus(
  numerator: number[],
  denominator: number[],
  options: { kMin?: number; kMax?: number; numPoints?: number } = {}
): { K: number; poles: Complex[] }[] {
  const kMin = options.kMin || 0;
  const kMax = options.kMax || 100;
  const numPoints = options.numPoints || 200;

  const results: { K: number; poles: Complex[] }[] = [];

  // Use logarithmic spacing for better resolution at small K
  for (let i = 0; i <= numPoints; i++) {
    let K: number;
    if (kMin === 0) {
      // Can't use log for 0, use linear for first portion
      if (i < numPoints / 10) {
        K = (kMax / 100) * (i / (numPoints / 10));
      } else {
        const t = (i - numPoints / 10) / (numPoints * 0.9);
        K = (kMax / 100) * Math.pow(kMax / (kMax / 100), t);
      }
    } else {
      const t = i / numPoints;
      K = kMin * Math.pow(kMax / kMin, t);
    }

    const poles = findClosedLoopPoles(numerator, denominator, K);
    results.push({ K, poles });
  }

  return results;
}

// Find K value for specific damping ratio
function findKForDampingRatio(
  numerator: number[],
  denominator: number[],
  zeta: number,
  kMax: number = 1000
): { K: number; poles: Complex[] } | null {
  // Damping ratio corresponds to angle from negative real axis
  // zeta = cos(theta), where theta is angle from negative real axis
  const targetAngle = Math.acos(zeta);

  // Search through K values
  for (let K = 0.01; K <= kMax; K *= 1.1) {
    const poles = findClosedLoopPoles(numerator, denominator, K);

    for (const pole of poles) {
      if (pole.imag > 0) {  // Only consider upper half
        const angle = Math.PI - Math.atan2(pole.imag, -pole.real);
        if (Math.abs(angle - targetAngle) < 0.05) {
          return { K, poles };
        }
      }
    }
  }

  return null;
}

// ASCII visualization of root locus
function visualizeRootLocus(
  numerator: number[],
  denominator: number[],
  width: number = 60,
  height: number = 30
): string {
  const locusData = generateRootLocus(numerator, denominator, { kMax: 50, numPoints: 100 });
  const poles = findPolynomialRoots(denominator);
  const zeros = findPolynomialRoots(numerator);

  // Collect all points
  const allPoints: Complex[] = [...poles, ...zeros];
  for (const data of locusData) {
    allPoints.push(...data.poles);
  }

  // Find bounds
  let minReal = Infinity, maxReal = -Infinity;
  let minImag = Infinity, maxImag = -Infinity;

  for (const p of allPoints) {
    if (Math.abs(p.real) < 50 && Math.abs(p.imag) < 50) {
      minReal = Math.min(minReal, p.real);
      maxReal = Math.max(maxReal, p.real);
      minImag = Math.min(minImag, p.imag);
      maxImag = Math.max(maxImag, p.imag);
    }
  }

  // Ensure symmetric about real axis and include origin
  const maxExtent = Math.max(Math.abs(minReal), Math.abs(maxReal), Math.abs(minImag), Math.abs(maxImag), 2);
  minReal = -maxExtent * 1.2;
  maxReal = maxExtent * 0.5;
  minImag = -maxExtent * 1.2;
  maxImag = maxExtent * 1.2;

  // Create grid
  const grid: string[][] = Array(height).fill(null).map(() => Array(width).fill(' '));

  const toGridX = (x: number) => Math.round((x - minReal) / (maxReal - minReal) * (width - 1));
  const toGridY = (y: number) => Math.round((maxImag - y) / (maxImag - minImag) * (height - 1));

  // Draw axes
  const originX = toGridX(0);
  const originY = toGridY(0);

  if (originX >= 0 && originX < width) {
    for (let y = 0; y < height; y++) {
      grid[y][originX] = '│';
    }
  }

  if (originY >= 0 && originY < height) {
    for (let x = 0; x < width; x++) {
      grid[originY][x] = '─';
    }
    if (originX >= 0 && originX < width) {
      grid[originY][originX] = '┼';
    }
  }

  // Plot root locus
  for (const data of locusData) {
    for (const pole of data.poles) {
      const x = toGridX(pole.real);
      const y = toGridY(pole.imag);
      if (x >= 0 && x < width && y >= 0 && y < height) {
        if (grid[y][x] === ' ' || grid[y][x] === '─' || grid[y][x] === '│') {
          grid[y][x] = '·';
        }
      }
    }
  }

  // Mark open-loop poles (X)
  for (const p of poles) {
    const x = toGridX(p.real);
    const y = toGridY(p.imag);
    if (x >= 0 && x < width && y >= 0 && y < height) {
      grid[y][x] = '×';
    }
  }

  // Mark open-loop zeros (O)
  for (const z of zeros) {
    const x = toGridX(z.real);
    const y = toGridY(z.imag);
    if (x >= 0 && x < width && y >= 0 && y < height) {
      grid[y][x] = 'o';
    }
  }

  // Convert to string
  let result = '╔' + '═'.repeat(width) + '╗\n';
  for (const row of grid) {
    result += '║' + row.join('') + '║\n';
  }
  result += '╚' + '═'.repeat(width) + '╝\n';
  result += `Legend: × = pole, o = zero, · = root locus\n`;
  result += `Real axis: [${minReal.toFixed(2)}, ${maxReal.toFixed(2)}], Imag axis: [${minImag.toFixed(2)}, ${maxImag.toFixed(2)}]`;

  return result;
}

// Example systems
const EXAMPLE_SYSTEMS: Record<string, { numerator: number[]; denominator: number[]; description: string }> = {
  'simple': {
    numerator: [1],
    denominator: [1, 3, 2],  // (s+1)(s+2)
    description: 'Simple second-order: G(s) = 1/((s+1)(s+2))'
  },
  'type1': {
    numerator: [1],
    denominator: [1, 3, 2, 0],  // s(s+1)(s+2)
    description: 'Type 1 system: G(s) = 1/(s(s+1)(s+2))'
  },
  'with_zero': {
    numerator: [1, 2],  // (s+2)
    denominator: [1, 4, 3],  // (s+1)(s+3)
    description: 'System with zero: G(s) = (s+2)/((s+1)(s+3))'
  },
  'complex_poles': {
    numerator: [1],
    denominator: [1, 2, 5],  // s² + 2s + 5 (poles at -1±2j)
    description: 'Complex poles: G(s) = 1/(s² + 2s + 5)'
  },
  'third_order': {
    numerator: [1],
    denominator: [1, 6, 11, 6],  // (s+1)(s+2)(s+3)
    description: 'Third-order: G(s) = 1/((s+1)(s+2)(s+3))'
  }
};

export const rootlocusTool: UnifiedTool = {
  name: 'root_locus',
  description: `Root locus analysis for control system design.

Plots and analyzes how closed-loop pole locations change with gain K
for the characteristic equation: 1 + K·G(s) = 0

Features:
- Plot root locus branches
- Find open-loop poles and zeros
- Calculate asymptotes (angles and centroid)
- Find breakaway/break-in points
- Calculate angles of departure/arrival
- Find K for desired pole locations
- Design for damping ratio specifications
- ASCII visualization

Transfer function format: coefficients from highest to lowest degree
Example: [1, 2, 3] represents s² + 2s + 3`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['plot', 'analyze', 'asymptotes', 'breakaway', 'departure', 'design', 'k_at_point', 'visualize', 'examples', 'info'],
        description: 'Operation to perform'
      },
      numerator: {
        type: 'array',
        items: { type: 'number' },
        description: 'Numerator polynomial coefficients [highest degree first]'
      },
      denominator: {
        type: 'array',
        items: { type: 'number' },
        description: 'Denominator polynomial coefficients [highest degree first]'
      },
      example: {
        type: 'string',
        enum: ['simple', 'type1', 'with_zero', 'complex_poles', 'third_order'],
        description: 'Use example system'
      },
      K: { type: 'number', description: 'Gain value for closed-loop analysis' },
      k_max: { type: 'number', description: 'Maximum K for root locus plot (default: 100)' },
      point: {
        type: 'object',
        properties: {
          real: { type: 'number' },
          imag: { type: 'number' }
        },
        description: 'Point in s-plane for K calculation'
      },
      damping_ratio: { type: 'number', description: 'Desired damping ratio (0 < zeta < 1)' }
    },
    required: ['operation']
  }
};

export async function executerootlocus(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, example, K, k_max, point, damping_ratio } = args;

    // Get transfer function coefficients
    let numerator = args.numerator || [1];
    let denominator = args.denominator || [1, 3, 2];
    let systemDescription = 'Custom system';

    if (example && EXAMPLE_SYSTEMS[example]) {
      const sys = EXAMPLE_SYSTEMS[example];
      numerator = sys.numerator;
      denominator = sys.denominator;
      systemDescription = sys.description;
    }

    const poles = findPolynomialRoots(denominator);
    const zeros = findPolynomialRoots(numerator);

    switch (operation) {
      case 'plot': {
        const locusData = generateRootLocus(numerator, denominator, { kMax: k_max || 100 });

        // Sample key K values
        const keyKValues = [0, 1, 5, 10, 50, k_max || 100];
        const sampledData = keyKValues.map(targetK => {
          const closest = locusData.reduce((prev, curr) =>
            Math.abs(curr.K - targetK) < Math.abs(prev.K - targetK) ? curr : prev
          );
          return {
            K: closest.K.toFixed(4),
            poles: closest.poles.map(p => ({
              real: p.real.toFixed(4),
              imag: p.imag.toFixed(4),
              stable: p.real < 0
            }))
          };
        });

        return {
          toolCallId: id,
          content: JSON.stringify({
            system: systemDescription,
            numerator,
            denominator,
            open_loop_poles: poles.map(p => ({ real: p.real.toFixed(4), imag: p.imag.toFixed(4) })),
            open_loop_zeros: zeros.map(z => ({ real: z.real.toFixed(4), imag: z.imag.toFixed(4) })),
            root_locus_samples: sampledData,
            total_data_points: locusData.length,
            k_range: { min: 0, max: k_max || 100 }
          }, null, 2)
        };
      }

      case 'analyze': {
        const asymptotes = calculateAsymptotes(poles, zeros);
        const breakaway = findBreakawayPoints(numerator, denominator);
        const departure = calculateDepartureAngles(poles, zeros);
        const arrival = calculateArrivalAngles(poles, zeros);

        // Find K for marginal stability (if any)
        let kMarginal: number | null = null;
        for (let testK = 0.1; testK <= 1000; testK *= 1.1) {
          const clPoles = findClosedLoopPoles(numerator, denominator, testK);
          const hasImagAxis = clPoles.some(p => Math.abs(p.real) < 0.01 && Math.abs(p.imag) > 0.01);
          if (hasImagAxis) {
            kMarginal = testK;
            break;
          }
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            system: systemDescription,
            numerator,
            denominator,
            open_loop_poles: poles.map(p => ({
              real: p.real.toFixed(4),
              imag: p.imag.toFixed(4),
              type: Math.abs(p.imag) < 1e-6 ? 'real' : 'complex'
            })),
            open_loop_zeros: zeros.map(z => ({
              real: z.real.toFixed(4),
              imag: z.imag.toFixed(4)
            })),
            root_locus_rules: {
              number_of_branches: poles.length,
              branches_start_at: 'open-loop poles (K=0)',
              branches_end_at: `${zeros.length} zeros and ${poles.length - zeros.length} asymptotes (K→∞)`
            },
            asymptotes: {
              angles_degrees: asymptotes.angles,
              centroid: { real: asymptotes.centroid.real.toFixed(4), imag: '0' }
            },
            breakaway_points: breakaway.map(b => ({ real: b.real.toFixed(4) })),
            departure_angles: departure.map(d => ({
              from_pole: { real: d.pole.real.toFixed(4), imag: d.pole.imag.toFixed(4) },
              angle_degrees: d.angle.toFixed(2)
            })),
            arrival_angles: arrival.map(a => ({
              at_zero: { real: a.zero.real.toFixed(4), imag: a.zero.imag.toFixed(4) },
              angle_degrees: a.angle.toFixed(2)
            })),
            marginal_stability_K: kMarginal ? kMarginal.toFixed(4) : 'Not found in range'
          }, null, 2)
        };
      }

      case 'asymptotes': {
        const asymptotes = calculateAsymptotes(poles, zeros);

        return {
          toolCallId: id,
          content: JSON.stringify({
            system: systemDescription,
            number_of_poles: poles.length,
            number_of_zeros: zeros.length,
            number_of_asymptotes: poles.length - zeros.length,
            asymptotes: {
              formula: {
                angles: '(2k+1)×180° / (n-m) for k = 0, 1, ..., n-m-1',
                centroid: '(Σpoles - Σzeros) / (n-m)'
              },
              angles_degrees: asymptotes.angles,
              centroid_real: asymptotes.centroid.real.toFixed(4)
            },
            interpretation: asymptotes.angles.some(a => a === 90 || a === 270)
              ? 'Asymptotes along imaginary axis - system can become unstable'
              : 'All asymptotes in left half-plane contributes to stability'
          }, null, 2)
        };
      }

      case 'breakaway': {
        const breakaway = findBreakawayPoints(numerator, denominator);

        // Calculate K at each breakaway point
        const breakawayWithK = breakaway.map(b => ({
          point: { real: b.real.toFixed(4) },
          K_value: calculateKAtPoint(b, numerator, denominator).toFixed(4)
        }));

        return {
          toolCallId: id,
          content: JSON.stringify({
            system: systemDescription,
            breakaway_points: breakawayWithK,
            method: 'Breakaway occurs where dK/ds = 0, solved via N(s)D\'(s) - D(s)N\'(s) = 0',
            interpretation: 'Points where root locus branches leave/enter real axis'
          }, null, 2)
        };
      }

      case 'departure': {
        const departure = calculateDepartureAngles(poles, zeros);
        const arrival = calculateArrivalAngles(poles, zeros);

        return {
          toolCallId: id,
          content: JSON.stringify({
            system: systemDescription,
            angles_of_departure: departure.length > 0 ? departure.map(d => ({
              from_complex_pole: { real: d.pole.real.toFixed(4), imag: d.pole.imag.toFixed(4) },
              departure_angle_degrees: d.angle.toFixed(2)
            })) : 'No complex poles',
            angles_of_arrival: arrival.length > 0 ? arrival.map(a => ({
              at_complex_zero: { real: a.zero.real.toFixed(4), imag: a.zero.imag.toFixed(4) },
              arrival_angle_degrees: a.angle.toFixed(2)
            })) : 'No complex zeros',
            formula: {
              departure: 'θd = Σ(zero angles) - Σ(other pole angles) - 180°',
              arrival: 'θa = 180° + Σ(pole angles) - Σ(other zero angles)'
            }
          }, null, 2)
        };
      }

      case 'design': {
        if (damping_ratio !== undefined) {
          if (damping_ratio <= 0 || damping_ratio >= 1) {
            return {
              toolCallId: id,
              content: JSON.stringify({
                error: 'Damping ratio must be between 0 and 1'
              }, null, 2),
              isError: true
            };
          }

          const result = findKForDampingRatio(numerator, denominator, damping_ratio);

          if (result) {
            return {
              toolCallId: id,
              content: JSON.stringify({
                system: systemDescription,
                design_specification: {
                  damping_ratio: damping_ratio,
                  corresponding_angle_degrees: Math.acos(damping_ratio) * 180 / Math.PI
                },
                solution: {
                  K: result.K.toFixed(4),
                  closed_loop_poles: result.poles.map(p => ({
                    real: p.real.toFixed(4),
                    imag: p.imag.toFixed(4),
                    stable: p.real < 0
                  }))
                }
              }, null, 2)
            };
          } else {
            return {
              toolCallId: id,
              content: JSON.stringify({
                system: systemDescription,
                design_specification: { damping_ratio },
                result: 'No K value found that achieves specified damping ratio'
              }, null, 2)
            };
          }
        }

        if (K !== undefined) {
          const clPoles = findClosedLoopPoles(numerator, denominator, K);
          const allStable = clPoles.every(p => p.real < 0);

          return {
            toolCallId: id,
            content: JSON.stringify({
              system: systemDescription,
              gain_K: K,
              closed_loop_poles: clPoles.map(p => {
                const mag = complexMagnitude(p);
                const dampingRatio = Math.abs(p.imag) > 1e-6 ? -p.real / mag : 1;
                return {
                  real: p.real.toFixed(4),
                  imag: p.imag.toFixed(4),
                  magnitude: mag.toFixed(4),
                  damping_ratio: dampingRatio.toFixed(4),
                  stable: p.real < 0
                };
              }),
              system_stable: allStable
            }, null, 2)
          };
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            error: 'Provide K or damping_ratio parameter for design'
          }, null, 2),
          isError: true
        };
      }

      case 'k_at_point': {
        if (!point || point.real === undefined) {
          return {
            toolCallId: id,
            content: JSON.stringify({
              error: 'Provide point parameter with real and imag values'
            }, null, 2),
            isError: true
          };
        }

        const testPoint: Complex = { real: point.real, imag: point.imag || 0 };
        const { sumAngles, isOnLocus } = checkAngleCriterion(testPoint, poles, zeros);
        const kValue = calculateKAtPoint(testPoint, numerator, denominator);

        return {
          toolCallId: id,
          content: JSON.stringify({
            system: systemDescription,
            test_point: { real: testPoint.real, imag: testPoint.imag },
            angle_criterion: {
              sum_of_angles: sumAngles.toFixed(2),
              required: '±180° (odd multiple)',
              is_on_root_locus: isOnLocus
            },
            K_value: isOnLocus ? kValue.toFixed(4) : 'N/A (not on locus)'
          }, null, 2)
        };
      }

      case 'visualize': {
        const visualization = visualizeRootLocus(numerator, denominator);
        const asymptotes = calculateAsymptotes(poles, zeros);

        return {
          toolCallId: id,
          content: JSON.stringify({
            system: systemDescription,
            numerator,
            denominator,
            ascii_root_locus: visualization,
            summary: {
              poles: poles.length,
              zeros: zeros.length,
              asymptotes: asymptotes.angles.length,
              asymptote_angles: asymptotes.angles
            }
          }, null, 2)
        };
      }

      case 'examples': {
        const examples = Object.entries(EXAMPLE_SYSTEMS).map(([key, sys]) => {
          const p = findPolynomialRoots(sys.denominator);
          const z = findPolynomialRoots(sys.numerator);
          return {
            name: key,
            description: sys.description,
            numerator: sys.numerator,
            denominator: sys.denominator,
            poles: p.length,
            zeros: z.length
          };
        });

        return {
          toolCallId: id,
          content: JSON.stringify({
            example_systems: examples,
            usage: 'Use example parameter to analyze these systems'
          }, null, 2)
        };
      }

      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'root_locus',
            description: 'Root locus analysis for control system design',
            theory: {
              characteristic_equation: '1 + K·G(s) = 0, or D(s) + K·N(s) = 0',
              angle_criterion: 'Point s is on locus if ∠G(s) = (2k+1)×180°',
              magnitude_criterion: 'K = 1/|G(s)| at any point on locus'
            },
            root_locus_rules: [
              '1. n branches start at open-loop poles (K=0)',
              '2. m branches end at open-loop zeros (K→∞)',
              '3. n-m branches go to infinity along asymptotes',
              '4. Locus is symmetric about real axis',
              '5. Real-axis locus: to left of odd number of poles+zeros'
            ],
            operations: {
              plot: 'Generate root locus data points',
              analyze: 'Complete root locus analysis',
              asymptotes: 'Calculate asymptote angles and centroid',
              breakaway: 'Find breakaway/break-in points',
              departure: 'Calculate departure/arrival angles',
              design: 'Find K for damping ratio or analyze specific K',
              k_at_point: 'Calculate K at specific s-plane point',
              visualize: 'ASCII visualization of root locus',
              examples: 'List available example systems'
            }
          }, null, 2)
        };
      }

      default:
        return {
          toolCallId: id,
          content: `Unknown operation: ${operation}. Use 'info' for available operations.`,
          isError: true
        };
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isrootlocusAvailable(): boolean {
  return true;
}
