// ============================================================================
// SOLAR & ENVIRONMENTAL TOOL - TIER GODMODE
// ============================================================================
// Solar energy calculations, environmental modeling, carbon footprint,
// sustainability metrics, and renewable energy analysis.
// Pure TypeScript implementation.
// ============================================================================

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// CONSTANTS
// ============================================================================

const SOLAR_CONSTANT = 1361; // W/m² at Earth's distance from Sun
// const EARTH_RADIUS = 6371; // km
const CO2_PER_KWH_COAL = 0.91; // kg CO2 per kWh
// const CO2_PER_KWH_GAS = 0.41; // kg CO2 per kWh
const CO2_PER_KWH_SOLAR = 0.041; // kg CO2 per kWh (lifecycle)
// const CO2_PER_KWH_WIND = 0.011; // kg CO2 per kWh (lifecycle)
// const CO2_PER_KWH_NUCLEAR = 0.012; // kg CO2 per kWh (lifecycle)
// const CO2_PER_KWH_HYDRO = 0.024; // kg CO2 per kWh (lifecycle)

// ============================================================================
// SOLAR POSITION CALCULATIONS
// ============================================================================

interface SolarPosition {
  altitude: number; // degrees above horizon
  azimuth: number; // degrees from north, clockwise
  declination: number;
  hourAngle: number;
  sunrise: string;
  sunset: string;
  dayLength: number; // hours
}

function calculateDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function calculateSolarDeclination(dayOfYear: number): number {
  // Declination angle in degrees
  return 23.45 * Math.sin(((360 / 365) * (dayOfYear - 81)) * (Math.PI / 180));
}

function calculateSolarPosition(
  latitude: number,
  longitude: number,
  date: Date,
  hour: number
): SolarPosition {
  const dayOfYear = calculateDayOfYear(date);
  const declination = calculateSolarDeclination(dayOfYear);

  // Hour angle (degrees)
  const solarNoon = 12 - longitude / 15; // Approximate
  const hourAngle = 15 * (hour - solarNoon);

  const latRad = latitude * (Math.PI / 180);
  const decRad = declination * (Math.PI / 180);
  const haRad = hourAngle * (Math.PI / 180);

  // Solar altitude
  const sinAlt =
    Math.sin(latRad) * Math.sin(decRad) +
    Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad);
  const altitude = Math.asin(sinAlt) * (180 / Math.PI);

  // Solar azimuth
  const cosAz =
    (Math.sin(decRad) - Math.sin(latRad) * sinAlt) /
    (Math.cos(latRad) * Math.cos(altitude * (Math.PI / 180)));
  let azimuth = Math.acos(Math.max(-1, Math.min(1, cosAz))) * (180 / Math.PI);
  if (hourAngle > 0) azimuth = 360 - azimuth;

  // Sunrise/Sunset
  const cosHa = -Math.tan(latRad) * Math.tan(decRad);
  const sunriseHA = Math.acos(Math.max(-1, Math.min(1, cosHa))) * (180 / Math.PI);
  const dayLength = (2 * sunriseHA) / 15;

  const sunriseHour = 12 - sunriseHA / 15 + longitude / 15;
  const sunsetHour = 12 + sunriseHA / 15 + longitude / 15;

  const formatTime = (h: number): string => {
    const hours = Math.floor(h);
    const minutes = Math.round((h - hours) * 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  return {
    altitude: Math.round(altitude * 100) / 100,
    azimuth: Math.round(azimuth * 100) / 100,
    declination: Math.round(declination * 100) / 100,
    hourAngle: Math.round(hourAngle * 100) / 100,
    sunrise: formatTime(sunriseHour),
    sunset: formatTime(sunsetHour),
    dayLength: Math.round(dayLength * 100) / 100,
  };
}

// ============================================================================
// SOLAR IRRADIANCE
// ============================================================================

interface SolarIrradiance {
  extraterrestrial: number; // W/m² outside atmosphere
  directNormal: number; // W/m² direct beam
  diffuseHorizontal: number; // W/m² scattered
  globalHorizontal: number; // W/m² total on horizontal surface
  globalTilted: number; // W/m² on tilted surface
}

function calculateSolarIrradiance(
  altitude: number,
  _airMass: number = 1.5,
  clearness: number = 0.7,
  tiltAngle: number = 0,
  _surfaceAzimuth: number = 180
): SolarIrradiance {
  if (altitude <= 0) {
    return {
      extraterrestrial: 0,
      directNormal: 0,
      diffuseHorizontal: 0,
      globalHorizontal: 0,
      globalTilted: 0,
    };
  }

  const altRad = altitude * (Math.PI / 180);
  const sinAlt = Math.sin(altRad);

  // Extraterrestrial irradiance
  const extraterrestrial = SOLAR_CONSTANT * sinAlt;

  // Air mass
  const AM = 1 / sinAlt;

  // Direct normal irradiance (simplified clear sky model)
  const directNormal = SOLAR_CONSTANT * clearness * Math.exp(-0.14 * AM);

  // Direct horizontal
  const directHorizontal = directNormal * sinAlt;

  // Diffuse (simplified)
  const diffuseHorizontal = SOLAR_CONSTANT * 0.1 * clearness * sinAlt;

  // Global horizontal
  const globalHorizontal = directHorizontal + diffuseHorizontal;

  // Tilted surface (simplified - ignoring azimuth for now)
  const tiltRad = tiltAngle * (Math.PI / 180);
  const incidenceAngle = Math.max(0, Math.cos(tiltRad - altRad));
  const globalTilted = directNormal * incidenceAngle + diffuseHorizontal * (1 + Math.cos(tiltRad)) / 2;

  return {
    extraterrestrial: Math.round(extraterrestrial),
    directNormal: Math.round(directNormal),
    diffuseHorizontal: Math.round(diffuseHorizontal),
    globalHorizontal: Math.round(globalHorizontal),
    globalTilted: Math.round(globalTilted),
  };
}

// ============================================================================
// SOLAR PV CALCULATIONS
// ============================================================================

interface PVSystemOutput {
  peakPower: number; // kW
  dailyEnergy: number; // kWh/day
  monthlyEnergy: number; // kWh/month
  annualEnergy: number; // kWh/year
  capacityFactor: number; // %
  co2Avoided: number; // kg/year
}

function calculatePVOutput(
  panelArea: number, // m²
  panelEfficiency: number, // 0-1
  _latitude: number,
  _tiltAngle: number,
  averageSunHours: number, // peak sun hours per day
  systemLosses: number = 0.14 // inverter, wiring, etc.
): PVSystemOutput {
  // Peak power (STC conditions: 1000 W/m²)
  const peakPower = panelArea * panelEfficiency * 1; // kW

  // Daily energy
  const dailyEnergy = peakPower * averageSunHours * (1 - systemLosses);

  // Monthly/Annual
  const monthlyEnergy = dailyEnergy * 30;
  const annualEnergy = dailyEnergy * 365;

  // Capacity factor
  const capacityFactor = (dailyEnergy / (peakPower * 24)) * 100;

  // CO2 avoided (vs coal)
  const co2Avoided = annualEnergy * (CO2_PER_KWH_COAL - CO2_PER_KWH_SOLAR);

  return {
    peakPower: Math.round(peakPower * 100) / 100,
    dailyEnergy: Math.round(dailyEnergy * 100) / 100,
    monthlyEnergy: Math.round(monthlyEnergy),
    annualEnergy: Math.round(annualEnergy),
    capacityFactor: Math.round(capacityFactor * 10) / 10,
    co2Avoided: Math.round(co2Avoided),
  };
}

function optimalTiltAngle(latitude: number): { annual: number; summer: number; winter: number } {
  return {
    annual: Math.abs(latitude), // Roughly equal to latitude
    summer: Math.abs(latitude) - 15,
    winter: Math.abs(latitude) + 15,
  };
}

// ============================================================================
// CARBON FOOTPRINT
// ============================================================================

interface CarbonFootprint {
  transportation: number;
  home: number;
  food: number;
  goods: number;
  total: number;
  comparison: string;
}

function calculateCarbonFootprint(
  carMilesPerYear: number,
  carMPG: number,
  flightHoursPerYear: number,
  electricityKwhPerMonth: number,
  gasThermPerMonth: number,
  meatMealsPerWeek: number
): CarbonFootprint {
  // Transportation
  const carCO2 = (carMilesPerYear / carMPG) * 8.89; // kg CO2 per gallon
  const flightCO2 = flightHoursPerYear * 250; // kg CO2 per flight hour
  const transportation = carCO2 + flightCO2;

  // Home energy
  const electricityCO2 = electricityKwhPerMonth * 12 * 0.42; // US average
  const gasCO2 = gasThermPerMonth * 12 * 5.3; // kg CO2 per therm
  const home = electricityCO2 + gasCO2;

  // Food
  const meatCO2 = meatMealsPerWeek * 52 * 3; // ~3kg CO2 per meat meal
  const baseFoodCO2 = 1500; // baseline food footprint
  const food = meatCO2 + baseFoodCO2;

  // Goods & services (estimated)
  const goods = 2000; // average

  const total = transportation + home + food + goods;

  let comparison: string;
  if (total < 6000) comparison = 'Well below average (Great!)';
  else if (total < 12000) comparison = 'Below US average';
  else if (total < 16000) comparison = 'Near US average (~16 tons)';
  else if (total < 20000) comparison = 'Above average';
  else comparison = 'High carbon footprint';

  return {
    transportation: Math.round(transportation),
    home: Math.round(home),
    food: Math.round(food),
    goods: Math.round(goods),
    total: Math.round(total),
    comparison,
  };
}

// ============================================================================
// RENEWABLE ENERGY COMPARISON
// ============================================================================

interface EnergyComparison {
  source: string;
  co2PerKwh: number;
  landUse: string;
  capacityFactor: string;
  lifecycle: string;
}

const ENERGY_SOURCES: EnergyComparison[] = [
  { source: 'Coal', co2PerKwh: 0.91, landUse: '~2.7 ha/MW', capacityFactor: '40-50%', lifecycle: '40 years' },
  { source: 'Natural Gas', co2PerKwh: 0.41, landUse: '~0.4 ha/MW', capacityFactor: '40-60%', lifecycle: '30 years' },
  { source: 'Solar PV', co2PerKwh: 0.041, landUse: '~2 ha/MW', capacityFactor: '15-25%', lifecycle: '25-30 years' },
  { source: 'Wind', co2PerKwh: 0.011, landUse: '~0.3 ha/MW (direct)', capacityFactor: '25-45%', lifecycle: '20-25 years' },
  { source: 'Nuclear', co2PerKwh: 0.012, landUse: '~0.1 ha/MW', capacityFactor: '90-93%', lifecycle: '40-60 years' },
  { source: 'Hydropower', co2PerKwh: 0.024, landUse: 'Variable', capacityFactor: '30-60%', lifecycle: '50+ years' },
];

// ============================================================================
// CLIMATE DATA
// ============================================================================

interface ClimateZone {
  name: string;
  avgSunHours: number;
  avgTemp: number;
  pvPotential: string;
}

const CLIMATE_ZONES: Record<string, ClimateZone> = {
  'tropical': { name: 'Tropical', avgSunHours: 5.5, avgTemp: 27, pvPotential: 'Excellent' },
  'desert': { name: 'Desert', avgSunHours: 7.0, avgTemp: 28, pvPotential: 'Excellent' },
  'mediterranean': { name: 'Mediterranean', avgSunHours: 5.0, avgTemp: 17, pvPotential: 'Very Good' },
  'temperate': { name: 'Temperate', avgSunHours: 3.5, avgTemp: 12, pvPotential: 'Good' },
  'continental': { name: 'Continental', avgSunHours: 4.0, avgTemp: 8, pvPotential: 'Good' },
  'subarctic': { name: 'Subarctic', avgSunHours: 2.5, avgTemp: -5, pvPotential: 'Fair' },
};

// ============================================================================
// WIND ENERGY
// ============================================================================

function calculateWindPower(
  windSpeed: number, // m/s
  rotorDiameter: number, // m
  airDensity: number = 1.225, // kg/m³
  efficiency: number = 0.4 // Betz limit is 0.593
): { power: number; areaSwept: number; formula: string } {
  const area = Math.PI * Math.pow(rotorDiameter / 2, 2);
  const power = 0.5 * airDensity * area * Math.pow(windSpeed, 3) * efficiency;

  return {
    power: Math.round(power), // Watts
    areaSwept: Math.round(area * 100) / 100,
    formula: 'P = ½ρAv³η',
  };
}

// ============================================================================
// TREE CARBON SEQUESTRATION
// ============================================================================

function calculateTreeSequestration(
  numberOfTrees: number,
  treeAgeYears: number,
  treeType: 'deciduous' | 'conifer' = 'deciduous'
): { annualSequestration: number; lifetimeSequestration: number; comparison: string } {
  // Average tree sequesters ~22kg CO2/year when mature
  const baseRate = treeType === 'deciduous' ? 22 : 18;
  const maturityFactor = Math.min(1, treeAgeYears / 20);
  const annualPerTree = baseRate * maturityFactor;

  const annualSequestration = numberOfTrees * annualPerTree;
  const lifetimeSequestration = numberOfTrees * baseRate * 40; // 40-year lifetime

  const milesOffset = annualSequestration / 0.411; // kg CO2 per mile driven

  return {
    annualSequestration: Math.round(annualSequestration),
    lifetimeSequestration: Math.round(lifetimeSequestration),
    comparison: `Offsets ~${Math.round(milesOffset)} miles of driving per year`,
  };
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const solarEnvironmentalTool: UnifiedTool = {
  name: 'solar_environmental',
  description: `Solar energy and environmental calculations.

Operations:

Solar Position:
- sun_position: Calculate sun position for location/time
- day_length: Calculate sunrise, sunset, day length

Solar Energy:
- irradiance: Calculate solar irradiance
- pv_output: Estimate PV system output
- optimal_tilt: Calculate optimal panel tilt angle

Carbon & Environment:
- carbon_footprint: Calculate personal carbon footprint
- energy_compare: Compare energy sources (CO2, land use)
- tree_offset: Calculate tree carbon sequestration

Wind Energy:
- wind_power: Calculate wind turbine power

Climate:
- climate_zone: Get climate zone data for solar potential`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'sun_position', 'day_length', 'irradiance', 'pv_output', 'optimal_tilt',
          'carbon_footprint', 'energy_compare', 'tree_offset', 'wind_power', 'climate_zone',
        ],
        description: 'Operation to perform',
      },
      latitude: { type: 'number', description: 'Latitude in degrees' },
      longitude: { type: 'number', description: 'Longitude in degrees' },
      date: { type: 'string', description: 'Date (YYYY-MM-DD)' },
      hour: { type: 'number', description: 'Hour of day (0-23)' },
      // PV params
      panel_area: { type: 'number', description: 'Solar panel area in m²' },
      panel_efficiency: { type: 'number', description: 'Panel efficiency (0-1)' },
      tilt_angle: { type: 'number', description: 'Panel tilt angle in degrees' },
      sun_hours: { type: 'number', description: 'Average peak sun hours per day' },
      // Carbon params
      car_miles: { type: 'number', description: 'Annual car miles' },
      car_mpg: { type: 'number', description: 'Car fuel efficiency (MPG)' },
      flight_hours: { type: 'number', description: 'Annual flight hours' },
      electricity_kwh: { type: 'number', description: 'Monthly electricity usage (kWh)' },
      gas_therms: { type: 'number', description: 'Monthly gas usage (therms)' },
      meat_meals: { type: 'number', description: 'Meat meals per week' },
      // Wind params
      wind_speed: { type: 'number', description: 'Wind speed (m/s)' },
      rotor_diameter: { type: 'number', description: 'Wind turbine rotor diameter (m)' },
      // Tree params
      num_trees: { type: 'number', description: 'Number of trees' },
      tree_age: { type: 'number', description: 'Tree age in years' },
      tree_type: { type: 'string', enum: ['deciduous', 'conifer'] },
      // Climate
      zone: { type: 'string', description: 'Climate zone name' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeSolarEnvironmental(
  toolCall: UnifiedToolCall
): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'sun_position': {
        const latitude = args.latitude || 40.7128; // NYC default
        const longitude = args.longitude || -74.006;
        const date = args.date ? new Date(args.date) : new Date();
        const hour = args.hour ?? 12;

        const position = calculateSolarPosition(latitude, longitude, date, hour);

        result = {
          operation: 'sun_position',
          location: { latitude, longitude },
          datetime: { date: date.toISOString().split('T')[0], hour },
          position,
          interpretation:
            position.altitude > 0
              ? `Sun is ${position.altitude}° above horizon, ${position.azimuth}° from North`
              : 'Sun is below horizon',
        };
        break;
      }

      case 'day_length': {
        const latitude = args.latitude || 40.7128;
        const longitude = args.longitude || -74.006;
        const date = args.date ? new Date(args.date) : new Date();

        const position = calculateSolarPosition(latitude, longitude, date, 12);

        // Calculate for solstices too
        const summerSolstice = calculateSolarPosition(latitude, longitude, new Date('2024-06-21'), 12);
        const winterSolstice = calculateSolarPosition(latitude, longitude, new Date('2024-12-21'), 12);

        result = {
          operation: 'day_length',
          location: { latitude, longitude },
          date: date.toISOString().split('T')[0],
          today: {
            sunrise: position.sunrise,
            sunset: position.sunset,
            day_length_hours: position.dayLength,
          },
          annual_extremes: {
            summer_solstice: { day_length: summerSolstice.dayLength },
            winter_solstice: { day_length: winterSolstice.dayLength },
          },
        };
        break;
      }

      case 'irradiance': {
        const latitude = args.latitude || 40.7128;
        const longitude = args.longitude || -74.006;
        const date = args.date ? new Date(args.date) : new Date();
        const hour = args.hour ?? 12;
        const tiltAngle = args.tilt_angle ?? 30;

        const position = calculateSolarPosition(latitude, longitude, date, hour);
        const irradiance = calculateSolarIrradiance(position.altitude, 1.5, 0.7, tiltAngle);

        result = {
          operation: 'irradiance',
          location: { latitude, longitude },
          sun_altitude: position.altitude,
          panel_tilt: tiltAngle,
          irradiance_w_per_m2: irradiance,
          note: 'Clear sky model. Actual values depend on weather, pollution, etc.',
        };
        break;
      }

      case 'pv_output': {
        const panelArea = args.panel_area || 20; // m²
        const efficiency = args.panel_efficiency || 0.20;
        const latitude = args.latitude || 40.7128;
        const tiltAngle = args.tilt_angle ?? Math.abs(latitude);
        const sunHours = args.sun_hours || 4.5;

        const output = calculatePVOutput(panelArea, efficiency, latitude, tiltAngle, sunHours);

        result = {
          operation: 'pv_output',
          system: {
            panel_area_m2: panelArea,
            efficiency: `${(efficiency * 100).toFixed(0)}%`,
            tilt_angle: tiltAngle,
            avg_sun_hours: sunHours,
          },
          output,
          economics: {
            at_rate_015: `$${Math.round(output.annualEnergy * 0.15)}/year savings`,
            payback_estimate: 'Depends on system cost and incentives',
          },
        };
        break;
      }

      case 'optimal_tilt': {
        const latitude = args.latitude || 40.7128;
        const angles = optimalTiltAngle(latitude);

        result = {
          operation: 'optimal_tilt',
          latitude,
          optimal_angles: angles,
          recommendation:
            `For year-round production, tilt panels at ${Math.round(angles.annual)}°. ` +
            `Adjust to ${Math.round(angles.summer)}° in summer, ${Math.round(angles.winter)}° in winter for best seasonal output.`,
        };
        break;
      }

      case 'carbon_footprint': {
        const footprint = calculateCarbonFootprint(
          args.car_miles || 12000,
          args.car_mpg || 25,
          args.flight_hours || 10,
          args.electricity_kwh || 900,
          args.gas_therms || 50,
          args.meat_meals || 7
        );

        result = {
          operation: 'carbon_footprint',
          inputs: {
            car_miles: args.car_miles || 12000,
            car_mpg: args.car_mpg || 25,
            flight_hours: args.flight_hours || 10,
            electricity_kwh_month: args.electricity_kwh || 900,
            gas_therms_month: args.gas_therms || 50,
            meat_meals_week: args.meat_meals || 7,
          },
          footprint_kg_co2_per_year: footprint,
          context: {
            us_average: '~16,000 kg CO2/year',
            world_average: '~4,700 kg CO2/year',
            paris_target: '~2,000 kg CO2/year by 2050',
          },
        };
        break;
      }

      case 'energy_compare': {
        result = {
          operation: 'energy_compare',
          sources: ENERGY_SOURCES,
          key_insights: [
            'Wind and nuclear have lowest lifecycle CO2 emissions',
            'Solar requires significant land but produces no operating emissions',
            'Fossil fuels have high capacity factors but high emissions',
            'Hydro varies greatly based on geography',
          ],
        };
        break;
      }

      case 'tree_offset': {
        const numTrees = args.num_trees || 10;
        const treeAge = args.tree_age || 10;
        const treeType = args.tree_type || 'deciduous';

        const sequestration = calculateTreeSequestration(numTrees, treeAge, treeType);

        result = {
          operation: 'tree_offset',
          trees: {
            count: numTrees,
            age_years: treeAge,
            type: treeType,
          },
          sequestration_kg_co2: sequestration,
          context:
            'An average US household emits ~16,000 kg CO2/year. ' +
            `${numTrees} mature trees would offset ~${Math.round(sequestration.annualSequestration / 160)}% of this.`,
        };
        break;
      }

      case 'wind_power': {
        const windSpeed = args.wind_speed || 8;
        const rotorDiameter = args.rotor_diameter || 10;

        const power = calculateWindPower(windSpeed, rotorDiameter);

        // Wind class
        let windClass: string;
        if (windSpeed < 5.6) windClass = 'Class 1 (Poor)';
        else if (windSpeed < 6.4) windClass = 'Class 2 (Marginal)';
        else if (windSpeed < 7.0) windClass = 'Class 3 (Fair)';
        else if (windSpeed < 7.5) windClass = 'Class 4 (Good)';
        else if (windSpeed < 8.0) windClass = 'Class 5 (Excellent)';
        else if (windSpeed < 8.8) windClass = 'Class 6 (Outstanding)';
        else windClass = 'Class 7 (Superb)';

        result = {
          operation: 'wind_power',
          inputs: {
            wind_speed_m_s: windSpeed,
            rotor_diameter_m: rotorDiameter,
          },
          output: {
            power_watts: power.power,
            power_kw: Math.round(power.power / 100) / 10,
            swept_area_m2: power.areaSwept,
          },
          wind_class: windClass,
          formula: power.formula,
          note: 'Wind power scales with cube of wind speed - doubling wind speed = 8x power',
        };
        break;
      }

      case 'climate_zone': {
        const zone = args.zone || 'temperate';
        const data = CLIMATE_ZONES[zone.toLowerCase()];

        if (!data) {
          result = {
            operation: 'climate_zone',
            available_zones: Object.keys(CLIMATE_ZONES),
            error: `Unknown zone: ${zone}`,
          };
        } else {
          result = {
            operation: 'climate_zone',
            zone: data,
            pv_estimate: calculatePVOutput(20, 0.20, 35, 35, data.avgSunHours),
          };
        }
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

export function isSolarEnvironmentalAvailable(): boolean {
  return true;
}
