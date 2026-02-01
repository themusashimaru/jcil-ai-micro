/**
 * OCEANOGRAPHY TOOL
 *
 * Ocean science calculations: wave dynamics, tides, salinity,
 * ocean currents, and marine acoustics.
 *
 * Part of TIER EARTH SCIENCE - Ultimate Tool Arsenal
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// WAVE DYNAMICS
// ============================================================================

function waveSpeed(depth: number, wavelength: number): { speed: number; type: string } {
  const g = 9.81;

  // Deep water: depth > wavelength/2
  // Shallow water: depth < wavelength/20
  // Intermediate: between

  if (depth > wavelength / 2) {
    // Deep water waves
    const speed = Math.sqrt((g * wavelength) / (2 * Math.PI));
    return { speed, type: 'Deep water' };
  } else if (depth < wavelength / 20) {
    // Shallow water waves
    const speed = Math.sqrt(g * depth);
    return { speed, type: 'Shallow water' };
  } else {
    // Intermediate (full equation)
    const k = (2 * Math.PI) / wavelength;
    const speed = Math.sqrt((g / k) * Math.tanh(k * depth));
    return { speed, type: 'Intermediate' };
  }
}

function waveEnergy(height: number, wavelength: number): number {
  // E = (1/8) × ρ × g × H²
  const rho = 1025; // seawater density kg/m³
  const g = 9.81;
  return (1/8) * rho * g * height * height;
}

function significantWaveHeight(waves: number[]): number {
  // H_s = average of highest 1/3 of waves
  const sorted = [...waves].sort((a, b) => b - a);
  const top33 = sorted.slice(0, Math.ceil(sorted.length / 3));
  return top33.reduce((a, b) => a + b, 0) / top33.length;
}

function breakingWaveDepth(waveHeight: number): number {
  // Waves break when depth ≈ 1.28 × wave height
  return waveHeight / 0.78;
}

// ============================================================================
// TIDES
// ============================================================================

function tidalRange(highTide: number, lowTide: number): { range: number; type: string } {
  const range = highTide - lowTide;
  let type = 'Microtidal';
  if (range > 4) type = 'Macrotidal';
  else if (range > 2) type = 'Mesotidal';

  return { range, type };
}

function tidalPrism(area: number, tidalRange: number): number {
  // Volume of water exchanged
  return area * tidalRange;
}

// ============================================================================
// SALINITY & DENSITY
// ============================================================================

function seawaterDensity(temperature: number, salinity: number, pressure: number = 0): number {
  // Simplified UNESCO equation
  const T = temperature;
  const S = salinity;
  const P = pressure / 10; // dbar to bar approximation

  // Reference density at T, S=0, P=0
  const rho_0 = 999.842594 + 6.793952e-2 * T - 9.095290e-3 * T*T
                + 1.001685e-4 * T*T*T - 1.120083e-6 * T*T*T*T;

  // Salinity correction
  const A = 8.24493e-1 - 4.0899e-3 * T + 7.6438e-5 * T*T;
  const B = -5.72466e-3 + 1.0227e-4 * T;

  const rho = rho_0 + A * S + B * S * Math.sqrt(S) + P * 0.046; // simplified pressure term

  return rho;
}

function salinityFromConductivity(conductivity: number, temperature: number): number {
  // Simplified PSS-78 (Practical Salinity Scale)
  const R = conductivity / 42.914; // ratio to standard
  const rT = 0.6766097 + 2.00564e-2 * temperature;
  return 0.008 - 0.1692 * Math.sqrt(R / rT) + 25.3851 * R / rT;
}

// ============================================================================
// SOUND IN WATER
// ============================================================================

function soundSpeedWater(temperature: number, salinity: number, depth: number): number {
  // Mackenzie equation (1981)
  const T = temperature;
  const S = salinity;
  const D = depth;

  return 1448.96 + 4.591 * T - 5.304e-2 * T*T + 2.374e-4 * T*T*T
         + 1.340 * (S - 35) + 1.630e-2 * D + 1.675e-7 * D*D
         - 1.025e-2 * T * (S - 35) - 7.139e-13 * T * D*D*D;
}

function sonarRange(sourceLevel: number, transmissionLoss: number, noiseLevel: number, detectionThreshold: number): number {
  // Sonar equation simplified
  const signalExcess = sourceLevel - 2 * transmissionLoss - noiseLevel - detectionThreshold;
  return signalExcess > 0 ? Math.pow(10, transmissionLoss / 20) : 0;
}

// ============================================================================
// OCEAN CURRENTS
// ============================================================================

function coriolisParameter(latitude: number): number {
  // f = 2Ω sin(φ)
  const omega = 7.2921e-5; // Earth's rotation rate rad/s
  return 2 * omega * Math.sin(latitude * Math.PI / 180);
}

function geostrophicVelocity(pressureGradient: number, density: number, latitude: number): number {
  // Velocity perpendicular to pressure gradient
  const f = coriolisParameter(latitude);
  if (Math.abs(f) < 1e-10) return 0; // undefined at equator
  return pressureGradient / (density * f);
}

function ekmanDepth(windSpeed: number, latitude: number): number {
  // Depth of Ekman spiral
  const f = Math.abs(coriolisParameter(latitude));
  if (f < 1e-10) return 0;

  const Az = 0.1; // eddy viscosity m²/s (typical)
  return Math.PI * Math.sqrt(2 * Az / f);
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const oceanographyTool: UnifiedTool = {
  name: 'oceanography',
  description: `Ocean science and marine calculations.

Operations:
- waves: Wave speed, energy, and breaking
- tides: Tidal range and prism calculations
- salinity: Seawater density and salinity
- acoustics: Sound speed and sonar in water
- currents: Ocean current and Coriolis calculations`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['waves', 'tides', 'salinity', 'acoustics', 'currents'],
        description: 'Oceanography operation',
      },
      depth: { type: 'number', description: 'Water depth (m)' },
      wavelength: { type: 'number', description: 'Wave wavelength (m)' },
      wave_height: { type: 'number', description: 'Wave height (m)' },
      high_tide: { type: 'number', description: 'High tide level (m)' },
      low_tide: { type: 'number', description: 'Low tide level (m)' },
      area: { type: 'number', description: 'Basin area (m²)' },
      temperature: { type: 'number', description: 'Water temperature (°C)' },
      salinity: { type: 'number', description: 'Salinity (PSU/ppt)' },
      conductivity: { type: 'number', description: 'Conductivity (mS/cm)' },
      latitude: { type: 'number', description: 'Latitude (degrees)' },
      wind_speed: { type: 'number', description: 'Wind speed (m/s)' },
      pressure_gradient: { type: 'number', description: 'Pressure gradient (Pa/m)' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeOceanography(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'waves': {
        const { depth = 100, wavelength = 50, wave_height = 2 } = args;
        const { speed, type } = waveSpeed(depth, wavelength);
        const energy = waveEnergy(wave_height, wavelength);
        const breakDepth = breakingWaveDepth(wave_height);
        const period = wavelength / speed;

        result = {
          operation: 'waves',
          parameters: { depth_m: depth, wavelength_m: wavelength, wave_height_m: wave_height },
          wave_type: type,
          wave_speed_m_s: Math.round(speed * 100) / 100,
          wave_period_s: Math.round(period * 100) / 100,
          wave_energy_J_m2: Math.round(energy),
          breaking_depth_m: Math.round(breakDepth * 100) / 100,
          depth_wavelength_ratio: Math.round(depth / wavelength * 100) / 100,
        };
        break;
      }

      case 'tides': {
        const { high_tide = 3, low_tide = 0.5, area } = args;
        const { range, type } = tidalRange(high_tide, low_tide);

        const tideResult: Record<string, unknown> = {
          operation: 'tides',
          high_tide_m: high_tide,
          low_tide_m: low_tide,
          tidal_range_m: Math.round(range * 100) / 100,
          tide_classification: type,
          mean_tide_level_m: Math.round((high_tide + low_tide) / 2 * 100) / 100,
        };

        if (area !== undefined) {
          const prism = tidalPrism(area, range);
          tideResult.basin_area_m2 = area;
          tideResult.tidal_prism_m3 = Math.round(prism);
          tideResult.tidal_prism_million_m3 = Math.round(prism / 1e6 * 100) / 100;
        }

        result = tideResult;
        break;
      }

      case 'salinity': {
        const { temperature = 15, salinity = 35, depth = 0, conductivity } = args;

        if (conductivity !== undefined) {
          const S = salinityFromConductivity(conductivity, temperature);
          const rho = seawaterDensity(temperature, S, depth);

          result = {
            operation: 'salinity',
            mode: 'from_conductivity',
            conductivity_mS_cm: conductivity,
            temperature_C: temperature,
            calculated_salinity_PSU: Math.round(S * 100) / 100,
            density_kg_m3: Math.round(rho * 100) / 100,
          };
        } else {
          const rho = seawaterDensity(temperature, salinity, depth);
          const sigma_t = rho - 1000;

          result = {
            operation: 'salinity',
            mode: 'density_calculation',
            temperature_C: temperature,
            salinity_PSU: salinity,
            depth_m: depth,
            density_kg_m3: Math.round(rho * 100) / 100,
            sigma_t: Math.round(sigma_t * 100) / 100,
            water_type: salinity < 0.5 ? 'Fresh' : salinity < 30 ? 'Brackish' : salinity < 40 ? 'Normal seawater' : 'Hypersaline',
          };
        }
        break;
      }

      case 'acoustics': {
        const { temperature = 15, salinity = 35, depth = 100 } = args;
        const soundSpeed = soundSpeedWater(temperature, salinity, depth);

        result = {
          operation: 'acoustics',
          temperature_C: temperature,
          salinity_PSU: salinity,
          depth_m: depth,
          sound_speed_m_s: Math.round(soundSpeed * 10) / 10,
          comparison_air_speed_m_s: 343,
          ratio_to_air: Math.round(soundSpeed / 343 * 100) / 100,
          factors: {
            temperature_effect: 'Sound speed increases ~4 m/s per °C',
            salinity_effect: 'Sound speed increases ~1.3 m/s per PSU',
            depth_effect: 'Sound speed increases ~1.6 m/s per 100m',
          },
        };
        break;
      }

      case 'currents': {
        const { latitude = 45, wind_speed = 10, pressure_gradient = 0.001 } = args;
        const f = coriolisParameter(latitude);
        const ekman = ekmanDepth(wind_speed, latitude);
        const geoV = geostrophicVelocity(pressure_gradient, 1025, latitude);

        result = {
          operation: 'currents',
          latitude_degrees: latitude,
          coriolis_parameter_s_1: f.toExponential(4),
          coriolis_effect: Math.abs(latitude) < 5 ? 'Negligible (near equator)' : Math.abs(latitude) < 30 ? 'Moderate' : 'Strong',
          ekman_depth_m: Math.round(ekman * 10) / 10,
          ekman_transport_direction: latitude > 0 ? '90° right of wind' : '90° left of wind',
          geostrophic_velocity_m_s: Math.abs(geoV) < 100 ? Math.round(geoV * 1000) / 1000 : 'N/A',
          wind_speed_m_s: wind_speed,
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (error) {
    return { toolCallId: id, content: `Oceanography Error: ${error instanceof Error ? error.message : 'Unknown'}`, isError: true };
  }
}

export function isOceanographyAvailable(): boolean { return true; }
