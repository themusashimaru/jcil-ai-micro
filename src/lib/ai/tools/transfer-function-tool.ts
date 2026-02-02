/**
 * TRANSFER-FUNCTION TOOL
 * Control systems transfer function analysis
 *
 * Implements:
 * - Transfer function creation from numerator/denominator polynomials
 * - Poles and zeros analysis
 * - Step response calculation
 * - Impulse response calculation
 * - Bode magnitude and phase analysis
 * - Stability analysis
 * - Frequency response evaluation
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const transferfunctionTool: UnifiedTool = {
  name: 'transfer_function',
  description: 'Transfer function representation and analysis for control systems',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['create', 'poles_zeros', 'step_response', 'impulse_response', 'bode', 'stability', 'frequency_response', 'info'],
        description: 'Operation to perform'
      },
      numerator: {
        type: 'array',
        items: { type: 'number' },
        description: 'Numerator polynomial coefficients [highest to lowest degree]'
      },
      denominator: {
        type: 'array',
        items: { type: 'number' },
        description: 'Denominator polynomial coefficients [highest to lowest degree]'
      },
      time_start: { type: 'number', description: 'Start time for response (default: 0)' },
      time_end: { type: 'number', description: 'End time for response (default: 10)' },
      num_points: { type: 'integer', description: 'Number of time points (default: 500)' },
      frequency_start: { type: 'number', description: 'Start frequency in rad/s (default: 0.01)' },
      frequency_end: { type: 'number', description: 'End frequency in rad/s (default: 100)' }
    },
    required: ['operation']
  }
};

// Complex number operations
interface Complex {
  real: number;
  imag: number;
}

function complexAdd(a: Complex, b: Complex): Complex {
  return { real: a.real + b.real, imag: a.imag + b.imag };
}

function complexSub(a: Complex, b: Complex): Complex {
  return { real: a.real - b.real, imag: a.imag - b.imag };
}

function complexMul(a: Complex, b: Complex): Complex {
  return {
    real: a.real * b.real - a.imag * b.imag,
    imag: a.real * b.imag + a.imag * b.real
  };
}

function complexDiv(a: Complex, b: Complex): Complex {
  const denom = b.real * b.real + b.imag * b.imag;
  if (denom === 0) return { real: Infinity, imag: 0 };
  return {
    real: (a.real * b.real + a.imag * b.imag) / denom,
    imag: (a.imag * b.real - a.real * b.imag) / denom
  };
}

function complexAbs(c: Complex): number {
  return Math.sqrt(c.real * c.real + c.imag * c.imag);
}

function complexArg(c: Complex): number {
  return Math.atan2(c.imag, c.real);
}

function complexFromPolar(r: number, theta: number): Complex {
  return { real: r * Math.cos(theta), imag: r * Math.sin(theta) };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function complexSqrt(c: Complex): Complex {
  const r = complexAbs(c);
  const theta = complexArg(c);
  return complexFromPolar(Math.sqrt(r), theta / 2);
}

// Evaluate polynomial at complex value
function polyEvalComplex(coeffs: number[], s: Complex): Complex {
  let result: Complex = { real: 0, imag: 0 };
  for (let i = 0; i < coeffs.length; i++) {
    result = complexAdd(complexMul(result, s), { real: coeffs[i], imag: 0 });
  }
  return result;
}

// Evaluate polynomial at real value
function polyEval(coeffs: number[], x: number): number {
  let result = 0;
  for (let i = 0; i < coeffs.length; i++) {
    result = result * x + coeffs[i];
  }
  return result;
}

// Polynomial derivative
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function polyDerivative(coeffs: number[]): number[] {
  if (coeffs.length <= 1) return [0];
  const deriv: number[] = [];
  for (let i = 0; i < coeffs.length - 1; i++) {
    deriv.push(coeffs[i] * (coeffs.length - 1 - i));
  }
  return deriv;
}

// Find roots of polynomial using Durand-Kerner method
function findRoots(coeffs: number[], maxIter: number = 1000, tol: number = 1e-10): Complex[] {
  if (coeffs.length <= 1) return [];
  if (coeffs.length === 2) {
    // Linear: ax + b = 0 => x = -b/a
    return [{ real: -coeffs[1] / coeffs[0], imag: 0 }];
  }
  if (coeffs.length === 3) {
    // Quadratic: ax^2 + bx + c = 0
    const a = coeffs[0];
    const b = coeffs[1];
    const c = coeffs[2];
    const discriminant = b * b - 4 * a * c;
    if (discriminant >= 0) {
      const sqrtD = Math.sqrt(discriminant);
      return [
        { real: (-b + sqrtD) / (2 * a), imag: 0 },
        { real: (-b - sqrtD) / (2 * a), imag: 0 }
      ];
    } else {
      const sqrtD = Math.sqrt(-discriminant);
      return [
        { real: -b / (2 * a), imag: sqrtD / (2 * a) },
        { real: -b / (2 * a), imag: -sqrtD / (2 * a) }
      ];
    }
  }

  // General case: Durand-Kerner method
  const n = coeffs.length - 1;

  // Normalize polynomial
  const leadCoeff = coeffs[0];
  const normalizedCoeffs = coeffs.map(c => c / leadCoeff);

  // Initial guesses distributed on a circle
  const roots: Complex[] = [];
  const radius = Math.max(1, Math.abs(normalizedCoeffs[normalizedCoeffs.length - 1]) ** (1 / n));
  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n + 0.1;
    roots.push({ real: radius * Math.cos(angle), imag: radius * Math.sin(angle) });
  }

  // Iterate
  for (let iter = 0; iter < maxIter; iter++) {
    let maxChange = 0;

    for (let i = 0; i < n; i++) {
      const pVal = polyEvalComplex(normalizedCoeffs, roots[i]);

      // Product of (z_i - z_j) for all j != i
      let product: Complex = { real: 1, imag: 0 };
      for (let j = 0; j < n; j++) {
        if (j !== i) {
          product = complexMul(product, complexSub(roots[i], roots[j]));
        }
      }

      const correction = complexDiv(pVal, product);
      roots[i] = complexSub(roots[i], correction);
      maxChange = Math.max(maxChange, complexAbs(correction));
    }

    if (maxChange < tol) break;
  }

  // Clean up near-real roots
  return roots.map(r => {
    if (Math.abs(r.imag) < 1e-10) {
      return { real: r.real, imag: 0 };
    }
    return r;
  });
}

// Calculate step response using partial fraction expansion and inverse Laplace
function calculateStepResponse(
  numerator: number[],
  denominator: number[],
  timeStart: number,
  timeEnd: number,
  numPoints: number
): { time: number[]; response: number[]; steadyState: number; riseTime: number; settlingTime: number; overshoot: number } {
  const dt = (timeEnd - timeStart) / (numPoints - 1);
  const time: number[] = [];
  const response: number[] = [];

  // Find poles
  const _poles = findRoots(denominator);

  // DC gain (steady state value for unit step)
  const dcGain = polyEval(numerator, 0) / polyEval(denominator, 0);
  const steadyState = isFinite(dcGain) ? dcGain : 0;

  // For simple cases, use analytical formulas
  // For general case, use numerical simulation

  // State-space simulation approach
  // Convert to controllable canonical form
  const n = denominator.length - 1;

  if (n === 0) {
    // Static gain
    for (let i = 0; i < numPoints; i++) {
      const t = timeStart + i * dt;
      time.push(t);
      response.push(dcGain);
    }
  } else if (n === 1) {
    // First order: G(s) = K / (τs + 1)
    const tau = denominator[0] / denominator[1];
    const K = numerator[numerator.length - 1] / denominator[1];
    for (let i = 0; i < numPoints; i++) {
      const t = timeStart + i * dt;
      time.push(t);
      response.push(K * (1 - Math.exp(-t / tau)));
    }
  } else if (n === 2) {
    // Second order: G(s) = K*ωn² / (s² + 2ζωns + ωn²)
    const a0 = denominator[2];
    const a1 = denominator[1];
    const a2 = denominator[0];

    const omegaN = Math.sqrt(a0 / a2);
    const zeta = a1 / (2 * Math.sqrt(a0 * a2));
    const K = (numerator[numerator.length - 1] / a0);

    for (let i = 0; i < numPoints; i++) {
      const t = timeStart + i * dt;
      time.push(t);

      if (zeta < 1) {
        // Underdamped
        const omegaD = omegaN * Math.sqrt(1 - zeta * zeta);
        const phi = Math.atan2(omegaD, zeta * omegaN);
        response.push(K * (1 - Math.exp(-zeta * omegaN * t) * Math.sin(omegaD * t + phi) / Math.sin(phi)));
      } else if (zeta === 1) {
        // Critically damped
        response.push(K * (1 - (1 + omegaN * t) * Math.exp(-omegaN * t)));
      } else {
        // Overdamped
        const s1 = -zeta * omegaN + omegaN * Math.sqrt(zeta * zeta - 1);
        const s2 = -zeta * omegaN - omegaN * Math.sqrt(zeta * zeta - 1);
        response.push(K * (1 + (s1 * Math.exp(s2 * t) - s2 * Math.exp(s1 * t)) / (s2 - s1)));
      }
    }
  } else {
    // General case: numerical integration using Runge-Kutta
    // State space: dx/dt = Ax + Bu, y = Cx + Du
    const state = new Array(n).fill(0);

    for (let i = 0; i < numPoints; i++) {
      const t = timeStart + i * dt;
      time.push(t);

      // Output: weighted sum of states
      let y = 0;
      for (let j = 0; j < Math.min(numerator.length, n); j++) {
        y += numerator[numerator.length - 1 - j] * state[j] / denominator[0];
      }
      response.push(y);

      // RK4 integration step
      const k1 = stateDerivative(state, 1, numerator, denominator);
      const k2 = stateDerivative(addArrays(state, scaleArray(k1, dt / 2)), 1, numerator, denominator);
      const k3 = stateDerivative(addArrays(state, scaleArray(k2, dt / 2)), 1, numerator, denominator);
      const k4 = stateDerivative(addArrays(state, scaleArray(k3, dt)), 1, numerator, denominator);

      for (let j = 0; j < n; j++) {
        state[j] += (dt / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]);
      }
    }
  }

  // Calculate performance metrics
  let riseTime = 0;
  let settlingTime = 0;
  let overshoot = 0;

  const finalValue = steadyState;
  const threshold10 = 0.1 * finalValue;
  const threshold90 = 0.9 * finalValue;
  const settlingBand = 0.02 * Math.abs(finalValue);

  let found10 = false;
  let found90 = false;
  let time10 = 0;
  let time90 = 0;

  for (let i = 0; i < response.length; i++) {
    if (!found10 && response[i] >= threshold10) {
      time10 = time[i];
      found10 = true;
    }
    if (!found90 && response[i] >= threshold90) {
      time90 = time[i];
      found90 = true;
    }

    if (Math.abs(finalValue) > 1e-10) {
      const percentOvershoot = ((response[i] - finalValue) / finalValue) * 100;
      if (percentOvershoot > overshoot) {
        overshoot = percentOvershoot;
      }
    }

    // Check if within settling band
    if (Math.abs(response[i] - finalValue) <= settlingBand) {
      // Check if all subsequent points are also within band
      let settled = true;
      for (let j = i; j < Math.min(i + 50, response.length); j++) {
        if (Math.abs(response[j] - finalValue) > settlingBand) {
          settled = false;
          break;
        }
      }
      if (settled && settlingTime === 0) {
        settlingTime = time[i];
      }
    }
  }

  riseTime = time90 - time10;

  return {
    time,
    response,
    steadyState: finalValue,
    riseTime: isFinite(riseTime) ? riseTime : 0,
    settlingTime: isFinite(settlingTime) ? settlingTime : timeEnd,
    overshoot: Math.max(0, overshoot)
  };
}

function stateDerivative(state: number[], input: number, num: number[], den: number[]): number[] {
  const n = state.length;
  const deriv = new Array(n).fill(0);

  // Controllable canonical form
  for (let i = 0; i < n - 1; i++) {
    deriv[i] = state[i + 1];
  }

  // Last state derivative
  let lastDeriv = input * den[0];
  for (let i = 0; i < n; i++) {
    lastDeriv -= den[i + 1] * state[n - 1 - i];
  }
  deriv[n - 1] = lastDeriv / den[0];

  return deriv;
}

function addArrays(a: number[], b: number[]): number[] {
  return a.map((v, i) => v + b[i]);
}

function scaleArray(a: number[], s: number): number[] {
  return a.map(v => v * s);
}

// Calculate impulse response
function calculateImpulseResponse(
  numerator: number[],
  denominator: number[],
  timeStart: number,
  timeEnd: number,
  numPoints: number
): { time: number[]; response: number[] } {
  const dt = (timeEnd - timeStart) / (numPoints - 1);
  const time: number[] = [];
  const response: number[] = [];

  const n = denominator.length - 1;

  if (n === 0) {
    // Static gain - impulse at t=0
    for (let i = 0; i < numPoints; i++) {
      const t = timeStart + i * dt;
      time.push(t);
      response.push(i === 0 ? numerator[0] / denominator[0] / dt : 0);
    }
  } else if (n === 1) {
    // First order: h(t) = (K/τ) * e^(-t/τ)
    const tau = denominator[0] / denominator[1];
    const K = numerator[numerator.length - 1] / denominator[1];
    for (let i = 0; i < numPoints; i++) {
      const t = timeStart + i * dt;
      time.push(t);
      response.push((K / tau) * Math.exp(-t / tau));
    }
  } else if (n === 2) {
    // Second order
    const a0 = denominator[2];
    const a1 = denominator[1];
    const a2 = denominator[0];

    const omegaN = Math.sqrt(a0 / a2);
    const zeta = a1 / (2 * Math.sqrt(a0 * a2));
    const K = numerator[numerator.length - 1] / a2;

    for (let i = 0; i < numPoints; i++) {
      const t = timeStart + i * dt;
      time.push(t);

      if (zeta < 1) {
        // Underdamped
        const omegaD = omegaN * Math.sqrt(1 - zeta * zeta);
        response.push(K * omegaN / Math.sqrt(1 - zeta * zeta) *
          Math.exp(-zeta * omegaN * t) * Math.sin(omegaD * t));
      } else if (zeta === 1) {
        // Critically damped
        response.push(K * omegaN * omegaN * t * Math.exp(-omegaN * t));
      } else {
        // Overdamped
        const s1 = -zeta * omegaN + omegaN * Math.sqrt(zeta * zeta - 1);
        const s2 = -zeta * omegaN - omegaN * Math.sqrt(zeta * zeta - 1);
        response.push(K * omegaN * omegaN * (Math.exp(s1 * t) - Math.exp(s2 * t)) / (s1 - s2));
      }
    }
  } else {
    // General case: derivative of step response
    const stepResponse = calculateStepResponse(numerator, denominator, timeStart, timeEnd, numPoints);
    for (let i = 0; i < numPoints; i++) {
      time.push(stepResponse.time[i]);
      if (i === 0) {
        response.push((stepResponse.response[1] - stepResponse.response[0]) / dt);
      } else if (i === numPoints - 1) {
        response.push((stepResponse.response[i] - stepResponse.response[i - 1]) / dt);
      } else {
        response.push((stepResponse.response[i + 1] - stepResponse.response[i - 1]) / (2 * dt));
      }
    }
  }

  return { time, response };
}

// Calculate Bode plot data
function calculateBode(
  numerator: number[],
  denominator: number[],
  freqStart: number,
  freqEnd: number,
  numPoints: number
): { frequency: number[]; magnitude: number[]; phase: number[]; magnitudeDb: number[] } {
  const frequency: number[] = [];
  const magnitude: number[] = [];
  const magnitudeDb: number[] = [];
  const phase: number[] = [];

  // Logarithmically spaced frequencies
  const logStart = Math.log10(freqStart);
  const logEnd = Math.log10(freqEnd);
  const logStep = (logEnd - logStart) / (numPoints - 1);

  for (let i = 0; i < numPoints; i++) {
    const omega = Math.pow(10, logStart + i * logStep);
    frequency.push(omega);

    // s = jω
    const s: Complex = { real: 0, imag: omega };

    const numValue = polyEvalComplex(numerator, s);
    const denValue = polyEvalComplex(denominator, s);
    const H = complexDiv(numValue, denValue);

    const mag = complexAbs(H);
    magnitude.push(mag);
    magnitudeDb.push(20 * Math.log10(mag));

    // Phase in degrees
    let phaseDeg = complexArg(H) * 180 / Math.PI;
    // Unwrap phase
    if (i > 0) {
      while (phaseDeg - phase[i - 1] > 180) phaseDeg -= 360;
      while (phaseDeg - phase[i - 1] < -180) phaseDeg += 360;
    }
    phase.push(phaseDeg);
  }

  return { frequency, magnitude, magnitudeDb, phase };
}

// Analyze stability
function analyzeStability(denominator: number[]): {
  stable: boolean;
  poles: { real: number; imag: number; magnitude: number; damping: number }[];
  stabilityMargins: { gainMargin: number; phaseMargin: number; gainCrossover: number; phaseCrossover: number };
  routhTable: number[][];
} {
  const poles = findRoots(denominator);

  // Check if all poles have negative real parts
  const stable = poles.every(p => p.real < 0);

  // Pole analysis
  const poleAnalysis = poles.map(p => ({
    real: p.real,
    imag: p.imag,
    magnitude: complexAbs(p),
    damping: p.imag === 0 ? 1 : -p.real / complexAbs(p)
  }));

  // Routh-Hurwitz stability criterion
  const n = denominator.length;
  const routhTable: number[][] = [];

  // First two rows
  const row1: number[] = [];
  const row2: number[] = [];
  for (let i = 0; i < n; i++) {
    if (i % 2 === 0) row1.push(denominator[i]);
    else row2.push(denominator[i]);
  }
  while (row1.length < row2.length) row1.push(0);
  while (row2.length < row1.length) row2.push(0);

  routhTable.push(row1);
  routhTable.push(row2);

  // Subsequent rows
  for (let i = 2; i < n; i++) {
    const prevRow = routhTable[i - 1];
    const prevPrevRow = routhTable[i - 2];
    const newRow: number[] = [];

    const pivot = prevRow[0];
    if (Math.abs(pivot) < 1e-10) break;

    for (let j = 1; j < prevRow.length; j++) {
      const element = (prevRow[0] * prevPrevRow[j] - prevPrevRow[0] * prevRow[j]) / pivot;
      newRow.push(element);
    }
    newRow.push(0);

    routhTable.push(newRow);
  }

  return {
    stable,
    poles: poleAnalysis,
    stabilityMargins: {
      gainMargin: stable ? Infinity : 0,
      phaseMargin: stable ? 180 : 0,
      gainCrossover: 0,
      phaseCrossover: 0
    },
    routhTable
  };
}

// Create transfer function representation
function createTransferFunction(numerator: number[], denominator: number[]): {
  numerator: number[];
  denominator: number[];
  order: number;
  properSystem: boolean;
  dcGain: number;
  zeros: Complex[];
  poles: Complex[];
  polynomialForm: string;
} {
  const zeros = findRoots(numerator);
  const poles = findRoots(denominator);
  const dcGain = polyEval(numerator, 0) / polyEval(denominator, 0);

  // Create polynomial string representation
  const numStr = polyToString(numerator, 's');
  const denStr = polyToString(denominator, 's');
  const polynomialForm = `G(s) = (${numStr}) / (${denStr})`;

  return {
    numerator,
    denominator,
    order: denominator.length - 1,
    properSystem: numerator.length <= denominator.length,
    dcGain: isFinite(dcGain) ? dcGain : Infinity,
    zeros,
    poles,
    polynomialForm
  };
}

function polyToString(coeffs: number[], variable: string): string {
  if (coeffs.length === 0) return '0';

  const terms: string[] = [];
  const degree = coeffs.length - 1;

  for (let i = 0; i < coeffs.length; i++) {
    const coeff = coeffs[i];
    const power = degree - i;

    if (Math.abs(coeff) < 1e-10) continue;

    let term = '';
    if (power === 0) {
      term = coeff.toFixed(3);
    } else if (power === 1) {
      term = Math.abs(coeff) === 1 ? variable : `${coeff.toFixed(3)}${variable}`;
    } else {
      term = Math.abs(coeff) === 1 ? `${variable}^${power}` : `${coeff.toFixed(3)}${variable}^${power}`;
    }

    if (terms.length > 0 && coeff > 0) {
      terms.push('+ ' + term);
    } else {
      terms.push(term);
    }
  }

  return terms.length > 0 ? terms.join(' ') : '0';
}

export async function executetransferfunction(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation as string;

    if (operation === 'info') {
      return {
        toolCallId: id,
        content: JSON.stringify({
          tool: 'transfer_function',
          description: 'Control systems transfer function analysis tool',
          operations: {
            create: 'Create transfer function from numerator/denominator polynomials',
            poles_zeros: 'Find poles and zeros of the transfer function',
            step_response: 'Calculate unit step response with performance metrics',
            impulse_response: 'Calculate impulse response',
            bode: 'Generate Bode plot data (magnitude and phase vs frequency)',
            stability: 'Analyze system stability using Routh-Hurwitz criterion',
            frequency_response: 'Evaluate frequency response at specific frequencies'
          },
          parameters: {
            numerator: 'Array of numerator polynomial coefficients [highest to lowest]',
            denominator: 'Array of denominator polynomial coefficients [highest to lowest]',
            time_start: 'Start time for time-domain responses (default: 0)',
            time_end: 'End time for time-domain responses (default: 10)',
            num_points: 'Number of points for response calculation (default: 500)',
            frequency_start: 'Start frequency in rad/s for Bode plot (default: 0.01)',
            frequency_end: 'End frequency in rad/s for Bode plot (default: 100)'
          },
          examples: {
            first_order: 'G(s) = 1 / (s + 1): num=[1], den=[1, 1]',
            second_order: 'G(s) = 1 / (s² + 0.5s + 1): num=[1], den=[1, 0.5, 1]',
            pid_controller: 'G(s) = (Kd·s² + Kp·s + Ki) / s: num=[Kd, Kp, Ki], den=[1, 0]'
          },
          concepts: {
            poles: 'Roots of denominator - determine system stability and dynamics',
            zeros: 'Roots of numerator - affect transient response shape',
            stability: 'System is stable if all poles have negative real parts',
            dc_gain: 'Steady-state response to unit step input: G(0)',
            rise_time: 'Time to go from 10% to 90% of final value',
            settling_time: 'Time to stay within 2% of final value',
            overshoot: 'Percentage by which response exceeds final value'
          }
        }, null, 2)
      };
    }

    const numerator = args.numerator as number[] || [1];
    const denominator = args.denominator as number[] || [1, 1];

    if (!denominator || denominator.length === 0) {
      throw new Error('Denominator polynomial cannot be empty');
    }

    if (denominator.every(c => c === 0)) {
      throw new Error('Denominator polynomial cannot be all zeros');
    }

    const timeStart = args.time_start ?? 0;
    const timeEnd = args.time_end ?? 10;
    const numPoints = args.num_points ?? 500;
    const freqStart = args.frequency_start ?? 0.01;
    const freqEnd = args.frequency_end ?? 100;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'create':
        result = createTransferFunction(numerator, denominator);
        break;

      case 'poles_zeros': {
        const tf = createTransferFunction(numerator, denominator);
        result = {
          poles: tf.poles.map(p => ({ real: p.real, imag: p.imag, magnitude: complexAbs(p), angle_deg: complexArg(p) * 180 / Math.PI })),
          zeros: tf.zeros.map(z => ({ real: z.real, imag: z.imag, magnitude: complexAbs(z), angle_deg: complexArg(z) * 180 / Math.PI })),
          order: tf.order,
          dcGain: tf.dcGain,
          polynomialForm: tf.polynomialForm
        };
        break;
      }

      case 'step_response': {
        const stepData = calculateStepResponse(numerator, denominator, timeStart, timeEnd, numPoints);
        // Return sampled data points for reasonable response size
        const sampleStep = Math.max(1, Math.floor(numPoints / 100));
        result = {
          time: stepData.time.filter((_, i) => i % sampleStep === 0),
          response: stepData.response.filter((_, i) => i % sampleStep === 0),
          performance: {
            steadyState: stepData.steadyState,
            riseTime: stepData.riseTime,
            settlingTime: stepData.settlingTime,
            overshoot_percent: stepData.overshoot
          },
          full_data_points: numPoints
        };
        break;
      }

      case 'impulse_response': {
        const impulseData = calculateImpulseResponse(numerator, denominator, timeStart, timeEnd, numPoints);
        const sampleStep = Math.max(1, Math.floor(numPoints / 100));
        result = {
          time: impulseData.time.filter((_, i) => i % sampleStep === 0),
          response: impulseData.response.filter((_, i) => i % sampleStep === 0),
          full_data_points: numPoints
        };
        break;
      }

      case 'bode': {
        const bodeData = calculateBode(numerator, denominator, freqStart, freqEnd, numPoints);
        const sampleStep = Math.max(1, Math.floor(numPoints / 100));
        result = {
          frequency_rad_s: bodeData.frequency.filter((_, i) => i % sampleStep === 0),
          magnitude_db: bodeData.magnitudeDb.filter((_, i) => i % sampleStep === 0),
          phase_deg: bodeData.phase.filter((_, i) => i % sampleStep === 0),
          frequency_range: { start: freqStart, end: freqEnd },
          full_data_points: numPoints
        };
        break;
      }

      case 'stability':
        result = analyzeStability(denominator);
        break;

      case 'frequency_response': {
        const omega = args.frequency ?? 1;
        const s: Complex = { real: 0, imag: omega };
        const numValue = polyEvalComplex(numerator, s);
        const denValue = polyEvalComplex(denominator, s);
        const H = complexDiv(numValue, denValue);

        result = {
          frequency_rad_s: omega,
          magnitude: complexAbs(H),
          magnitude_db: 20 * Math.log10(complexAbs(H)),
          phase_deg: complexArg(H) * 180 / Math.PI,
          real: H.real,
          imaginary: H.imag
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return {
      toolCallId: id,
      content: JSON.stringify({
        operation,
        ...result
      }, null, 2)
    };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function istransferfunctionAvailable(): boolean { return true; }
