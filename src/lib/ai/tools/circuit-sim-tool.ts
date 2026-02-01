// ============================================================================
// CIRCUIT SIMULATION TOOL - TIER INFINITY
// ============================================================================
// Electronic circuit analysis: RC/RLC circuits, impedance, frequency response,
// filter design, and basic SPICE-like calculations.
// Pure TypeScript implementation - no external dependencies.
// ============================================================================

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

interface Complex {
  re: number;
  im: number;
}

// ============================================================================
// COMPLEX NUMBER OPERATIONS
// ============================================================================

function complex(re: number, im: number = 0): Complex {
  return { re, im };
}

function cAdd(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im };
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

function cPhase(a: Complex): number {
  return Math.atan2(a.im, a.re);
}

function cPhaseDeg(a: Complex): number {
  return (cPhase(a) * 180) / Math.PI;
}

// ============================================================================
// CORE CIRCUIT FUNCTIONS
// ============================================================================

// Resistor impedance
function impedanceR(r: number): Complex {
  return complex(r, 0);
}

// Capacitor impedance: Z = 1/(jωC) = -j/(ωC)
function impedanceC(c: number, omega: number): Complex {
  if (omega === 0) return complex(Infinity, 0);
  return complex(0, -1 / (omega * c));
}

// Inductor impedance: Z = jωL
function impedanceL(l: number, omega: number): Complex {
  return complex(0, omega * l);
}

// Series impedance
function seriesImpedance(impedances: Complex[]): Complex {
  return impedances.reduce((sum, z) => cAdd(sum, z), complex(0));
}

// Parallel impedance: 1/Ztotal = 1/Z1 + 1/Z2 + ...
function parallelImpedance(impedances: Complex[]): Complex {
  const sumInv = impedances.reduce((sum, z) => cAdd(sum, cDiv(complex(1), z)), complex(0));
  return cDiv(complex(1), sumInv);
}

// Voltage divider
function voltageDivider(vin: Complex, z1: Complex, z2: Complex): Complex {
  return cMul(vin, cDiv(z2, cAdd(z1, z2)));
}

// RC time constant
function rcTimeConstant(r: number, c: number): number {
  return r * c;
}

// RC cutoff frequency
function rcCutoffFreq(r: number, c: number): number {
  return 1 / (2 * Math.PI * r * c);
}

// RLC resonant frequency
function rlcResonantFreq(l: number, c: number): number {
  return 1 / (2 * Math.PI * Math.sqrt(l * c));
}

// RLC quality factor
function rlcQualityFactor(r: number, l: number, c: number): number {
  return (1 / r) * Math.sqrt(l / c);
}

// RLC bandwidth
function rlcBandwidth(r: number, l: number): number {
  return r / (2 * Math.PI * l);
}

// Decibels
function toDecibels(ratio: number): number {
  return 20 * Math.log10(ratio);
}

// ============================================================================
// FILTER ANALYSIS
// ============================================================================

interface FrequencyResponse {
  frequency: number;
  magnitude: number;
  magnitude_db: number;
  phase_deg: number;
}

function lowPassRCResponse(r: number, c: number, frequencies: number[]): FrequencyResponse[] {
  return frequencies.map((f) => {
    const omega = 2 * Math.PI * f;
    const zR = impedanceR(r);
    const zC = impedanceC(c, omega);
    const h = cDiv(zC, cAdd(zR, zC));
    const mag = cAbs(h);
    return {
      frequency: f,
      magnitude: mag,
      magnitude_db: toDecibels(mag),
      phase_deg: cPhaseDeg(h),
    };
  });
}

function highPassRCResponse(r: number, c: number, frequencies: number[]): FrequencyResponse[] {
  return frequencies.map((f) => {
    const omega = 2 * Math.PI * f;
    const zR = impedanceR(r);
    const zC = impedanceC(c, omega);
    const h = cDiv(zR, cAdd(zR, zC));
    const mag = cAbs(h);
    return {
      frequency: f,
      magnitude: mag,
      magnitude_db: toDecibels(mag),
      phase_deg: cPhaseDeg(h),
    };
  });
}

function bandPassRLCResponse(
  r: number,
  l: number,
  c: number,
  frequencies: number[]
): FrequencyResponse[] {
  return frequencies.map((f) => {
    const omega = 2 * Math.PI * f;
    const zR = impedanceR(r);
    const zL = impedanceL(l, omega);
    const zC = impedanceC(c, omega);
    // Series RLC, output across R
    const zTotal = seriesImpedance([zR, zL, zC]);
    const h = cDiv(zR, zTotal);
    const mag = cAbs(h);
    return {
      frequency: f,
      magnitude: mag,
      magnitude_db: toDecibels(mag),
      phase_deg: cPhaseDeg(h),
    };
  });
}

// Generate logarithmic frequency sweep
function logFreqSweep(fStart: number, fEnd: number, points: number): number[] {
  const freqs: number[] = [];
  const logStart = Math.log10(fStart);
  const logEnd = Math.log10(fEnd);
  const step = (logEnd - logStart) / (points - 1);
  for (let i = 0; i < points; i++) {
    freqs.push(Math.pow(10, logStart + i * step));
  }
  return freqs;
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const circuitSimTool: UnifiedTool = {
  name: 'circuit_sim',
  description: `Electronic circuit simulation and analysis.

Operations:
- impedance: Calculate component impedance at frequency
- series: Series impedance combination
- parallel: Parallel impedance combination
- divider: Voltage divider analysis
- rc: RC circuit time constant and cutoff
- rlc: RLC resonance and Q factor
- filter: Frequency response of filters
- bode: Generate Bode plot data`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['impedance', 'series', 'parallel', 'divider', 'rc', 'rlc', 'filter', 'bode'],
        description: 'Analysis to perform',
      },
      r: { type: 'number', description: 'Resistance in Ohms' },
      c: { type: 'number', description: 'Capacitance in Farads' },
      l: { type: 'number', description: 'Inductance in Henries' },
      frequency: { type: 'number', description: 'Frequency in Hz' },
      f_start: { type: 'number', description: 'Start frequency for sweep' },
      f_end: { type: 'number', description: 'End frequency for sweep' },
      points: { type: 'number', description: 'Number of frequency points' },
      component: { type: 'string', enum: ['resistor', 'capacitor', 'inductor'] },
      filter_type: { type: 'string', enum: ['lowpass_rc', 'highpass_rc', 'bandpass_rlc'] },
      vin: { type: 'number', description: 'Input voltage' },
      components: {
        type: 'array',
        items: { type: 'object' },
        description: 'Array of components [{type: "r"|"c"|"l", value: number}]',
      },
    },
    required: ['operation'],
  },
};

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeCircuitSim(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;
    const freq = args.frequency || 1000;
    const omega = 2 * Math.PI * freq;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'impedance': {
        const { component, r, c, l } = args;

        if (component === 'resistor' && r !== undefined) {
          const z = impedanceR(r);
          result = {
            operation: 'impedance',
            component: 'resistor',
            value_ohms: r,
            impedance: { real: z.re, imaginary: z.im },
            magnitude_ohms: cAbs(z),
            phase_deg: 0,
          };
        } else if (component === 'capacitor' && c !== undefined) {
          const z = impedanceC(c, omega);
          result = {
            operation: 'impedance',
            component: 'capacitor',
            value_farads: c,
            frequency_hz: freq,
            impedance: { real: z.re, imaginary: z.im },
            magnitude_ohms: cAbs(z),
            phase_deg: cPhaseDeg(z),
            reactance_ohms: z.im,
          };
        } else if (component === 'inductor' && l !== undefined) {
          const z = impedanceL(l, omega);
          result = {
            operation: 'impedance',
            component: 'inductor',
            value_henries: l,
            frequency_hz: freq,
            impedance: { real: z.re, imaginary: z.im },
            magnitude_ohms: cAbs(z),
            phase_deg: cPhaseDeg(z),
            reactance_ohms: z.im,
          };
        } else {
          throw new Error('impedance requires component type and value');
        }
        break;
      }

      case 'series': {
        const { components } = args;
        if (!components || components.length === 0) {
          throw new Error('series requires components array');
        }

        const impedances = components.map((comp: { type: string; value: number }) => {
          if (comp.type === 'r') return impedanceR(comp.value);
          if (comp.type === 'c') return impedanceC(comp.value, omega);
          if (comp.type === 'l') return impedanceL(comp.value, omega);
          throw new Error(`Unknown component type: ${comp.type}`);
        });

        const zTotal = seriesImpedance(impedances);

        result = {
          operation: 'series',
          frequency_hz: freq,
          components: components.map((c: { type: string; value: number }) => ({
            type: c.type,
            value: c.value,
          })),
          total_impedance: { real: zTotal.re, imaginary: zTotal.im },
          magnitude_ohms: cAbs(zTotal),
          phase_deg: cPhaseDeg(zTotal),
        };
        break;
      }

      case 'parallel': {
        const { components } = args;
        if (!components || components.length === 0) {
          throw new Error('parallel requires components array');
        }

        const impedances = components.map((comp: { type: string; value: number }) => {
          if (comp.type === 'r') return impedanceR(comp.value);
          if (comp.type === 'c') return impedanceC(comp.value, omega);
          if (comp.type === 'l') return impedanceL(comp.value, omega);
          throw new Error(`Unknown component type: ${comp.type}`);
        });

        const zTotal = parallelImpedance(impedances);

        result = {
          operation: 'parallel',
          frequency_hz: freq,
          components: components.map((c: { type: string; value: number }) => ({
            type: c.type,
            value: c.value,
          })),
          total_impedance: { real: zTotal.re, imaginary: zTotal.im },
          magnitude_ohms: cAbs(zTotal),
          phase_deg: cPhaseDeg(zTotal),
        };
        break;
      }

      case 'divider': {
        const { r, c, vin } = args;
        if (r === undefined) {
          throw new Error('divider requires resistance values');
        }

        // Simple resistive divider or RC divider
        const vinComplex = complex(vin || 1, 0);
        const z1 = impedanceR(r);
        let z2: Complex;

        if (c !== undefined) {
          z2 = impedanceC(c, omega);
        } else {
          z2 = impedanceR(r); // Default equal resistors
        }

        const vout = voltageDivider(vinComplex, z1, z2);

        result = {
          operation: 'divider',
          vin: vin || 1,
          frequency_hz: freq,
          vout_magnitude: cAbs(vout),
          vout_phase_deg: cPhaseDeg(vout),
          gain: cAbs(vout) / (vin || 1),
          gain_db: toDecibels(cAbs(vout) / (vin || 1)),
        };
        break;
      }

      case 'rc': {
        const { r, c } = args;
        if (r === undefined || c === undefined) {
          throw new Error('rc requires r and c values');
        }

        const tau = rcTimeConstant(r, c);
        const fc = rcCutoffFreq(r, c);

        result = {
          operation: 'rc',
          r_ohms: r,
          c_farads: c,
          results: {
            time_constant_s: tau,
            time_constant_ms: tau * 1000,
            cutoff_frequency_hz: fc,
            cutoff_frequency_khz: fc / 1000,
            rise_time_10_90_s: 2.2 * tau,
            settling_time_1pct_s: 4.6 * tau,
          },
          notes: {
            at_cutoff: 'Gain is -3dB, phase shift is -45°',
            one_tau: '63.2% of final value',
            five_tau: '99.3% of final value',
          },
        };
        break;
      }

      case 'rlc': {
        const { r, l, c } = args;
        if (r === undefined || l === undefined || c === undefined) {
          throw new Error('rlc requires r, l, and c values');
        }

        const f0 = rlcResonantFreq(l, c);
        const Q = rlcQualityFactor(r, l, c);
        const bw = rlcBandwidth(r, l);

        const omega0 = 2 * Math.PI * f0;
        const dampingRatio = r / (2 * Math.sqrt(l / c));

        result = {
          operation: 'rlc',
          r_ohms: r,
          l_henries: l,
          c_farads: c,
          results: {
            resonant_frequency_hz: f0,
            resonant_frequency_khz: f0 / 1000,
            quality_factor: Q,
            bandwidth_hz: bw,
            bandwidth_khz: bw / 1000,
            damping_ratio: dampingRatio,
            characteristic_impedance: Math.sqrt(l / c),
          },
          behavior:
            dampingRatio < 1
              ? 'underdamped'
              : dampingRatio === 1
                ? 'critically_damped'
                : 'overdamped',
          angular_frequency_rad_s: omega0,
        };
        break;
      }

      case 'filter': {
        const { filter_type, r, l, c, f_start, f_end, points } = args;
        if (r === undefined || c === undefined) {
          throw new Error('filter requires r and c values');
        }

        const fStart = f_start || 10;
        const fEnd = f_end || 100000;
        const numPoints = points || 50;
        const frequencies = logFreqSweep(fStart, fEnd, numPoints);

        let response: FrequencyResponse[];
        let fc: number;

        switch (filter_type) {
          case 'lowpass_rc':
            response = lowPassRCResponse(r, c, frequencies);
            fc = rcCutoffFreq(r, c);
            break;
          case 'highpass_rc':
            response = highPassRCResponse(r, c, frequencies);
            fc = rcCutoffFreq(r, c);
            break;
          case 'bandpass_rlc':
            if (l === undefined) throw new Error('bandpass requires l value');
            response = bandPassRLCResponse(r, l, c, frequencies);
            fc = rlcResonantFreq(l, c);
            break;
          default:
            response = lowPassRCResponse(r, c, frequencies);
            fc = rcCutoffFreq(r, c);
        }

        result = {
          operation: 'filter',
          filter_type: filter_type || 'lowpass_rc',
          cutoff_or_center_frequency_hz: fc,
          frequency_range: { start: fStart, end: fEnd },
          response: response.filter((_, i) => i % Math.ceil(numPoints / 20) === 0), // Limit output
          full_response_points: response.length,
        };
        break;
      }

      case 'bode': {
        const { r, c, l, f_start, f_end, points, filter_type } = args;
        if (r === undefined || c === undefined) {
          throw new Error('bode requires r and c values');
        }

        const fStart = f_start || 1;
        const fEnd = f_end || 1000000;
        const numPoints = points || 100;
        const frequencies = logFreqSweep(fStart, fEnd, numPoints);

        let response: FrequencyResponse[];

        if (filter_type === 'bandpass_rlc' && l !== undefined) {
          response = bandPassRLCResponse(r, l, c, frequencies);
        } else if (filter_type === 'highpass_rc') {
          response = highPassRCResponse(r, c, frequencies);
        } else {
          response = lowPassRCResponse(r, c, frequencies);
        }

        // Find -3dB point
        const cutoffIdx = response.findIndex((r) => r.magnitude_db <= -3);
        const fcFound = cutoffIdx > 0 ? response[cutoffIdx].frequency : null;

        result = {
          operation: 'bode',
          components: { r, c, l },
          cutoff_frequency_hz: fcFound,
          bode_data: response.map((r) => ({
            frequency_hz: r.frequency,
            magnitude_db: r.magnitude_db,
            phase_deg: r.phase_deg,
          })),
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return {
      toolCallId: id,
      content: JSON.stringify(result, null, 2),
    };
  } catch (error) {
    return {
      toolCallId: id,
      content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      isError: true,
    };
  }
}

export function isCircuitSimAvailable(): boolean {
  return true;
}
