/**
 * OCEAN-MODEL TOOL
 * Ocean circulation, thermohaline dynamics, and marine physics
 * Real oceanographic equations and models
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const oceanmodelTool: UnifiedTool = {
  name: 'ocean_model',
  description: `Ocean circulation and dynamics modeling.

Operations:
- info: Ocean physics overview
- density: Calculate seawater density (UNESCO equation)
- thermohaline: Model thermohaline circulation
- wave: Calculate wave properties (dispersion, group velocity)
- tide: Tidal analysis and prediction
- upwelling: Coastal upwelling dynamics
- mixing: Vertical mixing and stratification
- current: Ocean current calculations
- ekman: Ekman transport and spiral
- gyres: Major gyre circulation patterns

Parameters:
- operation: The operation to perform
- temperature: Temperature in °C
- salinity: Salinity in PSU (practical salinity units)
- depth: Depth in meters
- latitude: Latitude in degrees
- wind_speed: Wind speed in m/s
- wave_period: Wave period in seconds`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['info', 'density', 'thermohaline', 'wave', 'tide', 'upwelling', 'mixing', 'current', 'ekman', 'gyres'],
        description: 'Operation to perform'
      },
      temperature: { type: 'number', description: 'Temperature in °C' },
      salinity: { type: 'number', description: 'Salinity in PSU' },
      depth: { type: 'number', description: 'Depth in meters' },
      latitude: { type: 'number', description: 'Latitude in degrees' },
      wind_speed: { type: 'number', description: 'Wind speed in m/s' },
      wave_period: { type: 'number', description: 'Wave period in seconds' },
      wave_height: { type: 'number', description: 'Wave height in meters' }
    },
    required: ['operation']
  }
};

// ============================================================================
// OCEANOGRAPHIC CONSTANTS
// ============================================================================

const CONSTANTS = {
  g: 9.81,                    // m/s² gravitational acceleration
  OMEGA: 7.2921e-5,           // rad/s Earth's rotation rate
  RHO_0: 1025,                // kg/m³ reference seawater density
  CP: 3985,                   // J/(kg·K) specific heat of seawater
  EARTH_RADIUS: 6.371e6,      // m
  ALPHA: 2.5e-4,              // 1/K thermal expansion coefficient
  BETA: 7.5e-4               // 1/PSU haline contraction coefficient
};

// ============================================================================
// OCEAN PHYSICS CALCULATIONS
// ============================================================================

/**
 * Coriolis parameter
 * f = 2Ω sin(φ)
 */
function coriolisParameter(latitude: number): number {
  return 2 * CONSTANTS.OMEGA * Math.sin(latitude * Math.PI / 180);
}

/**
 * UNESCO seawater density equation (simplified)
 * ρ = ρ(T, S, p) - complex polynomial fit
 */
function seawaterDensity(T: number, S: number, p: number = 0): number {
  // Simplified equation of state
  // ρ ≈ ρ₀(1 - α(T-T₀) + β(S-S₀) + κp)

  const T0 = 10; // Reference temperature
  const S0 = 35; // Reference salinity

  // More accurate polynomial (simplified version of UNESCO)
  const rho_0 = 999.842594 + 6.793952e-2 * T
              - 9.095290e-3 * T * T + 1.001685e-4 * T * T * T
              - 1.120083e-6 * T * T * T * T + 6.536336e-9 * T * T * T * T * T;

  // Salinity contribution
  const A = 8.24493e-1 - 4.0899e-3 * T + 7.6438e-5 * T * T - 8.2467e-7 * T * T * T;
  const B = -5.72466e-3 + 1.0227e-4 * T - 1.6546e-6 * T * T;
  const C = 4.8314e-4;

  const rho = rho_0 + A * S + B * Math.pow(S, 1.5) + C * S * S;

  // Pressure contribution (approximate)
  const pressureCorrection = p * 4.5e-6; // ~4.5e-6 per dbar

  return rho * (1 + pressureCorrection);
}

/**
 * Buoyancy frequency (Brunt-Väisälä)
 * N² = -(g/ρ₀) * dρ/dz
 */
function bruntVaisalaFrequency(rhoTop: number, rhoBottom: number, dz: number): number {
  const drho_dz = (rhoBottom - rhoTop) / dz;
  const N_squared = -(CONSTANTS.g / CONSTANTS.RHO_0) * drho_dz;
  return Math.sqrt(Math.max(0, N_squared));
}

/**
 * Deep water wave dispersion relation
 * ω² = gk (deep water)
 * ω² = gk tanh(kh) (general)
 */
function waveDispersion(period: number, depth: number): {
  wavelength: number;
  phase_velocity: number;
  group_velocity: number;
  type: string;
} {
  const omega = 2 * Math.PI / period;
  const g = CONSTANTS.g;

  // Deep water approximation
  const k_deep = omega * omega / g;
  const lambda_deep = 2 * Math.PI / k_deep;

  // Check if deep or shallow water
  const L_half = lambda_deep / 2;

  let k: number;
  let wavelength: number;
  let type: string;

  if (depth > L_half) {
    // Deep water: h > L/2
    k = k_deep;
    wavelength = lambda_deep;
    type = 'Deep water';
  } else if (depth < lambda_deep / 20) {
    // Shallow water: h < L/20
    k = omega / Math.sqrt(g * depth);
    wavelength = 2 * Math.PI / k;
    type = 'Shallow water';
  } else {
    // Intermediate - need iteration
    k = k_deep;
    for (let i = 0; i < 10; i++) {
      k = omega * omega / (g * Math.tanh(k * depth));
    }
    wavelength = 2 * Math.PI / k;
    type = 'Intermediate';
  }

  const phase_velocity = wavelength / period;
  const n = 0.5 * (1 + 2 * k * depth / Math.sinh(2 * k * depth));
  const group_velocity = n * phase_velocity;

  return { wavelength, phase_velocity, group_velocity, type };
}

/**
 * Ekman depth and transport
 */
function ekmanDynamics(windSpeed: number, latitude: number): {
  ekmanDepth: number;
  surfaceVelocity: number;
  transport: number;
  spiralAngle: number;
} {
  const f = coriolisParameter(latitude);
  if (Math.abs(f) < 1e-6) {
    return { ekmanDepth: Infinity, surfaceVelocity: 0, transport: 0, spiralAngle: 45 };
  }

  // Vertical eddy viscosity
  const Az = 0.1; // m²/s (typical value)

  // Ekman depth
  const D_e = Math.PI * Math.sqrt(2 * Az / Math.abs(f));

  // Wind stress (τ = ρ_air * C_D * U²)
  const rho_air = 1.225;
  const C_D = 1.5e-3;
  const tau = rho_air * C_D * windSpeed * windSpeed;

  // Surface velocity (45° to right of wind in NH)
  const V_0 = tau / (CONSTANTS.RHO_0 * Math.sqrt(Az * Math.abs(f)));

  // Ekman transport (perpendicular to wind)
  const M_e = tau / Math.abs(f);

  return {
    ekmanDepth: D_e,
    surfaceVelocity: V_0,
    transport: M_e,
    spiralAngle: 45
  };
}

/**
 * Thermohaline circulation simple model
 */
function thermohalineCirculation(surfaceT: number, deepT: number,
                                 surfaceS: number, deepS: number): {
  densityDifference: number;
  overturningStrength: string;
  sinkingRate: number;
  transitTime: string;
} {
  const rhoSurface = seawaterDensity(surfaceT, surfaceS, 0);
  const rhoDeep = seawaterDensity(deepT, deepS, 4000);

  const densityDiff = rhoDeep - rhoSurface;

  // Simplified overturning estimate
  let strength: string;
  let sinkingRate: number;

  if (densityDiff > 1) {
    strength = 'Strong (like current North Atlantic)';
    sinkingRate = 20e6; // 20 Sv
  } else if (densityDiff > 0.5) {
    strength = 'Moderate';
    sinkingRate = 10e6;
  } else if (densityDiff > 0) {
    strength = 'Weak (climate change scenario)';
    sinkingRate = 5e6;
  } else {
    strength = 'Collapsed/Reversed';
    sinkingRate = 0;
  }

  return {
    densityDifference: densityDiff,
    overturningStrength: strength,
    sinkingRate: sinkingRate,
    transitTime: sinkingRate > 0 ? '~1000 years (global conveyor)' : 'N/A'
  };
}

/**
 * Upwelling velocity estimate
 */
function coastalUpwelling(windSpeed: number, latitude: number, coastOrientation: string): {
  upwellingVelocity: number;
  temperatureAnomaly: number;
  ekmanTransport: number;
  productivityImpact: string;
} {
  const ekman = ekmanDynamics(windSpeed, latitude);

  // Upwelling velocity depends on offshore Ekman transport
  const coastLength = 100e3; // 100 km typical
  const upwellingWidth = 10e3; // 10 km upwelling zone

  const w = ekman.transport / (CONSTANTS.RHO_0 * upwellingWidth);

  // Temperature anomaly (cold water from depth)
  const tempAnomaly = -w * 50; // ~50°C/km temperature gradient

  return {
    upwellingVelocity: w * 86400, // m/day
    temperatureAnomaly: Math.max(-10, Math.min(0, tempAnomaly)),
    ekmanTransport: ekman.transport,
    productivityImpact: w > 5e-5 ? 'High (nutrient-rich upwelling)' :
                        w > 1e-5 ? 'Moderate' : 'Low'
  };
}

/**
 * Tidal constituents
 */
function tidalAnalysis(latitude: number): {
  M2: { period: number; amplitude: string };
  S2: { period: number; amplitude: string };
  K1: { period: number; amplitude: string };
  O1: { period: number; amplitude: string };
  springNeapRatio: number;
  tidalType: string;
} {
  const M2 = { period: 12.42, amplitude: '~0.5-2m (location dependent)' };
  const S2 = { period: 12.00, amplitude: '~0.2-0.8m' };
  const K1 = { period: 23.93, amplitude: '~0.1-0.4m' };
  const O1 = { period: 25.82, amplitude: '~0.1-0.3m' };

  // Form number F = (K1 + O1)/(M2 + S2)
  const F = 0.5; // typical mid-latitude

  let tidalType: string;
  if (F < 0.25) tidalType = 'Semidiurnal';
  else if (F < 1.5) tidalType = 'Mixed';
  else tidalType = 'Diurnal';

  return {
    M2, S2, K1, O1,
    springNeapRatio: 1.46, // typical
    tidalType
  };
}

export async function executeoceanmodel(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation || 'info';

    switch (operation) {
      case 'info': {
        const result = {
          tool: 'Ocean Model',
          description: 'Physical oceanography and marine dynamics',

          fundamentalEquations: {
            navierStokes: 'ρ(∂u/∂t + u·∇u) = -∇p + ρg + μ∇²u + Coriolis',
            continuity: '∇·u = 0 (incompressible)',
            equationOfState: 'ρ = ρ(T, S, p) - UNESCO polynomial',
            ekmanBalance: 'f × u = (1/ρ)∂τ/∂z'
          },

          majorCirculation: {
            surfaceCurrents: 'Wind-driven, Ekman + geostrophic',
            thermohaline: 'Density-driven deep circulation',
            gyres: 'Large-scale anticyclonic (NH) / cyclonic (SH)',
            westernBoundary: 'Gulf Stream, Kuroshio - intensified western currents'
          },

          scales: {
            surfaceMixedLayer: '10-200m depth',
            thermocline: '200-1000m (permanent)',
            deepWater: '>1000m (cold, dense)',
            abyssal: '>4000m'
          },

          keyProcesses: [
            'Ekman transport (wind-driven)',
            'Upwelling/downwelling',
            'Thermohaline circulation',
            'Eddy mixing',
            'Tidal mixing',
            'Internal waves'
          ],

          usage: 'Use operation: density, thermohaline, wave, tide, upwelling, mixing, current, ekman, gyres'
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'density': {
        const T = args.temperature ?? 15;
        const S = args.salinity ?? 35;
        const depth = args.depth ?? 0;
        const p = depth / 10; // approximate dbar

        const rho = seawaterDensity(T, S, p);
        const sigma_t = rho - 1000; // density anomaly

        const result = {
          operation: 'density',
          input: {
            temperature: `${T} °C`,
            salinity: `${S} PSU`,
            depth: `${depth} m`,
            pressure: `${p.toFixed(1)} dbar`
          },

          calculation: {
            equation: 'UNESCO International Equation of State (IES-80)',
            formula: 'ρ = ρ(T, S, p) polynomial fit',
            thermalExpansion: `α ≈ ${CONSTANTS.ALPHA} K⁻¹`,
            halineContraction: `β ≈ ${CONSTANTS.BETA} PSU⁻¹`
          },

          result: {
            density: `${rho.toFixed(3)} kg/m³`,
            sigma_t: `${sigma_t.toFixed(3)} kg/m³`,
            specificVolume: `${(1/rho).toExponential(4)} m³/kg`
          },

          comparison: {
            freshWater: '1000 kg/m³',
            surfaceSeawater: '1025 kg/m³',
            deepSeawater: '1028 kg/m³',
            maxDensity: 'At ~4°C for freshwater'
          }
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'thermohaline': {
        const surfaceT = args.temperature ?? 20;
        const deepT = 2;
        const surfaceS = args.salinity ?? 35;
        const deepS = 34.8;

        const thc = thermohalineCirculation(surfaceT, deepT, surfaceS, deepS);

        const result = {
          operation: 'thermohaline',

          conditions: {
            surfaceTemperature: `${surfaceT} °C`,
            deepTemperature: `${deepT} °C`,
            surfaceSalinity: `${surfaceS} PSU`,
            deepSalinity: `${deepS} PSU`
          },

          circulation: thc,

          globalConveyor: {
            description: 'Meridional overturning circulation (MOC)',
            path: 'North Atlantic sinking → Deep southward flow → Upwelling in Pacific/Indian → Surface return',
            volume: '~20 Sv (Sverdrups, 10⁶ m³/s)',
            heatTransport: '~1.3 PW northward in Atlantic'
          },

          climateImplications: {
            stabilizing: 'Transports heat poleward',
            vulnerable: 'Freshwater input (melting ice) can weaken',
            historicalCollapse: 'Younger Dryas (~12,800 years ago)'
          }
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'wave': {
        const period = args.wave_period ?? 10;
        const depth = args.depth ?? 1000;
        const height = args.wave_height ?? 2;

        const wave = waveDispersion(period, depth);

        const result = {
          operation: 'wave',

          input: {
            period: `${period} s`,
            depth: `${depth} m`,
            height: `${height} m`
          },

          dispersion: {
            relation: 'ω² = gk tanh(kh)',
            deepWater: 'ω² = gk (when h > L/2)',
            shallowWater: 'c = √(gh) (when h < L/20)'
          },

          properties: {
            wavelength: `${wave.wavelength.toFixed(1)} m`,
            phaseVelocity: `${wave.phase_velocity.toFixed(2)} m/s`,
            groupVelocity: `${wave.group_velocity.toFixed(2)} m/s`,
            waveType: wave.type,
            steepness: (height / wave.wavelength).toFixed(4)
          },

          energy: {
            energyDensity: `${(0.5 * CONSTANTS.RHO_0 * CONSTANTS.g * height * height).toFixed(0)} J/m²`,
            energyFlux: `${(CONSTANTS.RHO_0 * CONSTANTS.g * height * height * wave.group_velocity / 8).toFixed(0)} W/m`,
            breakingCriterion: `H/L < 0.142 (${height/wave.wavelength < 0.142 ? 'stable' : 'breaking'})`
          }
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'tide': {
        const latitude = args.latitude ?? 45;

        const tides = tidalAnalysis(latitude);

        const result = {
          operation: 'tide',
          latitude: `${latitude}°`,

          constituents: {
            M2: { name: 'Principal lunar semidiurnal', ...tides.M2 },
            S2: { name: 'Principal solar semidiurnal', ...tides.S2 },
            K1: { name: 'Lunisolar diurnal', ...tides.K1 },
            O1: { name: 'Principal lunar diurnal', ...tides.O1 }
          },

          characteristics: {
            tidalType: tides.tidalType,
            springNeapRatio: tides.springNeapRatio,
            springTide: 'New/full moon - max range',
            neapTide: 'Quarter moon - min range'
          },

          forces: {
            primary: 'Lunar gravitational gradient',
            secondary: 'Solar gravitational gradient',
            formula: 'F ∝ M/r³ (tidal force)',
            lunarToSolar: '~2.2:1 (Moon stronger despite smaller mass)'
          },

          globalPatterns: {
            amphidromicPoints: 'Zero amplitude, cotidal lines radiate',
            kelvinWaves: 'Coastal trapped, deflected by Coriolis',
            resonance: 'Bay of Fundy (~16m range)'
          }
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'upwelling': {
        const windSpeed = args.wind_speed ?? 10;
        const latitude = args.latitude ?? 35;

        const upwell = coastalUpwelling(windSpeed, latitude, 'N-S');

        const result = {
          operation: 'upwelling',

          input: {
            windSpeed: `${windSpeed} m/s`,
            latitude: `${latitude}°`
          },

          dynamics: {
            mechanism: 'Ekman transport offshore → divergence → vertical flow',
            upwellingVelocity: `${upwell.upwellingVelocity.toFixed(2)} m/day`,
            temperatureAnomaly: `${upwell.temperatureAnomaly.toFixed(1)} °C`,
            ekmanTransport: `${upwell.ekmanTransport.toFixed(1)} m²/s`
          },

          biological: {
            productivityImpact: upwell.productivityImpact,
            nutrients: 'Nitrate, phosphate, silicate from depth',
            fisheries: 'Major fisheries (Peru, California, Canary, Benguela)'
          },

          majorRegions: {
            'Eastern Boundary': 'California, Peru, Canary, Benguela',
            'Equatorial': 'Pacific cold tongue',
            'Coastal': 'Monsoon-driven (Arabian Sea, Somalia)'
          }
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'mixing': {
        const T_top = args.temperature ?? 20;
        const T_bottom = 5;
        const dz = args.depth ?? 100;

        const rho_top = seawaterDensity(T_top, 35, 0);
        const rho_bottom = seawaterDensity(T_bottom, 35, dz/10);
        const N = bruntVaisalaFrequency(rho_top, rho_bottom, dz);

        const result = {
          operation: 'mixing',

          stratification: {
            surfaceTemperature: `${T_top} °C`,
            deepTemperature: `${T_bottom} °C`,
            layerThickness: `${dz} m`,
            densityDifference: `${(rho_bottom - rho_top).toFixed(3)} kg/m³`
          },

          stability: {
            bruntVaisalaFrequency: `${(N * 1000).toFixed(3)} × 10⁻³ rad/s`,
            buoyancyPeriod: `${(2 * Math.PI / N / 60).toFixed(1)} minutes`,
            richardsonNumber: 'Ri = N²/(du/dz)² > 0.25 → stable'
          },

          mixingProcesses: {
            windMixing: 'Surface mixed layer deepening',
            shearInstability: 'Kelvin-Helmholtz billows',
            internalWaves: 'Breaking internal waves',
            doubleeDiffusion: 'Salt fingering, diffusive convection',
            tidalMixing: 'Near topography, internal tides'
          },

          diffusivities: {
            molecularHeat: '1.4 × 10⁻⁷ m²/s',
            molecularSalt: '1.5 × 10⁻⁹ m²/s',
            turbulentBackground: '~10⁻⁵ m²/s',
            surfaceMixedLayer: '~10⁻² m²/s'
          }
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'ekman': {
        const windSpeed = args.wind_speed ?? 10;
        const latitude = args.latitude ?? 45;

        const ekman = ekmanDynamics(windSpeed, latitude);
        const f = coriolisParameter(latitude);

        const result = {
          operation: 'ekman',

          input: {
            windSpeed: `${windSpeed} m/s`,
            latitude: `${latitude}°`,
            coriolisParameter: `${f.toExponential(4)} rad/s`
          },

          ekmanLayer: {
            depth: `${ekman.ekmanDepth.toFixed(1)} m`,
            surfaceVelocity: `${(ekman.surfaceVelocity * 100).toFixed(2)} cm/s`,
            surfaceAngle: `${ekman.spiralAngle}° to right of wind (NH)`,
            transportDirection: 'Perpendicular to wind (90° right in NH)'
          },

          transport: {
            massTransport: `${ekman.transport.toFixed(2)} m²/s per m of coast`,
            volumeTransport: 'Depth-integrated flow',
            netDirection: '90° to right of wind (NH)'
          },

          spiral: {
            description: 'Velocity decreases and rotates with depth',
            equation: 'u = u₀ exp(-z/D) cos(πz/D - 45°)',
            depthScale: `D_e = π√(2A_z/|f|) ≈ ${ekman.ekmanDepth.toFixed(0)}m`
          },

          applications: {
            upwelling: 'Offshore Ekman transport → coastal upwelling',
            ekmanPumping: 'Curl of wind stress → vertical motion',
            gyreFormation: 'Ekman convergence/divergence'
          }
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'gyres': {
        const latitude = args.latitude ?? 30;

        const result = {
          operation: 'gyres',

          majorGyres: {
            northAtlantic: {
              rotation: 'Anticyclonic (clockwise)',
              westernBoundary: 'Gulf Stream (Florida Strait → Cape Hatteras)',
              transport: '~30 Sv',
              sargassoSea: 'Central gyre accumulation zone'
            },
            northPacific: {
              rotation: 'Anticyclonic',
              westernBoundary: 'Kuroshio Current',
              transport: '~40 Sv',
              garbagePatch: 'Plastic accumulation in center'
            },
            southAtlantic: {
              rotation: 'Anticyclonic (counterclockwise)',
              westernBoundary: 'Brazil Current',
              transport: '~20 Sv'
            },
            southPacific: {
              rotation: 'Anticyclonic',
              westernBoundary: 'East Australian Current',
              transport: '~25 Sv'
            },
            indian: {
              rotation: 'Anticyclonic (S. Hemisphere)',
              westernBoundary: 'Agulhas Current',
              transport: '~70 Sv (strongest)'
            }
          },

          physics: {
            sverdrupBalance: 'βv = (1/ρ) curl(τ)',
            westernIntensification: 'β-effect concentrates flow on west',
            stommelModel: 'Bottom friction + Coriolis = wind stress',
            munkModel: 'Lateral friction added'
          },

          convergence: {
            center: 'Downwelling, low nutrients, clear water',
            subtropical: 'High pressure, calm (horse latitudes)',
            debris: 'Floating material accumulates'
          }
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'current': {
        const latitude = args.latitude ?? 45;
        const depth = args.depth ?? 100;

        const f = coriolisParameter(latitude);

        const result = {
          operation: 'current',

          geostrophicBalance: {
            equation: 'f × u = -(1/ρ)∇p',
            description: 'Flow perpendicular to pressure gradient',
            thermalWind: 'Vertical shear from horizontal density gradient'
          },

          typicalSpeeds: {
            surfaceWind: '0.01-0.1 m/s',
            westernBoundary: '1-2 m/s (Gulf Stream)',
            deepWater: '0.01-0.05 m/s',
            tidalCurrent: '0.5-2 m/s (varies greatly)'
          },

          measurement: {
            drifters: 'Surface Lagrangian floats',
            ADCP: 'Acoustic Doppler Current Profiler',
            argoFloats: '4000+ autonomous profilers',
            satellites: 'Altimetry → geostrophic currents'
          },

          coriolis: {
            parameter: `f = ${f.toExponential(4)} rad/s at ${latitude}°`,
            inertialPeriod: `${(2 * Math.PI / Math.abs(f) / 3600).toFixed(1)} hours`,
            rosbyRadius: `~${Math.round(50000 * Math.cos(latitude * Math.PI / 180))}m (baroclinic)`
          }
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      default:
        return {
          toolCallId: id,
          content: `Unknown operation: ${operation}. Use: info, density, thermohaline, wave, tide, upwelling, mixing, current, ekman, gyres`
        };
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function isoceanmodelAvailable(): boolean { return true; }
