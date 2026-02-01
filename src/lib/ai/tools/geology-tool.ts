/**
 * GEOLOGY TOOL
 *
 * Earth science calculations: rock mechanics, plate tectonics,
 * radiometric dating, seismic waves, mineral identification.
 *
 * Part of TIER EARTH SCIENCE - Ultimate Tool Arsenal
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// RADIOMETRIC DATING
// ============================================================================

interface _Isotope {
  name: string;
  halfLife: number; // years
  parent: string;
  daughter: string;
}

const ISOTOPES: Record<string, _Isotope> = {
  c14: { name: 'Carbon-14', halfLife: 5730, parent: '¹⁴C', daughter: '¹⁴N' },
  k40: { name: 'Potassium-40', halfLife: 1.25e9, parent: '⁴⁰K', daughter: '⁴⁰Ar' },
  u238: { name: 'Uranium-238', halfLife: 4.47e9, parent: '²³⁸U', daughter: '²⁰⁶Pb' },
  u235: { name: 'Uranium-235', halfLife: 7.04e8, parent: '²³⁵U', daughter: '²⁰⁷Pb' },
  rb87: { name: 'Rubidium-87', halfLife: 4.88e10, parent: '⁸⁷Rb', daughter: '⁸⁷Sr' },
  th232: { name: 'Thorium-232', halfLife: 1.4e10, parent: '²³²Th', daughter: '²⁰⁸Pb' },
};
// type IsotopeType = Isotope; - reserved for future typed isotope operations

function radiometricAge(parentRatio: number, isotope: string): number {
  const iso = ISOTOPES[isotope];
  if (!iso) throw new Error(`Unknown isotope: ${isotope}`);

  // N = N₀ × e^(-λt), where λ = ln(2)/t½
  // parentRatio = N/N₀
  const lambda = Math.log(2) / iso.halfLife;
  return -Math.log(parentRatio) / lambda;
}

function remainingParent(age: number, isotope: string): number {
  const iso = ISOTOPES[isotope];
  if (!iso) throw new Error(`Unknown isotope: ${isotope}`);

  const lambda = Math.log(2) / iso.halfLife;
  return Math.exp(-lambda * age);
}

// ============================================================================
// MOHS HARDNESS SCALE
// ============================================================================

const MOHS_SCALE: Record<number, { mineral: string; test: string }> = {
  1: { mineral: 'Talc', test: 'Scratched by fingernail' },
  2: { mineral: 'Gypsum', test: 'Scratched by fingernail' },
  3: { mineral: 'Calcite', test: 'Scratched by copper coin' },
  4: { mineral: 'Fluorite', test: 'Scratched by knife easily' },
  5: { mineral: 'Apatite', test: 'Scratched by knife with difficulty' },
  6: { mineral: 'Orthoclase', test: 'Scratches glass' },
  7: { mineral: 'Quartz', test: 'Scratches glass easily' },
  8: { mineral: 'Topaz', test: 'Scratches quartz' },
  9: { mineral: 'Corundum', test: 'Scratches topaz' },
  10: { mineral: 'Diamond', test: 'Scratches everything' },
};

// ============================================================================
// SEISMIC WAVES
// ============================================================================

function pWaveVelocity(density: number, bulkModulus: number, shearModulus: number): number {
  // Vp = √((K + 4/3μ) / ρ)
  return Math.sqrt((bulkModulus + 4/3 * shearModulus) / density);
}

function sWaveVelocity(density: number, shearModulus: number): number {
  // Vs = √(μ / ρ)
  return Math.sqrt(shearModulus / density);
}

function epicenterDistance(pTime: number, sTime: number): number {
  // Simplified: assuming Vp ≈ 6 km/s, Vs ≈ 3.5 km/s
  const Vp = 6;
  const Vs = 3.5;
  const deltaT = sTime - pTime;
  return (Vp * Vs * deltaT) / (Vp - Vs);
}

// ============================================================================
// ROCK MECHANICS
// ============================================================================

function porosity(voidVolume: number, totalVolume: number): number {
  return (voidVolume / totalVolume) * 100;
}

function _permeability(flowRate: number, viscosity: number, length: number, area: number, pressureDiff: number): number {
  // Darcy's law: k = (Q × μ × L) / (A × ΔP)
  return (flowRate * viscosity * length) / (area * pressureDiff);
}

function bulkDensity(grainDensity: number, porosity_frac: number, fluidDensity: number): number {
  return grainDensity * (1 - porosity_frac) + fluidDensity * porosity_frac;
}

// ============================================================================
// PLATE TECTONICS
// ============================================================================

function plateVelocity(distance: number, time: number): number {
  // cm/year
  return (distance / time) * 100;
}

function seafloorAge(distance: number, spreadingRate: number): number {
  // Distance in km, spreading rate in cm/year
  return (distance * 1e5) / spreadingRate;
}

// ============================================================================
// GEOLOGIC TIME
// ============================================================================

const GEOLOGIC_ERAS = [
  { name: 'Cenozoic', start: 66e6, end: 0, periods: ['Quaternary', 'Neogene', 'Paleogene'] },
  { name: 'Mesozoic', start: 252e6, end: 66e6, periods: ['Cretaceous', 'Jurassic', 'Triassic'] },
  { name: 'Paleozoic', start: 541e6, end: 252e6, periods: ['Permian', 'Carboniferous', 'Devonian', 'Silurian', 'Ordovician', 'Cambrian'] },
  { name: 'Precambrian', start: 4.6e9, end: 541e6, periods: ['Proterozoic', 'Archean', 'Hadean'] },
];

function geologicEra(age: number): { era: string; period: string } {
  for (const era of GEOLOGIC_ERAS) {
    if (age >= era.end && age < era.start) {
      return { era: era.name, period: era.periods[0] };
    }
  }
  return { era: 'Unknown', period: 'Unknown' };
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const geologyTool: UnifiedTool = {
  name: 'geology',
  description: `Earth science and geology calculations.

Operations:
- dating: Radiometric age dating (C-14, K-Ar, U-Pb, etc.)
- hardness: Mohs hardness scale lookup
- seismic: Seismic wave calculations
- rock_properties: Porosity, permeability, density
- plate_tectonics: Plate movement and seafloor spreading
- geologic_time: Era/period from age`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['dating', 'hardness', 'seismic', 'rock_properties', 'plate_tectonics', 'geologic_time'],
        description: 'Geology operation',
      },
      isotope: { type: 'string', enum: ['c14', 'k40', 'u238', 'u235', 'rb87', 'th232'], description: 'Isotope for dating' },
      parent_ratio: { type: 'number', description: 'Remaining parent isotope ratio (0-1)' },
      age: { type: 'number', description: 'Age in years' },
      hardness: { type: 'number', description: 'Mohs hardness value (1-10)' },
      p_arrival: { type: 'number', description: 'P-wave arrival time (s)' },
      s_arrival: { type: 'number', description: 'S-wave arrival time (s)' },
      density: { type: 'number', description: 'Density (kg/m³)' },
      bulk_modulus: { type: 'number', description: 'Bulk modulus (Pa)' },
      shear_modulus: { type: 'number', description: 'Shear modulus (Pa)' },
      void_volume: { type: 'number', description: 'Void volume' },
      total_volume: { type: 'number', description: 'Total volume' },
      distance: { type: 'number', description: 'Distance (km)' },
      time: { type: 'number', description: 'Time (years)' },
      spreading_rate: { type: 'number', description: 'Spreading rate (cm/year)' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeGeology(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'dating': {
        const { isotope = 'c14', parent_ratio, age: inputAge } = args;
        const iso = ISOTOPES[isotope];
        if (!iso) throw new Error(`Unknown isotope: ${isotope}`);

        if (parent_ratio !== undefined) {
          const age = radiometricAge(parent_ratio, isotope);
          const era = geologicEra(age);

          result = {
            operation: 'dating',
            mode: 'calculate_age',
            isotope: iso.name,
            decay_chain: `${iso.parent} → ${iso.daughter}`,
            half_life_years: iso.halfLife,
            remaining_parent_fraction: parent_ratio,
            calculated_age_years: Math.round(age),
            age_formatted: age > 1e6 ? `${(age / 1e6).toFixed(1)} Ma` : `${Math.round(age)} years`,
            geologic_era: era.era,
          };
        } else if (inputAge !== undefined) {
          const remaining = remainingParent(inputAge, isotope);

          result = {
            operation: 'dating',
            mode: 'calculate_remaining',
            isotope: iso.name,
            half_life_years: iso.halfLife,
            age_years: inputAge,
            remaining_parent_fraction: remaining.toExponential(4),
            remaining_parent_percent: (remaining * 100).toExponential(4),
          };
        } else {
          throw new Error('Provide either parent_ratio or age');
        }
        break;
      }

      case 'hardness': {
        const { hardness = 7 } = args;
        const h = Math.round(Math.max(1, Math.min(10, hardness)));
        const info = MOHS_SCALE[h];

        result = {
          operation: 'hardness',
          mohs_hardness: h,
          reference_mineral: info.mineral,
          field_test: info.test,
          scale: Object.entries(MOHS_SCALE).map(([k, v]) => ({
            hardness: Number(k),
            mineral: v.mineral,
            current: Number(k) === h,
          })),
        };
        break;
      }

      case 'seismic': {
        const { p_arrival, s_arrival, density = 2700, bulk_modulus = 4e10, shear_modulus = 3e10 } = args;

        if (p_arrival !== undefined && s_arrival !== undefined) {
          const dist = epicenterDistance(p_arrival, s_arrival);

          result = {
            operation: 'seismic',
            mode: 'locate_epicenter',
            p_wave_arrival_s: p_arrival,
            s_wave_arrival_s: s_arrival,
            time_difference_s: s_arrival - p_arrival,
            estimated_distance_km: Math.round(dist * 10) / 10,
            note: 'Need 3+ stations for triangulation',
          };
        } else {
          const vp = pWaveVelocity(density, bulk_modulus, shear_modulus);
          const vs = sWaveVelocity(density, shear_modulus);

          result = {
            operation: 'seismic',
            mode: 'wave_velocities',
            density_kg_m3: density,
            bulk_modulus_Pa: bulk_modulus,
            shear_modulus_Pa: shear_modulus,
            p_wave_velocity_m_s: Math.round(vp),
            s_wave_velocity_m_s: Math.round(vs),
            vp_vs_ratio: Math.round(vp / vs * 100) / 100,
          };
        }
        break;
      }

      case 'rock_properties': {
        const { void_volume = 0.2, total_volume = 1, density = 2650 } = args;
        const phi = porosity(void_volume, total_volume);
        const phi_frac = phi / 100;
        const bulkDens = bulkDensity(density, phi_frac, 1000);

        result = {
          operation: 'rock_properties',
          void_volume: void_volume,
          total_volume: total_volume,
          porosity_percent: Math.round(phi * 100) / 100,
          grain_density_kg_m3: density,
          bulk_density_saturated_kg_m3: Math.round(bulkDens),
          rock_type_estimate: phi < 5 ? 'Crystalline/Dense' : phi < 15 ? 'Well-cemented sedimentary' : phi < 30 ? 'Sandstone/Limestone' : 'Unconsolidated/High porosity',
        };
        break;
      }

      case 'plate_tectonics': {
        const { distance, time, spreading_rate } = args;

        if (distance !== undefined && spreading_rate !== undefined) {
          const age = seafloorAge(distance, spreading_rate);
          const era = geologicEra(age);

          result = {
            operation: 'plate_tectonics',
            mode: 'seafloor_age',
            distance_from_ridge_km: distance,
            spreading_rate_cm_yr: spreading_rate,
            seafloor_age_years: Math.round(age),
            age_formatted: age > 1e6 ? `${(age / 1e6).toFixed(1)} Ma` : `${Math.round(age)} years`,
            geologic_era: era.era,
          };
        } else if (distance !== undefined && time !== undefined) {
          const velocity = plateVelocity(distance * 1000, time);

          result = {
            operation: 'plate_tectonics',
            mode: 'plate_velocity',
            distance_km: distance,
            time_years: time,
            velocity_cm_yr: Math.round(velocity * 100) / 100,
            velocity_mm_yr: Math.round(velocity * 10),
            comparison: velocity < 2 ? 'Slow (like fingernail growth)' : velocity < 6 ? 'Moderate' : 'Fast (like hair growth)',
          };
        } else {
          throw new Error('Provide distance with either time or spreading_rate');
        }
        break;
      }

      case 'geologic_time': {
        const { age = 100e6 } = args;
        const era = geologicEra(age);

        result = {
          operation: 'geologic_time',
          age_years: age,
          age_formatted: age > 1e9 ? `${(age / 1e9).toFixed(2)} Ga` : age > 1e6 ? `${(age / 1e6).toFixed(1)} Ma` : `${Math.round(age)} years`,
          era: era.era,
          period: era.period,
          geologic_time_scale: GEOLOGIC_ERAS.map(e => ({
            era: e.name,
            start_Ma: e.start / 1e6,
            end_Ma: e.end / 1e6,
            current: age >= e.end && age < e.start,
          })),
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (error) {
    return { toolCallId: id, content: `Geology Error: ${error instanceof Error ? error.message : 'Unknown'}`, isError: true };
  }
}

export function isGeologyAvailable(): boolean { return true; }

// ESLint unused function references
void _permeability;
