/**
 * ELECTROMAGNETICS TOOL
 *
 * Electromagnetic field calculations and analysis.
 * Essential for electrical engineering and physics.
 *
 * Features:
 * - Electric field calculations
 * - Magnetic field calculations
 * - Electromagnetic wave properties
 * - Transmission line analysis
 * - Antenna pattern calculations
 * - Maxwell's equations solutions
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// CONSTANTS
// ============================================================================

const c = 299792458; // Speed of light (m/s)
const mu0 = 4 * Math.PI * 1e-7; // Permeability of free space (H/m)
const epsilon0 = 8.854187817e-12; // Permittivity of free space (F/m)
const e = 1.602176634e-19; // Elementary charge (C)
const k = 8.9875517923e9; // Coulomb's constant (N·m²/C²)

// ============================================================================
// ELECTRIC FIELD CALCULATIONS
// ============================================================================

// Electric field from point charge
function pointChargeField(Q: number, r: number): { E: number; V: number } {
  const E = (k * Math.abs(Q)) / (r * r);
  const V = (k * Q) / r;
  return { E, V };
}

// Electric field from infinite line charge
function lineChargeField(lambda: number, r: number): { E: number } {
  const E = lambda / (2 * Math.PI * epsilon0 * r);
  return { E };
}

// Electric field from infinite sheet
function sheetChargeField(sigma: number): { E: number } {
  const E = Math.abs(sigma) / (2 * epsilon0);
  return { E };
}

// Capacitor calculations
function parallelPlateCapacitor(
  epsilon_r: number,
  A: number,
  d: number
): { C: number; E: number; energy: number } {
  const C = (epsilon_r * epsilon0 * A) / d;
  return {
    C,
    E: 0, // Depends on voltage
    energy: 0, // Depends on voltage
  };
}

// ============================================================================
// MAGNETIC FIELD CALCULATIONS
// ============================================================================

// Magnetic field from long straight wire (Biot-Savart)
function wireField(I: number, r: number): { B: number } {
  const B = (mu0 * I) / (2 * Math.PI * r);
  return { B };
}

// Magnetic field at center of circular loop
function loopField(I: number, R: number): { B: number } {
  const B = (mu0 * I) / (2 * R);
  return { B };
}

// Magnetic field inside solenoid
function solenoidField(I: number, n: number): { B: number } {
  // n = turns per unit length
  const B = mu0 * n * I;
  return { B };
}

// Magnetic field inside toroid
function toroidField(I: number, N: number, r: number): { B: number } {
  // N = total turns, r = radius from center
  const B = (mu0 * N * I) / (2 * Math.PI * r);
  return { B };
}

// Force on moving charge in magnetic field
function lorentzForce(
  q: number,
  v: number,
  B: number,
  theta: number
): { F: number; radius: number; period: number } {
  const F = Math.abs(q) * v * B * Math.sin((theta * Math.PI) / 180);
  // Radius of circular motion
  const m = 9.109e-31; // electron mass (approximate)
  const radius = (m * v) / (Math.abs(q) * B);
  const period = (2 * Math.PI * m) / (Math.abs(q) * B);
  return { F, radius, period };
}

// ============================================================================
// ELECTROMAGNETIC WAVES
// ============================================================================

// Wave properties
function waveProperties(
  frequency: number,
  medium_epsilon_r: number = 1,
  medium_mu_r: number = 1
): {
  wavelength: number;
  velocity: number;
  wavenumber: number;
  angular_frequency: number;
  impedance: number;
} {
  const velocity = c / Math.sqrt(medium_epsilon_r * medium_mu_r);
  const wavelength = velocity / frequency;
  const wavenumber = (2 * Math.PI) / wavelength;
  const angular_frequency = 2 * Math.PI * frequency;
  const impedance = Math.sqrt((mu0 * medium_mu_r) / (epsilon0 * medium_epsilon_r));

  return { wavelength, velocity, wavenumber, angular_frequency, impedance };
}

// Skin depth
function skinDepth(frequency: number, sigma: number, mu_r: number = 1): { delta: number } {
  const delta = 1 / Math.sqrt(Math.PI * frequency * mu0 * mu_r * sigma);
  return { delta };
}

// ============================================================================
// TRANSMISSION LINES
// ============================================================================

// Characteristic impedance
function transmissionLineZ0(L: number, C: number): { Z0: number; v_phase: number } {
  const Z0 = Math.sqrt(L / C);
  const v_phase = 1 / Math.sqrt(L * C);
  return { Z0, v_phase };
}

// Reflection coefficient
function reflectionCoefficient(
  ZL: number,
  Z0: number
): {
  gamma: { magnitude: number; phase: number };
  VSWR: number;
  return_loss_dB: number;
} {
  const gamma_real = (ZL - Z0) / (ZL + Z0);
  const magnitude = Math.abs(gamma_real);
  const phase = gamma_real >= 0 ? 0 : 180;
  const VSWR = (1 + magnitude) / (1 - magnitude);
  const return_loss_dB = -20 * Math.log10(magnitude);

  return {
    gamma: { magnitude, phase },
    VSWR,
    return_loss_dB,
  };
}

// Quarter-wave transformer
function quarterWaveTransformer(
  Z0: number,
  ZL: number
): { Z_transformer: number; length_wavelengths: number } {
  const Z_transformer = Math.sqrt(Z0 * ZL);
  return { Z_transformer, length_wavelengths: 0.25 };
}

// ============================================================================
// ANTENNA CALCULATIONS
// ============================================================================

// Dipole antenna radiation pattern
function dipolePattern(theta: number, length_wavelengths: number): { gain_pattern: number } {
  const theta_rad = (theta * Math.PI) / 180;
  const kL = 2 * Math.PI * length_wavelengths;

  // For half-wave dipole approximation
  if (Math.abs(theta_rad - Math.PI / 2) < 0.01) {
    return { gain_pattern: 1 }; // Maximum at broadside
  }

  const numerator = Math.cos((kL * Math.cos(theta_rad)) / 2) - Math.cos(kL / 2);
  const denominator = Math.sin(theta_rad);

  if (Math.abs(denominator) < 1e-10) return { gain_pattern: 0 };

  const pattern = Math.pow(numerator / denominator, 2);
  return { gain_pattern: pattern };
}

// Friis transmission equation
function friisEquation(
  Pt: number,
  Gt: number,
  Gr: number,
  wavelength: number,
  distance: number
): { Pr: number; path_loss_dB: number; Pr_dBm: number } {
  const Pr = Pt * Gt * Gr * Math.pow(wavelength / (4 * Math.PI * distance), 2);
  const path_loss_dB = 20 * Math.log10((4 * Math.PI * distance) / wavelength);
  const Pr_dBm = 10 * Math.log10(Pr * 1000);

  return { Pr, path_loss_dB, Pr_dBm };
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const emFieldsTool: UnifiedTool = {
  name: 'em_fields',
  description: `Electromagnetic field calculations for electrical engineering and physics.

Available operations:
- point_charge: Electric field from point charge
- line_charge: Electric field from infinite line charge
- sheet_charge: Electric field from infinite charged sheet
- capacitor: Parallel plate capacitor calculations
- wire_field: Magnetic field from straight wire
- loop_field: Magnetic field from current loop
- solenoid: Magnetic field in solenoid
- toroid: Magnetic field in toroid
- lorentz: Force on moving charge
- wave: EM wave properties
- skin_depth: Penetration depth in conductor
- transmission_line: Transmission line analysis
- reflection: Reflection coefficient and VSWR
- quarter_wave: Quarter-wave transformer design
- antenna_pattern: Dipole antenna radiation pattern
- friis: Friis transmission equation`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'point_charge',
          'line_charge',
          'sheet_charge',
          'capacitor',
          'wire_field',
          'loop_field',
          'solenoid',
          'toroid',
          'lorentz',
          'wave',
          'skin_depth',
          'transmission_line',
          'reflection',
          'quarter_wave',
          'antenna_pattern',
          'friis',
        ],
        description: 'EM calculation',
      },
      Q: { type: 'number', description: 'Charge (C)' },
      r: { type: 'number', description: 'Distance/radius (m)' },
      lambda: { type: 'number', description: 'Linear charge density (C/m)' },
      sigma: { type: 'number', description: 'Surface charge density (C/m²) or conductivity (S/m)' },
      I: { type: 'number', description: 'Current (A)' },
      n: { type: 'number', description: 'Turns per unit length (1/m)' },
      N: { type: 'number', description: 'Total turns' },
      R: { type: 'number', description: 'Radius (m)' },
      v: { type: 'number', description: 'Velocity (m/s)' },
      B: { type: 'number', description: 'Magnetic field (T)' },
      theta: { type: 'number', description: 'Angle (degrees)' },
      frequency: { type: 'number', description: 'Frequency (Hz)' },
      epsilon_r: { type: 'number', description: 'Relative permittivity' },
      mu_r: { type: 'number', description: 'Relative permeability' },
      L: { type: 'number', description: 'Inductance (H) or length' },
      C: { type: 'number', description: 'Capacitance (F)' },
      Z0: { type: 'number', description: 'Characteristic impedance (Ω)' },
      ZL: { type: 'number', description: 'Load impedance (Ω)' },
      A: { type: 'number', description: 'Area (m²)' },
      d: { type: 'number', description: 'Distance/separation (m)' },
      Pt: { type: 'number', description: 'Transmitted power (W)' },
      Gt: { type: 'number', description: 'Transmitter gain (linear)' },
      Gr: { type: 'number', description: 'Receiver gain (linear)' },
      wavelength: { type: 'number', description: 'Wavelength (m)' },
      length_wavelengths: { type: 'number', description: 'Antenna length in wavelengths' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isEMFieldsAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTE FUNCTION
// ============================================================================

export async function executeEMFields(call: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = call.arguments as Record<string, unknown>;
  const operation = args.operation as string;

  try {
    const result: Record<string, unknown> = { operation };

    switch (operation) {
      case 'point_charge': {
        const fieldResult = pointChargeField(args.Q as number, args.r as number);
        result.electric_field_V_m = fieldResult.E;
        result.potential_V = fieldResult.V;
        result.force_on_electron_N = fieldResult.E * e;
        break;
      }

      case 'line_charge': {
        const fieldResult = lineChargeField(args.lambda as number, args.r as number);
        result.electric_field_V_m = fieldResult.E;
        break;
      }

      case 'sheet_charge': {
        const fieldResult = sheetChargeField(args.sigma as number);
        result.electric_field_V_m = fieldResult.E;
        result.note = 'Field is uniform and perpendicular to sheet';
        break;
      }

      case 'capacitor': {
        const capResult = parallelPlateCapacitor(
          (args.epsilon_r as number) || 1,
          args.A as number,
          args.d as number
        );
        result.capacitance_F = capResult.C;
        result.capacitance_pF = capResult.C * 1e12;
        break;
      }

      case 'wire_field': {
        const fieldResult = wireField(args.I as number, args.r as number);
        result.magnetic_field_T = fieldResult.B;
        result.magnetic_field_gauss = fieldResult.B * 1e4;
        break;
      }

      case 'loop_field': {
        const fieldResult = loopField(args.I as number, args.R as number);
        result.magnetic_field_T = fieldResult.B;
        result.magnetic_field_gauss = fieldResult.B * 1e4;
        break;
      }

      case 'solenoid': {
        const fieldResult = solenoidField(args.I as number, args.n as number);
        result.magnetic_field_T = fieldResult.B;
        result.magnetic_field_gauss = fieldResult.B * 1e4;
        break;
      }

      case 'toroid': {
        const fieldResult = toroidField(args.I as number, args.N as number, args.r as number);
        result.magnetic_field_T = fieldResult.B;
        break;
      }

      case 'lorentz': {
        const forceResult = lorentzForce(
          (args.Q as number) || e,
          args.v as number,
          args.B as number,
          args.theta as number
        );
        result.force_N = forceResult.F;
        result.cyclotron_radius_m = forceResult.radius;
        result.cyclotron_period_s = forceResult.period;
        break;
      }

      case 'wave': {
        const waveResult = waveProperties(
          args.frequency as number,
          (args.epsilon_r as number) || 1,
          (args.mu_r as number) || 1
        );
        result.wavelength_m = waveResult.wavelength;
        result.phase_velocity_m_s = waveResult.velocity;
        result.wavenumber_rad_m = waveResult.wavenumber;
        result.angular_frequency_rad_s = waveResult.angular_frequency;
        result.intrinsic_impedance_ohms = waveResult.impedance;
        break;
      }

      case 'skin_depth': {
        const skinResult = skinDepth(
          args.frequency as number,
          args.sigma as number,
          (args.mu_r as number) || 1
        );
        result.skin_depth_m = skinResult.delta;
        result.skin_depth_mm = skinResult.delta * 1000;
        break;
      }

      case 'transmission_line': {
        const tlResult = transmissionLineZ0(args.L as number, args.C as number);
        result.characteristic_impedance_ohms = tlResult.Z0;
        result.phase_velocity_m_s = tlResult.v_phase;
        break;
      }

      case 'reflection': {
        const refResult = reflectionCoefficient(args.ZL as number, args.Z0 as number);
        result.reflection_coefficient = refResult.gamma;
        result.VSWR = refResult.VSWR;
        result.return_loss_dB = refResult.return_loss_dB;
        result.matched = refResult.gamma.magnitude < 0.1;
        break;
      }

      case 'quarter_wave': {
        const qwResult = quarterWaveTransformer(args.Z0 as number, args.ZL as number);
        result.transformer_impedance_ohms = qwResult.Z_transformer;
        result.length_wavelengths = qwResult.length_wavelengths;
        break;
      }

      case 'antenna_pattern': {
        const patternResult = dipolePattern(
          args.theta as number,
          (args.length_wavelengths as number) || 0.5
        );
        result.gain_pattern_linear = patternResult.gain_pattern;
        result.gain_pattern_dB = 10 * Math.log10(patternResult.gain_pattern + 1e-10);
        break;
      }

      case 'friis': {
        const friisResult = friisEquation(
          args.Pt as number,
          args.Gt as number,
          args.Gr as number,
          args.wavelength as number,
          args.d as number
        );
        result.received_power_W = friisResult.Pr;
        result.received_power_dBm = friisResult.Pr_dBm;
        result.path_loss_dB = friisResult.path_loss_dB;
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
