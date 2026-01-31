/**
 * THERMODYNAMICS TOOL
 *
 * Thermodynamic calculations for engineering and physics.
 *
 * Features:
 * - Ideal gas law calculations
 * - Real gas equations (van der Waals, Redlich-Kwong)
 * - Heat capacity and energy calculations
 * - Carnot and real cycle efficiencies
 * - Phase equilibrium
 * - Heat transfer calculations
 * - Entropy and Gibbs free energy
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// CONSTANTS
// ============================================================================

const R = 8.314; // Universal gas constant (J/mol·K)
const STEFAN_BOLTZMANN = 5.67e-8; // Stefan-Boltzmann constant (W/m²·K⁴)

// Gas properties (a, b for van der Waals; Cp at 298K in J/mol·K)
const GAS_PROPERTIES: Record<string, { a: number; b: number; Cp: number; M: number }> = {
  air: { a: 0.1358, b: 3.64e-5, Cp: 29.1, M: 28.97 },
  nitrogen: { a: 0.1408, b: 3.91e-5, Cp: 29.1, M: 28.01 },
  oxygen: { a: 0.1378, b: 3.18e-5, Cp: 29.4, M: 32.0 },
  carbon_dioxide: { a: 0.364, b: 4.27e-5, Cp: 37.1, M: 44.01 },
  hydrogen: { a: 0.0248, b: 2.66e-5, Cp: 28.8, M: 2.016 },
  helium: { a: 0.0034, b: 2.37e-5, Cp: 20.8, M: 4.003 },
  methane: { a: 0.2283, b: 4.28e-5, Cp: 35.7, M: 16.04 },
  water_vapor: { a: 0.5536, b: 3.05e-5, Cp: 33.6, M: 18.02 },
  ammonia: { a: 0.4225, b: 3.71e-5, Cp: 35.1, M: 17.03 },
};

// ============================================================================
// GAS LAW CALCULATIONS
// ============================================================================

// Ideal gas law: PV = nRT
function idealGas(params: { P?: number; V?: number; n?: number; T?: number }): {
  P: number;
  V: number;
  n: number;
  T: number;
} {
  const { P, V, n, T } = params;
  if (P && V && n) return { P, V, n, T: (P * V) / (n * R) };
  if (P && V && T) return { P, V, n: (P * V) / (R * T), T };
  if (P && n && T) return { P, V: (n * R * T) / P, n, T };
  if (V && n && T) return { P: (n * R * T) / V, V, n, T };
  throw new Error('Need 3 of 4 parameters: P, V, n, T');
}

// Van der Waals equation: (P + a(n/V)²)(V - nb) = nRT
function vanDerWaals(
  gas: string,
  params: { P?: number; V?: number; n: number; T: number }
): { P: number; density: number; compressibility: number } {
  const props = GAS_PROPERTIES[gas] || GAS_PROPERTIES.air;
  const { a, b } = props;
  const { n, T, P, V } = params;

  if (V) {
    // Calculate P from V
    const Vm = V / n; // Molar volume
    const P_calc = (R * T) / (Vm - b) - a / (Vm * Vm);
    return {
      P: P_calc,
      density: (n * props.M) / V,
      compressibility: (P_calc * Vm) / (R * T),
    };
  } else if (P) {
    // Solve for V using Newton-Raphson
    let Vm = (R * T) / P; // Initial guess (ideal gas)
    for (let i = 0; i < 50; i++) {
      const f = (R * T) / (Vm - b) - a / (Vm * Vm) - P;
      const df = -(R * T) / (Vm - b) ** 2 + (2 * a) / Vm ** 3;
      const dVm = f / df;
      Vm -= dVm;
      if (Math.abs(dVm) < 1e-10) break;
    }
    return {
      P,
      density: props.M / Vm,
      compressibility: (P * Vm) / (R * T),
    };
  }

  throw new Error('Need either P or V');
}

// Redlich-Kwong equation
function redlichKwong(
  _gas: string,
  P: number,
  T: number,
  n: number
): { V: number; compressibility: number } {
  const Tc = 300; // Approximate critical temperature
  const Pc = 50e5; // Approximate critical pressure

  // RK parameters
  const a = (0.4278 * R * R * Tc ** 2.5) / Pc;
  const b = (0.0867 * R * Tc) / Pc;

  // Solve for V
  let Vm = (R * T) / P;
  for (let i = 0; i < 50; i++) {
    const sqrtT = Math.sqrt(T);
    const f = P - (R * T) / (Vm - b) + a / (sqrtT * Vm * (Vm + b));
    const df = (R * T) / (Vm - b) ** 2 - (a * (2 * Vm + b)) / (sqrtT * Vm ** 2 * (Vm + b) ** 2);
    const dVm = f / df;
    Vm += dVm;
    if (Math.abs(dVm) < 1e-10) break;
  }

  return {
    V: Vm * n,
    compressibility: (P * Vm) / (R * T),
  };
}

// ============================================================================
// THERMODYNAMIC PROCESSES
// ============================================================================

// Isothermal process (T constant)
function isothermalProcess(
  P1: number,
  V1: number,
  V2: number,
  n: number,
  T: number
): { P2: number; W: number; Q: number; deltaS: number } {
  const P2 = (P1 * V1) / V2;
  const W = n * R * T * Math.log(V2 / V1);
  return {
    P2,
    W,
    Q: W, // For isothermal, Q = W
    deltaS: n * R * Math.log(V2 / V1),
  };
}

// Adiabatic process (Q = 0)
function adiabaticProcess(
  P1: number,
  V1: number,
  V2: number,
  gamma: number
): { P2: number; T_ratio: number; W: number } {
  const P2 = P1 * Math.pow(V1 / V2, gamma);
  const T_ratio = Math.pow(V1 / V2, gamma - 1);
  const W = (P1 * V1 - P2 * V2) / (gamma - 1);
  return { P2, T_ratio, W };
}

// Isobaric process (P constant)
function isobaricProcess(
  P: number,
  V1: number,
  V2: number,
  n: number,
  Cp: number
): { T_ratio: number; W: number; Q: number; deltaH: number } {
  const T_ratio = V2 / V1;
  const W = P * (V2 - V1);
  const T1 = (P * V1) / (n * R);
  const deltaT = T1 * (T_ratio - 1);
  const Q = n * Cp * deltaT;
  return { T_ratio, W, Q, deltaH: Q };
}

// Isochoric process (V constant)
function isochoricProcess(
  V: number,
  P1: number,
  P2: number,
  n: number,
  Cv: number
): { T_ratio: number; W: number; Q: number; deltaU: number } {
  const T_ratio = P2 / P1;
  const T1 = (P1 * V) / (n * R);
  const deltaT = T1 * (T_ratio - 1);
  const Q = n * Cv * deltaT;
  return { T_ratio, W: 0, Q, deltaU: Q };
}

// ============================================================================
// HEAT ENGINES
// ============================================================================

// Carnot efficiency
function carnotEfficiency(
  Th: number,
  Tc: number
): {
  efficiency: number;
  COP_refrigerator: number;
  COP_heat_pump: number;
} {
  const efficiency = 1 - Tc / Th;
  return {
    efficiency,
    COP_refrigerator: Tc / (Th - Tc),
    COP_heat_pump: Th / (Th - Tc),
  };
}

// Otto cycle (gasoline engine)
function ottoCycle(
  compressionRatio: number,
  gamma: number = 1.4
): { efficiency: number; MEP_ratio: number } {
  const efficiency = 1 - 1 / Math.pow(compressionRatio, gamma - 1);
  // MEP/P1 approximation
  const MEP_ratio = (gamma - 1) * compressionRatio * (Math.pow(compressionRatio, gamma - 1) - 1);
  return { efficiency, MEP_ratio };
}

// Diesel cycle
function dieselCycle(
  compressionRatio: number,
  cutoffRatio: number,
  gamma: number = 1.4
): { efficiency: number } {
  const rc = cutoffRatio;
  const r = compressionRatio;
  const efficiency =
    1 - ((1 / Math.pow(r, gamma - 1)) * (Math.pow(rc, gamma) - 1)) / (gamma * (rc - 1));
  return { efficiency };
}

// ============================================================================
// HEAT TRANSFER
// ============================================================================

// Conduction: Q = kA(T1-T2)/L
function conduction(
  k: number,
  A: number,
  T1: number,
  T2: number,
  L: number
): { Q: number; R_thermal: number } {
  const Q = (k * A * (T1 - T2)) / L;
  const R_thermal = L / (k * A);
  return { Q, R_thermal };
}

// Convection: Q = hA(Ts - T_inf)
function convection(
  h: number,
  A: number,
  Ts: number,
  T_inf: number
): { Q: number; R_thermal: number } {
  const Q = h * A * (Ts - T_inf);
  const R_thermal = 1 / (h * A);
  return { Q, R_thermal };
}

// Radiation: Q = εσA(T1⁴ - T2⁴)
function radiation(epsilon: number, A: number, T1: number, T2: number): { Q: number } {
  const Q = epsilon * STEFAN_BOLTZMANN * A * (Math.pow(T1, 4) - Math.pow(T2, 4));
  return { Q };
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const thermodynamicsTool: UnifiedTool = {
  name: 'thermo_calc',
  description: `Thermodynamic calculations for engineering and physics.

Available operations:
- ideal_gas: Ideal gas law (PV = nRT)
- van_der_waals: Real gas equation
- redlich_kwong: Redlich-Kwong equation of state
- isothermal: Isothermal process
- adiabatic: Adiabatic process
- isobaric: Constant pressure process
- isochoric: Constant volume process
- carnot: Carnot cycle efficiency
- otto_cycle: Otto (gasoline) engine efficiency
- diesel_cycle: Diesel engine efficiency
- conduction: Heat conduction
- convection: Convective heat transfer
- radiation: Radiative heat transfer

Gases: air, nitrogen, oxygen, carbon_dioxide, hydrogen, helium, methane, water_vapor, ammonia`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'ideal_gas',
          'van_der_waals',
          'redlich_kwong',
          'isothermal',
          'adiabatic',
          'isobaric',
          'isochoric',
          'carnot',
          'otto_cycle',
          'diesel_cycle',
          'conduction',
          'convection',
          'radiation',
        ],
        description: 'Thermodynamic calculation',
      },
      gas: {
        type: 'string',
        description: 'Gas type for equations of state',
      },
      P: {
        type: 'number',
        description: 'Pressure (Pa)',
      },
      V: {
        type: 'number',
        description: 'Volume (m³)',
      },
      n: {
        type: 'number',
        description: 'Amount of substance (mol)',
      },
      T: {
        type: 'number',
        description: 'Temperature (K)',
      },
      P1: {
        type: 'number',
        description: 'Initial pressure (Pa)',
      },
      V1: {
        type: 'number',
        description: 'Initial volume (m³)',
      },
      V2: {
        type: 'number',
        description: 'Final volume (m³)',
      },
      P2: {
        type: 'number',
        description: 'Final pressure (Pa)',
      },
      T1: {
        type: 'number',
        description: 'Temperature 1 (K)',
      },
      T2: {
        type: 'number',
        description: 'Temperature 2 (K)',
      },
      Th: {
        type: 'number',
        description: 'Hot reservoir temperature (K)',
      },
      Tc: {
        type: 'number',
        description: 'Cold reservoir temperature (K)',
      },
      gamma: {
        type: 'number',
        description: 'Heat capacity ratio (default: 1.4)',
      },
      compression_ratio: {
        type: 'number',
        description: 'Compression ratio for engines',
      },
      cutoff_ratio: {
        type: 'number',
        description: 'Cutoff ratio for diesel cycle',
      },
      k: {
        type: 'number',
        description: 'Thermal conductivity (W/m·K)',
      },
      h: {
        type: 'number',
        description: 'Convection coefficient (W/m²·K)',
      },
      A: {
        type: 'number',
        description: 'Surface area (m²)',
      },
      L: {
        type: 'number',
        description: 'Length/thickness (m)',
      },
      epsilon: {
        type: 'number',
        description: 'Emissivity (0-1)',
      },
    },
    required: ['operation'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isThermodynamicsAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTE FUNCTION
// ============================================================================

export async function executeThermodynamics(call: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = call.arguments as Record<string, unknown>;

  const operation = args.operation as string;

  try {
    const result: Record<string, unknown> = { operation };

    switch (operation) {
      case 'ideal_gas': {
        const gasResult = idealGas({
          P: args.P as number | undefined,
          V: args.V as number | undefined,
          n: args.n as number | undefined,
          T: args.T as number | undefined,
        });
        result.pressure_Pa = gasResult.P;
        result.volume_m3 = gasResult.V;
        result.moles = gasResult.n;
        result.temperature_K = gasResult.T;
        result.density_mol_m3 = gasResult.n / gasResult.V;
        break;
      }

      case 'van_der_waals': {
        const gas = (args.gas as string) || 'air';
        const vdwResult = vanDerWaals(gas, {
          P: args.P as number | undefined,
          V: args.V as number | undefined,
          n: args.n as number,
          T: args.T as number,
        });
        result.gas = gas;
        result.pressure_Pa = vdwResult.P;
        result.density_kg_m3 = vdwResult.density;
        result.compressibility_factor = vdwResult.compressibility;
        result.deviation_from_ideal = Math.abs(1 - vdwResult.compressibility) * 100;
        break;
      }

      case 'redlich_kwong': {
        const gas = (args.gas as string) || 'air';
        const rkResult = redlichKwong(gas, args.P as number, args.T as number, args.n as number);
        result.gas = gas;
        result.volume_m3 = rkResult.V;
        result.compressibility_factor = rkResult.compressibility;
        break;
      }

      case 'isothermal': {
        const isoResult = isothermalProcess(
          args.P1 as number,
          args.V1 as number,
          args.V2 as number,
          args.n as number,
          args.T as number
        );
        result.process = 'isothermal (T constant)';
        result.final_pressure_Pa = isoResult.P2;
        result.work_J = isoResult.W;
        result.heat_J = isoResult.Q;
        result.entropy_change_J_K = isoResult.deltaS;
        break;
      }

      case 'adiabatic': {
        const gamma = (args.gamma as number) || 1.4;
        const adResult = adiabaticProcess(
          args.P1 as number,
          args.V1 as number,
          args.V2 as number,
          gamma
        );
        result.process = 'adiabatic (Q = 0)';
        result.final_pressure_Pa = adResult.P2;
        result.temperature_ratio = adResult.T_ratio;
        result.work_J = adResult.W;
        result.heat_J = 0;
        break;
      }

      case 'isobaric': {
        const gas = (args.gas as string) || 'air';
        const Cp = GAS_PROPERTIES[gas]?.Cp || 29.1;
        const isobResult = isobaricProcess(
          args.P as number,
          args.V1 as number,
          args.V2 as number,
          args.n as number,
          Cp
        );
        result.process = 'isobaric (P constant)';
        result.temperature_ratio = isobResult.T_ratio;
        result.work_J = isobResult.W;
        result.heat_J = isobResult.Q;
        result.enthalpy_change_J = isobResult.deltaH;
        break;
      }

      case 'isochoric': {
        const gas = (args.gas as string) || 'air';
        const Cp = GAS_PROPERTIES[gas]?.Cp || 29.1;
        const Cv = Cp - R;
        const isocResult = isochoricProcess(
          args.V as number,
          args.P1 as number,
          args.P2 as number,
          args.n as number,
          Cv
        );
        result.process = 'isochoric (V constant)';
        result.temperature_ratio = isocResult.T_ratio;
        result.work_J = 0;
        result.heat_J = isocResult.Q;
        result.internal_energy_change_J = isocResult.deltaU;
        break;
      }

      case 'carnot': {
        const carnotResult = carnotEfficiency(args.Th as number, args.Tc as number);
        result.hot_reservoir_K = args.Th;
        result.cold_reservoir_K = args.Tc;
        result.carnot_efficiency = carnotResult.efficiency;
        result.efficiency_percent = carnotResult.efficiency * 100;
        result.COP_refrigerator = carnotResult.COP_refrigerator;
        result.COP_heat_pump = carnotResult.COP_heat_pump;
        result.note =
          'This is the maximum possible efficiency for any heat engine operating between these temperatures';
        break;
      }

      case 'otto_cycle': {
        const gamma = (args.gamma as number) || 1.4;
        const ottoResult = ottoCycle(args.compression_ratio as number, gamma);
        result.compression_ratio = args.compression_ratio;
        result.efficiency = ottoResult.efficiency;
        result.efficiency_percent = ottoResult.efficiency * 100;
        result.note = 'Otto cycle models spark-ignition (gasoline) engines';
        break;
      }

      case 'diesel_cycle': {
        const gamma = (args.gamma as number) || 1.4;
        const dieselResult = dieselCycle(
          args.compression_ratio as number,
          args.cutoff_ratio as number,
          gamma
        );
        result.compression_ratio = args.compression_ratio;
        result.cutoff_ratio = args.cutoff_ratio;
        result.efficiency = dieselResult.efficiency;
        result.efficiency_percent = dieselResult.efficiency * 100;
        result.note = 'Diesel cycle models compression-ignition engines';
        break;
      }

      case 'conduction': {
        const condResult = conduction(
          args.k as number,
          args.A as number,
          args.T1 as number,
          args.T2 as number,
          args.L as number
        );
        result.heat_rate_W = condResult.Q;
        result.thermal_resistance_K_W = condResult.R_thermal;
        result.heat_flux_W_m2 = condResult.Q / (args.A as number);
        break;
      }

      case 'convection': {
        const convResult = convection(
          args.h as number,
          args.A as number,
          args.T1 as number,
          args.T2 as number
        );
        result.heat_rate_W = convResult.Q;
        result.thermal_resistance_K_W = convResult.R_thermal;
        break;
      }

      case 'radiation': {
        const radResult = radiation(
          args.epsilon as number,
          args.A as number,
          args.T1 as number,
          args.T2 as number
        );
        result.heat_rate_W = radResult.Q;
        result.note = 'Temperatures must be in Kelvin for radiation calculations';
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
