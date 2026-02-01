// ============================================================================
// AERODYNAMICS TOOL - TIER INFINITY
// ============================================================================
// Aerodynamic calculations: lift/drag coefficients, airfoil analysis,
// Reynolds effects, boundary layers, and aircraft performance.
// Pure TypeScript implementation - no external dependencies.
// ============================================================================

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// CONSTANTS
// ============================================================================

const RHO_SL = 1.225;
const T_SL = 288.15;
const P_SL = 101325;
const GAMMA = 1.4;
const R_AIR = 287;
const MU_SL = 1.789e-5;

const AIRFOILS: Record<
  string,
  {
    cl_alpha: number;
    cl_max: number;
    cd_min: number;
    alpha_stall: number;
    name: string;
  }
> = {
  naca0012: {
    cl_alpha: 6.28,
    cl_max: 1.5,
    cd_min: 0.006,
    alpha_stall: 15,
    name: 'NACA 0012 (symmetric)',
  },
  naca2412: {
    cl_alpha: 6.28,
    cl_max: 1.7,
    cd_min: 0.007,
    alpha_stall: 16,
    name: 'NACA 2412 (cambered)',
  },
  naca4412: {
    cl_alpha: 6.28,
    cl_max: 1.8,
    cd_min: 0.008,
    alpha_stall: 14,
    name: 'NACA 4412 (high camber)',
  },
  naca23012: {
    cl_alpha: 6.28,
    cl_max: 1.6,
    cd_min: 0.007,
    alpha_stall: 18,
    name: 'NACA 23012 (laminar)',
  },
  clark_y: { cl_alpha: 6.0, cl_max: 1.8, cd_min: 0.008, alpha_stall: 14, name: 'Clark Y' },
  flat_plate: {
    cl_alpha: 2 * Math.PI,
    cl_max: 0.9,
    cd_min: 0.01,
    alpha_stall: 10,
    name: 'Flat Plate',
  },
};

// ============================================================================
// ATMOSPHERE MODEL
// ============================================================================

function atmosphereProperties(altitude: number): {
  temperature: number;
  pressure: number;
  density: number;
  speed_of_sound: number;
  viscosity: number;
} {
  const lapseRate = 0.0065;
  const g = 9.81;

  let T: number, P: number, rho: number;

  if (altitude <= 11000) {
    T = T_SL - lapseRate * altitude;
    P = P_SL * Math.pow(T / T_SL, g / (R_AIR * lapseRate));
    rho = P / (R_AIR * T);
  } else if (altitude <= 20000) {
    const T11 = T_SL - lapseRate * 11000;
    const P11 = P_SL * Math.pow(T11 / T_SL, g / (R_AIR * lapseRate));
    T = T11;
    P = P11 * Math.exp((-g * (altitude - 11000)) / (R_AIR * T11));
    rho = P / (R_AIR * T);
  } else {
    T = 216.65;
    P = 5474.9 * Math.exp((-g * (altitude - 20000)) / (R_AIR * T));
    rho = P / (R_AIR * T);
  }

  const a = Math.sqrt(GAMMA * R_AIR * T);
  const mu = (MU_SL * Math.pow(T / T_SL, 1.5) * (T_SL + 110.4)) / (T + 110.4);

  return { temperature: T, pressure: P, density: rho, speed_of_sound: a, viscosity: mu };
}

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

function liftForce(rho: number, velocity: number, area: number, cl: number): number {
  return 0.5 * rho * velocity * velocity * area * cl;
}

function dragForce(rho: number, velocity: number, area: number, cd: number): number {
  return 0.5 * rho * velocity * velocity * area * cd;
}

function dynamicPressure(rho: number, velocity: number): number {
  return 0.5 * rho * velocity * velocity;
}

function liftCoefficient(alpha: number, cl_alpha: number, alpha_0: number = 0): number {
  const alphaRad = ((alpha - alpha_0) * Math.PI) / 180;
  return cl_alpha * alphaRad;
}

function inducedDragCoefficient(cl: number, aspectRatio: number, e: number = 0.85): number {
  return (cl * cl) / (Math.PI * aspectRatio * e);
}

function totalDragCoefficient(cd_0: number, cl: number, ar: number, e: number = 0.85): number {
  return cd_0 + inducedDragCoefficient(cl, ar, e);
}

function liftToDrag(cl: number, cd: number): number {
  return cl / cd;
}

function maxLiftToDragCl(cd_0: number, ar: number, e: number = 0.85): number {
  return Math.sqrt(Math.PI * ar * e * cd_0);
}

function stallSpeed(weight: number, area: number, rho: number, cl_max: number): number {
  return Math.sqrt((2 * weight) / (rho * area * cl_max));
}

function machNumberCalc(velocity: number, speedOfSound: number): number {
  return velocity / speedOfSound;
}

function reynoldsNumber(velocity: number, chord: number, rho: number, mu: number): number {
  return (rho * velocity * chord) / mu;
}

function laminarBoundaryLayer(x: number, re_x: number): number {
  return (5.0 * x) / Math.sqrt(re_x);
}

function turbulentSkinFriction(re: number): number {
  return 0.455 / Math.pow(Math.log10(re), 2.58);
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const aerodynamicsTool: UnifiedTool = {
  name: 'aerodynamics',
  description: `Aerodynamics and aircraft performance calculations.

Operations:
- lift_drag: Calculate lift and drag forces
- airfoil: Analyze airfoil performance
- atmosphere: Get atmospheric properties at altitude
- performance: Aircraft performance analysis (stall, L/D)
- reynolds: Calculate Reynolds number
- mach: Mach number and compressibility
- boundary_layer: Boundary layer analysis
- airfoils: List available airfoil data`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'lift_drag',
          'airfoil',
          'atmosphere',
          'performance',
          'reynolds',
          'mach',
          'boundary_layer',
          'airfoils',
        ],
        description: 'Calculation to perform',
      },
      velocity: { type: 'number', description: 'Airspeed (m/s)' },
      altitude: { type: 'number', description: 'Altitude (m)' },
      area: { type: 'number', description: 'Wing area (m²)' },
      chord: { type: 'number', description: 'Chord length (m)' },
      span: { type: 'number', description: 'Wingspan (m)' },
      aspect_ratio: { type: 'number', description: 'Aspect ratio (span²/area)' },
      angle_of_attack: { type: 'number', description: 'Angle of attack (degrees)' },
      cl: { type: 'number', description: 'Lift coefficient' },
      cd: { type: 'number', description: 'Drag coefficient' },
      cd_0: { type: 'number', description: 'Zero-lift drag coefficient' },
      weight: { type: 'number', description: 'Aircraft weight (N)' },
      airfoil: { type: 'string', description: 'Airfoil type key' },
      oswald_efficiency: { type: 'number', description: 'Oswald efficiency factor (0-1)' },
      distance: { type: 'number', description: 'Distance from leading edge (m)' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeAerodynamics(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    const altitude = args.altitude || 0;
    const atm = atmosphereProperties(altitude);

    let result: Record<string, unknown>;

    switch (operation) {
      case 'lift_drag': {
        const { velocity, area, cl, cd } = args;
        if (!velocity || !area) {
          throw new Error('lift_drag requires velocity and area');
        }

        const clVal = cl || 0.5;
        const cdVal = cd || 0.03;

        const L = liftForce(atm.density, velocity, area, clVal);
        const D = dragForce(atm.density, velocity, area, cdVal);
        const q = dynamicPressure(atm.density, velocity);
        const ld = liftToDrag(clVal, cdVal);

        result = {
          operation: 'lift_drag',
          inputs: { velocity, area, cl: clVal, cd: cdVal, altitude },
          atmosphere: { density_kg_m3: atm.density, temperature_k: atm.temperature },
          results: {
            lift_force_n: L,
            drag_force_n: D,
            dynamic_pressure_pa: q,
            lift_to_drag_ratio: ld,
            mach_number: velocity / atm.speed_of_sound,
          },
        };
        break;
      }

      case 'airfoil': {
        const { angle_of_attack, velocity, chord } = args;
        let airfoilData = AIRFOILS['naca2412'];

        if (args.airfoil && AIRFOILS[args.airfoil]) {
          airfoilData = AIRFOILS[args.airfoil];
        }

        const aoa = angle_of_attack || 5;
        const cl = liftCoefficient(aoa, airfoilData.cl_alpha);
        const isStalled = Math.abs(aoa) > airfoilData.alpha_stall;

        const results: Record<string, unknown> = {
          airfoil: args.airfoil || 'naca2412',
          name: airfoilData.name,
          angle_of_attack_deg: aoa,
          lift_coefficient: isStalled ? airfoilData.cl_max * 0.8 : Math.min(cl, airfoilData.cl_max),
          drag_coefficient_min: airfoilData.cd_min,
          stall_angle_deg: airfoilData.alpha_stall,
          is_stalled: isStalled,
          cl_alpha_per_rad: airfoilData.cl_alpha,
          cl_max: airfoilData.cl_max,
        };

        if (velocity && chord) {
          results.reynolds_number = reynoldsNumber(velocity, chord, atm.density, atm.viscosity);
        }

        result = {
          operation: 'airfoil',
          inputs: { angle_of_attack: aoa, airfoil: args.airfoil },
          results,
        };
        break;
      }

      case 'atmosphere': {
        result = {
          operation: 'atmosphere',
          altitude_m: altitude,
          altitude_ft: altitude * 3.281,
          properties: {
            temperature_k: atm.temperature,
            temperature_c: atm.temperature - 273.15,
            pressure_pa: atm.pressure,
            pressure_hpa: atm.pressure / 100,
            density_kg_m3: atm.density,
            speed_of_sound_m_s: atm.speed_of_sound,
            speed_of_sound_knots: atm.speed_of_sound * 1.944,
            dynamic_viscosity: atm.viscosity,
            density_ratio: atm.density / RHO_SL,
          },
        };
        break;
      }

      case 'performance': {
        const { weight, area, aspect_ratio, cd_0, oswald_efficiency } = args;
        if (!weight || !area) {
          throw new Error('performance requires weight and area');
        }

        const ar = aspect_ratio || (args.span ? Math.pow(args.span, 2) / area : 8);
        const e = oswald_efficiency || 0.85;
        const cd0 = cd_0 || 0.025;

        let airfoilData = AIRFOILS['naca2412'];
        if (args.airfoil && AIRFOILS[args.airfoil]) {
          airfoilData = AIRFOILS[args.airfoil];
        }

        const vs = stallSpeed(weight, area, atm.density, airfoilData.cl_max);
        const clMaxLd = maxLiftToDragCl(cd0, ar, e);
        const cdMaxLd = totalDragCoefficient(cd0, clMaxLd, ar, e);
        const maxLd = liftToDrag(clMaxLd, cdMaxLd);
        const vMaxLd = Math.sqrt((2 * weight) / (atm.density * area * clMaxLd));

        result = {
          operation: 'performance',
          inputs: { weight, area, aspect_ratio: ar, cd_0: cd0, oswald_efficiency: e },
          results: {
            stall_speed_m_s: vs,
            stall_speed_knots: vs * 1.944,
            max_lift_to_drag: maxLd,
            cl_at_max_ld: clMaxLd,
            cd_at_max_ld: cdMaxLd,
            velocity_at_max_ld_m_s: vMaxLd,
            wing_loading_n_m2: weight / area,
            wing_loading_kg_m2: weight / (area * 9.81),
          },
        };
        break;
      }

      case 'reynolds': {
        const { velocity, chord } = args;
        if (!velocity || !chord) {
          throw new Error('reynolds requires velocity and chord');
        }

        const re = reynoldsNumber(velocity, chord, atm.density, atm.viscosity);
        const regime = re < 500000 ? 'laminar-transitional' : 'turbulent';

        result = {
          operation: 'reynolds',
          inputs: { velocity, chord, altitude },
          results: { reynolds_number: re, flow_regime: regime, critical_re: 500000 },
        };
        break;
      }

      case 'mach': {
        const { velocity } = args;
        if (!velocity) {
          throw new Error('mach requires velocity');
        }

        const mach = machNumberCalc(velocity, atm.speed_of_sound);
        let regime = 'subsonic';
        if (mach >= 0.8 && mach < 1.2) regime = 'transonic';
        else if (mach >= 1.2 && mach < 5) regime = 'supersonic';
        else if (mach >= 5) regime = 'hypersonic';

        result = {
          operation: 'mach',
          inputs: { velocity, altitude },
          results: {
            mach_number: mach,
            regime,
            speed_of_sound_m_s: atm.speed_of_sound,
            compressibility_important: mach > 0.3,
            prandtl_glauert_factor: mach < 1 ? 1 / Math.sqrt(1 - mach * mach) : null,
          },
        };
        break;
      }

      case 'boundary_layer': {
        const { velocity, distance, chord } = args;
        if (!velocity || !distance) {
          throw new Error('boundary_layer requires velocity and distance');
        }

        const x = distance;
        const re_x = (atm.density * velocity * x) / atm.viscosity;
        const deltaLam = laminarBoundaryLayer(x, re_x);
        const transitional = re_x > 500000;
        const cfTurb = turbulentSkinFriction(re_x);
        const charLength = chord || x;
        const re_c = reynoldsNumber(velocity, charLength, atm.density, atm.viscosity);

        result = {
          operation: 'boundary_layer',
          inputs: { velocity, distance, altitude },
          results: {
            local_reynolds: re_x,
            laminar_thickness_m: deltaLam,
            laminar_thickness_mm: deltaLam * 1000,
            is_transitional: transitional,
            turbulent_skin_friction: cfTurb,
            chord_reynolds: re_c,
          },
        };
        break;
      }

      case 'airfoils': {
        result = {
          operation: 'airfoils',
          available: Object.entries(AIRFOILS).map(([key, val]) => ({
            key,
            name: val.name,
            cl_max: val.cl_max,
            cd_min: val.cd_min,
            stall_angle_deg: val.alpha_stall,
            cl_alpha_per_rad: val.cl_alpha,
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

export function isAerodynamicsAvailable(): boolean {
  return true;
}
