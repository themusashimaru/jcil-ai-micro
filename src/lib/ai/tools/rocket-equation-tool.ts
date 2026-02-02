/**
 * ROCKET-EQUATION TOOL
 * Tsiolkovsky rocket equation, staging optimization, and propulsion calculations
 * Real physics for spacecraft delta-v, mass ratios, and multi-stage rockets
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Physical constants
const EARTH_G = 9.80665; // m/s² - standard gravity
const EARTH_RADIUS = 6371000; // meters
const EARTH_MU = 3.986004418e14; // m³/s² - gravitational parameter

// Common propellant combinations with typical Isp values
const PROPELLANTS: Record<string, { isp_sl: number; isp_vac: number; density: number; name: string }> = {
  'LOX/RP-1': { isp_sl: 270, isp_vac: 311, density: 1030, name: 'Liquid Oxygen / RP-1 Kerosene' },
  'LOX/LH2': { isp_sl: 366, isp_vac: 452, density: 360, name: 'Liquid Oxygen / Liquid Hydrogen' },
  'N2O4/UDMH': { isp_sl: 285, isp_vac: 316, density: 1180, name: 'Nitrogen Tetroxide / UDMH' },
  'solid': { isp_sl: 242, isp_vac: 268, density: 1800, name: 'Solid Propellant (APCP)' },
  'LOX/CH4': { isp_sl: 311, isp_vac: 363, density: 820, name: 'Liquid Oxygen / Liquid Methane' },
  'hydrazine': { isp_sl: 220, isp_vac: 230, density: 1004, name: 'Hydrazine Monopropellant' },
  'cold_gas': { isp_sl: 65, isp_vac: 70, density: 1, name: 'Cold Gas (Nitrogen)' },
  'ion': { isp_sl: 0, isp_vac: 3000, density: 0, name: 'Ion Propulsion (Xenon)' },
  'nuclear_thermal': { isp_sl: 0, isp_vac: 900, density: 70, name: 'Nuclear Thermal (LH2)' }
};

// Orbital velocity requirements
const MISSION_DELTA_V: Record<string, number> = {
  'LEO': 9400, // Low Earth Orbit from sea level
  'GTO': 13500, // Geostationary Transfer Orbit
  'GEO': 14500, // Geostationary Orbit
  'lunar_orbit': 15500, // Lunar orbit insertion
  'lunar_surface': 16500, // Lunar landing
  'mars_transfer': 15200, // Mars transfer orbit
  'mars_orbit': 16500, // Mars orbit insertion
  'escape': 11200, // Earth escape velocity
  'ISS': 9100 // ISS orbit
};

// Tsiolkovsky rocket equation: Δv = Isp * g₀ * ln(m₀/mf)
function tsiolkovsky(isp: number, m0: number, mf: number): number {
  if (mf <= 0 || m0 <= mf) return 0;
  return isp * EARTH_G * Math.log(m0 / mf);
}

// Inverse: find mass ratio from delta-v
function massRatioFromDeltaV(deltaV: number, isp: number): number {
  const ve = isp * EARTH_G; // exhaust velocity
  return Math.exp(deltaV / ve);
}

// Propellant mass fraction
function propellantMassFraction(massRatio: number): number {
  return 1 - (1 / massRatio);
}

// Calculate required propellant mass
function propellantMass(m0: number, mf: number): number {
  return m0 - mf;
}

// Exhaust velocity from Isp
function exhaustVelocity(isp: number): number {
  return isp * EARTH_G;
}

// Thrust calculation: F = ṁ * ve
function thrust(massFlowRate: number, isp: number): number {
  return massFlowRate * isp * EARTH_G;
}

// Burn time calculation
function burnTime(propellantMass: number, massFlowRate: number): number {
  return propellantMass / massFlowRate;
}

// Structural coefficient (ratio of stage structure to propellant)
function structuralCoefficient(structureMass: number, propellantMass: number): number {
  return structureMass / (structureMass + propellantMass);
}

// Optimal staging for n stages (equal delta-v distribution)
function optimalStagingEqualDeltaV(
  totalDeltaV: number,
  numStages: number,
  isp: number[],
  structuralCoefficients: number[],
  payloadMass: number
): {
  stages: Array<{
    stage: number;
    deltaV: number;
    massRatio: number;
    propellantMass: number;
    structureMass: number;
    totalMass: number;
    isp: number;
  }>;
  totalMass: number;
  payloadFraction: number;
} {
  const stages = [];
  let currentMass = payloadMass;

  // Work backwards from payload
  for (let i = numStages - 1; i >= 0; i--) {
    const stageDeltaV = totalDeltaV / numStages;
    const stageIsp = isp[i] || isp[0];
    const epsilon = structuralCoefficients[i] || structuralCoefficients[0];

    const massRatio = massRatioFromDeltaV(stageDeltaV, stageIsp);

    // m₀/mf = massRatio, mf = payload + structure
    // structure = epsilon * (propellant + structure)
    // propellant = m₀ - mf

    const mf = currentMass;
    const m0 = mf * massRatio;
    const propellant = m0 - mf;

    // Total stage mass including structure
    const stageTotalMass = propellant / (1 - epsilon);
    const structureMass = stageTotalMass - propellant;

    const actualM0 = currentMass + stageTotalMass;
    const actualMf = currentMass + structureMass;
    const actualDeltaV = tsiolkovsky(stageIsp, actualM0, actualMf);

    stages.unshift({
      stage: i + 1,
      deltaV: actualDeltaV,
      massRatio: actualM0 / actualMf,
      propellantMass: propellant,
      structureMass: structureMass,
      totalMass: stageTotalMass,
      isp: stageIsp
    });

    currentMass = actualM0;
  }

  const totalMass = currentMass;
  const payloadFraction = payloadMass / totalMass;

  return { stages, totalMass, payloadFraction };
}

// Optimal two-stage rocket (Lagrange multiplier solution)
function optimalTwoStage(
  totalDeltaV: number,
  isp1: number,
  isp2: number,
  epsilon1: number,
  epsilon2: number,
  payloadMass: number
): {
  stage1: { deltaV: number; massRatio: number; propellantMass: number; structureMass: number };
  stage2: { deltaV: number; massRatio: number; propellantMass: number; structureMass: number };
  totalMass: number;
  optimalSplit: number;
} {
  // For optimal staging, the delta-v split depends on Isp ratio
  // Using iterative search for minimum total mass

  let bestSplit = 0.5;
  let minTotalMass = Infinity;
  let bestStages = { stage1: {} as any, stage2: {} as any };

  for (let split = 0.1; split <= 0.9; split += 0.01) {
    const dv1 = totalDeltaV * split;
    const dv2 = totalDeltaV * (1 - split);

    // Stage 2 (upper stage) - calculated first
    const mr2 = massRatioFromDeltaV(dv2, isp2);
    const mf2 = payloadMass;
    const propellant2 = mf2 * (mr2 - 1) / (1 - epsilon2 * mr2 / (mr2 - 1));
    const structure2 = propellant2 * epsilon2 / (1 - epsilon2);
    const m0_stage2 = payloadMass + propellant2 + structure2;

    // Stage 1 (lower stage)
    const payload1 = m0_stage2;
    const mr1 = massRatioFromDeltaV(dv1, isp1);
    const mf1 = payload1;
    const propellant1 = mf1 * (mr1 - 1) / (1 - epsilon1 * mr1 / (mr1 - 1));
    const structure1 = propellant1 * epsilon1 / (1 - epsilon1);
    const totalMass = payload1 + propellant1 + structure1;

    if (totalMass < minTotalMass && propellant1 > 0 && propellant2 > 0) {
      minTotalMass = totalMass;
      bestSplit = split;
      bestStages = {
        stage1: {
          deltaV: dv1,
          massRatio: mr1,
          propellantMass: propellant1,
          structureMass: structure1
        },
        stage2: {
          deltaV: dv2,
          massRatio: mr2,
          propellantMass: propellant2,
          structureMass: structure2
        }
      };
    }
  }

  return {
    ...bestStages,
    totalMass: minTotalMass,
    optimalSplit: bestSplit
  };
}

// Gravity loss estimation
function gravityLoss(burnTime: number, avgThrust: number, avgMass: number): number {
  // Simplified gravity loss: ∫g·sin(θ)dt ≈ g·t for vertical ascent
  const avgAccel = avgThrust / avgMass;
  const thrustToWeight = avgAccel / EARTH_G;
  // Empirical formula for typical ascent profile
  return EARTH_G * burnTime * 0.3 / thrustToWeight;
}

// Drag loss estimation (simplified)
function dragLoss(
  v_max: number,
  altitude_km: number,
  cd: number = 0.3,
  area: number = 10
): number {
  // Atmospheric density at altitude
  const rho0 = 1.225; // kg/m³ at sea level
  const scaleHeight = 8500; // meters
  const avgRho = rho0 * Math.exp(-altitude_km * 1000 / 2 / scaleHeight);

  // Approximate drag loss over ascent
  return 0.5 * cd * area * avgRho * v_max * v_max / 2000; // Very simplified
}

// Orbit insertion delta-v
function orbitalVelocity(altitude: number): number {
  const r = EARTH_RADIUS + altitude;
  return Math.sqrt(EARTH_MU / r);
}

// Hohmann transfer delta-v
function hohmannTransfer(r1: number, r2: number): { deltaV1: number; deltaV2: number; total: number } {
  const a = (r1 + r2) / 2; // semi-major axis of transfer orbit

  // Velocity at periapsis of transfer orbit
  const v_transfer_peri = Math.sqrt(EARTH_MU * (2 / r1 - 1 / a));
  // Velocity at apoapsis of transfer orbit
  const v_transfer_apo = Math.sqrt(EARTH_MU * (2 / r2 - 1 / a));

  // Circular velocities
  const v_circ1 = Math.sqrt(EARTH_MU / r1);
  const v_circ2 = Math.sqrt(EARTH_MU / r2);

  const deltaV1 = Math.abs(v_transfer_peri - v_circ1);
  const deltaV2 = Math.abs(v_circ2 - v_transfer_apo);

  return { deltaV1, deltaV2, total: deltaV1 + deltaV2 };
}

export const rocketequationTool: UnifiedTool = {
  name: 'rocket_equation',
  description: 'Tsiolkovsky rocket equation, staging optimization, and propulsion calculations for spacecraft design',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['info', 'delta_v', 'mass_ratio', 'propellant', 'staging', 'optimize', 'thrust', 'orbit', 'losses', 'demonstrate'],
        description: 'Operation to perform'
      },
      isp: { type: 'number', description: 'Specific impulse in seconds' },
      propellant_type: { type: 'string', description: 'Propellant type (LOX/RP-1, LOX/LH2, etc.)' },
      initial_mass: { type: 'number', description: 'Initial mass m₀ in kg' },
      final_mass: { type: 'number', description: 'Final mass mf in kg (dry mass + payload)' },
      payload_mass: { type: 'number', description: 'Payload mass in kg' },
      delta_v: { type: 'number', description: 'Delta-v requirement in m/s' },
      mission: { type: 'string', description: 'Mission type (LEO, GTO, lunar, mars)' },
      num_stages: { type: 'integer', description: 'Number of stages' },
      structural_coefficient: { type: 'number', description: 'Structural coefficient (0.05-0.15 typical)' },
      mass_flow_rate: { type: 'number', description: 'Mass flow rate in kg/s' },
      vacuum: { type: 'boolean', description: 'Use vacuum Isp (vs sea level)' }
    },
    required: ['operation']
  }
};

export async function executerocketequation(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation;

    let result: any;

    switch (operation) {
      case 'info': {
        result = {
          operation: 'info',
          tool: 'rocket_equation',
          description: 'Tsiolkovsky rocket equation and spacecraft propulsion calculations',
          equations: {
            tsiolkovsky: 'Δv = Isp × g₀ × ln(m₀/mf)',
            exhaust_velocity: 'vₑ = Isp × g₀',
            thrust: 'F = ṁ × vₑ',
            mass_ratio: 'R = m₀/mf = exp(Δv/vₑ)',
            propellant_fraction: 'ζ = 1 - 1/R'
          },
          constants: {
            g0: `${EARTH_G} m/s² (standard gravity)`,
            earth_radius: `${EARTH_RADIUS / 1000} km`,
            escape_velocity: `${Math.sqrt(2 * EARTH_MU / EARTH_RADIUS).toFixed(0)} m/s`
          },
          propellants: Object.entries(PROPELLANTS).map(([key, val]) => ({
            type: key,
            name: val.name,
            isp_sea_level: val.isp_sl,
            isp_vacuum: val.isp_vac
          })),
          mission_requirements: MISSION_DELTA_V,
          operations: ['delta_v', 'mass_ratio', 'propellant', 'staging', 'optimize', 'thrust', 'orbit', 'losses', 'demonstrate']
        };
        break;
      }

      case 'delta_v': {
        const isp = args.isp || (args.propellant_type && PROPELLANTS[args.propellant_type]
          ? (args.vacuum ? PROPELLANTS[args.propellant_type].isp_vac : PROPELLANTS[args.propellant_type].isp_sl)
          : 300);
        const m0 = args.initial_mass || 100000;
        const mf = args.final_mass || 30000;

        const deltaV = tsiolkovsky(isp, m0, mf);
        const ve = exhaustVelocity(isp);
        const massRatio = m0 / mf;
        const propellant = propellantMass(m0, mf);
        const propFraction = propellantMassFraction(massRatio);

        result = {
          operation: 'delta_v',
          inputs: {
            specific_impulse: { value: isp, unit: 'seconds' },
            initial_mass: { value: m0, unit: 'kg' },
            final_mass: { value: mf, unit: 'kg' }
          },
          results: {
            delta_v: { value: parseFloat(deltaV.toFixed(2)), unit: 'm/s' },
            exhaust_velocity: { value: parseFloat(ve.toFixed(2)), unit: 'm/s' },
            mass_ratio: parseFloat(massRatio.toFixed(4)),
            propellant_mass: { value: parseFloat(propellant.toFixed(2)), unit: 'kg' },
            propellant_fraction: parseFloat((propFraction * 100).toFixed(2)) + '%'
          },
          formula: `Δv = ${isp} × ${EARTH_G.toFixed(2)} × ln(${m0}/${mf}) = ${deltaV.toFixed(2)} m/s`,
          mission_capability: Object.entries(MISSION_DELTA_V)
            .filter(([_, dv]) => deltaV >= dv)
            .map(([mission, dv]) => ({ mission, required_dv: dv, surplus: parseFloat((deltaV - dv).toFixed(0)) }))
        };
        break;
      }

      case 'mass_ratio': {
        const deltaV = args.delta_v || MISSION_DELTA_V[args.mission || 'LEO'] || 9400;
        const isp = args.isp || (args.propellant_type && PROPELLANTS[args.propellant_type]
          ? (args.vacuum !== false ? PROPELLANTS[args.propellant_type].isp_vac : PROPELLANTS[args.propellant_type].isp_sl)
          : 300);

        const massRatio = massRatioFromDeltaV(deltaV, isp);
        const propFraction = propellantMassFraction(massRatio);
        const ve = exhaustVelocity(isp);

        // If payload specified, calculate masses
        const payloadMass = args.payload_mass || 1000;
        const structuralCoef = args.structural_coefficient || 0.1;

        // mf = payload + structure, structure = structuralCoef × (m0 - mf)
        // mf = payload + structuralCoef × propellant
        // m0 = mf × massRatio
        // propellant = m0 - mf = mf × (massRatio - 1)
        // mf = payload + structuralCoef × mf × (massRatio - 1)
        // mf × (1 - structuralCoef × (massRatio - 1)) = payload
        // mf = payload / (1 - structuralCoef × (massRatio - 1))

        const denominator = 1 - structuralCoef * (massRatio - 1);
        const dryMass = denominator > 0 ? payloadMass / denominator : Infinity;
        const totalMass = dryMass * massRatio;
        const propellant = totalMass - dryMass;
        const structureMass = dryMass - payloadMass;

        result = {
          operation: 'mass_ratio',
          inputs: {
            delta_v: { value: deltaV, unit: 'm/s' },
            specific_impulse: { value: isp, unit: 'seconds' },
            payload_mass: { value: payloadMass, unit: 'kg' },
            structural_coefficient: structuralCoef
          },
          results: {
            mass_ratio: parseFloat(massRatio.toFixed(4)),
            propellant_fraction: parseFloat((propFraction * 100).toFixed(2)) + '%',
            exhaust_velocity: { value: parseFloat(ve.toFixed(2)), unit: 'm/s' }
          },
          vehicle_sizing: {
            total_mass: { value: parseFloat(totalMass.toFixed(2)), unit: 'kg' },
            dry_mass: { value: parseFloat(dryMass.toFixed(2)), unit: 'kg' },
            propellant_mass: { value: parseFloat(propellant.toFixed(2)), unit: 'kg' },
            structure_mass: { value: parseFloat(structureMass.toFixed(2)), unit: 'kg' },
            payload_fraction: parseFloat((payloadMass / totalMass * 100).toFixed(3)) + '%'
          },
          formula: `R = exp(${deltaV} / ${ve.toFixed(1)}) = ${massRatio.toFixed(4)}`
        };
        break;
      }

      case 'propellant': {
        const propType = args.propellant_type || 'LOX/RP-1';
        const propInfo = PROPELLANTS[propType] || PROPELLANTS['LOX/RP-1'];
        const isVacuum = args.vacuum !== false;
        const isp = isVacuum ? propInfo.isp_vac : propInfo.isp_sl;

        result = {
          operation: 'propellant',
          propellant: {
            type: propType,
            name: propInfo.name,
            isp_sea_level: propInfo.isp_sl,
            isp_vacuum: propInfo.isp_vac,
            density: propInfo.density,
            exhaust_velocity_sl: parseFloat(exhaustVelocity(propInfo.isp_sl).toFixed(1)),
            exhaust_velocity_vac: parseFloat(exhaustVelocity(propInfo.isp_vac).toFixed(1))
          },
          performance_comparison: Object.entries(PROPELLANTS).map(([key, val]) => ({
            type: key,
            isp_vac: val.isp_vac,
            mass_ratio_for_leo: parseFloat(massRatioFromDeltaV(9400, val.isp_vac).toFixed(2)),
            best_for: key === 'LOX/LH2' ? 'upper stages' :
                      key === 'LOX/RP-1' ? 'first stages' :
                      key === 'ion' ? 'deep space' :
                      key === 'solid' ? 'boosters' : 'various'
          })),
          applications: {
            first_stage: ['LOX/RP-1', 'LOX/CH4', 'solid'],
            upper_stage: ['LOX/LH2', 'LOX/RP-1', 'N2O4/UDMH'],
            deep_space: ['ion', 'nuclear_thermal', 'N2O4/UDMH'],
            attitude_control: ['hydrazine', 'cold_gas']
          }
        };
        break;
      }

      case 'staging': {
        const numStages = args.num_stages || 2;
        const deltaV = args.delta_v || MISSION_DELTA_V[args.mission || 'LEO'] || 9400;
        const payloadMass = args.payload_mass || 1000;
        const structCoef = args.structural_coefficient || 0.1;

        // Default ISPs for stages (typically higher Isp upper stages)
        const defaultIsps = [311, 452, 452]; // RP-1 first, LH2 upper
        const isps = args.isp ? [args.isp] : defaultIsps.slice(0, numStages);
        const structCoefs = Array(numStages).fill(structCoef);

        const staging = optimalStagingEqualDeltaV(
          deltaV, numStages, isps, structCoefs, payloadMass
        );

        result = {
          operation: 'staging',
          inputs: {
            num_stages: numStages,
            delta_v_requirement: { value: deltaV, unit: 'm/s' },
            payload_mass: { value: payloadMass, unit: 'kg' },
            structural_coefficient: structCoef
          },
          staging_analysis: {
            stages: staging.stages.map(s => ({
              ...s,
              propellantMass: parseFloat(s.propellantMass.toFixed(2)),
              structureMass: parseFloat(s.structureMass.toFixed(2)),
              totalMass: parseFloat(s.totalMass.toFixed(2)),
              deltaV: parseFloat(s.deltaV.toFixed(2)),
              massRatio: parseFloat(s.massRatio.toFixed(4))
            })),
            total_vehicle_mass: parseFloat(staging.totalMass.toFixed(2)),
            payload_fraction: parseFloat((staging.payloadFraction * 100).toFixed(4)) + '%'
          },
          why_staging: {
            explanation: 'Staging improves efficiency by discarding empty tanks',
            single_stage_mass_ratio: parseFloat(massRatioFromDeltaV(deltaV, isps[0]).toFixed(2)),
            benefit: 'Multi-stage reduces total mass for same payload'
          }
        };
        break;
      }

      case 'optimize': {
        const deltaV = args.delta_v || MISSION_DELTA_V[args.mission || 'LEO'] || 9400;
        const payloadMass = args.payload_mass || 1000;
        const isp1 = args.isp || 311; // First stage
        const isp2 = args.isp ? args.isp * 1.2 : 452; // Upper stage typically higher Isp
        const epsilon1 = args.structural_coefficient || 0.08;
        const epsilon2 = args.structural_coefficient || 0.12;

        const optimal = optimalTwoStage(deltaV, isp1, isp2, epsilon1, epsilon2, payloadMass);

        // Compare with single stage
        const singleStageMR = massRatioFromDeltaV(deltaV, isp2);
        const singleStageMass = payloadMass * singleStageMR / (1 - epsilon2 * (singleStageMR - 1));

        result = {
          operation: 'optimize',
          inputs: {
            delta_v_requirement: { value: deltaV, unit: 'm/s' },
            payload_mass: { value: payloadMass, unit: 'kg' },
            stage1_isp: isp1,
            stage2_isp: isp2
          },
          optimal_design: {
            optimal_delta_v_split: parseFloat((optimal.optimalSplit * 100).toFixed(1)) + '%',
            stage1: {
              delta_v: parseFloat(optimal.stage1.deltaV.toFixed(2)),
              mass_ratio: parseFloat(optimal.stage1.massRatio.toFixed(4)),
              propellant: parseFloat(optimal.stage1.propellantMass.toFixed(2)),
              structure: parseFloat(optimal.stage1.structureMass.toFixed(2))
            },
            stage2: {
              delta_v: parseFloat(optimal.stage2.deltaV.toFixed(2)),
              mass_ratio: parseFloat(optimal.stage2.massRatio.toFixed(4)),
              propellant: parseFloat(optimal.stage2.propellantMass.toFixed(2)),
              structure: parseFloat(optimal.stage2.structureMass.toFixed(2))
            },
            total_mass: parseFloat(optimal.totalMass.toFixed(2)),
            payload_fraction: parseFloat((payloadMass / optimal.totalMass * 100).toFixed(3)) + '%'
          },
          comparison: {
            single_stage_mass: parseFloat(singleStageMass.toFixed(2)),
            two_stage_mass: parseFloat(optimal.totalMass.toFixed(2)),
            mass_savings: parseFloat(((1 - optimal.totalMass / singleStageMass) * 100).toFixed(1)) + '%'
          },
          design_principles: [
            'First stage: prioritize thrust-to-weight, accept lower Isp',
            'Upper stages: prioritize Isp for efficiency',
            'Optimal split depends on Isp ratio and structural coefficients'
          ]
        };
        break;
      }

      case 'thrust': {
        const massFlowRate = args.mass_flow_rate || 500; // kg/s
        const isp = args.isp || 311;
        const propType = args.propellant_type;

        if (propType && PROPELLANTS[propType]) {
          const propInfo = PROPELLANTS[propType];
          const isp_used = args.vacuum ? propInfo.isp_vac : propInfo.isp_sl;

          const thrustN = thrust(massFlowRate, isp_used);
          const thrustKN = thrustN / 1000;
          const ve = exhaustVelocity(isp_used);

          result = {
            operation: 'thrust',
            inputs: {
              propellant: propType,
              mass_flow_rate: { value: massFlowRate, unit: 'kg/s' },
              specific_impulse: { value: isp_used, unit: 's' },
              environment: args.vacuum ? 'vacuum' : 'sea level'
            },
            results: {
              thrust: { value: parseFloat(thrustKN.toFixed(2)), unit: 'kN' },
              thrust_newtons: parseFloat(thrustN.toFixed(2)),
              exhaust_velocity: { value: parseFloat(ve.toFixed(2)), unit: 'm/s' }
            },
            formula: `F = ṁ × vₑ = ${massFlowRate} × ${ve.toFixed(1)} = ${thrustN.toFixed(0)} N`
          };
        } else {
          const thrustN = thrust(massFlowRate, isp);
          result = {
            operation: 'thrust',
            inputs: {
              mass_flow_rate: { value: massFlowRate, unit: 'kg/s' },
              specific_impulse: { value: isp, unit: 's' }
            },
            results: {
              thrust: { value: parseFloat((thrustN / 1000).toFixed(2)), unit: 'kN' },
              exhaust_velocity: { value: parseFloat(exhaustVelocity(isp).toFixed(2)), unit: 'm/s' }
            }
          };
        }
        break;
      }

      case 'orbit': {
        const altitude1 = args.altitude1 || 200000; // 200 km LEO
        const altitude2 = args.altitude2 || 35786000; // GEO

        const r1 = EARTH_RADIUS + altitude1;
        const r2 = EARTH_RADIUS + altitude2;

        const v1 = orbitalVelocity(altitude1);
        const v2 = orbitalVelocity(altitude2);
        const hohmann = hohmannTransfer(r1, r2);

        result = {
          operation: 'orbit',
          inputs: {
            lower_orbit: { altitude: altitude1 / 1000, unit: 'km' },
            higher_orbit: { altitude: altitude2 / 1000, unit: 'km' }
          },
          orbital_velocities: {
            lower_orbit: { value: parseFloat(v1.toFixed(2)), unit: 'm/s' },
            higher_orbit: { value: parseFloat(v2.toFixed(2)), unit: 'm/s' }
          },
          hohmann_transfer: {
            burn1_delta_v: { value: parseFloat(hohmann.deltaV1.toFixed(2)), unit: 'm/s' },
            burn2_delta_v: { value: parseFloat(hohmann.deltaV2.toFixed(2)), unit: 'm/s' },
            total_delta_v: { value: parseFloat(hohmann.total.toFixed(2)), unit: 'm/s' }
          },
          escape_velocity: parseFloat(Math.sqrt(2 * EARTH_MU / r1).toFixed(2)),
          common_orbits: {
            ISS: { altitude: 420, velocity: parseFloat(orbitalVelocity(420000).toFixed(0)) },
            LEO: { altitude: 200, velocity: parseFloat(orbitalVelocity(200000).toFixed(0)) },
            GEO: { altitude: 35786, velocity: parseFloat(orbitalVelocity(35786000).toFixed(0)) }
          }
        };
        break;
      }

      case 'losses': {
        const burnTimeVal = args.burn_time || 150; // seconds
        const avgThrust = args.thrust || 7000000; // N (F9 first stage)
        const avgMass = args.average_mass || 350000; // kg

        const gravLoss = gravityLoss(burnTimeVal, avgThrust, avgMass);
        const dragLossVal = dragLoss(2500, 50);
        const totalLoss = gravLoss + dragLossVal;

        // Ideal vs actual delta-v
        const idealDeltaV = 9400; // LEO
        const actualRequired = idealDeltaV + totalLoss;

        result = {
          operation: 'losses',
          inputs: {
            burn_time: { value: burnTimeVal, unit: 's' },
            average_thrust: { value: avgThrust / 1000, unit: 'kN' },
            average_mass: { value: avgMass, unit: 'kg' }
          },
          losses: {
            gravity_loss: { value: parseFloat(gravLoss.toFixed(0)), unit: 'm/s' },
            drag_loss: { value: parseFloat(dragLossVal.toFixed(0)), unit: 'm/s' },
            total_losses: { value: parseFloat(totalLoss.toFixed(0)), unit: 'm/s' }
          },
          delta_v_budget: {
            orbital_velocity: idealDeltaV,
            total_with_losses: parseFloat(actualRequired.toFixed(0)),
            loss_percentage: parseFloat((totalLoss / idealDeltaV * 100).toFixed(1)) + '%'
          },
          mitigation: [
            'Gravity loss: Higher thrust-to-weight ratio reduces burn time',
            'Drag loss: Optimal trajectory trades gravity vs drag losses',
            'Typical losses: 1500-2000 m/s for Earth launch'
          ]
        };
        break;
      }

      case 'demonstrate': {
        const examples = [];

        // Example 1: Falcon 9 first stage
        const f9_m0 = 549054;
        const f9_mf = 96570;
        const f9_isp = 282;
        const f9_dv = tsiolkovsky(f9_isp, f9_m0, f9_mf);

        examples.push({
          name: 'Falcon 9 First Stage',
          data: {
            initial_mass: f9_m0,
            final_mass: f9_mf,
            isp_sea_level: f9_isp,
            propellant: 'LOX/RP-1',
            calculated_delta_v: parseFloat(f9_dv.toFixed(0))
          }
        });

        // Example 2: Apollo Lunar Module ascent
        const lm_m0 = 4700;
        const lm_mf = 2150;
        const lm_isp = 311;
        const lm_dv = tsiolkovsky(lm_isp, lm_m0, lm_mf);

        examples.push({
          name: 'Apollo Lunar Module Ascent Stage',
          data: {
            initial_mass: lm_m0,
            final_mass: lm_mf,
            isp: lm_isp,
            propellant: 'N2O4/Aerozine-50',
            calculated_delta_v: parseFloat(lm_dv.toFixed(0)),
            required_for_lunar_orbit: 1870
          }
        });

        // Example 3: Staging comparison
        const payload = 10000;
        const single = massRatioFromDeltaV(9400, 450);
        const twoStage = optimalTwoStage(9400, 311, 452, 0.08, 0.10, payload);

        examples.push({
          name: 'Single vs Two-Stage to LEO',
          comparison: {
            payload_mass: payload,
            single_stage_mass_ratio: parseFloat(single.toFixed(2)),
            single_stage_total_mass: parseFloat((payload * single / 0.85).toFixed(0)),
            two_stage_total_mass: parseFloat(twoStage.totalMass.toFixed(0)),
            two_stage_savings: parseFloat(((1 - twoStage.totalMass / (payload * single / 0.85)) * 100).toFixed(1)) + '%'
          }
        });

        result = {
          operation: 'demonstrate',
          tool: 'rocket_equation',
          examples,
          key_insights: [
            'Δv depends logarithmically on mass ratio - diminishing returns',
            'Higher Isp = more efficient but often lower thrust',
            'Staging allows optimal propellant choice per flight regime',
            'First stages: high thrust, accept lower Isp',
            'Upper stages: high Isp for efficiency',
            'Real missions must budget for gravity and drag losses'
          ],
          visualization: `
TSIOLKOVSKY ROCKET EQUATION
═══════════════════════════

    Δv = Isp × g₀ × ln(m₀/mf)

    Where:
    • Δv = change in velocity (m/s)
    • Isp = specific impulse (s)
    • g₀ = 9.81 m/s²
    • m₀ = initial mass
    • mf = final mass (dry + payload)

MASS RATIO vs DELTA-V (Isp = 300s)
──────────────────────────────────
Δv (km/s)│ Mass Ratio │ Propellant %
─────────┼────────────┼─────────────
   1.0   │    1.4     │    28%
   2.0   │    2.0     │    50%
   3.0   │    2.8     │    64%
   4.0   │    3.9     │    74%
   5.0   │    5.5     │    82%
   9.4   │   25.0     │    96%
`
        };
        break;
      }

      default:
        result = {
          error: `Unknown operation: ${operation}`,
          available: ['info', 'delta_v', 'mass_ratio', 'propellant', 'staging', 'optimize', 'thrust', 'orbit', 'losses', 'demonstrate']
        };
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function isrocketequationAvailable(): boolean {
  return true;
}
