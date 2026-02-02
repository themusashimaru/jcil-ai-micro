/**
 * NYQUIST-PLOT TOOL
 * Nyquist stability analysis for control systems
 *
 * Implements frequency response analysis using the Nyquist stability criterion
 * to determine closed-loop stability from open-loop transfer function.
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

function complexPhase(c: Complex): number {
  return Math.atan2(c.imag, c.real);
}

function complexFromPolar(mag: number, phase: number): Complex {
  return { real: mag * Math.cos(phase), imag: mag * Math.sin(phase) };
}

// Evaluate polynomial at complex point s
function evaluatePolynomial(coeffs: number[], s: Complex): Complex {
  // coeffs[0] is highest degree coefficient
  let result: Complex = { real: 0, imag: 0 };
  for (const coeff of coeffs) {
    result = complexMultiply(result, s);
    result = complexAdd(result, { real: coeff, imag: 0 });
  }
  return result;
}

// Evaluate transfer function G(s) = num(s) / den(s) at complex s
function evaluateTransferFunction(
  numerator: number[],
  denominator: number[],
  s: Complex
): Complex {
  const num = evaluatePolynomial(numerator, s);
  const den = evaluatePolynomial(denominator, s);
  return complexDivide(num, den);
}

// Find roots of polynomial using companion matrix eigenvalues (simplified)
function findPolynomialRoots(coeffs: number[]): Complex[] {
  if (coeffs.length <= 1) return [];
  if (coeffs.length === 2) {
    // Linear: ax + b = 0 => x = -b/a
    return [{ real: -coeffs[1] / coeffs[0], imag: 0 }];
  }
  if (coeffs.length === 3) {
    // Quadratic: ax² + bx + c = 0
    const a = coeffs[0], b = coeffs[1], c = coeffs[2];
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const sqrtDisc = Math.sqrt(disc);
      return [
        { real: (-b + sqrtDisc) / (2 * a), imag: 0 },
        { real: (-b - sqrtDisc) / (2 * a), imag: 0 }
      ];
    } else {
      const realPart = -b / (2 * a);
      const imagPart = Math.sqrt(-disc) / (2 * a);
      return [
        { real: realPart, imag: imagPart },
        { real: realPart, imag: -imagPart }
      ];
    }
  }

  // For higher order, use Durand-Kerner method
  const n = coeffs.length - 1;
  const roots: Complex[] = [];

  // Initialize roots on unit circle
  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n + 0.1;
    roots.push(complexFromPolar(1, angle));
  }

  // Iterate
  for (let iter = 0; iter < 100; iter++) {
    let maxChange = 0;
    for (let i = 0; i < n; i++) {
      const p = evaluatePolynomial(coeffs, roots[i]);
      let denom: Complex = { real: 1, imag: 0 };
      for (let j = 0; j < n; j++) {
        if (i !== j) {
          denom = complexMultiply(denom, complexSubtract(roots[i], roots[j]));
        }
      }
      const delta = complexDivide(p, denom);
      roots[i] = complexSubtract(roots[i], delta);
      maxChange = Math.max(maxChange, complexMagnitude(delta));
    }
    if (maxChange < 1e-10) break;
  }

  return roots;
}

// Count encirclements of a point by a contour
function countEncirclements(contour: Complex[], point: Complex): number {
  let totalAngle = 0;

  for (let i = 0; i < contour.length - 1; i++) {
    const v1 = complexSubtract(contour[i], point);
    const v2 = complexSubtract(contour[i + 1], point);

    let angleDiff = complexPhase(v2) - complexPhase(v1);

    // Normalize to [-π, π]
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

    totalAngle += angleDiff;
  }

  // Number of encirclements = total angle / 2π
  return Math.round(totalAngle / (2 * Math.PI));
}

// Generate Nyquist plot data
function generateNyquistPlot(
  numerator: number[],
  denominator: number[],
  options: { numPoints?: number; omegaMin?: number; omegaMax?: number } = {}
): {
  positiveFreq: { omega: number; real: number; imag: number; magnitude: number; phase: number }[];
  negativeFreq: { omega: number; real: number; imag: number; magnitude: number; phase: number }[];
} {
  const numPoints = options.numPoints || 500;
  const omegaMin = options.omegaMin || 0.001;
  const omegaMax = options.omegaMax || 1000;

  const positiveFreq: { omega: number; real: number; imag: number; magnitude: number; phase: number }[] = [];
  const negativeFreq: { omega: number; real: number; imag: number; magnitude: number; phase: number }[] = [];

  // Logarithmic frequency spacing
  const logMin = Math.log10(omegaMin);
  const logMax = Math.log10(omegaMax);

  for (let i = 0; i <= numPoints; i++) {
    const logOmega = logMin + (logMax - logMin) * i / numPoints;
    const omega = Math.pow(10, logOmega);

    // Positive frequency: s = jω
    const sPos: Complex = { real: 0, imag: omega };
    const GPos = evaluateTransferFunction(numerator, denominator, sPos);

    positiveFreq.push({
      omega,
      real: GPos.real,
      imag: GPos.imag,
      magnitude: complexMagnitude(GPos),
      phase: complexPhase(GPos) * 180 / Math.PI
    });

    // Negative frequency: s = -jω (mirror about real axis)
    const sNeg: Complex = { real: 0, imag: -omega };
    const GNeg = evaluateTransferFunction(numerator, denominator, sNeg);

    negativeFreq.push({
      omega: -omega,
      real: GNeg.real,
      imag: GNeg.imag,
      magnitude: complexMagnitude(GNeg),
      phase: complexPhase(GNeg) * 180 / Math.PI
    });
  }

  return { positiveFreq, negativeFreq };
}

// Calculate stability margins
function calculateStabilityMargins(
  numerator: number[],
  denominator: number[]
): {
  gainMargin: number;
  gainMarginDb: number;
  phaseMargin: number;
  phaseCrossoverFreq: number;
  gainCrossoverFreq: number;
} {
  const numPoints = 1000;
  const omegaMin = 0.001;
  const omegaMax = 1000;

  let gainCrossoverFreq = NaN;
  let phaseCrossoverFreq = NaN;
  let gainMargin = Infinity;
  let phaseMargin = 180;

  let prevMag = 0;
  let prevPhase = 0;

  for (let i = 0; i <= numPoints; i++) {
    const logOmega = Math.log10(omegaMin) + (Math.log10(omegaMax) - Math.log10(omegaMin)) * i / numPoints;
    const omega = Math.pow(10, logOmega);

    const s: Complex = { real: 0, imag: omega };
    const G = evaluateTransferFunction(numerator, denominator, s);
    const mag = complexMagnitude(G);
    let phase = complexPhase(G) * 180 / Math.PI;

    // Unwrap phase
    while (phase > 0) phase -= 360;
    while (phase < -360) phase += 360;

    // Gain crossover (magnitude = 1)
    if (i > 0 && ((prevMag - 1) * (mag - 1) < 0)) {
      // Interpolate
      const alpha = (1 - prevMag) / (mag - prevMag);
      gainCrossoverFreq = Math.pow(10, Math.log10(omegaMin) + (Math.log10(omegaMax) - Math.log10(omegaMin)) * (i - 1 + alpha) / numPoints);
      phaseMargin = 180 + (prevPhase + alpha * (phase - prevPhase));
    }

    // Phase crossover (phase = -180)
    if (i > 0 && ((prevPhase + 180) * (phase + 180) < 0)) {
      // Interpolate
      const alpha = (-180 - prevPhase) / (phase - prevPhase);
      phaseCrossoverFreq = Math.pow(10, Math.log10(omegaMin) + (Math.log10(omegaMax) - Math.log10(omegaMin)) * (i - 1 + alpha) / numPoints);
      const magAtCrossover = prevMag + alpha * (mag - prevMag);
      gainMargin = 1 / magAtCrossover;
    }

    prevMag = mag;
    prevPhase = phase;
  }

  return {
    gainMargin,
    gainMarginDb: 20 * Math.log10(gainMargin),
    phaseMargin,
    phaseCrossoverFreq,
    gainCrossoverFreq
  };
}

// Apply Nyquist stability criterion
function analyzeStability(
  numerator: number[],
  denominator: number[]
): {
  openLoopPoles: Complex[];
  openLoopZeros: Complex[];
  P: number;  // Number of RHP poles
  N: number;  // Number of encirclements of -1
  Z: number;  // Number of RHP closed-loop poles (Z = N + P)
  isStable: boolean;
  explanation: string;
} {
  // Find open-loop poles and zeros
  const openLoopPoles = findPolynomialRoots(denominator);
  const openLoopZeros = findPolynomialRoots(numerator);

  // Count right-half plane poles
  const P = openLoopPoles.filter(p => p.real > 0).length;

  // Generate Nyquist contour and count encirclements
  const plotData = generateNyquistPlot(numerator, denominator, { numPoints: 1000 });

  // Build complete contour (positive freq -> negative freq)
  const contour: Complex[] = [
    ...plotData.positiveFreq.map(p => ({ real: p.real, imag: p.imag })),
    ...plotData.negativeFreq.reverse().map(p => ({ real: p.real, imag: p.imag }))
  ];

  // Count encirclements of -1 + 0j
  const N = countEncirclements(contour, { real: -1, imag: 0 });

  // Nyquist criterion: Z = N + P
  // Z = number of closed-loop RHP poles
  // For stability, need Z = 0
  const Z = N + P;
  const isStable = Z === 0;

  let explanation = `Nyquist Stability Analysis:\n`;
  explanation += `- Open-loop RHP poles (P): ${P}\n`;
  explanation += `- Encirclements of -1 (N): ${N} (${N > 0 ? 'clockwise' : N < 0 ? 'counter-clockwise' : 'none'})\n`;
  explanation += `- Closed-loop RHP poles (Z = N + P): ${Z}\n`;
  explanation += `- Stability: ${isStable ? 'STABLE' : 'UNSTABLE'}`;

  if (!isStable) {
    explanation += ` (${Z} pole(s) in right-half plane)`;
  }

  return { openLoopPoles, openLoopZeros, P, N, Z, isStable, explanation };
}

// ASCII visualization of Nyquist plot
function visualizeNyquist(
  numerator: number[],
  denominator: number[],
  width: number = 60,
  height: number = 30
): string {
  const plotData = generateNyquistPlot(numerator, denominator, { numPoints: 200 });

  // Combine positive and negative frequency data
  const allPoints = [
    ...plotData.positiveFreq,
    ...plotData.negativeFreq
  ];

  // Find bounds
  let minReal = Infinity, maxReal = -Infinity;
  let minImag = Infinity, maxImag = -Infinity;

  for (const p of allPoints) {
    if (Math.abs(p.real) < 100 && Math.abs(p.imag) < 100) {
      minReal = Math.min(minReal, p.real);
      maxReal = Math.max(maxReal, p.real);
      minImag = Math.min(minImag, p.imag);
      maxImag = Math.max(maxImag, p.imag);
    }
  }

  // Include -1 point and origin in bounds
  minReal = Math.min(minReal, -1.5);
  maxReal = Math.max(maxReal, 0.5);
  minImag = Math.min(minImag, -1);
  maxImag = Math.max(maxImag, 1);

  // Add padding
  const rangeReal = maxReal - minReal;
  const rangeImag = maxImag - minImag;
  minReal -= rangeReal * 0.1;
  maxReal += rangeReal * 0.1;
  minImag -= rangeImag * 0.1;
  maxImag += rangeImag * 0.1;

  // Create grid
  const grid: string[][] = Array(height).fill(null).map(() => Array(width).fill(' '));

  // Map coordinates to grid
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

  // Mark -1 point
  const negOneX = toGridX(-1);
  const negOneY = toGridY(0);
  if (negOneX >= 0 && negOneX < width && negOneY >= 0 && negOneY < height) {
    grid[negOneY][negOneX] = '⊗';
  }

  // Plot Nyquist curve
  for (const p of allPoints) {
    if (Math.abs(p.real) < 100 && Math.abs(p.imag) < 100) {
      const x = toGridX(p.real);
      const y = toGridY(p.imag);
      if (x >= 0 && x < width && y >= 0 && y < height) {
        if (grid[y][x] === ' ' || grid[y][x] === '─' || grid[y][x] === '│') {
          grid[y][x] = p.omega >= 0 ? '·' : '°';
        }
      }
    }
  }

  // Convert to string
  let result = '╔' + '═'.repeat(width) + '╗\n';
  for (const row of grid) {
    result += '║' + row.join('') + '║\n';
  }
  result += '╚' + '═'.repeat(width) + '╝\n';
  result += `Legend: · = positive freq, ° = negative freq, ⊗ = critical point (-1,0)\n`;
  result += `Real axis: [${minReal.toFixed(2)}, ${maxReal.toFixed(2)}], Imag axis: [${minImag.toFixed(2)}, ${maxImag.toFixed(2)}]`;

  return result;
}

// Example transfer functions
const EXAMPLE_SYSTEMS: Record<string, { numerator: number[]; denominator: number[]; description: string }> = {
  'first_order': {
    numerator: [1],
    denominator: [1, 1],  // 1/(s+1)
    description: 'First-order system: G(s) = 1/(s+1)'
  },
  'second_order': {
    numerator: [1],
    denominator: [1, 1, 1],  // 1/(s²+s+1)
    description: 'Second-order system: G(s) = 1/(s²+s+1)'
  },
  'integrator': {
    numerator: [1],
    denominator: [1, 0],  // 1/s
    description: 'Pure integrator: G(s) = 1/s'
  },
  'unstable': {
    numerator: [1],
    denominator: [1, -1],  // 1/(s-1)
    description: 'Unstable first-order: G(s) = 1/(s-1)'
  },
  'conditionally_stable': {
    numerator: [1],
    denominator: [1, 3, 3, 1],  // 1/(s+1)³
    description: 'Conditionally stable: G(s) = 1/(s+1)³'
  }
};

export const nyquistplotTool: UnifiedTool = {
  name: 'nyquist_plot',
  description: `Nyquist plot analysis for control system stability.

Uses the Nyquist stability criterion to analyze closed-loop stability from
open-loop transfer function G(s) = N(s)/D(s).

Features:
- Generate Nyquist plot (frequency response locus)
- Count encirclements of critical point (-1, 0)
- Apply Nyquist criterion: Z = N + P (stable if Z = 0)
- Calculate gain and phase margins
- Identify open-loop poles and zeros
- ASCII visualization of Nyquist contour

Transfer function format: coefficients from highest to lowest degree
Example: [1, 2, 3] represents s² + 2s + 3`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['plot', 'stability', 'margins', 'encirclements', 'visualize', 'examples', 'info'],
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
        enum: ['first_order', 'second_order', 'integrator', 'unstable', 'conditionally_stable'],
        description: 'Use example system'
      },
      omega_min: { type: 'number', description: 'Minimum frequency (default: 0.001)' },
      omega_max: { type: 'number', description: 'Maximum frequency (default: 1000)' },
      num_points: { type: 'integer', description: 'Number of frequency points (default: 100)' }
    },
    required: ['operation']
  }
};

export async function executenyquistplot(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, example, omega_min, omega_max, num_points } = args;

    // Get transfer function coefficients
    let numerator = args.numerator || [1];
    let denominator = args.denominator || [1, 1];
    let systemDescription = 'Custom system';

    if (example && EXAMPLE_SYSTEMS[example]) {
      const sys = EXAMPLE_SYSTEMS[example];
      numerator = sys.numerator;
      denominator = sys.denominator;
      systemDescription = sys.description;
    }

    const options = {
      omegaMin: omega_min,
      omegaMax: omega_max,
      numPoints: num_points
    };

    switch (operation) {
      case 'plot': {
        const plotData = generateNyquistPlot(numerator, denominator, options);

        // Sample key points
        const keyPoints = [];
        const indices = [0, Math.floor(plotData.positiveFreq.length / 4),
                        Math.floor(plotData.positiveFreq.length / 2),
                        Math.floor(3 * plotData.positiveFreq.length / 4),
                        plotData.positiveFreq.length - 1];

        for (const i of indices) {
          const p = plotData.positiveFreq[i];
          keyPoints.push({
            omega: p.omega.toExponential(3),
            real: p.real.toFixed(6),
            imag: p.imag.toFixed(6),
            magnitude: p.magnitude.toFixed(6),
            phase_deg: p.phase.toFixed(2)
          });
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            system: systemDescription,
            numerator,
            denominator,
            plot_description: 'Nyquist plot: G(jω) for ω from 0 to ∞',
            total_points: plotData.positiveFreq.length * 2,
            key_frequency_points: keyPoints,
            dc_gain: plotData.positiveFreq[0],
            note: 'Complete contour includes positive (ω>0) and negative (ω<0) frequencies'
          }, null, 2)
        };
      }

      case 'stability': {
        const stability = analyzeStability(numerator, denominator);

        return {
          toolCallId: id,
          content: JSON.stringify({
            system: systemDescription,
            numerator,
            denominator,
            nyquist_criterion: {
              P_open_loop_rhp_poles: stability.P,
              N_encirclements_of_minus_one: stability.N,
              Z_closed_loop_rhp_poles: stability.Z,
              formula: 'Z = N + P'
            },
            is_stable: stability.isStable,
            explanation: stability.explanation,
            open_loop_poles: stability.openLoopPoles.map(p => ({
              real: p.real.toFixed(6),
              imag: p.imag.toFixed(6),
              location: p.real > 0 ? 'RHP (unstable)' : p.real < 0 ? 'LHP (stable)' : 'imaginary axis'
            })),
            open_loop_zeros: stability.openLoopZeros.map(z => ({
              real: z.real.toFixed(6),
              imag: z.imag.toFixed(6)
            }))
          }, null, 2)
        };
      }

      case 'margins': {
        const margins = calculateStabilityMargins(numerator, denominator);

        return {
          toolCallId: id,
          content: JSON.stringify({
            system: systemDescription,
            numerator,
            denominator,
            stability_margins: {
              gain_margin: margins.gainMargin === Infinity ? '∞' : margins.gainMargin.toFixed(4),
              gain_margin_dB: margins.gainMarginDb === Infinity ? '∞' : margins.gainMarginDb.toFixed(2),
              phase_margin_deg: margins.phaseMargin.toFixed(2),
              phase_crossover_freq: isNaN(margins.phaseCrossoverFreq) ? 'N/A' : margins.phaseCrossoverFreq.toFixed(4),
              gain_crossover_freq: isNaN(margins.gainCrossoverFreq) ? 'N/A' : margins.gainCrossoverFreq.toFixed(4)
            },
            interpretation: {
              gain_margin: 'Factor by which gain can increase before instability',
              phase_margin: 'Additional phase lag (degrees) system can tolerate',
              typical_requirements: 'GM > 6dB (factor of 2), PM > 30-60°'
            }
          }, null, 2)
        };
      }

      case 'encirclements': {
        const stability = analyzeStability(numerator, denominator);
        const plotData = generateNyquistPlot(numerator, denominator, { numPoints: 500 });

        // Find closest approach to -1
        let minDistance = Infinity;
        let closestPoint = plotData.positiveFreq[0];

        for (const p of [...plotData.positiveFreq, ...plotData.negativeFreq]) {
          const dist = Math.sqrt(Math.pow(p.real + 1, 2) + Math.pow(p.imag, 2));
          if (dist < minDistance) {
            minDistance = dist;
            closestPoint = p;
          }
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            system: systemDescription,
            critical_point: { real: -1, imag: 0 },
            encirclements: {
              count: stability.N,
              direction: stability.N > 0 ? 'clockwise' : stability.N < 0 ? 'counter-clockwise' : 'none'
            },
            closest_approach: {
              distance: minDistance.toFixed(6),
              at_frequency: Math.abs(closestPoint.omega).toExponential(3),
              point: { real: closestPoint.real.toFixed(6), imag: closestPoint.imag.toFixed(6) }
            },
            nyquist_interpretation: stability.N > 0
              ? `Clockwise encirclement(s) indicate potential instability`
              : stability.N < 0
              ? `Counter-clockwise encirclement(s) can stabilize unstable open-loop systems`
              : `No encirclement - stable if no open-loop RHP poles`
          }, null, 2)
        };
      }

      case 'visualize': {
        const visualization = visualizeNyquist(numerator, denominator);
        const stability = analyzeStability(numerator, denominator);

        return {
          toolCallId: id,
          content: JSON.stringify({
            system: systemDescription,
            numerator,
            denominator,
            ascii_nyquist_plot: visualization,
            stability_summary: {
              is_stable: stability.isStable,
              encirclements: stability.N,
              rhp_poles: stability.P
            }
          }, null, 2)
        };
      }

      case 'examples': {
        const examples = Object.entries(EXAMPLE_SYSTEMS).map(([key, sys]) => {
          const stability = analyzeStability(sys.numerator, sys.denominator);
          return {
            name: key,
            description: sys.description,
            numerator: sys.numerator,
            denominator: sys.denominator,
            is_stable: stability.isStable
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
            tool: 'nyquist_plot',
            description: 'Nyquist stability analysis for linear control systems',
            theory: {
              nyquist_criterion: 'Z = N + P, where Z = closed-loop RHP poles, N = encirclements, P = open-loop RHP poles',
              stability_condition: 'System is stable if Z = 0',
              encirclements: 'Counted positive for clockwise direction around -1+0j'
            },
            operations: {
              plot: 'Generate Nyquist plot data (frequency response)',
              stability: 'Full stability analysis using Nyquist criterion',
              margins: 'Calculate gain and phase margins',
              encirclements: 'Count encirclements of critical point',
              visualize: 'ASCII visualization of Nyquist plot',
              examples: 'List available example systems'
            },
            parameters: {
              numerator: 'Transfer function numerator coefficients [highest degree first]',
              denominator: 'Transfer function denominator coefficients [highest degree first]',
              example: 'Use predefined example system',
              omega_min: 'Minimum frequency for plot',
              omega_max: 'Maximum frequency for plot',
              num_points: 'Number of frequency points'
            },
            transfer_function_format: 'G(s) = (num[0]·s^n + num[1]·s^(n-1) + ...) / (den[0]·s^m + den[1]·s^(m-1) + ...)'
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

export function isnyquistplotAvailable(): boolean {
  return true;
}
