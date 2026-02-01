/**
 * METEOROLOGY TOOL
 *
 * Weather calculations: heat index, wind chill, dew point,
 * atmospheric pressure, humidity, and weather forecasting basics.
 *
 * Part of TIER EARTH SCIENCE - Ultimate Tool Arsenal
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TEMPERATURE CONVERSIONS
// ============================================================================

function celsiusToFahrenheit(c: number): number { return c * 9/5 + 32; }
function fahrenheitToCelsius(f: number): number { return (f - 32) * 5/9; }
function celsiusToKelvin(c: number): number { return c + 273.15; }

// ============================================================================
// HEAT INDEX (Feels Like - Hot)
// ============================================================================

function heatIndex(T: number, RH: number): number {
  // Rothfusz regression (T in °F, RH in %)
  const T_f = celsiusToFahrenheit(T);

  if (T_f < 80) return T;

  let HI = -42.379 + 2.04901523 * T_f + 10.14333127 * RH
           - 0.22475541 * T_f * RH - 0.00683783 * T_f * T_f
           - 0.05481717 * RH * RH + 0.00122874 * T_f * T_f * RH
           + 0.00085282 * T_f * RH * RH - 0.00000199 * T_f * T_f * RH * RH;

  return fahrenheitToCelsius(HI);
}

// ============================================================================
// WIND CHILL (Feels Like - Cold)
// ============================================================================

function windChill(T: number, V: number): number {
  // T in °C, V in km/h
  const T_f = celsiusToFahrenheit(T);
  const V_mph = V * 0.621371;

  if (T_f > 50 || V_mph < 3) return T;

  const WC = 35.74 + 0.6215 * T_f - 35.75 * Math.pow(V_mph, 0.16)
             + 0.4275 * T_f * Math.pow(V_mph, 0.16);

  return fahrenheitToCelsius(WC);
}

// ============================================================================
// DEW POINT
// ============================================================================

function dewPoint(T: number, RH: number): number {
  // Magnus formula approximation
  const a = 17.27;
  const b = 237.7;
  const alpha = (a * T) / (b + T) + Math.log(RH / 100);
  return (b * alpha) / (a - alpha);
}

// ============================================================================
// HUMIDITY CALCULATIONS
// ============================================================================

function saturationVaporPressure(T: number): number {
  // Tetens equation (T in °C, result in kPa)
  return 0.6108 * Math.exp((17.27 * T) / (T + 237.3));
}

function relativeHumidity(T: number, Td: number): number {
  // From temperature and dew point
  const es = saturationVaporPressure(T);
  const e = saturationVaporPressure(Td);
  return (e / es) * 100;
}

function absoluteHumidity(T: number, RH: number): number {
  // g/m³
  const es = saturationVaporPressure(T) * 1000; // Pa
  const e = es * RH / 100;
  return (e * 0.622) / (461.5 * (T + 273.15)) * 1000;
}

// ============================================================================
// PRESSURE CALCULATIONS
// ============================================================================

function altitudePressure(P0: number, h: number): number {
  // Barometric formula (P0 in hPa, h in meters)
  return P0 * Math.exp(-h / 8500);
}

function pressureAltitude(P: number): number {
  // Standard atmosphere altitude from pressure
  return 8500 * Math.log(1013.25 / P);
}

function densityAltitude(P: number, T: number): number {
  // Accounting for temperature
  const PA = pressureAltitude(P);
  const ISA_T = 15 - 0.00198 * PA; // ISA temperature at that altitude
  return PA + 36.576 * (T - ISA_T);
}

// ============================================================================
// CLOUD BASE ESTIMATION
// ============================================================================

function cloudBase(T: number, Td: number): number {
  // Estimate cloud base height in meters
  return (T - Td) * 125;
}

// ============================================================================
// VISIBILITY & PRECIPITATION
// ============================================================================

function visibilityFromRH(RH: number): string {
  if (RH >= 100) return 'Fog likely (<1 km)';
  if (RH >= 95) return 'Mist (1-2 km)';
  if (RH >= 90) return 'Haze (2-5 km)';
  if (RH >= 80) return 'Reduced (5-10 km)';
  return 'Good (>10 km)';
}

function precipitationType(T: number, wetBulb: number): string {
  if (T > 2) return 'Rain';
  if (T < -2 && wetBulb < -2) return 'Snow';
  if (T >= -2 && T <= 2) return 'Mix (Rain/Snow)';
  if (wetBulb > 0 && T < 0) return 'Freezing Rain';
  return 'Snow';
}

// ============================================================================
// WEATHER INDICES
// ============================================================================

function beaufortScale(windSpeed: number): { force: number; description: string } {
  // Wind speed in m/s
  const scales = [
    { max: 0.5, force: 0, description: 'Calm' },
    { max: 1.5, force: 1, description: 'Light air' },
    { max: 3.3, force: 2, description: 'Light breeze' },
    { max: 5.5, force: 3, description: 'Gentle breeze' },
    { max: 7.9, force: 4, description: 'Moderate breeze' },
    { max: 10.7, force: 5, description: 'Fresh breeze' },
    { max: 13.8, force: 6, description: 'Strong breeze' },
    { max: 17.1, force: 7, description: 'Near gale' },
    { max: 20.7, force: 8, description: 'Gale' },
    { max: 24.4, force: 9, description: 'Strong gale' },
    { max: 28.4, force: 10, description: 'Storm' },
    { max: 32.6, force: 11, description: 'Violent storm' },
    { max: Infinity, force: 12, description: 'Hurricane' },
  ];

  const scale = scales.find(s => windSpeed <= s.max)!;
  return { force: scale.force, description: scale.description };
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const meteorologyTool: UnifiedTool = {
  name: 'meteorology',
  description: `Weather and atmospheric calculations.

Operations:
- heat_index: Calculate feels-like temperature (hot conditions)
- wind_chill: Calculate wind chill (cold conditions)
- dew_point: Calculate dew point from temperature and humidity
- humidity: Various humidity calculations
- pressure: Atmospheric pressure and altitude
- cloud_base: Estimate cloud base height
- beaufort: Wind speed to Beaufort scale
- conditions: Analyze weather conditions`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['heat_index', 'wind_chill', 'dew_point', 'humidity', 'pressure', 'cloud_base', 'beaufort', 'conditions'],
        description: 'Weather calculation type',
      },
      temperature: { type: 'number', description: 'Temperature in °C' },
      humidity: { type: 'number', description: 'Relative humidity (%)' },
      dew_point: { type: 'number', description: 'Dew point in °C' },
      wind_speed: { type: 'number', description: 'Wind speed (m/s or km/h based on operation)' },
      pressure: { type: 'number', description: 'Atmospheric pressure (hPa)' },
      altitude: { type: 'number', description: 'Altitude (meters)' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeMeteorology(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'heat_index': {
        const { temperature = 30, humidity = 60 } = args;
        const hi = heatIndex(temperature, humidity);

        let warning = 'Normal';
        if (hi >= 54) warning = 'EXTREME DANGER: Heat stroke imminent';
        else if (hi >= 41) warning = 'DANGER: Heat cramps/exhaustion likely';
        else if (hi >= 32) warning = 'CAUTION: Fatigue possible';

        result = {
          operation: 'heat_index',
          temperature_C: temperature,
          relative_humidity_percent: humidity,
          heat_index_C: Math.round(hi * 10) / 10,
          heat_index_F: Math.round(celsiusToFahrenheit(hi) * 10) / 10,
          warning,
        };
        break;
      }

      case 'wind_chill': {
        const { temperature = -5, wind_speed = 20 } = args;
        const wc = windChill(temperature, wind_speed);

        let frostbite = 'Low risk';
        if (wc <= -35) frostbite = 'HIGH: Frostbite in 10-30 minutes';
        else if (wc <= -25) frostbite = 'MODERATE: Frostbite in 30+ minutes';

        result = {
          operation: 'wind_chill',
          temperature_C: temperature,
          wind_speed_km_h: wind_speed,
          wind_chill_C: Math.round(wc * 10) / 10,
          wind_chill_F: Math.round(celsiusToFahrenheit(wc) * 10) / 10,
          frostbite_risk: frostbite,
        };
        break;
      }

      case 'dew_point': {
        const { temperature = 25, humidity = 50 } = args;
        const dp = dewPoint(temperature, humidity);

        let comfort = 'Comfortable';
        if (dp > 24) comfort = 'Severely uncomfortable, oppressive';
        else if (dp > 21) comfort = 'Very humid, uncomfortable';
        else if (dp > 18) comfort = 'Somewhat uncomfortable';
        else if (dp > 13) comfort = 'Comfortable';
        else if (dp > 10) comfort = 'Very comfortable';
        else comfort = 'Dry';

        result = {
          operation: 'dew_point',
          temperature_C: temperature,
          relative_humidity_percent: humidity,
          dew_point_C: Math.round(dp * 10) / 10,
          comfort_level: comfort,
          fog_likely: dp >= temperature - 2,
        };
        break;
      }

      case 'humidity': {
        const { temperature = 25, humidity, dew_point: dpInput } = args;

        if (humidity !== undefined) {
          const dp = dewPoint(temperature, humidity);
          const absHum = absoluteHumidity(temperature, humidity);
          const svp = saturationVaporPressure(temperature);

          result = {
            operation: 'humidity',
            mode: 'from_relative_humidity',
            temperature_C: temperature,
            relative_humidity_percent: humidity,
            dew_point_C: Math.round(dp * 10) / 10,
            absolute_humidity_g_m3: Math.round(absHum * 100) / 100,
            saturation_vapor_pressure_kPa: Math.round(svp * 1000) / 1000,
          };
        } else if (dpInput !== undefined) {
          const rh = relativeHumidity(temperature, dpInput);

          result = {
            operation: 'humidity',
            mode: 'from_dew_point',
            temperature_C: temperature,
            dew_point_C: dpInput,
            relative_humidity_percent: Math.round(rh * 10) / 10,
          };
        } else {
          throw new Error('Provide either humidity or dew_point');
        }
        break;
      }

      case 'pressure': {
        const { pressure = 1013.25, altitude, temperature = 15 } = args;

        if (altitude !== undefined) {
          const pAtAlt = altitudePressure(pressure, altitude);
          result = {
            operation: 'pressure',
            mode: 'pressure_at_altitude',
            sea_level_pressure_hPa: pressure,
            altitude_m: altitude,
            pressure_at_altitude_hPa: Math.round(pAtAlt * 10) / 10,
          };
        } else {
          const pressAlt = pressureAltitude(pressure);
          const densAlt = densityAltitude(pressure, temperature);

          result = {
            operation: 'pressure',
            mode: 'altitude_from_pressure',
            pressure_hPa: pressure,
            temperature_C: temperature,
            pressure_altitude_m: Math.round(pressAlt),
            density_altitude_m: Math.round(densAlt),
          };
        }
        break;
      }

      case 'cloud_base': {
        const { temperature = 25, humidity = 60, dew_point: dpInput } = args;
        const dp = dpInput ?? dewPoint(temperature, humidity);
        const base = cloudBase(temperature, dp);

        result = {
          operation: 'cloud_base',
          temperature_C: temperature,
          dew_point_C: Math.round(dp * 10) / 10,
          estimated_cloud_base_m: Math.round(base),
          estimated_cloud_base_ft: Math.round(base * 3.281),
          note: 'Estimate valid for cumulus clouds forming by convection',
        };
        break;
      }

      case 'beaufort': {
        const { wind_speed = 10 } = args;
        const scale = beaufortScale(wind_speed);

        result = {
          operation: 'beaufort',
          wind_speed_m_s: wind_speed,
          wind_speed_km_h: Math.round(wind_speed * 3.6 * 10) / 10,
          wind_speed_knots: Math.round(wind_speed * 1.944 * 10) / 10,
          beaufort_force: scale.force,
          description: scale.description,
        };
        break;
      }

      case 'conditions': {
        const { temperature = 20, humidity = 50, wind_speed = 5, pressure = 1013.25 } = args;

        const dp = dewPoint(temperature, humidity);
        const hi = heatIndex(temperature, humidity);
        const wc = windChill(temperature, wind_speed * 3.6);
        const base = cloudBase(temperature, dp);
        const scale = beaufortScale(wind_speed);
        const visibility = visibilityFromRH(humidity);

        const feelsLike = temperature > 27 ? hi : (temperature < 10 ? wc : temperature);

        result = {
          operation: 'conditions',
          current: {
            temperature_C: temperature,
            humidity_percent: humidity,
            wind_speed_m_s: wind_speed,
            pressure_hPa: pressure,
          },
          derived: {
            feels_like_C: Math.round(feelsLike * 10) / 10,
            dew_point_C: Math.round(dp * 10) / 10,
            cloud_base_m: Math.round(base),
            wind_beaufort: `Force ${scale.force} (${scale.description})`,
            visibility: visibility,
          },
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (error) {
    return { toolCallId: id, content: `Meteorology Error: ${error instanceof Error ? error.message : 'Unknown'}`, isError: true };
  }
}

export function isMeteorologyAvailable(): boolean { return true; }
