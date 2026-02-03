/**
 * ROCKET-EQUATION TOOL
 * Tsiolkovsky rocket equation and spacecraft propulsion calculations
 * Complete implementation with staging, orbital mechanics, and propellant analysis
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// CONSTANTS
// ============================================================================

const G = 6.6743e-11; // Gravitational constant (m³/kg/s²)
const EARTH_MASS = 5.972e24; // kg
const EARTH_RADIUS = 6.371e6; // m
const EARTH_GRAVITY = 9.80665; // m/s² (standard gravity)

// ============================================================================
// PROPELLANT DATABASE
// ============================================================================

interface Propellant {
  name: string;
  type: 'chemical' | 'electric' | 'nuclear' | 'theoretical';
  specificImpulse: number; // seconds (at sea level for chemical, vacuum otherwise)
  specificImpulseVacuum: number; // seconds
  exhaustVelocity: number; // m/s
  density?: number; // kg/m³
  description: string;
  examples?: string[];
}

const PROPELLANTS: Record<string, Propellant> = {
  // Chemical propellants
  solid: {
    name: 'Solid Propellant',
    type: 'chemical',
    specificImpulse: 250,
    specificImpulseVacuum: 280,
    exhaustVelocity: 2746,
    density: 1800,
    description: 'Simple, storable, high thrust',
    examples: ['Space Shuttle SRBs', 'Minuteman missiles'],
  },
  'lox-rp1': {
    name: 'LOX/RP-1 (Kerosene)',
    type: 'chemical',
    specificImpulse: 289,
    specificImpulseVacuum: 311,
    exhaustVelocity: 3050,
    density: 1030,
    description: 'Dense, storable oxidizer with kerosene fuel',
    examples: ['Falcon 9', 'Saturn V first stage', 'Soyuz'],
  },
  'lox-lh2': {
    name: 'LOX/LH2 (Hydrogen)',
    type: 'chemical',
    specificImpulse: 366,
    specificImpulseVacuum: 452,
    exhaustVelocity: 4436,
    density: 320,
    description: 'Highest performance chemical propellant',
    examples: ['Space Shuttle main engines', 'Centaur', 'Delta IV'],
  },
  'lox-methane': {
    name: 'LOX/Methane',
    type: 'chemical',
    specificImpulse: 299,
    specificImpulseVacuum: 363,
    exhaustVelocity: 3560,
    density: 800,
    description: 'Emerging propellant, good for reusability',
    examples: ['SpaceX Raptor', 'Blue Origin BE-4'],
  },
  'n2o4-mmh': {
    name: 'N2O4/MMH (Hypergolic)',
    type: 'chemical',
    specificImpulse: 280,
    specificImpulseVacuum: 311,
    exhaustVelocity: 3050,
    density: 1200,
    description: 'Storable, ignites on contact, toxic',
    examples: ['Apollo Service Module', 'Shuttle OMS'],
  },

  // Electric propulsion
  ion: {
    name: 'Ion (Xenon)',
    type: 'electric',
    specificImpulse: 3000,
    specificImpulseVacuum: 3000,
    exhaustVelocity: 29420,
    description: 'Very high Isp, very low thrust',
    examples: ['Dawn mission', 'Starlink satellites'],
  },
  hall: {
    name: 'Hall Effect Thruster',
    type: 'electric',
    specificImpulse: 1500,
    specificImpulseVacuum: 1500,
    exhaustVelocity: 14710,
    description: 'Moderate Isp, higher thrust than ion',
    examples: ['Starlink', 'Geostationary satellites'],
  },
  vasimr: {
    name: 'VASIMR',
    type: 'electric',
    specificImpulse: 5000,
    specificImpulseVacuum: 5000,
    exhaustVelocity: 49033,
    description: 'Variable specific impulse, experimental',
    examples: ['ISS testing'],
  },

  // Nuclear
  nerva: {
    name: 'Nuclear Thermal (NERVA-class)',
    type: 'nuclear',
    specificImpulse: 850,
    specificImpulseVacuum: 900,
    exhaustVelocity: 8829,
    description: 'Nuclear reactor heats hydrogen propellant',
    examples: ['NERVA (tested 1960s)'],
  },
  'nuclear-electric': {
    name: 'Nuclear Electric',
    type: 'nuclear',
    specificImpulse: 6000,
    specificImpulseVacuum: 6000,
    exhaustVelocity: 58840,
    description: 'Nuclear reactor powers electric thrusters',
    examples: ['Proposed Mars missions'],
  },

  // Theoretical
  antimatter: {
    name: 'Antimatter',
    type: 'theoretical',
    specificImpulse: 100000,
    specificImpulseVacuum: 100000,
    exhaustVelocity: 981000,
    description: 'Theoretical maximum energy density',
    examples: ['Conceptual only'],
  },
  fusion: {
    name: 'Fusion',
    type: 'theoretical',
    specificImpulse: 20000,
    specificImpulseVacuum: 20000,
    exhaustVelocity: 196133,
    description: 'Nuclear fusion propulsion',
    examples: ['Project Daedalus concept'],
  },
};

// ============================================================================
// TSIOLKOVSKY ROCKET EQUATION
// ============================================================================

/**
 * Tsiolkovsky rocket equation
 * Δv = ve × ln(m0/mf) = Isp × g0 × ln(m0/mf)
 */
function rocketEquation(exhaustVelocity: number, initialMass: number, finalMass: number): number {
  if (finalMass <= 0 || initialMass <= finalMass) {
    throw new Error('Invalid mass values');
  }
  return exhaustVelocity * Math.log(initialMass / finalMass);
}

/**
 * Calculate propellant mass from delta-v
 * mf = m0 × e^(-Δv/ve)
 * mp = m0 - mf
 */
export function propellantMass(
  deltaV: number,
  exhaustVelocity: number,
  initialMass: number
): number {
  const massRatio = Math.exp(deltaV / exhaustVelocity);
  const finalMass = initialMass / massRatio;
  return initialMass - finalMass;
}

/**
 * Calculate mass ratio from delta-v
 */
function massRatio(deltaV: number, exhaustVelocity: number): number {
  return Math.exp(deltaV / exhaustVelocity);
}

/**
 * Calculate required initial mass for given payload and delta-v
 */
export function requiredInitialMass(
  payloadMass: number,
  deltaV: number,
  exhaustVelocity: number,
  structuralFraction: number = 0.1
): { initialMass: number; propellantMass: number; structuralMass: number } {
  // For single stage: m0 = mf × e^(Δv/ve)
  // mf = payload + structure = payload + structuralFraction × propellant
  // This requires iterative solution

  const MR = Math.exp(deltaV / exhaustVelocity);

  // Simplified: assume structure is fraction of total propellant
  // m0 = payload + propellant + structure
  // mf = payload + structure
  // MR = m0/mf
  // propellant = m0 - mf = mf(MR - 1)
  // structure = sf × propellant = sf × mf × (MR - 1)
  // mf = payload + sf × mf × (MR - 1)
  // mf(1 - sf(MR-1)) = payload
  // mf = payload / (1 - sf(MR-1))

  const denominator = 1 - structuralFraction * (MR - 1);
  if (denominator <= 0) {
    throw new Error('Delta-v too high for given structural fraction - staging required');
  }

  const finalMass = payloadMass / denominator;
  const totalInitialMass = finalMass * MR;
  const propMass = totalInitialMass - finalMass;
  const structMass = structuralFraction * propMass;

  return {
    initialMass: totalInitialMass,
    propellantMass: propMass,
    structuralMass: structMass,
  };
}

// ============================================================================
// STAGING CALCULATIONS
// ============================================================================

interface Stage {
  propellantMass: number;
  structuralMass: number;
  deltaV: number;
  massRatio: number;
}

interface StagingResult {
  stages: Stage[];
  totalDeltaV: number;
  totalPropellantMass: number;
  totalStructuralMass: number;
  payloadFraction: number;
  grossLiftoffMass: number;
}

/**
 * Calculate optimal staging for given delta-v requirement
 * Uses equal delta-v per stage as starting point
 */
function calculateStaging(
  payloadMass: number,
  totalDeltaV: number,
  exhaustVelocity: number,
  numStages: number,
  structuralFraction: number = 0.1
): StagingResult {
  const stages: Stage[] = [];
  const deltaVPerStage = totalDeltaV / numStages;

  let currentPayload = payloadMass;

  // Work backwards from payload
  for (let i = 0; i < numStages; i++) {
    const MR = Math.exp(deltaVPerStage / exhaustVelocity);

    const denominator = 1 - structuralFraction * (MR - 1);
    if (denominator <= 0) {
      throw new Error(`Stage ${numStages - i}: Delta-v too high for structural fraction`);
    }

    const finalMass = currentPayload / denominator;
    const initialMass = finalMass * MR;
    const propMass = initialMass - finalMass;
    const structMass = structuralFraction * propMass;

    stages.unshift({
      propellantMass: propMass,
      structuralMass: structMass,
      deltaV: deltaVPerStage,
      massRatio: MR,
    });

    currentPayload = initialMass;
  }

  const grossMass = currentPayload;
  const totalPropellant = stages.reduce((sum, s) => sum + s.propellantMass, 0);
  const totalStructure = stages.reduce((sum, s) => sum + s.structuralMass, 0);

  return {
    stages,
    totalDeltaV,
    totalPropellantMass: totalPropellant,
    totalStructuralMass: totalStructure,
    payloadFraction: payloadMass / grossMass,
    grossLiftoffMass: grossMass,
  };
}

/**
 * Compare staging options
 */
function compareStagingOptions(
  payloadMass: number,
  deltaV: number,
  exhaustVelocity: number,
  structuralFraction: number = 0.1
): Array<{ stages: number; result: StagingResult | null; error?: string }> {
  const results: Array<{ stages: number; result: StagingResult | null; error?: string }> = [];

  for (let n = 1; n <= 5; n++) {
    try {
      const result = calculateStaging(payloadMass, deltaV, exhaustVelocity, n, structuralFraction);
      results.push({ stages: n, result });
    } catch (e) {
      results.push({
        stages: n,
        result: null,
        error: e instanceof Error ? e.message : 'Calculation failed',
      });
    }
  }

  return results;
}

// ============================================================================
// ORBITAL MECHANICS
// ============================================================================

interface OrbitalManeuver {
  name: string;
  deltaV: number;
  description: string;
}

/**
 * Common orbital delta-v requirements
 */
function getOrbitalDeltaV(): OrbitalManeuver[] {
  return [
    {
      name: 'Earth surface to LEO',
      deltaV: 9400,
      description: 'Low Earth Orbit (400km), includes gravity and drag losses',
    },
    {
      name: 'LEO to GTO',
      deltaV: 2440,
      description: 'Geostationary Transfer Orbit from 400km LEO',
    },
    {
      name: 'GTO to GEO',
      deltaV: 1470,
      description: 'Circularize at geostationary altitude',
    },
    {
      name: 'LEO to Moon transfer',
      deltaV: 3100,
      description: 'Trans-lunar injection from LEO',
    },
    {
      name: 'Moon orbit insertion',
      deltaV: 800,
      description: 'Capture into low lunar orbit',
    },
    {
      name: 'Moon landing',
      deltaV: 1700,
      description: 'Descent from low lunar orbit',
    },
    {
      name: 'Moon surface to orbit',
      deltaV: 1700,
      description: 'Ascent to low lunar orbit',
    },
    {
      name: 'LEO to Mars transfer',
      deltaV: 3600,
      description: 'Hohmann transfer to Mars',
    },
    {
      name: 'Mars orbit insertion',
      deltaV: 900,
      description: 'Capture into Mars orbit (with aerobraking assist)',
    },
    {
      name: 'Mars landing',
      deltaV: 1000,
      description: 'Descent with parachute + propulsive',
    },
    {
      name: 'Mars surface to orbit',
      deltaV: 4100,
      description: 'Ascent to low Mars orbit',
    },
    {
      name: 'Earth escape velocity',
      deltaV: 3200,
      description: 'From LEO to escape (C3 = 0)',
    },
    {
      name: 'LEO orbital change (100km)',
      deltaV: 50,
      description: 'Raise/lower orbit by 100km',
    },
    {
      name: 'LEO plane change (1°)',
      deltaV: 135,
      description: 'Per degree of inclination change at 7.8 km/s',
    },
  ];
}

/**
 * Calculate vis-viva orbital velocity
 */
export function orbitalVelocity(
  centralMass: number,
  semiMajorAxis: number,
  currentRadius: number
): number {
  return Math.sqrt(G * centralMass * (2 / currentRadius - 1 / semiMajorAxis));
}

/**
 * Calculate Hohmann transfer delta-v
 */
function hohmannTransfer(
  centralMass: number,
  r1: number,
  r2: number
): { deltaV1: number; deltaV2: number; totalDeltaV: number; transferTime: number } {
  const v1 = Math.sqrt((G * centralMass) / r1);
  const v2 = Math.sqrt((G * centralMass) / r2);

  const aTransfer = (r1 + r2) / 2;
  const vPeriapsis = Math.sqrt(G * centralMass * (2 / r1 - 1 / aTransfer));
  const vApoapsis = Math.sqrt(G * centralMass * (2 / r2 - 1 / aTransfer));

  const deltaV1 = Math.abs(vPeriapsis - v1);
  const deltaV2 = Math.abs(v2 - vApoapsis);

  const transferTime = Math.PI * Math.sqrt(Math.pow(aTransfer, 3) / (G * centralMass));

  return {
    deltaV1,
    deltaV2,
    totalDeltaV: deltaV1 + deltaV2,
    transferTime,
  };
}

// ============================================================================
// TOOL INTERFACE
// ============================================================================

export const rocketequationTool: UnifiedTool = {
  name: 'rocket_equation',
  description:
    'Tsiolkovsky rocket equation and spacecraft propulsion - delta-v, mass ratios, staging optimization, and orbital mechanics',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'delta_v',
          'mass_ratio',
          'staging',
          'propellant',
          'orbital',
          'hohmann',
          'compare',
          'info',
        ],
        description:
          'Operation: delta_v (calculate Δv), mass_ratio (calculate ratios), staging (optimize stages), propellant (list propellants), orbital (common maneuvers), hohmann (transfer orbit), compare (compare staging options), info (documentation)',
      },
      exhaust_velocity: {
        type: 'number',
        description: 'Exhaust velocity in m/s (or use isp with g0=9.81)',
      },
      specific_impulse: {
        type: 'number',
        description: 'Specific impulse in seconds',
      },
      initial_mass: {
        type: 'number',
        description: 'Initial mass in kg',
      },
      final_mass: {
        type: 'number',
        description: 'Final mass in kg (after propellant burn)',
      },
      payload_mass: {
        type: 'number',
        description: 'Payload mass in kg',
      },
      delta_v: {
        type: 'number',
        description: 'Required delta-v in m/s',
      },
      num_stages: {
        type: 'number',
        description: 'Number of rocket stages',
      },
      structural_fraction: {
        type: 'number',
        description: 'Structural mass as fraction of propellant (default 0.1)',
      },
      propellant_type: {
        type: 'string',
        description: 'Propellant type (solid, lox-rp1, lox-lh2, etc.)',
      },
      orbit_radius_1: {
        type: 'number',
        description: 'Initial orbit radius in meters',
      },
      orbit_radius_2: {
        type: 'number',
        description: 'Final orbit radius in meters',
      },
    },
    required: ['operation'],
  },
};

export async function executerocketequation(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation as string;

    // Get exhaust velocity from either direct value or Isp
    const getExhaustVelocity = (): number => {
      if (args.exhaust_velocity) return args.exhaust_velocity;
      if (args.specific_impulse) return args.specific_impulse * EARTH_GRAVITY;
      if (args.propellant_type && PROPELLANTS[args.propellant_type]) {
        return PROPELLANTS[args.propellant_type].exhaustVelocity;
      }
      return 3000; // Default (roughly RP-1)
    };

    switch (operation) {
      case 'delta_v': {
        const ve = getExhaustVelocity();
        const m0 = args.initial_mass;
        const mf = args.final_mass;

        if (!m0 || !mf) {
          return {
            toolCallId: id,
            content: JSON.stringify(
              {
                error: 'Both initial_mass and final_mass are required',
                formula: 'Δv = ve × ln(m0/mf)',
                example: { initial_mass: 1000, final_mass: 200, exhaust_velocity: 3000 },
              },
              null,
              2
            ),
            isError: true,
          };
        }

        const deltaV = rocketEquation(ve, m0, mf);
        const MR = m0 / mf;
        const propMass = m0 - mf;

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'delta_v',
              inputs: {
                initialMass: m0 + ' kg',
                finalMass: mf + ' kg',
                exhaustVelocity: ve + ' m/s',
                specificImpulse: (ve / EARTH_GRAVITY).toFixed(1) + ' s',
              },
              results: {
                deltaV: deltaV.toFixed(1) + ' m/s',
                deltaVKmS: (deltaV / 1000).toFixed(3) + ' km/s',
                massRatio: MR.toFixed(3),
                propellantMass: propMass.toFixed(1) + ' kg',
                propellantFraction: ((propMass / m0) * 100).toFixed(1) + '%',
              },
              formula: 'Δv = ve × ln(m0/mf)',
            },
            null,
            2
          ),
        };
      }

      case 'mass_ratio': {
        const ve = getExhaustVelocity();
        const deltaV = args.delta_v;

        if (!deltaV) {
          return {
            toolCallId: id,
            content: JSON.stringify(
              {
                error: 'delta_v is required',
                formula: 'MR = e^(Δv/ve)',
                example: { delta_v: 9400, exhaust_velocity: 3000 },
              },
              null,
              2
            ),
            isError: true,
          };
        }

        const MR = massRatio(deltaV, ve);
        const propellantFraction = 1 - 1 / MR;

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'mass_ratio',
              inputs: {
                deltaV: deltaV + ' m/s',
                exhaustVelocity: ve + ' m/s',
                specificImpulse: (ve / EARTH_GRAVITY).toFixed(1) + ' s',
              },
              results: {
                massRatio: MR.toFixed(4),
                propellantFraction: (propellantFraction * 100).toFixed(2) + '%',
                payloadFraction: ((1 / MR) * 100).toFixed(4) + '%',
                interpretation: `For every 1 kg of final mass, need ${MR.toFixed(2)} kg initial mass`,
              },
              formula: 'MR = e^(Δv/ve)',
            },
            null,
            2
          ),
        };
      }

      case 'staging': {
        const ve = getExhaustVelocity();
        const payload = args.payload_mass || 1000;
        const deltaV = args.delta_v || 9400;
        const stages = args.num_stages || 2;
        const sf = args.structural_fraction || 0.1;

        try {
          const result = calculateStaging(payload, deltaV, ve, stages, sf);

          return {
            toolCallId: id,
            content: JSON.stringify(
              {
                operation: 'staging',
                inputs: {
                  payloadMass: payload + ' kg',
                  totalDeltaV: deltaV + ' m/s',
                  exhaustVelocity: ve + ' m/s',
                  numStages: stages,
                  structuralFraction: sf,
                },
                results: {
                  grossLiftoffMass: result.grossLiftoffMass.toFixed(1) + ' kg',
                  totalPropellantMass: result.totalPropellantMass.toFixed(1) + ' kg',
                  totalStructuralMass: result.totalStructuralMass.toFixed(1) + ' kg',
                  payloadFraction: (result.payloadFraction * 100).toFixed(4) + '%',
                  stages: result.stages.map((s, i) => ({
                    stage: i + 1,
                    propellantMass: s.propellantMass.toFixed(1) + ' kg',
                    structuralMass: s.structuralMass.toFixed(1) + ' kg',
                    deltaV: s.deltaV.toFixed(1) + ' m/s',
                    massRatio: s.massRatio.toFixed(3),
                  })),
                },
              },
              null,
              2
            ),
          };
        } catch (e) {
          return {
            toolCallId: id,
            content: JSON.stringify(
              {
                error: e instanceof Error ? e.message : 'Staging calculation failed',
                suggestion: 'Try more stages or higher Isp propellant',
              },
              null,
              2
            ),
            isError: true,
          };
        }
      }

      case 'propellant': {
        const propType = args.propellant_type;

        if (propType && PROPELLANTS[propType]) {
          return {
            toolCallId: id,
            content: JSON.stringify(
              {
                operation: 'propellant',
                data: PROPELLANTS[propType],
              },
              null,
              2
            ),
          };
        }

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'propellant',
              propellants: Object.entries(PROPELLANTS).map(([key, p]) => ({
                id: key,
                name: p.name,
                type: p.type,
                specificImpulseVacuum: p.specificImpulseVacuum + ' s',
                exhaustVelocity: p.exhaustVelocity + ' m/s',
              })),
            },
            null,
            2
          ),
        };
      }

      case 'orbital': {
        const maneuvers = getOrbitalDeltaV();

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'orbital',
              maneuvers: maneuvers.map((m) => ({
                ...m,
                deltaV: m.deltaV + ' m/s',
                deltaVKmS: (m.deltaV / 1000).toFixed(2) + ' km/s',
              })),
              missionTotals: {
                earthToLEO: '9,400 m/s',
                earthToMoon: '~15,000 m/s round trip',
                earthToMars: '~18,000 m/s one way',
              },
            },
            null,
            2
          ),
        };
      }

      case 'hohmann': {
        const r1 = args.orbit_radius_1 || EARTH_RADIUS + 400000;
        const r2 = args.orbit_radius_2 || EARTH_RADIUS + 35786000;

        const transfer = hohmannTransfer(EARTH_MASS, r1, r2);

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'hohmann',
              inputs: {
                initialOrbitRadius: (r1 / 1000).toFixed(0) + ' km',
                finalOrbitRadius: (r2 / 1000).toFixed(0) + ' km',
                initialAltitude: ((r1 - EARTH_RADIUS) / 1000).toFixed(0) + ' km',
                finalAltitude: ((r2 - EARTH_RADIUS) / 1000).toFixed(0) + ' km',
              },
              results: {
                deltaV1: transfer.deltaV1.toFixed(1) + ' m/s (at periapsis)',
                deltaV2: transfer.deltaV2.toFixed(1) + ' m/s (at apoapsis)',
                totalDeltaV: transfer.totalDeltaV.toFixed(1) + ' m/s',
                transferTime: (transfer.transferTime / 3600).toFixed(2) + ' hours',
                transferTimeDays: (transfer.transferTime / 86400).toFixed(3) + ' days',
              },
              description:
                'Hohmann transfer is the most fuel-efficient two-impulse transfer between circular orbits',
            },
            null,
            2
          ),
        };
      }

      case 'compare': {
        const ve = getExhaustVelocity();
        const payload = args.payload_mass || 1000;
        const deltaV = args.delta_v || 9400;
        const sf = args.structural_fraction || 0.1;

        const comparison = compareStagingOptions(payload, deltaV, ve, sf);

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'compare',
              inputs: {
                payloadMass: payload + ' kg',
                deltaV: deltaV + ' m/s',
                exhaustVelocity: ve + ' m/s',
                structuralFraction: sf,
              },
              comparison: comparison.map((c) => {
                if (c.error) {
                  return { stages: c.stages, error: c.error };
                }
                const r = c.result!;
                return {
                  stages: c.stages,
                  grossMass: r.grossLiftoffMass.toFixed(0) + ' kg',
                  propellantMass: r.totalPropellantMass.toFixed(0) + ' kg',
                  payloadFraction: (r.payloadFraction * 100).toFixed(4) + '%',
                };
              }),
              recommendation: comparison.find((c) => c.result)
                ? 'More stages generally improve payload fraction but add complexity'
                : 'Delta-v too high for given propellant - use higher Isp or more stages',
            },
            null,
            2
          ),
        };
      }

      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              tool: 'Rocket Equation',
              description: 'Tsiolkovsky rocket equation and spacecraft propulsion calculations',

              equation: {
                form1: 'Δv = ve × ln(m0/mf)',
                form2: 'Δv = Isp × g0 × ln(m0/mf)',
                variables: {
                  Δv: 'Change in velocity (m/s)',
                  ve: 'Exhaust velocity (m/s)',
                  Isp: 'Specific impulse (seconds)',
                  g0: 'Standard gravity (9.81 m/s²)',
                  m0: 'Initial mass (kg)',
                  mf: 'Final mass (kg)',
                },
              },

              operations: [
                'delta_v: Calculate Δv from masses',
                'mass_ratio: Calculate mass ratio from Δv',
                'staging: Optimize multi-stage rocket',
                'propellant: Propellant database',
                'orbital: Common orbital maneuver Δv',
                'hohmann: Calculate Hohmann transfer',
                'compare: Compare staging options',
                'info: This documentation',
              ],

              keyInsights: [
                'Mass ratio grows exponentially with Δv',
                'Higher Isp = less propellant needed',
                'Staging overcomes tyranny of rocket equation',
                'Chemical rockets limited to ~4.5 km/s exhaust',
              ],

              examples: [
                {
                  operation: 'delta_v',
                  initial_mass: 1000,
                  final_mass: 200,
                  exhaust_velocity: 3000,
                },
                {
                  operation: 'staging',
                  payload_mass: 5000,
                  delta_v: 9400,
                  num_stages: 2,
                  propellant_type: 'lox-rp1',
                },
                { operation: 'hohmann', orbit_radius_1: 6771000, orbit_radius_2: 42164000 },
              ],
            },
            null,
            2
          ),
        };
      }

      default:
        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              error: `Unknown operation: ${operation}`,
              validOperations: [
                'delta_v',
                'mass_ratio',
                'staging',
                'propellant',
                'orbital',
                'hohmann',
                'compare',
                'info',
              ],
            },
            null,
            2
          ),
          isError: true,
        };
    }
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    return {
      toolCallId: id,
      content: `Error in rocket equation: ${errorMessage}`,
      isError: true,
    };
  }
}

export function isrocketequationAvailable(): boolean {
  return true;
}
