// ============================================================================
// MATERIALS SCIENCE TOOL - TIER BEYOND
// ============================================================================
// Materials properties: crystal structures, phase diagrams, hardness.
// Pure TypeScript implementation - no external dependencies.
// ============================================================================

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

const CRYSTAL_STRUCTURES: Record<
  string,
  { atoms_per_cell: number; packing_factor: number; coordination: number; examples: string[] }
> = {
  fcc: {
    atoms_per_cell: 4,
    packing_factor: 0.74,
    coordination: 12,
    examples: ['Al', 'Cu', 'Au', 'Ag', 'Ni', 'Pb'],
  },
  bcc: {
    atoms_per_cell: 2,
    packing_factor: 0.68,
    coordination: 8,
    examples: ['Fe', 'Cr', 'W', 'Mo', 'V', 'Na'],
  },
  hcp: {
    atoms_per_cell: 6,
    packing_factor: 0.74,
    coordination: 12,
    examples: ['Ti', 'Zn', 'Mg', 'Co', 'Zr'],
  },
  simple_cubic: { atoms_per_cell: 1, packing_factor: 0.52, coordination: 6, examples: ['Po'] },
  diamond: {
    atoms_per_cell: 8,
    packing_factor: 0.34,
    coordination: 4,
    examples: ['C', 'Si', 'Ge'],
  },
};

const MATERIALS: Record<
  string,
  {
    density: number;
    melting_point: number;
    hardness_mohs: number;
    thermal_conductivity: number;
    electrical_resistivity: number;
    crystal: string;
  }
> = {
  iron: {
    density: 7874,
    melting_point: 1538,
    hardness_mohs: 4,
    thermal_conductivity: 80,
    electrical_resistivity: 9.7e-8,
    crystal: 'bcc',
  },
  aluminum: {
    density: 2700,
    melting_point: 660,
    hardness_mohs: 2.75,
    thermal_conductivity: 237,
    electrical_resistivity: 2.65e-8,
    crystal: 'fcc',
  },
  copper: {
    density: 8960,
    melting_point: 1085,
    hardness_mohs: 3,
    thermal_conductivity: 401,
    electrical_resistivity: 1.68e-8,
    crystal: 'fcc',
  },
  titanium: {
    density: 4506,
    melting_point: 1668,
    hardness_mohs: 6,
    thermal_conductivity: 21.9,
    electrical_resistivity: 4.2e-7,
    crystal: 'hcp',
  },
  tungsten: {
    density: 19300,
    melting_point: 3422,
    hardness_mohs: 7.5,
    thermal_conductivity: 173,
    electrical_resistivity: 5.28e-8,
    crystal: 'bcc',
  },
  gold: {
    density: 19320,
    melting_point: 1064,
    hardness_mohs: 2.5,
    thermal_conductivity: 318,
    electrical_resistivity: 2.44e-8,
    crystal: 'fcc',
  },
  silver: {
    density: 10490,
    melting_point: 962,
    hardness_mohs: 2.5,
    thermal_conductivity: 429,
    electrical_resistivity: 1.59e-8,
    crystal: 'fcc',
  },
  diamond: {
    density: 3520,
    melting_point: 3550,
    hardness_mohs: 10,
    thermal_conductivity: 2200,
    electrical_resistivity: 1e16,
    crystal: 'diamond',
  },
};

// Lattice parameter from atomic radius
function latticeParamFCC(atomicRadius: number): number {
  return 2 * Math.sqrt(2) * atomicRadius;
}
function latticeParamBCC(atomicRadius: number): number {
  return (4 * atomicRadius) / Math.sqrt(3);
}

// Theoretical density
function theoreticalDensity(
  atomicMass: number,
  atomsPerCell: number,
  latticeParam: number
): number {
  const avogadro = 6.022e23;
  return ((atomsPerCell * atomicMass) / (avogadro * Math.pow(latticeParam, 3))) * 1e30; // kg/m³
}

// Hall-Petch: σy = σ0 + k/√d
function hallPetch(sigma0: number, k: number, grainSize: number): number {
  return sigma0 + k / Math.sqrt(grainSize);
}

// Arrhenius diffusion: D = D0 * exp(-Q/RT)
function diffusionCoeff(D0: number, Q: number, T: number): number {
  const R = 8.314;
  return D0 * Math.exp(-Q / (R * T));
}

// Hardness conversions (approximate)
function mohsToVickers(mohs: number): number {
  // Approximate exponential relationship
  return Math.pow(10, 0.3 * mohs + 0.5);
}

function mohsToRockwellC(mohs: number): number {
  // Very approximate
  return mohs * 8 - 10;
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const materialsScienceTool: UnifiedTool = {
  name: 'materials_science',
  description: `Materials science: crystal structures, properties, phase diagrams.`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'crystal',
          'material',
          'lattice',
          'density',
          'hall_petch',
          'diffusion',
          'hardness',
          'compare',
        ],
        description: 'Materials science calculation to perform',
      },
      structure: { type: 'string', description: 'Crystal structure type' },
      material: { type: 'string', description: 'Material name' },
      atomic_radius: { type: 'number', description: 'Atomic radius in pm' },
      atomic_mass: { type: 'number', description: 'Atomic mass in g/mol' },
      grain_size: { type: 'number', description: 'Grain size in meters' },
      sigma0: { type: 'number', description: 'Friction stress in MPa' },
      k: { type: 'number', description: 'Hall-Petch constant' },
      temperature: { type: 'number', description: 'Temperature in Kelvin' },
      D0: { type: 'number', description: 'Pre-exponential diffusion factor' },
      Q: { type: 'number', description: 'Activation energy J/mol' },
      mohs: { type: 'number', description: 'Mohs hardness value' },
      materials: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of materials to compare',
      },
    },
    required: ['operation'],
  },
};

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeMaterialsScience(
  toolCall: UnifiedToolCall
): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'crystal': {
        const structure = args.structure || 'fcc';
        const data = CRYSTAL_STRUCTURES[structure];
        if (!data)
          throw new Error(
            `Unknown structure: ${structure}. Available: ${Object.keys(CRYSTAL_STRUCTURES).join(', ')}`
          );
        result = {
          operation: 'crystal',
          structure,
          atoms_per_unit_cell: data.atoms_per_cell,
          atomic_packing_factor: data.packing_factor,
          coordination_number: data.coordination,
          example_elements: data.examples,
        };
        break;
      }
      case 'material': {
        const mat = args.material || 'iron';
        const data = MATERIALS[mat];
        if (!data)
          throw new Error(
            `Unknown material: ${mat}. Available: ${Object.keys(MATERIALS).join(', ')}`
          );
        result = {
          operation: 'material',
          material: mat,
          density_kg_m3: data.density,
          melting_point_c: data.melting_point,
          hardness_mohs: data.hardness_mohs,
          hardness_vickers_approx: +mohsToVickers(data.hardness_mohs).toFixed(0),
          thermal_conductivity_w_mk: data.thermal_conductivity,
          electrical_resistivity_ohm_m: data.electrical_resistivity,
          crystal_structure: data.crystal,
        };
        break;
      }
      case 'lattice': {
        const radius = args.atomic_radius || 125; // pm
        result = {
          operation: 'lattice',
          atomic_radius_pm: radius,
          fcc_lattice_param_pm: +latticeParamFCC(radius).toFixed(1),
          bcc_lattice_param_pm: +latticeParamBCC(radius).toFixed(1),
          fcc_lattice_param_angstrom: +(latticeParamFCC(radius) / 100).toFixed(3),
        };
        break;
      }
      case 'density': {
        const { atomic_mass, structure, atomic_radius } = args;
        if (!atomic_mass || !structure || !atomic_radius)
          throw new Error('density requires atomic_mass, structure, atomic_radius');
        const crystalData = CRYSTAL_STRUCTURES[structure];
        if (!crystalData) throw new Error(`Unknown structure: ${structure}`);
        const latticeParam =
          structure === 'fcc'
            ? latticeParamFCC(atomic_radius * 1e-12)
            : latticeParamBCC(atomic_radius * 1e-12);
        const rho = theoreticalDensity(
          atomic_mass / 1000,
          crystalData.atoms_per_cell,
          latticeParam
        );
        result = {
          operation: 'density',
          inputs: { atomic_mass, structure, atomic_radius },
          theoretical_density_kg_m3: +rho.toFixed(0),
          lattice_parameter_m: +latticeParam.toExponential(4),
        };
        break;
      }
      case 'hall_petch': {
        const sigma0 = args.sigma0 || 50; // MPa
        const k = args.k || 0.5; // MPa·m^0.5
        const grainSize = args.grain_size || 10e-6; // 10 μm
        const yieldStrength = hallPetch(sigma0, k, grainSize);
        result = {
          operation: 'hall_petch',
          friction_stress_mpa: sigma0,
          hall_petch_constant: k,
          grain_size_um: +(grainSize * 1e6).toFixed(2),
          yield_strength_mpa: +yieldStrength.toFixed(1),
          note: 'Smaller grains = higher strength',
        };
        break;
      }
      case 'diffusion': {
        const D0 = args.D0 || 1e-4; // m²/s
        const Q = args.Q || 100000; // J/mol
        const T = args.temperature || 1000; // K
        const D = diffusionCoeff(D0, Q, T);
        result = {
          operation: 'diffusion',
          D0_m2_s: D0,
          Q_j_mol: Q,
          temperature_k: T,
          diffusion_coefficient_m2_s: +D.toExponential(4),
          diffusion_length_1hr_um: +(Math.sqrt(D * 3600) * 1e6).toFixed(2),
        };
        break;
      }
      case 'hardness': {
        const mohs = args.mohs || 5;
        result = {
          operation: 'hardness',
          mohs_hardness: mohs,
          vickers_approx: +mohsToVickers(mohs).toFixed(0),
          rockwell_c_approx: +mohsToRockwellC(mohs).toFixed(0),
          reference: {
            talc: 1,
            gypsum: 2,
            calcite: 3,
            fluorite: 4,
            apatite: 5,
            feldspar: 6,
            quartz: 7,
            topaz: 8,
            corundum: 9,
            diamond: 10,
          },
        };
        break;
      }
      case 'compare': {
        const mats = args.materials || ['iron', 'aluminum', 'copper'];
        const comparison = mats.map((m: string) => {
          const data = MATERIALS[m];
          if (!data) return { material: m, error: 'not found' };
          return {
            material: m,
            density: data.density,
            melting_point: data.melting_point,
            thermal_conductivity: data.thermal_conductivity,
            crystal: data.crystal,
          };
        });
        result = { operation: 'compare', materials: comparison };
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

export function isMaterialsScienceAvailable(): boolean {
  return true;
}
