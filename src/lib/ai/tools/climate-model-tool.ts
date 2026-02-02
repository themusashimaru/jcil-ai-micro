/**
 * CLIMATE-MODEL TOOL
 * Climate system modeling and projections
 *
 * Implements real climate physics:
 * - Zero-dimensional Energy Balance Model (EBM)
 * - Carbon cycle dynamics
 * - Radiative forcing calculations
 * - Climate feedback mechanisms
 * - RCP/SSP scenario projections
 * - Sea level rise estimation
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const climatemodelTool: UnifiedTool = {
  name: 'climate_model',
  description: 'Climate system modeling - energy balance, carbon cycle, temperature projections, sea level rise. Supports RCP and SSP scenarios.',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['simulate', 'project', 'forcing', 'carbon_cycle', 'sea_level', 'feedback', 'sensitivity', 'info'],
        description: 'Operation: simulate (run EBM), project (future temps), forcing (radiative forcing), carbon_cycle (CO2 dynamics), sea_level (rise projection), feedback (analyze feedbacks), sensitivity (climate sensitivity)'
      },
      scenario: {
        type: 'string',
        enum: ['RCP2.6', 'RCP4.5', 'RCP6.0', 'RCP8.5', 'SSP1-1.9', 'SSP1-2.6', 'SSP2-4.5', 'SSP3-7.0', 'SSP5-8.5'],
        description: 'Climate scenario (RCP = Representative Concentration Pathway, SSP = Shared Socioeconomic Pathway)'
      },
      base_year: { type: 'integer', description: 'Starting year for projections (default 2020)' },
      end_year: { type: 'integer', description: 'Ending year for projections (default 2100)' },
      co2_ppm: { type: 'number', description: 'CO2 concentration in ppm (default current ~420)' },
      emissions_gtc: { type: 'number', description: 'Annual CO2 emissions in GtC' },
      initial_temp_anomaly: { type: 'number', description: 'Initial temperature anomaly above pre-industrial (°C)' },
      climate_sensitivity: { type: 'number', description: 'Equilibrium climate sensitivity (°C per CO2 doubling, default 3.0)' },
      ocean_heat_capacity: { type: 'number', description: 'Effective ocean heat capacity (W·yr/m²/K)' }
    },
    required: ['operation']
  }
};

// ============================================================================
// PHYSICAL CONSTANTS
// ============================================================================

const CONSTANTS = {
  // Stefan-Boltzmann constant (W/m²/K⁴)
  STEFAN_BOLTZMANN: 5.67e-8,

  // Solar constant (W/m²)
  SOLAR_CONSTANT: 1361,

  // Earth's albedo (fraction reflected)
  EARTH_ALBEDO: 0.30,

  // Pre-industrial CO2 (ppm)
  CO2_PREINDUSTRIAL: 280,

  // Current CO2 (ppm, ~2024)
  CO2_CURRENT: 420,

  // Radiative forcing per CO2 doubling (W/m²)
  FORCING_2XCO2: 3.7,

  // Ocean mixed layer depth (m)
  OCEAN_MIXED_LAYER: 70,

  // Water specific heat capacity (J/kg/K)
  WATER_HEAT_CAPACITY: 4186,

  // Ocean water density (kg/m³)
  WATER_DENSITY: 1025,

  // Ocean fraction of Earth surface
  OCEAN_FRACTION: 0.71,

  // Seconds per year
  SECONDS_PER_YEAR: 31536000,

  // Pre-industrial global mean temperature (°C)
  TEMP_PREINDUSTRIAL: 14.0,

  // Current temperature anomaly above pre-industrial (°C)
  CURRENT_ANOMALY: 1.2,

  // Carbon in atmosphere (GtC)
  ATMOSPHERE_CARBON: 850,

  // Airborne fraction (fraction of emissions staying in atmosphere)
  AIRBORNE_FRACTION: 0.45
};

// ============================================================================
// SCENARIO DEFINITIONS
// ============================================================================

interface ScenarioData {
  name: string;
  description: string;
  co2_2100: number; // ppm
  forcing_2100: number; // W/m²
  emissions_pathway: (year: number) => number; // GtC/year
  warming_2100_low: number; // °C
  warming_2100_high: number; // °C
}

const SCENARIOS: Record<string, ScenarioData> = {
  'RCP2.6': {
    name: 'RCP2.6',
    description: 'Very low emissions - Paris Agreement compatible',
    co2_2100: 420,
    forcing_2100: 2.6,
    emissions_pathway: (year: number) => {
      if (year <= 2020) return 10;
      if (year <= 2050) return 10 * Math.exp(-0.05 * (year - 2020));
      return 10 * Math.exp(-0.05 * 30) * Math.exp(-0.1 * (year - 2050));
    },
    warming_2100_low: 0.9,
    warming_2100_high: 2.3
  },
  'RCP4.5': {
    name: 'RCP4.5',
    description: 'Intermediate emissions - stabilization',
    co2_2100: 540,
    forcing_2100: 4.5,
    emissions_pathway: (year: number) => {
      if (year <= 2040) return 10 + 0.1 * (year - 2020);
      return 12 * Math.exp(-0.02 * (year - 2040));
    },
    warming_2100_low: 1.7,
    warming_2100_high: 3.2
  },
  'RCP6.0': {
    name: 'RCP6.0',
    description: 'Intermediate-high emissions',
    co2_2100: 670,
    forcing_2100: 6.0,
    emissions_pathway: (year: number) => {
      if (year <= 2060) return 10 + 0.15 * (year - 2020);
      return 16 * Math.exp(-0.03 * (year - 2060));
    },
    warming_2100_low: 2.0,
    warming_2100_high: 3.7
  },
  'RCP8.5': {
    name: 'RCP8.5',
    description: 'Very high emissions - business as usual',
    co2_2100: 940,
    forcing_2100: 8.5,
    emissions_pathway: (year: number) => 10 + 0.3 * (year - 2020),
    warming_2100_low: 3.2,
    warming_2100_high: 5.4
  },
  'SSP1-1.9': {
    name: 'SSP1-1.9',
    description: 'Sustainability - 1.5°C pathway',
    co2_2100: 395,
    forcing_2100: 1.9,
    emissions_pathway: (year: number) => {
      if (year <= 2030) return 10 * Math.exp(-0.03 * (year - 2020));
      return 10 * Math.exp(-0.03 * 10) * Math.exp(-0.15 * (year - 2030));
    },
    warming_2100_low: 1.0,
    warming_2100_high: 1.8
  },
  'SSP1-2.6': {
    name: 'SSP1-2.6',
    description: 'Sustainability - well below 2°C',
    co2_2100: 430,
    forcing_2100: 2.6,
    emissions_pathway: (year: number) => {
      if (year <= 2050) return 10 * Math.exp(-0.04 * (year - 2020));
      return 10 * Math.exp(-0.04 * 30) * Math.exp(-0.08 * (year - 2050));
    },
    warming_2100_low: 1.3,
    warming_2100_high: 2.4
  },
  'SSP2-4.5': {
    name: 'SSP2-4.5',
    description: 'Middle of the road',
    co2_2100: 600,
    forcing_2100: 4.5,
    emissions_pathway: (year: number) => {
      if (year <= 2050) return 10 + 0.05 * (year - 2020);
      return 11.5 * Math.exp(-0.025 * (year - 2050));
    },
    warming_2100_low: 2.1,
    warming_2100_high: 3.5
  },
  'SSP3-7.0': {
    name: 'SSP3-7.0',
    description: 'Regional rivalry - high challenges',
    co2_2100: 800,
    forcing_2100: 7.0,
    emissions_pathway: (year: number) => 10 + 0.2 * (year - 2020),
    warming_2100_low: 2.8,
    warming_2100_high: 4.6
  },
  'SSP5-8.5': {
    name: 'SSP5-8.5',
    description: 'Fossil-fueled development',
    co2_2100: 1000,
    forcing_2100: 8.5,
    emissions_pathway: (year: number) => 10 + 0.35 * (year - 2020),
    warming_2100_low: 3.3,
    warming_2100_high: 5.7
  }
};

// ============================================================================
// RADIATIVE FORCING CALCULATIONS
// ============================================================================

/**
 * Calculate radiative forcing from CO2 concentration
 * ΔF = 5.35 * ln(C/C₀) W/m²
 */
function co2Forcing(co2_ppm: number): number {
  return 5.35 * Math.log(co2_ppm / CONSTANTS.CO2_PREINDUSTRIAL);
}

/**
 * Calculate radiative forcing from CH4 concentration
 * Simplified: ΔF ≈ 0.036 * (√M - √M₀) W/m²
 */
function ch4Forcing(ch4_ppb: number, ch4_preindustrial: number = 722): number {
  return 0.036 * (Math.sqrt(ch4_ppb) - Math.sqrt(ch4_preindustrial));
}

/**
 * Calculate radiative forcing from N2O concentration
 * Simplified: ΔF ≈ 0.12 * (√N - √N₀) W/m²
 */
function n2oForcing(n2o_ppb: number, n2o_preindustrial: number = 270): number {
  return 0.12 * (Math.sqrt(n2o_ppb) - Math.sqrt(n2o_preindustrial));
}

/**
 * Total anthropogenic radiative forcing
 */
function totalForcing(
  co2_ppm: number,
  ch4_ppb: number = 1900,
  n2o_ppb: number = 330,
  aerosol_forcing: number = -0.9 // Cooling effect from aerosols
): number {
  return co2Forcing(co2_ppm) + ch4Forcing(ch4_ppb) + n2oForcing(n2o_ppb) + aerosol_forcing;
}

// ============================================================================
// ENERGY BALANCE MODEL
// ============================================================================

interface EBMState {
  temperature: number; // Global mean surface temperature (°C)
  temp_anomaly: number; // Anomaly above pre-industrial (°C)
  forcing: number; // Current radiative forcing (W/m²)
  co2_ppm: number;
  heat_uptake: number; // Ocean heat uptake (W/m²)
}

/**
 * Zero-dimensional Energy Balance Model
 *
 * C dT/dt = F - λT
 *
 * Where:
 * - C = effective heat capacity
 * - T = temperature anomaly
 * - F = radiative forcing
 * - λ = climate feedback parameter
 */
function runEBM(
  initialState: EBMState,
  years: number,
  dt: number, // timestep in years
  climateSensitivity: number,
  forcingFunction: (year: number) => number
): { states: EBMState[]; times: number[] } {
  const states: EBMState[] = [initialState];
  const times: number[] = [0];

  // Climate feedback parameter: λ = F_2x / ECS
  const lambda = CONSTANTS.FORCING_2XCO2 / climateSensitivity;

  // Effective heat capacity (W·yr/m²/K)
  // Represents ocean thermal inertia
  const heatCapacity = CONSTANTS.OCEAN_MIXED_LAYER *
    CONSTANTS.WATER_DENSITY *
    CONSTANTS.WATER_HEAT_CAPACITY *
    CONSTANTS.OCEAN_FRACTION /
    CONSTANTS.SECONDS_PER_YEAR;

  let state = { ...initialState };

  for (let t = dt; t <= years; t += dt) {
    const forcing = forcingFunction(t);

    // Energy imbalance: F - λT
    const imbalance = forcing - lambda * state.temp_anomaly;

    // Temperature change: dT = (F - λT) * dt / C
    const dT = imbalance * dt / heatCapacity;

    state = {
      temperature: CONSTANTS.TEMP_PREINDUSTRIAL + state.temp_anomaly + dT,
      temp_anomaly: state.temp_anomaly + dT,
      forcing,
      co2_ppm: state.co2_ppm, // Updated separately
      heat_uptake: imbalance
    };

    states.push({ ...state });
    times.push(t);
  }

  return { states, times };
}

// ============================================================================
// CARBON CYCLE MODEL
// ============================================================================

interface CarbonState {
  atmosphere: number; // GtC in atmosphere
  ocean_surface: number; // GtC in ocean surface
  ocean_deep: number; // GtC in deep ocean
  land_biosphere: number; // GtC in land biosphere
  co2_ppm: number;
}

/**
 * Simple box model of carbon cycle
 */
function runCarbonCycle(
  initialState: CarbonState,
  years: number,
  dt: number,
  emissionsFunction: (year: number) => number // GtC/year
): { states: CarbonState[]; times: number[] } {
  const states: CarbonState[] = [initialState];
  const times: number[] = [0];

  // Transfer rates (1/year)
  const k_atm_ocean = 0.10; // Atmosphere to ocean surface
  const k_ocean_atm = 0.08; // Ocean surface to atmosphere
  const k_ocean_deep = 0.02; // Ocean surface to deep
  const k_deep_ocean = 0.005; // Deep to ocean surface
  const k_atm_land = 0.05; // Atmosphere to land
  const k_land_atm = 0.04; // Land to atmosphere

  let state = { ...initialState };

  // GtC to ppm conversion (approximately 2.13 GtC per ppm)
  const gtcToPpm = (gtc: number) => gtc / 2.13;

  for (let t = dt; t <= years; t += dt) {
    const emissions = emissionsFunction(t);

    // Fluxes (GtC/year)
    const F_atm_ocean = k_atm_ocean * state.atmosphere;
    const F_ocean_atm = k_ocean_atm * state.ocean_surface;
    const F_ocean_deep = k_ocean_deep * state.ocean_surface;
    const F_deep_ocean = k_deep_ocean * state.ocean_deep;
    const F_atm_land = k_atm_land * state.atmosphere;
    const F_land_atm = k_land_atm * state.land_biosphere;

    // Update reservoirs
    const dAtm = emissions - F_atm_ocean + F_ocean_atm - F_atm_land + F_land_atm;
    const dOceanSurface = F_atm_ocean - F_ocean_atm - F_ocean_deep + F_deep_ocean;
    const dOceanDeep = F_ocean_deep - F_deep_ocean;
    const dLand = F_atm_land - F_land_atm;

    state = {
      atmosphere: state.atmosphere + dAtm * dt,
      ocean_surface: state.ocean_surface + dOceanSurface * dt,
      ocean_deep: state.ocean_deep + dOceanDeep * dt,
      land_biosphere: state.land_biosphere + dLand * dt,
      co2_ppm: CONSTANTS.CO2_PREINDUSTRIAL + gtcToPpm(state.atmosphere + dAtm * dt - 590) // 590 GtC pre-industrial
    };

    states.push({ ...state });
    times.push(t);
  }

  return { states, times };
}

// ============================================================================
// SEA LEVEL RISE MODEL
// ============================================================================

interface SeaLevelState {
  thermal_expansion: number; // m
  glacier_ice: number; // m
  greenland_ice: number; // m
  antarctic_ice: number; // m
  total: number; // m
}

/**
 * Semi-empirical sea level rise model
 * Based on temperature anomaly and rate of change
 */
function projectSeaLevel(
  tempAnomalyTimeseries: number[],
  years: number[],
  baseYear: number = 2020
): SeaLevelState[] {
  const states: SeaLevelState[] = [];

  // Coefficients (m/°C/year for rate-dependent, m/°C for equilibrium)
  const thermalCoef = 0.002; // Thermal expansion rate
  const glacierCoef = 0.003; // Glacier melt rate
  const greenlandCoef = 0.001; // Greenland rate (slow)
  const antarcticCoef = 0.0005; // Antarctic rate (very slow)

  let thermal = 0;
  let glacier = 0;
  let greenland = 0;
  let antarctic = 0;

  for (let i = 0; i < tempAnomalyTimeseries.length; i++) {
    const T = tempAnomalyTimeseries[i];
    const dt = i > 0 ? years[i] - years[i - 1] : 1;

    // Temperature-dependent rates
    thermal += thermalCoef * T * dt;
    glacier += glacierCoef * Math.max(0, T - 0.5) * dt; // Threshold for glacier loss
    greenland += greenlandCoef * Math.max(0, T - 1.0) * dt; // Higher threshold
    antarctic += antarcticCoef * Math.max(0, T - 2.0) * dt; // Even higher threshold

    states.push({
      thermal_expansion: thermal,
      glacier_ice: glacier,
      greenland_ice: greenland,
      antarctic_ice: antarctic,
      total: thermal + glacier + greenland + antarctic
    });
  }

  return states;
}

// ============================================================================
// CLIMATE FEEDBACK ANALYSIS
// ============================================================================

interface FeedbackAnalysis {
  name: string;
  value: number; // W/m²/K
  contribution: number; // Fraction of total feedback
  description: string;
}

function analyzeClimateFeedbacks(climateSensitivity: number): FeedbackAnalysis[] {
  // Planck feedback (baseline - no feedbacks)
  const planck = -3.2; // W/m²/K (negative = stabilizing)

  // Total feedback parameter
  const totalFeedback = CONSTANTS.FORCING_2XCO2 / climateSensitivity;
  const netFeedback = -planck - totalFeedback; // Positive feedbacks

  // Approximate breakdown (based on IPCC AR6)
  const feedbacks: FeedbackAnalysis[] = [
    {
      name: 'Planck (blackbody)',
      value: planck,
      contribution: planck / (planck - netFeedback),
      description: 'Increased thermal radiation as Earth warms - fundamental stabilizing feedback'
    },
    {
      name: 'Water vapor',
      value: 1.8,
      contribution: 1.8 / netFeedback * (netFeedback / (-planck + netFeedback)),
      description: 'Warmer air holds more water vapor (greenhouse gas) - strong positive feedback'
    },
    {
      name: 'Lapse rate',
      value: -0.6,
      contribution: -0.6 / netFeedback * (netFeedback / (-planck + netFeedback)),
      description: 'Changes in atmospheric temperature profile - weak negative feedback'
    },
    {
      name: 'Ice-albedo',
      value: 0.35,
      contribution: 0.35 / netFeedback * (netFeedback / (-planck + netFeedback)),
      description: 'Melting ice exposes darker surface - positive feedback'
    },
    {
      name: 'Cloud',
      value: 0.45,
      contribution: 0.45 / netFeedback * (netFeedback / (-planck + netFeedback)),
      description: 'Changes in cloud cover and properties - uncertain positive feedback'
    }
  ];

  return feedbacks;
}

// ============================================================================
// CLIMATE SENSITIVITY ANALYSIS
// ============================================================================

function computeClimateSensitivity(
  forcing_2x: number = CONSTANTS.FORCING_2XCO2,
  feedbackParameter: number = 1.23 // W/m²/K
): {
  ecs: number; // Equilibrium Climate Sensitivity
  tcr: number; // Transient Climate Response
  description: string;
} {
  // ECS = F_2x / λ
  const ecs = forcing_2x / feedbackParameter;

  // TCR is typically 50-70% of ECS due to ocean heat uptake
  const tcr = ecs * 0.6;

  return {
    ecs,
    tcr,
    description: `ECS = ${ecs.toFixed(2)}°C per CO2 doubling. ` +
      `TCR = ${tcr.toFixed(2)}°C (transient response). ` +
      `IPCC likely range: ECS 2.5-4.0°C, TCR 1.4-2.2°C.`
  };
}

// ============================================================================
// MAIN EXECUTOR
// ============================================================================

export async function executeclimatemodel(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const {
      operation = 'info',
      scenario = 'SSP2-4.5',
      base_year = 2020,
      end_year = 2100,
      co2_ppm = CONSTANTS.CO2_CURRENT,
      emissions_gtc = 10,
      initial_temp_anomaly = CONSTANTS.CURRENT_ANOMALY,
      climate_sensitivity = 3.0,
      ocean_heat_capacity
    } = args;

    const scenarioData = SCENARIOS[scenario] || SCENARIOS['SSP2-4.5'];
    const years = end_year - base_year;

    let result: any;

    switch (operation) {
      case 'simulate': {
        // Run energy balance model
        const initialState: EBMState = {
          temperature: CONSTANTS.TEMP_PREINDUSTRIAL + initial_temp_anomaly,
          temp_anomaly: initial_temp_anomaly,
          forcing: co2Forcing(co2_ppm),
          co2_ppm,
          heat_uptake: 0.8 // Current imbalance
        };

        // Create forcing function from scenario
        const forcingFunction = (t: number): number => {
          const year = base_year + t;
          const progress = Math.min(1, t / years);
          const targetForcing = scenarioData.forcing_2100;
          return co2Forcing(co2_ppm) + progress * (targetForcing - co2Forcing(co2_ppm));
        };

        const ebmResult = runEBM(initialState, years, 1, climate_sensitivity, forcingFunction);

        // Sample output
        const sampleInterval = Math.max(1, Math.floor(ebmResult.states.length / 20));
        const sampledStates = ebmResult.states.filter((_, i) => i % sampleInterval === 0);
        const sampledTimes = ebmResult.times.filter((_, i) => i % sampleInterval === 0)
          .map(t => base_year + t);

        const finalState = ebmResult.states[ebmResult.states.length - 1];

        result = {
          operation: 'simulate',
          scenario,
          base_year,
          end_year,
          climate_sensitivity,
          initial_conditions: {
            temp_anomaly: initial_temp_anomaly,
            co2_ppm,
            forcing: co2Forcing(co2_ppm)
          },
          final_state: {
            year: end_year,
            temp_anomaly: finalState.temp_anomaly,
            temperature: finalState.temperature,
            forcing: finalState.forcing
          },
          trajectory: sampledTimes.map((year, i) => ({
            year,
            temp_anomaly: sampledStates[i].temp_anomaly,
            forcing: sampledStates[i].forcing
          })),
          warming_rate: (finalState.temp_anomaly - initial_temp_anomaly) / years,
          description: `EBM simulation under ${scenario}. ` +
            `Warming from ${initial_temp_anomaly.toFixed(2)}°C to ${finalState.temp_anomaly.toFixed(2)}°C by ${end_year}.`
        };
        break;
      }

      case 'project': {
        // Temperature projection using scenario data
        const projectedWarming = {
          scenario: scenarioData.name,
          description: scenarioData.description,
          co2_2100: scenarioData.co2_2100,
          forcing_2100: scenarioData.forcing_2100,
          warming_range: {
            low: scenarioData.warming_2100_low,
            high: scenarioData.warming_2100_high,
            central: (scenarioData.warming_2100_low + scenarioData.warming_2100_high) / 2
          },
          current_anomaly: initial_temp_anomaly
        };

        // Generate yearly projections
        const trajectory: { year: number; anomaly_low: number; anomaly_central: number; anomaly_high: number }[] = [];
        for (let year = base_year; year <= end_year; year += 5) {
          const progress = (year - base_year) / years;
          const low = initial_temp_anomaly + progress * (projectedWarming.warming_range.low - initial_temp_anomaly);
          const high = initial_temp_anomaly + progress * (projectedWarming.warming_range.high - initial_temp_anomaly);
          trajectory.push({
            year,
            anomaly_low: low,
            anomaly_central: (low + high) / 2,
            anomaly_high: high
          });
        }

        result = {
          operation: 'project',
          ...projectedWarming,
          trajectory,
          remaining_carbon_budget: {
            '1.5C': Math.max(0, 400 - (initial_temp_anomaly - 1.1) * 400 / 0.4),
            '2.0C': Math.max(0, 1150 - (initial_temp_anomaly - 1.1) * 1150 / 0.9)
          },
          description: `${scenarioData.name}: ${scenarioData.description}. ` +
            `Projects ${projectedWarming.warming_range.low.toFixed(1)}-${projectedWarming.warming_range.high.toFixed(1)}°C warming by 2100.`
        };
        break;
      }

      case 'forcing': {
        // Calculate radiative forcing
        const forcing = {
          co2: co2Forcing(co2_ppm),
          ch4: ch4Forcing(1900),
          n2o: n2oForcing(330),
          aerosols: -0.9,
          total: totalForcing(co2_ppm)
        };

        // Forcing for CO2 doubling scenarios
        const forcingDoubled = co2Forcing(2 * CONSTANTS.CO2_PREINDUSTRIAL);
        const forcingTripled = co2Forcing(3 * CONSTANTS.CO2_PREINDUSTRIAL);

        result = {
          operation: 'forcing',
          current_co2_ppm: co2_ppm,
          pre_industrial_co2_ppm: CONSTANTS.CO2_PREINDUSTRIAL,
          radiative_forcing: forcing,
          reference_forcings: {
            'co2_doubling': forcingDoubled,
            'co2_tripling': forcingTripled
          },
          formula: 'ΔF_CO2 = 5.35 × ln(C/C₀) W/m²',
          equilibrium_temp_change: forcing.total / (CONSTANTS.FORCING_2XCO2 / climate_sensitivity),
          description: `Current forcing: ${forcing.total.toFixed(2)} W/m² (CO2: ${forcing.co2.toFixed(2)}, ` +
            `CH4: ${forcing.ch4.toFixed(2)}, N2O: ${forcing.n2o.toFixed(2)}, aerosols: ${forcing.aerosols})`
        };
        break;
      }

      case 'carbon_cycle': {
        // Run carbon cycle model
        const initialCarbon: CarbonState = {
          atmosphere: CONSTANTS.ATMOSPHERE_CARBON,
          ocean_surface: 900,
          ocean_deep: 37000,
          land_biosphere: 2000,
          co2_ppm
        };

        const carbonResult = runCarbonCycle(
          initialCarbon,
          years,
          1,
          scenarioData.emissions_pathway
        );

        // Sample output
        const sampleInterval = Math.max(1, Math.floor(carbonResult.states.length / 20));
        const sampledStates = carbonResult.states.filter((_, i) => i % sampleInterval === 0);
        const sampledTimes = carbonResult.times.filter((_, i) => i % sampleInterval === 0)
          .map(t => base_year + t);

        const finalCarbon = carbonResult.states[carbonResult.states.length - 1];

        result = {
          operation: 'carbon_cycle',
          scenario,
          initial_state: initialCarbon,
          final_state: {
            year: end_year,
            ...finalCarbon
          },
          trajectory: sampledTimes.map((year, i) => ({
            year,
            co2_ppm: sampledStates[i].co2_ppm,
            atmosphere_gtc: sampledStates[i].atmosphere
          })),
          cumulative_emissions: years * emissions_gtc, // Simplified
          airborne_fraction: CONSTANTS.AIRBORNE_FRACTION,
          description: `Carbon cycle under ${scenario}. ` +
            `CO2 rises from ${co2_ppm.toFixed(0)} to ${finalCarbon.co2_ppm.toFixed(0)} ppm by ${end_year}.`
        };
        break;
      }

      case 'sea_level': {
        // Project sea level rise
        const tempTrajectory: number[] = [];
        const yearTrajectory: number[] = [];

        for (let year = base_year; year <= end_year; year++) {
          const progress = (year - base_year) / years;
          const warming = initial_temp_anomaly +
            progress * ((scenarioData.warming_2100_low + scenarioData.warming_2100_high) / 2 - initial_temp_anomaly);
          tempTrajectory.push(warming);
          yearTrajectory.push(year);
        }

        const slrStates = projectSeaLevel(tempTrajectory, yearTrajectory);
        const finalSLR = slrStates[slrStates.length - 1];

        // Sample output
        const sampleInterval = Math.max(1, Math.floor(slrStates.length / 20));
        const sampledSLR = slrStates.filter((_, i) => i % sampleInterval === 0);
        const sampledYears = yearTrajectory.filter((_, i) => i % sampleInterval === 0);

        result = {
          operation: 'sea_level',
          scenario,
          final_sea_level_rise: {
            year: end_year,
            total_m: finalSLR.total,
            total_cm: finalSLR.total * 100,
            components: {
              thermal_expansion_m: finalSLR.thermal_expansion,
              glacier_melt_m: finalSLR.glacier_ice,
              greenland_m: finalSLR.greenland_ice,
              antarctic_m: finalSLR.antarctic_ice
            }
          },
          trajectory: sampledYears.map((year, i) => ({
            year,
            total_cm: sampledSLR[i].total * 100
          })),
          impacts: {
            coastal_flooding: finalSLR.total > 0.5 ? 'Significant increase' : 'Moderate increase',
            affected_population: `~${Math.round(finalSLR.total * 200)} million at risk`
          },
          description: `Sea level rise under ${scenario}: ${(finalSLR.total * 100).toFixed(1)} cm by ${end_year}.`
        };
        break;
      }

      case 'feedback': {
        const feedbacks = analyzeClimateFeedbacks(climate_sensitivity);

        result = {
          operation: 'feedback',
          climate_sensitivity,
          feedback_parameter: CONSTANTS.FORCING_2XCO2 / climate_sensitivity,
          feedbacks,
          net_positive_feedback: feedbacks.filter(f => f.value > 0).reduce((s, f) => s + f.value, 0),
          net_negative_feedback: feedbacks.filter(f => f.value < 0).reduce((s, f) => s + f.value, 0),
          description: `Climate feedbacks for ECS=${climate_sensitivity}°C. ` +
            `Water vapor (+1.8 W/m²/K) is the strongest positive feedback.`
        };
        break;
      }

      case 'sensitivity': {
        const sensitivity = computeClimateSensitivity();

        // Range analysis
        const lowSensitivity = computeClimateSensitivity(CONSTANTS.FORCING_2XCO2, 1.5);
        const highSensitivity = computeClimateSensitivity(CONSTANTS.FORCING_2XCO2, 0.9);

        result = {
          operation: 'sensitivity',
          default_estimate: sensitivity,
          range: {
            low: { ecs: lowSensitivity.ecs, tcr: lowSensitivity.tcr },
            high: { ecs: highSensitivity.ecs, tcr: highSensitivity.tcr }
          },
          ipcc_ar6_range: {
            ecs: { likely: [2.5, 4.0], very_likely: [2.0, 5.0] },
            tcr: { likely: [1.4, 2.2], very_likely: [1.0, 2.5] }
          },
          definitions: {
            ecs: 'Equilibrium Climate Sensitivity - warming after CO2 doubles and system reaches equilibrium',
            tcr: 'Transient Climate Response - warming at time of CO2 doubling (70 years at 1%/yr increase)'
          },
          description: sensitivity.description
        };
        break;
      }

      case 'info':
      default: {
        result = {
          operation: 'info',
          tool: 'climate_model',
          description: 'Climate system modeling tool implementing energy balance models, carbon cycle dynamics, and scenario projections',
          scenarios: Object.entries(SCENARIOS).map(([key, s]) => ({
            name: key,
            description: s.description,
            warming_2100: `${s.warming_2100_low}-${s.warming_2100_high}°C`,
            co2_2100: `${s.co2_2100} ppm`
          })),
          physics: {
            energy_balance: 'C dT/dt = F - λT (ocean thermal inertia delays warming)',
            radiative_forcing: 'ΔF = 5.35 × ln(CO2/280) W/m²',
            climate_sensitivity: 'ECS = F_2x / λ (typically 2.5-4°C per doubling)',
            carbon_cycle: 'Multi-box model with atmosphere, ocean, and land reservoirs'
          },
          operations: {
            simulate: 'Run energy balance model',
            project: 'Temperature projections under scenarios',
            forcing: 'Calculate radiative forcing',
            carbon_cycle: 'Model CO2 concentration changes',
            sea_level: 'Project sea level rise',
            feedback: 'Analyze climate feedbacks',
            sensitivity: 'Climate sensitivity analysis'
          },
          current_state: {
            co2_ppm: CONSTANTS.CO2_CURRENT,
            temp_anomaly: `${CONSTANTS.CURRENT_ANOMALY}°C above pre-industrial`,
            forcing: `${totalForcing(CONSTANTS.CO2_CURRENT).toFixed(2)} W/m²`
          }
        };
      }
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };

  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    return {
      toolCallId: id,
      content: JSON.stringify({
        error: errorMessage,
        tool: 'climate_model',
        hint: 'Use operation="info" for documentation'
      }, null, 2),
      isError: true
    };
  }
}

export function isclimatemodelAvailable(): boolean {
  return true;
}
