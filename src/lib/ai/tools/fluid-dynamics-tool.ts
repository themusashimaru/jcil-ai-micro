// ============================================================================
// FLUID DYNAMICS TOOL - TIER INFINITY
// ============================================================================
// Fluid mechanics calculations: Navier-Stokes simplified, Reynolds number,
// Bernoulli equation, pipe flow, drag coefficients, and flow analysis.
// Pure TypeScript implementation - no external dependencies.
// ============================================================================

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// CONSTANTS
// ============================================================================

const FLUID_PROPERTIES: Record<string, { density: number; viscosity: number; name: string }> = {
  water_20c: { density: 998, viscosity: 0.001002, name: 'Water at 20°C' },
  water_25c: { density: 997, viscosity: 0.00089, name: 'Water at 25°C' },
  air_20c: { density: 1.204, viscosity: 0.0000181, name: 'Air at 20°C' },
  air_25c: { density: 1.184, viscosity: 0.0000184, name: 'Air at 25°C' },
  oil_sae30: { density: 890, viscosity: 0.29, name: 'SAE 30 Motor Oil' },
  oil_sae10: { density: 870, viscosity: 0.065, name: 'SAE 10 Motor Oil' },
  glycerin: { density: 1260, viscosity: 1.5, name: 'Glycerin' },
  mercury: { density: 13600, viscosity: 0.00155, name: 'Mercury' },
  ethanol: { density: 789, viscosity: 0.0012, name: 'Ethanol' },
  gasoline: { density: 750, viscosity: 0.0006, name: 'Gasoline' },
};

const PIPE_ROUGHNESS: Record<string, number> = {
  smooth: 0,
  drawn_tubing: 0.0000015,
  commercial_steel: 0.000045,
  galvanized_iron: 0.00015,
  cast_iron: 0.00026,
  concrete: 0.003,
  riveted_steel: 0.009,
  pvc: 0.0000015,
  copper: 0.0000015,
};

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

function reynoldsNumber(
  velocity: number,
  length: number,
  density: number,
  viscosity: number
): number {
  return (density * velocity * length) / viscosity;
}

function flowRegime(re: number): string {
  if (re < 2300) return 'laminar';
  if (re < 4000) return 'transitional';
  return 'turbulent';
}

function bernoulli(
  p1: number,
  v1: number,
  h1: number,
  v2: number,
  h2: number,
  density: number
): number {
  const g = 9.81;
  return p1 + 0.5 * density * (v1 * v1 - v2 * v2) + density * g * (h1 - h2);
}

function frictionFactor(re: number, roughness: number, diameter: number): number {
  if (re < 2300) {
    return 64 / re;
  }
  const relRoughness = roughness / diameter;
  return 0.25 / Math.pow(Math.log10(relRoughness / 3.7 + 5.74 / Math.pow(re, 0.9)), 2);
}

function headLoss(f: number, length: number, diameter: number, velocity: number): number {
  const g = 9.81;
  return (f * (length / diameter) * (velocity * velocity)) / (2 * g);
}

function pressureDrop(hL: number, density: number): number {
  const g = 9.81;
  return density * g * hL;
}

function dragForce(density: number, velocity: number, cd: number, area: number): number {
  return 0.5 * density * velocity * velocity * cd * area;
}

function sphereDragCoefficient(re: number): number {
  if (re < 1) return 24 / re;
  if (re < 1000) return (24 / re) * (1 + 0.15 * Math.pow(re, 0.687));
  if (re < 200000) return 0.44;
  return 0.1;
}

function terminalVelocity(mass: number, cd: number, area: number, fluidDensity: number): number {
  const g = 9.81;
  return Math.sqrt((2 * mass * g) / (fluidDensity * cd * area));
}

function volumetricFlowRate(area: number, velocity: number): number {
  return area * velocity;
}

function massFlowRate(density: number, volumetricFlow: number): number {
  return density * volumetricFlow;
}

function froudeNumber(velocity: number, length: number): number {
  return velocity / Math.sqrt(9.81 * length);
}

function machNumber(velocity: number, speedOfSound: number): number {
  return velocity / speedOfSound;
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const fluidDynamicsTool: UnifiedTool = {
  name: 'fluid_dynamics',
  description: `Fluid dynamics and flow calculations.

Operations:
- reynolds: Calculate Reynolds number and flow regime
- bernoulli: Apply Bernoulli equation for pressure/velocity
- pipe_flow: Analyze pipe flow with friction losses
- drag: Calculate drag force on objects
- terminal_velocity: Find terminal velocity of falling objects
- flow_rate: Calculate volumetric and mass flow rates
- fluids: List available fluid properties
- dimensionless: Calculate dimensionless numbers (Re, Fr, Ma)`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'reynolds',
          'bernoulli',
          'pipe_flow',
          'drag',
          'terminal_velocity',
          'flow_rate',
          'fluids',
          'dimensionless',
        ],
        description: 'Calculation to perform',
      },
      fluid: { type: 'string', description: 'Fluid type key' },
      density: { type: 'number', description: 'Fluid density (kg/m³)' },
      viscosity: { type: 'number', description: 'Dynamic viscosity (Pa·s)' },
      velocity: { type: 'number', description: 'Flow velocity (m/s)' },
      v1: { type: 'number', description: 'Velocity at point 1 (m/s)' },
      v2: { type: 'number', description: 'Velocity at point 2 (m/s)' },
      length: { type: 'number', description: 'Characteristic length (m)' },
      diameter: { type: 'number', description: 'Pipe diameter (m)' },
      area: { type: 'number', description: 'Cross-sectional area (m²)' },
      p1: { type: 'number', description: 'Pressure at point 1 (Pa)' },
      h1: { type: 'number', description: 'Height at point 1 (m)' },
      h2: { type: 'number', description: 'Height at point 2 (m)' },
      pipe_length: { type: 'number', description: 'Pipe length (m)' },
      pipe_material: { type: 'string', description: 'Pipe material for roughness' },
      roughness: { type: 'number', description: 'Absolute roughness (m)' },
      cd: { type: 'number', description: 'Drag coefficient' },
      mass: { type: 'number', description: 'Object mass (kg)' },
      object_type: {
        type: 'string',
        enum: ['sphere', 'cylinder', 'flat_plate', 'custom'],
        description: 'Object type for drag',
      },
      speed_of_sound: { type: 'number', description: 'Speed of sound (m/s)' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeFluidDynamics(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    let density = args.density;
    let viscosity = args.viscosity;

    if (args.fluid && FLUID_PROPERTIES[args.fluid]) {
      const fluid = FLUID_PROPERTIES[args.fluid];
      density = density || fluid.density;
      viscosity = viscosity || fluid.viscosity;
    }

    let result: Record<string, unknown>;

    switch (operation) {
      case 'reynolds': {
        const { velocity, length, diameter } = args;
        if (!velocity || !density || !viscosity) {
          throw new Error('reynolds requires velocity, density, and viscosity');
        }
        const charLength = diameter || length || 1;
        const re = reynoldsNumber(velocity, charLength, density, viscosity);
        const regime = flowRegime(re);

        result = {
          operation: 'reynolds',
          inputs: { velocity, characteristic_length: charLength, density, viscosity },
          results: {
            reynolds_number: re,
            flow_regime: regime,
            kinematic_viscosity: viscosity / density,
          },
          interpretation: `Re = ${re.toExponential(3)} indicates ${regime} flow`,
        };
        break;
      }

      case 'bernoulli': {
        const { p1, v1, h1, v2, h2 } = args;
        if (
          p1 === undefined ||
          v1 === undefined ||
          h1 === undefined ||
          v2 === undefined ||
          h2 === undefined ||
          !density
        ) {
          throw new Error('bernoulli requires p1, v1, h1, v2, h2, and density');
        }

        const p2 = bernoulli(p1, v1, h1, v2, h2, density);
        const dynamicP1 = 0.5 * density * v1 * v1;
        const dynamicP2 = 0.5 * density * v2 * v2;

        result = {
          operation: 'bernoulli',
          inputs: { p1, v1, h1, v2, h2, density },
          results: {
            p2_pressure_pa: p2,
            p2_pressure_kpa: p2 / 1000,
            dynamic_pressure_1: dynamicP1,
            dynamic_pressure_2: dynamicP2,
            pressure_change: p2 - p1,
          },
          formula: 'P₁ + ½ρv₁² + ρgh₁ = P₂ + ½ρv₂² + ρgh₂',
        };
        break;
      }

      case 'pipe_flow': {
        const { velocity, diameter, pipe_length } = args;
        if (!velocity || !diameter || !pipe_length || !density || !viscosity) {
          throw new Error(
            'pipe_flow requires velocity, diameter, pipe_length, density, and viscosity'
          );
        }

        const area = Math.PI * Math.pow(diameter / 2, 2);
        const re = reynoldsNumber(velocity, diameter, density, viscosity);
        const regime = flowRegime(re);

        let roughness = args.roughness || 0;
        if (args.pipe_material && PIPE_ROUGHNESS[args.pipe_material] !== undefined) {
          roughness = PIPE_ROUGHNESS[args.pipe_material];
        }

        const f = frictionFactor(re, roughness, diameter);
        const hL = headLoss(f, pipe_length, diameter, velocity);
        const deltaP = pressureDrop(hL, density);
        const Q = volumetricFlowRate(area, velocity);
        const mdot = massFlowRate(density, Q);

        result = {
          operation: 'pipe_flow',
          inputs: { velocity, diameter, pipe_length, density, viscosity, roughness },
          results: {
            reynolds_number: re,
            flow_regime: regime,
            friction_factor: f,
            head_loss_m: hL,
            pressure_drop_pa: deltaP,
            pressure_drop_kpa: deltaP / 1000,
            volumetric_flow_m3_s: Q,
            volumetric_flow_L_min: Q * 60000,
            mass_flow_kg_s: mdot,
            pipe_area_m2: area,
          },
        };
        break;
      }

      case 'drag': {
        const { velocity, area } = args;
        let cd = args.cd;

        if (!velocity || !area || !density) {
          throw new Error('drag requires velocity, area, and density');
        }

        if (args.object_type === 'sphere' && args.diameter) {
          const re = reynoldsNumber(velocity, args.diameter, density, viscosity || 0.0000181);
          cd = sphereDragCoefficient(re);
        }

        if (cd === undefined) {
          cd = 1.0;
        }

        const fd = dragForce(density, velocity, cd, area);
        const dynamicPressure = 0.5 * density * velocity * velocity;

        result = {
          operation: 'drag',
          inputs: { velocity, area, density, cd },
          results: {
            drag_force_n: fd,
            drag_coefficient: cd,
            dynamic_pressure_pa: dynamicPressure,
          },
          formula: 'F_d = ½ρv²C_dA',
        };
        break;
      }

      case 'terminal_velocity': {
        const { mass, area, cd } = args;
        if (!mass || !area || !density) {
          throw new Error('terminal_velocity requires mass, area, and density');
        }

        const dragCoeff = cd || 0.47;
        const vt = terminalVelocity(mass, dragCoeff, area, density);

        result = {
          operation: 'terminal_velocity',
          inputs: { mass, area, density, cd: dragCoeff },
          results: {
            terminal_velocity_m_s: vt,
            terminal_velocity_km_h: vt * 3.6,
            terminal_velocity_mph: vt * 2.237,
          },
          formula: 'v_t = √(2mg / ρC_dA)',
        };
        break;
      }

      case 'flow_rate': {
        const { velocity, area, diameter } = args;
        let flowArea = area;

        if (!flowArea && diameter) {
          flowArea = Math.PI * Math.pow(diameter / 2, 2);
        }

        if (!velocity || !flowArea) {
          throw new Error('flow_rate requires velocity and (area or diameter)');
        }

        const Q = volumetricFlowRate(flowArea, velocity);
        const mdot = density ? massFlowRate(density, Q) : null;

        result = {
          operation: 'flow_rate',
          inputs: { velocity, area: flowArea, density },
          results: {
            volumetric_flow_m3_s: Q,
            volumetric_flow_L_s: Q * 1000,
            volumetric_flow_L_min: Q * 60000,
            volumetric_flow_gpm: Q * 15850.32,
            mass_flow_kg_s: mdot,
            mass_flow_kg_min: mdot ? mdot * 60 : null,
          },
        };
        break;
      }

      case 'fluids': {
        result = {
          operation: 'fluids',
          available: Object.entries(FLUID_PROPERTIES).map(([key, val]) => ({
            key,
            name: val.name,
            density_kg_m3: val.density,
            dynamic_viscosity_pa_s: val.viscosity,
            kinematic_viscosity_m2_s: val.viscosity / val.density,
          })),
          pipe_materials: Object.entries(PIPE_ROUGHNESS).map(([key, val]) => ({
            material: key,
            roughness_m: val,
            roughness_mm: val * 1000,
          })),
        };
        break;
      }

      case 'dimensionless': {
        const { velocity, length, diameter, speed_of_sound } = args;
        const charLength = diameter || length || 1;

        const results: Record<string, unknown> = {};

        if (velocity && density && viscosity) {
          results.reynolds_number = reynoldsNumber(velocity, charLength, density, viscosity);
          results.flow_regime = flowRegime(results.reynolds_number as number);
        }

        if (velocity && charLength) {
          results.froude_number = froudeNumber(velocity, charLength);
          results.froude_regime =
            (results.froude_number as number) < 1 ? 'subcritical' : 'supercritical';
        }

        if (velocity && speed_of_sound) {
          results.mach_number = machNumber(velocity, speed_of_sound);
          const mach = results.mach_number as number;
          results.flow_type =
            mach < 0.3
              ? 'incompressible'
              : mach < 0.8
                ? 'subsonic'
                : mach < 1.2
                  ? 'transonic'
                  : mach < 5
                    ? 'supersonic'
                    : 'hypersonic';
        }

        result = {
          operation: 'dimensionless',
          inputs: {
            velocity,
            characteristic_length: charLength,
            density,
            viscosity,
            speed_of_sound,
          },
          results,
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

export function isFluidDynamicsAvailable(): boolean {
  return true;
}
