/**
 * GRAVITATIONAL-WAVE TOOL
 * Gravitational wave physics and waveform generation
 *
 * Implements real gravitational wave physics:
 * - Binary inspiral waveforms (chirp)
 * - Chirp mass calculation
 * - Strain amplitude computation
 * - Frequency evolution
 * - LIGO/Virgo detection sensitivity
 * - Source parameter estimation
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const gravitationalwaveTool: UnifiedTool = {
  name: 'gravitational_wave',
  description:
    'Gravitational wave physics - waveform generation, chirp mass, strain calculation, detection analysis.',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'waveform',
          'chirp_mass',
          'strain',
          'frequency',
          'detection',
          'merger_time',
          'energy',
          'info',
        ],
        description:
          'Operation: waveform (generate signal), chirp_mass (compute M_c), strain (amplitude), frequency (evolution), detection (SNR), merger_time (time to coalescence), energy (radiated)',
      },
      source: {
        type: 'string',
        enum: ['binary_blackhole', 'binary_neutron_star', 'neutron_star_blackhole', 'pulsar'],
        description: 'Gravitational wave source type',
      },
      m1: { type: 'number', description: 'Mass of first object in solar masses M☉' },
      m2: { type: 'number', description: 'Mass of second object in solar masses M☉' },
      distance: { type: 'number', description: 'Luminosity distance in Mpc' },
      spin1: { type: 'number', description: 'Dimensionless spin of first object (-1 to 1)' },
      spin2: { type: 'number', description: 'Dimensionless spin of second object (-1 to 1)' },
      f_start: { type: 'number', description: 'Starting frequency in Hz' },
      f_end: { type: 'number', description: 'Ending frequency in Hz (or ISCO)' },
      duration: { type: 'number', description: 'Waveform duration in seconds' },
      sample_rate: { type: 'number', description: 'Sample rate in Hz' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// PHYSICAL CONSTANTS
// ============================================================================

const CONSTANTS = {
  // Speed of light (m/s)
  c: 299792458,

  // Gravitational constant (m³/kg/s²)
  G: 6.6743e-11,

  // Solar mass (kg)
  M_sun: 1.989e30,

  // Megaparsec (m)
  Mpc: 3.086e22,

  // Pi
  PI: Math.PI,

  // Schwarzschild radius of Sun (m)
  R_sun: 2953.25,
};

// ============================================================================
// CHIRP MASS AND MASS PARAMETERS
// ============================================================================

/**
 * Calculate chirp mass: M_c = (m1 * m2)^(3/5) / (m1 + m2)^(1/5)
 * The chirp mass determines the leading-order frequency evolution
 */
function chirpMass(m1_msun: number, m2_msun: number): number {
  const eta = symmetricMassRatio(m1_msun, m2_msun);
  const M = m1_msun + m2_msun;
  return M * Math.pow(eta, 3 / 5);
}

/**
 * Symmetric mass ratio: η = m1*m2/(m1+m2)² ∈ (0, 0.25]
 */
function symmetricMassRatio(m1: number, m2: number): number {
  const M = m1 + m2;
  return (m1 * m2) / (M * M);
}

/**
 * Reduced mass: μ = m1*m2/(m1+m2)
 */
export function reducedMass(m1: number, m2: number): number {
  return (m1 * m2) / (m1 + m2);
}

/**
 * Total mass in geometric units (seconds)
 */
export function totalMassSeconds(m1_msun: number, m2_msun: number): number {
  const M_kg = (m1_msun + m2_msun) * CONSTANTS.M_sun;
  return (CONSTANTS.G * M_kg) / (CONSTANTS.c * CONSTANTS.c * CONSTANTS.c);
}

/**
 * Chirp mass in seconds (geometric units)
 */
function chirpMassSeconds(m1_msun: number, m2_msun: number): number {
  const Mc_msun = chirpMass(m1_msun, m2_msun);
  const Mc_kg = Mc_msun * CONSTANTS.M_sun;
  return (CONSTANTS.G * Mc_kg) / (CONSTANTS.c * CONSTANTS.c * CONSTANTS.c);
}

// ============================================================================
// INNERMOST STABLE CIRCULAR ORBIT (ISCO)
// ============================================================================

/**
 * ISCO frequency for Schwarzschild (non-spinning) black hole
 * f_ISCO = c³/(6√6 π G M)
 */
function iscoFrequency(M_msun: number): number {
  const M_seconds = (CONSTANTS.G * M_msun * CONSTANTS.M_sun) / Math.pow(CONSTANTS.c, 3);
  return 1 / (6 * Math.sqrt(6) * CONSTANTS.PI * M_seconds);
}

/**
 * ISCO frequency with spin (Kerr metric, equatorial)
 * Approximation for aligned spin
 */
function iscoFrequencyKerr(M_msun: number, chi: number): number {
  const f_schwarz = iscoFrequency(M_msun);
  // Spin correction (approximate)
  const correction = 1 + 0.5 * chi + 0.1 * chi * chi;
  return f_schwarz * correction;
}

// ============================================================================
// STRAIN AND WAVEFORM
// ============================================================================

/**
 * Characteristic strain amplitude
 * h_0 = (4/d) * (G*M_c/c²)^(5/3) * (π*f/c)^(2/3)
 */
function strainAmplitude(Mc_msun: number, f_hz: number, distance_Mpc: number): number {
  const Mc_kg = Mc_msun * CONSTANTS.M_sun;
  const d_m = distance_Mpc * CONSTANTS.Mpc;

  const Mc_factor = Math.pow((CONSTANTS.G * Mc_kg) / Math.pow(CONSTANTS.c, 2), 5 / 3);
  const freq_factor = Math.pow((CONSTANTS.PI * f_hz) / CONSTANTS.c, 2 / 3);

  return (4 / d_m) * Mc_factor * freq_factor * CONSTANTS.c;
}

/**
 * Generate inspiral waveform (Newtonian chirp)
 * h(t) = A(t) * cos(Φ(t))
 * where frequency chirps: df/dt = (96/5) * π^(8/3) * (G*M_c/c³)^(5/3) * f^(11/3)
 */
function generateWaveform(
  m1_msun: number,
  m2_msun: number,
  distance_Mpc: number,
  f_start: number,
  f_end: number,
  sample_rate: number,
  duration?: number
): { time: number[]; h_plus: number[]; h_cross: number[]; frequency: number[] } {
  const Mc = chirpMass(m1_msun, m2_msun);
  const Mc_sec = chirpMassSeconds(m1_msun, m2_msun);

  const time: number[] = [];
  const h_plus: number[] = [];
  const h_cross: number[] = [];
  const frequency: number[] = [];

  const dt = 1 / sample_rate;

  // Calculate time to merger from f_start
  const tau = timeToMerger(m1_msun, m2_msun, f_start);
  const maxTime = duration || Math.min(tau, 60); // Cap at 60 seconds

  let f = f_start;
  let phase = 0;

  for (let t = 0; t < maxTime && f < f_end && f > 0; t += dt) {
    // Strain amplitude at current frequency
    const h0 = strainAmplitude(Mc, f, distance_Mpc);

    // Plus and cross polarizations (simplified, face-on)
    h_plus.push(h0 * Math.cos(phase));
    h_cross.push(h0 * Math.sin(phase));
    time.push(t);
    frequency.push(f);

    // Phase evolution: dΦ/dt = 2πf
    phase += 2 * CONSTANTS.PI * f * dt;

    // Frequency evolution (Newtonian chirp)
    // df/dt = (96/5) * π^(8/3) * M_c^(5/3) * f^(11/3)
    const dfdt =
      (96 / 5) * Math.pow(CONSTANTS.PI, 8 / 3) * Math.pow(Mc_sec, 5 / 3) * Math.pow(f, 11 / 3);
    f += dfdt * dt;
  }

  return { time, h_plus, h_cross, frequency };
}

// ============================================================================
// TIME TO MERGER
// ============================================================================

/**
 * Time to merger from frequency f
 * τ = (5/256) * (G*M_c/c³)^(-5/3) * (π*f)^(-8/3)
 */
function timeToMerger(m1_msun: number, m2_msun: number, f_hz: number): number {
  const Mc_sec = chirpMassSeconds(m1_msun, m2_msun);
  return (5 / 256) * Math.pow(Mc_sec, -5 / 3) * Math.pow(CONSTANTS.PI * f_hz, -8 / 3);
}

/**
 * Frequency evolution with time to merger
 */
function frequencyAtTime(m1_msun: number, m2_msun: number, tau: number): number {
  const Mc_sec = chirpMassSeconds(m1_msun, m2_msun);
  return (1 / CONSTANTS.PI) * Math.pow(((256 / 5) * Math.pow(Mc_sec, 5 / 3)) / tau, 3 / 8);
}

// ============================================================================
// ENERGY RADIATED
// ============================================================================

/**
 * Total energy radiated during inspiral (to ISCO)
 * E_rad ≈ η * M * c² * (useful approximation)
 */
function energyRadiated(
  m1_msun: number,
  m2_msun: number
): {
  joules: number;
  solar_masses: number;
  fraction: number;
} {
  const M = m1_msun + m2_msun;
  const eta = symmetricMassRatio(m1_msun, m2_msun);

  // Energy radiated as fraction of total mass
  // For equal masses (η=0.25), about 5% of M for inspiral + ~5% for merger/ringdown
  const fraction = eta * (1 / 12); // Approximate for inspiral to ISCO

  const M_kg = M * CONSTANTS.M_sun;
  const E_joules = fraction * M_kg * CONSTANTS.c * CONSTANTS.c;
  const E_msun = fraction * M;

  return {
    joules: E_joules,
    solar_masses: E_msun,
    fraction,
  };
}

/**
 * Peak luminosity (power) at merger
 * L_peak ≈ c^5/G * η² ≈ 3.6 × 10^52 W for equal masses
 */
function peakLuminosity(m1_msun: number, m2_msun: number): number {
  const eta = symmetricMassRatio(m1_msun, m2_msun);
  const L_planck = Math.pow(CONSTANTS.c, 5) / CONSTANTS.G; // ~3.6e52 W
  return L_planck * eta * eta;
}

// ============================================================================
// DETECTION SENSITIVITY
// ============================================================================

interface DetectorSensitivity {
  name: string;
  f_min: number;
  f_max: number;
  h_min: number; // Characteristic strain sensitivity at optimal frequency
}

const DETECTORS: Record<string, DetectorSensitivity> = {
  LIGO: { name: 'LIGO', f_min: 10, f_max: 5000, h_min: 1e-23 },
  Virgo: { name: 'Virgo', f_min: 10, f_max: 5000, h_min: 2e-23 },
  KAGRA: { name: 'KAGRA', f_min: 10, f_max: 5000, h_min: 3e-23 },
  LISA: { name: 'LISA', f_min: 1e-4, f_max: 0.1, h_min: 1e-20 },
  ET: { name: 'Einstein Telescope', f_min: 1, f_max: 10000, h_min: 1e-24 },
};

/**
 * Simplified SNR calculation
 * SNR ∝ h_c / h_n where h_c is characteristic strain and h_n is noise
 */
function calculateSNR(
  m1_msun: number,
  m2_msun: number,
  distance_Mpc: number,
  detector: string
): number {
  const det = DETECTORS[detector] || DETECTORS['LIGO'];
  const M = m1_msun + m2_msun;
  const f_isco = iscoFrequency(M);

  // Characteristic frequency
  const f_char = Math.min(f_isco, det.f_max);

  if (f_char < det.f_min) return 0;

  // Characteristic strain at typical frequency
  const Mc = chirpMass(m1_msun, m2_msun);
  const h_char = strainAmplitude(Mc, f_char, distance_Mpc);

  // Simple SNR estimate (more accurate would integrate over frequency)
  const snr = (h_char / det.h_min) * Math.sqrt(f_char / 100);

  return snr;
}

/**
 * Estimate detection horizon (distance at SNR=8)
 */
function detectionHorizon(m1_msun: number, m2_msun: number, detector: string): number {
  // Binary search for SNR=8 distance
  let d_low = 1; // 1 Mpc
  let d_high = 10000; // 10 Gpc

  for (let i = 0; i < 50; i++) {
    const d_mid = Math.sqrt(d_low * d_high);
    const snr = calculateSNR(m1_msun, m2_msun, d_mid, detector);

    if (snr > 8) {
      d_low = d_mid;
    } else {
      d_high = d_mid;
    }
  }

  return Math.sqrt(d_low * d_high);
}

// ============================================================================
// MAIN EXECUTOR
// ============================================================================

export async function executegravitationalwave(
  toolCall: UnifiedToolCall
): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const {
      operation = 'info',
      source = 'binary_blackhole',
      m1 = 30, // 30 solar masses
      m2 = 30,
      distance = 400, // 400 Mpc (typical LIGO detection)
      spin1 = 0,
      spin2 = 0,
      f_start = 20, // LIGO band
      f_end,
      duration = 1,
      sample_rate = 4096,
    } = args;

    // Calculate ISCO frequency as default end
    const M_total = m1 + m2;
    const f_isco = iscoFrequencyKerr(M_total, (spin1 + spin2) / 2);
    const f_end_actual = f_end || f_isco;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any;

    switch (operation) {
      case 'chirp_mass': {
        const Mc = chirpMass(m1, m2);
        const eta = symmetricMassRatio(m1, m2);
        const mu = reducedMass(m1, m2);

        result = {
          operation: 'chirp_mass',
          m1_solar: m1,
          m2_solar: m2,
          total_mass_solar: M_total,
          chirp_mass_solar: Mc,
          symmetric_mass_ratio: eta,
          reduced_mass_solar: mu,
          mass_ratio: m1 > m2 ? m1 / m2 : m2 / m1,
          formulas: {
            chirp_mass: 'M_c = (m₁m₂)^(3/5) / (m₁+m₂)^(1/5)',
            eta: 'η = m₁m₂/(m₁+m₂)² ∈ (0, 0.25]',
            meaning: 'Chirp mass determines leading-order frequency evolution',
          },
          description:
            `Binary with m₁=${m1}M☉, m₂=${m2}M☉: ` +
            `M_c = ${Mc.toFixed(2)}M☉, η = ${eta.toFixed(4)}`,
        };
        break;
      }

      case 'strain': {
        const Mc = chirpMass(m1, m2);
        const frequencies = [10, 20, 50, 100, 200, 500, f_isco];
        const strains = frequencies
          .filter((f) => f < f_isco)
          .map((f) => ({
            frequency_hz: f,
            strain: strainAmplitude(Mc, f, distance),
            strain_log10: Math.log10(strainAmplitude(Mc, f, distance)),
          }));

        result = {
          operation: 'strain',
          source,
          m1_solar: m1,
          m2_solar: m2,
          chirp_mass_solar: Mc,
          distance_Mpc: distance,
          strain_at_frequencies: strains,
          formula: 'h₀ = (4/d)(GM_c/c²)^(5/3)(πf/c)^(2/3)',
          typical_LIGO_sensitivity: '~10⁻²³ at 100 Hz',
          detectable: strains.some((s) => s.strain > 1e-23) ? 'Yes' : 'No',
          description: `Strain amplitude for ${Mc.toFixed(1)}M☉ chirp mass at ${distance} Mpc`,
        };
        break;
      }

      case 'waveform': {
        const waveform = generateWaveform(
          m1,
          m2,
          distance,
          f_start,
          f_end_actual,
          sample_rate,
          duration
        );

        // Sample for output
        const sampleInterval = Math.max(1, Math.floor(waveform.time.length / 100));
        const sampledData = {
          time: waveform.time.filter((_, i) => i % sampleInterval === 0),
          h_plus: waveform.h_plus.filter((_, i) => i % sampleInterval === 0),
          h_cross: waveform.h_cross.filter((_, i) => i % sampleInterval === 0),
          frequency: waveform.frequency.filter((_, i) => i % sampleInterval === 0),
        };

        result = {
          operation: 'waveform',
          source,
          m1_solar: m1,
          m2_solar: m2,
          distance_Mpc: distance,
          f_start_hz: f_start,
          f_end_hz: f_end_actual,
          f_isco_hz: f_isco,
          sample_rate_hz: sample_rate,
          total_samples: waveform.time.length,
          duration_seconds: waveform.time[waveform.time.length - 1],
          peak_strain: Math.max(...waveform.h_plus.map(Math.abs)),
          final_frequency: waveform.frequency[waveform.frequency.length - 1],
          waveform_sample: sampledData.time.slice(0, 20).map((t, i) => ({
            time_s: t,
            h_plus: sampledData.h_plus[i],
            h_cross: sampledData.h_cross[i],
            f_hz: sampledData.frequency[i],
          })),
          description: `Generated inspiral waveform: ${f_start} Hz → ${waveform.frequency[waveform.frequency.length - 1].toFixed(1)} Hz`,
        };
        break;
      }

      case 'frequency': {
        const tau_values = [100, 10, 1, 0.1, 0.01]; // seconds to merger
        const frequencies = tau_values.map((tau) => ({
          time_to_merger_s: tau,
          frequency_hz: frequencyAtTime(m1, m2, tau),
        }));

        const time_from_20hz = timeToMerger(m1, m2, 20);
        const time_from_40hz = timeToMerger(m1, m2, 40);

        result = {
          operation: 'frequency',
          source,
          m1_solar: m1,
          m2_solar: m2,
          chirp_mass_solar: chirpMass(m1, m2),
          f_isco_hz: f_isco,
          frequency_at_times_to_merger: frequencies,
          time_in_LIGO_band: {
            from_20hz_seconds: time_from_20hz,
            from_40hz_seconds: time_from_40hz,
          },
          formula: {
            frequency: 'f(τ) = (1/π)(256/5 × M_c^(5/3) / τ)^(3/8)',
            chirp: 'df/dt = (96/5)π^(8/3) M_c^(5/3) f^(11/3)',
          },
          description: `Frequency evolution: ${time_from_20hz.toFixed(2)}s from 20 Hz to ISCO at ${f_isco.toFixed(1)} Hz`,
        };
        break;
      }

      case 'merger_time': {
        const tau = timeToMerger(m1, m2, f_start);

        result = {
          operation: 'merger_time',
          source,
          m1_solar: m1,
          m2_solar: m2,
          chirp_mass_solar: chirpMass(m1, m2),
          starting_frequency_hz: f_start,
          time_to_merger_seconds: tau,
          time_to_merger_minutes: tau / 60,
          time_to_merger_hours: tau / 3600,
          f_isco_hz: f_isco,
          formula: 'τ = (5/256)(GM_c/c³)^(-5/3)(πf)^(-8/3)',
          description: `Time to merger from ${f_start} Hz: ${tau.toFixed(2)} seconds (${(tau / 60).toFixed(2)} minutes)`,
        };
        break;
      }

      case 'energy': {
        const energy = energyRadiated(m1, m2);
        const L_peak = peakLuminosity(m1, m2);
        const L_sun = 3.828e26; // Solar luminosity in Watts

        result = {
          operation: 'energy',
          source,
          m1_solar: m1,
          m2_solar: m2,
          total_mass_solar: M_total,
          energy_radiated: {
            joules: energy.joules,
            solar_masses: energy.solar_masses,
            fraction_of_total_mass: energy.fraction,
            solar_luminosities_equivalent: energy.joules / L_sun / 3.15e7, // per year
          },
          peak_luminosity: {
            watts: L_peak,
            solar_luminosities: L_peak / L_sun,
            description: 'Brief moment at merger, brighter than all stars in observable universe',
          },
          context: {
            entire_universe_luminosity: '~10^47 W from all stars',
            peak_GW_luminosity: `~${L_peak.toExponential(2)} W`,
          },
          description:
            `Radiated ${energy.solar_masses.toFixed(2)}M☉ (${(energy.fraction * 100).toFixed(1)}% of total mass). ` +
            `Peak luminosity: ${L_peak.toExponential(2)} W`,
        };
        break;
      }

      case 'detection': {
        const detectorNames = ['LIGO', 'Virgo', 'KAGRA', 'LISA', 'ET'];
        const detectability = detectorNames.map((det) => {
          const snr = calculateSNR(m1, m2, distance, det);
          const horizon = detectionHorizon(m1, m2, det);
          return {
            detector: det,
            snr: snr,
            detectable: snr >= 8,
            detection_horizon_Mpc: horizon,
          };
        });

        result = {
          operation: 'detection',
          source,
          m1_solar: m1,
          m2_solar: m2,
          distance_Mpc: distance,
          f_isco_hz: f_isco,
          detectability,
          best_detector: detectability.reduce((best, d) => (d.snr > best.snr ? d : best)),
          threshold: 'SNR ≥ 8 typically required for confident detection',
          famous_detections: [
            { event: 'GW150914', masses: '36+29 M☉', distance: '410 Mpc', snr: 24 },
            { event: 'GW170817', masses: 'NS-NS', distance: '40 Mpc', snr: 32.4 },
          ],
          description:
            `Detection analysis at ${distance} Mpc: ` +
            `${
              detectability
                .filter((d) => d.detectable)
                .map((d) => d.detector)
                .join(', ') || 'None'
            } can detect`,
        };
        break;
      }

      case 'info':
      default: {
        result = {
          operation: 'info',
          tool: 'gravitational_wave',
          description:
            'Gravitational wave physics tool - analyze ripples in spacetime from massive accelerating objects',
          sources: {
            binary_blackhole: 'Two black holes spiraling together (GW150914 type)',
            binary_neutron_star: 'Two neutron stars merging (GW170817 type)',
            neutron_star_blackhole: 'Neutron star + black hole system',
            pulsar: 'Continuous waves from rotating neutron stars',
          },
          key_physics: {
            chirp_mass: 'M_c = (m₁m₂)^(3/5)/(m₁+m₂)^(1/5) - determines frequency evolution',
            strain: 'h ~ 10⁻²¹ - fractional length change (1/1000 proton width)',
            frequency: 'Sweeps from ~10 Hz to kHz as objects spiral closer',
            ISCO: 'Innermost Stable Circular Orbit - merger begins',
          },
          detectors: {
            LIGO: 'Two 4km interferometers in USA',
            Virgo: '3km interferometer in Italy',
            KAGRA: '3km underground detector in Japan',
            LISA: 'Space-based, 2.5 million km arms (future)',
            ET: 'Einstein Telescope, underground (future)',
          },
          operations: {
            chirp_mass: 'Calculate chirp mass and mass ratios',
            strain: 'Compute gravitational wave amplitude',
            waveform: 'Generate inspiral waveform h(t)',
            frequency: 'Analyze frequency evolution',
            merger_time: 'Time until coalescence',
            energy: 'Energy radiated as gravitational waves',
            detection: 'SNR and detectability analysis',
          },
          famous_events: [
            'GW150914: First detection (Sep 14, 2015)',
            'GW170817: First neutron star merger with EM counterpart',
          ],
        };
      }
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    return {
      toolCallId: id,
      content: JSON.stringify(
        {
          error: errorMessage,
          tool: 'gravitational_wave',
          hint: 'Use operation="info" for documentation',
        },
        null,
        2
      ),
      isError: true,
    };
  }
}

export function isgravitationalwaveAvailable(): boolean {
  return true;
}
