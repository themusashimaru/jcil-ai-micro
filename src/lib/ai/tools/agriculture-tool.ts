/**
 * AGRICULTURE TOOL
 *
 * Agricultural calculations: crop yield, irrigation, fertilizer,
 * soil analysis, growing degree days, and farm economics.
 *
 * Part of TIER AGRICULTURE - Ultimate Tool Arsenal
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// GROWING DEGREE DAYS
// ============================================================================

function growingDegreeDays(Tmax: number, Tmin: number, Tbase: number): number {
  const Tavg = (Tmax + Tmin) / 2;
  return Math.max(0, Tavg - Tbase);
}

function _accumulatedGDD(dailyTemps: Array<{ max: number; min: number }>, Tbase: number): number {
  return dailyTemps.reduce((sum, day) => sum + growingDegreeDays(day.max, day.min, Tbase), 0);
}

// ============================================================================
// CROP WATER REQUIREMENTS
// ============================================================================

function referenceET(Tmax: number, Tmin: number, radiation: number, humidity: number, windSpeed: number): number {
  // Simplified Penman-Monteith (FAO-56)
  const Tmean = (Tmax + Tmin) / 2;
  const es = 0.6108 * Math.exp((17.27 * Tmean) / (Tmean + 237.3));
  const ea = es * humidity / 100;
  const delta = (4098 * es) / Math.pow(Tmean + 237.3, 2);
  const gamma = 0.067; // psychrometric constant

  const ET0 = (0.408 * delta * radiation + gamma * (900 / (Tmean + 273)) * windSpeed * (es - ea))
              / (delta + gamma * (1 + 0.34 * windSpeed));

  return Math.max(0, ET0);
}

function cropWaterNeed(ET0: number, Kc: number, area: number): number {
  // ET0 in mm/day, area in hectares, result in m³/day
  return ET0 * Kc * area * 10;
}

// ============================================================================
// IRRIGATION CALCULATIONS
// ============================================================================

function irrigationDepth(fieldCapacity: number, wiltingPoint: number, rootDepth: number, MAD: number): number {
  // Net irrigation depth (mm)
  const AWC = fieldCapacity - wiltingPoint; // Available water capacity
  return AWC * rootDepth * MAD * 10;
}

function irrigationFrequency(netDepth: number, ETc: number): number {
  return netDepth / ETc;
}

function _applicationEfficiency(waterApplied: number, waterStored: number): number {
  return (waterStored / waterApplied) * 100;
}

// ============================================================================
// FERTILIZER CALCULATIONS
// ============================================================================

function fertilizerAmount(targetNutrient: number, fertilizerContent: number, efficiency: number = 1): number {
  // kg of fertilizer needed
  return targetNutrient / (fertilizerContent / 100) / efficiency;
}

function _nutrientRemoval(yield_kg_ha: number, nutrientContent: number): number {
  // kg nutrient removed per hectare
  return yield_kg_ha * nutrientContent / 100;
}

// ============================================================================
// YIELD ESTIMATION
// ============================================================================

function yieldPotential(radiation: number, RUE: number, HI: number, growingDays: number): number {
  // Simplified yield model
  // radiation in MJ/m²/day, RUE in g/MJ, HI = harvest index
  const biomass = radiation * RUE * growingDays / 1000; // kg/m²
  return biomass * HI * 10000; // kg/ha
}

function yieldGap(potentialYield: number, actualYield: number): { gap: number; percent: number } {
  const gap = potentialYield - actualYield;
  return {
    gap: Math.round(gap),
    percent: Math.round(gap / potentialYield * 100),
  };
}

// ============================================================================
// SOIL CALCULATIONS
// ============================================================================

function soilTexture(sand: number, silt: number, clay: number): string {
  // USDA soil texture triangle (simplified)
  if (clay >= 40) return 'Clay';
  if (sand >= 85) return 'Sand';
  if (silt >= 80) return 'Silt';
  if (clay >= 27 && sand >= 20 && sand <= 45) return 'Clay loam';
  if (clay >= 7 && clay < 27 && silt >= 28 && silt < 50 && sand <= 52) return 'Loam';
  if (sand >= 43 && clay < 20) return 'Sandy loam';
  if (silt >= 50 && clay >= 12 && clay < 27) return 'Silt loam';
  return 'Loam';
}

function _bulkDensity(ovenDryWeight: number, volume: number): number {
  return ovenDryWeight / volume;
}

function _porosity(bulkDensity: number, particleDensity: number = 2.65): number {
  return (1 - bulkDensity / particleDensity) * 100;
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const agricultureTool: UnifiedTool = {
  name: 'agriculture',
  description: `Agricultural and farming calculations.

Operations:
- gdd: Growing degree days calculation
- water: Crop water requirements and ET
- irrigation: Irrigation scheduling and efficiency
- fertilizer: Fertilizer calculations
- yield: Yield estimation and gap analysis
- soil: Soil texture and properties`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['gdd', 'water', 'irrigation', 'fertilizer', 'yield', 'soil'],
        description: 'Agriculture operation',
      },
      temp_max: { type: 'number', description: 'Maximum temperature (°C)' },
      temp_min: { type: 'number', description: 'Minimum temperature (°C)' },
      temp_base: { type: 'number', description: 'Base temperature (°C)' },
      radiation: { type: 'number', description: 'Solar radiation (MJ/m²/day)' },
      humidity: { type: 'number', description: 'Relative humidity (%)' },
      wind_speed: { type: 'number', description: 'Wind speed (m/s)' },
      Kc: { type: 'number', description: 'Crop coefficient' },
      area: { type: 'number', description: 'Field area (hectares)' },
      field_capacity: { type: 'number', description: 'Field capacity (%)' },
      wilting_point: { type: 'number', description: 'Wilting point (%)' },
      root_depth: { type: 'number', description: 'Root depth (m)' },
      target_nutrient: { type: 'number', description: 'Target nutrient amount (kg/ha)' },
      fertilizer_content: { type: 'number', description: 'Fertilizer nutrient content (%)' },
      yield_actual: { type: 'number', description: 'Actual yield (kg/ha)' },
      sand: { type: 'number', description: 'Sand content (%)' },
      silt: { type: 'number', description: 'Silt content (%)' },
      clay: { type: 'number', description: 'Clay content (%)' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeAgriculture(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'gdd': {
        const { temp_max = 28, temp_min = 15, temp_base = 10 } = args;
        const gdd = growingDegreeDays(temp_max, temp_min, temp_base);

        // Common crop GDD requirements
        const crops = [
          { name: 'Corn', gddNeeded: 2700 },
          { name: 'Soybeans', gddNeeded: 2400 },
          { name: 'Wheat', gddNeeded: 1500 },
          { name: 'Tomatoes', gddNeeded: 1400 },
          { name: 'Cotton', gddNeeded: 2200 },
        ];

        result = {
          operation: 'gdd',
          temperatures: { max_C: temp_max, min_C: temp_min, base_C: temp_base },
          daily_GDD: Math.round(gdd * 10) / 10,
          average_temp_C: (temp_max + temp_min) / 2,
          crop_requirements: crops.map(c => ({
            crop: c.name,
            gdd_required: c.gddNeeded,
            days_at_this_rate: Math.round(c.gddNeeded / gdd),
          })),
        };
        break;
      }

      case 'water': {
        const { temp_max = 30, temp_min = 18, radiation = 20, humidity = 60, wind_speed = 2, Kc = 1.0, area = 10 } = args;
        const ET0 = referenceET(temp_max, temp_min, radiation, humidity, wind_speed);
        const ETc = ET0 * Kc;
        const waterNeed = cropWaterNeed(ET0, Kc, area);

        result = {
          operation: 'water',
          conditions: {
            temp_max_C: temp_max,
            temp_min_C: temp_min,
            radiation_MJ_m2_day: radiation,
            humidity_percent: humidity,
            wind_speed_m_s: wind_speed,
          },
          reference_ET_mm_day: Math.round(ET0 * 100) / 100,
          crop_coefficient: Kc,
          crop_ET_mm_day: Math.round(ETc * 100) / 100,
          field_area_ha: area,
          daily_water_need_m3: Math.round(waterNeed),
          daily_water_need_liters: Math.round(waterNeed * 1000),
        };
        break;
      }

      case 'irrigation': {
        const { field_capacity = 30, wilting_point = 12, root_depth = 0.6, ETc = 5 } = args;
        const MAD = 0.5; // Management allowed depletion
        const netDepth = irrigationDepth(field_capacity, wilting_point, root_depth, MAD);
        const frequency = irrigationFrequency(netDepth, ETc);

        result = {
          operation: 'irrigation',
          soil_properties: {
            field_capacity_percent: field_capacity,
            wilting_point_percent: wilting_point,
            available_water_capacity_percent: field_capacity - wilting_point,
            root_depth_m: root_depth,
          },
          irrigation_schedule: {
            net_irrigation_depth_mm: Math.round(netDepth * 10) / 10,
            crop_ET_mm_day: ETc,
            irrigation_interval_days: Math.round(frequency * 10) / 10,
            management_allowed_depletion: MAD * 100,
          },
          recommendation: frequency < 3 ? 'Frequent irrigation needed' : frequency < 7 ? 'Normal schedule' : 'Deep watering less frequently',
        };
        break;
      }

      case 'fertilizer': {
        const { target_nutrient = 150, fertilizer_content = 46, efficiency = 0.7 } = args;
        const amount = fertilizerAmount(target_nutrient, fertilizer_content, efficiency);

        // Common fertilizers
        const fertilizers = [
          { name: 'Urea', N: 46, P: 0, K: 0 },
          { name: 'DAP', N: 18, P: 46, K: 0 },
          { name: 'MOP', N: 0, P: 0, K: 60 },
          { name: '10-26-26', N: 10, P: 26, K: 26 },
        ];

        result = {
          operation: 'fertilizer',
          target_nutrient_kg_ha: target_nutrient,
          fertilizer_nutrient_content_percent: fertilizer_content,
          efficiency: efficiency,
          fertilizer_needed_kg_ha: Math.round(amount),
          common_fertilizers: fertilizers,
          note: 'Efficiency accounts for losses (volatilization, leaching, fixation)',
        };
        break;
      }

      case 'yield': {
        const { radiation = 18, yield_actual = 4000 } = args;
        const RUE = 1.2; // Radiation use efficiency g/MJ
        const HI = 0.45; // Harvest index
        const growingDays = 120;

        const potential = yieldPotential(radiation, RUE, HI, growingDays);
        const gap = yieldGap(potential, yield_actual);

        result = {
          operation: 'yield',
          parameters: {
            avg_radiation_MJ_m2_day: radiation,
            radiation_use_efficiency_g_MJ: RUE,
            harvest_index: HI,
            growing_days: growingDays,
          },
          yield_analysis: {
            potential_yield_kg_ha: Math.round(potential),
            actual_yield_kg_ha: yield_actual,
            yield_gap_kg_ha: gap.gap,
            yield_gap_percent: gap.percent,
          },
          recommendations: gap.percent > 40 ? 'Large yield gap - check water, nutrients, pests' : gap.percent > 20 ? 'Moderate gap - room for improvement' : 'Good yield relative to potential',
        };
        break;
      }

      case 'soil': {
        const { sand = 40, silt = 35, clay = 25 } = args;
        const texture = soilTexture(sand, silt, clay);

        // Typical properties by texture
        const properties: Record<string, { fc: number; wp: number; infiltration: string }> = {
          'Sand': { fc: 10, wp: 4, infiltration: 'Very rapid' },
          'Sandy loam': { fc: 18, wp: 8, infiltration: 'Rapid' },
          'Loam': { fc: 27, wp: 12, infiltration: 'Moderate' },
          'Silt loam': { fc: 30, wp: 13, infiltration: 'Moderate-slow' },
          'Clay loam': { fc: 35, wp: 17, infiltration: 'Slow' },
          'Clay': { fc: 40, wp: 22, infiltration: 'Very slow' },
          'Silt': { fc: 32, wp: 14, infiltration: 'Moderate' },
        };

        const props = properties[texture] || properties['Loam'];

        result = {
          operation: 'soil',
          particle_distribution: {
            sand_percent: sand,
            silt_percent: silt,
            clay_percent: clay,
            total: sand + silt + clay,
          },
          texture_class: texture,
          typical_properties: {
            field_capacity_percent: props.fc,
            wilting_point_percent: props.wp,
            available_water_capacity_percent: props.fc - props.wp,
            infiltration_rate: props.infiltration,
          },
          management: texture.includes('Sand') ? 'Frequent light irrigation, frequent fertilization' :
                      texture.includes('Clay') ? 'Less frequent deep watering, watch for compaction' :
                      'Balanced water and nutrient management',
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (error) {
    return { toolCallId: id, content: `Agriculture Error: ${error instanceof Error ? error.message : 'Unknown'}`, isError: true };
  }
}

export function isAgricultureAvailable(): boolean { return true; }
