// ============================================================================
// SEISMOLOGY TOOL - TIER BEYOND
// ============================================================================
// Earthquake and wave modeling: magnitude, intensity, wave propagation.
// Pure TypeScript implementation - no external dependencies.
// ============================================================================

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Richter magnitude to energy (Joules): log10(E) = 1.5*M + 4.8
function magnitudeToEnergy(magnitude: number): number {
  return Math.pow(10, 1.5 * magnitude + 4.8);
}

// Energy to magnitude
function energyToMagnitude(energy: number): number {
  return (Math.log10(energy) - 4.8) / 1.5;
}

// Magnitude difference to energy ratio
function magnitudeEnergyRatio(m1: number, m2: number): number {
  return Math.pow(10, 1.5 * (m1 - m2));
}

// Travel time for direct wave
function travelTime(distance: number, velocity: number): number {
  return distance / velocity;
}

// Epicentral distance from S-P time difference
function epicentralDistance(spTimeDiff: number, vp: number, vs: number): number {
  return spTimeDiff / (1 / vs - 1 / vp);
}

// Peak Ground Acceleration (simplified attenuation)
function peakGroundAcceleration(magnitude: number, distance: number): number {
  // Simplified Boore-Atkinson type relation
  const logPGA = 0.5 * magnitude - Math.log10(distance) - 2;
  return Math.pow(10, logPGA); // g
}

// Modified Mercalli Intensity from PGA (approximate)
function pgaToMMI(pga: number): number {
  // pga in g
  if (pga < 0.0017) return 1;
  if (pga < 0.014) return 2 + Math.log10(pga / 0.0017) / Math.log10(0.014 / 0.0017);
  return 2 + 2.5 * Math.log10(pga / 0.0017);
}

// Seismic moment from magnitude: log10(M0) = 1.5*Mw + 9.1
function momentFromMagnitude(mw: number): number {
  return Math.pow(10, 1.5 * mw + 9.1);
}

// Fault parameters from moment: M0 = μ * A * D
function faultSlip(M0: number, area: number, shearModulus: number = 3e10): number {
  return M0 / (shearModulus * area);
}

const ROCK_PROPERTIES: Record<string, { vp: number; vs: number; density: number }> = {
  granite: { vp: 5500, vs: 3300, density: 2700 },
  basalt: { vp: 6000, vs: 3500, density: 2900 },
  sandstone: { vp: 3500, vs: 2000, density: 2400 },
  limestone: { vp: 4500, vs: 2500, density: 2600 },
  shale: { vp: 3000, vs: 1500, density: 2400 },
  soil: { vp: 500, vs: 250, density: 1800 },
  water: { vp: 1500, vs: 0, density: 1000 },
};

const MAGNITUDE_EFFECTS: { min: number; max: number; description: string; frequency: string }[] = [
  { min: 0, max: 2, description: 'Micro - not felt', frequency: 'About 8000/day' },
  { min: 2, max: 4, description: 'Minor - felt by some', frequency: 'About 1000/day' },
  { min: 4, max: 5, description: 'Light - felt by most, minor damage', frequency: 'About 50/day' },
  { min: 5, max: 6, description: 'Moderate - damage to weak structures', frequency: 'About 3/day' },
  {
    min: 6,
    max: 7,
    description: 'Strong - damage in populated areas',
    frequency: 'About 120/year',
  },
  {
    min: 7,
    max: 8,
    description: 'Major - serious damage over large areas',
    frequency: 'About 15/year',
  },
  {
    min: 8,
    max: 10,
    description: 'Great - devastating over hundreds of km',
    frequency: 'About 1/year',
  },
];

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const seismologyTool: UnifiedTool = {
  name: 'seismology',
  description: `Seismology: earthquake magnitude, wave propagation, ground motion.`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'magnitude_energy',
          'wave_velocity',
          'travel_time',
          'locate',
          'ground_motion',
          'fault',
          'rocks',
          'scale',
        ],
        description: 'Seismological calculation to perform',
      },
      magnitude: { type: 'number', description: 'Earthquake magnitude' },
      energy: { type: 'number', description: 'Energy in Joules' },
      distance: { type: 'number', description: 'Distance in km' },
      sp_time: { type: 'number', description: 'S-P time difference in seconds' },
      rock_type: { type: 'string', description: 'Rock type for wave velocity' },
      vp: { type: 'number', description: 'P-wave velocity m/s' },
      vs: { type: 'number', description: 'S-wave velocity m/s' },
      fault_area: { type: 'number', description: 'Fault area in km^2' },
      fault_slip: { type: 'number', description: 'Fault slip in meters' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeSeismology(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'magnitude_energy': {
        if (args.magnitude !== undefined) {
          const E = magnitudeToEnergy(args.magnitude);
          const tntTons = E / 4.184e9;
          result = {
            operation: 'magnitude_energy',
            magnitude: args.magnitude,
            energy_joules: +E.toExponential(3),
            energy_tnt_tons: +tntTons.toExponential(2),
            energy_tnt_kilotons: +(tntTons / 1000).toExponential(2),
            comparison_to_m5: +magnitudeEnergyRatio(args.magnitude, 5).toFixed(1) + 'x',
          };
        } else if (args.energy !== undefined) {
          const M = energyToMagnitude(args.energy);
          result = {
            operation: 'magnitude_energy',
            energy_joules: args.energy,
            magnitude: +M.toFixed(1),
          };
        } else {
          throw new Error('magnitude_energy requires magnitude or energy');
        }
        break;
      }
      case 'wave_velocity': {
        const rock = args.rock_type || 'granite';
        const props = ROCK_PROPERTIES[rock];
        if (!props)
          throw new Error(
            `Unknown rock: ${rock}. Available: ${Object.keys(ROCK_PROPERTIES).join(', ')}`
          );
        result = {
          operation: 'wave_velocity',
          rock_type: rock,
          p_wave_velocity_m_s: props.vp,
          s_wave_velocity_m_s: props.vs,
          density_kg_m3: props.density,
          vp_vs_ratio: props.vs > 0 ? +(props.vp / props.vs).toFixed(2) : 'N/A',
        };
        break;
      }
      case 'travel_time': {
        const dist = (args.distance || 100) * 1000; // km to m
        const rock = args.rock_type || 'granite';
        const props = ROCK_PROPERTIES[rock];
        if (!props) throw new Error(`Unknown rock: ${rock}`);
        const tP = travelTime(dist, props.vp);
        const tS = props.vs > 0 ? travelTime(dist, props.vs) : null;
        result = {
          operation: 'travel_time',
          distance_km: args.distance || 100,
          rock_type: rock,
          p_wave_arrival_s: +tP.toFixed(2),
          s_wave_arrival_s: tS ? +tS.toFixed(2) : 'N/A (no shear in fluid)',
          sp_time_diff_s: tS ? +(tS - tP).toFixed(2) : 'N/A',
        };
        break;
      }
      case 'locate': {
        const spTime = args.sp_time || 10;
        const rock = args.rock_type || 'granite';
        const props = ROCK_PROPERTIES[rock];
        if (!props || props.vs === 0) throw new Error('Cannot locate with fluid medium');
        const dist = epicentralDistance(spTime, props.vp, props.vs);
        result = {
          operation: 'locate',
          sp_time_difference_s: spTime,
          rock_type: rock,
          epicentral_distance_km: +(dist / 1000).toFixed(1),
          note: 'Need 3+ stations for triangulation',
        };
        break;
      }
      case 'ground_motion': {
        const M = args.magnitude || 6;
        const dist = args.distance || 50;
        const pga = peakGroundAcceleration(M, dist);
        const mmi = pgaToMMI(pga);
        result = {
          operation: 'ground_motion',
          magnitude: M,
          distance_km: dist,
          peak_ground_acceleration_g: +pga.toFixed(4),
          peak_ground_acceleration_m_s2: +(pga * 9.81).toFixed(3),
          modified_mercalli_intensity: +mmi.toFixed(1),
          mmi_description:
            mmi < 4 ? 'Light shaking' : mmi < 6 ? 'Moderate' : mmi < 8 ? 'Strong' : 'Violent',
        };
        break;
      }
      case 'fault': {
        const M = args.magnitude || 7;
        const M0 = momentFromMagnitude(M);
        const area = args.fault_area ? args.fault_area * 1e6 : Math.pow(10, M - 4) * 1e6; // Approximate
        const slip = faultSlip(M0, area);
        result = {
          operation: 'fault',
          moment_magnitude: M,
          seismic_moment_nm: +M0.toExponential(3),
          fault_area_km2: +(area / 1e6).toFixed(1),
          average_slip_m: +slip.toFixed(2),
          fault_length_km: +Math.sqrt(area / 1e6 / 0.5).toFixed(1), // Assuming L:W = 2:1
        };
        break;
      }
      case 'rocks': {
        result = {
          operation: 'rocks',
          available: Object.entries(ROCK_PROPERTIES).map(([k, v]) => ({
            rock: k,
            vp_m_s: v.vp,
            vs_m_s: v.vs,
            density_kg_m3: v.density,
          })),
        };
        break;
      }
      case 'scale': {
        result = {
          operation: 'scale',
          richter_scale: MAGNITUDE_EFFECTS.map((e) => ({
            magnitude_range: `${e.min}-${e.max}`,
            description: e.description,
            global_frequency: e.frequency,
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

export function isSeismologyAvailable(): boolean {
  return true;
}
