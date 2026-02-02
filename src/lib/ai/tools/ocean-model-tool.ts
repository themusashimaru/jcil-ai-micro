/**
 * OCEAN-MODEL TOOL
 * Comprehensive ocean circulation and dynamics modeling
 *
 * Provides:
 * - Ocean circulation simulation (thermohaline, wind-driven)
 * - Current modeling (major ocean currents)
 * - Temperature and salinity profiles
 * - Sea level and tide calculations
 * - Wave modeling (wave spectrum, significant wave height)
 * - Ocean-atmosphere interaction
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// PHYSICAL CONSTANTS
// ============================================================================

const OCEAN_CONSTANTS = {
  // Water properties
  rho_water: 1025,           // kg/m³ - seawater density
  cp_water: 3985,            // J/(kg·K) - specific heat of seawater
  alpha_thermal: 2.1e-4,     // K⁻¹ - thermal expansion coefficient
  beta_haline: 7.6e-4,       // (g/kg)⁻¹ - haline contraction coefficient

  // Earth parameters
  omega: 7.2921e-5,          // rad/s - Earth's angular velocity
  R_earth: 6.371e6,          // m - Earth's radius
  g: 9.81,                   // m/s² - gravitational acceleration

  // Ocean dimensions
  average_depth: 3688,       // m - average ocean depth
  total_area: 3.619e14,      // m² - total ocean area
  total_volume: 1.335e18,    // m³ - total ocean volume

  // Thermodynamic
  L_evap: 2.45e6,            // J/kg - latent heat of evaporation
  L_freeze: 3.34e5,          // J/kg - latent heat of fusion
};

// ============================================================================
// MAJOR OCEAN CURRENTS DATABASE
// ============================================================================

interface OceanCurrent {
  name: string;
  type: 'warm' | 'cold' | 'mixed';
  ocean: string;
  averageSpeed: number;  // m/s
  averageWidth: number;  // km
  averageDepth: number;  // m
  transport: number;     // Sv (Sverdrups = 10^6 m³/s)
  latitude: [number, number];
  longitude: [number, number];
  description: string;
  driver: 'wind' | 'thermohaline' | 'both';
}

const MAJOR_CURRENTS: Record<string, OceanCurrent> = {
  'gulf_stream': {
    name: 'Gulf Stream',
    type: 'warm',
    ocean: 'Atlantic',
    averageSpeed: 2.0,
    averageWidth: 100,
    averageDepth: 800,
    transport: 30,
    latitude: [25, 45],
    longitude: [-80, -40],
    description: 'Western boundary current carrying warm water from Gulf of Mexico along eastern North America',
    driver: 'both'
  },
  'kuroshio': {
    name: 'Kuroshio Current',
    type: 'warm',
    ocean: 'Pacific',
    averageSpeed: 1.5,
    averageWidth: 100,
    averageDepth: 700,
    transport: 25,
    latitude: [15, 40],
    longitude: [125, 180],
    description: 'Western boundary current in North Pacific, carrying warm subtropical water northward',
    driver: 'both'
  },
  'north_atlantic_drift': {
    name: 'North Atlantic Drift',
    type: 'warm',
    ocean: 'Atlantic',
    averageSpeed: 0.3,
    averageWidth: 500,
    averageDepth: 500,
    transport: 15,
    latitude: [40, 65],
    longitude: [-40, 10],
    description: 'Extension of Gulf Stream, moderating climate of northwestern Europe',
    driver: 'both'
  },
  'labrador_current': {
    name: 'Labrador Current',
    type: 'cold',
    ocean: 'Atlantic',
    averageSpeed: 0.5,
    averageWidth: 200,
    averageDepth: 200,
    transport: 5,
    latitude: [40, 65],
    longitude: [-60, -45],
    description: 'Cold current flowing south from Arctic along eastern Canada',
    driver: 'thermohaline'
  },
  'california_current': {
    name: 'California Current',
    type: 'cold',
    ocean: 'Pacific',
    averageSpeed: 0.25,
    averageWidth: 500,
    averageDepth: 300,
    transport: 10,
    latitude: [25, 50],
    longitude: [-130, -115],
    description: 'Eastern boundary current bringing cold water south along west coast of North America',
    driver: 'wind'
  },
  'humboldt_current': {
    name: 'Humboldt (Peru) Current',
    type: 'cold',
    ocean: 'Pacific',
    averageSpeed: 0.15,
    averageWidth: 200,
    averageDepth: 200,
    transport: 15,
    latitude: [-40, 5],
    longitude: [-90, -70],
    description: 'Cold, nutrient-rich current flowing north along South America west coast',
    driver: 'wind'
  },
  'antarctic_circumpolar': {
    name: 'Antarctic Circumpolar Current',
    type: 'cold',
    ocean: 'Southern',
    averageSpeed: 0.2,
    averageWidth: 2000,
    averageDepth: 4000,
    transport: 135,
    latitude: [-65, -45],
    longitude: [-180, 180],
    description: 'Largest ocean current, flows eastward around Antarctica',
    driver: 'wind'
  },
  'agulhas_current': {
    name: 'Agulhas Current',
    type: 'warm',
    ocean: 'Indian',
    averageSpeed: 1.5,
    averageWidth: 100,
    averageDepth: 1000,
    transport: 70,
    latitude: [-40, -27],
    longitude: [25, 40],
    description: 'Fast warm western boundary current along southeast Africa',
    driver: 'both'
  },
  'north_equatorial': {
    name: 'North Equatorial Current',
    type: 'warm',
    ocean: 'Pacific',
    averageSpeed: 0.25,
    averageWidth: 300,
    averageDepth: 100,
    transport: 45,
    latitude: [10, 20],
    longitude: [120, -80],
    description: 'Trade wind-driven current flowing westward in tropical Pacific',
    driver: 'wind'
  },
  'south_equatorial': {
    name: 'South Equatorial Current',
    type: 'warm',
    ocean: 'Pacific',
    averageSpeed: 0.25,
    averageWidth: 500,
    averageDepth: 100,
    transport: 35,
    latitude: [-10, 5],
    longitude: [-180, -80],
    description: 'Trade wind-driven current flowing westward in tropical Pacific',
    driver: 'wind'
  },
  'equatorial_undercurrent': {
    name: 'Equatorial Undercurrent',
    type: 'cold',
    ocean: 'Pacific',
    averageSpeed: 1.0,
    averageWidth: 200,
    averageDepth: 150,
    transport: 30,
    latitude: [-2, 2],
    longitude: [-180, -90],
    description: 'Subsurface current flowing eastward below equatorial surface currents',
    driver: 'both'
  },
  'north_atlantic_deep_water': {
    name: 'North Atlantic Deep Water',
    type: 'cold',
    ocean: 'Atlantic',
    averageSpeed: 0.02,
    averageWidth: 3000,
    averageDepth: 3000,
    transport: 17,
    latitude: [-60, 60],
    longitude: [-80, 20],
    description: 'Deep thermohaline circulation, part of Atlantic Meridional Overturning',
    driver: 'thermohaline'
  }
};

// ============================================================================
// WATER MASS TYPES
// ============================================================================

interface WaterMass {
  name: string;
  abbreviation: string;
  temperatureRange: [number, number];  // °C
  salinityRange: [number, number];     // PSU
  depthRange: [number, number];        // m
  formationRegion: string;
  characteristics: string[];
}

const WATER_MASSES: Record<string, WaterMass> = {
  'AABW': {
    name: 'Antarctic Bottom Water',
    abbreviation: 'AABW',
    temperatureRange: [-0.8, 2],
    salinityRange: [34.6, 34.7],
    depthRange: [3500, 6000],
    formationRegion: 'Antarctic continental shelf',
    characteristics: ['Densest water mass', 'High oxygen', 'Nutrient-rich']
  },
  'NADW': {
    name: 'North Atlantic Deep Water',
    abbreviation: 'NADW',
    temperatureRange: [2, 4],
    salinityRange: [34.9, 35.0],
    depthRange: [1500, 4000],
    formationRegion: 'Labrador Sea, Nordic Seas',
    characteristics: ['High salinity', 'Intermediate temperature', 'Drives AMOC']
  },
  'AAIW': {
    name: 'Antarctic Intermediate Water',
    abbreviation: 'AAIW',
    temperatureRange: [3, 7],
    salinityRange: [34.2, 34.4],
    depthRange: [500, 1500],
    formationRegion: 'Antarctic Polar Front',
    characteristics: ['Low salinity', 'High oxygen', 'Spreading northward']
  },
  'MOW': {
    name: 'Mediterranean Outflow Water',
    abbreviation: 'MOW',
    temperatureRange: [11, 13],
    salinityRange: [36.0, 36.5],
    depthRange: [800, 1200],
    formationRegion: 'Mediterranean Sea',
    characteristics: ['Very high salinity', 'Warm', 'High density']
  },
  'NPCDW': {
    name: 'North Pacific Central Deep Water',
    abbreviation: 'NPCDW',
    temperatureRange: [1, 2],
    salinityRange: [34.5, 34.7],
    depthRange: [2000, 4000],
    formationRegion: 'North Pacific',
    characteristics: ['Low oxygen', 'Old water', 'Nutrient-rich']
  }
};

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const oceanmodelTool: UnifiedTool = {
  name: 'ocean_model',
  description: 'Comprehensive ocean circulation and dynamics modeling tool. Simulates thermohaline circulation, models major ocean currents, calculates temperature/salinity profiles, wave characteristics, and ocean-atmosphere interactions.',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['simulate', 'currents', 'temperature', 'waves', 'density', 'coriolis', 'tides', 'ekman', 'info', 'examples'],
        description: 'Operation: simulate circulation, analyze currents, calculate temperature profiles, model waves, compute density, calculate Coriolis, predict tides, model Ekman transport'
      },
      // For simulate operation
      simulation_type: {
        type: 'string',
        enum: ['thermohaline', 'wind_driven', 'gyre', 'upwelling'],
        description: 'Type of circulation to simulate'
      },
      basin: {
        type: 'string',
        enum: ['atlantic', 'pacific', 'indian', 'southern', 'arctic', 'global'],
        description: 'Ocean basin to simulate'
      },
      duration_years: { type: 'number', description: 'Simulation duration in years' },
      // For currents operation
      current_name: { type: 'string', description: 'Name of current to analyze (e.g., gulf_stream, kuroshio)' },
      // For temperature operation
      latitude: { type: 'number', description: 'Latitude (-90 to 90)' },
      longitude: { type: 'number', description: 'Longitude (-180 to 180)' },
      depth: { type: 'number', description: 'Depth in meters (0 = surface)' },
      season: { type: 'string', enum: ['winter', 'spring', 'summer', 'fall'], description: 'Season' },
      // For waves operation
      wind_speed: { type: 'number', description: 'Wind speed in m/s' },
      fetch: { type: 'number', description: 'Fetch distance in km' },
      wind_duration: { type: 'number', description: 'Wind duration in hours' },
      // For density operation
      temperature: { type: 'number', description: 'Water temperature in °C' },
      salinity: { type: 'number', description: 'Salinity in PSU' },
      pressure_dbar: { type: 'number', description: 'Pressure in dbar (approx depth in m)' },
      // For coriolis operation
      velocity: { type: 'number', description: 'Water velocity in m/s' },
      direction: { type: 'number', description: 'Direction of motion (degrees from north)' },
      // For tides operation
      location: { type: 'string', description: 'Location name or coordinates' },
      date: { type: 'string', description: 'Date (YYYY-MM-DD)' },
      // For ekman operation
      wind_stress: { type: 'number', description: 'Wind stress in N/m²' }
    },
    required: ['operation']
  }
};

// ============================================================================
// EXECUTION FUNCTIONS
// ============================================================================

// Coriolis parameter
function coriolisParameter(latitude: number): number {
  return 2 * OCEAN_CONSTANTS.omega * Math.sin(latitude * Math.PI / 180);
}

// Seawater density (simplified UNESCO equation)
function seawaterDensity(T: number, S: number, p: number = 0): number {
  // T in °C, S in PSU, p in dbar
  // Simplified equation of state
  const rho0 = 999.842594 + 6.793952e-2 * T - 9.095290e-3 * T * T +
    1.001685e-4 * T * T * T - 1.120083e-6 * T ** 4 + 6.536336e-9 * T ** 5;

  const A = 8.24493e-1 - 4.0899e-3 * T + 7.6438e-5 * T * T - 8.2467e-7 * T ** 3;
  const B = -5.72466e-3 + 1.0227e-4 * T - 1.6546e-6 * T * T;
  const C = 4.8314e-4;

  const rhoS = rho0 + A * S + B * S ** 1.5 + C * S * S;

  // Pressure correction (simplified)
  const K = 19652.21 + 148.4206 * T - 2.327105 * T * T;
  const rhoP = rhoS / (1 - p / (K + p * 0.1));

  return rhoP;
}

// Ocean temperature profile (typical)
function temperatureProfile(latitude: number, depth: number, season: string = 'summer'): {
  temperature: number;
  layer: string;
  thermocline_depth: number;
  mixed_layer_depth: number;
} {
  const absLat = Math.abs(latitude);

  // Base surface temperature based on latitude
  let surfaceTemp: number;
  if (absLat < 10) surfaceTemp = 28;
  else if (absLat < 30) surfaceTemp = 25 - (absLat - 10) * 0.35;
  else if (absLat < 60) surfaceTemp = 18 - (absLat - 30) * 0.35;
  else surfaceTemp = 5 - (absLat - 60) * 0.15;

  // Seasonal adjustment
  const seasonAdjust = {
    summer: 2,
    spring: 0,
    fall: 0,
    winter: -3
  };
  surfaceTemp += seasonAdjust[season as keyof typeof seasonAdjust] || 0;

  // Mixed layer depth varies by latitude and season
  let mixedLayerDepth = 50;
  if (season === 'winter') mixedLayerDepth = 150;
  if (absLat > 40) mixedLayerDepth += 50;

  // Thermocline depth
  const thermoclineDepth = mixedLayerDepth + 100;
  const thermoclineBottom = 1000;

  // Deep water temperature
  const deepTemp = absLat > 60 ? 0 : 2;

  // Calculate temperature at depth
  let temp: number;
  let layer: string;

  if (depth <= mixedLayerDepth) {
    temp = surfaceTemp;
    layer = 'mixed_layer';
  } else if (depth <= thermoclineBottom) {
    // Exponential decay through thermocline
    const z = (depth - mixedLayerDepth) / (thermoclineBottom - mixedLayerDepth);
    temp = surfaceTemp - (surfaceTemp - deepTemp) * (1 - Math.exp(-3 * z));
    layer = depth <= thermoclineDepth + 200 ? 'thermocline' : 'pycnocline';
  } else {
    temp = deepTemp;
    layer = 'deep_water';
  }

  return {
    temperature: Math.round(temp * 100) / 100,
    layer,
    thermocline_depth: thermoclineDepth,
    mixed_layer_depth: mixedLayerDepth
  };
}

// Wave modeling (JONSWAP spectrum approach)
function modelWaves(windSpeed: number, fetch: number, duration: number): {
  significant_wave_height: number;
  peak_period: number;
  mean_period: number;
  wavelength: number;
  wave_steepness: number;
  sea_state: number;
  description: string;
  limiting_factor: 'fetch' | 'duration' | 'both';
} {
  // Fetch in meters, duration in seconds
  const fetchM = fetch * 1000;
  const durationS = duration * 3600;

  // Non-dimensional fetch and duration
  const fetchStar = OCEAN_CONSTANTS.g * fetchM / (windSpeed * windSpeed);
  const durationStar = OCEAN_CONSTANTS.g * durationS / windSpeed;

  // Fully developed sea conditions
  const fullFetchStar = 2.3e4;
  const fullDurationStar = 7.14e4;

  // Limiting factor
  const isFetchLimited = fetchStar < fullFetchStar;
  const isDurationLimited = durationStar < fullDurationStar;

  let effectiveFetchStar: number;
  let limitingFactor: 'fetch' | 'duration' | 'both';

  if (isFetchLimited && isDurationLimited) {
    effectiveFetchStar = Math.min(fetchStar, durationStar * 0.322);
    limitingFactor = 'both';
  } else if (isFetchLimited) {
    effectiveFetchStar = fetchStar;
    limitingFactor = 'fetch';
  } else {
    effectiveFetchStar = Math.min(fullFetchStar, durationStar * 0.322);
    limitingFactor = 'duration';
  }

  // JONSWAP empirical formulas
  const Hs = 0.0016 * Math.sqrt(effectiveFetchStar) * windSpeed * windSpeed / OCEAN_CONSTANTS.g;
  const Tp = 0.286 * Math.pow(effectiveFetchStar, 0.33) * windSpeed / OCEAN_CONSTANTS.g;
  const Tm = Tp * 0.87;

  // Deep water wavelength
  const wavelength = OCEAN_CONSTANTS.g * Tp * Tp / (2 * Math.PI);

  // Wave steepness
  const steepness = Hs / wavelength;

  // Sea state (Douglas scale)
  let seaState: number;
  let description: string;
  if (Hs < 0.1) { seaState = 0; description = 'Calm (glassy)'; }
  else if (Hs < 0.5) { seaState = 2; description = 'Smooth (wavelets)'; }
  else if (Hs < 1.25) { seaState = 3; description = 'Slight'; }
  else if (Hs < 2.5) { seaState = 4; description = 'Moderate'; }
  else if (Hs < 4) { seaState = 5; description = 'Rough'; }
  else if (Hs < 6) { seaState = 6; description = 'Very rough'; }
  else if (Hs < 9) { seaState = 7; description = 'High'; }
  else if (Hs < 14) { seaState = 8; description = 'Very high'; }
  else { seaState = 9; description = 'Phenomenal'; }

  return {
    significant_wave_height: Math.round(Hs * 100) / 100,
    peak_period: Math.round(Tp * 100) / 100,
    mean_period: Math.round(Tm * 100) / 100,
    wavelength: Math.round(wavelength * 10) / 10,
    wave_steepness: Math.round(steepness * 1000) / 1000,
    sea_state: seaState,
    description,
    limiting_factor: limitingFactor
  };
}

// Ekman transport
function calculateEkman(windStress: number, latitude: number): {
  ekman_depth: number;
  ekman_transport: number;
  surface_current_speed: number;
  surface_current_direction: string;
  spiral_angle: number;
} {
  const f = coriolisParameter(latitude);
  if (Math.abs(f) < 1e-10) {
    return {
      ekman_depth: 0,
      ekman_transport: 0,
      surface_current_speed: 0,
      surface_current_direction: 'undefined at equator',
      spiral_angle: 0
    };
  }

  // Eddy viscosity (typical value)
  const Az = 0.1; // m²/s

  // Ekman depth
  const ekmanDepth = Math.PI * Math.sqrt(2 * Az / Math.abs(f));

  // Surface current (45° to the right of wind in NH)
  const V0 = windStress / (Math.sqrt(OCEAN_CONSTANTS.rho_water * Az * Math.abs(f)));

  // Ekman transport (perpendicular to wind)
  const transport = windStress / (OCEAN_CONSTANTS.rho_water * f);

  return {
    ekman_depth: Math.round(ekmanDepth * 10) / 10,
    ekman_transport: Math.round(transport * 1000) / 1000,
    surface_current_speed: Math.round(V0 * 100) / 100,
    surface_current_direction: latitude >= 0 ? '45° right of wind' : '45° left of wind',
    spiral_angle: 45
  };
}

// Simple tide prediction
function predictTides(latitude: number, date: string): {
  date: string;
  location: { latitude: number };
  tide_type: string;
  high_tides: string[];
  low_tides: string[];
  tidal_range_m: number;
  spring_tide: boolean;
  neap_tide: boolean;
  lunar_phase: string;
  notes: string[];
} {
  // Simplified tidal calculation
  const dateObj = new Date(date);
  const dayOfYear = Math.floor((dateObj.getTime() - new Date(dateObj.getFullYear(), 0, 0).getTime()) / 86400000);

  // Lunar cycle ~29.5 days
  const lunarDay = dayOfYear % 29.5;

  // Determine lunar phase
  let lunarPhase: string;
  let springTide = false;
  let neapTide = false;

  if (lunarDay < 2 || lunarDay > 27.5) {
    lunarPhase = 'New Moon';
    springTide = true;
  } else if (lunarDay < 9) {
    lunarPhase = 'First Quarter';
    neapTide = lunarDay > 6;
  } else if (lunarDay < 17) {
    lunarPhase = lunarDay < 16.5 ? 'Full Moon' : 'Waning Gibbous';
    springTide = lunarDay < 17;
  } else if (lunarDay < 24) {
    lunarPhase = 'Last Quarter';
    neapTide = lunarDay > 21;
  } else {
    lunarPhase = 'Waning Crescent';
  }

  // Tidal range varies with latitude (simplified)
  const baseTidalRange = 2.0;
  let tidalRange = baseTidalRange;
  if (springTide) tidalRange *= 1.4;
  if (neapTide) tidalRange *= 0.7;

  // Determine tide type based on latitude
  let tideType: string;
  if (Math.abs(latitude) < 30) {
    tideType = 'Mixed (predominantly semidiurnal)';
  } else if (Math.abs(latitude) > 60) {
    tideType = 'Diurnal';
  } else {
    tideType = 'Semidiurnal';
  }

  // Generate tide times (simplified - 2 highs and 2 lows per day for semidiurnal)
  const baseHigh = 6 + (dayOfYear % 30) * 0.8 / 30;
  const highTides = [
    `${Math.floor(baseHigh)}:${String(Math.floor((baseHigh % 1) * 60)).padStart(2, '0')}`,
    `${Math.floor(baseHigh + 12.4) % 24}:${String(Math.floor(((baseHigh + 12.4) % 1) * 60)).padStart(2, '0')}`
  ];
  const lowTides = [
    `${Math.floor(baseHigh + 6.2) % 24}:${String(Math.floor(((baseHigh + 6.2) % 1) * 60)).padStart(2, '0')}`,
    `${Math.floor(baseHigh + 18.6) % 24}:${String(Math.floor(((baseHigh + 18.6) % 1) * 60)).padStart(2, '0')}`
  ];

  return {
    date,
    location: { latitude },
    tide_type: tideType,
    high_tides: highTides,
    low_tides: lowTides,
    tidal_range_m: Math.round(tidalRange * 100) / 100,
    spring_tide: springTide,
    neap_tide: neapTide,
    lunar_phase: lunarPhase,
    notes: [
      'Times are approximate and vary significantly by location',
      'Local bathymetry, coastline shape affect actual tides',
      'Use official tide tables for navigation'
    ]
  };
}

// Circulation simulation
function simulateCirculation(
  simulationType: string,
  basin: string,
  durationYears: number = 100
): {
  simulation_type: string;
  basin: string;
  duration_years: number;
  overturning_strength_Sv: number;
  heat_transport_PW: number;
  major_features: string[];
  water_masses_formed: string[];
  time_series: Array<{ year: number; overturning: number; heat_transport: number }>;
  climate_impacts: string[];
} {
  // Base overturning strength by basin
  const basinOverturning: Record<string, number> = {
    atlantic: 18,   // AMOC
    pacific: 8,     // Weaker due to freshwater balance
    indian: 10,
    southern: 25,   // Strong ACC
    arctic: 3,
    global: 20
  };

  const baseOverturning = basinOverturning[basin] || 15;

  // Simulation type adjustments
  let overturning = baseOverturning;
  let heatTransport: number;
  const majorFeatures: string[] = [];
  const waterMasses: string[] = [];

  switch (simulationType) {
    case 'thermohaline':
      majorFeatures.push('Deep water formation', 'Meridional overturning cells', 'Abyssal circulation');
      waterMasses.push('NADW', 'AABW', 'AAIW');
      heatTransport = overturning * 0.05; // ~1 PW per 20 Sv
      break;
    case 'wind_driven':
      overturning *= 0.6;
      majorFeatures.push('Subtropical gyres', 'Western boundary currents', 'Ekman transport');
      heatTransport = overturning * 0.03;
      break;
    case 'gyre':
      overturning *= 0.4;
      majorFeatures.push('Subtropical gyre', 'Subpolar gyre', 'Recirculation regions');
      heatTransport = overturning * 0.02;
      break;
    case 'upwelling':
      overturning *= 0.3;
      majorFeatures.push('Coastal upwelling', 'Equatorial upwelling', 'Ekman divergence');
      waterMasses.push('Deep nutrient-rich water');
      heatTransport = overturning * 0.01;
      break;
    default:
      heatTransport = overturning * 0.04;
  }

  // Generate time series with variability
  const timeSeries: Array<{ year: number; overturning: number; heat_transport: number }> = [];
  const dt = Math.max(1, Math.floor(durationYears / 20));

  for (let year = 0; year <= durationYears; year += dt) {
    // Add decadal variability
    const variability = 1 + 0.1 * Math.sin(2 * Math.PI * year / 50);
    timeSeries.push({
      year,
      overturning: Math.round(overturning * variability * 10) / 10,
      heat_transport: Math.round(heatTransport * variability * 100) / 100
    });
  }

  // Climate impacts
  const climateImpacts: string[] = [];
  if (basin === 'atlantic' || basin === 'global') {
    climateImpacts.push('Moderation of European climate');
    climateImpacts.push('Carbon sequestration in deep ocean');
    climateImpacts.push('Nutrient cycling affects productivity');
  }
  if (basin === 'pacific' || basin === 'global') {
    climateImpacts.push('ENSO modulation');
    climateImpacts.push('Pacific Decadal Oscillation');
  }
  climateImpacts.push('Heat redistribution from tropics to poles');

  return {
    simulation_type: simulationType,
    basin,
    duration_years: durationYears,
    overturning_strength_Sv: overturning,
    heat_transport_PW: heatTransport,
    major_features: majorFeatures,
    water_masses_formed: waterMasses,
    time_series: timeSeries,
    climate_impacts: climateImpacts
  };
}

// Coriolis force calculation
function calculateCoriolis(latitude: number, velocity: number, direction: number): {
  latitude: number;
  velocity_ms: number;
  direction_deg: number;
  coriolis_parameter: number;
  coriolis_acceleration: number;
  deflection_direction: string;
  inertial_period_hours: number;
  rossby_number: number;
  notes: string[];
} {
  const f = coriolisParameter(latitude);
  const coriolisAccel = Math.abs(f * velocity);

  // Inertial period
  const inertialPeriod = Math.abs(f) > 1e-10 ? (2 * Math.PI / Math.abs(f)) / 3600 : Infinity;

  // Rossby number (assume length scale of 100 km)
  const L = 100000; // m
  const Ro = velocity / (Math.abs(f) * L);

  return {
    latitude,
    velocity_ms: velocity,
    direction_deg: direction,
    coriolis_parameter: f,
    coriolis_acceleration: coriolisAccel,
    deflection_direction: latitude >= 0 ? 'right (Northern Hemisphere)' : 'left (Southern Hemisphere)',
    inertial_period_hours: Math.round(inertialPeriod * 10) / 10,
    rossby_number: Math.round(Ro * 1000) / 1000,
    notes: [
      Ro < 0.1 ? 'Flow is geostrophically balanced' : 'Coriolis effect is significant but not dominant',
      Math.abs(latitude) < 5 ? 'Near equator - Coriolis effect weak' : '',
      `At ${latitude}°, inertial oscillations have period of ${Math.round(inertialPeriod)} hours`
    ].filter(n => n)
  };
}

function getCurrentInfo(currentName: string): object {
  const current = MAJOR_CURRENTS[currentName];
  if (!current) {
    return {
      error: `Current '${currentName}' not found`,
      available_currents: Object.keys(MAJOR_CURRENTS)
    };
  }

  // Calculate additional properties
  const crossSection = current.averageWidth * 1000 * current.averageDepth; // m²
  const volumeTransport = current.transport * 1e6; // m³/s
  const massTransport = volumeTransport * OCEAN_CONSTANTS.rho_water / 1e12; // Tg/s

  // Heat transport estimate (for warm currents)
  const deltaT = current.type === 'warm' ? 10 : -5;
  const heatTransport = volumeTransport * OCEAN_CONSTANTS.rho_water * OCEAN_CONSTANTS.cp_water * deltaT / 1e15; // PW

  return {
    ...current,
    calculated: {
      cross_section_km2: Math.round(crossSection / 1e6 * 100) / 100,
      volume_transport_m3s: volumeTransport,
      mass_transport_Tgs: Math.round(massTransport * 100) / 100,
      estimated_heat_transport_PW: Math.round(heatTransport * 100) / 100,
      kinetic_energy_density_Jm3: Math.round(0.5 * OCEAN_CONSTANTS.rho_water * current.averageSpeed ** 2 * 100) / 100
    },
    comparable_currents: Object.entries(MAJOR_CURRENTS)
      .filter(([name, c]) => c.type === current.type && name !== currentName)
      .map(([name]) => name)
  };
}

function getInfo(): object {
  return {
    tool: 'ocean_model',
    description: 'Comprehensive ocean circulation and dynamics modeling',
    capabilities: [
      'Thermohaline circulation simulation',
      'Wind-driven circulation modeling',
      'Major ocean current analysis',
      'Temperature and salinity profiles',
      'Wave spectrum and sea state calculation',
      'Ekman transport computation',
      'Tidal predictions (simplified)',
      'Coriolis effect calculations',
      'Seawater density (UNESCO equation)'
    ],
    physical_constants: OCEAN_CONSTANTS,
    major_currents_available: Object.keys(MAJOR_CURRENTS),
    water_masses: Object.keys(WATER_MASSES),
    data_sources: [
      'WOCE Atlas',
      'Argo float data',
      'AVISO altimetry',
      'WOA (World Ocean Atlas)',
      'JONSWAP wave spectrum'
    ],
    limitations: [
      'Simplified physics - not a full numerical model',
      'Tide predictions are approximate',
      'Temperature profiles are climatological averages',
      'Does not include seasonal sea ice dynamics'
    ]
  };
}

function getExamples(): object {
  return {
    analyze_gulf_stream: {
      operation: 'currents',
      current_name: 'gulf_stream'
    },
    temperature_profile: {
      operation: 'temperature',
      latitude: 35,
      longitude: -70,
      depth: 500,
      season: 'summer'
    },
    wave_forecast: {
      operation: 'waves',
      wind_speed: 15,
      fetch: 500,
      wind_duration: 12
    },
    seawater_density: {
      operation: 'density',
      temperature: 15,
      salinity: 35,
      pressure_dbar: 1000
    },
    ekman_transport: {
      operation: 'ekman',
      wind_stress: 0.1,
      latitude: 40
    },
    simulate_amoc: {
      operation: 'simulate',
      simulation_type: 'thermohaline',
      basin: 'atlantic',
      duration_years: 100
    },
    coriolis_calculation: {
      operation: 'coriolis',
      latitude: 45,
      velocity: 1.0,
      direction: 90
    }
  };
}

// ============================================================================
// MAIN EXECUTOR
// ============================================================================

export async function executeoceanmodel(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation;

    let result: object;

    switch (operation) {
      case 'simulate':
        result = {
          operation: 'simulate',
          ...simulateCirculation(
            args.simulation_type || 'thermohaline',
            args.basin || 'atlantic',
            args.duration_years || 100
          )
        };
        break;

      case 'currents':
        if (!args.current_name) {
          result = {
            operation: 'currents',
            available_currents: Object.entries(MAJOR_CURRENTS).map(([key, c]) => ({
              key,
              name: c.name,
              type: c.type,
              ocean: c.ocean,
              transport_Sv: c.transport
            }))
          };
        } else {
          result = {
            operation: 'currents',
            ...getCurrentInfo(args.current_name)
          };
        }
        break;

      case 'temperature':
        result = {
          operation: 'temperature',
          latitude: args.latitude || 0,
          longitude: args.longitude || 0,
          depth: args.depth || 0,
          season: args.season || 'summer',
          profile: temperatureProfile(args.latitude || 0, args.depth || 0, args.season || 'summer')
        };
        break;

      case 'waves':
        if (!args.wind_speed) {
          throw new Error('wind_speed required for waves operation');
        }
        result = {
          operation: 'waves',
          input: {
            wind_speed_ms: args.wind_speed,
            fetch_km: args.fetch || 100,
            duration_hours: args.wind_duration || 6
          },
          ...modelWaves(args.wind_speed, args.fetch || 100, args.wind_duration || 6)
        };
        break;

      case 'density':
        result = {
          operation: 'density',
          input: {
            temperature_C: args.temperature ?? 15,
            salinity_PSU: args.salinity ?? 35,
            pressure_dbar: args.pressure_dbar ?? 0
          },
          density_kgm3: seawaterDensity(
            args.temperature ?? 15,
            args.salinity ?? 35,
            args.pressure_dbar ?? 0
          ),
          sigma_t: seawaterDensity(args.temperature ?? 15, args.salinity ?? 35, 0) - 1000,
          notes: [
            'Calculated using simplified UNESCO EOS-80',
            'sigma_t is potential density anomaly at surface',
            'For precision work, use TEOS-10'
          ]
        };
        break;

      case 'coriolis':
        if (args.latitude === undefined || args.velocity === undefined) {
          throw new Error('latitude and velocity required for coriolis operation');
        }
        result = {
          operation: 'coriolis',
          ...calculateCoriolis(args.latitude, args.velocity, args.direction || 0)
        };
        break;

      case 'tides':
        result = {
          operation: 'tides',
          ...predictTides(
            args.latitude || 40,
            args.date || new Date().toISOString().split('T')[0]
          )
        };
        break;

      case 'ekman':
        if (!args.wind_stress || args.latitude === undefined) {
          throw new Error('wind_stress and latitude required for ekman operation');
        }
        result = {
          operation: 'ekman',
          ...calculateEkman(args.wind_stress, args.latitude)
        };
        break;

      case 'examples':
        result = {
          operation: 'examples',
          examples: getExamples()
        };
        break;

      case 'info':
      default:
        result = {
          operation: 'info',
          ...getInfo()
        };
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function isoceanmodelAvailable(): boolean {
  return true;
}
