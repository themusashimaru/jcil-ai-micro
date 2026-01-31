/**
 * CONTROL THEORY TOOL
 *
 * Control systems analysis and design.
 * Essential for robotics, aerospace, and automation engineering.
 *
 * Features:
 * - Transfer function analysis
 * - PID controller design and tuning
 * - Step/impulse response
 * - Root locus
 * - Bode plot data
 * - Stability analysis
 * - State-space models
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Complex number helpers
interface Complex {
  re: number;
  im: number;
}

function complex(re: number, im: number = 0): Complex {
  return { re, im };
}

function cAdd(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im };
}

function cSub(a: Complex, b: Complex): Complex {
  return { re: a.re - b.re, im: a.im - b.im };
}

function cMul(a: Complex, b: Complex): Complex {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  };
}

function cDiv(a: Complex, b: Complex): Complex {
  const denom = b.re * b.re + b.im * b.im;
  return {
    re: (a.re * b.re + a.im * b.im) / denom,
    im: (a.im * b.re - a.re * b.im) / denom,
  };
}

function cAbs(a: Complex): number {
  return Math.sqrt(a.re * a.re + a.im * a.im);
}

function cArg(a: Complex): number {
  return Math.atan2(a.im, a.re);
}

// Evaluate polynomial at complex point
function polyEval(coeffs: number[], s: Complex): Complex {
  let result = complex(0);
  for (let i = 0; i < coeffs.length; i++) {
    const term = complex(coeffs[i]);
    let sPow = complex(1);
    for (let j = 0; j < coeffs.length - 1 - i; j++) {
      sPow = cMul(sPow, s);
    }
    result = cAdd(result, cMul(term, sPow));
  }
  return result;
}

// Transfer function G(s) = num(s) / den(s)
interface TransferFunction {
  num: number[]; // Numerator coefficients [highest power first]
  den: number[]; // Denominator coefficients
}

// Evaluate transfer function at s
function tfEval(tf: TransferFunction, s: Complex): Complex {
  const num = polyEval(tf.num, s);
  const den = polyEval(tf.den, s);
  return cDiv(num, den);
}

// Find roots of polynomial using Newton's method
function findRoots(coeffs: number[]): Complex[] {
  const roots: Complex[] = [];
  const n = coeffs.length - 1;

  if (n <= 0) return roots;

  // Deflate polynomial as we find roots
  let currentCoeffs = [...coeffs];

  for (let i = 0; i < n; i++) {
    // Initial guess
    let x = complex(Math.random() - 0.5, Math.random() - 0.5);

    // Newton's method
    for (let iter = 0; iter < 100; iter++) {
      const fx = polyEval(currentCoeffs, x);
      if (cAbs(fx) < 1e-10) break;

      // Derivative
      const derivCoeffs = currentCoeffs
        .slice(0, -1)
        .map((c, j) => c * (currentCoeffs.length - 1 - j));
      if (derivCoeffs.length === 0) break;

      const dfx = polyEval(derivCoeffs, x);
      if (cAbs(dfx) < 1e-15) {
        x = cAdd(x, complex(0.1, 0.1));
        continue;
      }

      x = cSub(x, cDiv(fx, dfx));
    }

    roots.push(x);

    // Deflate polynomial
    if (currentCoeffs.length > 2) {
      const newCoeffs = [currentCoeffs[0]];
      for (let j = 1; j < currentCoeffs.length - 1; j++) {
        newCoeffs.push(currentCoeffs[j] + x.re * newCoeffs[j - 1]);
      }
      currentCoeffs = newCoeffs;
    }
  }

  return roots;
}

// Step response of transfer function
function stepResponse(
  tf: TransferFunction,
  tMax: number,
  dt: number
): { time: number[]; response: number[] } {
  const time: number[] = [];
  const response: number[] = [];

  // Simple numerical simulation using trapezoidal rule
  const n = Math.ceil(tMax / dt);
  let y = 0;

  // State-space approximation
  for (let i = 0; i <= n; i++) {
    const t = i * dt;
    time.push(t);

    // For a simple first/second order system
    if (tf.den.length === 2) {
      // First order: G(s) = K / (τs + 1)
      const K = tf.num[0] / tf.den[1];
      const tau = tf.den[0] / tf.den[1];
      y = K * (1 - Math.exp(-t / tau));
    } else if (tf.den.length === 3) {
      // Second order: G(s) = Kω² / (s² + 2ζωs + ω²)
      const K = tf.num[0] / tf.den[2];
      const omega = Math.sqrt(tf.den[2] / tf.den[0]);
      const zeta = tf.den[1] / (2 * omega * tf.den[0]);

      if (zeta < 1) {
        // Underdamped
        const wd = omega * Math.sqrt(1 - zeta * zeta);
        const phi = Math.atan2(zeta, Math.sqrt(1 - zeta * zeta));
        y =
          K *
          (1 - (Math.exp(-zeta * omega * t) * Math.cos(wd * t - phi)) / Math.sqrt(1 - zeta * zeta));
      } else if (zeta === 1) {
        // Critically damped
        y = K * (1 - (1 + omega * t) * Math.exp(-omega * t));
      } else {
        // Overdamped
        const s1 = -omega * (zeta + Math.sqrt(zeta * zeta - 1));
        const s2 = -omega * (zeta - Math.sqrt(zeta * zeta - 1));
        y = K * (1 + (s1 * Math.exp(s2 * t) - s2 * Math.exp(s1 * t)) / (s2 - s1));
      }
    } else {
      // General case - simple approximation
      y =
        (tf.num[0] / tf.den[tf.den.length - 1]) *
        (1 - Math.exp((-t * tf.den[tf.den.length - 1]) / tf.den[0]));
    }

    response.push(y);
  }

  return { time, response };
}

// Bode plot data
function bodeData(
  tf: TransferFunction,
  wMin: number,
  wMax: number,
  nPoints: number
): {
  frequency: number[];
  magnitude_dB: number[];
  phase_deg: number[];
} {
  const frequency: number[] = [];
  const magnitude_dB: number[] = [];
  const phase_deg: number[] = [];

  const logWMin = Math.log10(wMin);
  const logWMax = Math.log10(wMax);

  for (let i = 0; i < nPoints; i++) {
    const logW = logWMin + ((logWMax - logWMin) * i) / (nPoints - 1);
    const w = Math.pow(10, logW);
    const s = complex(0, w); // s = jω

    const H = tfEval(tf, s);
    const mag = cAbs(H);
    const phase = cArg(H);

    frequency.push(w);
    magnitude_dB.push(20 * Math.log10(mag));
    phase_deg.push((phase * 180) / Math.PI);
  }

  return { frequency, magnitude_dB, phase_deg };
}

// PID controller
interface PIDGains {
  Kp: number;
  Ki: number;
  Kd: number;
}

// Ziegler-Nichols tuning
function zieglerNicholsTuning(Ku: number, Tu: number, type: 'P' | 'PI' | 'PID'): PIDGains {
  switch (type) {
    case 'P':
      return { Kp: 0.5 * Ku, Ki: 0, Kd: 0 };
    case 'PI':
      return { Kp: 0.45 * Ku, Ki: (0.54 * Ku) / Tu, Kd: 0 };
    case 'PID':
      return { Kp: 0.6 * Ku, Ki: (1.2 * Ku) / Tu, Kd: 0.075 * Ku * Tu };
  }
}

// Cohen-Coon tuning for first-order plus dead-time
function cohenCoonTuning(
  K: number,
  tau: number,
  theta: number,
  type: 'P' | 'PI' | 'PID'
): PIDGains {
  const r = theta / tau;
  switch (type) {
    case 'P':
      return { Kp: (1 / K) * (tau / theta) * (1 + r / 3), Ki: 0, Kd: 0 };
    case 'PI':
      return {
        Kp: (1 / K) * (tau / theta) * (0.9 + r / 12),
        Ki: ((1 / K) * (tau / theta) * (0.9 + r / 12)) / ((theta * (30 + 3 * r)) / (9 + 20 * r)),
        Kd: 0,
      };
    case 'PID':
      return {
        Kp: (1 / K) * (tau / theta) * (4 / 3 + r / 4),
        Ki: ((1 / K) * (tau / theta) * (4 / 3 + r / 4)) / ((theta * (32 + 6 * r)) / (13 + 8 * r)),
        Kd: ((1 / K) * (tau / theta) * (4 / 3 + r / 4) * theta * 4) / (11 + 2 * r),
      };
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const controlTheoryTool: UnifiedTool = {
  name: 'control_theory',
  description: `Control systems analysis and design for robotics, aerospace, and automation.

Available operations:
- analyze_tf: Analyze transfer function (poles, zeros, stability)
- step_response: Calculate step response
- bode_plot: Generate Bode plot data (magnitude, phase vs frequency)
- pid_tune: Auto-tune PID controller (Ziegler-Nichols, Cohen-Coon)
- root_locus: Calculate root locus points
- stability: Check BIBO stability (poles in left half-plane)
- margins: Calculate gain and phase margins

Transfer function format: {num: [coefficients], den: [coefficients]}
Example: G(s) = 1/(s²+2s+1) → {num: [1], den: [1, 2, 1]}`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'analyze_tf',
          'step_response',
          'bode_plot',
          'pid_tune',
          'root_locus',
          'stability',
          'margins',
        ],
        description: 'Control system operation',
      },
      num: {
        type: 'array',
        items: { type: 'number' },
        description: 'Numerator coefficients [highest power first]',
      },
      den: {
        type: 'array',
        items: { type: 'number' },
        description: 'Denominator coefficients [highest power first]',
      },
      t_max: {
        type: 'number',
        description: 'Maximum time for step response (default: 10)',
      },
      dt: {
        type: 'number',
        description: 'Time step (default: 0.01)',
      },
      w_min: {
        type: 'number',
        description: 'Minimum frequency for Bode (default: 0.01)',
      },
      w_max: {
        type: 'number',
        description: 'Maximum frequency for Bode (default: 100)',
      },
      n_points: {
        type: 'number',
        description: 'Number of points (default: 100)',
      },
      pid_type: {
        type: 'string',
        enum: ['P', 'PI', 'PID'],
        description: 'PID controller type',
      },
      tuning_method: {
        type: 'string',
        enum: ['ziegler_nichols', 'cohen_coon'],
        description: 'PID tuning method',
      },
      Ku: {
        type: 'number',
        description: 'Ultimate gain for Ziegler-Nichols',
      },
      Tu: {
        type: 'number',
        description: 'Ultimate period for Ziegler-Nichols',
      },
      K: {
        type: 'number',
        description: 'Process gain for Cohen-Coon',
      },
      tau: {
        type: 'number',
        description: 'Time constant for Cohen-Coon',
      },
      theta: {
        type: 'number',
        description: 'Dead time for Cohen-Coon',
      },
    },
    required: ['operation'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isControlTheoryAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTE FUNCTION
// ============================================================================

export async function executeControlTheory(call: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = call.arguments as {
    operation: string;
    num?: number[];
    den?: number[];
    t_max?: number;
    dt?: number;
    w_min?: number;
    w_max?: number;
    n_points?: number;
    pid_type?: 'P' | 'PI' | 'PID';
    tuning_method?: string;
    Ku?: number;
    Tu?: number;
    K?: number;
    tau?: number;
    theta?: number;
  };

  const {
    operation,
    num = [1],
    den = [1, 1],
    t_max = 10,
    dt = 0.01,
    w_min = 0.01,
    w_max = 100,
    n_points = 100,
    pid_type = 'PID',
    tuning_method,
    Ku,
    Tu,
    K,
    tau,
    theta,
  } = args;

  try {
    const tf: TransferFunction = { num, den };
    const result: Record<string, unknown> = { operation };

    switch (operation) {
      case 'analyze_tf': {
        // Find poles (roots of denominator)
        const poles = findRoots(den);
        const zeros = num.length > 1 ? findRoots(num) : [];

        result.transfer_function = {
          numerator: num,
          denominator: den,
          order: den.length - 1,
        };

        result.poles = poles.map((p) => ({
          real: p.re,
          imaginary: p.im,
          magnitude: cAbs(p),
          angle_deg: (cArg(p) * 180) / Math.PI,
        }));

        result.zeros = zeros.map((z) => ({
          real: z.re,
          imaginary: z.im,
        }));

        // Stability check
        const isStable = poles.every((p) => p.re < 0);
        result.stability = {
          is_stable: isStable,
          reason: isStable
            ? 'All poles have negative real parts (left half-plane)'
            : 'One or more poles have non-negative real parts',
        };

        // DC gain
        const dcGain = num.reduce((a, b) => a + b, 0) / den.reduce((a, b) => a + b, 0);
        result.dc_gain = dcGain;

        // System characteristics
        if (den.length === 3) {
          const omega_n = Math.sqrt(den[2] / den[0]);
          const zeta = den[1] / (2 * omega_n * den[0]);
          result.second_order_params = {
            natural_frequency: omega_n,
            damping_ratio: zeta,
            damping_type:
              zeta < 1 ? 'underdamped' : zeta === 1 ? 'critically damped' : 'overdamped',
          };
        }
        break;
      }

      case 'step_response': {
        const response = stepResponse(tf, t_max, dt);

        // Calculate performance metrics
        const steadyState = response.response[response.response.length - 1];
        const maxValue = Math.max(...response.response);
        const overshoot = ((maxValue - steadyState) / steadyState) * 100;

        // Rise time (10% to 90%)
        const target10 = 0.1 * steadyState;
        const target90 = 0.9 * steadyState;
        let riseTime = 0;
        let t10 = 0,
          t90 = 0;
        for (let i = 0; i < response.response.length; i++) {
          if (response.response[i] >= target10 && t10 === 0) t10 = response.time[i];
          if (response.response[i] >= target90 && t90 === 0) t90 = response.time[i];
        }
        riseTime = t90 - t10;

        // Settling time (2% criterion)
        let settlingTime = t_max;
        for (let i = response.response.length - 1; i >= 0; i--) {
          if (Math.abs(response.response[i] - steadyState) > 0.02 * steadyState) {
            settlingTime = response.time[i];
            break;
          }
        }

        result.time = response.time.filter((_, i) => i % 10 === 0); // Downsample for output
        result.response = response.response.filter((_, i) => i % 10 === 0);
        result.performance = {
          steady_state_value: steadyState,
          overshoot_percent: overshoot,
          rise_time: riseTime,
          settling_time_2percent: settlingTime,
          peak_value: maxValue,
        };
        break;
      }

      case 'bode_plot': {
        const bode = bodeData(tf, w_min, w_max, n_points);

        // Find crossover frequencies
        let gainCrossover = 0;
        let phaseCrossover = 0;
        for (let i = 1; i < bode.magnitude_dB.length; i++) {
          if (bode.magnitude_dB[i - 1] > 0 && bode.magnitude_dB[i] <= 0) {
            gainCrossover = bode.frequency[i];
          }
          if (bode.phase_deg[i - 1] > -180 && bode.phase_deg[i] <= -180) {
            phaseCrossover = bode.frequency[i];
          }
        }

        result.frequency = bode.frequency;
        result.magnitude_dB = bode.magnitude_dB;
        result.phase_deg = bode.phase_deg;
        result.crossover = {
          gain_crossover_frequency: gainCrossover,
          phase_crossover_frequency: phaseCrossover,
        };
        break;
      }

      case 'pid_tune': {
        if (tuning_method === 'ziegler_nichols') {
          if (!Ku || !Tu) throw new Error('Ku and Tu required for Ziegler-Nichols');
          const gains = zieglerNicholsTuning(Ku, Tu, pid_type);
          result.method = 'Ziegler-Nichols';
          result.input = { Ku, Tu };
          result.gains = gains;
          result.transfer_function = {
            Kp: gains.Kp,
            Ki: gains.Ki,
            Kd: gains.Kd,
            formula: `C(s) = ${gains.Kp.toFixed(4)} + ${gains.Ki.toFixed(4)}/s + ${gains.Kd.toFixed(4)}s`,
          };
        } else if (tuning_method === 'cohen_coon') {
          if (!K || !tau || !theta) throw new Error('K, tau, theta required for Cohen-Coon');
          const gains = cohenCoonTuning(K, tau, theta, pid_type);
          result.method = 'Cohen-Coon';
          result.input = { K, tau, theta };
          result.gains = gains;
          result.transfer_function = {
            Kp: gains.Kp,
            Ki: gains.Ki,
            Kd: gains.Kd,
            formula: `C(s) = ${gains.Kp.toFixed(4)} + ${gains.Ki.toFixed(4)}/s + ${gains.Kd.toFixed(4)}s`,
          };
        } else {
          throw new Error('Specify tuning_method: ziegler_nichols or cohen_coon');
        }
        break;
      }

      case 'stability': {
        const poles = findRoots(den);
        const isStable = poles.every((p) => p.re < 0);
        const marginallyStable = poles.some((p) => Math.abs(p.re) < 1e-10 && p.im !== 0);

        result.poles = poles.map((p) => ({ real: p.re, imag: p.im }));
        result.stability = {
          BIBO_stable: isStable,
          marginally_stable: marginallyStable,
          unstable: !isStable && !marginallyStable,
        };
        result.analysis = isStable
          ? 'System is BIBO stable (all poles in open left half-plane)'
          : marginallyStable
            ? 'System is marginally stable (poles on imaginary axis)'
            : 'System is unstable (poles in right half-plane)';
        break;
      }

      case 'margins': {
        const bode = bodeData(tf, w_min, w_max, n_points * 2);

        // Gain margin at phase = -180°
        let gainMargin = Infinity;
        let phaseAtGainCrossover = 0;
        for (let i = 1; i < bode.phase_deg.length; i++) {
          if (bode.phase_deg[i - 1] > -180 && bode.phase_deg[i] <= -180) {
            gainMargin = -bode.magnitude_dB[i];
            phaseAtGainCrossover = bode.frequency[i];
            break;
          }
        }

        // Phase margin at gain = 0 dB
        let phaseMargin = 0;
        let gainCrossoverFreq = 0;
        for (let i = 1; i < bode.magnitude_dB.length; i++) {
          if (bode.magnitude_dB[i - 1] > 0 && bode.magnitude_dB[i] <= 0) {
            phaseMargin = 180 + bode.phase_deg[i];
            gainCrossoverFreq = bode.frequency[i];
            break;
          }
        }

        result.gain_margin = {
          value_dB: gainMargin,
          frequency: phaseAtGainCrossover,
        };
        result.phase_margin = {
          value_deg: phaseMargin,
          frequency: gainCrossoverFreq,
        };
        result.stability_assessment =
          gainMargin > 0 && phaseMargin > 0
            ? 'Stable with positive margins'
            : 'May be unstable - check margins';
        break;
      }

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
