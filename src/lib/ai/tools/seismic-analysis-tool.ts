/**
 * SEISMIC-ANALYSIS TOOL
 * Seismic wave analysis, earthquake magnitude calculations, and ground motion modeling
 * Based on seismological principles and earthquake engineering
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Physical constants
const EARTH_RADIUS = 6371; // km
const P_WAVE_VELOCITY_CRUST = 6.0; // km/s average in crust
const S_WAVE_VELOCITY_CRUST = 3.5; // km/s average in crust
const SURFACE_WAVE_VELOCITY = 3.0; // km/s average

// Seismic wave types
interface SeismicWave {
  type: string;
  velocity: number; // km/s
  period: number; // seconds
  amplitude: number; // mm
  motion: string;
}

// Magnitude scales
interface MagnitudeResult {
  scale: string;
  value: number;
  energy_joules: number;
  energy_tnt_tons: number;
  description: string;
}

// Ground motion parameters
interface GroundMotion {
  pga: number; // Peak Ground Acceleration (g)
  pgv: number; // Peak Ground Velocity (cm/s)
  pgd: number; // Peak Ground Displacement (cm)
  intensity: string; // MMI
}

// Richter magnitude from amplitude and distance
function richterMagnitude(amplitude_mm: number, distance_km: number): number {
  // ML = log₁₀(A) + 3log₁₀(8Δt) - 2.92
  // Simplified: ML = log₁₀(A) + 2.76log₁₀(Δ) - 2.48
  return Math.log10(amplitude_mm) + 2.76 * Math.log10(distance_km) - 2.48;
}

// Moment magnitude from seismic moment
function momentMagnitude(moment_Nm: number): number {
  // Mw = (2/3)(log₁₀(M₀) - 9.1)
  return (2 / 3) * (Math.log10(moment_Nm) - 9.1);
}

// Seismic moment from fault parameters
function seismicMoment(
  faultLength_km: number,
  faultWidth_km: number,
  slip_m: number,
  rigidity_Pa: number = 3e10
): number {
  // M₀ = μ × A × D
  const area = faultLength_km * 1000 * faultWidth_km * 1000; // m²
  return rigidity_Pa * area * slip_m;
}

// Energy from magnitude
function energyFromMagnitude(magnitude: number): number {
  // log₁₀(E) = 1.5M + 4.8 (E in Joules)
  return Math.pow(10, 1.5 * magnitude + 4.8);
}

// TNT equivalent
function tntEquivalent(energy_joules: number): number {
  const tnt_energy = 4.184e9; // Joules per ton of TNT
  return energy_joules / tnt_energy;
}

// P-wave travel time
function pWaveTravelTime(distance_km: number, depth_km: number = 10): number {
  const straight_distance = Math.sqrt(distance_km * distance_km + depth_km * depth_km);
  // Use average velocity with depth correction
  const avg_velocity = P_WAVE_VELOCITY_CRUST * (1 + depth_km / 100);
  return straight_distance / avg_velocity;
}

// S-wave travel time
function sWaveTravelTime(distance_km: number, depth_km: number = 10): number {
  const straight_distance = Math.sqrt(distance_km * distance_km + depth_km * depth_km);
  const avg_velocity = S_WAVE_VELOCITY_CRUST * (1 + depth_km / 100);
  return straight_distance / avg_velocity;
}

// S-P time difference for distance estimation
function distanceFromSPTime(sp_time_seconds: number, depth_km: number = 10): number {
  // Δt = D × (1/Vs - 1/Vp)
  // D = Δt / (1/Vs - 1/Vp)
  const factor = 1 / S_WAVE_VELOCITY_CRUST - 1 / P_WAVE_VELOCITY_CRUST;
  return sp_time_seconds / factor;
}

// Ground motion attenuation (Boore-Atkinson style, simplified)
function groundMotionAttenuation(
  magnitude: number,
  distance_km: number,
  siteClass: string = 'C'
): GroundMotion {
  // Simplified attenuation relationship
  // ln(PGA) = c₁ + c₂(M-6) + c₃(M-6)² + c₄ln(R) + c₅R
  const c1 = -0.5, c2 = 0.9, c3 = -0.1, c4 = -1.0, c5 = -0.005;

  const R = Math.sqrt(distance_km * distance_km + 25); // Hypocentral distance with depth
  const lnPGA = c1 + c2 * (magnitude - 6) + c3 * Math.pow(magnitude - 6, 2)
                + c4 * Math.log(R) + c5 * R;

  let pga = Math.exp(lnPGA);

  // Site amplification factors
  const siteFactors: Record<string, number> = {
    'A': 0.8,  // Hard rock
    'B': 0.9,  // Rock
    'C': 1.0,  // Very dense soil/soft rock
    'D': 1.3,  // Stiff soil
    'E': 1.6   // Soft soil
  };
  pga *= siteFactors[siteClass] || 1.0;

  // Estimate PGV and PGD from PGA
  const pgv = pga * 100 * (magnitude - 3) / 3; // Rough scaling
  const pgd = pgv * (magnitude - 3) / 2;

  // Modified Mercalli Intensity from PGA
  const intensity = pgaToMMI(pga);

  return {
    pga: parseFloat(pga.toFixed(4)),
    pgv: parseFloat(pgv.toFixed(2)),
    pgd: parseFloat(pgd.toFixed(2)),
    intensity
  };
}

// PGA to Modified Mercalli Intensity
function pgaToMMI(pga: number): string {
  const intensities = [
    { min: 0, max: 0.0017, mmi: 'I', desc: 'Not felt' },
    { min: 0.0017, max: 0.014, mmi: 'II-III', desc: 'Weak' },
    { min: 0.014, max: 0.039, mmi: 'IV', desc: 'Light' },
    { min: 0.039, max: 0.092, mmi: 'V', desc: 'Moderate' },
    { min: 0.092, max: 0.18, mmi: 'VI', desc: 'Strong' },
    { min: 0.18, max: 0.34, mmi: 'VII', desc: 'Very Strong' },
    { min: 0.34, max: 0.65, mmi: 'VIII', desc: 'Severe' },
    { min: 0.65, max: 1.24, mmi: 'IX', desc: 'Violent' },
    { min: 1.24, max: Infinity, mmi: 'X+', desc: 'Extreme' }
  ];

  for (const i of intensities) {
    if (pga >= i.min && pga < i.max) {
      return `${i.mmi} (${i.desc})`;
    }
  }
  return 'X+ (Extreme)';
}

// Earthquake location using triangulation
function triangulateEpicenter(
  stations: Array<{ lat: number; lon: number; sp_time: number }>
): { lat: number; lon: number; depth: number } {
  if (stations.length < 3) {
    return { lat: 0, lon: 0, depth: 10 };
  }

  // Calculate distances from S-P times
  const distances = stations.map(s => distanceFromSPTime(s.sp_time));

  // Simple centroid-based estimation (real algorithm uses least squares)
  let lat = 0, lon = 0;
  let totalWeight = 0;

  for (let i = 0; i < stations.length; i++) {
    const weight = 1 / (distances[i] + 1);
    lat += stations[i].lat * weight;
    lon += stations[i].lon * weight;
    totalWeight += weight;
  }

  return {
    lat: parseFloat((lat / totalWeight).toFixed(4)),
    lon: parseFloat((lon / totalWeight).toFixed(4)),
    depth: 10 // Assumed depth
  };
}

// Fault rupture analysis
function faultRuptureAnalysis(
  magnitude: number
): {
  fault_length: number;
  fault_width: number;
  average_slip: number;
  rupture_area: number;
  rupture_duration: number;
} {
  // Empirical scaling relations (Wells & Coppersmith, 1994)
  // log(L) = -3.22 + 0.69M (subsurface rupture length in km)
  // log(W) = -1.01 + 0.32M (down-dip width in km)
  // log(D) = -4.80 + 0.69M (average displacement in m)

  const length = Math.pow(10, -3.22 + 0.69 * magnitude);
  const width = Math.pow(10, -1.01 + 0.32 * magnitude);
  const slip = Math.pow(10, -4.80 + 0.69 * magnitude);
  const area = length * width;
  const duration = length / 2.5; // Rupture velocity ~2.5 km/s

  return {
    fault_length: parseFloat(length.toFixed(1)),
    fault_width: parseFloat(width.toFixed(1)),
    average_slip: parseFloat(slip.toFixed(2)),
    rupture_area: parseFloat(area.toFixed(0)),
    rupture_duration: parseFloat(duration.toFixed(1))
  };
}

// Generate synthetic seismogram
function syntheticSeismogram(
  magnitude: number,
  distance_km: number,
  duration_seconds: number = 60
): Array<{ time: number; displacement: number }> {
  const samples = [];
  const dt = 0.1; // 10 Hz sampling

  // P-wave arrival
  const p_arrival = pWaveTravelTime(distance_km);
  // S-wave arrival
  const s_arrival = sWaveTravelTime(distance_km);
  // Surface wave arrival
  const surface_arrival = distance_km / SURFACE_WAVE_VELOCITY;

  // Amplitude scaling with magnitude and distance
  const baseAmplitude = Math.pow(10, magnitude - 3) / Math.sqrt(distance_km);

  for (let t = 0; t < duration_seconds; t += dt) {
    let displacement = 0;

    // P-wave
    if (t > p_arrival && t < p_arrival + 5) {
      const phase = (t - p_arrival) * 2 * Math.PI * 2; // 2 Hz
      const envelope = Math.exp(-(t - p_arrival) / 2);
      displacement += baseAmplitude * 0.3 * Math.sin(phase) * envelope;
    }

    // S-wave (larger amplitude)
    if (t > s_arrival && t < s_arrival + 10) {
      const phase = (t - s_arrival) * 2 * Math.PI * 1; // 1 Hz
      const envelope = Math.exp(-(t - s_arrival) / 3);
      displacement += baseAmplitude * Math.sin(phase) * envelope;
    }

    // Surface waves (longest duration)
    if (t > surface_arrival && t < surface_arrival + 30) {
      const phase = (t - surface_arrival) * 2 * Math.PI * 0.2; // 0.2 Hz
      const envelope = Math.exp(-(t - surface_arrival) / 10);
      displacement += baseAmplitude * 0.8 * Math.sin(phase) * envelope;
    }

    // Add noise
    displacement += (Math.random() - 0.5) * baseAmplitude * 0.1;

    samples.push({
      time: parseFloat(t.toFixed(1)),
      displacement: parseFloat(displacement.toFixed(4))
    });
  }

  return samples;
}

// Response spectrum calculation
function responseSpectrum(
  pga: number,
  periods: number[] = [0.1, 0.2, 0.3, 0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 4.0]
): Array<{ period: number; Sa: number }> {
  // Simplified response spectrum (Newmark-Hall style)
  return periods.map(T => {
    let Sa: number;
    if (T < 0.1) {
      Sa = pga;
    } else if (T < 0.4) {
      Sa = pga * 2.5; // Plateau
    } else if (T < 2.0) {
      Sa = pga * 2.5 * (0.4 / T); // 1/T decay
    } else {
      Sa = pga * 2.5 * 0.4 / (T * T) * 4; // 1/T² decay
    }
    return {
      period: T,
      Sa: parseFloat(Sa.toFixed(4))
    };
  });
}

export const seismicanalysisTool: UnifiedTool = {
  name: 'seismic_analysis',
  description: 'Seismic wave analysis, earthquake magnitude calculations, ground motion modeling, and earthquake engineering',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['info', 'magnitude', 'locate', 'ground_motion', 'waves', 'fault', 'spectrum', 'seismogram', 'hazard', 'demonstrate'],
        description: 'Operation to perform'
      },
      magnitude: { type: 'number', description: 'Earthquake magnitude' },
      amplitude_mm: { type: 'number', description: 'Seismogram amplitude in mm' },
      distance_km: { type: 'number', description: 'Distance from epicenter in km' },
      depth_km: { type: 'number', description: 'Focal depth in km' },
      sp_time: { type: 'number', description: 'S-P time difference in seconds' },
      site_class: { type: 'string', enum: ['A', 'B', 'C', 'D', 'E'], description: 'Site soil classification' },
      fault_length: { type: 'number', description: 'Fault rupture length in km' },
      fault_width: { type: 'number', description: 'Fault rupture width in km' },
      slip: { type: 'number', description: 'Fault slip in meters' },
      stations: { type: 'array', description: 'Seismic station data for location' }
    },
    required: ['operation']
  }
};

export async function executeseismicanalysis(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation;

    let result: any;

    switch (operation) {
      case 'info': {
        result = {
          operation: 'info',
          tool: 'seismic_analysis',
          description: 'Seismological analysis and earthquake engineering calculations',
          wave_types: {
            P_waves: {
              name: 'Primary waves (compressional)',
              velocity: P_WAVE_VELOCITY_CRUST + ' km/s (crust)',
              motion: 'Push-pull, parallel to propagation',
              arrival: 'First to arrive'
            },
            S_waves: {
              name: 'Secondary waves (shear)',
              velocity: S_WAVE_VELOCITY_CRUST + ' km/s (crust)',
              motion: 'Side-to-side, perpendicular',
              arrival: 'Second to arrive'
            },
            surface_waves: {
              Love: 'Horizontal shearing',
              Rayleigh: 'Rolling elliptical motion',
              velocity: SURFACE_WAVE_VELOCITY + ' km/s',
              damage: 'Most destructive'
            }
          },
          magnitude_scales: {
            ML: 'Local (Richter) - amplitude-based',
            Mw: 'Moment - seismic moment based, most accurate',
            mb: 'Body wave - P-wave amplitude',
            Ms: 'Surface wave - Rayleigh wave amplitude'
          },
          key_equations: {
            richter: 'ML = log₁₀(A) + 2.76log₁₀(Δ) - 2.48',
            moment_magnitude: 'Mw = (2/3)(log₁₀(M₀) - 9.1)',
            seismic_moment: 'M₀ = μ × A × D',
            energy: 'log₁₀(E) = 1.5M + 4.8'
          },
          operations: ['magnitude', 'locate', 'ground_motion', 'waves', 'fault', 'spectrum', 'seismogram', 'hazard', 'demonstrate']
        };
        break;
      }

      case 'magnitude': {
        if (args.amplitude_mm && args.distance_km) {
          // Calculate from amplitude
          const ml = richterMagnitude(args.amplitude_mm, args.distance_km);
          const energy = energyFromMagnitude(ml);
          const tnt = tntEquivalent(energy);

          result = {
            operation: 'magnitude',
            method: 'amplitude-based (Richter)',
            inputs: {
              amplitude: args.amplitude_mm + ' mm',
              distance: args.distance_km + ' km'
            },
            magnitude: {
              ML: parseFloat(ml.toFixed(1)),
              description: getMagnitudeDescription(ml)
            },
            energy: {
              joules: energy.toExponential(2),
              tnt_equivalent: tnt > 1000000 ? (tnt / 1000000).toFixed(1) + ' megatons' :
                             tnt > 1000 ? (tnt / 1000).toFixed(1) + ' kilotons' :
                             tnt.toFixed(0) + ' tons'
            },
            formula: `ML = log₁₀(${args.amplitude_mm}) + 2.76×log₁₀(${args.distance_km}) - 2.48 = ${ml.toFixed(1)}`
          };
        } else if (args.fault_length && args.slip) {
          // Calculate from fault parameters
          const length = args.fault_length;
          const width = args.fault_width || length / 3;
          const slip = args.slip;

          const moment = seismicMoment(length, width, slip);
          const mw = momentMagnitude(moment);
          const energy = energyFromMagnitude(mw);

          result = {
            operation: 'magnitude',
            method: 'moment magnitude (from fault)',
            inputs: {
              fault_length: length + ' km',
              fault_width: width + ' km',
              slip: slip + ' m'
            },
            seismic_moment: {
              value: moment.toExponential(2),
              unit: 'N⋅m'
            },
            magnitude: {
              Mw: parseFloat(mw.toFixed(1)),
              description: getMagnitudeDescription(mw)
            },
            energy: {
              joules: energy.toExponential(2),
              tnt_equivalent: tntEquivalent(energy).toExponential(2) + ' tons'
            },
            formula: `M₀ = μ × A × D = ${moment.toExponential(2)} N⋅m\nMw = (2/3)(log₁₀(${moment.toExponential(2)}) - 9.1) = ${mw.toFixed(1)}`
          };
        } else {
          const magnitude = args.magnitude || 6.0;
          const energy = energyFromMagnitude(magnitude);
          const tnt = tntEquivalent(energy);
          const rupture = faultRuptureAnalysis(magnitude);

          result = {
            operation: 'magnitude',
            magnitude: magnitude,
            description: getMagnitudeDescription(magnitude),
            energy: {
              joules: energy.toExponential(2),
              tnt_equivalent: tnt > 1000000 ? (tnt / 1000000).toFixed(2) + ' megatons' :
                             tnt > 1000 ? (tnt / 1000).toFixed(1) + ' kilotons' :
                             tnt.toFixed(0) + ' tons'
            },
            fault_rupture: rupture,
            comparison: compareMagnitudes(magnitude)
          };
        }
        break;
      }

      case 'locate': {
        const sp_time = args.sp_time;
        const stations = args.stations;

        if (sp_time) {
          const distance = distanceFromSPTime(sp_time);

          result = {
            operation: 'locate',
            method: 'S-P time difference',
            sp_time: sp_time + ' seconds',
            calculated_distance: parseFloat(distance.toFixed(1)) + ' km',
            p_wave_arrival: parseFloat(pWaveTravelTime(distance).toFixed(1)) + ' s',
            s_wave_arrival: parseFloat(sWaveTravelTime(distance).toFixed(1)) + ' s',
            formula: `Distance = Δt / (1/Vs - 1/Vp) = ${sp_time} / (1/${S_WAVE_VELOCITY_CRUST} - 1/${P_WAVE_VELOCITY_CRUST}) = ${distance.toFixed(1)} km`,
            note: 'Need 3+ stations for triangulation to find epicenter'
          };
        } else if (stations && stations.length >= 3) {
          const location = triangulateEpicenter(stations);
          const distances = stations.map((s: any) => ({
            station: `(${s.lat}, ${s.lon})`,
            sp_time: s.sp_time,
            distance: parseFloat(distanceFromSPTime(s.sp_time).toFixed(1)) + ' km'
          }));

          result = {
            operation: 'locate',
            method: 'triangulation',
            stations: distances,
            epicenter: {
              latitude: location.lat,
              longitude: location.lon,
              depth: location.depth + ' km (assumed)'
            },
            uncertainty: '±5-10 km (depends on station geometry)'
          };
        } else {
          result = {
            operation: 'locate',
            error: 'Provide sp_time for distance calculation or 3+ stations for triangulation',
            example_stations: [
              { lat: 34.0, lon: -118.0, sp_time: 8.5 },
              { lat: 34.5, lon: -118.5, sp_time: 6.2 },
              { lat: 33.8, lon: -117.5, sp_time: 10.1 }
            ]
          };
        }
        break;
      }

      case 'ground_motion': {
        const magnitude = args.magnitude || 6.5;
        const distance = args.distance_km || 20;
        const siteClass = args.site_class || 'C';

        const motion = groundMotionAttenuation(magnitude, distance, siteClass);
        const spectrum = responseSpectrum(motion.pga);

        result = {
          operation: 'ground_motion',
          inputs: {
            magnitude: magnitude,
            distance: distance + ' km',
            site_class: siteClass + ' (' + siteClassDescription(siteClass) + ')'
          },
          ground_motion: {
            PGA: {
              value: motion.pga,
              unit: 'g',
              percentage: (motion.pga * 100).toFixed(1) + '%g'
            },
            PGV: {
              value: motion.pgv,
              unit: 'cm/s'
            },
            PGD: {
              value: motion.pgd,
              unit: 'cm'
            },
            MMI: motion.intensity
          },
          response_spectrum: spectrum.slice(0, 6),
          damage_potential: getDamagePotential(motion.pga),
          attenuation_note: 'Ground motion decreases with distance (geometric spreading + absorption)'
        };
        break;
      }

      case 'waves': {
        const distance = args.distance_km || 100;
        const depth = args.depth_km || 10;

        const p_time = pWaveTravelTime(distance, depth);
        const s_time = sWaveTravelTime(distance, depth);
        const surface_time = distance / SURFACE_WAVE_VELOCITY;

        result = {
          operation: 'waves',
          distance: distance + ' km',
          depth: depth + ' km',
          wave_arrivals: {
            P_wave: {
              arrival_time: parseFloat(p_time.toFixed(1)) + ' s',
              velocity: P_WAVE_VELOCITY_CRUST + ' km/s',
              type: 'Compressional (push-pull)',
              motion: 'Parallel to wave direction'
            },
            S_wave: {
              arrival_time: parseFloat(s_time.toFixed(1)) + ' s',
              velocity: S_WAVE_VELOCITY_CRUST + ' km/s',
              type: 'Shear (side-to-side)',
              motion: 'Perpendicular to wave direction',
              note: 'Cannot travel through liquids'
            },
            Surface_waves: {
              arrival_time: parseFloat(surface_time.toFixed(1)) + ' s',
              velocity: SURFACE_WAVE_VELOCITY + ' km/s',
              types: ['Love waves (horizontal)', 'Rayleigh waves (rolling)'],
              note: 'Cause most damage'
            }
          },
          sp_time_difference: parseFloat((s_time - p_time).toFixed(1)) + ' s',
          velocity_ratio: (P_WAVE_VELOCITY_CRUST / S_WAVE_VELOCITY_CRUST).toFixed(2) + ' (Vp/Vs ≈ √3)',
          travel_time_curve: [
            { distance: 50, p_time: parseFloat(pWaveTravelTime(50, depth).toFixed(1)), s_time: parseFloat(sWaveTravelTime(50, depth).toFixed(1)) },
            { distance: 100, p_time: parseFloat(pWaveTravelTime(100, depth).toFixed(1)), s_time: parseFloat(sWaveTravelTime(100, depth).toFixed(1)) },
            { distance: 200, p_time: parseFloat(pWaveTravelTime(200, depth).toFixed(1)), s_time: parseFloat(sWaveTravelTime(200, depth).toFixed(1)) },
            { distance: 500, p_time: parseFloat(pWaveTravelTime(500, depth).toFixed(1)), s_time: parseFloat(sWaveTravelTime(500, depth).toFixed(1)) }
          ]
        };
        break;
      }

      case 'fault': {
        const magnitude = args.magnitude || 7.0;
        const rupture = faultRuptureAnalysis(magnitude);
        const moment = seismicMoment(rupture.fault_length, rupture.fault_width, rupture.average_slip);

        result = {
          operation: 'fault',
          magnitude: magnitude,
          fault_parameters: {
            length: rupture.fault_length + ' km',
            width: rupture.fault_width + ' km',
            average_slip: rupture.average_slip + ' m',
            rupture_area: rupture.rupture_area + ' km²',
            rupture_duration: rupture.rupture_duration + ' s'
          },
          seismic_moment: moment.toExponential(2) + ' N⋅m',
          scaling_relations: {
            source: 'Wells & Coppersmith (1994)',
            length: 'log(L) = -3.22 + 0.69M',
            width: 'log(W) = -1.01 + 0.32M',
            slip: 'log(D) = -4.80 + 0.69M'
          },
          fault_types: [
            { type: 'Strike-slip', motion: 'Horizontal sliding', examples: 'San Andreas Fault' },
            { type: 'Normal', motion: 'Hanging wall drops', examples: 'Basin and Range' },
            { type: 'Reverse/Thrust', motion: 'Hanging wall rises', examples: 'Himalayas, Cascadia' }
          ]
        };
        break;
      }

      case 'spectrum': {
        const pga = args.pga || 0.3;
        const siteClass = args.site_class || 'C';

        // Site factors
        const Fa = { A: 0.8, B: 1.0, C: 1.0, D: 1.2, E: 1.5 }[siteClass] || 1.0;
        const Fv = { A: 0.8, B: 1.0, C: 1.4, D: 1.8, E: 2.4 }[siteClass] || 1.4;

        const adjustedPGA = pga * Fa;
        const spectrum = responseSpectrum(adjustedPGA);

        result = {
          operation: 'spectrum',
          inputs: {
            pga: pga + 'g',
            site_class: siteClass
          },
          site_factors: {
            Fa: Fa + ' (short period)',
            Fv: Fv + ' (long period)'
          },
          design_spectrum: {
            SDS: parseFloat((adjustedPGA * 2.5 * 2 / 3).toFixed(3)) + 'g (short period design)',
            SD1: parseFloat((adjustedPGA * 2.5 * Fv / Fa * 2 / 3).toFixed(3)) + 'g (1s period design)'
          },
          response_spectrum: spectrum,
          building_periods: {
            '1-story': '~0.1s',
            '5-story': '~0.5s',
            '10-story': '~1.0s',
            '20-story': '~2.0s',
            '40-story': '~4.0s'
          },
          note: 'Buildings resonate when their natural period matches ground motion period'
        };
        break;
      }

      case 'seismogram': {
        const magnitude = args.magnitude || 5.5;
        const distance = args.distance_km || 50;

        const seismogram = syntheticSeismogram(magnitude, distance, 60);
        const p_arrival = pWaveTravelTime(distance);
        const s_arrival = sWaveTravelTime(distance);

        // Sample every 5 seconds for display
        const displayData = seismogram.filter((_, i) => i % 50 === 0);

        result = {
          operation: 'seismogram',
          parameters: {
            magnitude: magnitude,
            distance: distance + ' km'
          },
          arrivals: {
            P_wave: parseFloat(p_arrival.toFixed(1)) + ' s',
            S_wave: parseFloat(s_arrival.toFixed(1)) + ' s',
            SP_time: parseFloat((s_arrival - p_arrival).toFixed(1)) + ' s'
          },
          seismogram_sample: displayData,
          visualization: generateSeismogramAscii(magnitude, distance)
        };
        break;
      }

      case 'hazard': {
        const lat = args.latitude || 34.05;
        const lon = args.longitude || -118.25;

        // Simplified hazard for demonstration
        const hazard = {
          location: { latitude: lat, longitude: lon },
          seismic_hazard: {
            pga_475yr: '0.4-0.6g (10% in 50 years)',
            pga_2475yr: '0.8-1.0g (2% in 50 years)',
            hazard_level: 'High'
          },
          nearby_faults: [
            { name: 'San Andreas', distance: '~60 km', max_magnitude: 8.0 },
            { name: 'Newport-Inglewood', distance: '~20 km', max_magnitude: 7.0 },
            { name: 'Puente Hills Thrust', distance: '~10 km', max_magnitude: 7.5 }
          ],
          historical_events: [
            { year: 1994, name: 'Northridge', magnitude: 6.7, distance: '30 km' },
            { year: 1971, name: 'San Fernando', magnitude: 6.6, distance: '40 km' },
            { year: 1933, name: 'Long Beach', magnitude: 6.4, distance: '35 km' }
          ],
          recommendations: [
            'Building code compliance essential',
            'Earthquake insurance recommended',
            'Emergency preparedness (72-hour kit)',
            'Secure heavy furniture and water heaters'
          ]
        };

        result = {
          operation: 'hazard',
          ...hazard
        };
        break;
      }

      case 'demonstrate': {
        result = {
          operation: 'demonstrate',
          tool: 'seismic_analysis',
          examples: [
            {
              name: 'Magnitude 7.0 earthquake at 50 km',
              magnitude: 7.0,
              distance: 50,
              ...faultRuptureAnalysis(7.0),
              ground_motion: groundMotionAttenuation(7.0, 50, 'C'),
              energy_tnt: tntEquivalent(energyFromMagnitude(7.0)).toExponential(2) + ' tons'
            },
            {
              name: 'S-P time distance calculation',
              sp_time: 10,
              calculated_distance: parseFloat(distanceFromSPTime(10).toFixed(1)) + ' km'
            }
          ],
          magnitude_comparison: [
            { mag: 4.0, energy: '6 tons TNT', felt: 'Local area', damage: 'Minor' },
            { mag: 5.0, energy: '200 tons TNT', felt: 'Regional', damage: 'Moderate' },
            { mag: 6.0, energy: '6 kilotons TNT', felt: 'Wide area', damage: 'Significant' },
            { mag: 7.0, energy: '200 kilotons TNT', felt: 'Very wide', damage: 'Major' },
            { mag: 8.0, energy: '6 megatons TNT', felt: 'Huge area', damage: 'Great' },
            { mag: 9.0, energy: '200 megatons TNT', felt: 'Enormous', damage: 'Catastrophic' }
          ],
          visualization: `
SEISMOGRAM ANATOMY
══════════════════

Amplitude
    │    P-wave        S-wave           Surface waves
    │      │             │                   │
    │      ▼             ▼                   ▼
  + │    ╱╲           ╱╲╱╲╱╲          ∿∿∿∿∿∿∿∿∿∿∿
    │   ╱  ╲         ╱      ╲        ∿          ∿∿
  0 ├──╱────╲───────╱────────╲──────∿────────────∿∿───
    │ ╱      ╲     ╱          ╲    ∿              ∿∿
  - │╱        ╲   ╱            ╲  ∿                ∿
    │          ╲ ╱              ╲∿
    └─────────────────────────────────────────────────▶
                                                   Time
    │←─────→│←────────→│←──────────────────────→│
    First    S-P time    Surface wave duration
    arrival  (distance)  (most damage)


WAVE PROPAGATION
════════════════

    ★ Epicenter
    │
    ├─── P-waves ───→ (6 km/s, compressional)
    │
    ├─── S-waves ───→ (3.5 km/s, shear)
    │
    └─── Surface ───→ (3 km/s, most destructive)


MAGNITUDE ENERGY SCALE
══════════════════════
Each magnitude increase = 31.6× more energy

M4 ─┤
M5 ─┼─────┤
M6 ─┼─────────────────────┤
M7 ─┼─────────────────────────────────────────────┤
M8 ─┼───────────────────────────────[continues...]─┤
`
        };
        break;
      }

      default:
        result = {
          error: `Unknown operation: ${operation}`,
          available: ['info', 'magnitude', 'locate', 'ground_motion', 'waves', 'fault', 'spectrum', 'seismogram', 'hazard', 'demonstrate']
        };
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

// Helper functions
function getMagnitudeDescription(mag: number): string {
  if (mag < 2.0) return 'Micro - not felt';
  if (mag < 3.0) return 'Minor - rarely felt';
  if (mag < 4.0) return 'Minor - felt by few';
  if (mag < 5.0) return 'Light - felt by many';
  if (mag < 6.0) return 'Moderate - some damage';
  if (mag < 7.0) return 'Strong - damaging';
  if (mag < 8.0) return 'Major - serious damage';
  if (mag < 9.0) return 'Great - severe damage';
  return 'Great - devastating';
}

function compareMagnitudes(mag: number): string[] {
  return [
    `Energy = ${energyFromMagnitude(mag).toExponential(2)} J`,
    `= ${(mag - 1).toFixed(0)} magnitude earthquake × 31.6`,
    `= ${(mag + 1).toFixed(0)} magnitude earthquake ÷ 31.6`,
    `Each magnitude step = 31.6× energy change`
  ];
}

function siteClassDescription(siteClass: string): string {
  const descriptions: Record<string, string> = {
    'A': 'Hard rock, Vs > 1500 m/s',
    'B': 'Rock, 760 < Vs < 1500 m/s',
    'C': 'Very dense soil/soft rock, 360 < Vs < 760 m/s',
    'D': 'Stiff soil, 180 < Vs < 360 m/s',
    'E': 'Soft clay soil, Vs < 180 m/s'
  };
  return descriptions[siteClass] || 'Unknown';
}

function getDamagePotential(pga: number): string {
  if (pga < 0.05) return 'None to minimal';
  if (pga < 0.1) return 'Light damage possible';
  if (pga < 0.2) return 'Moderate damage likely';
  if (pga < 0.4) return 'Significant damage expected';
  if (pga < 0.6) return 'Heavy damage probable';
  return 'Extreme damage';
}

function generateSeismogramAscii(magnitude: number, distance: number): string {
  const p = pWaveTravelTime(distance);
  const s = sWaveTravelTime(distance);

  return `
  M${magnitude.toFixed(1)} at ${distance}km
  ─────────────────────────────────────────
      P(${p.toFixed(0)}s)  S(${s.toFixed(0)}s)    Surface
        │         │           │
        ▼         ▼           ▼
     ╱╲        ╱╲╱╲╱╲     ∿∿∿∿∿∿∿∿∿∿
    ╱  ╲      ╱      ╲   ∿        ∿∿
  ─╱────╲────╱────────╲─∿──────────∿∿──
  ╱      ╲  ╱          ╲∿           ∿
           ╲╱
  ───────────────────────────────────────▶ t(s)
  `;
}

export function isseismicanalysisAvailable(): boolean {
  return true;
}
