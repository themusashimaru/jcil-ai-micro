/**
 * NUCLEAR-REACTOR TOOL
 * Nuclear reactor physics calculations
 * Criticality, neutron diffusion, fuel burnup, and decay heat
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// CONSTANTS
// ============================================================================

const AVOGADRO = 6.02214076e23; // mol^-1
const BARN_TO_M2 = 1e-28; // 1 barn = 10^-28 m²
const MEV_TO_JOULES = 1.60218e-13;

// Neutron energy groups (simplified two-group)
const THERMAL_ENERGY = 0.025; // eV (at room temperature)
const FAST_ENERGY = 2e6; // eV (2 MeV typical fission neutron)

// ============================================================================
// REACTOR TYPES DATABASE
// ============================================================================

interface ReactorType {
  name: string;
  fullName: string;
  moderator: string;
  coolant: string;
  fuel: string;
  enrichment: string;
  typicalPower: string;
  neutronSpectrum: 'thermal' | 'fast';
  description: string;
  thermalEfficiency: number;
  advantages: string[];
  disadvantages: string[];
}

const REACTOR_TYPES: Record<string, ReactorType> = {
  PWR: {
    name: 'PWR',
    fullName: 'Pressurized Water Reactor',
    moderator: 'Light water (H2O)',
    coolant: 'Light water (H2O) under pressure',
    fuel: 'UO2 pellets in zircaloy cladding',
    enrichment: '3-5% U-235',
    typicalPower: '900-1400 MWe',
    neutronSpectrum: 'thermal',
    description: 'Most common reactor type worldwide (~65%)',
    thermalEfficiency: 0.33,
    advantages: ['Proven technology', 'High power density', 'Negative void coefficient'],
    disadvantages: ['High pressure system', 'Requires enriched uranium', 'Complex steam generators']
  },
  BWR: {
    name: 'BWR',
    fullName: 'Boiling Water Reactor',
    moderator: 'Light water (H2O)',
    coolant: 'Light water (H2O) - boils in core',
    fuel: 'UO2 pellets in zircaloy cladding',
    enrichment: '3-5% U-235',
    typicalPower: '700-1400 MWe',
    neutronSpectrum: 'thermal',
    description: 'Second most common type (~20%)',
    thermalEfficiency: 0.33,
    advantages: ['Simpler design (no steam generators)', 'Lower pressure', 'Direct cycle'],
    disadvantages: ['Radioactive steam in turbine', 'Lower power density than PWR']
  },
  CANDU: {
    name: 'CANDU',
    fullName: 'Canada Deuterium Uranium',
    moderator: 'Heavy water (D2O)',
    coolant: 'Heavy water (D2O)',
    fuel: 'UO2 in zircaloy',
    enrichment: 'Natural uranium (0.7% U-235)',
    typicalPower: '600-900 MWe',
    neutronSpectrum: 'thermal',
    description: 'Canadian design using natural uranium',
    thermalEfficiency: 0.29,
    advantages: ['Uses natural uranium', 'Online refueling', 'Good neutron economy'],
    disadvantages: ['Expensive heavy water', 'Large size', 'Positive void coefficient']
  },
  MSR: {
    name: 'MSR',
    fullName: 'Molten Salt Reactor',
    moderator: 'Graphite (or none for fast spectrum)',
    coolant: 'Molten fluoride salt',
    fuel: 'UF4 or ThF4 dissolved in salt',
    enrichment: 'Varies (LEU to HEU, or Th/U-233)',
    typicalPower: '100-1000 MWe (designs vary)',
    neutronSpectrum: 'thermal',
    description: 'Advanced design with liquid fuel',
    thermalEfficiency: 0.45,
    advantages: ['No fuel fabrication', 'High temperature', 'Passive safety', 'Can breed Th-232'],
    disadvantages: ['Corrosive salts', 'Limited operational experience', 'Regulatory challenges']
  },
  HTGR: {
    name: 'HTGR',
    fullName: 'High Temperature Gas-cooled Reactor',
    moderator: 'Graphite',
    coolant: 'Helium gas',
    fuel: 'TRISO particles in graphite',
    enrichment: '8-20% U-235',
    typicalPower: '200-600 MWe',
    neutronSpectrum: 'thermal',
    description: 'High efficiency, inherently safe design',
    thermalEfficiency: 0.48,
    advantages: ['Very high temperature', 'Inherent safety', 'Process heat applications'],
    disadvantages: ['Low power density', 'High enrichment', 'Graphite dust issues']
  },
  SFR: {
    name: 'SFR',
    fullName: 'Sodium-cooled Fast Reactor',
    moderator: 'None (fast spectrum)',
    coolant: 'Liquid sodium',
    fuel: 'Mixed oxide (MOX) or metallic',
    enrichment: '15-20% Pu-239 or HEU',
    typicalPower: '300-1500 MWe',
    neutronSpectrum: 'fast',
    description: 'Breeder reactor using fast neutrons',
    thermalEfficiency: 0.42,
    advantages: ['Breeds fuel', 'Burns actinides', 'High efficiency'],
    disadvantages: ['Sodium fires', 'Positive void coefficient', 'Complex']
  }
};

// ============================================================================
// NUCLEAR DATA
// ============================================================================

interface Nuclide {
  name: string;
  Z: number;
  A: number;
  halfLife?: number; // seconds (undefined = stable)
  sigmaFission: number; // barns (thermal)
  sigmaCapture: number; // barns (thermal)
  sigmaScatter: number; // barns (thermal)
  nubar: number; // average neutrons per fission
  fissionEnergy: number; // MeV
  isFissile: boolean;
  isFertile: boolean;
}

const NUCLIDES: Record<string, Nuclide> = {
  'U-235': {
    name: 'Uranium-235',
    Z: 92, A: 235,
    halfLife: 7.04e8 * 3.156e7, // 704 million years in seconds
    sigmaFission: 585,
    sigmaCapture: 99,
    sigmaScatter: 15,
    nubar: 2.43,
    fissionEnergy: 202.5,
    isFissile: true,
    isFertile: false
  },
  'U-238': {
    name: 'Uranium-238',
    Z: 92, A: 238,
    halfLife: 4.47e9 * 3.156e7,
    sigmaFission: 0.00003, // threshold fission only
    sigmaCapture: 2.68,
    sigmaScatter: 9,
    nubar: 2.6,
    fissionEnergy: 198,
    isFissile: false,
    isFertile: true
  },
  'Pu-239': {
    name: 'Plutonium-239',
    Z: 94, A: 239,
    halfLife: 24110 * 3.156e7,
    sigmaFission: 748,
    sigmaCapture: 271,
    sigmaScatter: 8,
    nubar: 2.88,
    fissionEnergy: 207.1,
    isFissile: true,
    isFertile: false
  },
  'Pu-240': {
    name: 'Plutonium-240',
    Z: 94, A: 240,
    halfLife: 6563 * 3.156e7,
    sigmaFission: 0.059,
    sigmaCapture: 290,
    sigmaScatter: 1.5,
    nubar: 2.8,
    fissionEnergy: 200,
    isFissile: false,
    isFertile: true
  },
  'Pu-241': {
    name: 'Plutonium-241',
    Z: 94, A: 241,
    halfLife: 14.3 * 3.156e7,
    sigmaFission: 1012,
    sigmaCapture: 361,
    sigmaScatter: 10,
    nubar: 2.95,
    fissionEnergy: 210,
    isFissile: true,
    isFertile: false
  },
  'Th-232': {
    name: 'Thorium-232',
    Z: 90, A: 232,
    halfLife: 1.41e10 * 3.156e7,
    sigmaFission: 0.00001,
    sigmaCapture: 7.4,
    sigmaScatter: 13,
    nubar: 2.14,
    fissionEnergy: 190,
    isFissile: false,
    isFertile: true
  },
  'U-233': {
    name: 'Uranium-233',
    Z: 92, A: 233,
    halfLife: 1.59e5 * 3.156e7,
    sigmaFission: 531,
    sigmaCapture: 46,
    sigmaScatter: 12,
    nubar: 2.49,
    fissionEnergy: 200,
    isFissile: true,
    isFertile: false
  }
};

// ============================================================================
// NEUTRON PHYSICS CALCULATIONS
// ============================================================================

/**
 * Four-factor formula for infinite multiplication factor
 * k∞ = η × ε × p × f
 */
interface FourFactors {
  eta: number;      // Reproduction factor
  epsilon: number;  // Fast fission factor
  p: number;        // Resonance escape probability
  f: number;        // Thermal utilization
  kInf: number;     // Infinite multiplication factor
}

function calculateFourFactors(
  enrichment: number, // fraction of U-235
  moderatorRatio: number, // moderator atoms per fuel atom
  temperature: number = 600 // Kelvin
): FourFactors {
  const u235 = NUCLIDES['U-235'];
  const u238 = NUCLIDES['U-238'];

  // Simplified calculations (real reactor physics is much more complex)

  // η = ν × σf / (σf + σc) for the fissile isotope
  const sigmaF235 = u235.sigmaFission;
  const sigmaC235 = u235.sigmaCapture;
  const eta = u235.nubar * sigmaF235 / (sigmaF235 + sigmaC235);

  // ε - fast fission factor (slight increase due to U-238 fast fission)
  const epsilon = 1.0 + 0.02 * (1 - enrichment); // ~1.02-1.03 for LEU

  // p - resonance escape probability (depends on moderator ratio)
  // Simplified: p ≈ exp(-N238 * I238 / ξΣs)
  // Higher moderator ratio = better thermalization = higher p
  const p = 1 - 0.05 / Math.sqrt(moderatorRatio / 50); // Approximate

  // f - thermal utilization
  // f = Σa_fuel / (Σa_fuel + Σa_mod + Σa_struct)
  const sigmaAFuel = enrichment * (sigmaF235 + sigmaC235) + (1 - enrichment) * u238.sigmaCapture;
  const sigmaAMod = 0.3 / moderatorRatio; // Water absorption
  const f = sigmaAFuel / (sigmaAFuel + sigmaAMod);

  const kInf = eta * epsilon * p * f;

  return { eta, epsilon, p, f, kInf };
}

/**
 * Calculate effective multiplication factor with geometry
 * keff = k∞ × PNL where PNL = non-leakage probability
 */
function calculateKeff(
  kInf: number,
  buckling: number, // geometric buckling B² (m^-2)
  migrationArea: number // M² (m²)
): { keff: number; pnl: number; reactivity: number } {
  // Non-leakage probability: PNL = 1 / (1 + M²B²)
  const pnl = 1 / (1 + migrationArea * buckling);
  const keff = kInf * pnl;
  const reactivity = (keff - 1) / keff;

  return { keff, pnl, reactivity };
}

/**
 * Calculate geometric buckling for common shapes
 */
function geometricBuckling(
  shape: 'sphere' | 'cylinder' | 'slab',
  dimensions: { radius?: number; height?: number; thickness?: number }
): number {
  switch (shape) {
    case 'sphere':
      const R = dimensions.radius || 1;
      return Math.pow(Math.PI / R, 2);
    case 'cylinder':
      const Rc = dimensions.radius || 1;
      const H = dimensions.height || 2;
      return Math.pow(2.405 / Rc, 2) + Math.pow(Math.PI / H, 2);
    case 'slab':
      const a = dimensions.thickness || 1;
      return Math.pow(Math.PI / a, 2);
    default:
      return 0;
  }
}

/**
 * Critical mass calculation (simplified)
 */
function estimateCriticalMass(
  nuclide: string,
  moderator: 'none' | 'water' | 'graphite' | 'heavy_water'
): { mass: number; radius: number; note: string } {
  const data = NUCLIDES[nuclide];
  if (!data || !data.isFissile) {
    throw new Error(`${nuclide} is not a fissile material`);
  }

  // These are approximate values for sphere geometry
  let baseMass: number;
  let baseRadius: number;

  switch (nuclide) {
    case 'U-235':
      baseMass = moderator === 'none' ? 52 : 0.8; // kg
      baseRadius = moderator === 'none' ? 8.5 : 4; // cm
      break;
    case 'Pu-239':
      baseMass = moderator === 'none' ? 10 : 0.5;
      baseRadius = moderator === 'none' ? 5 : 3;
      break;
    case 'U-233':
      baseMass = moderator === 'none' ? 15 : 0.6;
      baseRadius = moderator === 'none' ? 5.5 : 3.5;
      break;
    default:
      baseMass = 50;
      baseRadius = 10;
  }

  return {
    mass: baseMass,
    radius: baseRadius,
    note: moderator === 'none'
      ? 'Bare sphere critical mass'
      : `With ${moderator} moderator/reflector`
  };
}

// ============================================================================
// FUEL BURNUP
// ============================================================================

interface BurnupState {
  time: number; // days
  burnup: number; // MWd/kg
  u235: number; // fraction remaining
  pu239: number; // fraction built up
  fissionProducts: number; // fraction
  keff: number;
}

function simulateBurnup(
  initialEnrichment: number,
  powerDensity: number, // MW/kg heavy metal
  totalDays: number,
  steps: number = 20
): BurnupState[] {
  const states: BurnupState[] = [];
  const dt = totalDays / steps;

  let u235 = initialEnrichment;
  let u238 = 1 - initialEnrichment;
  let pu239 = 0;
  let fissionProducts = 0;

  // Simplified depletion model
  const u235FissionRate = 0.001 * powerDensity; // per day
  const u238CaptureRate = 0.0002 * powerDensity; // per day
  const pu239BuildupRate = u238CaptureRate * 0.9; // ~90% goes to Pu-239
  const pu239FissionRate = 0.0008 * powerDensity; // per day

  for (let i = 0; i <= steps; i++) {
    const time = i * dt;
    const burnup = powerDensity * time;

    // Estimate keff (simplified)
    const effectiveEnrich = u235 + 1.3 * pu239; // Pu-239 worth ~1.3x U-235
    const factors = calculateFourFactors(effectiveEnrich, 100);

    states.push({
      time,
      burnup,
      u235,
      pu239,
      fissionProducts,
      keff: factors.kInf * 0.97 // Account for some leakage
    });

    // Update isotopics
    const u235Consumed = u235 * u235FissionRate * dt;
    const u238Captured = u238 * u238CaptureRate * dt;
    const pu239Produced = u238Captured * pu239BuildupRate;
    const pu239Fissioned = pu239 * pu239FissionRate * dt;

    u235 -= u235Consumed;
    u238 -= u238Captured;
    pu239 += pu239Produced - pu239Fissioned;
    fissionProducts += u235Consumed + pu239Fissioned;
  }

  return states;
}

// ============================================================================
// DECAY HEAT
// ============================================================================

/**
 * ANS decay heat standard (simplified)
 * P(t)/P0 = decay heat fraction at time t after shutdown
 */
function decayHeatFraction(
  timeAfterShutdown: number, // seconds
  operatingTime: number // seconds
): number {
  // ANS-5.1 simplified fit
  // P/P0 = 0.066 × (t^-0.2 - (t+T)^-0.2)
  // where t is time after shutdown, T is operating time

  const t = Math.max(timeAfterShutdown, 1); // Avoid division issues
  const T = operatingTime;

  const fraction = 0.066 * (Math.pow(t, -0.2) - Math.pow(t + T, -0.2));

  return Math.max(fraction, 0);
}

/**
 * Calculate decay heat power over time
 */
function decayHeatProfile(
  operatingPower: number, // MW
  operatingTime: number, // hours
  profileDuration: number, // hours
  steps: number = 20
): Array<{ time: number; power: number; fraction: number }> {
  const results: Array<{ time: number; power: number; fraction: number }> = [];
  const opTimeSeconds = operatingTime * 3600;
  const dt = profileDuration / steps;

  for (let i = 0; i <= steps; i++) {
    const timeHours = i * dt;
    const timeSeconds = timeHours * 3600;
    const fraction = decayHeatFraction(timeSeconds, opTimeSeconds);
    const power = operatingPower * fraction;

    results.push({
      time: timeHours,
      power,
      fraction
    });
  }

  return results;
}

// ============================================================================
// NEUTRON FLUX
// ============================================================================

/**
 * Calculate thermal neutron flux from power
 */
function thermalFluxFromPower(
  thermalPower: number, // MW
  fuelMass: number, // kg of fissile material
  sigmaFission: number = 585, // barns (U-235 default)
  energyPerFission: number = 200 // MeV
): number {
  // P = Φ × Σf × Ef × V
  // Φ = P / (N × σf × Ef)

  const powerWatts = thermalPower * 1e6;
  const energyJoules = energyPerFission * MEV_TO_JOULES;

  // Number density (atoms/m³) assuming UO2
  const atomsPerKg = AVOGADRO / 0.235; // for U-235
  const totalAtoms = fuelMass * atomsPerKg;

  const sigmaM2 = sigmaFission * BARN_TO_M2;

  // Flux = P / (N × σf × Ef)
  const flux = powerWatts / (totalAtoms * sigmaM2 * energyJoules);

  return flux; // n/(cm²·s) equivalent
}

// ============================================================================
// TOOL INTERFACE
// ============================================================================

export const nuclearreactorTool: UnifiedTool = {
  name: 'nuclear_reactor',
  description: 'Nuclear reactor physics - criticality, neutron diffusion, fuel burnup, decay heat, and reactor types',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['criticality', 'neutron_flux', 'burnup', 'decay_heat', 'four_factor', 'critical_mass', 'reactor_type', 'nuclide', 'info'],
        description: 'Operation type'
      },
      reactor_type: {
        type: 'string',
        enum: ['PWR', 'BWR', 'CANDU', 'MSR', 'HTGR', 'SFR'],
        description: 'Reactor type'
      },
      enrichment: {
        type: 'number',
        description: 'U-235 enrichment as decimal (e.g., 0.04 for 4%)'
      },
      moderator_ratio: {
        type: 'number',
        description: 'Moderator atoms per fuel atom'
      },
      power: {
        type: 'number',
        description: 'Thermal power in MW'
      },
      operating_time: {
        type: 'number',
        description: 'Operating time in hours'
      },
      fuel_mass: {
        type: 'number',
        description: 'Fuel mass in kg'
      },
      nuclide: {
        type: 'string',
        description: 'Nuclide identifier (e.g., "U-235", "Pu-239")'
      },
      geometry: {
        type: 'string',
        enum: ['sphere', 'cylinder', 'slab'],
        description: 'Reactor geometry'
      },
      dimensions: {
        type: 'object',
        description: 'Geometry dimensions (radius, height, thickness in meters)'
      }
    },
    required: ['operation']
  }
};

export async function executenuclearreactor(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation as string;

    switch (operation) {
      case 'criticality': {
        const enrichment = args.enrichment || 0.04;
        const modRatio = args.moderator_ratio || 100;
        const geometry = args.geometry || 'cylinder';
        const dimensions = args.dimensions || { radius: 1.5, height: 3 };

        const factors = calculateFourFactors(enrichment, modRatio);
        const buckling = geometricBuckling(geometry, dimensions);
        const migrationArea = 50e-4; // ~50 cm² typical for water-moderated
        const keffResult = calculateKeff(factors.kInf, buckling, migrationArea);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'criticality',
            inputs: {
              enrichment: (enrichment * 100).toFixed(2) + '% U-235',
              moderatorRatio: modRatio,
              geometry,
              dimensions
            },
            fourFactors: {
              eta: factors.eta.toFixed(4) + ' (reproduction factor)',
              epsilon: factors.epsilon.toFixed(4) + ' (fast fission)',
              p: factors.p.toFixed(4) + ' (resonance escape)',
              f: factors.f.toFixed(4) + ' (thermal utilization)',
              kInf: factors.kInf.toFixed(5)
            },
            effectiveMultiplication: {
              geometricBuckling: buckling.toFixed(4) + ' m⁻²',
              migrationArea: migrationArea.toExponential(2) + ' m²',
              nonLeakageProbability: keffResult.pnl.toFixed(4),
              keff: keffResult.keff.toFixed(5),
              reactivity: (keffResult.reactivity * 1e5).toFixed(1) + ' pcm'
            },
            criticalityStatus: keffResult.keff > 1.0005 ? 'SUPERCRITICAL' :
                              keffResult.keff < 0.9995 ? 'SUBCRITICAL' : 'CRITICAL',
            note: 'Simplified calculation - real reactor analysis requires transport codes'
          }, null, 2)
        };
      }

      case 'neutron_flux': {
        const power = args.power || 3000;
        const fuelMass = args.fuel_mass || 100000;

        const flux = thermalFluxFromPower(power, fuelMass);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'neutron_flux',
            inputs: {
              thermalPower: power + ' MWth',
              fuelMass: fuelMass + ' kg'
            },
            results: {
              thermalNeutronFlux: flux.toExponential(3) + ' n/(cm²·s)',
              fluxLevel: flux > 1e14 ? 'High flux' : flux > 1e13 ? 'Moderate flux' : 'Low flux'
            },
            typicalValues: {
              PWR: '~3×10¹³ n/(cm²·s)',
              researchReactor: '~10¹⁴ n/(cm²·s)',
              materialTestReactor: '~10¹⁵ n/(cm²·s)'
            }
          }, null, 2)
        };
      }

      case 'burnup': {
        const enrichment = args.enrichment || 0.04;
        const powerDensity = args.power ? args.power / (args.fuel_mass || 100000) : 0.03;
        const days = args.operating_time ? args.operating_time / 24 : 1000;

        const profile = simulateBurnup(enrichment, powerDensity, days);

        // Select key points
        const summary = [
          profile[0],
          profile[Math.floor(profile.length / 4)],
          profile[Math.floor(profile.length / 2)],
          profile[Math.floor(3 * profile.length / 4)],
          profile[profile.length - 1]
        ].map(s => ({
          day: s.time.toFixed(0),
          burnup: s.burnup.toFixed(1) + ' MWd/kg',
          u235: (s.u235 * 100).toFixed(2) + '%',
          pu239: (s.pu239 * 100).toFixed(3) + '%',
          keff: s.keff.toFixed(4)
        }));

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'burnup',
            inputs: {
              initialEnrichment: (enrichment * 100).toFixed(2) + '% U-235',
              powerDensity: (powerDensity * 1000).toFixed(1) + ' kW/kg',
              totalTime: days.toFixed(0) + ' days'
            },
            evolutionSummary: summary,
            finalState: {
              burnup: profile[profile.length - 1].burnup.toFixed(1) + ' MWd/kg',
              u235Remaining: (profile[profile.length - 1].u235 / enrichment * 100).toFixed(1) + '% of initial',
              pu239Buildup: (profile[profile.length - 1].pu239 * 100).toFixed(3) + '%',
              estimatedKeff: profile[profile.length - 1].keff.toFixed(4)
            },
            note: 'Simplified depletion model - real calculations use ORIGEN or similar codes'
          }, null, 2)
        };
      }

      case 'decay_heat': {
        const power = args.power || 3000;
        const opTime = args.operating_time || 8760; // 1 year default
        const duration = 24; // 24 hours profile

        const profile = decayHeatProfile(power, opTime, duration);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'decay_heat',
            inputs: {
              operatingPower: power + ' MWth',
              operatingTime: opTime + ' hours (' + (opTime / 8760).toFixed(2) + ' years)'
            },
            decayHeatProfile: profile.map(p => ({
              timeAfterShutdown: p.time.toFixed(2) + ' hours',
              decayPower: p.power.toFixed(2) + ' MW',
              fractionOfOperatingPower: (p.fraction * 100).toFixed(3) + '%'
            })),
            keyPoints: {
              at1Second: (decayHeatFraction(1, opTime * 3600) * 100).toFixed(2) + '%',
              at1Minute: (decayHeatFraction(60, opTime * 3600) * 100).toFixed(2) + '%',
              at1Hour: (decayHeatFraction(3600, opTime * 3600) * 100).toFixed(2) + '%',
              at1Day: (decayHeatFraction(86400, opTime * 3600) * 100).toFixed(2) + '%'
            },
            safetyNote: 'Decay heat must be removed even after shutdown - failure leads to meltdown'
          }, null, 2)
        };
      }

      case 'four_factor': {
        const enrichment = args.enrichment || 0.04;
        const modRatio = args.moderator_ratio || 100;

        const factors = calculateFourFactors(enrichment, modRatio);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'four_factor',
            formula: 'k∞ = η × ε × p × f',
            inputs: {
              enrichment: (enrichment * 100).toFixed(2) + '% U-235',
              moderatorRatio: modRatio
            },
            factors: {
              eta: {
                value: factors.eta.toFixed(4),
                name: 'Reproduction factor',
                description: 'Neutrons produced per absorption in fuel'
              },
              epsilon: {
                value: factors.epsilon.toFixed(4),
                name: 'Fast fission factor',
                description: 'Ratio of total fissions to thermal fissions'
              },
              p: {
                value: factors.p.toFixed(4),
                name: 'Resonance escape probability',
                description: 'Probability of avoiding resonance capture'
              },
              f: {
                value: factors.f.toFixed(4),
                name: 'Thermal utilization',
                description: 'Fraction of absorptions in fuel'
              }
            },
            result: {
              kInfinite: factors.kInf.toFixed(5),
              interpretation: factors.kInf > 1 ? 'Can achieve criticality' : 'Cannot achieve criticality'
            }
          }, null, 2)
        };
      }

      case 'critical_mass': {
        const nuclide = args.nuclide || 'U-235';
        const moderators: Array<'none' | 'water' | 'graphite' | 'heavy_water'> = ['none', 'water'];

        const results = moderators.map(mod => {
          try {
            return { moderator: mod, ...estimateCriticalMass(nuclide, mod) };
          } catch (e) {
            return { moderator: mod, error: e instanceof Error ? e.message : 'Error' };
          }
        });

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'critical_mass',
            nuclide,
            results: results.map(r => {
              if ('error' in r) return r;
              return {
                configuration: r.note,
                criticalMass: r.mass + ' kg',
                criticalRadius: r.radius + ' cm'
              };
            }),
            factors: [
              'Reflector reduces critical mass significantly',
              'Moderator thermalizes neutrons for better absorption',
              'Shape matters: sphere is most efficient',
              'Density compression reduces critical mass'
            ],
            note: 'Values are approximate - actual critical mass depends on many factors'
          }, null, 2)
        };
      }

      case 'reactor_type': {
        const type = args.reactor_type;

        if (type && REACTOR_TYPES[type]) {
          return {
            toolCallId: id,
            content: JSON.stringify({
              operation: 'reactor_type',
              data: REACTOR_TYPES[type]
            }, null, 2)
          };
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'reactor_type',
            availableTypes: Object.entries(REACTOR_TYPES).map(([k, v]) => ({
              id: k,
              name: v.fullName,
              spectrum: v.neutronSpectrum,
              efficiency: (v.thermalEfficiency * 100).toFixed(0) + '%'
            }))
          }, null, 2)
        };
      }

      case 'nuclide': {
        const nuc = args.nuclide;

        if (nuc && NUCLIDES[nuc]) {
          const data = NUCLIDES[nuc];
          return {
            toolCallId: id,
            content: JSON.stringify({
              operation: 'nuclide',
              data: {
                ...data,
                sigmaFission: data.sigmaFission + ' barns',
                sigmaCapture: data.sigmaCapture + ' barns',
                fissionEnergy: data.fissionEnergy + ' MeV',
                halfLife: data.halfLife
                  ? (data.halfLife / 3.156e7).toExponential(2) + ' years'
                  : 'Stable'
              }
            }, null, 2)
          };
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'nuclide',
            availableNuclides: Object.entries(NUCLIDES).map(([k, v]) => ({
              id: k,
              name: v.name,
              fissile: v.isFissile,
              fertile: v.isFertile
            }))
          }, null, 2)
        };
      }

      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'Nuclear Reactor',
            description: 'Nuclear reactor physics calculations',

            operations: [
              'criticality: Calculate keff and four factors',
              'neutron_flux: Calculate flux from power',
              'burnup: Simulate fuel depletion',
              'decay_heat: Calculate post-shutdown heat',
              'four_factor: Detailed four-factor analysis',
              'critical_mass: Estimate critical mass',
              'reactor_type: Reactor type information',
              'nuclide: Nuclear data lookup',
              'info: This documentation'
            ],

            keyEquations: {
              fourFactorFormula: 'k∞ = η × ε × p × f',
              effectiveMultiplication: 'keff = k∞ × PNL',
              criticality: 'keff = 1 for steady state',
              reactivity: 'ρ = (keff - 1) / keff'
            },

            reactorTypes: Object.keys(REACTOR_TYPES),
            fissileNuclides: ['U-235', 'Pu-239', 'Pu-241', 'U-233'],
            fertileNuclides: ['U-238', 'Th-232', 'Pu-240'],

            examples: [
              { operation: 'criticality', enrichment: 0.04, moderator_ratio: 100 },
              { operation: 'burnup', enrichment: 0.04, operating_time: 24000 },
              { operation: 'decay_heat', power: 3000, operating_time: 8760 }
            ]
          }, null, 2)
        };
      }

      default:
        return {
          toolCallId: id,
          content: JSON.stringify({
            error: `Unknown operation: ${operation}`,
            validOperations: ['criticality', 'neutron_flux', 'burnup', 'decay_heat', 'four_factor', 'critical_mass', 'reactor_type', 'nuclide', 'info']
          }, null, 2),
          isError: true
        };
    }
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    return {
      toolCallId: id,
      content: `Error in nuclear reactor: ${errorMessage}`,
      isError: true
    };
  }
}

export function isnuclearreactorAvailable(): boolean {
  return true;
}
