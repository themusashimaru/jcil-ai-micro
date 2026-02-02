/**
 * SEISMIC-ANALYSIS TOOL
 * Comprehensive seismic wave analysis and earthquake modeling
 * including magnitude calculation, wave propagation, and structural response
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// =============================================================================
// PHYSICAL CONSTANTS
// =============================================================================

const CONSTANTS = {
  // Wave velocities (km/s) for average crust
  Vp_crust: 6.0,           // P-wave velocity
  Vs_crust: 3.5,           // S-wave velocity
  Vp_mantle: 8.0,          // P-wave in upper mantle
  Vs_mantle: 4.5,          // S-wave in upper mantle

  // Earth properties
  earthRadius: 6371,       // km
  crustThickness: 35,      // km (continental average)
  mantleDepth: 2890,       // km

  // Attenuation
  Q_p: 500,                // P-wave quality factor
  Q_s: 200,                // S-wave quality factor

  // Reference values
  M0_reference: 1e16,      // Reference seismic moment (N·m)
  A0_reference: 1e-6       // Reference amplitude (m)
};

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface EarthquakeSource {
  latitude: number;
  longitude: number;
  depth: number;           // km
  magnitude: number;
  magnitudeType: 'Mw' | 'ML' | 'Ms' | 'mb';
  seismicMoment?: number;  // N·m
  faultType?: 'strike-slip' | 'normal' | 'thrust' | 'oblique';
  ruptureDuration?: number; // seconds
}

interface SeismicStation {
  id: string;
  latitude: number;
  longitude: number;
  elevation: number;       // m
  siteClass?: 'A' | 'B' | 'C' | 'D' | 'E';
}

interface WaveArrival {
  phase: string;
  arrivalTime: number;     // seconds from origin
  distance: number;        // km
  amplitude: number;       // relative
  rayParameter?: number;
}

interface SeismicHazard {
  pga: number;             // Peak Ground Acceleration (g)
  pgv: number;             // Peak Ground Velocity (cm/s)
  sa_02: number;           // Spectral acceleration at 0.2s (g)
  sa_10: number;           // Spectral acceleration at 1.0s (g)
  mmi: number;             // Modified Mercalli Intensity
}

interface LocationResult {
  latitude: number;
  longitude: number;
  depth: number;
  originTime: number;
  residual: number;
  confidence: number;
}

interface MagnitudeResult {
  value: number;
  type: string;
  uncertainty: number;
  seismicMoment?: number;
  energyRelease?: number;
}

// =============================================================================
// GEOGRAPHIC CALCULATIONS
// =============================================================================

/**
 * Calculate great circle distance using Haversine formula
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = CONSTANTS.earthRadius;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate epicentral distance including depth
 */
function hypocentralDistance(epicentralDist: number, depth: number): number {
  return Math.sqrt(epicentralDist * epicentralDist + depth * depth);
}

/**
 * Calculate back azimuth
 */
function backAzimuth(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;

  const x = Math.sin(dLon) * Math.cos(lat2Rad);
  const y = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

  const azimuth = Math.atan2(x, y) * 180 / Math.PI;
  return (azimuth + 360) % 360;
}

// =============================================================================
// MAGNITUDE CALCULATIONS
// =============================================================================

/**
 * Convert between magnitude types
 */
function convertMagnitude(value: number, fromType: string, toType: string): number {
  // Approximate conversions based on empirical relationships
  const toMw: Record<string, (m: number) => number> = {
    Mw: (m) => m,
    ML: (m) => 0.67 * m + 1.0,  // Local magnitude
    Ms: (m) => 0.67 * m + 1.0,  // Surface wave magnitude
    mb: (m) => 0.85 * m + 0.8   // Body wave magnitude
  };

  const fromMw: Record<string, (m: number) => number> = {
    Mw: (m) => m,
    ML: (m) => (m - 1.0) / 0.67,
    Ms: (m) => (m - 1.0) / 0.67,
    mb: (m) => (m - 0.8) / 0.85
  };

  const mw = toMw[fromType]?.(value) ?? value;
  return fromMw[toType]?.(mw) ?? mw;
}

/**
 * Calculate seismic moment from moment magnitude
 */
function seismicMomentFromMw(Mw: number): number {
  // M0 = 10^(1.5*Mw + 9.1) N·m
  return Math.pow(10, 1.5 * Mw + 9.1);
}

/**
 * Calculate moment magnitude from seismic moment
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function mwFromSeismicMoment(M0: number): number {
  // Mw = (log10(M0) - 9.1) / 1.5
  return (Math.log10(M0) - 9.1) / 1.5;
}

/**
 * Calculate energy release
 */
function energyFromMagnitude(Mw: number): number {
  // E = 10^(1.5*Mw + 4.8) Joules
  return Math.pow(10, 1.5 * Mw + 4.8);
}

/**
 * Calculate local magnitude from amplitude
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function localMagnitude(amplitude: number, distance: number): number {
  // Richter's original formula (simplified)
  // ML = log10(A) + 2.76*log10(d) - 2.48
  return Math.log10(amplitude * 1e6) + 2.76 * Math.log10(distance) - 2.48;
}

// =============================================================================
// WAVE PROPAGATION
// =============================================================================

/**
 * Calculate P-wave travel time
 */
function pWaveTravelTime(distance: number, depth: number): number {
  const hypoDist = hypocentralDistance(distance, depth);

  // Simple layered model
  if (depth < CONSTANTS.crustThickness) {
    return hypoDist / CONSTANTS.Vp_crust;
  } else {
    // Travel through crust and mantle
    const crustTime = CONSTANTS.crustThickness / CONSTANTS.Vp_crust;
    const mantleDist = hypoDist - CONSTANTS.crustThickness;
    const mantleTime = mantleDist / CONSTANTS.Vp_mantle;
    return crustTime + mantleTime;
  }
}

/**
 * Calculate S-wave travel time
 */
function sWaveTravelTime(distance: number, depth: number): number {
  const hypoDist = hypocentralDistance(distance, depth);

  if (depth < CONSTANTS.crustThickness) {
    return hypoDist / CONSTANTS.Vs_crust;
  } else {
    const crustTime = CONSTANTS.crustThickness / CONSTANTS.Vs_crust;
    const mantleDist = hypoDist - CONSTANTS.crustThickness;
    const mantleTime = mantleDist / CONSTANTS.Vs_mantle;
    return crustTime + mantleTime;
  }
}

/**
 * Calculate all phase arrivals
 */
function calculateArrivals(source: EarthquakeSource, station: SeismicStation): WaveArrival[] {
  const epicentralDist = haversineDistance(
    source.latitude, source.longitude,
    station.latitude, station.longitude
  );

  const arrivals: WaveArrival[] = [];

  // Direct P-wave
  const pTime = pWaveTravelTime(epicentralDist, source.depth);
  const pAmplitude = calculateAmplitude(source.magnitude, epicentralDist, source.depth, 'P');
  arrivals.push({
    phase: 'P',
    arrivalTime: pTime,
    distance: epicentralDist,
    amplitude: pAmplitude,
    rayParameter: Math.sin(Math.atan(epicentralDist / source.depth)) / CONSTANTS.Vp_crust
  });

  // Direct S-wave
  const sTime = sWaveTravelTime(epicentralDist, source.depth);
  const sAmplitude = calculateAmplitude(source.magnitude, epicentralDist, source.depth, 'S');
  arrivals.push({
    phase: 'S',
    arrivalTime: sTime,
    distance: epicentralDist,
    amplitude: sAmplitude,
    rayParameter: Math.sin(Math.atan(epicentralDist / source.depth)) / CONSTANTS.Vs_crust
  });

  // Surface waves (for shallow events)
  if (source.depth < 70 && epicentralDist > 100) {
    // Rayleigh wave
    const rayleighVelocity = 0.92 * CONSTANTS.Vs_crust;
    const rayleighTime = epicentralDist / rayleighVelocity;
    arrivals.push({
      phase: 'Rayleigh',
      arrivalTime: rayleighTime,
      distance: epicentralDist,
      amplitude: pAmplitude * 1.5
    });

    // Love wave
    const loveVelocity = CONSTANTS.Vs_crust;
    const loveTime = epicentralDist / loveVelocity;
    arrivals.push({
      phase: 'Love',
      arrivalTime: loveTime,
      distance: epicentralDist,
      amplitude: pAmplitude * 1.2
    });
  }

  return arrivals.sort((a, b) => a.arrivalTime - b.arrivalTime);
}

/**
 * Calculate wave amplitude with attenuation
 */
function calculateAmplitude(
  magnitude: number,
  distance: number,
  depth: number,
  waveType: 'P' | 'S'
): number {
  const M0 = seismicMomentFromMw(magnitude);
  const hypoDist = hypocentralDistance(distance, depth);

  // Geometric spreading (1/r)
  const geometricFactor = 1 / hypoDist;

  // Anelastic attenuation
  const Q = waveType === 'P' ? CONSTANTS.Q_p : CONSTANTS.Q_s;
  const V = waveType === 'P' ? CONSTANTS.Vp_crust : CONSTANTS.Vs_crust;
  const frequency = 1; // Reference frequency 1 Hz
  const attenuationFactor = Math.exp(-Math.PI * frequency * hypoDist / (Q * V));

  // Amplitude proportional to cube root of moment
  const sourceAmplitude = Math.pow(M0 / CONSTANTS.M0_reference, 1 / 3);

  return sourceAmplitude * geometricFactor * attenuationFactor;
}

// =============================================================================
// EARTHQUAKE LOCATION
// =============================================================================

/**
 * Locate earthquake using grid search
 */
function locateEarthquake(
  stations: SeismicStation[],
  pArrivals: { stationId: string; time: number }[],
  sArrivals: { stationId: string; time: number }[]
): LocationResult {
  // Grid search parameters
  const latRange = { min: -90, max: 90, step: 1 };
  const lonRange = { min: -180, max: 180, step: 1 };
  const depthRange = { min: 0, max: 100, step: 5 };

  let bestLocation = { lat: 0, lon: 0, depth: 10, originTime: 0, residual: Infinity };

  // Coarse grid search
  for (let lat = latRange.min; lat <= latRange.max; lat += latRange.step * 10) {
    for (let lon = lonRange.min; lon <= lonRange.max; lon += lonRange.step * 10) {
      for (let depth = depthRange.min; depth <= depthRange.max; depth += depthRange.step * 2) {
        const result = calculateResidual(stations, pArrivals, sArrivals, lat, lon, depth);
        if (result.residual < bestLocation.residual) {
          bestLocation = { lat, lon, depth, originTime: result.originTime, residual: result.residual };
        }
      }
    }
  }

  // Fine grid search around best location
  for (let lat = bestLocation.lat - 5; lat <= bestLocation.lat + 5; lat += 0.5) {
    for (let lon = bestLocation.lon - 5; lon <= bestLocation.lon + 5; lon += 0.5) {
      for (let depth = Math.max(0, bestLocation.depth - 20); depth <= bestLocation.depth + 20; depth += 2) {
        const result = calculateResidual(stations, pArrivals, sArrivals, lat, lon, depth);
        if (result.residual < bestLocation.residual) {
          bestLocation = { lat, lon, depth, originTime: result.originTime, residual: result.residual };
        }
      }
    }
  }

  // Calculate confidence based on residual
  const confidence = Math.max(0, Math.min(100, 100 - bestLocation.residual * 10));

  return {
    latitude: bestLocation.lat,
    longitude: bestLocation.lon,
    depth: bestLocation.depth,
    originTime: bestLocation.originTime,
    residual: bestLocation.residual,
    confidence
  };
}

function calculateResidual(
  stations: SeismicStation[],
  pArrivals: { stationId: string; time: number }[],
  sArrivals: { stationId: string; time: number }[],
  lat: number,
  lon: number,
  depth: number
): { residual: number; originTime: number } {
  const stationMap = new Map(stations.map(s => [s.id, s]));

  let totalResidual = 0;
  let originTimeSum = 0;
  let count = 0;

  // Calculate residuals for P arrivals
  for (const pArr of pArrivals) {
    const station = stationMap.get(pArr.stationId);
    if (!station) continue;

    const distance = haversineDistance(lat, lon, station.latitude, station.longitude);
    const predictedTime = pWaveTravelTime(distance, depth);
    const estimatedOrigin = pArr.time - predictedTime;

    originTimeSum += estimatedOrigin;
    count++;
  }

  const avgOriginTime = count > 0 ? originTimeSum / count : 0;

  // Calculate RMS residual
  for (const pArr of pArrivals) {
    const station = stationMap.get(pArr.stationId);
    if (!station) continue;

    const distance = haversineDistance(lat, lon, station.latitude, station.longitude);
    const predictedTime = pWaveTravelTime(distance, depth);
    const observedTime = pArr.time - avgOriginTime;
    totalResidual += Math.pow(predictedTime - observedTime, 2);
  }

  for (const sArr of sArrivals) {
    const station = stationMap.get(sArr.stationId);
    if (!station) continue;

    const distance = haversineDistance(lat, lon, station.latitude, station.longitude);
    const predictedTime = sWaveTravelTime(distance, depth);
    const observedTime = sArr.time - avgOriginTime;
    totalResidual += Math.pow(predictedTime - observedTime, 2);
  }

  const n = pArrivals.length + sArrivals.length;
  const rms = n > 0 ? Math.sqrt(totalResidual / n) : Infinity;

  return { residual: rms, originTime: avgOriginTime };
}

// =============================================================================
// HAZARD CALCULATIONS
// =============================================================================

/**
 * Calculate ground motion using GMPE (Ground Motion Prediction Equation)
 */
function calculateGroundMotion(
  magnitude: number,
  distance: number,
  depth: number,
  siteClass: 'A' | 'B' | 'C' | 'D' | 'E' = 'C'
): SeismicHazard {
  const hypoDist = hypocentralDistance(distance, depth);

  // Site amplification factors
  const siteFactors: Record<string, number> = {
    A: 0.8,   // Hard rock
    B: 1.0,   // Rock
    C: 1.2,   // Dense soil
    D: 1.6,   // Stiff soil
    E: 2.5    // Soft soil
  };
  const siteFactor = siteFactors[siteClass] ?? 1.0;

  // NGA-West2 like GMPE (simplified)
  // ln(PGA) = c0 + c1*(M-6) + c2*(M-6)^2 + c3*ln(R) + c4*R
  const c0 = -1.2;
  const c1 = 1.0;
  const c2 = -0.1;
  const c3 = -1.5;
  const c4 = -0.003;

  const lnPGA = c0 + c1 * (magnitude - 6) + c2 * Math.pow(magnitude - 6, 2) +
    c3 * Math.log(hypoDist) + c4 * hypoDist;

  const pga = Math.exp(lnPGA) * siteFactor;

  // PGV estimation (empirical relation)
  const pgv = pga * 100 * Math.pow(10, 0.5 * (magnitude - 5));

  // Spectral accelerations (simplified relationships)
  const sa_02 = pga * 2.5;  // Short period amplification
  const sa_10 = pga * 0.8;  // Long period reduction

  // Modified Mercalli Intensity (from PGA)
  const mmi = calculateMMI(pga);

  return {
    pga: Math.round(pga * 1000) / 1000,
    pgv: Math.round(pgv * 10) / 10,
    sa_02: Math.round(sa_02 * 1000) / 1000,
    sa_10: Math.round(sa_10 * 1000) / 1000,
    mmi: Math.round(mmi * 10) / 10
  };
}

/**
 * Calculate Modified Mercalli Intensity from PGA
 */
function calculateMMI(pga: number): number {
  // Wald et al. (1999) relation
  if (pga < 0.0017) return 1;
  if (pga < 0.014) return 2 + Math.log10(pga / 0.0017) / Math.log10(0.014 / 0.0017);
  if (pga < 0.039) return 3 + Math.log10(pga / 0.014) / Math.log10(0.039 / 0.014);
  if (pga < 0.092) return 4 + Math.log10(pga / 0.039) / Math.log10(0.092 / 0.039);
  if (pga < 0.18) return 5 + Math.log10(pga / 0.092) / Math.log10(0.18 / 0.092);
  if (pga < 0.34) return 6 + Math.log10(pga / 0.18) / Math.log10(0.34 / 0.18);
  if (pga < 0.65) return 7 + Math.log10(pga / 0.34) / Math.log10(0.65 / 0.34);
  if (pga < 1.24) return 8 + Math.log10(pga / 0.65) / Math.log10(1.24 / 0.65);
  return 9 + Math.log10(pga / 1.24);
}

/**
 * Get MMI description
 */
function mmiDescription(mmi: number): string {
  const descriptions: Record<number, string> = {
    1: 'Not felt',
    2: 'Felt by few',
    3: 'Felt by several',
    4: 'Felt by many',
    5: 'Strong - dishes rattle',
    6: 'Very strong - some damage',
    7: 'Severe - moderate damage',
    8: 'Destructive - heavy damage',
    9: 'Violent - buildings collapse',
    10: 'Extreme - total destruction'
  };
  return descriptions[Math.round(Math.min(10, Math.max(1, mmi)))] ?? 'Unknown';
}

// =============================================================================
// EXAMPLE DATA
// =============================================================================

const exampleEarthquakes: Record<string, EarthquakeSource> = {
  california_m6: {
    latitude: 34.05,
    longitude: -118.25,
    depth: 10,
    magnitude: 6.0,
    magnitudeType: 'Mw',
    faultType: 'strike-slip'
  },
  japan_m7: {
    latitude: 38.3,
    longitude: 142.4,
    depth: 25,
    magnitude: 7.1,
    magnitudeType: 'Mw',
    faultType: 'thrust'
  },
  chile_m8: {
    latitude: -33.5,
    longitude: -70.6,
    depth: 35,
    magnitude: 8.0,
    magnitudeType: 'Mw',
    faultType: 'thrust'
  },
  shallow_m5: {
    latitude: 37.8,
    longitude: -122.4,
    depth: 5,
    magnitude: 5.2,
    magnitudeType: 'ML',
    faultType: 'strike-slip'
  },
  deep_m6: {
    latitude: -5.5,
    longitude: 151.0,
    depth: 150,
    magnitude: 6.5,
    magnitudeType: 'Mw',
    faultType: 'normal'
  }
};

const exampleStations: SeismicStation[] = [
  { id: 'STA1', latitude: 34.1, longitude: -118.3, elevation: 200, siteClass: 'C' },
  { id: 'STA2', latitude: 34.0, longitude: -118.1, elevation: 150, siteClass: 'D' },
  { id: 'STA3', latitude: 33.9, longitude: -118.2, elevation: 100, siteClass: 'C' },
  { id: 'STA4', latitude: 34.2, longitude: -118.4, elevation: 300, siteClass: 'B' },
  { id: 'STA5', latitude: 34.0, longitude: -118.5, elevation: 50, siteClass: 'D' }
];

// =============================================================================
// TOOL DEFINITION
// =============================================================================

export const seismicanalysisTool: UnifiedTool = {
  name: 'seismic_analysis',
  description: 'Seismic wave analysis and earthquake modeling including magnitude calculation, earthquake location, wave propagation, ground motion prediction, and hazard assessment.',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['analyze', 'locate', 'magnitude', 'arrivals', 'hazard', 'convert', 'examples', 'info'],
        description: 'Operation: analyze earthquake, locate from arrivals, calculate magnitude, compute arrivals, assess hazard, convert magnitude types, examples, or info'
      },
      earthquake: {
        type: 'object',
        properties: {
          latitude: { type: 'number' },
          longitude: { type: 'number' },
          depth: { type: 'number' },
          magnitude: { type: 'number' },
          magnitudeType: { type: 'string', enum: ['Mw', 'ML', 'Ms', 'mb'] }
        },
        description: 'Earthquake source parameters'
      },
      earthquake_name: {
        type: 'string',
        description: 'Named earthquake: california_m6, japan_m7, chile_m8, shallow_m5, deep_m6'
      },
      station: {
        type: 'object',
        properties: {
          latitude: { type: 'number' },
          longitude: { type: 'number' },
          elevation: { type: 'number' },
          siteClass: { type: 'string', enum: ['A', 'B', 'C', 'D', 'E'] }
        },
        description: 'Seismic station location'
      },
      stations: {
        type: 'array',
        description: 'Array of seismic stations'
      },
      p_arrivals: {
        type: 'array',
        description: 'P-wave arrival times at stations'
      },
      s_arrivals: {
        type: 'array',
        description: 'S-wave arrival times at stations'
      },
      distance: {
        type: 'number',
        description: 'Epicentral distance in km'
      },
      from_type: { type: 'string', description: 'Source magnitude type for conversion' },
      to_type: { type: 'string', description: 'Target magnitude type for conversion' },
      value: { type: 'number', description: 'Magnitude value to convert' }
    },
    required: ['operation']
  }
};

// =============================================================================
// TOOL EXECUTOR
// =============================================================================

export async function executeseismicanalysis(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const {
      operation, earthquake: inputEQ, earthquake_name, station: inputStation,
      stations: inputStations, p_arrivals, s_arrivals, distance,
      from_type, to_type, value
    } = args;

    // Info operation
    if (operation === 'info') {
      const info = {
        tool: 'seismic-analysis',
        description: 'Comprehensive seismic analysis and earthquake modeling',
        capabilities: {
          magnitude_calculation: {
            types: ['Mw (moment)', 'ML (local)', 'Ms (surface)', 'mb (body)'],
            formulas: {
              'Mw_from_M0': 'Mw = (log10(M0) - 9.1) / 1.5',
              'energy': 'E = 10^(1.5*Mw + 4.8) Joules'
            }
          },
          wave_propagation: {
            p_wave: `${CONSTANTS.Vp_crust} km/s in crust`,
            s_wave: `${CONSTANTS.Vs_crust} km/s in crust`,
            phases: ['P', 'S', 'Rayleigh', 'Love']
          },
          hazard_assessment: {
            outputs: ['PGA (g)', 'PGV (cm/s)', 'Spectral acceleration', 'MMI'],
            site_classes: {
              A: 'Hard rock (Vs > 1500 m/s)',
              B: 'Rock (760-1500 m/s)',
              C: 'Dense soil (360-760 m/s)',
              D: 'Stiff soil (180-360 m/s)',
              E: 'Soft soil (< 180 m/s)'
            }
          },
          location: {
            method: 'Grid search with P and S arrivals',
            output: ['Latitude', 'Longitude', 'Depth', 'Origin time']
          }
        },
        constants: CONSTANTS,
        example_earthquakes: Object.keys(exampleEarthquakes)
      };
      return { toolCallId: id, content: JSON.stringify(info, null, 2) };
    }

    // Examples operation
    if (operation === 'examples') {
      const examples = Object.entries(exampleEarthquakes).map(([key, eq]) => ({
        name: key,
        ...eq,
        seismicMoment: seismicMomentFromMw(eq.magnitude),
        energyRelease: energyFromMagnitude(eq.magnitude)
      }));

      return {
        toolCallId: id,
        content: JSON.stringify({
          earthquakes: examples,
          stations: exampleStations
        }, null, 2)
      };
    }

    // Convert operation
    if (operation === 'convert') {
      if (!from_type || !to_type || value === undefined) {
        return {
          toolCallId: id,
          content: 'Error: from_type, to_type, and value required for conversion',
          isError: true
        };
      }

      const converted = convertMagnitude(value, from_type, to_type);

      return {
        toolCallId: id,
        content: JSON.stringify({
          input: { value, type: from_type },
          output: { value: Math.round(converted * 100) / 100, type: to_type },
          seismic_moment_Nm: seismicMomentFromMw(from_type === 'Mw' ? value : convertMagnitude(value, from_type, 'Mw')),
          energy_joules: energyFromMagnitude(from_type === 'Mw' ? value : convertMagnitude(value, from_type, 'Mw'))
        }, null, 2)
      };
    }

    // Get earthquake source
    let earthquake: EarthquakeSource;
    if (earthquake_name && exampleEarthquakes[earthquake_name]) {
      earthquake = exampleEarthquakes[earthquake_name];
    } else if (inputEQ) {
      earthquake = {
        latitude: inputEQ.latitude ?? 0,
        longitude: inputEQ.longitude ?? 0,
        depth: inputEQ.depth ?? 10,
        magnitude: inputEQ.magnitude ?? 5.0,
        magnitudeType: inputEQ.magnitudeType ?? 'Mw'
      };
    } else {
      earthquake = exampleEarthquakes.california_m6;
    }

    // Locate operation
    if (operation === 'locate') {
      const stations = inputStations ?? exampleStations;
      const pArr = p_arrivals ?? [];
      const sArr = s_arrivals ?? [];

      if (pArr.length === 0) {
        return {
          toolCallId: id,
          content: 'Error: P-wave arrivals required for location',
          isError: true
        };
      }

      const location = locateEarthquake(stations, pArr, sArr);

      return {
        toolCallId: id,
        content: JSON.stringify({
          location: {
            latitude: Math.round(location.latitude * 100) / 100,
            longitude: Math.round(location.longitude * 100) / 100,
            depth_km: Math.round(location.depth * 10) / 10,
            origin_time_s: Math.round(location.originTime * 100) / 100
          },
          quality: {
            rms_residual_s: Math.round(location.residual * 1000) / 1000,
            confidence_pct: Math.round(location.confidence)
          },
          input: {
            num_stations: stations.length,
            num_p_arrivals: pArr.length,
            num_s_arrivals: sArr.length
          }
        }, null, 2)
      };
    }

    // Magnitude operation
    if (operation === 'magnitude') {
      const Mw = earthquake.magnitudeType === 'Mw'
        ? earthquake.magnitude
        : convertMagnitude(earthquake.magnitude, earthquake.magnitudeType, 'Mw');

      const M0 = seismicMomentFromMw(Mw);
      const energy = energyFromMagnitude(Mw);

      const result: MagnitudeResult = {
        value: earthquake.magnitude,
        type: earthquake.magnitudeType,
        uncertainty: 0.2,
        seismicMoment: M0,
        energyRelease: energy
      };

      return {
        toolCallId: id,
        content: JSON.stringify({
          magnitude: result,
          conversions: {
            Mw: Mw,
            ML: convertMagnitude(Mw, 'Mw', 'ML'),
            Ms: convertMagnitude(Mw, 'Mw', 'Ms'),
            mb: convertMagnitude(Mw, 'Mw', 'mb')
          },
          seismic_moment: {
            value: M0,
            unit: 'N·m',
            scientific: M0.toExponential(2)
          },
          energy_release: {
            joules: energy,
            scientific: energy.toExponential(2),
            tnt_equivalent_tons: energy / 4.184e9
          }
        }, null, 2)
      };
    }

    // Arrivals operation
    if (operation === 'arrivals') {
      const station: SeismicStation = inputStation ?? exampleStations[0];
      const arrivals = calculateArrivals(earthquake, station);

      const epicentralDist = haversineDistance(
        earthquake.latitude, earthquake.longitude,
        station.latitude, station.longitude
      );

      return {
        toolCallId: id,
        content: JSON.stringify({
          source: {
            latitude: earthquake.latitude,
            longitude: earthquake.longitude,
            depth_km: earthquake.depth,
            magnitude: earthquake.magnitude
          },
          station: {
            id: station.id ?? 'CUSTOM',
            latitude: station.latitude,
            longitude: station.longitude
          },
          geometry: {
            epicentral_distance_km: Math.round(epicentralDist * 10) / 10,
            hypocentral_distance_km: Math.round(hypocentralDistance(epicentralDist, earthquake.depth) * 10) / 10,
            back_azimuth_deg: Math.round(backAzimuth(station.latitude, station.longitude, earthquake.latitude, earthquake.longitude))
          },
          arrivals: arrivals.map(a => ({
            phase: a.phase,
            time_s: Math.round(a.arrivalTime * 100) / 100,
            amplitude_relative: Math.round(a.amplitude * 1000) / 1000
          })),
          s_p_time_s: Math.round((arrivals.find(a => a.phase === 'S')?.arrivalTime ?? 0) -
            (arrivals.find(a => a.phase === 'P')?.arrivalTime ?? 0) * 100) / 100
        }, null, 2)
      };
    }

    // Hazard operation
    if (operation === 'hazard') {
      const dist = distance ?? 50;
      const siteClass = inputStation?.siteClass ?? 'C';

      const hazard = calculateGroundMotion(earthquake.magnitude, dist, earthquake.depth, siteClass);

      return {
        toolCallId: id,
        content: JSON.stringify({
          source: {
            magnitude: earthquake.magnitude,
            depth_km: earthquake.depth
          },
          site: {
            epicentral_distance_km: dist,
            hypocentral_distance_km: Math.round(hypocentralDistance(dist, earthquake.depth) * 10) / 10,
            site_class: siteClass
          },
          ground_motion: {
            PGA_g: hazard.pga,
            PGV_cm_s: hazard.pgv,
            Sa_0_2s_g: hazard.sa_02,
            Sa_1_0s_g: hazard.sa_10
          },
          intensity: {
            MMI: hazard.mmi,
            description: mmiDescription(hazard.mmi)
          }
        }, null, 2)
      };
    }

    // Analyze operation (default)
    const Mw = earthquake.magnitudeType === 'Mw'
      ? earthquake.magnitude
      : convertMagnitude(earthquake.magnitude, earthquake.magnitudeType, 'Mw');

    const M0 = seismicMomentFromMw(Mw);
    const energy = energyFromMagnitude(Mw);

    // Calculate hazard at multiple distances
    const distances = [10, 25, 50, 100, 200];
    const hazardProfile = distances.map(d => ({
      distance_km: d,
      ...calculateGroundMotion(earthquake.magnitude, d, earthquake.depth)
    }));

    return {
      toolCallId: id,
      content: JSON.stringify({
        earthquake: {
          location: {
            latitude: earthquake.latitude,
            longitude: earthquake.longitude,
            depth_km: earthquake.depth
          },
          magnitude: {
            value: earthquake.magnitude,
            type: earthquake.magnitudeType,
            Mw_equivalent: Mw
          },
          fault_type: earthquake.faultType ?? 'unknown',
          seismic_moment_Nm: M0.toExponential(2),
          energy_joules: energy.toExponential(2)
        },
        hazard_vs_distance: hazardProfile,
        felt_radius_km: {
          slight_damage: Math.round(Math.pow(10, (earthquake.magnitude - 3) / 1.5)),
          felt: Math.round(Math.pow(10, (earthquake.magnitude - 2) / 1.5))
        }
      }, null, 2)
    };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isseismicanalysisAvailable(): boolean {
  return true;
}
