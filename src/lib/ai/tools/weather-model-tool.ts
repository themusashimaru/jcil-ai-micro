/**
 * WEATHER-MODEL TOOL
 * Atmospheric physics, weather prediction, and meteorology
 * Real equations from NWP (Numerical Weather Prediction)
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const weathermodelTool: UnifiedTool = {
  name: 'weather_model',
  description: `Weather prediction and atmospheric modeling.

Operations:
- info: Atmospheric physics overview
- forecast: Basic weather forecast model
- stability: Atmospheric stability analysis
- pressure: Pressure/altitude calculations
- humidity: Humidity and moisture calculations
- wind: Wind calculations and Beaufort scale
- fronts: Weather front dynamics
- convection: Convective instability (CAPE, CIN)
- cyclone: Cyclone development and tracking
- satellite: Satellite imagery interpretation

Parameters:
- operation: The operation to perform
- temperature: Temperature in °C
- pressure: Pressure in hPa/mb
- humidity: Relative humidity (%)
- altitude: Altitude in meters
- latitude: Latitude in degrees
- wind_speed: Wind speed in m/s`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['info', 'forecast', 'stability', 'pressure', 'humidity', 'wind', 'fronts', 'convection', 'cyclone', 'satellite'],
        description: 'Operation to perform'
      },
      temperature: { type: 'number', description: 'Temperature in °C' },
      pressure: { type: 'number', description: 'Pressure in hPa' },
      humidity: { type: 'number', description: 'Relative humidity %' },
      altitude: { type: 'number', description: 'Altitude in meters' },
      latitude: { type: 'number', description: 'Latitude in degrees' },
      wind_speed: { type: 'number', description: 'Wind speed in m/s' },
      dew_point: { type: 'number', description: 'Dew point in °C' }
    },
    required: ['operation']
  }
};

// ============================================================================
// ATMOSPHERIC CONSTANTS
// ============================================================================

const CONSTANTS = {
  g: 9.81,                    // m/s² gravitational acceleration
  R_d: 287.05,                // J/(kg·K) gas constant for dry air
  R_v: 461.5,                 // J/(kg·K) gas constant for water vapor
  cp: 1004,                   // J/(kg·K) specific heat at constant pressure
  L_v: 2.5e6,                 // J/kg latent heat of vaporization
  OMEGA: 7.2921e-5,           // rad/s Earth's rotation rate
  P0: 1013.25,                // hPa standard sea level pressure
  T0: 288.15,                 // K standard sea level temperature
  LAPSE_RATE: 0.0065,         // K/m standard lapse rate
  SCALE_HEIGHT: 8500          // m atmospheric scale height
};

// ============================================================================
// ATMOSPHERIC CALCULATIONS
// ============================================================================

/**
 * Saturation vapor pressure (Clausius-Clapeyron approximation)
 * Magnus formula
 */
function saturationVaporPressure(T: number): number {
  // T in Celsius, returns hPa
  const a = 17.27;
  const b = 237.7;
  return 6.112 * Math.exp((a * T) / (b + T));
}

/**
 * Dew point from temperature and relative humidity
 */
function dewPoint(T: number, RH: number): number {
  const a = 17.27;
  const b = 237.7;
  const gamma = (a * T) / (b + T) + Math.log(RH / 100);
  return (b * gamma) / (a - gamma);
}

/**
 * Relative humidity from temperature and dew point
 */
function relativeHumidity(T: number, Td: number): number {
  const es = saturationVaporPressure(T);
  const e = saturationVaporPressure(Td);
  return 100 * (e / es);
}

/**
 * Mixing ratio
 */
function mixingRatio(e: number, p: number): number {
  return 0.622 * e / (p - e);
}

/**
 * Virtual temperature
 */
function virtualTemperature(T: number, r: number): number {
  return T * (1 + 0.61 * r);
}

/**
 * Barometric formula - pressure at altitude
 */
function pressureAtAltitude(z: number, p0: number = CONSTANTS.P0, T0: number = CONSTANTS.T0): number {
  const exponent = CONSTANTS.g / (CONSTANTS.R_d * CONSTANTS.LAPSE_RATE);
  return p0 * Math.pow(1 - CONSTANTS.LAPSE_RATE * z / T0, exponent);
}

/**
 * Altitude from pressure
 */
function altitudeFromPressure(p: number, p0: number = CONSTANTS.P0, T0: number = CONSTANTS.T0): number {
  const exponent = CONSTANTS.R_d * CONSTANTS.LAPSE_RATE / CONSTANTS.g;
  return (T0 / CONSTANTS.LAPSE_RATE) * (1 - Math.pow(p / p0, exponent));
}

/**
 * Potential temperature
 */
function potentialTemperature(T: number, p: number): number {
  // T in Kelvin, p in hPa
  return T * Math.pow(CONSTANTS.P0 / p, CONSTANTS.R_d / CONSTANTS.cp);
}

/**
 * Equivalent potential temperature (includes moisture)
 */
function equivalentPotentialTemperature(T: number, p: number, r: number): number {
  const theta = potentialTemperature(T, p);
  return theta * Math.exp(CONSTANTS.L_v * r / (CONSTANTS.cp * T));
}

/**
 * Lifted condensation level (LCL)
 */
function liftedCondensationLevel(T: number, Td: number): { height: number; temperature: number } {
  // Height in meters where parcel becomes saturated
  const h = 125 * (T - Td);
  const T_lcl = T - CONSTANTS.LAPSE_RATE * h;
  return { height: h, temperature: T_lcl };
}

/**
 * CAPE calculation (simplified)
 * Convective Available Potential Energy
 */
function calculateCAPE(surfaceT: number, surfaceTd: number, midT: number): {
  cape: number;
  cin: number;
  severity: string;
} {
  // Simplified CAPE estimate
  const lcl = liftedCondensationLevel(surfaceT, surfaceTd);
  const parcelT = surfaceT - CONSTANTS.LAPSE_RATE * 5000; // At 5km
  const envT = midT; // Environment at 500mb

  // CAPE ~ integral of (T_parcel - T_env) dz
  const dT = parcelT - envT;
  const cape = dT > 0 ? dT * CONSTANTS.g * 5000 / (surfaceT + 273) : 0;

  // Simplified CIN (usually negative)
  const cin = -Math.abs(lcl.height) * 0.5;

  let severity: string;
  if (cape < 300) severity = 'Weak/None';
  else if (cape < 1000) severity = 'Marginal';
  else if (cape < 2500) severity = 'Moderate';
  else if (cape < 4000) severity = 'Strong';
  else severity = 'Extreme';

  return { cape: Math.max(0, cape), cin, severity };
}

/**
 * Beaufort scale
 */
function beaufortScale(windSpeed: number): {
  number: number;
  description: string;
  seaState: string;
} {
  const scales = [
    { max: 0.3, number: 0, description: 'Calm', seaState: 'Sea like mirror' },
    { max: 1.5, number: 1, description: 'Light air', seaState: 'Ripples' },
    { max: 3.3, number: 2, description: 'Light breeze', seaState: 'Small wavelets' },
    { max: 5.5, number: 3, description: 'Gentle breeze', seaState: 'Large wavelets' },
    { max: 7.9, number: 4, description: 'Moderate breeze', seaState: 'Small waves' },
    { max: 10.7, number: 5, description: 'Fresh breeze', seaState: 'Moderate waves' },
    { max: 13.8, number: 6, description: 'Strong breeze', seaState: 'Large waves' },
    { max: 17.1, number: 7, description: 'Near gale', seaState: 'Sea heaps up' },
    { max: 20.7, number: 8, description: 'Gale', seaState: 'Moderately high waves' },
    { max: 24.4, number: 9, description: 'Strong gale', seaState: 'High waves' },
    { max: 28.4, number: 10, description: 'Storm', seaState: 'Very high waves' },
    { max: 32.6, number: 11, description: 'Violent storm', seaState: 'Exceptionally high waves' },
    { max: Infinity, number: 12, description: 'Hurricane', seaState: 'Air filled with foam' }
  ];

  const scale = scales.find(s => windSpeed <= s.max)!;
  return scale;
}

/**
 * Coriolis parameter
 */
function coriolisParameter(latitude: number): number {
  return 2 * CONSTANTS.OMEGA * Math.sin(latitude * Math.PI / 180);
}

/**
 * Geostrophic wind
 */
function geostrophicWind(dP: number, dx: number, latitude: number, rho: number = 1.225): number {
  const f = coriolisParameter(latitude);
  if (Math.abs(f) < 1e-6) return Infinity;
  return (1 / (rho * f)) * (dP * 100 / dx); // Convert hPa to Pa
}

/**
 * Atmospheric stability from lapse rate
 */
function atmosphericStability(surfaceT: number, upperT: number, dz: number): {
  lapseRate: number;
  stability: string;
  description: string;
} {
  const lapseRate = (surfaceT - upperT) / (dz / 1000); // °C/km

  const dryAdiabatic = 9.8; // °C/km
  const saturatedAdiabatic = 6.0; // °C/km (average)

  let stability: string;
  let description: string;

  if (lapseRate > dryAdiabatic) {
    stability = 'Absolutely Unstable';
    description = 'Rapid vertical mixing, strong convection';
  } else if (lapseRate > saturatedAdiabatic) {
    stability = 'Conditionally Unstable';
    description = 'Unstable if saturated, stable if dry';
  } else if (lapseRate > 0) {
    stability = 'Stable';
    description = 'Suppresses vertical motion';
  } else {
    stability = 'Inversion';
    description = 'Temperature increases with height, very stable';
  }

  return { lapseRate, stability, description };
}

export async function executeweathermodel(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation || 'info';

    switch (operation) {
      case 'info': {
        const result = {
          tool: 'Weather Model',
          description: 'Numerical weather prediction and atmospheric physics',

          governingEquations: {
            primitiveEquations: [
              'Momentum: Du/Dt = -∇p/ρ - fk×u + F',
              'Continuity: ∂ρ/∂t + ∇·(ρu) = 0',
              'Thermodynamic: Dθ/Dt = Q/cpπ',
              'Moisture: Dq/Dt = E - C',
              'Equation of State: p = ρRdTv'
            ],
            hydrostaticApprox: '∂p/∂z = -ρg',
            quasigeostrophic: 'f × u ≈ -(1/ρ)∇p'
          },

          nwpModels: {
            GFS: 'Global Forecast System (NOAA) - 16 days',
            ECMWF: 'European Centre - gold standard',
            NAM: 'North American Mesoscale',
            HRRR: 'High-Resolution Rapid Refresh (3km)'
          },

          keyProcesses: [
            'Radiation (solar, longwave)',
            'Convection (cumulus parameterization)',
            'Boundary layer turbulence',
            'Microphysics (clouds, precipitation)',
            'Land-surface interaction'
          ],

          scales: {
            synoptic: '1000+ km (highs, lows, fronts)',
            mesoscale: '10-1000 km (sea breeze, squall lines)',
            convective: '1-10 km (thunderstorms)',
            microscale: '< 1 km (turbulence)'
          },

          usage: 'Use operation: forecast, stability, pressure, humidity, wind, fronts, convection, cyclone, satellite'
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'forecast': {
        const T = args.temperature ?? 20;
        const P = args.pressure ?? 1013;
        const RH = args.humidity ?? 50;
        const wind = args.wind_speed ?? 5;

        const Td = dewPoint(T, RH);
        const es = saturationVaporPressure(T);
        const e = es * RH / 100;

        let forecast: string;
        if (P < 1000 && RH > 70) {
          forecast = 'Likely precipitation, cloudy conditions';
        } else if (P > 1020 && RH < 40) {
          forecast = 'Fair weather, clear skies likely';
        } else if (P < 1005) {
          forecast = 'Unsettled, possible storms';
        } else {
          forecast = 'Variable conditions';
        }

        const result = {
          operation: 'forecast',

          currentConditions: {
            temperature: `${T} °C`,
            pressure: `${P} hPa`,
            relativeHumidity: `${RH}%`,
            dewPoint: `${Td.toFixed(1)} °C`,
            windSpeed: `${wind} m/s`
          },

          derived: {
            saturationVaporPressure: `${es.toFixed(2)} hPa`,
            actualVaporPressure: `${e.toFixed(2)} hPa`,
            precipitableWater: `${(e * 25).toFixed(1)} mm (estimate)`,
            heatIndex: T > 27 && RH > 40 ?
              `${(T + 0.5 * (e - 10)).toFixed(1)} °C (feels like)` : 'N/A'
          },

          simpleForecast: forecast,

          pressureTrend: {
            rising: 'Improving conditions, clearing',
            falling: 'Deteriorating, possible storms',
            steady: 'Conditions likely to persist'
          },

          note: 'Real forecasting requires NWP models, satellite data, and ensemble techniques'
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'stability': {
        const surfaceT = args.temperature ?? 25;
        const upperT = args.temperature ? args.temperature - 30 : -10;
        const dz = args.altitude ?? 5000;

        const stab = atmosphericStability(surfaceT, upperT, dz);
        const theta = potentialTemperature(surfaceT + 273, 1000);

        const result = {
          operation: 'stability',

          temperatures: {
            surface: `${surfaceT} °C`,
            upper: `${upperT} °C`,
            heightDifference: `${dz} m`
          },

          analysis: stab,

          lapseRates: {
            measured: `${stab.lapseRate.toFixed(1)} °C/km`,
            dryAdiabatic: '9.8 °C/km (Γd)',
            saturatedAdiabatic: '~6 °C/km (Γs, varies)',
            environmentalAverage: '6.5 °C/km'
          },

          potentialTemperature: {
            surface: `${theta.toFixed(1)} K`,
            definition: 'θ = T(p₀/p)^(R/cp)',
            interpretation: 'Conserved for adiabatic processes'
          },

          implications: {
            absolutelyUnstable: 'Vigorous convection, cumulus development',
            conditionallyUnstable: 'Thunderstorms if lifting mechanism present',
            stable: 'Stratus clouds, fog, pollution trapping',
            inversion: 'Strong pollution trapping, smoke layers'
          }
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'pressure': {
        const altitude = args.altitude ?? 1000;
        const P0 = args.pressure ?? CONSTANTS.P0;
        const T0 = (args.temperature ?? 15) + 273.15;

        const P = pressureAtAltitude(altitude, P0, T0);
        const scaleHeight = CONSTANTS.R_d * T0 / CONSTANTS.g;

        const result = {
          operation: 'pressure',

          input: {
            altitude: `${altitude} m`,
            seaLevelPressure: `${P0} hPa`,
            seaLevelTemperature: `${T0 - 273.15} °C`
          },

          barometricFormula: {
            equation: 'p = p₀(1 - Lz/T₀)^(g/RL)',
            lapseRate: `L = ${CONSTANTS.LAPSE_RATE * 1000} °C/km`,
            gasConstant: `R = ${CONSTANTS.R_d} J/(kg·K)`
          },

          result: {
            pressure: `${P.toFixed(2)} hPa`,
            scaleHeight: `${scaleHeight.toFixed(0)} m`,
            densityRatio: `${(P / P0).toFixed(4)}`
          },

          standardAtmosphere: {
            seaLevel: '1013.25 hPa, 15°C',
            '5km': '~540 hPa, -17.5°C',
            '10km': '~265 hPa, -50°C (cruising altitude)',
            '20km': '~55 hPa, -56.5°C (stratosphere)'
          },

          altimeterSetting: {
            description: 'Adjusted pressure for aircraft altitude',
            QNH: 'Pressure at sea level',
            QFE: 'Pressure at field elevation'
          }
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'humidity': {
        const T = args.temperature ?? 25;
        const Td = args.dew_point ?? 15;
        const RH = args.humidity ?? relativeHumidity(T, Td);
        const P = args.pressure ?? 1013;

        const es = saturationVaporPressure(T);
        const e = saturationVaporPressure(Td);
        const r = mixingRatio(e, P);
        const rs = mixingRatio(es, P);

        const result = {
          operation: 'humidity',

          input: {
            temperature: `${T} °C`,
            dewPoint: `${Td} °C`,
            relativeHumidity: `${RH.toFixed(1)}%`
          },

          vaporPressure: {
            saturation: `${es.toFixed(2)} hPa`,
            actual: `${e.toFixed(2)} hPa`,
            deficit: `${(es - e).toFixed(2)} hPa`
          },

          mixingRatio: {
            actual: `${(r * 1000).toFixed(2)} g/kg`,
            saturation: `${(rs * 1000).toFixed(2)} g/kg`
          },

          derived: {
            wetBulbTemperature: `~${(T - (T - Td) / 3).toFixed(1)} °C (estimate)`,
            absoluteHumidity: `${(e * 100 / (CONSTANTS.R_v * (T + 273))).toFixed(1)} g/m³`,
            specificHumidity: `${(0.622 * e / (P - 0.378 * e) * 1000).toFixed(2)} g/kg`
          },

          comfort: {
            level: RH < 30 ? 'Dry (uncomfortable)' :
                   RH < 60 ? 'Comfortable' :
                   RH < 80 ? 'Humid' : 'Very humid (oppressive)',
            dewPointComfort: Td < 10 ? 'Dry' :
                             Td < 15 ? 'Comfortable' :
                             Td < 20 ? 'Slightly humid' :
                             Td < 24 ? 'Humid' : 'Oppressive'
          }
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'wind': {
        const speed = args.wind_speed ?? 10;
        const latitude = args.latitude ?? 45;

        const beaufort = beaufortScale(speed);
        const f = coriolisParameter(latitude);

        const result = {
          operation: 'wind',

          input: {
            windSpeed: `${speed} m/s`,
            latitude: `${latitude}°`
          },

          conversions: {
            'km/h': (speed * 3.6).toFixed(1),
            'mph': (speed * 2.237).toFixed(1),
            'knots': (speed * 1.944).toFixed(1)
          },

          beaufortScale: beaufort,

          geostrophic: {
            coriolisParameter: `${f.toExponential(4)} rad/s`,
            inertialPeriod: `${(2 * Math.PI / Math.abs(f) / 3600).toFixed(1)} hours`,
            description: 'Balance between pressure gradient and Coriolis'
          },

          windPower: {
            powerDensity: `${(0.5 * 1.225 * Math.pow(speed, 3)).toFixed(0)} W/m²`,
            cubicRelation: 'Power ∝ v³ (doubling speed → 8× power)',
            betzLimit: '59.3% maximum theoretical efficiency'
          },

          windChill: speed > 1.3 ? {
            formula: 'T_wc = 13.12 + 0.6215T - 11.37v^0.16 + 0.3965Tv^0.16',
            note: 'Applicable for T < 10°C and v > 4.8 km/h'
          } : 'Calm conditions - no wind chill effect'
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'fronts': {
        const result = {
          operation: 'fronts',

          frontTypes: {
            cold: {
              slope: '1:50 to 1:100',
              speed: '20-50 km/h',
              weather: 'Narrow band of heavy precipitation, possible thunderstorms',
              passage: 'Temperature drop, pressure rise, wind shift NW',
              clouds: 'Cumulonimbus, then clearing'
            },
            warm: {
              slope: '1:100 to 1:300 (gentler)',
              speed: '15-30 km/h',
              weather: 'Wide area of light to moderate precipitation',
              passage: 'Temperature rise, pressure levels, wind shift SW',
              clouds: 'Cirrus → Altostratus → Nimbostratus'
            },
            occluded: {
              types: 'Cold-type (cold front catches up) or Warm-type',
              weather: 'Complex, often persistent precipitation',
              association: 'Mature cyclone stage'
            },
            stationary: {
              description: 'Neither air mass advancing',
              weather: 'Prolonged cloudiness/precipitation',
              duration: 'Can persist for days'
            }
          },

          frontalDynamics: {
            lifting: 'Warm air forced over cold (warm front) or under (cold front)',
            frontogenesis: 'Front intensification by confluence/deformation',
            frontolysis: 'Front weakening'
          },

          norwegianModel: {
            description: 'Bjerknes polar front theory (1919)',
            lifecycle: 'Wave development → occlusion → dissipation',
            warmSector: 'Region between cold and warm fronts'
          }
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'convection': {
        const surfaceT = args.temperature ?? 30;
        const surfaceTd = args.dew_point ?? 20;
        const midT = args.temperature ? args.temperature - 40 : -15;

        const cape = calculateCAPE(surfaceT, surfaceTd, midT);
        const lcl = liftedCondensationLevel(surfaceT, surfaceTd);

        const result = {
          operation: 'convection',

          input: {
            surfaceTemperature: `${surfaceT} °C`,
            surfaceDewPoint: `${surfaceTd} °C`,
            '500mb_temperature': `${midT} °C`
          },

          liftedCondensationLevel: {
            height: `${lcl.height.toFixed(0)} m AGL`,
            temperature: `${lcl.temperature.toFixed(1)} °C`,
            calculation: 'LCL ≈ 125(T - Td)'
          },

          capeAnalysis: {
            CAPE: `${cape.cape.toFixed(0)} J/kg`,
            CIN: `${cape.cin.toFixed(0)} J/kg`,
            severity: cape.severity,
            maxUpdraft: `${Math.sqrt(2 * cape.cape).toFixed(1)} m/s (theoretical)`
          },

          capeInterpretation: {
            '0-300': 'Weak - limited convective potential',
            '300-1000': 'Marginal - isolated storms possible',
            '1000-2500': 'Moderate - organized storms likely',
            '2500-4000': 'Strong - severe storms possible',
            '>4000': 'Extreme - significant severe potential'
          },

          stormTypes: {
            singleCell: 'Weak shear, short-lived',
            multicell: 'Moderate shear, gust front triggering',
            supercell: 'Strong shear, rotating updraft, most severe',
            squallLine: 'Linear organization, bow echoes'
          },

          ingredients: [
            'Moisture (low-level dewpoints >15°C)',
            'Instability (CAPE >1000 J/kg)',
            'Lift (fronts, drylines, outflow boundaries)',
            'Wind shear (for organization/longevity)'
          ]
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'cyclone': {
        const latitude = args.latitude ?? 35;

        const f = coriolisParameter(latitude);

        const result = {
          operation: 'cyclone',

          extratropicalCyclones: {
            formation: 'Polar front wave development',
            energySource: 'Baroclinic instability (temperature gradients)',
            scale: '1000-3000 km diameter',
            lifetime: '3-7 days typically',
            stages: ['Frontal wave', 'Open wave', 'Occluding', 'Mature', 'Dissipating']
          },

          tropicalCyclones: {
            formation: 'Warm SST (>26.5°C), low shear, Coriolis',
            energySource: 'Latent heat release from condensation',
            classification: {
              'Tropical Depression': '<17 m/s (34 kt)',
              'Tropical Storm': '17-32 m/s (34-63 kt)',
              'Hurricane/Typhoon': '>32 m/s (64+ kt)',
              'Major Hurricane': 'Category 3+ (>50 m/s)'
            },
            saffirSimpsonScale: {
              Cat1: '33-42 m/s',
              Cat2: '43-49 m/s',
              Cat3: '50-58 m/s',
              Cat4: '58-70 m/s',
              Cat5: '>70 m/s'
            }
          },

          dynamics: {
            coriolisParameter: `f = ${f.toExponential(4)} rad/s at ${latitude}°`,
            gradientWind: 'Balance: PGF + Coriolis + Centrifugal',
            eyeFormation: 'Subsidence in center, wall cloud updraft',
            intensification: 'Warm core, low central pressure'
          },

          tracking: {
            steeringFlow: '500-700 mb winds',
            betaDrift: 'Poleward and westward tendency',
            recurvature: 'Interaction with westerlies'
          }
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'satellite': {
        const result = {
          operation: 'satellite',

          imageryTypes: {
            visible: {
              wavelength: '0.4-0.7 μm',
              shows: 'Cloud thickness/reflectivity, fog, snow',
              limitation: 'Daytime only',
              interpretation: 'Brighter = thicker/higher clouds'
            },
            infrared: {
              wavelength: '10-12 μm (thermal)',
              shows: 'Cloud top temperature (height)',
              advantage: '24-hour availability',
              interpretation: 'Colder (brighter in enhanced) = higher clouds'
            },
            waterVapor: {
              wavelength: '6.5-7.0 μm',
              shows: 'Upper/mid-level moisture, jet stream',
              interpretation: 'Dark = dry (subsidence), White = moist'
            }
          },

          satellites: {
            GOES: 'Geostationary (US) - 35,800 km',
            Meteosat: 'Geostationary (Europe)',
            Himawari: 'Geostationary (Japan)',
            NOAA_POES: 'Polar orbiting - global coverage',
            Suomi_NPP: 'Polar, advanced sensors'
          },

          products: {
            cloudTopHeight: 'From IR brightness temperature',
            precipitation: 'Microwave + IR algorithms',
            winds: 'Feature tracking (AMVs)',
            seaSurfaceTemp: 'IR channels (clear sky)',
            fires: 'Shortwave IR hotspots'
          },

          patternRecognition: {
            commaCloud: 'Extratropical cyclone',
            spiralBands: 'Tropical cyclone',
            enhancedV: 'Severe thunderstorm (overshooting top)',
            sheetCloud: 'Stratiform precipitation',
            openCells: 'Cold air outbreak',
            closedCells: 'Marine stratocumulus'
          }
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      default:
        return {
          toolCallId: id,
          content: `Unknown operation: ${operation}. Use: info, forecast, stability, pressure, humidity, wind, fronts, convection, cyclone, satellite`
        };
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function isweathermodelAvailable(): boolean { return true; }
