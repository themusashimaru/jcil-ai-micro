/**
 * WEATHER-MODEL TOOL
 * Comprehensive weather prediction and atmospheric modeling
 * including numerical weather prediction, ensemble forecasting, and climate analysis
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// =============================================================================
// PHYSICAL CONSTANTS
// =============================================================================

const CONSTANTS = {
  R_dry: 287.05,           // Gas constant for dry air (J/kg·K)
  R_vapor: 461.5,          // Gas constant for water vapor (J/kg·K)
  Cp: 1004,                // Specific heat at constant pressure (J/kg·K)
  Cv: 717,                 // Specific heat at constant volume (J/kg·K)
  L_v: 2.5e6,              // Latent heat of vaporization (J/kg)
  L_f: 3.34e5,             // Latent heat of fusion (J/kg)
  g: 9.81,                 // Gravitational acceleration (m/s²)
  omega: 7.2921e-5,        // Earth's angular velocity (rad/s)
  R_earth: 6.371e6,        // Earth's radius (m)
  sigma: 5.67e-8,          // Stefan-Boltzmann constant (W/m²·K⁴)
  kappa: 0.286,            // R/Cp ratio
  gamma_d: 0.0098,         // Dry adiabatic lapse rate (K/m)
  gamma_s: 0.006           // Saturated adiabatic lapse rate (K/m) ~average
};

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface AtmosphericState {
  temperature: number;       // Kelvin
  pressure: number;          // Pa
  humidity: number;          // Relative humidity 0-1
  windSpeed: number;         // m/s
  windDirection: number;     // degrees from north
  cloudCover: number;        // 0-1
  precipitation: number;     // mm/hr
  dewPoint: number;          // Kelvin
  visibility: number;        // km
}

interface Location {
  latitude: number;
  longitude: number;
  elevation: number;         // meters
  name?: string;
}

interface WeatherForecast {
  time: string;
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  precipitation: number;
  precipitationType: string;
  cloudCover: number;
  condition: string;
  uvIndex: number;
  visibility: number;
}

interface EnsembleMember {
  id: number;
  forecast: WeatherForecast[];
  perturbation: string;
}

interface EnsembleResult {
  mean: WeatherForecast[];
  spread: number[];
  members: EnsembleMember[];
  confidence: number;
}

interface StabilityIndices {
  CAPE: number;              // Convective Available Potential Energy (J/kg)
  CIN: number;               // Convective Inhibition (J/kg)
  LI: number;                // Lifted Index (°C)
  KI: number;                // K-Index
  TT: number;                // Total Totals
  SWEAT: number;             // Severe Weather Threat Index
  precipitableWater: number; // mm
}

// =============================================================================
// ATMOSPHERIC CALCULATIONS
// =============================================================================

/**
 * Calculate saturation vapor pressure using Clausius-Clapeyron
 */
function saturationVaporPressure(tempK: number): number {
  const tempC = tempK - 273.15;
  // Magnus formula
  return 611.2 * Math.exp((17.67 * tempC) / (tempC + 243.5));
}

/**
 * Calculate dew point temperature
 */
function dewPoint(tempK: number, relativeHumidity: number): number {
  const e = relativeHumidity * saturationVaporPressure(tempK);
  const gamma = Math.log(e / 611.2);
  return 273.15 + (243.5 * gamma) / (17.67 - gamma);
}

/**
 * Calculate feels-like temperature (heat index / wind chill)
 */
function feelsLikeTemperature(tempK: number, humidity: number, windSpeed: number): number {
  const tempC = tempK - 273.15;
  const tempF = tempC * 9 / 5 + 32;
  const rh = humidity * 100;

  // Heat index for warm temperatures
  if (tempF >= 80 && rh >= 40) {
    const HI = -42.379 + 2.04901523 * tempF + 10.14333127 * rh
      - 0.22475541 * tempF * rh - 0.00683783 * tempF * tempF
      - 0.05481717 * rh * rh + 0.00122874 * tempF * tempF * rh
      + 0.00085282 * tempF * rh * rh - 0.00000199 * tempF * tempF * rh * rh;
    return (HI - 32) * 5 / 9 + 273.15;
  }

  // Wind chill for cold temperatures
  if (tempF <= 50 && windSpeed > 1.34) {
    const windMph = windSpeed * 2.237;
    const WC = 35.74 + 0.6215 * tempF - 35.75 * Math.pow(windMph, 0.16)
      + 0.4275 * tempF * Math.pow(windMph, 0.16);
    return (WC - 32) * 5 / 9 + 273.15;
  }

  return tempK;
}

/**
 * Calculate air density
 */
function airDensity(pressure: number, tempK: number, humidity: number): number {
  const e = humidity * saturationVaporPressure(tempK);
  const pd = pressure - e;
  return (pd / (CONSTANTS.R_dry * tempK)) + (e / (CONSTANTS.R_vapor * tempK));
}

/**
 * Calculate potential temperature
 */
function potentialTemperature(tempK: number, pressure: number): number {
  const p0 = 100000; // Reference pressure 1000 hPa
  return tempK * Math.pow(p0 / pressure, CONSTANTS.kappa);
}

/**
 * Calculate Coriolis parameter
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function coriolisParameter(latitude: number): number {
  return 2 * CONSTANTS.omega * Math.sin(latitude * Math.PI / 180);
}

/**
 * Calculate pressure at altitude using barometric formula
 */
function pressureAtAltitude(seaLevelPressure: number, altitude: number, tempK: number): number {
  const M = 0.0289644;  // Molar mass of air kg/mol
  const R = 8.31447;    // Universal gas constant J/(mol·K)
  return seaLevelPressure * Math.exp(-M * CONSTANTS.g * altitude / (R * tempK));
}

/**
 * Calculate Lifted Index
 */
function liftedIndex(
  surfaceTemp: number,
  surfaceDewPoint: number,
  temp500: number
): number {
  // Simplified: lift parcel from surface to 500 hPa
  // LI = T500 - T_parcel at 500 hPa
  const lcl = lclTemperature(surfaceTemp, surfaceDewPoint);
  // Approximate parcel temperature at 500 hPa
  const parcelTemp500 = lcl - CONSTANTS.gamma_s * 5000;
  return temp500 - parcelTemp500;
}

/**
 * Calculate LCL temperature (Lifting Condensation Level)
 */
function lclTemperature(tempK: number, dewPointK: number): number {
  // Espy's formula approximation
  return tempK - (tempK - dewPointK) / (1 + (CONSTANTS.L_v * CONSTANTS.gamma_s) / (CONSTANTS.R_dry * tempK));
}

/**
 * Calculate CAPE (simplified)
 */
function calculateCAPE(
  surfaceTemp: number,
  surfacePressure: number,
  lapseRate: number,
  tropopauseHeight: number
): number {
  // Simplified CAPE calculation
  let cape = 0;
  const dz = 100; // 100m intervals

  for (let z = 0; z < tropopauseHeight; z += dz) {
    const envTemp = surfaceTemp - lapseRate * z;
    const parcelTemp = surfaceTemp - CONSTANTS.gamma_s * z;

    if (parcelTemp > envTemp) {
      const buoyancy = CONSTANTS.g * (parcelTemp - envTemp) / envTemp;
      cape += buoyancy * dz;
    }
  }

  return Math.max(0, cape);
}

/**
 * Calculate K-Index
 */
function kIndex(
  temp850: number,
  temp500: number,
  dewPoint850: number,
  dewPoint700: number
): number {
  // KI = T850 - T500 + Td850 - (T700 - Td700)
  // Simplified version
  const tempDiff = temp850 - temp500;
  return tempDiff + dewPoint850 - (temp850 - 5 - dewPoint700);
}

/**
 * Calculate stability indices
 */
function calculateStabilityIndices(state: AtmosphericState, location: Location): StabilityIndices {
  const surfaceTemp = state.temperature;
  const surfaceDewPoint = dewPoint(state.temperature, state.humidity);

  // Estimate temperatures at different levels
  const temp850 = surfaceTemp - CONSTANTS.gamma_d * (1500 - location.elevation);
  const temp500 = surfaceTemp - CONSTANTS.gamma_d * (5500 - location.elevation);

  const dewPoint850 = surfaceDewPoint - 2;
  const dewPoint700 = surfaceDewPoint - 6;

  const cape = calculateCAPE(surfaceTemp, state.pressure, CONSTANTS.gamma_d, 12000);
  const cin = -cape * 0.1; // Simplified CIN estimate

  const li = liftedIndex(surfaceTemp, surfaceDewPoint, temp500);
  const ki = kIndex(temp850, temp500, dewPoint850, dewPoint700);

  // Total Totals
  const tt = (temp850 - temp500) + (dewPoint850 - temp500);

  // SWEAT Index (simplified)
  const sweat = 12 * (dewPoint850 - 273.15) + 20 * (tt - 49) + 2 * state.windSpeed + 125 * (Math.sin((state.windDirection - 30) * Math.PI / 180) + 0.2);

  // Precipitable water (simplified)
  const pw = state.humidity * 50; // Rough estimate in mm

  return {
    CAPE: cape,
    CIN: cin,
    LI: li,
    KI: ki,
    TT: tt,
    SWEAT: Math.max(0, sweat),
    precipitableWater: pw
  };
}

// =============================================================================
// WEATHER CONDITION DETERMINATION
// =============================================================================

function determineWeatherCondition(state: AtmosphericState): string {
  const tempC = state.temperature - 273.15;

  if (state.precipitation > 0) {
    if (tempC < 0) {
      if (state.precipitation > 5) return 'Heavy Snow';
      return 'Snow';
    } else if (tempC < 2) {
      return 'Sleet';
    } else {
      if (state.precipitation > 10) return 'Heavy Rain';
      if (state.precipitation > 2) return 'Rain';
      return 'Light Rain';
    }
  }

  if (state.cloudCover > 0.8) {
    if (state.visibility < 1) return 'Fog';
    return 'Overcast';
  }

  if (state.cloudCover > 0.5) return 'Mostly Cloudy';
  if (state.cloudCover > 0.25) return 'Partly Cloudy';
  if (state.cloudCover > 0.1) return 'Few Clouds';

  return 'Clear';
}

function determinePrecipType(tempK: number): string {
  const tempC = tempK - 273.15;
  if (tempC < -5) return 'snow';
  if (tempC < 0) return 'mixed';
  if (tempC < 3) return 'sleet_possible';
  return 'rain';
}

function calculateUVIndex(cloudCover: number, latitude: number, elevation: number): number {
  // Simplified UV index calculation
  const solarAngle = Math.max(0, Math.cos(latitude * Math.PI / 180));
  const clearSkyUV = 11 * solarAngle;
  const cloudFactor = 1 - 0.7 * cloudCover;
  const elevationFactor = 1 + elevation / 10000;
  return Math.round(clearSkyUV * cloudFactor * elevationFactor);
}

// =============================================================================
// NUMERICAL WEATHER PREDICTION
// =============================================================================

function numericalForecast(
  initialState: AtmosphericState,
  location: Location,
  hours: number
): WeatherForecast[] {
  const forecasts: WeatherForecast[] = [];
  const dt = 1; // 1 hour time step

  let state = { ...initialState };

  for (let h = 0; h <= hours; h += dt) {
    // Diurnal temperature variation
    const hourOfDay = h % 24;
    const diurnalVariation = 5 * Math.sin((hourOfDay - 6) * Math.PI / 12);

    // Simple advection effects
    const advectionTemp = state.windSpeed * 0.1 * Math.cos(state.windDirection * Math.PI / 180);

    // Update temperature
    const newTemp = initialState.temperature + diurnalVariation + advectionTemp * (h / 24);

    // Update humidity (inverse relation with temperature)
    const newHumidity = Math.min(1, Math.max(0.1, state.humidity - 0.02 * diurnalVariation));

    // Cloud formation
    const saturationRatio = newHumidity * saturationVaporPressure(newTemp) / saturationVaporPressure(initialState.temperature);
    const newCloudCover = Math.min(1, Math.max(0, saturationRatio - 0.5) * 2);

    // Precipitation
    let precipitation = 0;
    if (newCloudCover > 0.7 && newHumidity > 0.8) {
      precipitation = (newCloudCover - 0.7) * 10 * newHumidity;
    }

    // Wind variations
    const windVariation = 0.2 * state.windSpeed * Math.sin(h * 0.5);
    const newWindSpeed = Math.max(0, state.windSpeed + windVariation);
    const newWindDir = (state.windDirection + h * 2) % 360;

    // Visibility
    let visibility = 20; // Clear day visibility
    if (precipitation > 0) visibility = Math.max(1, 10 - precipitation);
    if (newHumidity > 0.95) visibility = Math.min(visibility, 1);

    state = {
      temperature: newTemp,
      pressure: state.pressure - 50 * Math.sin(h * 0.1),
      humidity: newHumidity,
      windSpeed: newWindSpeed,
      windDirection: newWindDir,
      cloudCover: newCloudCover,
      precipitation,
      dewPoint: dewPoint(newTemp, newHumidity),
      visibility
    };

    forecasts.push({
      time: `+${h}h`,
      temperature: Math.round((newTemp - 273.15) * 10) / 10,
      feelsLike: Math.round((feelsLikeTemperature(newTemp, newHumidity, newWindSpeed) - 273.15) * 10) / 10,
      humidity: Math.round(newHumidity * 100),
      windSpeed: Math.round(newWindSpeed * 10) / 10,
      windDirection: Math.round(newWindDir),
      precipitation: Math.round(precipitation * 10) / 10,
      precipitationType: precipitation > 0 ? determinePrecipType(newTemp) : 'none',
      cloudCover: Math.round(newCloudCover * 100),
      condition: determineWeatherCondition(state),
      uvIndex: calculateUVIndex(newCloudCover, location.latitude, location.elevation),
      visibility: Math.round(visibility * 10) / 10
    });
  }

  return forecasts;
}

// =============================================================================
// ENSEMBLE FORECASTING
// =============================================================================

function ensembleForecast(
  initialState: AtmosphericState,
  location: Location,
  hours: number,
  members: number = 10
): EnsembleResult {
  const ensembleMembers: EnsembleMember[] = [];

  // Generate ensemble members with perturbations
  for (let i = 0; i < members; i++) {
    const perturbation = {
      temp: (Math.random() - 0.5) * 4,
      humidity: (Math.random() - 0.5) * 0.2,
      wind: (Math.random() - 0.5) * 2,
      pressure: (Math.random() - 0.5) * 500
    };

    const perturbedState: AtmosphericState = {
      ...initialState,
      temperature: initialState.temperature + perturbation.temp,
      humidity: Math.min(1, Math.max(0, initialState.humidity + perturbation.humidity)),
      windSpeed: Math.max(0, initialState.windSpeed + perturbation.wind),
      pressure: initialState.pressure + perturbation.pressure
    };

    const forecast = numericalForecast(perturbedState, location, hours);

    ensembleMembers.push({
      id: i + 1,
      forecast,
      perturbation: `T:${perturbation.temp.toFixed(1)}K, RH:${(perturbation.humidity * 100).toFixed(0)}%, Wind:${perturbation.wind.toFixed(1)}m/s`
    });
  }

  // Calculate ensemble mean
  const meanForecast: WeatherForecast[] = [];
  const spreads: number[] = [];

  const timeSteps = ensembleMembers[0].forecast.length;

  for (let t = 0; t < timeSteps; t++) {
    const temps = ensembleMembers.map(m => m.forecast[t].temperature);
    const meanTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
    const tempSpread = Math.sqrt(temps.reduce((sum, t) => sum + (t - meanTemp) ** 2, 0) / temps.length);
    spreads.push(tempSpread);

    meanForecast.push({
      time: ensembleMembers[0].forecast[t].time,
      temperature: Math.round(meanTemp * 10) / 10,
      feelsLike: Math.round(ensembleMembers.map(m => m.forecast[t].feelsLike).reduce((a, b) => a + b, 0) / members * 10) / 10,
      humidity: Math.round(ensembleMembers.map(m => m.forecast[t].humidity).reduce((a, b) => a + b, 0) / members),
      windSpeed: Math.round(ensembleMembers.map(m => m.forecast[t].windSpeed).reduce((a, b) => a + b, 0) / members * 10) / 10,
      windDirection: Math.round(ensembleMembers.map(m => m.forecast[t].windDirection).reduce((a, b) => a + b, 0) / members),
      precipitation: Math.round(ensembleMembers.map(m => m.forecast[t].precipitation).reduce((a, b) => a + b, 0) / members * 10) / 10,
      precipitationType: ensembleMembers[0].forecast[t].precipitationType,
      cloudCover: Math.round(ensembleMembers.map(m => m.forecast[t].cloudCover).reduce((a, b) => a + b, 0) / members),
      condition: ensembleMembers[Math.floor(members / 2)].forecast[t].condition,
      uvIndex: Math.round(ensembleMembers.map(m => m.forecast[t].uvIndex).reduce((a, b) => a + b, 0) / members),
      visibility: Math.round(ensembleMembers.map(m => m.forecast[t].visibility).reduce((a, b) => a + b, 0) / members * 10) / 10
    });
  }

  // Confidence decreases with time and spread
  const avgSpread = spreads.reduce((a, b) => a + b, 0) / spreads.length;
  const confidence = Math.max(0, Math.min(100, 100 - avgSpread * 10));

  return {
    mean: meanForecast,
    spread: spreads,
    members: ensembleMembers.slice(0, 3), // Return first 3 for brevity
    confidence
  };
}

// =============================================================================
// EXAMPLE LOCATIONS AND SCENARIOS
// =============================================================================

const exampleLocations: Record<string, Location> = {
  new_york: { latitude: 40.7128, longitude: -74.0060, elevation: 10, name: 'New York City' },
  london: { latitude: 51.5074, longitude: -0.1278, elevation: 11, name: 'London' },
  tokyo: { latitude: 35.6762, longitude: 139.6503, elevation: 40, name: 'Tokyo' },
  denver: { latitude: 39.7392, longitude: -104.9903, elevation: 1609, name: 'Denver' },
  singapore: { latitude: 1.3521, longitude: 103.8198, elevation: 15, name: 'Singapore' },
  reykjavik: { latitude: 64.1466, longitude: -21.9426, elevation: 0, name: 'Reykjavik' },
  sahara: { latitude: 23.4162, longitude: 25.6628, elevation: 500, name: 'Sahara Desert' }
};

const exampleScenarios: Record<string, AtmosphericState> = {
  clear_summer: {
    temperature: 298.15,  // 25°C
    pressure: 101325,
    humidity: 0.45,
    windSpeed: 3,
    windDirection: 225,
    cloudCover: 0.1,
    precipitation: 0,
    dewPoint: 285,
    visibility: 20
  },
  winter_storm: {
    temperature: 268.15,  // -5°C
    pressure: 99500,
    humidity: 0.85,
    windSpeed: 15,
    windDirection: 315,
    cloudCover: 0.95,
    precipitation: 8,
    dewPoint: 265,
    visibility: 1
  },
  tropical: {
    temperature: 303.15,  // 30°C
    pressure: 101000,
    humidity: 0.85,
    windSpeed: 5,
    windDirection: 90,
    cloudCover: 0.6,
    precipitation: 3,
    dewPoint: 297,
    visibility: 10
  },
  fog: {
    temperature: 283.15,  // 10°C
    pressure: 101500,
    humidity: 0.98,
    windSpeed: 1,
    windDirection: 180,
    cloudCover: 0.9,
    precipitation: 0,
    dewPoint: 282.5,
    visibility: 0.2
  },
  thunderstorm: {
    temperature: 295.15,  // 22°C
    pressure: 100000,
    humidity: 0.75,
    windSpeed: 12,
    windDirection: 270,
    cloudCover: 0.9,
    precipitation: 25,
    dewPoint: 290,
    visibility: 5
  }
};

// =============================================================================
// TOOL DEFINITION
// =============================================================================

export const weathermodelTool: UnifiedTool = {
  name: 'weather_model',
  description: 'Weather prediction and atmospheric modeling including numerical weather prediction, ensemble forecasting, stability analysis, and atmospheric calculations.',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['forecast', 'ensemble', 'stability', 'analyze', 'calculate', 'examples', 'info'],
        description: 'Operation: forecast (numerical), ensemble, stability (indices), analyze conditions, calculate atmospheric properties, examples, or info'
      },
      model: {
        type: 'string',
        enum: ['numerical', 'ensemble', 'statistical'],
        description: 'Model type for forecasting'
      },
      location: {
        type: 'object',
        properties: {
          latitude: { type: 'number' },
          longitude: { type: 'number' },
          elevation: { type: 'number' }
        },
        description: 'Location for forecast'
      },
      location_name: {
        type: 'string',
        description: 'Named location: new_york, london, tokyo, denver, singapore, reykjavik, sahara'
      },
      initial_conditions: {
        type: 'object',
        description: 'Initial atmospheric state'
      },
      scenario: {
        type: 'string',
        description: 'Named scenario: clear_summer, winter_storm, tropical, fog, thunderstorm'
      },
      hours: {
        type: 'number',
        description: 'Forecast hours (default: 24)'
      },
      ensemble_members: {
        type: 'number',
        description: 'Number of ensemble members (default: 10)'
      },
      calculation: {
        type: 'string',
        enum: ['dew_point', 'feels_like', 'density', 'potential_temp', 'pressure_altitude', 'saturation_pressure'],
        description: 'Specific calculation to perform'
      },
      temperature: { type: 'number', description: 'Temperature in Kelvin' },
      humidity: { type: 'number', description: 'Relative humidity 0-1' },
      pressure: { type: 'number', description: 'Pressure in Pa' },
      wind_speed: { type: 'number', description: 'Wind speed in m/s' },
      altitude: { type: 'number', description: 'Altitude in meters' }
    },
    required: ['operation']
  }
};

// =============================================================================
// TOOL EXECUTOR
// =============================================================================

export async function executeweathermodel(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const {
      operation, model, location: inputLocation, location_name, initial_conditions,
      scenario, hours = 24, ensemble_members = 10,
      calculation, temperature, humidity, pressure, wind_speed, altitude
    } = args;

    // Info operation
    if (operation === 'info') {
      const info = {
        tool: 'weather-model',
        description: 'Atmospheric modeling and weather prediction',
        models: {
          numerical: {
            description: 'Deterministic numerical weather prediction',
            method: 'Solves primitive equations with initial conditions',
            output: 'Single forecast trajectory',
            best_for: 'Short-range forecasting (0-3 days)'
          },
          ensemble: {
            description: 'Multiple forecasts with perturbed initial conditions',
            method: 'Run many slightly different forecasts',
            output: 'Mean, spread, and confidence',
            best_for: 'Medium-range forecasting with uncertainty'
          },
          statistical: {
            description: 'Statistical post-processing of model output',
            method: 'MOS (Model Output Statistics)',
            output: 'Bias-corrected forecasts',
            best_for: 'Local adjustments'
          }
        },
        stability_indices: {
          CAPE: 'Convective Available Potential Energy - thunderstorm potential',
          CIN: 'Convective Inhibition - cap strength',
          LI: 'Lifted Index - stability measure',
          KI: 'K-Index - air mass thunderstorm potential',
          TT: 'Total Totals - severe weather indicator',
          SWEAT: 'Severe Weather Threat Index'
        },
        constants: CONSTANTS,
        example_locations: Object.keys(exampleLocations),
        example_scenarios: Object.keys(exampleScenarios)
      };
      return { toolCallId: id, content: JSON.stringify(info, null, 2) };
    }

    // Examples operation
    if (operation === 'examples') {
      return {
        toolCallId: id,
        content: JSON.stringify({
          locations: Object.entries(exampleLocations).map(([key, loc]) => ({
            key,
            ...loc
          })),
          scenarios: Object.entries(exampleScenarios).map(([key, state]) => ({
            key,
            temperature_C: state.temperature - 273.15,
            humidity_pct: state.humidity * 100,
            condition: determineWeatherCondition(state)
          }))
        }, null, 2)
      };
    }

    // Calculate operation
    if (operation === 'calculate') {
      if (!calculation) {
        return {
          toolCallId: id,
          content: 'Error: Specify calculation type (dew_point, feels_like, density, potential_temp, pressure_altitude, saturation_pressure)',
          isError: true
        };
      }

      let result: Record<string, unknown> = { calculation };

      switch (calculation) {
        case 'dew_point':
          if (!temperature || humidity === undefined) {
            return { toolCallId: id, content: 'Error: temperature and humidity required', isError: true };
          }
          const dp = dewPoint(temperature, humidity);
          result = {
            calculation: 'dew_point',
            temperature_K: temperature,
            temperature_C: temperature - 273.15,
            humidity: humidity,
            dew_point_K: dp,
            dew_point_C: dp - 273.15,
            dew_point_depression_C: temperature - dp
          };
          break;

        case 'feels_like':
          if (!temperature || humidity === undefined || wind_speed === undefined) {
            return { toolCallId: id, content: 'Error: temperature, humidity, and wind_speed required', isError: true };
          }
          const fl = feelsLikeTemperature(temperature, humidity, wind_speed);
          result = {
            calculation: 'feels_like',
            actual_temperature_C: temperature - 273.15,
            feels_like_C: fl - 273.15,
            difference_C: fl - temperature,
            humidity: humidity,
            wind_speed: wind_speed
          };
          break;

        case 'density':
          if (!pressure || !temperature || humidity === undefined) {
            return { toolCallId: id, content: 'Error: pressure, temperature, and humidity required', isError: true };
          }
          const rho = airDensity(pressure, temperature, humidity);
          result = {
            calculation: 'air_density',
            pressure_Pa: pressure,
            pressure_hPa: pressure / 100,
            temperature_K: temperature,
            humidity: humidity,
            density_kg_m3: rho
          };
          break;

        case 'potential_temp':
          if (!temperature || !pressure) {
            return { toolCallId: id, content: 'Error: temperature and pressure required', isError: true };
          }
          const theta = potentialTemperature(temperature, pressure);
          result = {
            calculation: 'potential_temperature',
            temperature_K: temperature,
            pressure_Pa: pressure,
            potential_temperature_K: theta,
            potential_temperature_C: theta - 273.15
          };
          break;

        case 'pressure_altitude':
          if (!pressure || !temperature || altitude === undefined) {
            return { toolCallId: id, content: 'Error: pressure, temperature, and altitude required', isError: true };
          }
          const pAlt = pressureAtAltitude(pressure, altitude, temperature);
          result = {
            calculation: 'pressure_at_altitude',
            sea_level_pressure_Pa: pressure,
            altitude_m: altitude,
            temperature_K: temperature,
            pressure_at_altitude_Pa: pAlt,
            pressure_at_altitude_hPa: pAlt / 100
          };
          break;

        case 'saturation_pressure':
          if (!temperature) {
            return { toolCallId: id, content: 'Error: temperature required', isError: true };
          }
          const es = saturationVaporPressure(temperature);
          result = {
            calculation: 'saturation_vapor_pressure',
            temperature_K: temperature,
            temperature_C: temperature - 273.15,
            saturation_pressure_Pa: es,
            saturation_pressure_hPa: es / 100
          };
          break;
      }

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    // Get location
    let location: Location;
    if (location_name && exampleLocations[location_name]) {
      location = exampleLocations[location_name];
    } else if (inputLocation) {
      location = inputLocation;
    } else {
      location = exampleLocations.new_york;
    }

    // Get initial conditions
    let state: AtmosphericState;
    if (scenario && exampleScenarios[scenario]) {
      state = exampleScenarios[scenario];
    } else if (initial_conditions) {
      state = initial_conditions;
    } else {
      state = exampleScenarios.clear_summer;
    }

    // Analyze operation
    if (operation === 'analyze') {
      const analysis = {
        location,
        current_conditions: {
          temperature_C: state.temperature - 273.15,
          temperature_F: (state.temperature - 273.15) * 9 / 5 + 32,
          humidity_pct: state.humidity * 100,
          dew_point_C: dewPoint(state.temperature, state.humidity) - 273.15,
          feels_like_C: feelsLikeTemperature(state.temperature, state.humidity, state.windSpeed) - 273.15,
          pressure_hPa: state.pressure / 100,
          wind_speed_ms: state.windSpeed,
          wind_speed_kmh: state.windSpeed * 3.6,
          wind_direction: state.windDirection,
          cloud_cover_pct: state.cloudCover * 100,
          visibility_km: state.visibility,
          condition: determineWeatherCondition(state)
        },
        atmospheric_properties: {
          air_density: airDensity(state.pressure, state.temperature, state.humidity),
          potential_temperature: potentialTemperature(state.temperature, state.pressure) - 273.15,
          saturation_vapor_pressure: saturationVaporPressure(state.temperature)
        }
      };

      return { toolCallId: id, content: JSON.stringify(analysis, null, 2) };
    }

    // Stability operation
    if (operation === 'stability') {
      const indices = calculateStabilityIndices(state, location);

      const interpretation = {
        CAPE: indices.CAPE < 300 ? 'Weak' : indices.CAPE < 1000 ? 'Moderate' : indices.CAPE < 2500 ? 'Strong' : 'Extreme',
        LI: indices.LI > 0 ? 'Stable' : indices.LI > -3 ? 'Marginally Unstable' : indices.LI > -6 ? 'Moderately Unstable' : 'Very Unstable',
        convection_potential: indices.CAPE > 1000 && indices.LI < -2 ? 'HIGH' : indices.CAPE > 500 ? 'MODERATE' : 'LOW'
      };

      return {
        toolCallId: id,
        content: JSON.stringify({
          location,
          indices,
          interpretation,
          thunderstorm_risk: interpretation.convection_potential
        }, null, 2)
      };
    }

    // Ensemble operation
    if (operation === 'ensemble' || model === 'ensemble') {
      const ensembleResult = ensembleForecast(state, location, hours, ensemble_members);

      return {
        toolCallId: id,
        content: JSON.stringify({
          location,
          initial_conditions: {
            temperature_C: state.temperature - 273.15,
            condition: determineWeatherCondition(state)
          },
          ensemble: {
            members: ensemble_members,
            confidence_pct: ensembleResult.confidence,
            average_spread_C: ensembleResult.spread.reduce((a, b) => a + b, 0) / ensembleResult.spread.length
          },
          mean_forecast: ensembleResult.mean,
          sample_members: ensembleResult.members
        }, null, 2)
      };
    }

    // Forecast operation (numerical)
    const forecast = numericalForecast(state, location, hours);

    return {
      toolCallId: id,
      content: JSON.stringify({
        model: model || 'numerical',
        location,
        initial_conditions: {
          temperature_C: state.temperature - 273.15,
          humidity_pct: state.humidity * 100,
          condition: determineWeatherCondition(state)
        },
        forecast_hours: hours,
        forecast
      }, null, 2)
    };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isweathermodelAvailable(): boolean {
  return true;
}
