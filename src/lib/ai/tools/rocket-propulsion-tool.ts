// ============================================================================
// ROCKET PROPULSION TOOL - TIER INFINITY
// ============================================================================
// Rocket science calculations: Tsiolkovsky equation, staging optimization,
// thrust curves, specific impulse, delta-v budgets, and mission planning.
// Pure TypeScript implementation - no external dependencies.
// ============================================================================

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// CONSTANTS
// ============================================================================

const G0 = 9.80665; // Standard gravity (m/s²)

// Common propellant combinations with approximate Isp values (seconds)
const PROPELLANTS: Record<
  string,
  { isp_vac: number; isp_sl: number; density: number; name: string }
> = {
  lox_rp1: { isp_vac: 311, isp_sl: 282, density: 1020, name: 'LOX/RP-1 (Kerosene)' },
  lox_lh2: { isp_vac: 451, isp_sl: 381, density: 360, name: 'LOX/LH2 (Hydrogen)' },
  lox_methane: { isp_vac: 363, isp_sl: 330, density: 830, name: 'LOX/Methane' },
  n2o4_udmh: { isp_vac: 311, isp_sl: 285, density: 1180, name: 'N2O4/UDMH (Hypergolic)' },
  solid_apcp: { isp_vac: 268, isp_sl: 242, density: 1750, name: 'APCP Solid' },
  hydrazine: { isp_vac: 230, isp_sl: 220, density: 1010, name: 'Hydrazine Mono' },
  ion_xenon: { isp_vac: 3000, isp_sl: 0, density: 1600, name: 'Xenon Ion' },
  nuclear_thermal: { isp_vac: 900, isp_sl: 0, density: 70, name: 'Nuclear Thermal H2' },
};

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

function tsiolkovsky(isp: number, m0: number, mf: number): number {
  if (mf <= 0 || m0 <= mf) return 0;
  return isp * G0 * Math.log(m0 / mf);
}

function massRatioFromDeltaV(deltaV: number, isp: number): number {
  return Math.exp(deltaV / (isp * G0));
}

function massFlowRate(thrustN: number, isp: number): number {
  return thrustN / (isp * G0);
}

function burnTime(propellantMass: number, massFlow: number): number {
  return propellantMass / massFlow;
}

function thrustToWeight(thrustN: number, massKg: number): number {
  return thrustN / (massKg * G0);
}

// ============================================================================
// STAGING CALCULATIONS
// ============================================================================

interface StageParams {
  propellant_mass: number;
  structural_mass: number;
  payload_mass: number;
  isp: number;
  thrust: number;
}

function calculateStage(stage: StageParams): {
  m0: number;
  mf: number;
  delta_v: number;
  mass_ratio: number;
  burn_time: number;
  twr: number;
} {
  const m0 = stage.propellant_mass + stage.structural_mass + stage.payload_mass;
  const mf = stage.structural_mass + stage.payload_mass;
  const delta_v = tsiolkovsky(stage.isp, m0, mf);
  const mass_ratio = m0 / mf;
  const mdot = massFlowRate(stage.thrust, stage.isp);
  const burn = burnTime(stage.propellant_mass, mdot);
  const twr = thrustToWeight(stage.thrust, m0);

  return { m0, mf, delta_v, mass_ratio, burn_time: burn, twr };
}

function optimizeStaging(
  payload: number,
  totalDeltaV: number,
  numStages: number,
  isp: number[],
  structuralFraction: number[]
): { stages: StageParams[]; total_delta_v: number } {
  const stages: StageParams[] = [];
  let currentPayload = payload;
  const deltaVPerStage = totalDeltaV / numStages;

  for (let i = numStages - 1; i >= 0; i--) {
    const stageIsp = isp[i] || isp[0];
    const sf = structuralFraction[i] || structuralFraction[0];
    const mr = massRatioFromDeltaV(deltaVPerStage, stageIsp);
    const mf = (currentPayload * (1 - sf)) / (1 - sf * mr);
    const m0 = mf * mr;
    const structural = mf - currentPayload;
    const propellant = m0 - mf;

    stages.unshift({
      propellant_mass: propellant,
      structural_mass: structural,
      payload_mass: currentPayload,
      isp: stageIsp,
      thrust: m0 * G0 * 1.3,
    });

    currentPayload = m0;
  }

  let totalDV = 0;
  let pl = payload;
  for (const stage of [...stages].reverse()) {
    const result = calculateStage({ ...stage, payload_mass: pl });
    totalDV += result.delta_v;
    pl = stage.propellant_mass + stage.structural_mass + pl;
  }

  return { stages, total_delta_v: totalDV };
}

// ============================================================================
// MISSION DELTA-V REQUIREMENTS
// ============================================================================

const MISSION_DELTA_V: Record<string, { delta_v: number; description: string }> = {
  leo: { delta_v: 9400, description: 'Low Earth Orbit (400km)' },
  geo: { delta_v: 13500, description: 'Geostationary Orbit' },
  lunar_orbit: { delta_v: 12500, description: 'Lunar Orbit Insertion' },
  lunar_surface: { delta_v: 15500, description: 'Lunar Surface Landing' },
  mars_orbit: { delta_v: 15000, description: 'Mars Orbit Insertion' },
  mars_surface: { delta_v: 18000, description: 'Mars Surface Landing' },
  venus_orbit: { delta_v: 14000, description: 'Venus Orbit Insertion' },
  jupiter_orbit: { delta_v: 25000, description: 'Jupiter Orbit (gravity assist)' },
  escape: { delta_v: 11200, description: 'Earth Escape Velocity' },
};

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const rocketPropulsionTool: UnifiedTool = {
  name: 'rocket_propulsion',
  description: `Rocket propulsion and staging calculations.

Operations:
- tsiolkovsky: Calculate delta-v from mass ratio and Isp
- mass_ratio: Calculate required mass ratio for delta-v
- staging: Multi-stage rocket optimization
- thrust: Calculate thrust from mass flow and Isp
- burn_time: Calculate engine burn duration
- mission: Get delta-v requirements for common missions
- propellants: List available propellant combinations
- single_stage: Analyze a single stage performance`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'tsiolkovsky',
          'mass_ratio',
          'staging',
          'thrust',
          'burn_time',
          'mission',
          'propellants',
          'single_stage',
        ],
        description: 'Calculation to perform',
      },
      isp: { type: 'number', description: 'Specific impulse in seconds' },
      m0: { type: 'number', description: 'Initial mass (wet) in kg' },
      mf: { type: 'number', description: 'Final mass (dry) in kg' },
      delta_v: { type: 'number', description: 'Delta-v in m/s' },
      thrust_n: { type: 'number', description: 'Thrust in Newtons' },
      propellant_mass: { type: 'number', description: 'Propellant mass in kg' },
      payload_mass: { type: 'number', description: 'Payload mass in kg' },
      structural_mass: { type: 'number', description: 'Structural mass in kg' },
      num_stages: { type: 'number', description: 'Number of stages' },
      propellant_type: { type: 'string', description: 'Propellant type key' },
      structural_fraction: { type: 'number', description: 'Structural mass fraction (0-1)' },
      mission_name: { type: 'string', description: 'Mission name for delta-v lookup' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeRocketPropulsion(
  toolCall: UnifiedToolCall
): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation as string;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'tsiolkovsky': {
        const { isp, m0, mf } = args;
        if (!isp || !m0 || !mf) {
          throw new Error('tsiolkovsky requires isp, m0, and mf');
        }
        const dv = tsiolkovsky(isp, m0, mf);
        const mr = m0 / mf;
        const propMass = m0 - mf;

        result = {
          operation: 'tsiolkovsky',
          inputs: { isp, m0, mf },
          results: {
            delta_v_m_s: dv,
            delta_v_km_s: dv / 1000,
            mass_ratio: mr,
            propellant_mass_kg: propMass,
            exhaust_velocity_m_s: isp * G0,
          },
          formula: 'Δv = Isp × g₀ × ln(m₀/mf)',
        };
        break;
      }

      case 'mass_ratio': {
        const { delta_v, isp } = args;
        if (!delta_v || !isp) {
          throw new Error('mass_ratio requires delta_v and isp');
        }
        const mr = massRatioFromDeltaV(delta_v, isp);

        result = {
          operation: 'mass_ratio',
          inputs: { delta_v, isp },
          results: {
            mass_ratio: mr,
            propellant_fraction: 1 - 1 / mr,
            exhaust_velocity_m_s: isp * G0,
          },
          interpretation: `For ${delta_v} m/s with Isp=${isp}s, you need ${((1 - 1 / mr) * 100).toFixed(1)}% propellant by mass`,
        };
        break;
      }

      case 'staging': {
        const { payload_mass, delta_v, num_stages, isp, structural_fraction, propellant_type } =
          args;
        if (!payload_mass || !delta_v || !num_stages) {
          throw new Error('staging requires payload_mass, delta_v, and num_stages');
        }

        let ispValue = isp || 311;
        if (propellant_type && PROPELLANTS[propellant_type]) {
          ispValue = PROPELLANTS[propellant_type].isp_vac;
        }

        const sf = structural_fraction || 0.1;
        const ispArray = Array(num_stages).fill(ispValue);
        const sfArray = Array(num_stages).fill(sf);

        const stagingResult = optimizeStaging(payload_mass, delta_v, num_stages, ispArray, sfArray);

        const stageDetails = stagingResult.stages.map((s, i) => {
          const calc = calculateStage(s);
          return {
            stage: i + 1,
            propellant_mass_kg: s.propellant_mass,
            structural_mass_kg: s.structural_mass,
            stage_mass_kg: s.propellant_mass + s.structural_mass,
            delta_v_m_s: calc.delta_v,
            mass_ratio: calc.mass_ratio,
            burn_time_s: calc.burn_time,
            thrust_to_weight: calc.twr,
          };
        });

        const totalMass =
          stagingResult.stages.reduce((sum, s) => sum + s.propellant_mass + s.structural_mass, 0) +
          payload_mass;

        result = {
          operation: 'staging',
          inputs: { payload_mass, delta_v, num_stages, isp: ispValue, structural_fraction: sf },
          results: {
            total_mass_kg: totalMass,
            payload_fraction: payload_mass / totalMass,
            total_delta_v_m_s: stagingResult.total_delta_v,
            stages: stageDetails,
          },
        };
        break;
      }

      case 'thrust': {
        const { thrust_n, isp } = args;
        if (!thrust_n || !isp) {
          throw new Error('thrust requires thrust_n and isp');
        }
        const mdot = massFlowRate(thrust_n, isp);
        result = {
          operation: 'thrust_analysis',
          inputs: { thrust_n, isp },
          results: {
            mass_flow_rate_kg_s: mdot,
            exhaust_velocity_m_s: isp * G0,
            power_watts: 0.5 * mdot * Math.pow(isp * G0, 2),
          },
        };
        break;
      }

      case 'burn_time': {
        const { propellant_mass, thrust_n, isp } = args;
        if (!propellant_mass || !thrust_n || !isp) {
          throw new Error('burn_time requires propellant_mass, thrust_n, and isp');
        }

        const mdot = massFlowRate(thrust_n, isp);
        const burn = burnTime(propellant_mass, mdot);

        result = {
          operation: 'burn_time',
          inputs: { propellant_mass, thrust_n, isp },
          results: {
            burn_time_seconds: burn,
            burn_time_minutes: burn / 60,
            mass_flow_rate_kg_s: mdot,
          },
        };
        break;
      }

      case 'mission': {
        const { mission_name } = args;

        if (mission_name && MISSION_DELTA_V[mission_name]) {
          const mission = MISSION_DELTA_V[mission_name];
          result = {
            operation: 'mission',
            mission: mission_name,
            description: mission.description,
            delta_v_m_s: mission.delta_v,
            delta_v_km_s: mission.delta_v / 1000,
          };
        } else {
          result = {
            operation: 'mission',
            available_missions: Object.entries(MISSION_DELTA_V).map(([key, val]) => ({
              key,
              description: val.description,
              delta_v_km_s: val.delta_v / 1000,
            })),
          };
        }
        break;
      }

      case 'propellants': {
        result = {
          operation: 'propellants',
          available: Object.entries(PROPELLANTS).map(([key, val]) => ({
            key,
            name: val.name,
            isp_vacuum_s: val.isp_vac,
            isp_sea_level_s: val.isp_sl,
            density_kg_m3: val.density,
          })),
        };
        break;
      }

      case 'single_stage': {
        const { propellant_mass, structural_mass, payload_mass, isp, thrust_n, propellant_type } =
          args;
        if (!propellant_mass || !structural_mass || !payload_mass) {
          throw new Error(
            'single_stage requires propellant_mass, structural_mass, and payload_mass'
          );
        }

        let ispValue = isp || 311;
        if (propellant_type && PROPELLANTS[propellant_type]) {
          ispValue = PROPELLANTS[propellant_type].isp_vac;
        }

        const m0 = propellant_mass + structural_mass + payload_mass;
        const mf = structural_mass + payload_mass;
        const dv = tsiolkovsky(ispValue, m0, mf);
        const mr = m0 / mf;

        const thrustValue = thrust_n || m0 * G0 * 1.5;
        const mdot = massFlowRate(thrustValue, ispValue);
        const burn = burnTime(propellant_mass, mdot);
        const twr = thrustToWeight(thrustValue, m0);

        result = {
          operation: 'single_stage',
          inputs: { propellant_mass, structural_mass, payload_mass, isp: ispValue },
          results: {
            wet_mass_kg: m0,
            dry_mass_kg: mf,
            delta_v_m_s: dv,
            delta_v_km_s: dv / 1000,
            mass_ratio: mr,
            propellant_fraction: propellant_mass / m0,
            payload_fraction: payload_mass / m0,
            structural_fraction: structural_mass / (propellant_mass + structural_mass),
            thrust_to_weight: twr,
            burn_time_s: burn,
            can_reach_orbit: dv > 9400,
          },
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

export function isRocketPropulsionAvailable(): boolean {
  return true;
}
