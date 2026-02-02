/**
 * POWER SYSTEMS TOOL
 *
 * Electrical power engineering: AC circuits, transformers,
 * power factor, transmission lines, and load analysis.
 *
 * Part of TIER ELECTRICAL - Ultimate Tool Arsenal
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// AC CIRCUIT FUNDAMENTALS
// ============================================================================

function impedance(R: number, X: number): { magnitude: number; phase: number } {
  const mag = Math.sqrt(R * R + X * X);
  const phase = Math.atan2(X, R) * 180 / Math.PI;
  return { magnitude: mag, phase };
}

function reactance(type: 'L' | 'C', value: number, frequency: number): number {
  const omega = 2 * Math.PI * frequency;
  if (type === 'L') return omega * value;          // XL = ωL
  return -1 / (omega * value);                      // XC = -1/(ωC)
}

function resonantFrequency(L: number, C: number): number {
  // f0 = 1 / (2π√LC)
  return 1 / (2 * Math.PI * Math.sqrt(L * C));
}

// ============================================================================
// POWER CALCULATIONS
// ============================================================================

function acPower(V: number, I: number, pf: number): { P: number; Q: number; S: number } {
  const S = V * I;                  // Apparent power (VA)
  const P = S * pf;                 // Real power (W)
  const Q = S * Math.sqrt(1 - pf * pf); // Reactive power (VAR)
  return { P, Q, S };
}

export function powerFactor(P: number, S: number): number {
  return P / S;
}

function powerFactorAngle(pf: number): number {
  return Math.acos(pf) * 180 / Math.PI;
}

function capacitorForPFCorrection(P: number, pf1: number, pf2: number, V: number, f: number): number {
  // Capacitor needed to improve power factor from pf1 to pf2
  const theta1 = Math.acos(pf1);
  const theta2 = Math.acos(pf2);
  const Q1 = P * Math.tan(theta1);
  const Q2 = P * Math.tan(theta2);
  const Qc = Q1 - Q2;
  return Qc / (2 * Math.PI * f * V * V);
}

// ============================================================================
// THREE-PHASE SYSTEMS
// ============================================================================

function threePhaseLineToPhase(Vline: number): number {
  return Vline / Math.sqrt(3);
}

export function threePhasePhaseToLine(Vphase: number): number {
  return Vphase * Math.sqrt(3);
}

function threePhasePoweRY(Vline: number, I: number, pf: number): { P: number; Q: number; S: number } {
  const S = Math.sqrt(3) * Vline * I;
  const P = S * pf;
  const Q = S * Math.sqrt(1 - pf * pf);
  return { P, Q, S };
}

// ============================================================================
// TRANSFORMERS
// ============================================================================

function turnsRatio(Np: number, Ns: number): number {
  return Np / Ns;
}

function transformerVoltage(Vp: number, ratio: number): number {
  return Vp / ratio;
}

function transformerCurrent(Ip: number, ratio: number): number {
  return Ip * ratio;
}

export function transformerEfficiency(Pout: number, Pcore: number, Pcopper: number): number {
  const Pin = Pout + Pcore + Pcopper;
  return Pout / Pin;
}

export function transformerRegulation(Vnl: number, Vfl: number): number {
  // Voltage regulation
  return (Vnl - Vfl) / Vfl * 100;
}

// ============================================================================
// TRANSMISSION LINES
// ============================================================================

function lineLoss(I: number, R: number, length: number): number {
  // P_loss = I² × R × length
  return I * I * R * length;
}

function voltageDropLine(I: number, R: number, X: number, pf: number, length: number): number {
  const sinPhi = Math.sqrt(1 - pf * pf);
  return I * length * (R * pf + X * sinPhi);
}

function transmissionEfficiency(Pdelivered: number, Ploss: number): number {
  return Pdelivered / (Pdelivered + Ploss) * 100;
}

// ============================================================================
// PER-UNIT SYSTEM
// ============================================================================

function perUnitValue(actual: number, base: number): number {
  return actual / base;
}

function baseImpedance(Vbase: number, Sbase: number): number {
  return (Vbase * Vbase) / Sbase;
}

function baseCurrent(Sbase: number, Vbase: number): number {
  return Sbase / (Math.sqrt(3) * Vbase);
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const powerSystemsTool: UnifiedTool = {
  name: 'power_systems',
  description: `Electrical power systems calculations.

Operations:
- ac_circuit: AC impedance and resonance
- power: Real, reactive, and apparent power
- three_phase: Three-phase system calculations
- transformer: Transformer analysis
- transmission: Transmission line calculations
- per_unit: Per-unit system conversions`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['ac_circuit', 'power', 'three_phase', 'transformer', 'transmission', 'per_unit'],
        description: 'Power systems operation',
      },
      voltage: { type: 'number', description: 'Voltage (V)' },
      current: { type: 'number', description: 'Current (A)' },
      resistance: { type: 'number', description: 'Resistance (Ω)' },
      reactance: { type: 'number', description: 'Reactance (Ω)' },
      frequency: { type: 'number', description: 'Frequency (Hz)' },
      power_factor: { type: 'number', description: 'Power factor (0-1)' },
      real_power: { type: 'number', description: 'Real power (W)' },
      L: { type: 'number', description: 'Inductance (H)' },
      C: { type: 'number', description: 'Capacitance (F)' },
      turns_primary: { type: 'number', description: 'Primary turns' },
      turns_secondary: { type: 'number', description: 'Secondary turns' },
      line_length: { type: 'number', description: 'Line length (km)' },
      Sbase: { type: 'number', description: 'Base power (VA)' },
      Vbase: { type: 'number', description: 'Base voltage (V)' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executePowerSystems(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'ac_circuit': {
        const { resistance = 10, L, C, frequency = 60 } = args;
        let X = 0;
        let XL = 0, XC = 0;

        if (L !== undefined) {
          XL = reactance('L', L, frequency);
          X += XL;
        }
        if (C !== undefined) {
          XC = reactance('C', C, frequency);
          X += XC;
        }

        const Z = impedance(resistance, X);

        const circuitResult: Record<string, unknown> = {
          operation: 'ac_circuit',
          frequency_Hz: frequency,
          resistance_ohm: resistance,
          total_reactance_ohm: Math.round(X * 1000) / 1000,
          impedance: {
            magnitude_ohm: Math.round(Z.magnitude * 1000) / 1000,
            phase_degrees: Math.round(Z.phase * 100) / 100,
          },
          circuit_type: X > 0 ? 'Inductive' : X < 0 ? 'Capacitive' : 'Resistive',
        };

        if (L !== undefined) circuitResult.inductive_reactance_ohm = Math.round(XL * 1000) / 1000;
        if (C !== undefined) circuitResult.capacitive_reactance_ohm = Math.round(XC * 1000) / 1000;

        if (L !== undefined && C !== undefined) {
          const f0 = resonantFrequency(L, C);
          circuitResult.resonant_frequency_Hz = Math.round(f0 * 100) / 100;
        }

        result = circuitResult;
        break;
      }

      case 'power': {
        const { voltage = 230, current = 10, power_factor = 0.85, real_power, frequency = 60 } = args;
        const pf = power_factor;

        if (real_power !== undefined && voltage !== undefined) {
          // Calculate capacitor for PF correction
          const cap = capacitorForPFCorrection(real_power, pf, 0.95, voltage, frequency);

          result = {
            operation: 'power',
            mode: 'pf_correction',
            real_power_W: real_power,
            current_pf: pf,
            target_pf: 0.95,
            capacitor_needed_F: cap.toExponential(4),
            capacitor_needed_uF: Math.round(cap * 1e6 * 100) / 100,
          };
        } else {
          const power = acPower(voltage, current, pf);
          const angle = powerFactorAngle(pf);

          result = {
            operation: 'power',
            mode: 'power_triangle',
            voltage_V: voltage,
            current_A: current,
            power_factor: pf,
            power_factor_angle_deg: Math.round(angle * 100) / 100,
            apparent_power_VA: Math.round(power.S * 100) / 100,
            real_power_W: Math.round(power.P * 100) / 100,
            reactive_power_VAR: Math.round(power.Q * 100) / 100,
            lagging_leading: pf < 1 ? 'Lagging (inductive)' : 'Unity',
          };
        }
        break;
      }

      case 'three_phase': {
        const { voltage = 400, current = 50, power_factor = 0.9 } = args;
        const Vphase = threePhaseLineToPhase(voltage);
        const power = threePhasePoweRY(voltage, current, power_factor);

        result = {
          operation: 'three_phase',
          system: 'Y-connected',
          line_voltage_V: voltage,
          phase_voltage_V: Math.round(Vphase * 100) / 100,
          line_current_A: current,
          power_factor: power_factor,
          total_apparent_power_kVA: Math.round(power.S / 1000 * 100) / 100,
          total_real_power_kW: Math.round(power.P / 1000 * 100) / 100,
          total_reactive_power_kVAR: Math.round(power.Q / 1000 * 100) / 100,
          per_phase_power_kW: Math.round(power.P / 3000 * 100) / 100,
        };
        break;
      }

      case 'transformer': {
        const { voltage = 11000, turns_primary = 1000, turns_secondary = 100, current } = args;
        const ratio = turnsRatio(turns_primary, turns_secondary);
        const Vs = transformerVoltage(voltage, ratio);

        const transResult: Record<string, unknown> = {
          operation: 'transformer',
          primary_voltage_V: voltage,
          secondary_voltage_V: Math.round(Vs * 100) / 100,
          turns_ratio: ratio,
          primary_turns: turns_primary,
          secondary_turns: turns_secondary,
          step: ratio > 1 ? 'Step-down' : 'Step-up',
        };

        if (current !== undefined) {
          const Is = transformerCurrent(current, ratio);
          transResult.primary_current_A = current;
          transResult.secondary_current_A = Math.round(Is * 100) / 100;
          transResult.VA_rating = Math.round(voltage * current);
        }

        result = transResult;
        break;
      }

      case 'transmission': {
        const { voltage = 110000, current = 100, resistance = 0.1, reactance = 0.4, power_factor = 0.9, line_length = 50 } = args;
        const loss = lineLoss(current, resistance, line_length);
        const Vdrop = voltageDropLine(current, resistance, reactance, power_factor, line_length);
        const Pdelivered = voltage * current * power_factor;
        const eff = transmissionEfficiency(Pdelivered, loss);

        result = {
          operation: 'transmission',
          line_voltage_V: voltage,
          line_current_A: current,
          line_length_km: line_length,
          resistance_per_km_ohm: resistance,
          reactance_per_km_ohm: reactance,
          power_factor: power_factor,
          line_loss_W: Math.round(loss),
          line_loss_kW: Math.round(loss / 1000 * 100) / 100,
          voltage_drop_V: Math.round(Vdrop * 100) / 100,
          voltage_drop_percent: Math.round(Vdrop / voltage * 10000) / 100,
          transmission_efficiency_percent: Math.round(eff * 100) / 100,
        };
        break;
      }

      case 'per_unit': {
        const { Sbase = 100e6, Vbase = 110000, voltage, current: curr, resistance: res } = args;
        const Zbase = baseImpedance(Vbase, Sbase);
        const Ibase = baseCurrent(Sbase, Vbase);

        const puResult: Record<string, unknown> = {
          operation: 'per_unit',
          base_values: {
            Sbase_MVA: Sbase / 1e6,
            Vbase_kV: Vbase / 1000,
            Zbase_ohm: Math.round(Zbase * 1000) / 1000,
            Ibase_A: Math.round(Ibase * 100) / 100,
          },
        };

        if (voltage !== undefined) {
          puResult.voltage_actual_kV = voltage / 1000;
          puResult.voltage_pu = Math.round(perUnitValue(voltage, Vbase) * 10000) / 10000;
        }
        if (curr !== undefined) {
          puResult.current_actual_A = curr;
          puResult.current_pu = Math.round(perUnitValue(curr, Ibase) * 10000) / 10000;
        }
        if (res !== undefined) {
          puResult.impedance_actual_ohm = res;
          puResult.impedance_pu = Math.round(perUnitValue(res, Zbase) * 10000) / 10000;
        }

        result = puResult;
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (error) {
    return { toolCallId: id, content: `Power Systems Error: ${error instanceof Error ? error.message : 'Unknown'}`, isError: true };
  }
}

export function isPowerSystemsAvailable(): boolean { return true; }

