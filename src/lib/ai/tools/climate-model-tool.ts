/**
 * CLIMATE-MODEL TOOL
 * Climate system modeling with energy balance, carbon cycle, and scenario projections
 * Implements simplified climate models based on IPCC methodology
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Physical constants
const STEFAN_BOLTZMANN = 5.67e-8; // W/m²K⁴
const SOLAR_CONSTANT = 1361; // W/m²
const EARTH_ALBEDO = 0.3; // Average planetary albedo
const EARTH_RADIUS = 6.371e6; // meters
const EARTH_SURFACE_AREA = 5.1e14; // m²
const OCEAN_HEAT_CAPACITY = 1.4e22; // J/K for mixed layer (~100m)
const ATMOSPHERE_CO2_BASE = 280; // ppm pre-industrial

// Climate sensitivity parameter (°C per W/m² forcing)
const CLIMATE_SENSITIVITY = 0.8; // About 3°C per doubling of CO2

// Greenhouse gas properties
const GHG_PROPERTIES: Record<string, {
  gwp100: number;  // 100-year Global Warming Potential
  lifetime: number; // years
  radiative_efficiency: number; // W/m²/ppb
}> = {
  'CO2': { gwp100: 1, lifetime: 1000, radiative_efficiency: 0.0000137 },
  'CH4': { gwp100: 28, lifetime: 12, radiative_efficiency: 0.00036 },
  'N2O': { gwp100: 265, lifetime: 121, radiative_efficiency: 0.00303 },
  'CFC-11': { gwp100: 4660, lifetime: 52, radiative_efficiency: 0.259 },
  'CFC-12': { gwp100: 10200, lifetime: 102, radiative_efficiency: 0.32 },
  'HFC-134a': { gwp100: 1300, lifetime: 14, radiative_efficiency: 0.16 },
  'SF6': { gwp100: 23500, lifetime: 3200, radiative_efficiency: 0.57 }
};

// RCP/SSP Scenario pathways (radiative forcing by year)
const SCENARIOS: Record<string, {
  name: string;
  description: string;
  forcing_2100: number; // W/m²
  co2_2100: number; // ppm
  temp_2100: number; // °C above pre-industrial
  pathway: number[]; // forcing at [2020, 2040, 2060, 2080, 2100]
}> = {
  'RCP2.6': {
    name: 'RCP 2.6 (Strong Mitigation)',
    description: 'Aggressive emissions reduction, peak and decline',
    forcing_2100: 2.6,
    co2_2100: 421,
    temp_2100: 1.6,
    pathway: [2.2, 2.6, 2.4, 2.4, 2.6]
  },
  'RCP4.5': {
    name: 'RCP 4.5 (Moderate Mitigation)',
    description: 'Stabilization scenario',
    forcing_2100: 4.5,
    co2_2100: 538,
    temp_2100: 2.4,
    pathway: [2.3, 3.0, 3.8, 4.2, 4.5]
  },
  'RCP6.0': {
    name: 'RCP 6.0 (Stabilization)',
    description: 'Stabilization without overshoot',
    forcing_2100: 6.0,
    co2_2100: 670,
    temp_2100: 2.8,
    pathway: [2.3, 3.2, 4.4, 5.3, 6.0]
  },
  'RCP8.5': {
    name: 'RCP 8.5 (High Emissions)',
    description: 'Business as usual / fossil-intensive',
    forcing_2100: 8.5,
    co2_2100: 936,
    temp_2100: 4.3,
    pathway: [2.4, 4.0, 5.8, 7.3, 8.5]
  },
  'SSP1-1.9': {
    name: 'SSP1-1.9 (1.5°C Pathway)',
    description: 'Sustainability - very low GHG emissions',
    forcing_2100: 1.9,
    co2_2100: 393,
    temp_2100: 1.4,
    pathway: [2.2, 2.2, 1.9, 1.9, 1.9]
  },
  'SSP2-4.5': {
    name: 'SSP2-4.5 (Middle of the Road)',
    description: 'Intermediate emissions scenario',
    forcing_2100: 4.5,
    co2_2100: 538,
    temp_2100: 2.7,
    pathway: [2.3, 3.0, 3.8, 4.2, 4.5]
  },
  'SSP5-8.5': {
    name: 'SSP5-8.5 (Fossil-Fueled Development)',
    description: 'High fossil fuel use, high growth',
    forcing_2100: 8.5,
    co2_2100: 1135,
    temp_2100: 4.4,
    pathway: [2.4, 4.2, 6.0, 7.5, 8.5]
  }
};

// Simple Energy Balance Model
function energyBalanceTemperature(solarConstant: number, albedo: number, emissivity: number): number {
  // T = ((S(1-α))/(4εσ))^0.25
  const absorbed = solarConstant * (1 - albedo) / 4;
  const T = Math.pow(absorbed / (emissivity * STEFAN_BOLTZMANN), 0.25);
  return T - 273.15; // Convert to Celsius
}

// Radiative forcing from CO2 (logarithmic relationship)
function co2Forcing(co2_ppm: number, baseline: number = ATMOSPHERE_CO2_BASE): number {
  // ΔF = 5.35 × ln(C/C₀) W/m²
  return 5.35 * Math.log(co2_ppm / baseline);
}

// Temperature response to forcing
function temperatureResponse(forcing: number, sensitivity: number = CLIMATE_SENSITIVITY): number {
  return forcing * sensitivity;
}

// Transient climate response (includes ocean lag)
function transientResponse(
  forcing: number,
  years: number,
  oceanLagTime: number = 30
): number {
  const equilibrium = temperatureResponse(forcing);
  const fraction = 1 - Math.exp(-years / oceanLagTime);
  return equilibrium * fraction;
}

// Carbon cycle - simple box model
interface CarbonReservoir {
  atmosphere: number; // GtC
  ocean_surface: number;
  ocean_deep: number;
  terrestrial: number;
}

function carbonCycleStep(
  reservoirs: CarbonReservoir,
  emissions: number,
  dt: number = 1
): CarbonReservoir {
  // Simplified fluxes (GtC/yr)
  const k_ao = 0.1; // atmosphere to ocean surface
  const k_oa = 0.08; // ocean surface to atmosphere
  const k_od = 0.02; // ocean surface to deep
  const k_at = 0.05; // atmosphere to terrestrial (net)

  const new_atmosphere = reservoirs.atmosphere
    + emissions * dt
    - k_ao * reservoirs.atmosphere * dt
    + k_oa * reservoirs.ocean_surface * dt
    - k_at * reservoirs.atmosphere * dt;

  const new_ocean_surface = reservoirs.ocean_surface
    + k_ao * reservoirs.atmosphere * dt
    - k_oa * reservoirs.ocean_surface * dt
    - k_od * reservoirs.ocean_surface * dt;

  const new_ocean_deep = reservoirs.ocean_deep
    + k_od * reservoirs.ocean_surface * dt;

  const new_terrestrial = reservoirs.terrestrial
    + k_at * reservoirs.atmosphere * dt;

  return {
    atmosphere: new_atmosphere,
    ocean_surface: new_ocean_surface,
    ocean_deep: new_ocean_deep,
    terrestrial: new_terrestrial
  };
}

// Convert GtC to ppm CO2
function gtcToPpm(gtc: number): number {
  return gtc * 0.469; // 1 GtC ≈ 0.469 ppm
}

// Sea level rise from thermal expansion
function thermalSeaLevelRise(temperatureAnomaly: number, years: number): number {
  // Simplified: ~0.2-0.4 m per °C for thermal expansion at equilibrium
  const equilibrium = temperatureAnomaly * 0.3; // meters
  const timeConstant = 500; // years for deep ocean mixing
  return equilibrium * (1 - Math.exp(-years / timeConstant));
}

// Ice sheet contribution (simplified)
function iceSheetContribution(temperatureAnomaly: number, years: number): number {
  // Very simplified - actual ice sheet dynamics are complex
  const threshold = 1.5; // °C threshold for accelerated loss
  if (temperatureAnomaly < threshold) {
    return years * 0.003; // ~3mm/yr baseline
  } else {
    const excess = temperatureAnomaly - threshold;
    return years * (0.003 + excess * 0.005); // Accelerated loss
  }
}

// Run climate projection
function runProjection(
  scenario: string,
  startYear: number = 2020,
  endYear: number = 2100,
  baselineTemp: number = 1.1 // Current warming above pre-industrial
): Array<{
  year: number;
  forcing: number;
  temperature: number;
  co2_ppm: number;
  sea_level_rise: number;
}> {
  const scenarioData = SCENARIOS[scenario] || SCENARIOS['RCP4.5'];
  const results = [];

  const years = [2020, 2040, 2060, 2080, 2100];

  for (let year = startYear; year <= endYear; year += 10) {
    // Interpolate forcing
    let forcing = scenarioData.pathway[0];
    for (let i = 0; i < years.length - 1; i++) {
      if (year >= years[i] && year <= years[i + 1]) {
        const t = (year - years[i]) / (years[i + 1] - years[i]);
        forcing = scenarioData.pathway[i] + t * (scenarioData.pathway[i + 1] - scenarioData.pathway[i]);
        break;
      }
    }

    // Temperature with ocean lag
    const yearsFromNow = year - 2020;
    const temp = baselineTemp + transientResponse(forcing - 2.2, yearsFromNow);

    // CO2 concentration (interpolated)
    const co2 = ATMOSPHERE_CO2_BASE + (scenarioData.co2_2100 - ATMOSPHERE_CO2_BASE) *
                ((year - 1850) / (2100 - 1850));

    // Sea level rise
    const slr = thermalSeaLevelRise(temp, yearsFromNow) +
                iceSheetContribution(temp, yearsFromNow);

    results.push({
      year,
      forcing: parseFloat(forcing.toFixed(2)),
      temperature: parseFloat(temp.toFixed(2)),
      co2_ppm: parseFloat(co2.toFixed(0)),
      sea_level_rise: parseFloat((slr * 100).toFixed(1)) // cm
    });
  }

  return results;
}

// Calculate carbon budget
function carbonBudget(targetTemp: number, currentYear: number = 2024): {
  remaining_budget: number;
  years_at_current_rate: number;
  required_reduction: number;
} {
  // IPCC estimates (simplified)
  const budgetPerDegree = 400; // GtCO2 per 0.1°C
  const currentWarming = 1.2;
  const remainingWarming = targetTemp - currentWarming;
  const remainingBudget = remainingWarming * budgetPerDegree * 10;

  const currentEmissions = 40; // GtCO2/yr
  const yearsRemaining = remainingBudget / currentEmissions;

  // Required reduction to reach net zero by 2050
  const yearsTo2050 = 2050 - currentYear;
  const requiredReduction = currentEmissions / yearsTo2050;

  return {
    remaining_budget: parseFloat(remainingBudget.toFixed(0)),
    years_at_current_rate: parseFloat(yearsRemaining.toFixed(1)),
    required_reduction: parseFloat(requiredReduction.toFixed(2))
  };
}

// Climate feedbacks
function calculateFeedbacks(temperatureAnomaly: number): {
  water_vapor: number;
  ice_albedo: number;
  cloud: number;
  total: number;
} {
  // Feedback parameters (W/m²/°C)
  const waterVapor = 1.8 * temperatureAnomaly; // Positive feedback
  const iceAlbedo = 0.3 * temperatureAnomaly; // Positive feedback
  const cloud = -0.5 + 0.8 * temperatureAnomaly; // Net positive, uncertain

  return {
    water_vapor: parseFloat(waterVapor.toFixed(2)),
    ice_albedo: parseFloat(iceAlbedo.toFixed(2)),
    cloud: parseFloat(cloud.toFixed(2)),
    total: parseFloat((waterVapor + iceAlbedo + cloud).toFixed(2))
  };
}

export const climatemodelTool: UnifiedTool = {
  name: 'climate_model',
  description: 'Climate system modeling with energy balance, carbon cycle, and scenario projections based on IPCC methodology',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['info', 'simulate', 'project', 'forcing', 'carbon_cycle', 'sea_level', 'budget', 'feedbacks', 'compare', 'demonstrate'],
        description: 'Operation to perform'
      },
      scenario: {
        type: 'string',
        enum: ['RCP2.6', 'RCP4.5', 'RCP6.0', 'RCP8.5', 'SSP1-1.9', 'SSP2-4.5', 'SSP5-8.5'],
        description: 'Climate scenario pathway'
      },
      co2_ppm: { type: 'number', description: 'CO2 concentration in ppm' },
      emissions: { type: 'number', description: 'Annual emissions in GtCO2' },
      temperature: { type: 'number', description: 'Temperature anomaly in °C' },
      target_year: { type: 'integer', description: 'Target year for projections' },
      target_temp: { type: 'number', description: 'Target temperature limit (e.g., 1.5 or 2.0°C)' },
      years: { type: 'integer', description: 'Number of years to simulate' }
    },
    required: ['operation']
  }
};

export async function executeclimatemodel(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation;

    let result: any;

    switch (operation) {
      case 'info': {
        result = {
          operation: 'info',
          tool: 'climate_model',
          description: 'Simplified climate models based on IPCC methodology',
          model_components: {
            energy_balance: 'Stefan-Boltzmann equilibrium temperature',
            radiative_forcing: 'Logarithmic CO2-temperature relationship',
            transient_response: 'Ocean thermal lag effects',
            carbon_cycle: 'Simple box model of carbon reservoirs',
            sea_level: 'Thermal expansion + ice sheet contributions'
          },
          scenarios: Object.entries(SCENARIOS).map(([key, s]) => ({
            id: key,
            name: s.name,
            forcing_2100: s.forcing_2100 + ' W/m²',
            temp_2100: s.temp_2100 + '°C',
            co2_2100: s.co2_2100 + ' ppm'
          })),
          greenhouse_gases: Object.entries(GHG_PROPERTIES).map(([gas, props]) => ({
            gas,
            gwp100: props.gwp100,
            lifetime: props.lifetime + ' years'
          })),
          key_parameters: {
            climate_sensitivity: '~3°C per CO2 doubling',
            pre_industrial_co2: ATMOSPHERE_CO2_BASE + ' ppm',
            current_warming: '~1.2°C above pre-industrial'
          },
          operations: ['simulate', 'project', 'forcing', 'carbon_cycle', 'sea_level', 'budget', 'feedbacks', 'compare', 'demonstrate']
        };
        break;
      }

      case 'simulate': {
        const co2 = args.co2_ppm || 420;
        const albedo = args.albedo || EARTH_ALBEDO;

        // Energy balance with greenhouse effect
        const noGHGTemp = energyBalanceTemperature(SOLAR_CONSTANT, albedo, 1.0);
        const withGHGTemp = energyBalanceTemperature(SOLAR_CONSTANT, albedo, 0.612);

        // Forcing from current CO2
        const forcing = co2Forcing(co2);
        const tempAnomaly = temperatureResponse(forcing);

        result = {
          operation: 'simulate',
          inputs: {
            co2_concentration: co2 + ' ppm',
            planetary_albedo: albedo
          },
          energy_balance: {
            incoming_solar: (SOLAR_CONSTANT / 4).toFixed(1) + ' W/m²',
            reflected: ((SOLAR_CONSTANT / 4) * albedo).toFixed(1) + ' W/m²',
            absorbed: ((SOLAR_CONSTANT / 4) * (1 - albedo)).toFixed(1) + ' W/m²',
            temperature_no_atmosphere: noGHGTemp.toFixed(1) + '°C',
            temperature_with_greenhouse: withGHGTemp.toFixed(1) + '°C',
            greenhouse_warming: (withGHGTemp - noGHGTemp).toFixed(1) + '°C'
          },
          co2_effect: {
            radiative_forcing: forcing.toFixed(2) + ' W/m²',
            equilibrium_warming: tempAnomaly.toFixed(2) + '°C above pre-industrial',
            relative_to_pre_industrial: ((co2 / ATMOSPHERE_CO2_BASE - 1) * 100).toFixed(0) + '% increase'
          },
          formula: `ΔF = 5.35 × ln(${co2}/${ATMOSPHERE_CO2_BASE}) = ${forcing.toFixed(2)} W/m²`
        };
        break;
      }

      case 'project': {
        const scenario = args.scenario || 'SSP2-4.5';
        const endYear = args.target_year || 2100;

        const projection = runProjection(scenario, 2020, endYear);
        const scenarioInfo = SCENARIOS[scenario] || SCENARIOS['SSP2-4.5'];

        result = {
          operation: 'project',
          scenario: {
            id: scenario,
            name: scenarioInfo.name,
            description: scenarioInfo.description
          },
          projection,
          summary: {
            temperature_2050: projection.find(p => p.year === 2050)?.temperature || 'N/A',
            temperature_2100: projection.find(p => p.year === 2100)?.temperature || scenarioInfo.temp_2100,
            sea_level_2100: projection.find(p => p.year === 2100)?.sea_level_rise + ' cm',
            co2_2100: scenarioInfo.co2_2100 + ' ppm'
          },
          implications: scenario.includes('8.5') ? [
            'Severe warming: 4-5°C by 2100',
            'Major sea level rise: 0.5-1m+',
            'Significant ecosystem disruption',
            'Increased extreme weather'
          ] : scenario.includes('2.6') || scenario.includes('1.9') ? [
            'Limited warming: ~1.5°C',
            'Paris Agreement goals met',
            'Requires rapid decarbonization',
            'Net-zero emissions by 2050'
          ] : [
            'Moderate warming: 2-3°C',
            'Significant impacts but manageable',
            'Requires substantial mitigation',
            'Adaptation measures needed'
          ]
        };
        break;
      }

      case 'forcing': {
        const co2 = args.co2_ppm || 420;
        const ch4_ppb = args.ch4_ppb || 1900;
        const n2o_ppb = args.n2o_ppb || 335;

        const co2Force = co2Forcing(co2);
        const ch4Force = (ch4_ppb - 722) * GHG_PROPERTIES.CH4.radiative_efficiency;
        const n2oForce = (n2o_ppb - 270) * GHG_PROPERTIES.N2O.radiative_efficiency;

        const totalForcing = co2Force + ch4Force + n2oForce;

        result = {
          operation: 'forcing',
          greenhouse_gases: {
            CO2: {
              concentration: co2 + ' ppm',
              forcing: co2Force.toFixed(2) + ' W/m²',
              share: ((co2Force / totalForcing) * 100).toFixed(0) + '%'
            },
            CH4: {
              concentration: ch4_ppb + ' ppb',
              forcing: ch4Force.toFixed(2) + ' W/m²',
              share: ((ch4Force / totalForcing) * 100).toFixed(0) + '%'
            },
            N2O: {
              concentration: n2o_ppb + ' ppb',
              forcing: n2oForce.toFixed(2) + ' W/m²',
              share: ((n2oForce / totalForcing) * 100).toFixed(0) + '%'
            }
          },
          total: {
            radiative_forcing: totalForcing.toFixed(2) + ' W/m²',
            equilibrium_warming: temperatureResponse(totalForcing).toFixed(2) + '°C',
            transient_warming_30yr: transientResponse(totalForcing, 30).toFixed(2) + '°C'
          },
          aerosol_cooling: {
            estimate: '-1.0 to -0.5 W/m²',
            note: 'Partially offsets greenhouse warming'
          }
        };
        break;
      }

      case 'carbon_cycle': {
        const emissions = args.emissions || 40; // GtCO2/yr
        const years = args.years || 50;

        // Initial reservoirs (GtC)
        let reservoirs: CarbonReservoir = {
          atmosphere: 870, // ~415 ppm
          ocean_surface: 1000,
          ocean_deep: 37000,
          terrestrial: 2000
        };

        const trajectory = [];
        for (let year = 0; year <= years; year += 10) {
          trajectory.push({
            year: 2024 + year,
            atmosphere_gtc: parseFloat(reservoirs.atmosphere.toFixed(0)),
            co2_ppm: parseFloat(gtcToPpm(reservoirs.atmosphere).toFixed(0)),
            ocean_surface_gtc: parseFloat(reservoirs.ocean_surface.toFixed(0))
          });

          // Simulate 10 years
          for (let i = 0; i < 10; i++) {
            reservoirs = carbonCycleStep(reservoirs, emissions * 0.27, 1); // Convert GtCO2 to GtC
          }
        }

        const airborne_fraction = 0.44; // ~44% of emissions stay in atmosphere

        result = {
          operation: 'carbon_cycle',
          inputs: {
            annual_emissions: emissions + ' GtCO2/yr',
            simulation_years: years
          },
          carbon_reservoirs: {
            atmosphere: { value: 870, unit: 'GtC', note: 'Currently ~420 ppm' },
            ocean_surface: { value: 1000, unit: 'GtC' },
            ocean_deep: { value: 37000, unit: 'GtC' },
            terrestrial: { value: 2000, unit: 'GtC' }
          },
          fluxes: {
            ocean_uptake: '~10 GtCO2/yr',
            land_uptake: '~12 GtCO2/yr',
            net_to_atmosphere: (emissions * airborne_fraction).toFixed(0) + ' GtCO2/yr'
          },
          trajectory,
          airborne_fraction: (airborne_fraction * 100) + '%',
          insight: 'About 44% of CO2 emissions remain in atmosphere long-term'
        };
        break;
      }

      case 'sea_level': {
        const tempAnomaly = args.temperature || 2.0;
        const years = args.years || 100;

        const thermal = thermalSeaLevelRise(tempAnomaly, years);
        const ice = iceSheetContribution(tempAnomaly, years);
        const total = thermal + ice;

        result = {
          operation: 'sea_level',
          inputs: {
            temperature_anomaly: tempAnomaly + '°C',
            timeframe: years + ' years'
          },
          contributions: {
            thermal_expansion: {
              rise: (thermal * 100).toFixed(1) + ' cm',
              mechanism: 'Water expands as it warms'
            },
            ice_sheets: {
              rise: (ice * 100).toFixed(1) + ' cm',
              sources: 'Greenland, Antarctica, mountain glaciers'
            },
            total: {
              rise: (total * 100).toFixed(1) + ' cm',
              range: `${((total * 0.7) * 100).toFixed(0)}-${((total * 1.5) * 100).toFixed(0)} cm (uncertainty)`
            }
          },
          long_term_commitment: {
            note: 'Sea level continues rising for centuries after emissions stop',
            equilibrium_thermal: (tempAnomaly * 0.3 * 100).toFixed(0) + ' cm',
            potential_ice_loss: tempAnomaly > 2 ? 'Several meters over centuries' : 'Limited if warming kept below 2°C'
          },
          impacts: [
            'Coastal flooding and erosion',
            'Saltwater intrusion into aquifers',
            'Wetland and ecosystem loss',
            'Displacement of coastal populations'
          ]
        };
        break;
      }

      case 'budget': {
        const targetTemp = args.target_temp || 1.5;

        const budget = carbonBudget(targetTemp);

        result = {
          operation: 'budget',
          target: {
            temperature_limit: targetTemp + '°C above pre-industrial',
            context: targetTemp <= 1.5 ? 'Paris Agreement aspiration' : 'Paris Agreement upper limit'
          },
          carbon_budget: {
            remaining: budget.remaining_budget + ' GtCO2',
            years_at_current_rate: budget.years_at_current_rate + ' years',
            current_emissions: '40 GtCO2/yr'
          },
          pathway_to_net_zero: {
            required_annual_reduction: budget.required_reduction + ' GtCO2/yr',
            net_zero_target: '2050 for 1.5°C, 2070 for 2°C',
            action_required: 'Immediate and rapid emissions reduction'
          },
          sector_shares: {
            energy: '73%',
            agriculture: '12%',
            industry: '5%',
            waste: '3%',
            land_use: '7%'
          },
          solutions: [
            'Renewable energy deployment',
            'Energy efficiency improvements',
            'Electrification of transport',
            'Sustainable agriculture',
            'Forest conservation and restoration',
            'Carbon capture and storage'
          ]
        };
        break;
      }

      case 'feedbacks': {
        const tempAnomaly = args.temperature || 2.0;

        const feedbacks = calculateFeedbacks(tempAnomaly);

        result = {
          operation: 'feedbacks',
          temperature_anomaly: tempAnomaly + '°C',
          feedbacks: {
            water_vapor: {
              forcing: feedbacks.water_vapor + ' W/m²',
              type: 'Positive',
              mechanism: 'Warmer air holds more water vapor (strong GHG)'
            },
            ice_albedo: {
              forcing: feedbacks.ice_albedo + ' W/m²',
              type: 'Positive',
              mechanism: 'Melting ice exposes darker surfaces, absorbing more heat'
            },
            cloud: {
              forcing: feedbacks.cloud + ' W/m²',
              type: 'Mixed (net positive)',
              mechanism: 'Complex: low clouds cool, high clouds warm'
            },
            total_feedback: {
              forcing: feedbacks.total + ' W/m²',
              amplification: ((feedbacks.total / (tempAnomaly / CLIMATE_SENSITIVITY)) * 100).toFixed(0) + '%'
            }
          },
          tipping_points: [
            { element: 'Arctic sea ice', threshold: '~1.5°C', consequence: 'Ice-free summers' },
            { element: 'Greenland ice sheet', threshold: '~1.5-2°C', consequence: 'Irreversible melting' },
            { element: 'Amazon rainforest', threshold: '~2-3°C', consequence: 'Dieback and carbon release' },
            { element: 'Permafrost', threshold: '~1.5°C', consequence: 'Methane release' },
            { element: 'AMOC (Gulf Stream)', threshold: '~3-4°C', consequence: 'Circulation weakening' }
          ]
        };
        break;
      }

      case 'compare': {
        const scenarios = ['RCP2.6', 'SSP2-4.5', 'RCP8.5'];

        const comparisons = scenarios.map(s => {
          const info = SCENARIOS[s];
          return {
            scenario: s,
            name: info.name,
            temp_2100: info.temp_2100 + '°C',
            co2_2100: info.co2_2100 + ' ppm',
            forcing_2100: info.forcing_2100 + ' W/m²',
            sea_level_2100: (thermalSeaLevelRise(info.temp_2100, 80) +
                           iceSheetContribution(info.temp_2100, 80)).toFixed(2) + ' m'
          };
        });

        result = {
          operation: 'compare',
          scenarios: comparisons,
          key_differences: {
            emissions: {
              RCP2_6: 'Peak ~2020, net negative by 2100',
              SSP2_4_5: 'Slow decline, stabilize mid-century',
              RCP8_5: 'Continued growth throughout century'
            },
            impacts: {
              RCP2_6: 'Paris goals achievable, limited impacts',
              SSP2_4_5: 'Significant but manageable impacts',
              RCP8_5: 'Severe, potentially catastrophic impacts'
            }
          },
          visualization: `
TEMPERATURE PROJECTIONS
═══════════════════════

°C│
5 │                          ╱ RCP8.5
  │                      ╱
4 │                  ╱
  │              ╱
3 │          ╱          .----- SSP2-4.5
  │      .-'      .-'
2 │  .-'     .-'
  │.'    .-'            ------ RCP2.6
1 │ .-'
  │
0 │
  └───────────────────────────
   2020    2050    2080   2100
`
        };
        break;
      }

      case 'demonstrate': {
        const currentCO2 = 420;
        const forcing = co2Forcing(currentCO2);

        result = {
          operation: 'demonstrate',
          tool: 'climate_model',
          current_state: {
            co2_concentration: currentCO2 + ' ppm',
            warming_to_date: '~1.2°C above pre-industrial',
            rate_of_warming: '~0.2°C per decade',
            sea_level_rise_to_date: '~20 cm since 1900'
          },
          projections: {
            by_2050: {
              SSP1_1_9: '1.4°C',
              SSP2_4_5: '2.0°C',
              SSP5_8_5: '2.4°C'
            },
            by_2100: {
              SSP1_1_9: '1.4°C',
              SSP2_4_5: '2.7°C',
              SSP5_8_5: '4.4°C'
            }
          },
          key_equations: {
            radiative_forcing: 'ΔF = 5.35 × ln(C/C₀) W/m²',
            temperature_response: 'ΔT = λ × ΔF (λ ≈ 0.8 °C/(W/m²))',
            climate_sensitivity: 'ECS ≈ 3°C per CO2 doubling'
          },
          carbon_math: {
            current_emissions: '40 GtCO2/year',
            remaining_budget_1_5C: '~300 GtCO2',
            years_at_current_rate: '~7 years',
            required: 'Net-zero by 2050'
          },
          visualization: `
EARTH'S ENERGY BALANCE
══════════════════════

   ☀️ Solar: 341 W/m²
        │
    ┌───▼───┐
    │ 30%   │ Reflected (albedo)
    │reflected
    └───────┘
        │
    ┌───▼───┐
    │Absorbed│ 239 W/m²
    │by Earth│
    └───┬───┘
        │
   ┌────▼────┐
   │Greenhouse│ Traps heat
   │  Gases   │ +33°C effect
   └────┬────┘
        │
    ┌───▼───┐
    │Radiated │ 239 W/m² (equilibrium)
    │to space │
    └───────┘

CO2 FORCING BY CONCENTRATION
────────────────────────────
ppm  │ Forcing │ Warming
─────┼─────────┼─────────
280  │  0.0    │  0.0°C (pre-industrial)
350  │  1.2    │  1.0°C
420  │  2.2    │  1.8°C (current)
560  │  3.7    │  3.0°C (2× pre-industrial)
800  │  5.6    │  4.5°C
1000 │  6.8    │  5.5°C
`
        };
        break;
      }

      default:
        result = {
          error: `Unknown operation: ${operation}`,
          available: ['info', 'simulate', 'project', 'forcing', 'carbon_cycle', 'sea_level', 'budget', 'feedbacks', 'compare', 'demonstrate']
        };
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function isclimatemodelAvailable(): boolean {
  return true;
}
