// ============================================================================
// FINITE ELEMENT TOOL - TIER BEYOND
// ============================================================================
// Structural analysis: stress/strain, beam deflection, truss analysis.
// Pure TypeScript implementation - no external dependencies.
// ============================================================================

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Material properties
const MATERIALS: Record<
  string,
  { E: number; yield_strength: number; density: number; poisson: number; name: string }
> = {
  steel: { E: 200e9, yield_strength: 250e6, density: 7850, poisson: 0.3, name: 'Structural Steel' },
  aluminum: { E: 70e9, yield_strength: 270e6, density: 2700, poisson: 0.33, name: 'Aluminum 6061' },
  titanium: {
    E: 116e9,
    yield_strength: 880e6,
    density: 4500,
    poisson: 0.34,
    name: 'Titanium Ti-6Al-4V',
  },
  concrete: { E: 30e9, yield_strength: 30e6, density: 2400, poisson: 0.2, name: 'Concrete' },
  wood_oak: { E: 12e9, yield_strength: 40e6, density: 700, poisson: 0.35, name: 'Oak Wood' },
  carbon_fiber: {
    E: 230e9,
    yield_strength: 3500e6,
    density: 1600,
    poisson: 0.27,
    name: 'Carbon Fiber',
  },
};

// Axial stress: σ = F/A
function axialStress(force: number, area: number): number {
  return force / area;
}

// Axial strain: ε = σ/E
function axialStrain(stress: number, E: number): number {
  return stress / E;
}

// Deformation: δ = FL/(AE)
function axialDeformation(force: number, length: number, area: number, E: number): number {
  return (force * length) / (area * E);
}

// Bending stress: σ = My/I
function bendingStress(moment: number, y: number, I: number): number {
  return (moment * y) / I;
}

// Moment of inertia - rectangle: I = bh³/12
function momentOfInertiaRect(b: number, h: number): number {
  return (b * Math.pow(h, 3)) / 12;
}

// Moment of inertia - circle: I = πd⁴/64
function momentOfInertiaCircle(d: number): number {
  return (Math.PI * Math.pow(d, 4)) / 64;
}

// Beam deflection - cantilever with point load: δ = FL³/(3EI)
function cantileverPointLoad(
  F: number,
  L: number,
  E: number,
  I: number
): { max_deflection: number; max_moment: number } {
  return {
    max_deflection: (F * Math.pow(L, 3)) / (3 * E * I),
    max_moment: F * L,
  };
}

// Safety factor
function safetyFactor(yieldStrength: number, appliedStress: number): number {
  return yieldStrength / Math.abs(appliedStress);
}

// Von Mises stress (2D): σ_vm = √(σx² - σxσy + σy² + 3τxy²)
function vonMisesStress2D(sigmaX: number, sigmaY: number, tauXY: number): number {
  return Math.sqrt(sigmaX * sigmaX - sigmaX * sigmaY + sigmaY * sigmaY + 3 * tauXY * tauXY);
}

// Buckling load (Euler): Pcr = π²EI/(KL)²
function eulerBuckling(E: number, I: number, L: number, K: number = 1): number {
  return (Math.PI * Math.PI * E * I) / Math.pow(K * L, 2);
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const finiteElementTool: UnifiedTool = {
  name: 'finite_element',
  description: `Structural mechanics: stress/strain, beam analysis, buckling.`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'axial',
          'bending',
          'beam_cantilever',
          'beam_simple',
          'buckling',
          'von_mises',
          'materials',
        ],
        description: 'Structural analysis to perform',
      },
      force: { type: 'number', description: 'Applied force in Newtons' },
      moment: { type: 'number', description: 'Applied moment in N-m' },
      length: { type: 'number', description: 'Length in meters' },
      area: { type: 'number', description: 'Cross-sectional area in m^2' },
      width: { type: 'number', description: 'Width in meters' },
      height: { type: 'number', description: 'Height in meters' },
      diameter: { type: 'number', description: 'Diameter in meters' },
      material: { type: 'string', description: 'Material name' },
      E: { type: 'number', description: "Young's modulus in Pa" },
      yield_strength: { type: 'number', description: 'Yield strength in Pa' },
      sigma_x: { type: 'number', description: 'Normal stress in x direction (Pa)' },
      sigma_y: { type: 'number', description: 'Normal stress in y direction (Pa)' },
      tau_xy: { type: 'number', description: 'Shear stress (Pa)' },
      end_condition: {
        type: 'string',
        enum: ['pinned_pinned', 'fixed_free', 'fixed_pinned', 'fixed_fixed'],
        description: 'Column end conditions for buckling',
      },
    },
    required: ['operation'],
  },
};

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeFiniteElement(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    let mat = MATERIALS['steel'];
    if (args.material && MATERIALS[args.material]) {
      mat = MATERIALS[args.material];
    }
    const E = args.E || mat.E;
    const yieldStr = args.yield_strength || mat.yield_strength;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'axial': {
        const { force, area, length } = args;
        if (!force || !area) throw new Error('axial requires force and area');
        const stress = axialStress(force, area);
        const strain = axialStrain(stress, E);
        const deform = length ? axialDeformation(force, length, area, E) : null;
        const sf = safetyFactor(yieldStr, stress);
        result = {
          operation: 'axial',
          inputs: { force, area, length, material: args.material || 'steel' },
          results: {
            stress_pa: stress,
            stress_mpa: +(stress / 1e6).toFixed(2),
            strain: +strain.toExponential(4),
            deformation_m: deform ? +deform.toExponential(4) : null,
            safety_factor: +sf.toFixed(2),
            will_yield: sf < 1,
          },
        };
        break;
      }
      case 'bending': {
        const { moment, width, height, diameter } = args;
        if (!moment) throw new Error('bending requires moment');
        let I: number, y: number;
        if (diameter) {
          I = momentOfInertiaCircle(diameter);
          y = diameter / 2;
        } else if (width && height) {
          I = momentOfInertiaRect(width, height);
          y = height / 2;
        } else {
          throw new Error('bending requires (width, height) or diameter');
        }
        const stress = bendingStress(moment, y, I);
        const sf = safetyFactor(yieldStr, stress);
        result = {
          operation: 'bending',
          inputs: { moment, width, height, diameter },
          results: {
            moment_of_inertia_m4: +I.toExponential(4),
            max_stress_pa: +Math.abs(stress).toExponential(4),
            max_stress_mpa: +(Math.abs(stress) / 1e6).toFixed(2),
            safety_factor: +sf.toFixed(2),
          },
        };
        break;
      }
      case 'beam_cantilever': {
        const { force, length, width, height, diameter } = args;
        if (!force || !length) throw new Error('beam_cantilever requires force and length');
        let I: number;
        if (diameter) I = momentOfInertiaCircle(diameter);
        else if (width && height) I = momentOfInertiaRect(width, height);
        else throw new Error('Requires (width, height) or diameter');
        const beamResult = cantileverPointLoad(force, length, E, I);
        const y = diameter ? diameter / 2 : height! / 2;
        const maxStress = bendingStress(beamResult.max_moment, y, I);
        result = {
          operation: 'beam_cantilever',
          results: {
            max_deflection_m: +beamResult.max_deflection.toExponential(4),
            max_deflection_mm: +(beamResult.max_deflection * 1000).toFixed(3),
            max_moment_nm: +beamResult.max_moment.toFixed(2),
            max_stress_mpa: +(Math.abs(maxStress) / 1e6).toFixed(2),
          },
        };
        break;
      }
      case 'beam_simple': {
        const { force, length, width, height, diameter } = args;
        if (!force || !length) throw new Error('beam_simple requires force and length');
        let I: number;
        if (diameter) I = momentOfInertiaCircle(diameter);
        else if (width && height) I = momentOfInertiaRect(width, height);
        else throw new Error('Requires (width, height) or diameter');
        const deflection = (force * Math.pow(length, 3)) / (48 * E * I);
        const maxMoment = (force * length) / 4;
        const y = diameter ? diameter / 2 : height! / 2;
        const maxStress = bendingStress(maxMoment, y, I);
        result = {
          operation: 'beam_simple',
          results: {
            max_deflection_mm: +(deflection * 1000).toFixed(3),
            max_moment_nm: +maxMoment.toFixed(2),
            max_stress_mpa: +(Math.abs(maxStress) / 1e6).toFixed(2),
          },
        };
        break;
      }
      case 'buckling': {
        const { length, width, height, diameter, end_condition } = args;
        if (!length) throw new Error('buckling requires length');
        let I: number;
        if (diameter) I = momentOfInertiaCircle(diameter);
        else if (width && height) I = momentOfInertiaRect(width, height);
        else throw new Error('Requires (width, height) or diameter');
        const K =
          end_condition === 'fixed_free'
            ? 2
            : end_condition === 'fixed_pinned'
              ? 0.7
              : end_condition === 'fixed_fixed'
                ? 0.5
                : 1;
        const Pcr = eulerBuckling(E, I, length, K);
        result = {
          operation: 'buckling',
          end_condition: end_condition || 'pinned_pinned',
          K_factor: K,
          critical_load_n: +Pcr.toFixed(2),
          critical_load_kn: +(Pcr / 1000).toFixed(2),
        };
        break;
      }
      case 'von_mises': {
        const { sigma_x, sigma_y, tau_xy } = args;
        const sx = sigma_x || 0,
          sy = sigma_y || 0,
          txy = tau_xy || 0;
        const vm = vonMisesStress2D(sx, sy, txy);
        const sf = safetyFactor(yieldStr, vm);
        result = {
          operation: 'von_mises',
          inputs: { sigma_x: sx, sigma_y: sy, tau_xy: txy },
          von_mises_stress_pa: +vm.toFixed(2),
          von_mises_stress_mpa: +(vm / 1e6).toFixed(2),
          safety_factor: +sf.toFixed(2),
          will_yield: sf < 1,
        };
        break;
      }
      case 'materials': {
        result = {
          operation: 'materials',
          available: Object.entries(MATERIALS).map(([k, v]) => ({
            key: k,
            name: v.name,
            youngs_modulus_gpa: +(v.E / 1e9).toFixed(0),
            yield_strength_mpa: +(v.yield_strength / 1e6).toFixed(0),
            density_kg_m3: v.density,
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

export function isFiniteElementAvailable(): boolean {
  return true;
}
